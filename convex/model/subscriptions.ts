import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { expectedError, ERROR_CODES } from "../lib/errors"
import { requireActiveMembership } from "./identity"

export async function getSubscription(
    ctx: QueryCtx,
    restaurantId: Id<"restaurants">
): Promise<Doc<"subscriptions">> {
    await requireActiveMembership(ctx, restaurantId)
    const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_restaurant_id", (q) =>
            q.eq("restaurantId", restaurantId)
        )
        .take(2)
    if (subscriptions.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Multiple subscriptions exist for this restaurant"
        )
    const subscription = subscriptions[0]
    if (!subscription)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Subscription not found")
    return subscription
}

export function isSubscriptionEligible(
    subscription: Doc<"subscriptions">,
    now: number
): boolean {
    if (subscription.status === "active") return true
    return (
        subscription.status === "trialing" &&
        (subscription.trialEndAt ?? 0) > now
    )
}

export async function getSubscriptionForPolicy(
    ctx: QueryCtx,
    restaurantId: Id<"restaurants">
): Promise<Doc<"subscriptions"> | null> {
    const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_restaurant_id", (q) =>
            q.eq("restaurantId", restaurantId)
        )
        .take(2)
    if (subscriptions.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Multiple subscriptions exist for this restaurant"
        )
    return subscriptions[0] ?? null
}

export async function requireSubscriptionEligibility(
    ctx: QueryCtx,
    restaurantId: Id<"restaurants">,
    now: number
) {
    const subscription = await getSubscription(ctx, restaurantId)
    if (!isSubscriptionEligible(subscription, now)) {
        throw expectedError(
            ERROR_CODES.FORBIDDEN,
            "Restaurant subscription is not eligible"
        )
    }
    return subscription
}
