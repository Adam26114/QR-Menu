/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

test("menu APIs require authentication", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Auth Cafe",
    slug: "auth-cafe",
    idempotencyKey: "auth-cafe",
  })
  await expect(t.query(api.menu.listCategories, { restaurantId })).rejects.toThrow("AUTH_REQUIRED")
})

test("an owner can create and list menu categories and items", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, {
    name: "Menu Cafe",
    slug: "menu-cafe",
    idempotencyKey: "menu-cafe",
  })
  const categoryId = await owner.mutation(api.menu.createCategory, { restaurantId, name: " Mains " })
  const itemId = await owner.mutation(api.menu.createItem, {
    restaurantId,
    categoryId,
    name: "Noodles",
    priceMinor: 1200,
  })
  expect((await owner.query(api.menu.listCategories, { restaurantId }))[0].name).toBe("Mains")
  expect((await owner.query(api.menu.listItems, { restaurantId }))[0]._id).toBe(itemId)
})

test("option group updates persist selection mode and reorder requires an exact active permutation", async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "issuer|owner" })
  const restaurantId = await owner.mutation(api.restaurants.create, { name: "Options Cafe", slug: "options-cafe", idempotencyKey: "options-cafe" })
  const first = await owner.mutation(api.menu.createCategory, { restaurantId, name: "Mains" })
  const second = await owner.mutation(api.menu.createCategory, { restaurantId, name: "Sides" })
  const item = await owner.mutation(api.menu.createItem, { restaurantId, categoryId: first, name: "Rice", priceMinor: 500 })
  const group = await owner.mutation(api.menu.createOptionGroup, { itemId: item, name: "Toppings", selectionMode: "single", required: false, minSelections: 0, maxSelections: 1 })
  const updated = await owner.mutation(api.menu.updateOptionGroup, { optionGroupId: group, selectionMode: "multiple", maxSelections: 3 })
  expect(updated.selectionMode).toBe("multiple")
  await expect(owner.mutation(api.menu.reorderCategories, { restaurantId, orderedCategoryIds: [first] })).rejects.toThrow("VALIDATION_FAILED")
  await owner.mutation(api.menu.reorderCategories, { restaurantId, orderedCategoryIds: [second, first] })
  expect((await owner.query(api.menu.listCategories, { restaurantId }))[0]._id).toBe(second)
})
