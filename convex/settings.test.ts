/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"
import { markFirstOrder } from "./model/restaurants"

const modules = import.meta.glob("./**/*.ts")

test("owner can update settings and staff cannot", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "cafe", idempotencyKey: "create",
  })
  const settings = await owner.mutation(api.restaurants.updateSettings, {
    restaurantId,
    patch: { currency: "USD", timezone: "Asia/Yangon", acceptanceMode: "closed" },
  })
  expect(settings.currency).toBe("USD")
  expect(settings.acceptanceMode).toBe("closed")

  const staff = t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff" })
  await t.run(async (ctx) => {
    await ctx.db.insert("restaurantMemberships", {
      restaurantId, tokenIdentifier: "issuer|staff", role: "staff", status: "active",
      canMarkPaid: false, createdAt: Date.now(), updatedAt: Date.now(),
    })
  })
  await expect(staff.mutation(api.restaurants.updateSettings, {
    restaurantId, patch: { name: "Nope" },
  })).rejects.toThrow("FORBIDDEN")
})

test("scheduled evaluator honors Yangon half-open boundaries", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "yangon-cafe", idempotencyKey: "create",
  })
  await owner.mutation(api.restaurants.updateSettings, {
    restaurantId,
    patch: {
      acceptanceMode: "scheduled",
      businessHours: [{ day: 0, intervals: [] }, { day: 1, intervals: [{ startMinute: 600, endMinute: 660 }] }, { day: 2, intervals: [] }, { day: 3, intervals: [] }, { day: 4, intervals: [] }, { day: 5, intervals: [] }, { day: 6, intervals: [] }],
    },
  })
  expect(await owner.query(api.restaurants.canAcceptOrders, { restaurantId, at: Date.parse("2026-09-14T03:30:00Z") })).toBe(true)
  expect(await owner.query(api.restaurants.canAcceptOrders, { restaurantId, at: Date.parse("2026-09-14T04:30:00Z") })).toBe(false)
})

test("settings clearing removes nullable fields", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "clearing-cafe", idempotencyKey: "create",
  })
  await owner.mutation(api.restaurants.updateSettings, {
    restaurantId,
    patch: { phone: "555", email: "cafe@example.com", address: "Main street" },
  })
  const cleared = await owner.mutation(api.restaurants.updateSettings, {
    restaurantId,
    patch: { phone: null, email: null, address: null },
  })
  expect(cleared.phone).toBeUndefined()
  expect(cleared.email).toBeUndefined()
  expect(cleared.address).toBeUndefined()
})

test("currency is locked after markFirstOrder", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "currency-cafe", idempotencyKey: "create",
  })
  await t.run(async (ctx) => markFirstOrder(ctx, restaurantId, 123))
  await expect(owner.mutation(api.restaurants.updateSettings, {
    restaurantId, patch: { currency: "USD" },
  })).rejects.toThrow("CONFLICT")
})

test("current and old slug aliases resolve, and alias collisions conflict", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "old-cafe", idempotencyKey: "old-create",
  })
  await owner.mutation(api.restaurants.updateSettings, {
    restaurantId, patch: { slug: "new-cafe" },
  })
  await expect(owner.query(api.restaurants.resolveSlug, { slug: "new-cafe" })).resolves.toMatchObject({ _id: restaurantId })
  await expect(owner.query(api.restaurants.resolveSlug, { slug: "old-cafe" })).resolves.toMatchObject({ _id: restaurantId })

  const otherId = await owner.mutation(api.restaurants.create, {
    name: "Other", slug: "other-cafe", idempotencyKey: "other-create",
  })
  await expect(owner.mutation(api.restaurants.updateSettings, {
    restaurantId: otherId, patch: { slug: "old-cafe" },
  })).rejects.toThrow("CONFLICT")
})

test("archive is readable by owner and hidden from unauthorized readers", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const other = t.withIdentity({ subject: "other", tokenIdentifier: "issuer|other" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "archived-cafe", idempotencyKey: "create",
  })
  await owner.mutation(api.restaurants.archive, { restaurantId })
  await expect(owner.query(api.restaurants.get, { restaurantId })).resolves.toMatchObject({ archived: true })
  await expect(other.query(api.restaurants.get, { restaurantId })).rejects.toThrow("NOT_FOUND")
})

test("archived restaurants resolve for owners but not staff or non-members", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const staff = t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff" })
  const other = t.withIdentity({ subject: "other", tokenIdentifier: "issuer|other" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Cafe", slug: "archived-settings-cafe", idempotencyKey: "create",
  })
  await owner.mutation(api.restaurants.archive, { restaurantId })
  await t.run(async (ctx) => {
    await ctx.db.insert("restaurantMemberships", {
      restaurantId, tokenIdentifier: "issuer|staff", role: "staff", status: "active",
      canMarkPaid: false, createdAt: Date.now(), updatedAt: Date.now(),
    })
  })

  await expect(owner.query(api.restaurants.resolveSlug, { slug: "archived-settings-cafe" })).resolves.toMatchObject({ _id: restaurantId })
  await expect(staff.query(api.restaurants.resolveSlug, { slug: "archived-settings-cafe" })).rejects.toThrow("NOT_FOUND")
  await expect(other.query(api.restaurants.resolveSlug, { slug: "archived-settings-cafe" })).rejects.toThrow("NOT_FOUND")
})
