/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { INVITATION_TTL_MS } from "./model/invitations"

const modules = import.meta.glob("./**/*.ts")

test("owner invitation is one-time and establishes an email-bound membership", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "STAFF@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "invite-cafe",
        idempotencyKey: "invite",
    })
    const created = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: true,
    })
    expect(created.token).toBeTruthy()
    expect(
        JSON.stringify(
            await owner.query(api.invitations.list, {
                restaurantId,
                at: Date.now(),
            })
        )
    ).not.toContain(created.token)
    const accepted = await staff.mutation(api.invitations.accept, {
        token: created.token,
    })
    expect(accepted).toMatchObject({
        role: "staff",
        email: "staff@example.com",
        canMarkPaid: true,
    })
    await expect(
        staff.mutation(api.invitations.accept, { token: created.token })
    ).rejects.toThrow("CONFLICT")
    expect(
        await owner.query(api.memberships.list, { restaurantId })
    ).toHaveLength(2)
})

test("one invitee can accept invitations for two restaurants", async () => {
    const t = convexTest(schema, modules)
    const ownerA = t.withIdentity({
        subject: "owner-a",
        tokenIdentifier: "issuer|owner-a",
        email: "owner-a@example.com",
    })
    const ownerB = t.withIdentity({
        subject: "owner-b",
        tokenIdentifier: "issuer|owner-b",
        email: "owner-b@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "staff@example.com",
    })
    const first = await ownerA.mutation(api.restaurants.create, {
        name: "One",
        slug: "two-restaurant-one",
        idempotencyKey: "one",
    })
    const second = await ownerB.mutation(api.restaurants.create, {
        name: "Two",
        slug: "two-restaurant-two",
        idempotencyKey: "two",
    })
    const firstInvite = await ownerA.mutation(api.invitations.create, {
        restaurantId: first,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    const secondInvite = await ownerB.mutation(api.invitations.create, {
        restaurantId: second,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    await staff.mutation(api.invitations.accept, { token: firstInvite.token })
    await staff.mutation(api.invitations.accept, { token: secondInvite.token })
    expect(await staff.query(api.restaurants.list, {})).toHaveLength(2)
    expect(
        (
            await ownerA.query(api.memberships.list, { restaurantId: first })
        ).filter((row) => row.email === "staff@example.com")
    ).toHaveLength(1)
    expect(
        (
            await ownerB.query(api.memberships.list, { restaurantId: second })
        ).filter((row) => row.email === "staff@example.com")
    ).toHaveLength(1)
})

test("membership mutations protect the final owner and tenant boundary", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const other = t.withIdentity({
        subject: "other",
        tokenIdentifier: "issuer|other",
        email: "other@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "membership-cafe",
        idempotencyKey: "membership",
    })
    const membership = (
        await owner.query(api.memberships.list, { restaurantId })
    )[0]
    await expect(
        owner.mutation(api.memberships.remove, { membershipId: membership._id })
    ).rejects.toThrow("CONFLICT")
    await expect(
        other.query(api.memberships.list, { restaurantId })
    ).rejects.toThrow("FORBIDDEN")
})

test("invitation expiry, revocation, email normalization, and tenant-safe inspection", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const other = t.withIdentity({
        subject: "other",
        tokenIdentifier: "issuer|other",
        email: "other@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "staff@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "expiry-cafe",
        idempotencyKey: "expiry",
    })
    const otherRestaurantId = await other.mutation(api.restaurants.create, {
        name: "Other",
        slug: "other-cafe",
        idempotencyKey: "other",
    })
    const expired = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    await t.run(async (ctx) => {
        await ctx.db.patch(expired.invitation._id, {
            expiresAt: Date.now() - 1,
        })
    })
    expect(INVITATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    await expect(
        staff.mutation(api.invitations.accept, { token: expired.token })
    ).rejects.toThrow("CONFLICT")

    const revoked = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    await owner.mutation(api.invitations.revoke, {
        invitationId: revoked.invitation._id,
    })
    await expect(
        staff.mutation(api.invitations.accept, { token: revoked.token })
    ).rejects.toThrow("CONFLICT")

    const normalized = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: " Staff@Example.COM ",
        role: "staff",
        canMarkPaid: false,
    })
    const wrongEmail = t.withIdentity({
        subject: "wrong",
        tokenIdentifier: "issuer|wrong",
        email: "staff2@example.com",
    })
    await expect(
        wrongEmail.mutation(api.invitations.accept, { token: normalized.token })
    ).rejects.toThrow("FORBIDDEN")
    expect(
        (
            await owner.query(api.invitations.inspect, {
                invitationId: normalized.invitation._id,
                at: Date.now(),
            })
        ).email
    ).toBe("staff@example.com")

    await expect(
        other.mutation(api.invitations.create, {
            restaurantId,
            email: "other@example.com",
            role: "staff",
            canMarkPaid: false,
        })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.query(api.invitations.list, { restaurantId, at: Date.now() })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.query(api.invitations.inspect, {
            invitationId: normalized.invitation._id,
            at: Date.now(),
        })
    ).rejects.toThrow("NOT_FOUND")
    await expect(
        other.mutation(api.invitations.revoke, {
            invitationId: normalized.invitation._id,
        })
    ).rejects.toThrow("NOT_FOUND")
    expect(
        await other.query(api.invitations.list, {
            restaurantId: otherRestaurantId,
            at: Date.now(),
        })
    ).toEqual([])
})

test("listing ignores historical invitations before pending candidates", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "history-cafe",
        idempotencyKey: "history",
    })
    for (let i = 0; i < 105; i++) {
        const old = await owner.mutation(api.invitations.create, {
            restaurantId,
            email: `old-${i}@example.com`,
            role: "staff",
            canMarkPaid: false,
        })
        await t.run(async (ctx) => {
            await ctx.db.patch(old.invitation._id, {
                expiresAt: Date.now() - 1,
            })
        })
    }
    const pending = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "pending@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    expect(
        (
            await owner.query(api.invitations.list, {
                restaurantId,
                at: Date.now(),
            })
        ).map((row) => row._id)
    ).toContain(pending.invitation._id)
})

