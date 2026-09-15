import { v } from "convex/values"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import {
  createRestaurant,
  listRestaurants,
  getActiveMembershipForRestaurant,
} from "./model/restaurants"

const restaurant = v.object({
  _id: v.id("restaurants"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  archived: v.boolean(),
  createdByTokenIdentifier: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const list = protectedQuery({
  args: {},
  returns: v.array(restaurant),
  handler: (ctx) => listRestaurants(ctx, ctx.identity.tokenIdentifier),
})

export const create = protectedMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    idempotencyKey: v.string(),
  },
  returns: v.id("restaurants"),
  handler: (ctx, args) =>
    createRestaurant(
      ctx,
      ctx.identity.tokenIdentifier,
      args.name,
      args.slug,
      args.idempotencyKey
    ),
})

export const getMembership = protectedQuery({
  args: { restaurantId: v.id("restaurants") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("restaurantMemberships"),
      _creationTime: v.number(),
      restaurantId: v.id("restaurants"),
      tokenIdentifier: v.string(),
      role: v.union(v.literal("owner"), v.literal("staff")),
      status: v.union(v.literal("active"), v.literal("revoked")),
      canMarkPaid: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: (ctx, args) =>
    getActiveMembershipForRestaurant(
      ctx,
      ctx.identity.tokenIdentifier,
      args.restaurantId
    ),
})
