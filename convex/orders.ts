import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { protectedMutation } from "./lib/customFunctions"
import { expectedError, ERROR_CODES } from "./lib/errors"
import { requireActiveMembership, requireIdentity } from "./model/identity"
import { submit } from "./model/orders"
import { hashOpaqueToken } from "./model/tables"

const line = v.object({ itemId: v.id("menuItems"), quantity: v.number(), choiceIds: v.array(v.id("menuOptionChoices")), notes: v.optional(v.string()) })
const submitResult = v.object({ orderId: v.id("orders"), orderNumber: v.string(), trackingToken: v.string(), status: v.literal("pending"), paymentStatus: v.literal("unpaid"), totalMinor: v.number(), currency: v.string() })
export const submitPublic = mutation({
    args: { restaurantSlug: v.string(), tableToken: v.string(), idempotencyKey: v.string(), items: v.array(line) },
    returns: submitResult,
    handler: (ctx, args) => submit(ctx, args),
})

const tracking = v.object({
    restaurantName: v.string(), tableName: v.string(), orderNumber: v.string(),
    status: v.union(v.literal("pending"), v.literal("preparing"), v.literal("served"), v.literal("cancelled")),
    paymentStatus: v.literal("unpaid"), submittedAt: v.number(), currency: v.string(),
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
        return { restaurantName: restaurant.name, tableName: table.name, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, submittedAt: order.submittedAt, currency: order.currency, subtotalMinor: order.subtotalMinor, taxMinor: order.taxMinor, serviceChargeMinor: order.serviceChargeMinor, totalMinor: order.totalMinor, items: order.items.map((item) => ({ name: item.itemName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, options: item.options, lineTotalMinor: item.lineTotalMinor, ...(item.notes ? { notes: item.notes } : {}) })) }
    },
})

const statuses = v.union(v.literal("pending"), v.literal("preparing"), v.literal("served"), v.literal("cancelled"))
export const updateStatus = protectedMutation({
    args: { orderId: v.id("orders"), status: statuses },
    returns: v.null(),
    handler: async (ctx, args) => {
        const order = await ctx.db.get("orders", args.orderId)
        if (!order) throw expectedError(ERROR_CODES.NOT_FOUND, "Order not found")
        await requireActiveMembership(ctx, order.restaurantId, "member")
        const allowed = (order.status === "pending" && (args.status === "preparing" || args.status === "cancelled")) || (order.status === "preparing" && (args.status === "served" || args.status === "cancelled"))
        if (!allowed) throw expectedError(ERROR_CODES.CONFLICT, "Invalid order status transition")
        const identity = await requireIdentity(ctx)
        await ctx.db.patch(args.orderId, { status: args.status })
        await ctx.db.insert("orderStatusEvents", { orderId: args.orderId, restaurantId: order.restaurantId, fromStatus: order.status, toStatus: args.status, actorTokenIdentifier: identity.tokenIdentifier, createdAt: Date.now() })
        return null
    },
})
