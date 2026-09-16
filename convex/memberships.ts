import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import { getActiveMembershipForRestaurant } from "./model/restaurants"
import { requireActiveMembership } from "./model/identity"
import { expectedError, ERROR_CODES } from "./lib/errors"

const membership = v.object({
    _id: v.id("restaurantMemberships"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("staff")),
    status: v.union(v.literal("active"), v.literal("revoked")),
    canMarkPaid: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
})

export const getActive = protectedQuery({
    args: { restaurantId: v.id("restaurants") },
    returns: v.union(v.null(), membership),
    handler: (ctx, args) =>
        getActiveMembershipForRestaurant(
            ctx,
            ctx.identity.tokenIdentifier,
            args.restaurantId
        ),
})

export const assertCanMarkPaid = protectedQuery({
    args: { restaurantId: v.id("restaurants") },
    returns: v.literal(true),
    handler: async (ctx, args) => {
        await requireActiveMembership(ctx, args.restaurantId, "canMarkPaid")
        return true as const
    },
})

const safeMembership = v.object({
    _id: v.id("restaurantMemberships"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    email: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("staff")),
    status: v.union(v.literal("active"), v.literal("revoked")),
    canMarkPaid: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
})

function safe(row: Doc<"restaurantMemberships">) {
    return {
        _id: row._id,
        _creationTime: row._creationTime,
        restaurantId: row.restaurantId,
        ...(row.email === undefined ? {} : { email: row.email }),
        role: row.role,
        status: row.status,
        canMarkPaid: row.canMarkPaid,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

async function assertOwnerTarget(
    ctx: MutationCtx,
    membershipId: Id<"restaurantMemberships">
) {
    const target = await ctx.db.get("restaurantMemberships", membershipId)
    if (!target)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Membership not found")
    await requireActiveMembership(ctx, target.restaurantId, "owner")
    return target
}

async function protectFinalOwner(
    ctx: MutationCtx,
    target: Doc<"restaurantMemberships">,
    changingToOwner: boolean
) {
    if (
        target.status === "active" &&
        target.role === "owner" &&
        !changingToOwner
    ) {
        const owners = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id_and_status_and_role", (q) =>
                q
                    .eq("restaurantId", target.restaurantId)
                    .eq("status", "active")
                    .eq("role", "owner")
            )
            .take(2)
        if (owners.length <= 1)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Restaurant must retain an active owner"
            )
    }
}

export const list = protectedQuery({
    args: { restaurantId: v.id("restaurants") },
    returns: v.array(safeMembership),
    handler: async (ctx, a) => {
        await requireActiveMembership(ctx, a.restaurantId, "owner")
        const rows = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id", (q) =>
                q.eq("restaurantId", a.restaurantId)
            )
            .take(101)
        if (rows.length > 100)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Membership list limit exceeded"
            )
        return rows.map(safe)
    },
})

export const update = protectedMutation({
    args: {
        membershipId: v.id("restaurantMemberships"),
        role: v.union(v.literal("owner"), v.literal("staff")),
        canMarkPaid: v.boolean(),
    },
    returns: safeMembership,
    handler: async (ctx, a) => {
        const target = await assertOwnerTarget(ctx, a.membershipId)
        await protectFinalOwner(ctx, target, a.role === "owner")
        await ctx.db.patch(a.membershipId, {
            role: a.role,
            canMarkPaid: a.role === "owner" ? true : a.canMarkPaid,
            updatedAt: Date.now(),
        })
        return safe(
            (await ctx.db.get("restaurantMemberships", a.membershipId))!
        )
    },
})

export const remove = protectedMutation({
    args: { membershipId: v.id("restaurantMemberships") },
    returns: safeMembership,
    handler: async (ctx, a) => {
        const target = await assertOwnerTarget(ctx, a.membershipId)
        await protectFinalOwner(ctx, target, false)
        if (target.status === "active")
            await ctx.db.patch(a.membershipId, {
                status: "revoked",
                updatedAt: Date.now(),
            })
        return safe(
            (await ctx.db.get("restaurantMemberships", a.membershipId))!
        )
    },
})

export const leave = protectedMutation({
    args: { restaurantId: v.id("restaurants") },
    returns: safeMembership,
    handler: async (ctx, a) => {
        const current = await requireActiveMembership(ctx, a.restaurantId)
        await protectFinalOwner(ctx, current, false)
        await ctx.db.patch(current._id, {
            status: "revoked",
            updatedAt: Date.now(),
        })
        return safe((await ctx.db.get("restaurantMemberships", current._id))!)
    },
})
