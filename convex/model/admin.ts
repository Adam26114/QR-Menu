import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { expectedError, ERROR_CODES } from "../lib/errors"

export const subscriptionStatuses = [
    "trialing",
    "active",
    "past_due",
    "cancelled",
    "expired",
] as const

export type SubscriptionStatus = (typeof subscriptionStatuses)[number]

export type SafeRestaurant = {
    _id: Id<"restaurants">
    slug: string
    name: string
    archived: boolean
    timezone?: string
    currency?: string
    createdAt: number
    subscriptionAvailable: boolean
    subscription: {
        status: SubscriptionStatus
        trialStartAt?: number
        trialEndAt?: number
        currentPeriodStartAt?: number
        currentPeriodEndAt?: number
    }
}

type SafeSubscription = SafeRestaurant["subscription"]

function safeSubscription(subscription: SafeSubscription) {
    return {
        status: subscription.status,
        trialStartAt: subscription.trialStartAt,
        trialEndAt: subscription.trialEndAt,
        currentPeriodStartAt: subscription.currentPeriodStartAt,
        currentPeriodEndAt: subscription.currentPeriodEndAt,
    }
}

export function toSafeRestaurant(
    restaurant: Doc<"restaurants">,
    subscription: SafeSubscription,
    subscriptionAvailable: boolean
): SafeRestaurant {
    return {
        _id: restaurant._id,
        slug: restaurant.slug,
        name: restaurant.name,
        archived: restaurant.archived,
        timezone: restaurant.timezone,
        currency: restaurant.currency,
        createdAt: restaurant.createdAt,
        subscriptionAvailable,
        subscription: safeSubscription(subscription),
    }
}

async function getUniqueSubscription(
    ctx: QueryCtx | MutationCtx,
    restaurantId: Id<"restaurants">
) {
    const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurantId))
        .take(2)
    if (rows.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Multiple subscriptions exist for this restaurant"
        )
    if (!rows[0])
        throw expectedError(ERROR_CODES.NOT_FOUND, "Subscription not found")
    return rows[0]
}

export async function listRestaurants(
    ctx: QueryCtx,
    paginationOpts: { numItems: number; cursor: string | null }
) {
    const page = await ctx.db.query("restaurants").order("desc").paginate(paginationOpts)
    const results = []
    for (const restaurant of page.page) {
        const subscription = (await ctx.db
            .query("subscriptions")
            .withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurant._id))
            .take(2))
        if (subscription.length > 1)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Multiple subscriptions exist for this restaurant"
            )
        results.push(
            toSafeRestaurant(
                restaurant,
                subscription[0] ?? { status: "expired" },
                subscription[0] !== undefined
            )
        )
    }
    return { ...page, page: results }
}

function validateDate(value: number | null | undefined, label: string) {
    if (
        value !== undefined &&
        value !== null &&
        (!Number.isFinite(value) || !Number.isInteger(value))
    )
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, `${label} must be a finite integer`)
}

export async function updateSubscription(
    ctx: MutationCtx,
    restaurantId: Id<"restaurants">,
    status: SubscriptionStatus,
    values: {
        trialStartAt?: number | null
        trialEndAt?: number | null
        currentPeriodStartAt?: number | null
        currentPeriodEndAt?: number | null
    }
) {
    const restaurant = await ctx.db.get("restaurants", restaurantId)
    if (!restaurant)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    const subscription = await getUniqueSubscription(ctx, restaurantId)
    validateDate(values.trialStartAt, "trialStartAt")
    validateDate(values.trialEndAt, "trialEndAt")
    validateDate(values.currentPeriodStartAt, "currentPeriodStartAt")
    validateDate(values.currentPeriodEndAt, "currentPeriodEndAt")
    const trialStart = values.trialStartAt === undefined ? subscription.trialStartAt : values.trialStartAt
    const trialEnd = values.trialEndAt === undefined ? subscription.trialEndAt : values.trialEndAt
    const periodStart = values.currentPeriodStartAt === undefined ? subscription.currentPeriodStartAt : values.currentPeriodStartAt
    const periodEnd = values.currentPeriodEndAt === undefined ? subscription.currentPeriodEndAt : values.currentPeriodEndAt
    if (status === "trialing" && (trialEnd === undefined || trialEnd === null))
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "trialEndAt is required for trialing subscriptions")
    if (trialStart !== undefined && trialStart !== null && trialEnd !== undefined && trialEnd !== null && trialEnd < trialStart)
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "trialEndAt must be greater than or equal to trialStartAt")
    if (periodStart !== undefined && periodStart !== null && periodEnd !== undefined && periodEnd !== null && periodEnd < periodStart)
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "currentPeriodEndAt must be greater than or equal to currentPeriodStartAt")
    await ctx.db.patch(subscription._id, {
        status,
        ...(values.trialStartAt !== undefined ? { trialStartAt: values.trialStartAt ?? undefined } : {}),
        ...(values.trialEndAt !== undefined ? { trialEndAt: values.trialEndAt ?? undefined } : {}),
        ...(values.currentPeriodStartAt !== undefined ? { currentPeriodStartAt: values.currentPeriodStartAt ?? undefined } : {}),
        ...(values.currentPeriodEndAt !== undefined ? { currentPeriodEndAt: values.currentPeriodEndAt ?? undefined } : {}),
        updatedAt: Date.now(),
    })
    return toSafeRestaurant(
        restaurant,
        {
            ...subscription,
            status,
            trialStartAt: trialStart === null ? undefined : trialStart,
            trialEndAt: trialEnd === null ? undefined : trialEnd,
            currentPeriodStartAt: periodStart === null ? undefined : periodStart,
            currentPeriodEndAt: periodEnd === null ? undefined : periodEnd,
        },
        true
    )
}
