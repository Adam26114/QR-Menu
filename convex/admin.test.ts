/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import { components } from "./_generated/api"
import schema from "./schema"
import { assertPlatformAdminRole } from "./auth"
import {
    listRestaurants as listAdminRestaurants,
    updateSubscription as updateAdminSubscription,
} from "./model/admin"
import betterAuthSchema from "./betterAuth/schema"

const modules = import.meta.glob("./**/*.ts")
const betterAuthModules = import.meta.glob("./betterAuth/**/*.ts")

test("admin APIs require authentication", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "cafe",
        idempotencyKey: "cafe-key",
    })
    await expect(
        t.query(api.admin.listRestaurants, {
            paginationOpts: { numItems: 10, cursor: null },
        })
    ).rejects.toThrow("AUTH_REQUIRED")
    await expect(
        t.mutation(api.admin.updateSubscription, {
            restaurantId,
            status: "active",
        })
    ).rejects.toThrow("AUTH_REQUIRED")
})

test("restaurant owners and staff cannot elevate to platform admin", async () => {
    const t = convexTest(schema, modules)
    t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules)
    const timestamp = Date.now()
    const authRecords = await t.run(async (ctx) => {
        const ids = []
        const sessionIds = []
        for (const user of [
            {
                userId: "owner-user",
                role: "user" as const,
                name: "Owner",
                email: "owner@example.com",
            },
            {
                userId: "staff-user",
                role: "user" as const,
                name: "Staff",
                email: "staff@example.com",
            },
            {
                userId: "admin-user",
                role: "admin" as const,
                name: "Admin",
                email: "admin@example.com",
            },
        ]) {
            const userRecord = await ctx.runMutation(components.betterAuth.adapter.create, {
                input: {
                    model: "user",
                    data: {
                        userId: user.userId,
                        name: user.name,
                        email: user.email,
                        emailVerified: true,
                        image: null,
                        role: user.role,
                        bootstrapRoleRequest: null,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                    },
                },
            })
            ids.push(userRecord._id)
            const sessionId = await ctx.runMutation(
                components.betterAuth.adapter.create,
                {
                    input: {
                        model: "session",
                        data: {
                            expiresAt: timestamp + 60 * 60 * 1000,
                            token: `${user.userId}-token`,
                            createdAt: timestamp,
                            updatedAt: timestamp,
                            userId: user.userId,
                        },
                    },
                }
            )
            sessionIds.push(sessionId._id)
        }
        return { ids, sessionIds }
    })
    const owner = t.withIdentity({
        subject: authRecords.ids[0],
        tokenIdentifier: "issuer|owner-user",
        sessionId: authRecords.sessionIds[0],
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "tenant-admin-boundary",
        idempotencyKey: "tenant-admin-boundary-key",
    })
    const staff = t.withIdentity({
        subject: authRecords.ids[1],
        tokenIdentifier: "issuer|staff-user",
        sessionId: authRecords.sessionIds[1],
    })
    await t.run(async (ctx) =>
        ctx.db.insert("restaurantMemberships", {
            restaurantId,
            tokenIdentifier: "issuer|staff",
            role: "staff",
            status: "active",
            canMarkPaid: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })
    )

    const paginationOpts = { numItems: 10, cursor: null }
    await expect(owner.query(api.admin.listRestaurants, { paginationOpts })).rejects.toThrow("FORBIDDEN")
    await expect(
        owner.mutation(api.admin.updateSubscription, {
            restaurantId,
            status: "active",
        })
    ).rejects.toThrow("FORBIDDEN")
    await expect(staff.query(api.admin.listRestaurants, { paginationOpts })).rejects.toThrow("FORBIDDEN")
    await expect(
        staff.mutation(api.admin.updateSubscription, {
            restaurantId,
            status: "active",
        })
    ).rejects.toThrow("FORBIDDEN")
})

