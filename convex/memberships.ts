import { v } from "convex/values"
import { protectedQuery } from "./lib/customFunctions"
import { getActiveMembershipForRestaurant } from "./model/restaurants"

const membership = v.object({
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
