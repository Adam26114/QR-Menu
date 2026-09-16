import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { expectedError, ERROR_CODES } from "../lib/errors"
import { normalizeEmail } from "./identity"

const TRIAL_DAYS = 14
const IDEMPOTENCY_KEY_MAX_LENGTH = 200
export const DEFAULT_BUSINESS_HOURS = Array.from({ length: 7 }, (_, day) => ({
    day,
    intervals: [],
}))

function normalizeName(name: string): string {
    const value = name.trim()
    if (!value || value.length > 120)
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Restaurant name is invalid"
        )
    return value
}

function normalizeSlug(slug: string): string {
    const value = slug.trim().toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 80) {
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Slug must contain lowercase letters, numbers, and hyphens"
        )
    }
    return value
}

export function validateBusinessHours(
    hours: Array<{
        day: number
        intervals: Array<{ startMinute: number; endMinute: number }>
    }>
) {
    if (
        hours.length !== 7 ||
        hours.some(
            (entry, index) => entry.day !== index || entry.intervals.length > 4
        )
    )
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Business hours must contain exactly seven ordered days"
        )
    for (const entry of hours) {
        let previousEnd = -1
        for (const interval of entry.intervals) {
            if (
                !Number.isInteger(interval.startMinute) ||
                !Number.isInteger(interval.endMinute) ||
                interval.startMinute < 0 ||
                interval.startMinute >= interval.endMinute ||
                interval.endMinute > 1440 ||
                interval.startMinute < previousEnd
            )
                throw expectedError(
                    ERROR_CODES.VALIDATION_FAILED,
                    "Business hour interval is invalid or overlaps"
                )
            previousEnd = interval.endMinute
        }
    }
}

export function evaluateBusinessHours(
    timestamp: number,
    timezone: string,
    hours: Array<{
        day: number
        intervals: Array<{ startMinute: number; endMinute: number }>
    }>
): boolean {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    }).formatToParts(timestamp)
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        parts.find((p) => p.type === "weekday")?.value ?? ""
    )
    const hour = Number(parts.find((p) => p.type === "hour")?.value)
    const minute = Number(parts.find((p) => p.type === "minute")?.value)
    const localMinute = hour === 24 ? 0 : hour * 60 + minute
    return (
        hours[weekday]?.intervals.some(
            (interval) =>
                localMinute >= interval.startMinute &&
                localMinute < interval.endMinute
        ) ?? false
    )
}

function normalizeIdempotencyKey(idempotencyKey: string): string {
    const value = idempotencyKey.trim()
    if (!value || value.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Idempotency key is invalid"
        )
    }
    return value
}

export async function listRestaurants(
    ctx: QueryCtx,
    tokenIdentifier: string
): Promise<Doc<"restaurants">[]> {
    const memberships = await ctx.db
        .query("restaurantMemberships")
        .withIndex("by_token_identifier", (q) =>
            q.eq("tokenIdentifier", tokenIdentifier)
        )
        .take(100)
    const restaurants: Doc<"restaurants">[] = []
    for (const membership of memberships) {
        if (membership.status !== "active") continue
        const restaurant = await ctx.db.get(
            "restaurants",
            membership.restaurantId
        )
        if (restaurant && !restaurant.archived) restaurants.push(restaurant)
    }
    return restaurants
}

export async function getActiveMembershipForRestaurant(
    ctx: QueryCtx,
    tokenIdentifier: string,
    restaurantId: Id<"restaurants">
) {
    const memberships = await ctx.db
        .query("restaurantMemberships")
        .withIndex("by_restaurant_id_and_token_identifier", (q) =>
            q
                .eq("restaurantId", restaurantId)
                .eq("tokenIdentifier", tokenIdentifier)
        )
        .take(2)
    if (memberships.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Multiple memberships exist for this identity and restaurant"
        )
    const membership = memberships[0]
    return membership?.status === "active" ? membership : null
}

