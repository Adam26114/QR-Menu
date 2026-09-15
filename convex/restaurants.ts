import { v } from "convex/values"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import {
  createRestaurant,
  listRestaurants,
  getActiveMembershipForRestaurant,
  findRestaurantBySlug,
  validateBusinessHours,
  evaluateBusinessHours,
} from "./model/restaurants"
import { getActiveMembership, requireIdentity, requireActiveMembership, requireRestaurantRead } from "./model/identity"
import { isSubscriptionEligible, getSubscriptionForPolicy } from "./model/subscriptions"
import { expectedError, ERROR_CODES } from "./lib/errors"

const restaurant = v.object({
  _id: v.id("restaurants"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  archived: v.boolean(),
  createdByTokenIdentifier: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  logoStorageId: v.optional(v.id("_storage")), phone: v.optional(v.string()), email: v.optional(v.string()), address: v.optional(v.string()),
  currency: v.optional(v.string()), timezone: v.optional(v.string()), taxBps: v.optional(v.number()), serviceChargeBps: v.optional(v.number()),
  acceptanceMode: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("scheduled"))),
  businessHours: v.optional(v.array(v.object({ day: v.number(), intervals: v.array(v.object({ startMinute: v.number(), endMinute: v.number() })) }))),
  firstOrderAt: v.optional(v.number()),
})

const settingsPatch = v.object({
  name: v.optional(v.string()), slug: v.optional(v.string()), logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  phone: v.optional(v.union(v.string(), v.null())), email: v.optional(v.union(v.string(), v.null())), address: v.optional(v.union(v.string(), v.null())),
  currency: v.optional(v.string()), timezone: v.optional(v.string()), taxBps: v.optional(v.number()), serviceChargeBps: v.optional(v.number()),
  acceptanceMode: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("scheduled"))),
  businessHours: v.optional(v.array(v.object({ day: v.number(), intervals: v.array(v.object({ startMinute: v.number(), endMinute: v.number() })) }))),
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

export const get = protectedQuery({
  args: { restaurantId: v.id("restaurants") }, returns: restaurant,
  handler: (ctx, args) => requireRestaurantRead(ctx, args.restaurantId),
})

export const updateSettings = protectedMutation({
  args: { restaurantId: v.id("restaurants"), patch: settingsPatch }, returns: restaurant,
  handler: async (ctx, args) => {
    await requireActiveMembership(ctx, args.restaurantId, "owner")
    const current = await ctx.db.get("restaurants", args.restaurantId)
    if (!current) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    const patch = { ...args.patch } as Record<string, unknown>
    if (patch.name !== undefined) { const value = String(patch.name).trim(); if (!value || value.length > 120) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Restaurant name is invalid"); patch.name = value }
    if (patch.slug !== undefined) {
      const slug = String(patch.slug).trim().toLowerCase()
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Slug is invalid")
      const collision = await findRestaurantBySlug(ctx, slug)
      if (collision && collision._id !== current._id) throw expectedError(ERROR_CODES.CONFLICT, "Restaurant slug is already in use")
      if (slug !== current.slug) {
       const aliases = await ctx.db.query("restaurantSlugAliases").withIndex("by_alias", (q) => q.eq("alias", slug)).take(2)
       if (aliases.length > 0) throw expectedError(ERROR_CODES.CONFLICT, "Restaurant slug is already in use")
       const oldAliases = await ctx.db.query("restaurantSlugAliases").withIndex("by_alias", (q) => q.eq("alias", current.slug)).take(2)
       if (oldAliases.length > 1) throw expectedError(ERROR_CODES.CONFLICT, "Duplicate restaurant aliases")
       if (!oldAliases[0]) await ctx.db.insert("restaurantSlugAliases", { restaurantId: current._id, alias: current.slug, createdAt: Date.now() })
      }
      patch.slug = slug
    }
    if (patch.currency !== undefined) {
      const currency = String(patch.currency).toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency) || !(Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("currency")?.includes(currency)) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Currency is invalid")
      if (current.firstOrderAt !== undefined && currency !== (current.currency ?? "MMK")) throw expectedError(ERROR_CODES.CONFLICT, "Currency is locked")
      patch.currency = currency
    }
    if (patch.timezone !== undefined) { try { new Intl.DateTimeFormat("en-US", { timeZone: String(patch.timezone) }).format() } catch { throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Timezone is invalid") } }
    for (const key of ["taxBps", "serviceChargeBps"]) if (patch[key] !== undefined && (!Number.isInteger(patch[key]) || Number(patch[key]) < 0 || Number(patch[key]) > 10000)) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Percentage is invalid")
     if (patch.businessHours) validateBusinessHours(patch.businessHours as never)
     for (const key of ["phone", "email", "address"]) if (patch[key] !== undefined && patch[key] !== null && String(patch[key]).trim().length > 500) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Field is too long")
     const replacement = { ...current, ...patch, updatedAt: Date.now() } as Record<string, unknown>
     for (const key of ["logoStorageId", "phone", "email", "address"]) if (patch[key] === null) delete replacement[key]
     delete replacement._id
     delete replacement._creationTime
     await ctx.db.replace("restaurants", current._id, replacement as never)
    return (await ctx.db.get("restaurants", current._id))!
  },
})

export const archive = protectedMutation({
  args: { restaurantId: v.id("restaurants") }, returns: restaurant,
  handler: async (ctx, args) => { const current = await ctx.db.get("restaurants", args.restaurantId); if (!current) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found"); await requireActiveMembership(ctx, args.restaurantId, "owner"); await ctx.db.patch(args.restaurantId, { archived: true, updatedAt: Date.now() }); return (await ctx.db.get("restaurants", args.restaurantId))! },
})

export const restore = protectedMutation({
  args: { restaurantId: v.id("restaurants") }, returns: restaurant,
  handler: async (ctx, args) => { const current = await ctx.db.get("restaurants", args.restaurantId); if (!current) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found"); await requireActiveMembership(ctx, args.restaurantId, "owner"); await ctx.db.patch(args.restaurantId, { archived: false, updatedAt: Date.now() }); return (await ctx.db.get("restaurants", args.restaurantId))! },
})

export const resolveSlug = protectedQuery({
  args: { slug: v.string() }, returns: restaurant,
  handler: async (ctx, args) => {
    const found = await findRestaurantBySlug(ctx, args.slug)
    if (!found) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    const identity = await requireIdentity(ctx)
    const membership = await getActiveMembership(ctx, identity.tokenIdentifier, found._id)
    if (!membership) {
      if (found.archived) throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
      throw expectedError(ERROR_CODES.FORBIDDEN, "Active restaurant membership required")
    }
    if (found.archived && membership.role !== "owner") {
      throw expectedError(ERROR_CODES.NOT_FOUND, "Restaurant not found")
    }
    return found
  },
})

export const canAcceptOrders = protectedQuery({
  args: { restaurantId: v.id("restaurants"), at: v.optional(v.number()) }, returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireActiveMembership(ctx, args.restaurantId)
    const restaurant = await ctx.db.get("restaurants", args.restaurantId)
    if (!restaurant || restaurant.archived) return false
    const subscription = await getSubscriptionForPolicy(ctx, args.restaurantId)
    if (!subscription || !isSubscriptionEligible(subscription, args.at ?? Date.now())) return false
    const mode = restaurant.acceptanceMode ?? "open"
    if (mode === "closed") return false
    if (mode === "open") return true
    return evaluateBusinessHours(args.at ?? Date.now(), restaurant.timezone ?? "Asia/Yangon", restaurant.businessHours ?? [])
  },
})
