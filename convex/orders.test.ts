/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
runtime.process ??= {}
runtime.process.env ??= {}
runtime.process.env.QR_TOKEN_ENCRYPTION_KEY = "test-only-key"
const modules = import.meta.glob("./**/*.ts")
const setup = async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await owner.mutation(api.restaurants.create, { name: "Cafe", slug: "orders-cafe", idempotencyKey: "restaurant" })
    const table = await owner.action(api.tables.create, { restaurantId, name: "A1" })
    const categoryId = await owner.mutation(api.menu.createCategory, { restaurantId, name: "Food" })
    const itemId = await owner.mutation(api.menu.createItem, { restaurantId, categoryId, name: "Noodles", priceMinor: 1000 })
    const groupId = await owner.mutation(api.menu.createOptionGroup, { itemId, name: "Size", selectionMode: "single", required: true, minSelections: 1, maxSelections: 1 })
    const choiceId = await owner.mutation(api.menu.createOptionChoice, { optionGroupId: groupId, name: "Large", priceDeltaMinor: 250 })
    const secondChoiceId = await owner.mutation(api.menu.createOptionChoice, { optionGroupId: groupId, name: "Small", priceDeltaMinor: 0 })
    return { t, owner, restaurantId, table, itemId, choiceId, secondChoiceId }
}

test("public submission recalculates prices, snapshots lines, and replays idempotently", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    const args = { restaurantSlug: " orders-cafe ", tableToken: table.token, idempotencyKey: " first ", items: [{ itemId, quantity: 2, choiceIds: [choiceId], notes: " no onions " }] }
    const first = await t.mutation(api.orders.submitPublic, args)
    expect(first.orderNumber).toMatch(/-0001$/)
    expect(first.totalMinor).toBe(2500)
    expect(await t.mutation(api.orders.submitPublic, args)).toEqual(first)
    await expect(t.mutation(api.orders.submitPublic, { ...args, items: [{ ...args.items[0], quantity: 1 }] })).rejects.toThrow("CONFLICT")
    const stored = await t.run(async (ctx) => ctx.db.get("orders", first.orderId))
    expect(stored?.items[0]).toMatchObject({ itemName: "Noodles", basePriceMinor: 1000, unitPriceMinor: 1250, lineTotalMinor: 2500, notes: "no onions" })
    const publicOrder = await t.query(api.orders.resolvePublicTracking, { restaurantSlug: "orders-cafe", trackingToken: first.trackingToken })
    expect(publicOrder).toMatchObject({ restaurantName: "Cafe", tableName: "A1", totalMinor: 2500 })
    expect(JSON.stringify(publicOrder)).not.toContain(itemId)
    void owner
    void restaurantId
})

test("staff status transitions are authorized and constrained", async () => {
    const { t, restaurantId, table, itemId, choiceId } = await setup()
    const order = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "status", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    const staff = t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff" })
    await t.run(async (ctx) => ctx.db.insert("restaurantMemberships", { restaurantId, tokenIdentifier: "issuer|staff", role: "staff", status: "active", canMarkPaid: false, createdAt: Date.now(), updatedAt: Date.now() }))
    await staff.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing" })
    await expect(staff.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "pending" })).rejects.toThrow("CONFLICT")
    await staff.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "served" })
})

test("idempotency is scoped to the active table and survives status changes", async () => {
    const { t, restaurantId, table, itemId, choiceId, owner } = await setup()
    const secondTable = await owner.action(api.tables.create, { restaurantId, name: "A2" })
    const args = { restaurantSlug: "orders-cafe", idempotencyKey: "same-key", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] }
    const first = await t.mutation(api.orders.submitPublic, { ...args, tableToken: table.token })
    const second = await t.mutation(api.orders.submitPublic, { ...args, tableToken: secondTable.token })
    expect(second.orderId).not.toBe(first.orderId)
    expect(second.trackingToken).not.toBe(first.trackingToken)
    const staff = t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff" })
    await t.run(async (ctx) => ctx.db.insert("restaurantMemberships", { restaurantId, tokenIdentifier: "issuer|staff", role: "staff", status: "active", canMarkPaid: false, createdAt: Date.now(), updatedAt: Date.now() }))
    await staff.mutation(api.orders.updateStatus, { orderId: first.orderId, status: "preparing" })
    const replay = await t.mutation(api.orders.submitPublic, { ...args, tableToken: table.token })
    expect(replay).toEqual(first)
})

test("invalid public tracking tokens resolve to null", async () => {
    const { t } = await setup()
    expect(await t.query(api.orders.resolvePublicTracking, { restaurantSlug: "orders-cafe", trackingToken: "not-a-real-token" })).toBeNull()
    expect(await t.query(api.orders.resolvePublicTracking, { restaurantSlug: "orders-cafe", trackingToken: "%%%" })).toBeNull()
})