export async function createRestaurant(
    ctx: MutationCtx,
    tokenIdentifier: string,
    name: string,
    slug: string,
    idempotencyKey: string,
    email?: string
) {
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey)
    const priorKeys = await ctx.db
        .query("restaurantCreationKeys")
        .withIndex("by_token_identifier_and_idempotency_key", (q) =>
            q
                .eq("tokenIdentifier", tokenIdentifier)
                .eq("idempotencyKey", normalizedIdempotencyKey)
        )
        .take(2)
    if (priorKeys.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Duplicate idempotency records"
        )
    if (priorKeys[0]) return priorKeys[0].restaurantId
    const normalizedSlug = normalizeSlug(slug)
    const existingSlugs = await ctx.db
        .query("restaurants")
        .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
        .take(2)
    if (existingSlugs.length > 0)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Restaurant slug is already in use"
        )
    const existingAliases = await ctx.db
        .query("restaurantSlugAliases")
        .withIndex("by_alias", (q) => q.eq("alias", normalizedSlug))
        .take(1)
    if (existingAliases.length > 0)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Restaurant slug is already in use"
        )
    const now = Date.now()
    const restaurantId = await ctx.db.insert("restaurants", {
        name: normalizeName(name),
        slug: normalizedSlug,
        archived: false,
        createdByTokenIdentifier: tokenIdentifier,
        createdAt: now,
        updatedAt: now,
        currency: "MMK",
        timezone: "Asia/Yangon",
        taxBps: 0,
        serviceChargeBps: 0,
        acceptanceMode: "open",
        businessHours: DEFAULT_BUSINESS_HOURS,
    })
    await ctx.db.insert("restaurantMemberships", {
        restaurantId,
        tokenIdentifier,
        ...(email ? { email: normalizeEmail(email) } : {}),
        role: "owner",
        status: "active",
        canMarkPaid: true,
        createdAt: now,
        updatedAt: now,
    })
    const claims = await ctx.db
        .query("firstTrialClaims")
        .withIndex("by_token_identifier", (q) =>
            q.eq("tokenIdentifier", tokenIdentifier)
        )
        .take(2)
    if (claims.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Duplicate first-trial claims"
        )
    const claim = claims[0]
    if (!claim) {
        await ctx.db.insert("firstTrialClaims", {
            tokenIdentifier,
            restaurantId,
            claimedAt: now,
        })
        await ctx.db.insert("subscriptions", {
            restaurantId,
            status: "trialing",
            trialStartAt: now,
            trialEndAt: now + TRIAL_DAYS * 24 * 60 * 60 * 1000,
            currentPeriodStartAt: now,
            currentPeriodEndAt: now + TRIAL_DAYS * 24 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
        })
    } else {
        await ctx.db.insert("subscriptions", {
            restaurantId,
            status: "expired",
            createdAt: now,
            updatedAt: now,
        })
    }
    await ctx.db.insert("restaurantCreationKeys", {
        tokenIdentifier,
        idempotencyKey: normalizedIdempotencyKey,
        restaurantId,
        createdAt: now,
    })
    return restaurantId
}

export async function markFirstOrder(
    ctx: MutationCtx,
    restaurantId: Id<"restaurants">,
    timestamp = Date.now()
) {
    const restaurant = await ctx.db.get("restaurants", restaurantId)
    if (!restaurant)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    if (restaurant.firstOrderAt === undefined)
        await ctx.db.patch(restaurantId, { firstOrderAt: timestamp })
    return (await ctx.db.get("restaurants", restaurantId))!.firstOrderAt!
}

export async function findRestaurantBySlug(ctx: QueryCtx, slug: string) {
    const normalized = normalizeSlug(slug)
    const current = await ctx.db
        .query("restaurants")
        .withIndex("by_slug", (q) => q.eq("slug", normalized))
        .take(2)
    if (current.length > 1)
        throw expectedError(ERROR_CODES.CONFLICT, "Duplicate restaurant slugs")
    const aliases = await ctx.db
        .query("restaurantSlugAliases")
        .withIndex("by_alias", (q) => q.eq("alias", normalized))
        .take(2)
    if (aliases.length > 1)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Duplicate restaurant aliases"
        )
    if (current[0] && aliases[0])
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Slug is both current and an alias"
        )
    if (current[0]) return current[0]
    return aliases[0]
        ? await ctx.db.get("restaurants", aliases[0].restaurantId)
        : null
}
