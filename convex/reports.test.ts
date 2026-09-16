/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { reversePaymentContribution } from "./model/orders"

const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
runtime.process ??= {}
runtime.process.env ??= {}
runtime.process.env.QR_TOKEN_ENCRYPTION_KEY = "test-only-key"
const modules = import.meta.glob("./**/*.ts")

test("owner reports aggregate bounded daily summaries and items", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-cafe", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now(), currency: "MMK", timezone: "Asia/Yangon" })
        await ctx.db.insert("restaurantMemberships", { restaurantId: id, tokenIdentifier: "issuer|owner", role: "owner", status: "active", canMarkPaid: true, createdAt: Date.now(), updatedAt: Date.now() })
        const summaryId = await ctx.db.insert("salesSummaryDaily", { restaurantId: id, businessDate: "20260916", timezone: "Asia/Yangon", currency: "MMK", paidOrderCount: 2, subtotalMinor: 3000, taxMinor: 300, serviceChargeMinor: 0, totalMinor: 3300, cashMinor: 1000, cardMinor: 2300, digitalMinor: 0, otherMinor: 0, cashOrderCount: 1, cardOrderCount: 1, digitalOrderCount: 0, otherOrderCount: 0 })
        await ctx.db.insert("salesSummaryItems", { summaryId, restaurantId: id, businessDate: "20260916", currency: "MMK", name: "Noodles", quantity: 3, grossMinor: 3000 })
        return id
    })
    await expect(owner.query(api.reports.getSummary, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })).resolves.toMatchObject({ groups: [{ currency: "MMK", orderCount: 2, totalMinor: 3300, paymentBreakdown: { cashMinor: 1000, cardMinor: 2300 } }] })
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })).resolves.toEqual([{ name: "Noodles", currency: "MMK", timezone: "Asia/Yangon", quantity: 3, grossMinor: 3000 }])
})

test("repeated same-name order lines produce one reversible best-selling item", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await owner.mutation(api.restaurants.create, { name: "Cafe", slug: "report-repeated", idempotencyKey: "restaurant" })
    const table = await owner.action(api.tables.create, { restaurantId, name: "A1" })
    const categoryId = await owner.mutation(api.menu.createCategory, { restaurantId, name: "Food" })
    const itemId = await owner.mutation(api.menu.createItem, { restaurantId, categoryId, name: "Noodles", priceMinor: 1000 })
    const order = await t.mutation(api.orders.submitPublic, {
        restaurantSlug: "report-repeated",
        tableToken: table.token,
        idempotencyKey: "repeated-lines",
        items: [{ itemId, quantity: 2, choiceIds: [] }, { itemId, quantity: 3, choiceIds: [] }],
    })
    await owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "paid", paymentMethod: "cash", idempotencyKey: "paid" })
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260101", toBusinessDate: "20261231" })).resolves.toEqual([{ name: "Noodles", currency: "MMK", timezone: "Asia/Yangon", quantity: 5, grossMinor: 5000 }])
    await owner.mutation(api.orders.updatePayment, { orderId: order.orderId, paymentStatus: "unpaid", idempotencyKey: "unpaid" })
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260101", toBusinessDate: "20261231" })).resolves.toEqual([])
})

test("best-selling limit is applied independently per currency and timezone group", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-groups", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now() })
        await ctx.db.insert("restaurantMemberships", { restaurantId: id, tokenIdentifier: "issuer|owner", role: "owner", status: "active", canMarkPaid: true, createdAt: Date.now(), updatedAt: Date.now() })
        for (const [currency, timezone] of [["MMK", "Asia/Yangon"], ["USD", "America/New_York"]]) {
            const summaryId = await ctx.db.insert("salesSummaryDaily", { restaurantId: id, businessDate: "20260916", timezone, currency, paidOrderCount: 1, subtotalMinor: 6, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 6, cashMinor: 6, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 1, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 })
            for (const { name, quantity } of [{ name: "Alpha", quantity: 3 }, { name: "Beta", quantity: 2 }, { name: "Gamma", quantity: 1 }]) await ctx.db.insert("salesSummaryItems", { summaryId, restaurantId: id, businessDate: "20260916", currency, name, quantity, grossMinor: quantity })
        }
        return id
    })
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916", limit: 2 })).resolves.toEqual([
        { name: "Alpha", currency: "MMK", timezone: "Asia/Yangon", quantity: 3, grossMinor: 3 },
        { name: "Beta", currency: "MMK", timezone: "Asia/Yangon", quantity: 2, grossMinor: 2 },
        { name: "Alpha", currency: "USD", timezone: "America/New_York", quantity: 3, grossMinor: 3 },
        { name: "Beta", currency: "USD", timezone: "America/New_York", quantity: 2, grossMinor: 2 },
    ])
})

