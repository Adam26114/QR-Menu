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
    retryStates: v.optional(v.record(v.string(), v.object({
      attempt: v.number(),
      correlationId: v.optional(v.string()),
      terminal: v.boolean(),
    }))),
  }).index("by_key", ["key"]),
  projects: defineTable({
    ownerId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
})
