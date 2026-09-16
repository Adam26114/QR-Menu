import { v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { mutation, query } from "./_generated/server"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import { expectedError, ERROR_CODES } from "./lib/errors"
import { requireActiveMembership, requireIdentity } from "./model/identity"
import { submit } from "./model/orders"
import { hashOpaqueToken } from "./model/tables"
import { dateKey } from "./model/orders"

const line = v.object({ itemId: v.id("menuItems"), quantity: v.number(), choiceIds: v.array(v.id("menuOptionChoices")), notes: v.optional(v.string()) })
const paymentStatuses = v.union(v.literal("paid"), v.literal("unpaid"))
const statusValues = v.union(v.literal("pending"), v.literal("preparing"), v.literal("served"), v.literal("cancelled"))
const itemSnapshot = v.object({ name: v.string(), quantity: v.number(), unitPriceMinor: v.number(), options: v.array(v.object({ name: v.string(), priceDeltaMinor: v.number() })), lineTotalMinor: v.number(), notes: v.optional(v.string()) })
const safeOrder = v.object({ orderId: v.id("orders"), orderNumber: v.string(), tableName: v.union(v.string(), v.null()), status: statusValues, paymentStatus: paymentStatuses, submittedAt: v.number(), currency: v.string(), subtotalMinor: v.number(), taxMinor: v.number(), serviceChargeMinor: v.number(), totalMinor: v.number(), items: v.array(itemSnapshot), paidAt: v.optional(v.number()) })
const submitResult = v.object({ orderId: v.id("orders"), orderNumber: v.string(), trackingToken: v.string(), status: v.literal("pending"), paymentStatus: paymentStatuses, totalMinor: v.number(), currency: v.string() })
export const submitPublic = mutation({
    args: { restaurantSlug: v.string(), tableToken: v.string(), idempotencyKey: v.string(), items: v.array(line) },
    returns: submitResult,
    handler: (ctx, args) => submit(ctx, args),
})

const tracking = v.object({
    restaurantName: v.string(), tableName: v.string(), orderNumber: v.string(),
    status: v.union(v.literal("pending"), v.literal("preparing"), v.literal("served"), v.literal("cancelled")),
    paymentStatus: paymentStatuses, paidAt: v.optional(v.number()), submittedAt: v.number(), currency: v.string(),
    subtotalMinor: v.number(), taxMinor: v.number(), serviceChargeMinor: v.number(), totalMinor: v.number(),
    items: v.array(v.object({ name: v.string(), quantity: v.number(), unitPriceMinor: v.number(), options: v.array(v.object({ name: v.string(), priceDeltaMinor: v.number() })), lineTotalMinor: v.number(), notes: v.optional(v.string()) })),
})
export const resolvePublicTracking = query({
    args: { restaurantSlug: v.string(), trackingToken: v.string() },
    returns: v.union(tracking, v.null()),
    handler: async (ctx, args) => {
        const restaurantSlug = args.restaurantSlug.trim().toLowerCase()
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(restaurantSlug) || restaurantSlug.length > 80) return null
        const token = args.trackingToken.trim()
        if (!token || token.length > 256) return null
        const tokenHash = await hashOpaqueToken(token)
        const order = await ctx.db.query("orders").withIndex("by_tracking_token_hash", (q) => q.eq("trackingTokenHash", tokenHash)).unique()
        if (!order || order.submittedAt < Date.now() - 7 * 24 * 60 * 60 * 1000) return null
        const restaurant = await ctx.db.get("restaurants", order.restaurantId)
        const table = await ctx.db.get("restaurantTables", order.tableId)
        if (!restaurant || restaurant.slug !== restaurantSlug || !table) return null
        return { restaurantName: restaurant.name, tableName: table.name, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, ...(order.paidAt ? { paidAt: order.paidAt } : {}), submittedAt: order.submittedAt, currency: order.currency, subtotalMinor: order.subtotalMinor, taxMinor: order.taxMinor, serviceChargeMinor: order.serviceChargeMinor, totalMinor: order.totalMinor, items: order.items.map((item) => ({ name: item.itemName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, options: item.options, lineTotalMinor: item.lineTotalMinor, ...(item.notes ? { notes: item.notes } : {}) })) }
    },
})

export const updateStatus = protectedMutation({
    args: { orderId: v.id("orders"), status: statusValues, idempotencyKey: v.string() },
    returns: safeOrder,
    handler: async (ctx, args) => updateOrderStatus(ctx, args.orderId, args.status, args.idempotencyKey),
})

export const updatePayment = protectedMutation({
    args: { orderId: v.id("orders"), paymentStatus: paymentStatuses, idempotencyKey: v.string() },
    returns: safeOrder,
    handler: async (ctx, args) => updateOrderPayment(ctx, args.orderId, args.paymentStatus, args.idempotencyKey),
})

export const list = protectedQuery({
    args: { restaurantId: v.id("restaurants"), paginationOpts: paginationOptsValidator, status: v.optional(statusValues) },
    returns: paginationResultValidator(safeOrder),
    handler: async (ctx, args) => {
        await requireActiveMembership(ctx, args.restaurantId, "member")
        const status = args.status
        const query = args.status
            ? ctx.db.query("orders").withIndex("by_restaurant_status_date_sequence", (q) => q.eq("restaurantId", args.restaurantId).eq("status", status!))
            : ctx.db.query("orders").withIndex("by_restaurant_date_sequence", (q) => q.eq("restaurantId", args.restaurantId))
        const page = await query.order("desc").paginate(args.paginationOpts)
        return { ...page, page: await Promise.all(page.page.map((order) => safeRow(ctx, order))) }
    },
})

