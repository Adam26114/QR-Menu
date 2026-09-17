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
    await staff.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing", idempotencyKey: "staff-preparing" })
    await expect(staff.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "pending", idempotencyKey: "staff-invalid" })).rejects.toThrow("CONFLICT")
    await staff.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "served", idempotencyKey: "staff-served" })
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
    await staff.mutation(api.orders.updateStatus, { orderId: first.orderId, status: "preparing", idempotencyKey: "same-key-status" })
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

test("staff operations expose safe paginated rows and payment audit data", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    const order = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "ops-order", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    const preparing = await owner.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing", idempotencyKey: "status-1" })
    expect(preparing).toMatchObject({ orderId: order.orderId, status: "preparing", tableName: "A1", paymentStatus: "unpaid" })
    const paid = await owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "paid", paymentMethod: "cash", idempotencyKey: "payment-1" })
    expect(paid).toMatchObject({ orderId: order.orderId, paymentStatus: "paid" })
    expect(paid.paidAt).toEqual(expect.any(Number))
    expect(await owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "paid", paymentMethod: "cash", idempotencyKey: "payment-1" })).toEqual(paid)
    const unpaid = await owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "unpaid", idempotencyKey: "payment-2" })
    expect(unpaid).toMatchObject({ orderId: order.orderId, paymentStatus: "unpaid" })
    expect(unpaid).not.toHaveProperty("paidAt")
    const storedUnpaid = await t.run(async (ctx) => ctx.db.get("orders", order.orderId))
    expect(storedUnpaid?.paidAt).toBeUndefined()
    expect(storedUnpaid?.paidByTokenIdentifier).toBeUndefined()
    const page = await owner.query(api.orders.list, { restaurantId, paginationOpts: { numItems: 10, cursor: null } })
    expect(page.page).toHaveLength(1)
    expect(JSON.stringify(page.page[0])).not.toContain("trackingToken")
    const events = await t.run(async (ctx) => ctx.db.query("orderPaymentEvents").withIndex("by_order_created_at", (q) => q.eq("orderId", order.orderId)).collect())
    expect(events[0]).toMatchObject({ toPaymentStatus: "paid", actorTokenIdentifier: "issuer|owner", timezone: "Asia/Yangon" })
})

test("payment reports use the order currency snapshot after restaurant currency changes", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    const order = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "currency-snapshot", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    await t.run(async (ctx) => ctx.db.patch(restaurantId, { currency: "USD" }))
    await owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "paid", paymentMethod: "cash", idempotencyKey: "currency-paid" })
    const stored = await t.run(async (ctx) => ctx.db.get("orders", order.orderId))
    expect(stored?.paymentCurrency).toBe("MMK")
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260101", toBusinessDate: "20261231" })).resolves.toEqual([{ name: "Noodles", currency: "MMK", timezone: "Asia/Yangon", quantity: 1, grossMinor: 1250 }])
})

test("payment contribution fails closed when duplicate summaries already exist", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    const order = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "duplicate-summary", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    const businessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "")
    await t.run(async (ctx) => {
        const fields = { restaurantId, businessDate, timezone: "Asia/Yangon", currency: "MMK", paidOrderCount: 0, subtotalMinor: 0, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 0, cashMinor: 0, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 0, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 }
        await ctx.db.insert("salesSummaryDaily", fields)
        await ctx.db.insert("salesSummaryDaily", fields)
    })
    await expect(owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "paid", paymentMethod: "cash", idempotencyKey: "duplicate-summary-paid" })).rejects.toThrow("CONFLICT")
})

test("status keys are required, normalized, bounded, and replay-safe", async () => {
    const { t, table, itemId, choiceId, owner } = await setup()
    const order = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "required-key-order", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    await expect(t.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing" } as never)).rejects.toThrow("Missing required field")
    await expect(owner.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing", idempotencyKey: "   " })).rejects.toThrow("VALIDATION_FAILED")
    await expect(owner.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing", idempotencyKey: "x".repeat(201) })).rejects.toThrow("VALIDATION_FAILED")
    const first = await owner.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing", idempotencyKey: " replay-key " })
    expect(await owner.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "preparing", idempotencyKey: "replay-key" })).toEqual(first)
    await expect(owner.mutation(api.orders.updateStatus, { orderId: order.orderId, status: "served", idempotencyKey: "replay-key" })).rejects.toThrow("CONFLICT")
})

test("list filters status before pagination and cancellation is owner-only", async () => {
    const { t, owner, restaurantId, table, itemId, choiceId } = await setup()
    const first = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "filter-first", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    const second = await t.mutation(api.orders.submitPublic, { restaurantSlug: "orders-cafe", tableToken: table.token, idempotencyKey: "filter-second", items: [{ itemId, quantity: 1, choiceIds: [choiceId] }] })
    await owner.mutation(api.orders.updateStatus, { orderId: first.orderId, status: "preparing", idempotencyKey: "filter-preparing" })
    const preparingPage = await owner.query(api.orders.list, { restaurantId, status: "preparing", paginationOpts: { numItems: 1, cursor: null } })
    expect(preparingPage.page).toHaveLength(1)
    expect(preparingPage.page[0]).toMatchObject({ orderId: first.orderId, status: "preparing" })
    expect(preparingPage.continueCursor).toBeDefined()

    const staff = t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff" })
    await t.run(async (ctx) => ctx.db.insert("restaurantMemberships", { restaurantId, tokenIdentifier: "issuer|staff", role: "staff", status: "active", canMarkPaid: false, createdAt: Date.now(), updatedAt: Date.now() }))
    await expect(staff.mutation(api.orders.updateStatus, { orderId: second.orderId, status: "cancelled", idempotencyKey: "staff-cancel" })).rejects.toThrow("FORBIDDEN")
    const cancelled = await owner.mutation(api.orders.updateStatus, { orderId: second.orderId, status: "cancelled", idempotencyKey: "owner-cancel" })
    expect(cancelled.status).toBe("cancelled")
    await expect(owner.mutation(api.orders.updatePayment, { orderId: first.orderId, paymentStatus: "paid", paymentMethod: "cash", idempotencyKey: "filter-paid" })).resolves.toMatchObject({ paymentStatus: "paid" })
    await expect(owner.mutation(api.orders.updateStatus, { orderId: first.orderId, status: "cancelled", idempotencyKey: "paid-cancel" })).rejects.toThrow("CONFLICT")
})
