import { v } from "convex/values"
import { protectedQuery } from "./lib/customFunctions"
import { getSubscription } from "./model/subscriptions"

const subscription = v.object({
    _id: v.id("subscriptions"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    status: v.union(
        v.literal("trialing"),
        v.literal("active"),
        v.literal("past_due"),
        v.literal("cancelled"),
        v.literal("expired")
    ),
    trialStartAt: v.optional(v.number()),
    trialEndAt: v.optional(v.number()),
    currentPeriodStartAt: v.optional(v.number()),
    currentPeriodEndAt: v.optional(v.number()),
    externalCustomerId: v.optional(v.string()),
    externalSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})

export const get = protectedQuery({
    args: { restaurantId: v.id("restaurants") },
    returns: subscription,
    handler: (ctx, args) => getSubscription(ctx, args.restaurantId),
})
