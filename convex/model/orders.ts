import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { expectedError, ERROR_CODES } from "../lib/errors"
import { evaluateBusinessHours } from "./restaurants"
import { isSubscriptionEligible } from "./subscriptions"
import { encryptOpaqueToken, decryptOpaqueToken, hashOpaqueToken, createToken } from "./tables"

export type SubmittedLine = {
    itemId: Id<"menuItems">
    quantity: number
    choiceIds: Id<"menuOptionChoices">[]
    notes?: string
}
export type PaymentMethod = "cash" | "card" | "digital" | "other"
export type PaymentContribution = {
    restaurantId: Id<"restaurants">
    summaryId: Id<"salesSummaryDaily">
    businessDate: string
    timezone: string
    currency: string
    subtotalMinor: number
    taxMinor: number
    serviceChargeMinor: number
    totalMinor: number
    paymentMethod: PaymentMethod
    items: { name: string; quantity: number; grossMinor: number }[]
}
export function canonicalize(slug: string, token: string, key: string, items: SubmittedLine[]) {
    const restaurantSlug = slug.trim().toLowerCase()
    const tableToken = token.trim()
    const idempotencyKey = key.trim()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurantSlug) || restaurantSlug.length > 80)
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Restaurant slug is invalid")
    if (!tableToken || tableToken.length > 256 || !idempotencyKey || idempotencyKey.length > 200)
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Token or idempotency key is invalid")
    if (items.length < 1 || items.length > 50) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Order line limit exceeded")
    const canonicalItems = items.map((line) => {
        if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99)
            throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Quantity is invalid")
        if (line.choiceIds.length > 20 || new Set(line.choiceIds).size !== line.choiceIds.length)
            throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Choices are invalid")
        const notes = line.notes?.trim()
        if (notes && notes.length > 500) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Notes are too long")
        return { itemId: line.itemId, quantity: line.quantity, choiceIds: [...line.choiceIds].sort(), ...(notes ? { notes } : {}) }
    })
    canonicalItems.sort((left, right) => {
        const leftChoices = left.choiceIds.join(",")
        const rightChoices = right.choiceIds.join(",")
        const leftKey = `${left.itemId}\u0000${leftChoices}\u0000${left.notes ?? ""}`
        const rightKey = `${right.itemId}\u0000${rightChoices}\u0000${right.notes ?? ""}`
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
    })
    return { restaurantSlug, tableToken, idempotencyKey, items: canonicalItems, payload: JSON.stringify({ restaurantSlug, items: canonicalItems }) }
}
async function payloadHash(value: string) {
    return hashOpaqueToken(value)
}
function dateKey(now: number, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
    return `${get("year")}${get("month")}${get("day")}`
}

const methodFields = (method: PaymentMethod) => ({
    [`${method}Minor`]: 1,
    [`${method}OrderCount`]: 1,
})

