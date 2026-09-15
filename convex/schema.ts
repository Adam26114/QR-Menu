import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * SOURCE OF TRUTH KEYWORDS: Convex schema, projects table, owner index, workspace, data model
 * WHAT: Defines application-owned persistence and indexes.
 * WHY: Convex schema is the sole source for generated document and ID types.
 * WHERE: Project model and public functions consume the generated shape.
 */
export default defineSchema({
  authBootstrap: defineTable({
    key: v.literal("singleton"),
    role: v.union(v.literal("admin"), v.literal("user")),
    winnerUserId: v.optional(v.string()),
    retryStates: v.optional(
      v.record(
        v.string(),
        v.object({
          attempt: v.number(),
          correlationId: v.optional(v.string()),
          terminal: v.boolean(),
        })
      )
    ),
  }).index("by_key", ["key"]),
  projects: defineTable({
    tokenIdentifier: v.optional(v.string()),
    ownerId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_token_identifier_updated", ["tokenIdentifier", "updatedAt"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
  restaurants: defineTable({
    name: v.string(),
    slug: v.string(),
    archived: v.boolean(),
    createdByTokenIdentifier: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),
  restaurantCreationKeys: defineTable({
    tokenIdentifier: v.string(),
    idempotencyKey: v.string(),
    restaurantId: v.id("restaurants"),
    createdAt: v.number(),
  }).index("by_token_identifier_and_idempotency_key", [
    "tokenIdentifier",
    "idempotencyKey",
  ]),
  restaurantMemberships: defineTable({
    restaurantId: v.id("restaurants"),
    tokenIdentifier: v.string(),
    role: v.union(v.literal("owner"), v.literal("staff")),
    status: v.union(v.literal("active"), v.literal("revoked")),
    canMarkPaid: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_restaurant_id", ["restaurantId"])
    .index("by_restaurant_id_and_token_identifier", [
      "restaurantId",
      "tokenIdentifier",
    ]),
  firstTrialClaims: defineTable({
    tokenIdentifier: v.string(),
    restaurantId: v.id("restaurants"),
    claimedAt: v.number(),
  }).index("by_token_identifier", ["tokenIdentifier"]),
  subscriptions: defineTable({
    restaurantId: v.id("restaurants"),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    trialStartAt: v.optional(v.number()),
    trialEndAt: v.optional(v.number()),
    currentPeriodStartAt: v.optional(v.number()),
    currentPeriodEndAt: v.optional(v.number()),
    externalCustomerId: v.optional(v.string()),
    externalSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_restaurant_id", ["restaurantId"]),
})
