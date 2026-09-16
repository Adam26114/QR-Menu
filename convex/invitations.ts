import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import { expectedError, ERROR_CODES } from "./lib/errors"
import {
    hashInvitationToken,
    invitationStatus,
    INVITATION_TTL_MS,
    normalizeEmail,
    validateToken,
} from "./model/invitations"
import {
    getActiveMembership,
    requireActiveMembership,
    requireIdentity,
    type DatabaseCtx,
} from "./model/identity"

type SafeInvitation = {
    _id: Doc<"staffInvitations">["_id"]
    _creationTime: number
    restaurantId: Doc<"staffInvitations">["restaurantId"]
    email: string
    role: "owner" | "staff"
    canMarkPaid: boolean
    createdAt: number
    expiresAt: number
    revokedAt?: number
    acceptedAt?: number
    status: "pending" | "expired" | "revoked" | "accepted"
}

const role = v.union(v.literal("owner"), v.literal("staff"))
const status = v.union(
    v.literal("pending"),
    v.literal("expired"),
    v.literal("revoked"),
    v.literal("accepted")
)
const safeInvitationValidator = v.object({
    _id: v.id("staffInvitations"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    email: v.string(),
    role,
    canMarkPaid: v.boolean(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    status,
})
const safeMembership = v.object({
    _id: v.id("restaurantMemberships"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    email: v.optional(v.string()),
    role,
    status: v.union(v.literal("active"), v.literal("revoked")),
    canMarkPaid: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
})

function safeInvitation(row: Doc<"staffInvitations">, now: number) {
    return {
        _id: row._id,
        _creationTime: row._creationTime,
        restaurantId: row.restaurantId,
        email: row.email,
        role: row.role,
        canMarkPaid: row.canMarkPaid,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        ...(row.revokedAt === undefined ? {} : { revokedAt: row.revokedAt }),
        ...(row.acceptedAt === undefined ? {} : { acceptedAt: row.acceptedAt }),
        status: invitationStatus(row, now),
    }
}

export const create = protectedMutation({
    args: {
        restaurantId: v.id("restaurants"),
        email: v.string(),
        role,
        canMarkPaid: v.boolean(),
    },
    returns: v.object({
        invitation: safeInvitationValidator,
        token: v.string(),
    }),
    handler: async (
        ctx,
        a
    ): Promise<{ invitation: SafeInvitation; token: string }> => {
        const email = normalizeEmail(a.email)
        const bytes = new Uint8Array(32)
        crypto.getRandomValues(bytes)
        let token = ""
        for (const byte of bytes) token += byte.toString(16).padStart(2, "0")
        const owner = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id_and_token_identifier", (q) =>
                q
                    .eq("restaurantId", a.restaurantId)
                    .eq("tokenIdentifier", ctx.identity.tokenIdentifier)
            )
            .take(2)
        if (
            owner.length !== 1 ||
            owner[0]?.status !== "active" ||
            owner[0]?.role !== "owner"
        )
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        const now = Date.now()
        const id = await ctx.db.insert("staffInvitations", {
            restaurantId: a.restaurantId,
            email,
            role: a.role,
            canMarkPaid: a.role === "owner" ? true : a.canMarkPaid,
            tokenHash: await hashInvitationToken(token),
            createdAt: now,
            expiresAt: now + INVITATION_TTL_MS,
            createdByTokenIdentifier: ctx.identity.tokenIdentifier,
        })
        const invitation = safeInvitation(
            { ...(await ctx.db.get("staffInvitations", id))! },
            now
        )
        return { invitation, token }
    },
})

export const list = protectedQuery({
    args: { restaurantId: v.id("restaurants"), at: v.number() },
    returns: v.array(safeInvitationValidator),
    handler: async (ctx, a) => {
        await requireActiveMembership(ctx, a.restaurantId, "owner")
        const rows = await ctx.db
            .query("staffInvitations")
            .withIndex(
                "by_restaurant_id_and_accepted_revoked_expires_created",
                (q) =>
                    q
                        .eq("restaurantId", a.restaurantId)
                        .eq("acceptedAt", undefined)
                        .eq("revokedAt", undefined)
                        .gt("expiresAt", a.at)
            )
            .order("desc")
            .take(101)
        if (rows.length > 100)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Invitation list limit exceeded"
            )
        return rows
            .filter((row) => invitationStatus(row, a.at) === "pending")
            .map((row) => safeInvitation(row, a.at))
    },
})

async function requireInvitationOwner(
    ctx: DatabaseCtx,
    restaurantId: Doc<"staffInvitations">["restaurantId"]
) {
    const identity = await requireIdentity(ctx)
    const membership = await getActiveMembership(
        ctx,
        identity.tokenIdentifier,
        restaurantId
    )
    if (!membership || membership.role !== "owner")
        throw expectedError(ERROR_CODES.NOT_FOUND, "Invitation not found")
}

export const inspect = protectedQuery({
    args: { invitationId: v.id("staffInvitations"), at: v.number() },
    returns: safeInvitationValidator,
    handler: async (ctx, a) => {
        const row = await ctx.db.get("staffInvitations", a.invitationId)
        if (!row)
            throw expectedError(ERROR_CODES.NOT_FOUND, "Invitation not found")
        await requireInvitationOwner(ctx, row.restaurantId)
        return safeInvitation(row, a.at)
    },
})

export const revoke = protectedMutation({
    args: { invitationId: v.id("staffInvitations") },
    returns: safeInvitationValidator,
    handler: async (ctx, a) => {
        const row = await ctx.db.get("staffInvitations", a.invitationId)
        if (!row)
            throw expectedError(ERROR_CODES.NOT_FOUND, "Invitation not found")
        await requireInvitationOwner(ctx, row.restaurantId)
        if (row.acceptedAt !== undefined)
            throw expectedError(ERROR_CODES.CONFLICT, "Invitation was accepted")
        const now = Date.now()
        if (row.revokedAt === undefined)
            await ctx.db.patch(a.invitationId, { revokedAt: now })
        return safeInvitation(
            (await ctx.db.get("staffInvitations", a.invitationId))!,
            now
        )
    },
})

export const accept = protectedMutation({
    args: { token: v.string() },
    returns: safeMembership,
    handler: async (ctx, a) => {
        validateToken(a.token)
        const identityEmail = ctx.identity.email
        if (!identityEmail)
            throw expectedError(
                ERROR_CODES.FORBIDDEN,
                "Authenticated email required"
            )
        const email = normalizeEmail(identityEmail)
        const hash = await hashInvitationToken(a.token)
        const row = await ctx.db
            .query("staffInvitations")
            .withIndex("by_token_hash", (q) => q.eq("tokenHash", hash))
            .unique()
        if (!row)
            throw expectedError(ERROR_CODES.NOT_FOUND, "Invitation not found")
        if (row.email !== email)
            throw expectedError(
                ERROR_CODES.FORBIDDEN,
                "Invitation email does not match"
            )
        if (invitationStatus(row) !== "pending")
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Invitation is no longer pending"
            )
        const existing = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id_and_token_identifier", (q) =>
                q
                    .eq("restaurantId", row.restaurantId)
                    .eq("tokenIdentifier", ctx.identity.tokenIdentifier)
            )
            .take(2)
        if (existing.length > 1)
            throw expectedError(ERROR_CODES.CONFLICT, "Duplicate membership")
        const now = Date.now()
        let membership = existing[0]
        if (membership?.status === "active")
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Active membership already exists"
            )
        if (membership) {
            await ctx.db.patch(membership._id, {
                email,
                role: row.role,
                canMarkPaid: row.role === "owner" ? true : row.canMarkPaid,
                status: "active",
                updatedAt: now,
            })
            membership = (await ctx.db.get(
                "restaurantMemberships",
                membership._id
            ))!
        } else {
            const id = await ctx.db.insert("restaurantMemberships", {
                restaurantId: row.restaurantId,
                tokenIdentifier: ctx.identity.tokenIdentifier,
                email,
                role: row.role,
                status: "active",
                canMarkPaid: row.role === "owner" ? true : row.canMarkPaid,
                createdAt: now,
                updatedAt: now,
            })
            membership = (await ctx.db.get("restaurantMemberships", id))!
        }
        await ctx.db.patch(row._id, {
            acceptedAt: now,
            acceptedByTokenIdentifier: ctx.identity.tokenIdentifier,
        })
        return {
            _id: membership._id,
            _creationTime: membership._creationTime,
            restaurantId: membership.restaurantId,
            email: membership.email,
            role: membership.role,
            status: "active" as const,
            canMarkPaid: membership.canMarkPaid,
            createdAt: membership.createdAt,
            updatedAt: now,
        }
    },
})
