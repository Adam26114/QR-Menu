/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const testRuntime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
}
testRuntime.process ??= {}
testRuntime.process.env ??= {}
testRuntime.process.env.QR_TOKEN_ENCRYPTION_KEY = "test-only-key"

const modules = import.meta.glob("./**/*.ts")

test("owner table lifecycle and token rotation", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const other = t.withIdentity({
        subject: "other",
        tokenIdentifier: "issuer|other",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "cafe",
        idempotencyKey: "tables",
    })
    await other.mutation(api.restaurants.create, {
        name: "Other Cafe",
        slug: "other-cafe",
        idempotencyKey: "tables",
    })
    const created = await owner.action(api.tables.create, {
        restaurantId,
        name: "  Patio  ",
    })
    expect(created.token).toHaveLength(43)
    expect(
        (await owner.query(api.tables.list, { restaurantId }))[0]?.name
    ).toBe("Patio")
    await owner.mutation(api.tables.rename, {
        tableId: created.tableId,
        name: "Bar",
    })
    await owner.mutation(api.tables.setActive, {
        tableId: created.tableId,
        active: false,
    })
    expect(
        await t.query(api.tables.resolvePublic, {
            restaurantSlug: "cafe",
            tableToken: created.token,
        })
    ).toBeNull()
    await owner.mutation(api.tables.setActive, {
        tableId: created.tableId,
        active: true,
    })
    const rotated = await owner.action(api.tables.regenerateToken, {
        tableId: created.tableId,
    })
    expect(
        await t.query(api.tables.resolvePublic, {
            restaurantSlug: "cafe",
            tableToken: created.token,
        })
    ).toBeNull()
    expect(
        (
            await t.query(api.tables.resolvePublic, {
                restaurantSlug: "cafe",
                tableToken: rotated.token,
            })
        )?.table.name
    ).toBe("Bar")
    const publicMenu = await t.query(api.tables.resolvePublic, {
        restaurantSlug: "cafe",
        tableToken: rotated.token,
    })
    expect(JSON.stringify(publicMenu)).not.toContain("_id")
    expect(JSON.stringify(publicMenu)).not.toContain("tokenHash")
    expect(JSON.stringify(publicMenu)).not.toContain("tokenCiphertext")
    expect(JSON.stringify(publicMenu)).not.toContain("tokenIv")
    expect(JSON.stringify(publicMenu)).not.toContain("tableToken")
    expect(JSON.stringify(publicMenu)).not.toContain(created.token)
    expect(JSON.stringify(publicMenu)).not.toContain(rotated.token)
    await expect(
        other.query(api.tables.list, { restaurantId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.action(api.tables.getToken, { tableId: created.tableId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        other.action(api.tables.regenerateToken, { tableId: created.tableId })
    ).rejects.toThrow("FORBIDDEN")
    await owner.mutation(api.tables.archive, { tableId: created.tableId })
    expect((await owner.query(api.tables.list, { restaurantId })).length).toBe(
        0
    )
    await owner.mutation(api.tables.restore, { tableId: created.tableId })
    expect(
        await owner.action(api.tables.getToken, { tableId: created.tableId })
    ).toBe(rotated.token)
})

test("staff can read tables but cannot mutate them", async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
        subject: "owner",
        tokenIdentifier: "issuer|owner",
    })
    const restaurantId = await owner.mutation(api.restaurants.create, {
        name: "Cafe",
        slug: "staff-cafe",
        idempotencyKey: "staff",
    })
    const created = await owner.action(api.tables.create, {
        restaurantId,
        name: "One",
    })
    const staff = t.withIdentity({
        subject: "staff",
        tokenIdentifier: "issuer|staff",
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
    expect(
        (await staff.query(api.tables.list, { restaurantId }))[0]?.name
    ).toBe("One")
    await expect(
        staff.action(api.tables.getToken, { tableId: created.tableId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        staff.action(api.tables.regenerateToken, { tableId: created.tableId })
    ).rejects.toThrow("FORBIDDEN")
    await expect(
        staff.mutation(api.tables.rename, {
            tableId: created.tableId,
            name: "Nope",
        })
    ).rejects.toThrow("FORBIDDEN")
})
