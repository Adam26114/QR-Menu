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
        logoStorageId: v.optional(v.id("_storage")),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        address: v.optional(v.string()),
        currency: v.optional(v.string()),
        timezone: v.optional(v.string()),
        taxBps: v.optional(v.number()),
        serviceChargeBps: v.optional(v.number()),
        acceptanceMode: v.optional(
            v.union(
                v.literal("open"),
                v.literal("closed"),
                v.literal("scheduled")
            )
        ),
        businessHours: v.optional(
            v.array(
                v.object({
                    day: v.number(),
                    intervals: v.array(
                        v.object({
                            startMinute: v.number(),
                            endMinute: v.number(),
                        })
                    ),
                })
            )
        ),
        firstOrderAt: v.optional(v.number()),
    }).index("by_slug", ["slug"]),
    restaurantSlugAliases: defineTable({
        restaurantId: v.id("restaurants"),
        alias: v.string(),
        createdAt: v.number(),
    })
        .index("by_alias", ["alias"])
        .index("by_restaurant_id", ["restaurantId"]),
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
        email: v.optional(v.string()),
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
        ])
        .index("by_restaurant_id_and_status_and_role", [
            "restaurantId",
            "status",
            "role",
        ])
        .index("by_restaurant_id_and_email_and_status", [
            "restaurantId",
            "email",
            "status",
        ]),
    staffInvitations: defineTable({
        restaurantId: v.id("restaurants"),
        email: v.string(),
        role: v.union(v.literal("owner"), v.literal("staff")),
        canMarkPaid: v.boolean(),
        tokenHash: v.string(),
        createdAt: v.number(),
        expiresAt: v.number(),
        revokedAt: v.optional(v.number()),
        acceptedAt: v.optional(v.number()),
        createdByTokenIdentifier: v.optional(v.string()),
        acceptedByTokenIdentifier: v.optional(v.string()),
    })
        .index("by_token_hash", ["tokenHash"])
        .index("by_restaurant_id_and_created_at", ["restaurantId", "createdAt"])
        .index("by_restaurant_id_and_accepted_revoked_expires_created", [
            "restaurantId",
            "acceptedAt",
            "revokedAt",
            "expiresAt",
            "createdAt",
        ]),
    restaurantTables: defineTable({
        restaurantId: v.id("restaurants"),
        name: v.string(),
        active: v.boolean(),
        archived: v.boolean(),
        tokenHash: v.string(),
        tokenCiphertext: v.string(),
        tokenIv: v.string(),
        tokenKeyVersion: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_restaurant_id", ["restaurantId"])
        .index("by_token_hash", ["tokenHash"]),
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
    menuCategories: defineTable({
        restaurantId: v.id("restaurants"),
        name: v.string(),
        sortOrder: v.number(),
        archived: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_restaurant_id", ["restaurantId"])
        .index("by_restaurant_id_and_sort_order", [
            "restaurantId",
            "sortOrder",
        ]),
    menuItems: defineTable({
        restaurantId: v.id("restaurants"),
        categoryId: v.id("menuCategories"),
        name: v.string(),
        description: v.optional(v.string()),
        priceMinor: v.number(),
        available: v.boolean(),
        archived: v.boolean(),
        sortOrder: v.number(),
        imageStorageId: v.optional(v.id("_storage")),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_restaurant_id_and_category_id_and_sort_order", [
            "restaurantId",
            "categoryId",
            "sortOrder",
        ])
        .index("by_category_id_and_sort_order", ["categoryId", "sortOrder"])
        .index("by_restaurant_id", ["restaurantId"])
        .index("by_image_storage_id", ["imageStorageId"]),
    storageUploads: defineTable({
        storageId: v.id("_storage"),
        restaurantId: v.id("restaurants"),
        uploadedByTokenIdentifier: v.string(),
        itemId: v.id("menuItems"),
        createdAt: v.number(),
    })
        .index("by_storage_id", ["storageId"])
        .index("by_restaurant_id", ["restaurantId"])
        .index("by_item_id", ["itemId"]),
    pendingStorageUploads: defineTable({
        restaurantId: v.id("restaurants"),
        uploadedByTokenIdentifier: v.string(),
        itemId: v.id("menuItems"),
        storageId: v.optional(v.id("_storage")),
        expiresAt: v.number(),
        createdAt: v.number(),
    })
        .index("by_expires_at", ["expiresAt"])
        .index("by_item_id", ["itemId"]),
    menuOptionGroups: defineTable({
        restaurantId: v.id("restaurants"),
        menuItemId: v.id("menuItems"),
        name: v.string(),
        selectionMode: v.union(v.literal("single"), v.literal("multiple")),
        required: v.boolean(),
        minSelections: v.number(),
        maxSelections: v.number(),
        sortOrder: v.number(),
        archived: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_menu_item_id_and_sort_order", ["menuItemId", "sortOrder"])
        .index("by_restaurant_id", ["restaurantId"]),
    menuOptionChoices: defineTable({
        restaurantId: v.id("restaurants"),
        optionGroupId: v.id("menuOptionGroups"),
        name: v.string(),
        priceDeltaMinor: v.number(),
        sortOrder: v.number(),
        archived: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_option_group_id_and_sort_order", [
            "optionGroupId",
            "sortOrder",
        ])
        .index("by_restaurant_id", ["restaurantId"]),
})