test("persisted admin can list and update allowlisted restaurant data", async () => {
    const t = convexTest(schema, modules)
    t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules)
    const timestamp = Date.now()
    const authRecord = await t.run(async (ctx) => {
        const user = await ctx.runMutation(components.betterAuth.adapter.create, {
            input: {
                model: "user",
                data: {
                    userId: "admin-user",
                    name: "Admin",
                    email: "admin@example.com",
                    emailVerified: true,
                    image: null,
                    role: "admin",
                    bootstrapRoleRequest: null,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                },
            },
        })
        const session = await ctx.runMutation(components.betterAuth.adapter.create, {
            input: {
                model: "session",
                data: {
                    expiresAt: timestamp + 60 * 60 * 1000,
                    token: "admin-user-token",
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    userId: "admin-user",
                },
            },
        })
        return { userId: user._id, sessionId: session._id }
    })
    const owner = t.withIdentity({
        subject: "owner-user",
        tokenIdentifier: "issuer|owner-user",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Admin Cafe",
        slug: "admin-cafe",
        idempotencyKey: "admin-cafe-key",
    })
    const admin = t.withIdentity({
        subject: authRecord.userId,
        tokenIdentifier: "issuer|admin-user",
        sessionId: authRecord.sessionId,
    })

    const listed = await admin.query(api.admin.listRestaurants, {
        paginationOpts: { numItems: 10, cursor: null },
    })
    expect(listed.page).toHaveLength(1)
    const allowlistedKeys = [
        "_id",
        "slug",
        "name",
        "archived",
        "timezone",
        "currency",
        "createdAt",
        "subscriptionAvailable",
        "subscription",
    ]
    expect(Object.keys(listed.page[0]!).sort()).toEqual(allowlistedKeys.sort())
    expect(listed.page[0]).not.toHaveProperty("externalCustomerId")
    expect(listed.page[0]).not.toHaveProperty("externalSubscriptionId")
    expect(listed.page[0]).not.toHaveProperty("email")
    expect(listed.page[0]).not.toHaveProperty("phone")

    const updated = await admin.mutation(api.admin.updateSubscription, {
        restaurantId,
        status: "active",
    })
    expect(updated._id).toBe(restaurantId)
    expect(updated.subscription.status).toBe("active")
    expect(Object.keys(updated).sort()).toEqual(allowlistedKeys.sort())
    expect(updated).not.toHaveProperty("externalCustomerId")
    expect(updated).not.toHaveProperty("externalSubscriptionId")
    expect(updated).not.toHaveProperty("email")
    expect(updated).not.toHaveProperty("phone")
})

test("owner and staff roles are denied platform admin access", () => {
    expect(() => assertPlatformAdminRole("owner")).toThrow("FORBIDDEN")
    expect(() => assertPlatformAdminRole("staff")).toThrow("FORBIDDEN")
})

test("persisted role check accepts exactly admin", () => {
    expect(() => assertPlatformAdminRole("admin")).not.toThrow()
    expect(() => assertPlatformAdminRole("user")).toThrow("FORBIDDEN")
    expect(() => assertPlatformAdminRole(undefined)).toThrow("FORBIDDEN")
})

test("admin restaurant listing tolerates a legacy restaurant without a subscription", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Legacy Cafe",
        slug: "legacy-cafe",
        idempotencyKey: "legacy-cafe-key",
    })
    await t.run(async (ctx) => {
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurantId))
            .unique()
        await ctx.db.delete(subscription!._id)
    })

    const result = await t.run((ctx) =>
        listAdminRestaurants(ctx, { numItems: 10, cursor: null })
    )
    const restaurant = result.page.find((item) => item._id === restaurantId)
    expect(restaurant?.subscriptionAvailable).toBe(false)
    expect(restaurant?.subscription).toEqual({ status: "expired" })
})

test("admin restaurant listing marks real subscriptions as available", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "subscription-cafe",
        idempotencyKey: "subscription-cafe-key",
    })

    const result = await t.run((ctx) =>
        listAdminRestaurants(ctx, { numItems: 10, cursor: null })
    )
    const restaurant = result.page.find((item) => item._id === restaurantId)
    expect(restaurant?.subscriptionAvailable).toBe(true)
})

test("admin subscription updates reject trialing without a trial end", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "cafe-trial-validation",
        idempotencyKey: "cafe-trial-validation-key",
    })

    await expect(
        t.run((ctx) =>
            updateAdminSubscription(ctx, restaurantId, "trialing", {
                trialEndAt: null,
            })
        )
    ).rejects.toThrow("VALIDATION_FAILED")
})

test("admin subscription updates fail closed when the subscription is missing", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Legacy Cafe",
        slug: "missing-subscription-cafe",
        idempotencyKey: "missing-subscription-cafe-key",
    })
    await t.run(async (ctx) => {
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_restaurant_id", (q) => q.eq("restaurantId", restaurantId))
            .unique()
        await ctx.db.delete(subscription!._id)
    })

    await expect(
        t.run((ctx) => updateAdminSubscription(ctx, restaurantId, "active", {}))
    ).rejects.toThrow("NOT_FOUND")
})