export async function addPaymentContribution(ctx: MutationCtx, restaurantId: Id<"restaurants">, businessDate: string, timezone: string, currency: string, order: Doc<"orders">, paymentMethod: PaymentMethod): Promise<PaymentContribution> {
    const restaurant = await ctx.db.get("restaurants", restaurantId)
    if (!restaurant) throw expectedError(ERROR_CODES.CONFLICT, "Restaurant is missing")
    await ctx.db.patch(restaurantId, { salesSummaryRevision: (restaurant.salesSummaryRevision ?? 0) + 1 })
    const summaries = await ctx.db.query("salesSummaryDaily").withIndex("by_restaurant_business_date_currency_timezone", (q) => q.eq("restaurantId", restaurantId).eq("businessDate", businessDate).eq("currency", currency).eq("timezone", timezone)).take(2)
    if (summaries.length > 1) throw expectedError(ERROR_CODES.CONFLICT, "Duplicate sales summary records")
    let summary: Doc<"salesSummaryDaily">
    if (summaries[0]) {
        summary = summaries[0]
    } else {
        const summaryId = await ctx.db.insert("salesSummaryDaily", {
            restaurantId, businessDate, timezone, currency, paidOrderCount: 0, subtotalMinor: 0, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 0,
            cashMinor: 0, cardMinor: 0, digitalMinor: 0, otherMinor: 0, cashOrderCount: 0, cardOrderCount: 0, digitalOrderCount: 0, otherOrderCount: 0,
        })
        const insertedSummary = await ctx.db.get("salesSummaryDaily", summaryId)
        if (!insertedSummary) throw expectedError(ERROR_CODES.CONFLICT, "Sales summary record is missing")
        summary = insertedSummary
    }
    const itemsByName = new Map<string, { name: string; quantity: number; grossMinor: number }>()
    for (const item of order.items) {
        const current = itemsByName.get(item.itemName)
        if (current) {
            current.quantity += item.quantity
            current.grossMinor += item.lineTotalMinor
        } else {
            itemsByName.set(item.itemName, { name: item.itemName, quantity: item.quantity, grossMinor: item.lineTotalMinor })
        }
    }
    const items = [...itemsByName.values()]
    const existingItems = await ctx.db.query("salesSummaryItems").withIndex("by_summary_id", (q) => q.eq("summaryId", summary._id)).take(1001)
    if (existingItems.length > 1000) throw expectedError(ERROR_CODES.CONFLICT, "Summary item limit exceeded")
    const existingNames = new Set(existingItems.map((item) => item.name))
    const newDistinctNames = items.filter((item) => !existingNames.has(item.name)).length
    if (existingItems.length + newDistinctNames > 1000) throw expectedError(ERROR_CODES.CONFLICT, "Summary item limit exceeded")
    const contribution: PaymentContribution = { restaurantId, summaryId: summary._id, businessDate, timezone, currency, subtotalMinor: order.subtotalMinor, taxMinor: order.taxMinor, serviceChargeMinor: order.serviceChargeMinor, totalMinor: order.totalMinor, paymentMethod, items }
    const field = methodFields(paymentMethod)
    const summaryPatch: Record<string, number> = {
        paidOrderCount: summary.paidOrderCount + 1,
        subtotalMinor: summary.subtotalMinor + order.subtotalMinor,
        taxMinor: summary.taxMinor + order.taxMinor,
        serviceChargeMinor: summary.serviceChargeMinor + order.serviceChargeMinor,
        totalMinor: summary.totalMinor + order.totalMinor,
    }
    summaryPatch[Object.keys(field)[0]!] = (summary as any)[Object.keys(field)[0]!] + order.totalMinor
    summaryPatch[Object.keys(field)[1]!] = (summary as any)[Object.keys(field)[1]!] + 1
    await ctx.db.patch(summary._id, summaryPatch as any)
    for (const item of items) {
        const current = existingItems.find((row) => row.name === item.name)
        if (current) await ctx.db.patch(current._id, { quantity: current.quantity + item.quantity, grossMinor: current.grossMinor + item.grossMinor })
        else await ctx.db.insert("salesSummaryItems", { summaryId: summary._id, restaurantId, businessDate, currency, ...item })
    }
    return contribution
}