test("same item supports distinct choices and notes", async () => {
    const { t, table, itemId, choiceId, secondChoiceId } = await setup()
    const first = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "distinct-lines", items: [
        { itemId, quantity: 1, choiceIds: [choiceId], notes: "Extra sauce" },
        { itemId, quantity: 1, choiceIds: [secondChoiceId], notes: "No onions" },
    ] })
    const replay = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "distinct-lines", items: [
        { itemId, quantity: 1, choiceIds: [secondChoiceId], notes: "No onions" },
        { itemId, quantity: 1, choiceIds: [choiceId], notes: "Extra sauce" },
    ] })
    expect(replay).toEqual(first)
    const stored = await t.run(async (ctx) => ctx.db.get("orders", first.orderId))
    expect(stored?.items).toHaveLength(2)
    expect(stored?.items.map((item) => item.notes)).toEqual(expect.arrayContaining(["Extra sauce", "No onions"]))
})

test("tracking tokens are bound to the route restaurant", async () => {
    const { t, table, itemId, choiceId, owner } = await setup()
    await owner.mutation(api.restaurants.create, { name: "Other Cafe", slug: "other-orders-cafe", idempotencyKey: "other" })
    const order = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "bound", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    expect(await t.query(api.orders.resolvePublicTracking, { restaurantSlug: "other-orders-cafe", trackingToken: order.trackingToken })).toBeNull()
})

test("public submission rejects expired subscriptions and closed restaurants", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    await t.run(async (ctx) => {
        const subscription = await ctx.db.query("subscriptions").withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurantId)).unique()
        await ctx.db.patch(subscription!._id, { status: "expired", trialEndAt: Date.now() - 1 })
    })
    const args = { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "expired", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] }
    await expect(t.mutation(api.orders.submitPublic, args)).rejects.toThrow("FORBIDDEN")
    await t.run(async (ctx) => {
        const subscription = await ctx.db.query("subscriptions").withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurantId)).unique()
        await ctx.db.patch(subscription!._id, { status: "active" })
    })
    await owner.mutation(api.restaurants.updateSettings, { restaurantId, patch: { acceptanceMode: "closed" } })
    await expect(t.mutation(api.orders.submitPublic, { ...args, idempotencyKey: "closed" })).rejects.toThrow("CONFLICT")
    await owner.mutation(api.restaurants.updateSettings, { restaurantId, patch: { acceptanceMode: "scheduled", businessHours: Array.from({ length: 7 }, (_, day) => ({ day, intervals: [] })) } })
    await expect(t.mutation(api.orders.submitPublic, { ...args, idempotencyKey: "scheduled" })).rejects.toThrow("CONFLICT")
})

test("public submission rejects cross-tenant menu items and options", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    const otherRestaurantId = await owner.mutation(api.restaurants.create, { name: "Other Cafe", slug: "other-orders-cafe", idempotencyKey: "other-restaurant" })
    const otherTable = await owner.action(api.tables.create, { restaurantId: otherRestaurantId, name: "B1" })
    const otherCategory = await owner.mutation(api.menu.createCategory, { restaurantId: otherRestaurantId, name: "Food" })
    const otherItem = await owner.mutation(api.menu.createItem, { restaurantId: otherRestaurantId, categoryId: otherCategory, name: "Rice", priceMinor: 900 })
    const otherGroup = await owner.mutation(api.menu.createOptionGroup, { itemId: otherItem, name: "Size", selectionMode: "single", required: true, minSelections: 1, maxSelections: 1 })
    const otherChoice = await owner.mutation(api.menu.createOptionChoice, { optionGroupId: otherGroup, name: "Large", priceDeltaMinor: 100 })
    await expect(t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "cross-item", items: [{ itemId: otherItem, quantity: 1, choiceIds: [] }] })).rejects.toThrow("CONFLICT")
    await expect(t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "cross-option", items: [{ itemId, quantity: 1, choiceIds: [otherChoice] }] })).rejects.toThrow("VALIDATION_FAILED")
    void otherTable
    void choiceId
    void restaurantId
})

test("public submissions are limited to 30 new orders per restaurant per UTC minute", async () => {
    const { t, table, itemId, choiceId } = await setup()
    const base = { restaurantSlug: "orders-cafe", tableToken: table.token, items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] }
    for (let i = 0; i < 30; i++) await t.mutation(api.orders.submitPublic, { ...base, idempotencyKey: `limited-${i}` })
    await expect(t.mutation(api.orders.submitPublic, { ...base, idempotencyKey: "limited-30" })).rejects.toThrow("CONFLICT")
    await expect(t.mutation(api.orders.submitPublic, { ...base, idempotencyKey: "limited-0" })).resolves.toMatchObject({ orderNumber: expect.any(String) })
})