test("revoked membership is reactivated without a duplicate", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "staff@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "reactivate-cafe",
        idempotencyKey: "reactivate",
    })
    const first = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    const membership = await staff.mutation(api.invitations.accept, {
        token: first.token,
    })
    await owner.mutation(api.memberships.remove, {
        membershipId: membership._id,
    })
    const second = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "STAFF@example.com",
        role: "staff",
        canMarkPaid: true,
    })
    await staff.mutation(api.invitations.accept, { token: second.token })
    const memberships = await owner.query(api.memberships.list, {
        restaurantId,
    })
    expect(
        memberships.filter((row) => row.email === "staff@example.com")
    ).toHaveLength(1)
    expect(
        memberships.find((row) => row.email === "staff@example.com")
    ).toMatchObject({ status: "active", canMarkPaid: true })
})

test("concurrent acceptance creates one membership and one accepted invitation", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "staff@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "double-cafe",
        idempotencyKey: "double",
    })
    const created = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    const results = await Promise.allSettled([
        staff.mutation(api.invitations.accept, { token: created.token }),
        staff.mutation(api.invitations.accept, { token: created.token }),
    ])
    expect(
        results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(
        (await owner.query(api.memberships.list, { restaurantId })).filter(
            (row) => row.email === "staff@example.com"
        )
    ).toHaveLength(1)
    const inspected = await owner.query(api.invitations.inspect, {
        invitationId: created.invitation._id,
        at: Date.now(),
    })
    expect(inspected.status).toBe("accepted")
})

test("owners manage membership roles while staff payment access is enforced", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const secondOwner = t.withIdentity({
        subject: "second",
        tokenIdentifier: "issuer|second",
        email: "second@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "staff@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "roles-cafe",
        idempotencyKey: "roles",
    })
    const ownerInvite = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "second@example.com",
        role: "owner",
        canMarkPaid: false,
    })
    const secondMembership = await secondOwner.mutation(
        api.invitations.accept,
        { token: ownerInvite.token }
    )
    const staffInvite = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    const staffMembership = await staff.mutation(api.invitations.accept, {
        token: staffInvite.token,
    })

    await expect(
        staff.mutation(api.memberships.update, {
            membershipId: staffMembership._id,
            role: "owner",
            canMarkPaid: true,
        })
    ).rejects.toThrow("FORBIDDEN")
    const updated = await owner.mutation(api.memberships.update, {
        membershipId: staffMembership._id,
        role: "staff",
        canMarkPaid: true,
    })
    expect(updated.canMarkPaid).toBe(true)
    await expect(
        staff.mutation(api.memberships.remove, {
            membershipId: secondMembership._id,
        })
    ).rejects.toThrow("FORBIDDEN")
    const ownerMembership = (
        await owner.query(api.memberships.list, { restaurantId })
    ).find((row) => row.email === "owner@example.com")!
    await owner.mutation(api.memberships.remove, {
        membershipId: secondMembership._id,
    })
    await expect(
        owner.mutation(api.memberships.update, {
            membershipId: ownerMembership._id,
            role: "staff",
            canMarkPaid: false,
        })
    ).rejects.toThrow("CONFLICT")
    await expect(
        owner.mutation(api.memberships.remove, {
            membershipId: ownerMembership._id,
        })
    ).rejects.toThrow("CONFLICT")
    await expect(
        owner.mutation(api.memberships.leave, { restaurantId })
    ).rejects.toThrow("CONFLICT")
})

test("mark-paid capability is enforced for staff and owners", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
        email: "owner@example.com",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
        email: "staff@example.com",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "capability-cafe",
        idempotencyKey: "capability",
    })
    const invite = await owner.mutation(api.invitations.create, {
        restaurantId,
        email: "staff@example.com",
        role: "staff",
        canMarkPaid: false,
    })
    const staffMembership = await staff.mutation(api.invitations.accept, {
        token: invite.token,
    })
    await expect(
        owner.query(api.memberships.assertCanMarkPaid, { restaurantId })
    ).resolves.toBe(true)
    await expect(
        staff.query(api.memberships.assertCanMarkPaid, { restaurantId })
    ).rejects.toThrow("FORBIDDEN")
    await owner.mutation(api.memberships.update, {
        membershipId: staffMembership._id,
        role: "staff",
        canMarkPaid: true,
    })
    await expect(
        staff.query(api.memberships.assertCanMarkPaid, { restaurantId })
    ).resolves.toBe(true)
    await owner.mutation(api.memberships.update, {
        membershipId: staffMembership._id,
        role: "staff",
        canMarkPaid: false,
    })
    await expect(
        staff.query(api.memberships.assertCanMarkPaid, { restaurantId })
    ).rejects.toThrow("FORBIDDEN")
})
