import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation, internalQuery, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import {
    protectedAction,
    protectedMutation,
    protectedQuery,
} from "./lib/customFunctions"
import { expectedError, ERROR_CODES } from "./lib/errors"
import { requireActiveMembership } from "./model/identity"
import {
    createToken,
    decryptTableToken,
    encryptTableToken,
    normalizeTableName,
    tableForOwner,
} from "./model/tables"

const table = v.object({
    _id: v.id("restaurantTables"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    name: v.string(),
    active: v.boolean(),
    archived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
const publicChoice = v.object({ choiceId: v.id("menuOptionChoices"), name: v.string(), priceDeltaMinor: v.number() })
const publicGroup = v.object({
    groupId: v.id("menuOptionGroups"),
    name: v.string(),
    selectionMode: v.union(v.literal("single"), v.literal("multiple")),
    required: v.boolean(),
    minSelections: v.number(),
    maxSelections: v.number(),
    choices: v.array(publicChoice),
})
const publicItem = v.object({
    itemId: v.id("menuItems"),
    name: v.string(),
    description: v.optional(v.string()),
    priceMinor: v.number(),
    available: v.boolean(),
    imageUrl: v.union(v.string(), v.null()),
    options: v.array(publicGroup),
})
const publicCategory = v.object({
    categoryId: v.id("menuCategories"),
    name: v.string(),
    items: v.array(publicItem),
})
const publicMenu = v.object({
    restaurant: v.object({ name: v.string(), slug: v.string(), currency: v.optional(v.string()) }),
    table: v.object({ name: v.string() }),
    categories: v.array(publicCategory),
})
function safeTable(
    row: Pick<
        Doc<"restaurantTables">,
        | "_id"
        | "_creationTime"
        | "restaurantId"
        | "name"
        | "active"
        | "archived"
        | "createdAt"
        | "updatedAt"
    >
) {
    return {
        _id: row._id,
        _creationTime: row._creationTime,
        restaurantId: row.restaurantId,
        name: row.name,
        active: row.active,
        archived: row.archived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

async function hashToken(token: string) {
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(token)
    )
    let binary = ""
    for (const byte of new Uint8Array(bytes))
        binary += String.fromCharCode(byte)
    return btoa(binary)
}

export const list = protectedQuery({
    args: {
        restaurantId: v.id("restaurants"),
        includeArchived: v.optional(v.boolean()),
    },
    returns: v.array(table),
    handler: async (ctx, a) => {
        const membership = await requireActiveMembership(ctx, a.restaurantId)
        if (a.includeArchived && membership.role !== "owner")
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        const rows = await ctx.db
            .query("restaurantTables")
            .withIndex("by_restaurant_id", (q) =>
                q.eq("restaurantId", a.restaurantId)
            )
            .take(101)
        if (rows.length > 100)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Table list limit exceeded"
            )
        return (
            a.includeArchived ? rows : rows.filter((row) => !row.archived)
        ).map(safeTable)
    },
})
export const createInternal = internalMutation({
    args: {
        restaurantId: v.id("restaurants"),
        name: v.string(),
        tokenHash: v.string(),
        tokenCiphertext: v.string(),
        tokenIv: v.string(),
        tokenKeyVersion: v.number(),
        tokenIdentifier: v.string(),
    },
    returns: v.id("restaurantTables"),
    handler: async (ctx, a) => {
        const membership = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id_and_token_identifier", (q) =>
                q
                    .eq("restaurantId", a.restaurantId)
                    .eq("tokenIdentifier", a.tokenIdentifier)
            )
            .unique()
        if (
            !membership ||
            membership.status !== "active" ||
            membership.role !== "owner"
        )
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        const now = Date.now()
        return ctx.db.insert("restaurantTables", {
            restaurantId: a.restaurantId,
            name: normalizeTableName(a.name),
            active: true,
            archived: false,
            tokenHash: a.tokenHash,
            tokenCiphertext: a.tokenCiphertext,
            tokenIv: a.tokenIv,
            tokenKeyVersion: a.tokenKeyVersion,
            createdAt: now,
            updatedAt: now,
        })
    },
})
export const create = protectedAction({
    args: { restaurantId: v.id("restaurants"), name: v.string() },
    returns: v.object({ tableId: v.id("restaurantTables"), token: v.string() }),
    handler: async (
        ctx,
        a
    ): Promise<{ tableId: Id<"restaurantTables">; token: string }> => {
        const token = await createToken()
        const encrypted = await encryptTableToken(token)
        const hash = await hashToken(token)
        const tableId: Id<"restaurantTables"> = await ctx.runMutation(
            internal.tables.createInternal,
            {
                restaurantId: a.restaurantId,
                name: a.name,
                ...encrypted,
                tokenHash: hash,
                tokenIdentifier: ctx.identity.tokenIdentifier,
            }
        )
        return { tableId, token }
    },
})
export const rename = protectedMutation({
    args: { tableId: v.id("restaurantTables"), name: v.string() },
    returns: table,
    handler: async (ctx, a) => {
        const row = await tableForOwner(ctx, a.tableId, true)
        const name = normalizeTableName(a.name)
        const updatedAt = Date.now()
        await ctx.db.patch(a.tableId, { name, updatedAt })
        return safeTable({ ...row, name, updatedAt })
    },
})
export const setActive = protectedMutation({
    args: { tableId: v.id("restaurantTables"), active: v.boolean() },
    returns: table,
    handler: async (ctx, a) => {
        const row = await tableForOwner(ctx, a.tableId, true)
        const updatedAt = Date.now()
        await ctx.db.patch(a.tableId, { active: a.active, updatedAt })
        return safeTable({ ...row, active: a.active, updatedAt })
    },
})
async function setArchived(
    ctx: MutationCtx,
    tableId: Id<"restaurantTables">,
    archived: boolean
) {
    const row = await tableForOwner(ctx, tableId, true)
    const updatedAt = Date.now()
    await ctx.db.patch(tableId, { archived, updatedAt })
    return safeTable({ ...row, archived, updatedAt })
}
export const archive = protectedMutation({
    args: { tableId: v.id("restaurantTables") },
    returns: table,
    handler: (ctx, a) => setArchived(ctx, a.tableId, true),
})
export const restore = protectedMutation({
    args: { tableId: v.id("restaurantTables") },
    returns: table,
    handler: (ctx, a) => setArchived(ctx, a.tableId, false),
})
export const regenerateInternal = internalMutation({
    args: {
        tableId: v.id("restaurantTables"),
        tokenHash: v.string(),
        tokenCiphertext: v.string(),
        tokenIv: v.string(),
        tokenKeyVersion: v.number(),
        tokenIdentifier: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, a) => {
        const row = await ctx.db.get("restaurantTables", a.tableId)
        if (!row) throw expectedError(ERROR_CODES.NOT_FOUND, "Table not found")
        const membership = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id_and_token_identifier", (q) =>
                q
                    .eq("restaurantId", row.restaurantId)
                    .eq("tokenIdentifier", a.tokenIdentifier)
            )
            .unique()
        if (
            !membership ||
            membership.status !== "active" ||
            membership.role !== "owner"
        )
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        await ctx.db.patch(a.tableId, {
            tokenHash: a.tokenHash,
            tokenCiphertext: a.tokenCiphertext,
            tokenIv: a.tokenIv,
            tokenKeyVersion: a.tokenKeyVersion,
            updatedAt: Date.now(),
        })
        return null
    },
})
export const getForToken = internalQuery({
    args: { tableId: v.id("restaurantTables"), tokenIdentifier: v.string() },
    returns: v.object({
        tokenCiphertext: v.string(),
        tokenIv: v.string(),
        tokenKeyVersion: v.number(),
        tokenHash: v.string(),
        restaurantId: v.id("restaurants"),
    }),
    handler: async (ctx, a) => {
        const row = await ctx.db.get("restaurantTables", a.tableId)
        if (!row) throw expectedError(ERROR_CODES.NOT_FOUND, "Table not found")
        const membership = await ctx.db
            .query("restaurantMemberships")
            .withIndex("by_restaurant_id_and_token_identifier", (q) =>
                q
                    .eq("restaurantId", row.restaurantId)
                    .eq("tokenIdentifier", a.tokenIdentifier)
            )
            .unique()
        if (
            !membership ||
            membership.status !== "active" ||
            membership.role !== "owner"
        )
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        return {
            tokenCiphertext: row.tokenCiphertext,
            tokenIv: row.tokenIv,
            tokenKeyVersion: row.tokenKeyVersion,
            tokenHash: row.tokenHash,
            restaurantId: row.restaurantId,
        }
    },
})
export const regenerateToken = protectedAction({
    args: { tableId: v.id("restaurantTables") },
    returns: v.object({ token: v.string() }),
    handler: async (ctx, a): Promise<{ token: string }> => {
        await ctx.runQuery(internal.tables.getForToken, {
            tableId: a.tableId,
            tokenIdentifier: ctx.identity.tokenIdentifier,
        })
        const token = await createToken()
        const encrypted = await encryptTableToken(token)
        await ctx.runMutation(internal.tables.regenerateInternal, {
            tableId: a.tableId,
            ...encrypted,
            tokenHash: await hashToken(token),
            tokenIdentifier: ctx.identity.tokenIdentifier,
        })
        return { token }
    },
})
export const getToken = protectedAction({
    args: { tableId: v.id("restaurantTables") },
    returns: v.string(),
    handler: async (ctx, a): Promise<string> => {
        const row = await ctx.runQuery(internal.tables.getForToken, {
            tableId: a.tableId,
            tokenIdentifier: ctx.identity.tokenIdentifier,
        })
        return decryptTableToken({
            ...row,
            _id: a.tableId,
            _creationTime: 0,
            name: "",
            active: true,
            archived: false,
            createdAt: 0,
            updatedAt: 0,
        })
    },
})

export const resolvePublic = query({
    args: { restaurantSlug: v.string(), tableToken: v.string() },
    returns: v.union(publicMenu, v.null()),
    handler: async (ctx, a) => {
        const restaurant = await ctx.db
            .query("restaurants")
            .withIndex("by_slug", (q) => q.eq("slug", a.restaurantSlug))
            .unique()
        if (!restaurant || restaurant.archived) return null
        const hash = await hashToken(a.tableToken)
        const row = await ctx.db
            .query("restaurantTables")
            .withIndex("by_token_hash", (q) => q.eq("tokenHash", hash))
            .unique()
        if (
            !row ||
            row.restaurantId !== restaurant._id ||
            row.archived ||
            !row.active
        )
            return null
        const categories = await ctx.db
            .query("menuCategories")
            .withIndex("by_restaurant_id_and_sort_order", (q) =>
                q.eq("restaurantId", restaurant._id)
            )
            .take(101)
        if (categories.length > 100) return null
        const safeCategories = []
        for (const category of categories.filter((x) => !x.archived)) {
            const items = await ctx.db
                .query("menuItems")
                .withIndex("by_category_id_and_sort_order", (q) =>
                    q.eq("categoryId", category._id)
                )
                .take(101)
            if (
                items.length > 100 ||
                items.some((item) => item.restaurantId !== restaurant._id)
            )
                return null
            const safeItems = []
            for (const item of items.filter((x) => !x.archived)) {
                const groups = await ctx.db
                    .query("menuOptionGroups")
                    .withIndex("by_menu_item_id_and_sort_order", (q) =>
                        q.eq("menuItemId", item._id)
                    )
                    .take(101)
                if (groups.length > 100) return null
                if (
                    groups.some(
                        (group) =>
                            group.restaurantId !== restaurant._id ||
                            group.menuItemId !== item._id
                    )
                )
                    return null
                const options = []
                for (const group of groups.filter((x) => !x.archived)) {
                    const choices = await ctx.db
                        .query("menuOptionChoices")
                        .withIndex("by_option_group_id_and_sort_order", (q) =>
                            q.eq("optionGroupId", group._id)
                        )
                        .take(101)
                    if (choices.length > 100) return null
                    if (
                        choices.some(
                            (choice) =>
                                choice.restaurantId !== restaurant._id ||
                                choice.optionGroupId !== group._id
                        )
                    )
                        return null
                    options.push({
                        groupId: group._id,
                        name: group.name,
                        selectionMode: group.selectionMode,
                        required: group.required,
                        minSelections: group.minSelections,
                        maxSelections: group.maxSelections,
                        choices: choices
                            .filter((x) => !x.archived)
                            .map((x) => ({
                                choiceId: x._id,
                                name: x.name,
                                priceDeltaMinor: x.priceDeltaMinor,
                            })),
                    })
                }
                let imageUrl: string | null = null
                if (item.imageStorageId) {
                    const ownership = await ctx.db
                        .query("storageUploads")
                        .withIndex("by_storage_id", (q) =>
                            q.eq("storageId", item.imageStorageId!)
                        )
                        .unique()
                    if (
                        ownership &&
                        ownership.restaurantId === restaurant._id &&
                        ownership.itemId === item._id
                    )
                        imageUrl = await ctx.storage.getUrl(item.imageStorageId)
                }
                safeItems.push({
                    itemId: item._id,
                    name: item.name,
                    description: item.description,
                    priceMinor: item.priceMinor,
                    available: item.available,
                    imageUrl,
                    options,
                })
            }
            safeCategories.push({ categoryId: category._id, name: category.name, items: safeItems })
        }
        return {
            restaurant: { name: restaurant.name, slug: restaurant.slug, currency: restaurant.currency },
            table: { name: row.name },
            categories: safeCategories,
        }
    },
})