test("report APIs exclude zero-order summaries and zero-valued items", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-zeroes", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now() })
        await ctx.db.insert("restaurantMemberships", { restaurantId: id, tokenIdentifier: "issuer|owner", role: "owner", status: "active", canMarkPaid: true, createdAt: Date.now(), updatedAt: Date.now() })
        const empty = await ctx.db.insert("salesSummaryDaily", { restaurantId: id, businessDate: "20260916", timezone: "Asia/Yangon", currency: "MMK", paidOrderCount: 0, subtotalMinor: 0, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 0, cashMinor: 0, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 0, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 })
        await ctx.db.insert("salesSummaryItems", { summaryId: empty, restaurantId: id, businessDate: "20260916", currency: "MMK", name: "Reversed", quantity: 0, grossMinor: 0 })
        const paid = await ctx.db.insert("salesSummaryDaily", { restaurantId: id, businessDate: "20260916", timezone: "Asia/Yangon", currency: "MMK", paidOrderCount: 1, subtotalMinor: 1, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 1, cashMinor: 1, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 1, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 })
        await ctx.db.insert("salesSummaryItems", { summaryId: paid, restaurantId: id, businessDate: "20260916", currency: "MMK", name: "Reversed", quantity: 0, grossMinor: 0 })
        await ctx.db.insert("salesSummaryItems", { summaryId: paid, restaurantId: id, businessDate: "20260916", currency: "MMK", name: "Visible", quantity: 1, grossMinor: 1 })
        return id
    })
    await expect(owner.query(api.reports.getSummary, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })).resolves.toMatchObject({ groups: [{ orderCount: 1 }] })
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })).resolves.toEqual([{ name: "Visible", currency: "MMK", timezone: "Asia/Yangon", quantity: 1, grossMinor: 1 }])
})

test("reverse payment contribution rejects mismatched and stale summaries", async () => {
    const t = convexTest(schema, modules)
    await expect(t.run(async (ctx) => {
        const restaurantId = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-reversal", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now() })
        const summaryId = await ctx.db.insert("salesSummaryDaily", { restaurantId, businessDate: "20260916", timezone: "Asia/Yangon", currency: "MMK", paidOrderCount: 0, subtotalMinor: 0, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 0, cashMinor: 0, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 0, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 })
        return reversePaymentContribution(ctx, { restaurantId, summaryId, businessDate: "20260915", timezone: "Asia/Yangon", currency: "MMK", subtotalMinor: 1, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 1, paymentMethod: "cash", items: [] })
    })).rejects.toThrow("CONFLICT")
})

test("summary reads include mixed snapshots across the full bounded date range", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-snapshots", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now() })
        await ctx.db.insert("restaurantMemberships", { restaurantId: id, tokenIdentifier: "issuer|owner", role: "owner", status: "active", canMarkPaid: true, createdAt: Date.now(), updatedAt: Date.now() })
        for (let index = 0; index < 368; index++) {
            await ctx.db.insert("salesSummaryDaily", { restaurantId: id, businessDate: "20260916", timezone: `Etc/GMT${index}`, currency: `C${index}`, paidOrderCount: 1, subtotalMinor: 1, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 1, cashMinor: 1, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 1, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 })
        }
        return id
    })
    const result = await owner.query(api.reports.getSummary, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })
    expect(result.groups).toHaveLength(368)
})

test("summary reads reject more than 2000 historical snapshots", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-too-many", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now() })
        await ctx.db.insert("restaurantMemberships", { restaurantId: id, tokenIdentifier: "issuer|owner", role: "owner", status: "active", canMarkPaid: true, createdAt: Date.now(), updatedAt: Date.now() })
        for (let index = 0; index < 2001; index++) {
            await ctx.db.insert("salesSummaryDaily", { restaurantId: id, businessDate: "20260916", timezone: `Etc/GMT${index}`, currency: `C${index}`, paidOrderCount: 0, subtotalMinor: 0, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 0, cashMinor: 0, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 0, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0 })
        }
        return id
    })
    await expect(owner.query(api.reports.getSummary, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })).rejects.toThrow("CONFLICT")
    await expect(owner.query(api.reports.getBestSellingItems, { restaurantId, fromBusinessDate: "20260916", toBusinessDate: "20260916" })).rejects.toThrow("CONFLICT")
})

test("reports reject invalid and over-bounded date ranges", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
    const restaurantId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("restaurants", { name: "Cafe", slug: "report-bounds", archived: false, createdByTokenIdentifier: "issuer|owner", createdAt: Date.now(), updatedAt: Date.now() })
        await ctx.db.insert("restaurantMemberships", { restaurantId: id, tokenIdentifier: "issuer|owner", role: "owner", status: "active", canMarkPaid: true, createdAt: Date.now(), updatedAt: Date.now() })
        return id
    })
    await expect(owner.query(api.reports.getSummary, { restaurantId, fromBusinessDate: "20260230", toBusinessDate: "20260301" })).rejects.toThrow("VALIDATION_FAILED")
    await expect(owner.query(api.reports.getSummary, { restaurantId, fromBusinessDate: "20260101", toBusinessDate: "20270102" })).rejects.toThrow("VALIDATION_FAILED")
})
