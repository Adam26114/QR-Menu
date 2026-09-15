/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

test("restaurant creation derives identity and provisions the first trial", async () => {
  const t = convexTest(schema, modules)
  const unauthenticated = t.mutation(api.restaurants.create, {
    name: "Cafe",
    slug: "cafe",
    idempotencyKey: "unauthenticated-key",
  })
  await expect(unauthenticated).rejects.toThrow("AUTH_REQUIRED")

  const caller = t.withIdentity({
    subject: "subject-a",
    tokenIdentifier: "issuer|user-a",
  })
  const restaurantId = await caller.mutation(api.restaurants.create, {
    name: "Cafe",
    slug: "cafe",
    idempotencyKey: "cafe-key",
  })
  const restaurants = await caller.query(api.restaurants.list, {})
  expect(restaurants).toHaveLength(1)
  const membership = await caller.query(api.memberships.getActive, {
    restaurantId,
  })
  expect(membership?.role).toBe("owner")
  expect(membership?.tokenIdentifier).toBe("issuer|user-a")
  const subscription = await caller.query(api.subscriptions.get, {
    restaurantId,
  })
  expect(subscription.status).toBe("trialing")
  expect(subscription.trialEndAt! - subscription.trialStartAt!).toBe(
    14 * 24 * 60 * 60 * 1000
  )

  const retry = await caller.mutation(api.restaurants.create, {
    name: "Changed name",
    slug: "changed-slug",
    idempotencyKey: "cafe-key",
  })
  expect(retry).toBe(restaurantId)
  expect(await caller.query(api.restaurants.list, {})).toHaveLength(1)
})

test("the idempotency key is scoped to the token identity", async () => {
  const t = convexTest(schema, modules)
  const firstCaller = t.withIdentity({
    subject: "subject-a",
    tokenIdentifier: "issuer|user-a",
  })
  const secondCaller = t.withIdentity({
    subject: "subject-b",
    tokenIdentifier: "issuer|user-b",
  })
  await firstCaller.mutation(api.restaurants.create, {
    name: "First",
    slug: "first",
    idempotencyKey: "shared-key",
  })
  const secondRestaurant = await secondCaller.mutation(
    api.restaurants.create,
    {
      name: "Second",
      slug: "second",
      idempotencyKey: "shared-key",
    }
  )
  expect(await secondCaller.query(api.restaurants.list, {})).toHaveLength(1)
  await expect(
    secondCaller.query(api.subscriptions.get, { restaurantId: secondRestaurant })
  ).resolves.toMatchObject({ status: "trialing" })
  await expect(
    secondCaller.query(api.restaurants.getMembership, {
      restaurantId: (await firstCaller.query(api.restaurants.list, {}))[0]._id,
    })
  ).resolves.toBeNull()
})

test("additional restaurants do not consume the first-trial claim", async () => {
  const t = convexTest(schema, modules)
  const caller = t.withIdentity({
    subject: "different-subject",
    tokenIdentifier: "issuer|same-user",
  })
  const first = await caller.mutation(api.restaurants.create, {
    name: "One",
    slug: "one",
    idempotencyKey: "one-key",
  })
  const second = await caller.mutation(api.restaurants.create, {
    name: "Two",
    slug: "two",
    idempotencyKey: "two-key",
  })
  expect(
    (await caller.query(api.subscriptions.get, { restaurantId: first })).status
  ).toBe("trialing")
  expect(
    (await caller.query(api.subscriptions.get, { restaurantId: second })).status
  ).toBe("expired")
})

test("a separate identity cannot list or read another tenant", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: "owner-subject",
    tokenIdentifier: "issuer|owner",
  })
  const other = t.withIdentity({
    subject: "other-subject",
    tokenIdentifier: "issuer|other",
  })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Private",
    slug: "private",
    idempotencyKey: "private-key",
  })
  expect(await other.query(api.restaurants.list, {})).toHaveLength(0)
  await expect(
    other.query(api.restaurants.getMembership, { restaurantId })
  ).resolves.toBeNull()
  await expect(
    other.query(api.subscriptions.get, { restaurantId })
  ).rejects.toThrow("FORBIDDEN")
})
