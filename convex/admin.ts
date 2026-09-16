import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { v } from "convex/values"
import { requirePlatformAdmin } from "./auth"
import { mutation, query } from "./_generated/server"
import {
    listRestaurants as listAdminRestaurants,
    updateSubscription as updateAdminSubscription,
    subscriptionStatuses,
} from "./model/admin"

const subscription = v.object({
    status: v.union(...subscriptionStatuses.map(v.literal)),
    trialStartAt: v.optional(v.number()),
    trialEndAt: v.optional(v.number()),
    currentPeriodStartAt: v.optional(v.number()),
    currentPeriodEndAt: v.optional(v.number()),
})
const restaurant = v.object({
    _id: v.id("restaurants"),
    slug: v.string(),
    name: v.string(),
    archived: v.boolean(),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    createdAt: v.number(),
    subscriptionAvailable: v.boolean(),
    subscription,
})
const status = v.union(...subscriptionStatuses.map(v.literal))
const optionalDate = v.optional(v.union(v.number(), v.null()))

export const listRestaurants = query({
    args: { paginationOpts: paginationOptsValidator },
    returns: paginationResultValidator(restaurant),
    handler: async (ctx, args) => {
        await requirePlatformAdmin(ctx)
        return listAdminRestaurants(ctx, args.paginationOpts)
    },
})

export const updateSubscription = mutation({
    args: {
        restaurantId: v.id("restaurants"),
        status,
        trialStartAt: optionalDate,
        trialEndAt: optionalDate,
        currentPeriodStartAt: optionalDate,
        currentPeriodEndAt: optionalDate,
    },
    returns: restaurant,
    handler: async (ctx, args) => {
        await requirePlatformAdmin(ctx)
        return updateAdminSubscription(ctx, args.restaurantId, args.status, args)
    },
})