async function safeRow(ctx: any, order: any) {
    const table = await ctx.db.get("restaurantTables", order.tableId)
    return { orderId: order._id, orderNumber: order.orderNumber, tableName: table?.name ?? null, status: order.status, paymentStatus: order.paymentStatus, submittedAt: order.submittedAt, currency: order.currency, subtotalMinor: order.subtotalMinor, taxMinor: order.taxMinor, serviceChargeMinor: order.serviceChargeMinor, totalMinor: order.totalMinor, items: order.items.map((item: any) => ({ name: item.itemName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, options: item.options, lineTotalMinor: item.lineTotalMinor, ...(item.notes ? { notes: item.notes } : {}) })), ...(order.paidAt ? { paidAt: order.paidAt } : {}) }
}

async function operation(ctx: any, order: any, keyArg: string, kind: "status" | "payment", payload: string) {
    const key = keyArg.trim()
    if (!key || key.length > 200) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Idempotency key is invalid")
    const records = await ctx.db.query("orderOperationKeys").withIndex("by_order_and_key", (q: any) => q.eq("orderId", order._id).eq("idempotencyKey", key)).take(2)
    if (records.length > 1) throw expectedError(ERROR_CODES.CONFLICT, "Duplicate idempotency records")
    const hash = await hashOpaqueToken(payload)
    if (records[0]) {
        if (records[0].operationKind !== kind || records[0].canonicalPayloadHash !== hash) throw expectedError(ERROR_CODES.CONFLICT, "Idempotency key was reused")
        return true
    }
    return { key, hash }
}

async function updateOrderStatus(ctx: any, orderId: any, status: any, keyArg: string) {
    const order = await ctx.db.get("orders", orderId)
    if (!order) throw expectedError(ERROR_CODES.NOT_FOUND, "Order not found")
    const identity = await requireIdentity(ctx)
    const restaurant = await ctx.db.get("restaurants", order.restaurantId)
    if (!restaurant) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    if (status === "cancelled") await requireActiveMembership(ctx, order.restaurantId, "owner")
    else await requireActiveMembership(ctx, order.restaurantId, "member")
    const replay = await operation(ctx, order, keyArg, "status", JSON.stringify({ status }))
    if (replay === true) return safeRow(ctx, order)
    if (status === order.status || (order.status !== "pending" && order.status !== "preparing") || (order.status === "pending" && status !== "preparing" && status !== "cancelled") || (order.status === "preparing" && status !== "served" && status !== "cancelled"))
        throw expectedError(ERROR_CODES.CONFLICT, "Invalid order status transition")
    if (status === "cancelled" && order.paymentStatus === "paid") throw expectedError(ERROR_CODES.CONFLICT, "Paid order cannot be cancelled")
    const now = Date.now()
    const timezone = restaurant.timezone ?? "Asia/Yangon"
    await ctx.db.patch(orderId, { status })
    await ctx.db.insert("orderOperationKeys", { orderId, restaurantId: order.restaurantId, idempotencyKey: (replay as { key: string }).key, operationKind: "status", canonicalPayloadHash: (replay as { hash: string }).hash, createdAt: now })
    await ctx.db.insert("orderStatusEvents", { orderId, restaurantId: order.restaurantId, fromStatus: order.status, toStatus: status, actorTokenIdentifier: identity.tokenIdentifier, createdAt: now, timezone, businessDate: dateKey(now, timezone) })
    return safeRow(ctx, { ...order, status })
}

async function updateOrderPayment(ctx: any, orderId: any, paymentStatus: "paid" | "unpaid", key: string) {
    const order = await ctx.db.get("orders", orderId)
    if (!order) throw expectedError(ERROR_CODES.NOT_FOUND, "Order not found")
    const identity = await requireIdentity(ctx)
    const restaurant = await ctx.db.get("restaurants", order.restaurantId)
    if (!restaurant) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    await requireActiveMembership(ctx, order.restaurantId, paymentStatus === "paid" ? "canMarkPaid" : "owner")
    const replay = await operation(ctx, order, key, "payment", JSON.stringify({ paymentStatus }))
    if (replay === true) return safeRow(ctx, order)
    if (order.status === "cancelled" || order.paymentStatus === paymentStatus) throw expectedError(ERROR_CODES.CONFLICT, "Invalid payment transition")
    const now = Date.now()
    const timezone = restaurant.timezone ?? "Asia/Yangon"
    await ctx.db.patch(orderId, paymentStatus === "paid" ? { paymentStatus, paidAt: now, paidByTokenIdentifier: identity.tokenIdentifier } : { paymentStatus, paidAt: undefined, paidByTokenIdentifier: undefined })
    await ctx.db.insert("orderOperationKeys", { orderId, restaurantId: order.restaurantId, idempotencyKey: (replay as { key: string }).key, operationKind: "payment", canonicalPayloadHash: (replay as { hash: string }).hash, createdAt: now })
    await ctx.db.insert("orderPaymentEvents", { orderId, restaurantId: order.restaurantId, fromPaymentStatus: order.paymentStatus, toPaymentStatus: paymentStatus, actorTokenIdentifier: identity.tokenIdentifier, createdAt: now, timezone, businessDate: dateKey(now, timezone) })
    if (paymentStatus === "paid") return safeRow(ctx, { ...order, paymentStatus, paidAt: now })
    const { paidAt: _paidAt, paidByTokenIdentifier: _paidByTokenIdentifier, ...unpaidOrder } = order
    return safeRow(ctx, { ...unpaidOrder, paymentStatus })
}
