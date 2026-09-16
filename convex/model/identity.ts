import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { expectedError, ERROR_CODES } from "../lib/errors"
import type { UserIdentity } from "convex/server"

export type DatabaseCtx = QueryCtx | MutationCtx

export function normalizeEmail(email: string): string {
    const value = email.trim().toLowerCase()
    if (
        !value ||
        value.length > 320 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    )
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Email is invalid")
    return value
}

export async function requireIdentity(ctx: DatabaseCtx): Promise<UserIdentity> {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity)
        throw expectedError(
            ERROR_CODES.AUTH_REQUIRED,
            "Authentication required"
        )
    return identity
}

export async function getActiveMembership(
    ctx: DatabaseCtx,
    tokenIdentifier: string,
    restaurantId: Id<"restaurants">
): Promise<Doc<"restaurantMemberships"> | null> {
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

export async function requireActiveMembership(
    ctx: DatabaseCtx,
    restaurantId: Id<"restaurants">,
    requirement: "owner" | "canMarkPaid" | "member" = "member"
): Promise<Doc<"restaurantMemberships">> {
    const identity = await requireIdentity(ctx)
    const membership = await getActiveMembership(
        ctx,
        identity.tokenIdentifier,
        restaurantId
    )
    if (!membership)
        throw expectedError(
            ERROR_CODES.FORBIDDEN,
            "Active restaurant membership required"
        )
    if (requirement === "owner" && membership.role !== "owner") {
        throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
    }
    if (requirement === "canMarkPaid" && membership.role !== "owner" && !membership.canMarkPaid) {
        throw expectedError(ERROR_CODES.FORBIDDEN, "Payment access required")
    }
    return membership
}

export async function getTenantRestaurant(
    ctx: DatabaseCtx,
    restaurantId: Id<"restaurants">
) {
    const identity = await requireIdentity(ctx)
    const restaurant = await ctx.db.get("restaurants", restaurantId)
    if (!restaurant || restaurant.archived)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    const membership = await getActiveMembership(
        ctx,
        identity.tokenIdentifier,
        restaurantId
    )
    if (!membership)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    return restaurant
}

export async function requireRestaurantRead(
    ctx: DatabaseCtx,
    restaurantId: Id<"restaurants">
) {
    const identity = await requireIdentity(ctx)
    const restaurant = await ctx.db.get("restaurants", restaurantId)
    if (!restaurant)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    const membership = await getActiveMembership(
        ctx,
        identity.tokenIdentifier,
        restaurantId
    )
    if (!membership || (restaurant.archived && membership.role !== "owner"))
        throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    return restaurant
}