export async function reversePaymentContribution(ctx: MutationCtx, contribution: PaymentContribution) {
    const restaurant = await ctx.db.get("restaurants", contribution.restaurantId)
    if (!restaurant) throw expectedError(ERROR_CODES.CONFLICT, "Restaurant is missing")
    const summary = await ctx.db.get("salesSummaryDaily", contribution.summaryId)
    if (!summary) throw expectedError(ERROR_CODES.CONFLICT, "Payment contribution summary is missing")
    if (summary.restaurantId !== contribution.restaurantId || summary.businessDate !== contribution.businessDate || summary.currency !== contribution.currency || summary.timezone !== contribution.timezone)
        throw expectedError(ERROR_CODES.CONFLICT, "Payment contribution summary does not match")
    const method = contribution.paymentMethod
    const methodMinor = `${method}Minor` as keyof typeof summary
    const methodCount = `${method}OrderCount` as keyof typeof summary
    const nextValues = {
        paidOrderCount: summary.paidOrderCount - 1,
        subtotalMinor: summary.subtotalMinor - contribution.subtotalMinor,
        taxMinor: summary.taxMinor - contribution.taxMinor,
        serviceChargeMinor: summary.serviceChargeMinor - contribution.serviceChargeMinor,
        totalMinor: summary.totalMinor - contribution.totalMinor,
        methodMinor: (summary[methodMinor] as number) - contribution.totalMinor,
        methodCount: (summary[methodCount] as number) - 1,
    }
    if (Object.values(nextValues).some((value) => value < 0)) throw expectedError(ERROR_CODES.CONFLICT, "Payment contribution summary is stale")
    const rows = await ctx.db.query("salesSummaryItems").withIndex("by_summary_id", (q) => q.eq("summaryId", contribution.summaryId)).take(1001)
    if (rows.length > 1000) throw expectedError(ERROR_CODES.CONFLICT, "Summary item limit exceeded")
    const requiredItems = new Map<string, { quantity: number; grossMinor: number }>()
    for (const item of contribution.items) {
        const required = requiredItems.get(item.name) ?? { quantity: 0, grossMinor: 0 }
        required.quantity += item.quantity; required.grossMinor += item.grossMinor; requiredItems.set(item.name, required)
    }
    for (const [name, required] of requiredItems) {
        const row = rows.find((candidate) => candidate.name === name)
        if (!row || row.quantity < required.quantity || row.grossMinor < required.grossMinor) throw expectedError(ERROR_CODES.CONFLICT, "Payment contribution item is stale")
    }
    await ctx.db.patch(contribution.restaurantId, { salesSummaryRevision: (restaurant.salesSummaryRevision ?? 0) + 1 })
    await ctx.db.patch(summary._id, {
        paidOrderCount: nextValues.paidOrderCount,
        subtotalMinor: nextValues.subtotalMinor,
        taxMinor: nextValues.taxMinor,
        serviceChargeMinor: nextValues.serviceChargeMinor,
        totalMinor: nextValues.totalMinor,
        [methodMinor]: nextValues.methodMinor,
        [methodCount]: nextValues.methodCount,
    } as any)
    for (const [name, required] of requiredItems) {
        const row = rows.find((candidate) => candidate.name === name)!
        await ctx.db.patch(row._id, { quantity: row.quantity - required.quantity, grossMinor: row.grossMinor - required.grossMinor })
    }
}
async function one<T>(ctx: QueryCtx | MutationCtx, table: T, id: Id<any>): Promise<any> {
    const row = await ctx.db.get(table as never, id as never)
    if (!row) throw expectedError(ERROR_CODES.NOT_FOUND, "Record not found")
    return row
}
export async function submit(ctx: MutationCtx, args: { restaurantSlug: string; tableToken: string; idempotencyKey: string; items: SubmittedLine[] }) {
    const input = canonicalize(args.restaurantSlug, args.tableToken, args.idempotencyKey, args.items)
    const restaurant = await ctx.db.query("restaurants").withIndex("by_slug", (q) => q.eq("slug", input.restaurantSlug)).unique()
    if (!restaurant || restaurant.archived) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    const tableHash = await hashOpaqueToken(input.tableToken)
    const table = await ctx.db.query("restaurantTables").withIndex("by_token_hash", (q) => q.eq("tokenHash", tableHash)).unique()
    if (!table || table.restaurantId !== restaurant._id || table.archived || !table.active) throw expectedError(ERROR_CODES.NOT_FOUND, "Table not found")
    const existing = await ctx.db.query("orders").withIndex("by_restaurant_table_idempotency", (q) => q.eq("restaurantId", restaurant._id).eq("tableId", table._id).eq("idempotencyKey", input.idempotencyKey)).take(2)
    const hash = await payloadHash(input.payload)
    if (existing.length > 1) throw expectedError(ERROR_CODES.CONFLICT, "Duplicate idempotency records")
    if (existing[0]) {
        if (existing[0].canonicalPayloadHash !== hash) throw expectedError(ERROR_CODES.CONFLICT, "Idempotency key was reused")
        let trackingToken: string
        try {
            trackingToken = await decryptOpaqueToken({ tokenCiphertext: existing[0].trackingTokenCiphertext, tokenIv: existing[0].trackingTokenIv, tokenKeyVersion: existing[0].trackingTokenKeyVersion })
        } catch {
            throw expectedError(ERROR_CODES.CONFLICT, "Unable to recover idempotent tracking token")
        }
        return response(existing[0], trackingToken)
    }
    const now = Date.now()
    const subscription = await ctx.db.query("subscriptions").withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurant._id)).take(2)
    if (subscription.length !== 1 || !isSubscriptionEligible(subscription[0]!, now)) throw expectedError(ERROR_CODES.FORBIDDEN, "Restaurant subscription is not eligible")
    const mode = restaurant.acceptanceMode ?? "open"
    if (mode === "closed" || (mode === "scheduled" && !evaluateBusinessHours(now, restaurant.timezone ?? "Asia/Yangon", restaurant.businessHours ?? [])))
        throw expectedError(ERROR_CODES.CONFLICT, "Restaurant is not accepting orders")
    const items: Doc<"orders">["items"] = []
    let subtotal = 0
    for (const line of input.items) {
        const item = await one(ctx, "menuItems", line.itemId) as Doc<"menuItems">
        const category = await one(ctx, "menuCategories", item.categoryId) as Doc<"menuCategories">
        if (item.restaurantId !== restaurant._id || category.restaurantId !== restaurant._id || category.archived || item.archived || !item.available)
            throw expectedError(ERROR_CODES.CONFLICT, "Menu item is unavailable")
        const groups = await ctx.db.query("menuOptionGroups").withIndex("by_menu_item_id_and_sort_order", (q) => q.eq("menuItemId", item._id)).take(51)
        if (groups.length > 50) throw expectedError(ERROR_CODES.CONFLICT, "Too many option groups")
        const selected = new Map<string, Doc<"menuOptionChoices">[]>()
        for (const choiceId of line.choiceIds) {
            const choice = await one(ctx, "menuOptionChoices", choiceId) as Doc<"menuOptionChoices">
            const group = groups.find((g) => g._id === choice.optionGroupId)
            if (!group || choice.restaurantId !== restaurant._id || choice.archived || group.archived)
                throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Invalid option choice")
            selected.set(group._id, [...(selected.get(group._id) ?? []), choice])
        }
        const options: { name: string; priceDeltaMinor: number }[] = []
        let unit = item.priceMinor
        for (const group of groups.filter((g) => !g.archived)) {
            const choices = selected.get(group._id) ?? []
            if (choices.length < group.minSelections || choices.length > group.maxSelections || (group.required && choices.length === 0) || (group.selectionMode === "single" && choices.length > 1))
                throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Option selection is invalid")
            for (const choice of choices) { unit += choice.priceDeltaMinor; options.push({ name: choice.name, priceDeltaMinor: choice.priceDeltaMinor }) }
        }
        if (!Number.isSafeInteger(unit) || unit < 0 || !Number.isSafeInteger(unit * line.quantity)) throw expectedError(ERROR_CODES.CONFLICT, "Order total is unsafe")
        const lineTotal = unit * line.quantity
        subtotal += lineTotal
        if (!Number.isSafeInteger(subtotal)) throw expectedError(ERROR_CODES.CONFLICT, "Order total is unsafe")
        items.push({ itemName: item.name, basePriceMinor: item.priceMinor, unitPriceMinor: unit, quantity: line.quantity, ...(line.notes ? { notes: line.notes } : {}), options, lineTotalMinor: lineTotal })
    }
    const tax = Math.floor(subtotal * (restaurant.taxBps ?? 0) / 10000)
    const service = Math.floor(subtotal * (restaurant.serviceChargeBps ?? 0) / 10000)
    const total = subtotal + tax + service
    if (!Number.isSafeInteger(total)) throw expectedError(ERROR_CODES.CONFLICT, "Order total is unsafe")
    const windowStartMinute = Math.floor(now / 60_000)
    const rateCount = restaurant.publicOrderRateWindowStartMinute === windowStartMinute ? (restaurant.publicOrderRateCount ?? 0) : 0
    if (rateCount >= 30) throw expectedError(ERROR_CODES.CONFLICT, "Order submission rate limit exceeded")
    await ctx.db.patch(restaurant._id, { publicOrderRateWindowStartMinute: windowStartMinute, publicOrderRateCount: rateCount + 1 })
    const key = dateKey(now, restaurant.timezone ?? "Asia/Yangon")
    const counter = await ctx.db.query("orderCounters").withIndex("by_restaurant_date", (q) => q.eq("restaurantId", restaurant._id).eq("dateKey", key)).unique()
    const sequence = counter?.nextSequence ?? 1
    if (counter) await ctx.db.patch(counter._id, { nextSequence: sequence + 1 })
    else await ctx.db.insert("orderCounters", { restaurantId: restaurant._id, dateKey: key, nextSequence: 2 })
    const trackingToken = await createToken()
    const encrypted = await encryptOpaqueToken(trackingToken)
    const orderId = await ctx.db.insert("orders", { restaurantId: restaurant._id, tableId: table._id, dateKey: key, sequence, orderNumber: `${key}-${String(sequence).padStart(4, "0")}`, idempotencyKey: input.idempotencyKey, canonicalPayloadHash: hash, trackingTokenHash: await hashOpaqueToken(trackingToken), trackingTokenCiphertext: encrypted.tokenCiphertext, trackingTokenIv: encrypted.tokenIv, trackingTokenKeyVersion: encrypted.tokenKeyVersion, status: "pending", paymentStatus: "unpaid", currency: restaurant.currency ?? "MMK", submittedAt: now, subtotalMinor: subtotal, taxMinor: tax, serviceChargeMinor: service, totalMinor: total, items })
    await ctx.db.insert("orderStatusEvents", { orderId, restaurantId: restaurant._id, toStatus: "pending", createdAt: now, timezone: restaurant.timezone ?? "Asia/Yangon", businessDate: key })
    return response((await ctx.db.get("orders", orderId))!, trackingToken)
}
function response(order: Doc<"orders">, trackingToken: string) { return { orderId: order._id, orderNumber: order.orderNumber, trackingToken, status: "pending" as const, paymentStatus: "unpaid" as const, totalMinor: order.totalMinor, currency: order.currency } }
export { dateKey }
