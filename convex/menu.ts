import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import { requireActiveMembership, requireIdentity } from "./model/identity"
import { expectedError, ERROR_CODES } from "./lib/errors"
import {
    text,
    description,
    price,
    delta,
    integer,
    order,
    MAX_LIST,
} from "./model/menu"

const category = v.object({
    _id: v.id("menuCategories"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    name: v.string(),
    sortOrder: v.number(),
    archived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
const item = v.object({
    _id: v.id("menuItems"),
    _creationTime: v.number(),
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
const group = v.object({
    _id: v.id("menuOptionGroups"),
    _creationTime: v.number(),
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
const choice = v.object({
    _id: v.id("menuOptionChoices"),
    _creationTime: v.number(),
    restaurantId: v.id("restaurants"),
    optionGroupId: v.id("menuOptionGroups"),
    name: v.string(),
    priceDeltaMinor: v.number(),
    sortOrder: v.number(),
    archived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
const idArray = <T extends "menuCategories" | "menuItems">(kind: T) =>
    v.array(v.id(kind))

type DbCtx = QueryCtx | MutationCtx
async function owner(ctx: DbCtx, restaurantId: Id<"restaurants">) {
    await requireActiveMembership(ctx, restaurantId, "owner")
}
async function member(ctx: DbCtx, restaurantId: Id<"restaurants">) {
    await requireActiveMembership(ctx, restaurantId)
}
async function getCategory(
    ctx: DbCtx,
    id: Id<"menuCategories">
): Promise<Doc<"menuCategories">> {
    const x = await ctx.db.get("menuCategories", id)
    if (!x) throw expectedError(ERROR_CODES.NOT_FOUND, "Category not found")
    return x
}
async function getItem(
    ctx: DbCtx,
    id: Id<"menuItems">
): Promise<Doc<"menuItems">> {
    const x = await ctx.db.get("menuItems", id)
    if (!x) throw expectedError(ERROR_CODES.NOT_FOUND, "Item not found")
    return x
}
async function getGroup(
    ctx: DbCtx,
    id: Id<"menuOptionGroups">
): Promise<Doc<"menuOptionGroups">> {
    const x = await ctx.db.get("menuOptionGroups", id)
    if (!x) throw expectedError(ERROR_CODES.NOT_FOUND, "Option group not found")
    return x
}
async function getChoice(
    ctx: DbCtx,
    id: Id<"menuOptionChoices">
): Promise<Doc<"menuOptionChoices">> {
    const x = await ctx.db.get("menuOptionChoices", id)
    if (!x)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Option choice not found")
    return x
}
async function validateAndReorderCategories(
    ctx: MutationCtx,
    restaurantId: Id<"restaurants">,
    ids: Id<"menuCategories">[]
) {
    if (new Set(ids).size !== ids.length)
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Duplicate IDs")
    const fetched = await ctx.db
        .query("menuCategories")
        .withIndex("by_restaurant_id_and_sort_order", (q) =>
            q.eq("restaurantId", restaurantId)
        )
        .filter((q) => q.eq(q.field("archived"), false))
        .take(MAX_LIST + 1)
    if (fetched.length > MAX_LIST)
        throw expectedError(
            ERROR_CODES.CONFLICT,
            "Category reorder limit exceeded"
        )
    const expected = new Set(fetched.map((x) => x._id))
    if (ids.length !== expected.size || ids.some((id) => !expected.has(id)))
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Category IDs must be an exact permutation"
        )
    const now = Date.now()
    for (let i = 0; i < ids.length; i++)
        await ctx.db.patch(ids[i]!, { sortOrder: i, updatedAt: now })
}
async function validateAndReorderItems(
    ctx: MutationCtx,
    restaurantId: Id<"restaurants">,
    categoryId: Id<"menuCategories">,
    ids: Id<"menuItems">[]
) {
    if (new Set(ids).size !== ids.length)
        throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Duplicate IDs")
    const fetched = await ctx.db
        .query("menuItems")
        .withIndex("by_restaurant_id_and_category_id_and_sort_order", (q) =>
            q.eq("restaurantId", restaurantId).eq("categoryId", categoryId)
        )
        .filter((q) => q.eq(q.field("archived"), false))
        .take(MAX_LIST + 1)
    if (fetched.length > MAX_LIST)
        throw expectedError(ERROR_CODES.CONFLICT, "Item reorder limit exceeded")
    const expected = new Set(fetched.map((x) => x._id))
    if (ids.length !== expected.size || ids.some((id) => !expected.has(id)))
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Item IDs must be an exact permutation"
        )
    const now = Date.now()
    for (let i = 0; i < ids.length; i++)
        await ctx.db.patch(ids[i]!, { sortOrder: i, updatedAt: now })
}

export const listCategories = protectedQuery({
    args: {
        restaurantId: v.id("restaurants"),
        includeArchived: v.optional(v.boolean()),
    },
    returns: v.array(category),
    handler: async (ctx, a) => {
        const m = await requireActiveMembership(ctx, a.restaurantId)
        if (a.includeArchived && m.role !== "owner")
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        const rows = await ctx.db
            .query("menuCategories")
            .withIndex("by_restaurant_id_and_sort_order", (q) =>
                q.eq("restaurantId", a.restaurantId)
            )
            .take(MAX_LIST)
        return a.includeArchived ? rows : rows.filter((x) => !x.archived)
    },
})
export const createCategory = protectedMutation({
    args: {
        restaurantId: v.id("restaurants"),
        name: v.string(),
        sortOrder: v.optional(v.number()),
    },
    returns: v.id("menuCategories"),
    handler: async (ctx, a) => {
        await owner(ctx, a.restaurantId)
        const now = Date.now()
        return await ctx.db.insert("menuCategories", {
            restaurantId: a.restaurantId,
            name: text(a.name),
            sortOrder: order(a.sortOrder),
            archived: false,
            createdAt: now,
            updatedAt: now,
        })
    },
})
export const updateCategory = protectedMutation({
    args: {
        categoryId: v.id("menuCategories"),
        name: v.optional(v.string()),
        sortOrder: v.optional(v.number()),
    },
    returns: category,
    handler: async (ctx, a) => {
        const x = await getCategory(ctx, a.categoryId)
        await owner(ctx, x.restaurantId)
        await ctx.db.patch(a.categoryId, {
            ...(a.name === undefined ? {} : { name: text(a.name) }),
            ...(a.sortOrder === undefined
                ? {}
                : { sortOrder: order(a.sortOrder) }),
            updatedAt: Date.now(),
        })
        return await getCategory(ctx, a.categoryId)
    },
})
async function setCategoryArchived(
    ctx: MutationCtx,
    id: Id<"menuCategories">,
    archived: boolean
) {
    const x = await getCategory(ctx, id)
    await owner(ctx, x.restaurantId)
    await ctx.db.patch(id, { archived, updatedAt: Date.now() })
    return getCategory(ctx, id)
}
export const archiveCategory = protectedMutation({
    args: { categoryId: v.id("menuCategories") },
    returns: category,
    handler: (ctx, a) => setCategoryArchived(ctx, a.categoryId, true),
})
export const restoreCategory = protectedMutation({
    args: { categoryId: v.id("menuCategories") },
    returns: category,
    handler: (ctx, a) => setCategoryArchived(ctx, a.categoryId, false),
})
export const reorderCategories = protectedMutation({
    args: {
        restaurantId: v.id("restaurants"),
        orderedCategoryIds: v.array(v.id("menuCategories")),
    },
    returns: v.null(),
    handler: async (ctx, a) => {
        await owner(ctx, a.restaurantId)
        await validateAndReorderCategories(
            ctx,
            a.restaurantId,
            a.orderedCategoryIds
        )
        return null
    },
})

export const listItems = protectedQuery({
    args: {
        restaurantId: v.id("restaurants"),
        categoryId: v.optional(v.id("menuCategories")),
        includeArchived: v.optional(v.boolean()),
    },
    returns: v.array(item),
    handler: async (ctx, a) => {
        const m = await requireActiveMembership(ctx, a.restaurantId)
        if (a.includeArchived && m.role !== "owner")
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        let requestedCategory: Doc<"menuCategories"> | undefined
        if (a.categoryId) {
            const c = await getCategory(ctx, a.categoryId)
            if (c.restaurantId !== a.restaurantId)
                throw expectedError(ERROR_CODES.NOT_FOUND, "Category not found")
            requestedCategory = c
        }
        const categories = requestedCategory
            ? [requestedCategory]
            : await ctx.db
                  .query("menuCategories")
                  .withIndex("by_restaurant_id_and_sort_order", (q) =>
                      q.eq("restaurantId", a.restaurantId)
                  )
                  .take(MAX_LIST)
        const visibleCategories = a.includeArchived
            ? categories
            : categories.filter((c) => !c.archived)
        const rows = await visibleCategories.reduce(
            async (promise, c) => {
                const accumulated = await promise
                if (accumulated.length >= MAX_LIST) return accumulated
                const next = await ctx.db
                    .query("menuItems")
                    .withIndex(
                        "by_restaurant_id_and_category_id_and_sort_order",
                        (q) =>
                            q
                                .eq("restaurantId", a.restaurantId)
                                .eq("categoryId", c._id)
                    )
                    .take(MAX_LIST - accumulated.length)
                return [...accumulated, ...next]
            },
            Promise.resolve([] as Doc<"menuItems">[])
        )
        return a.includeArchived ? rows : rows.filter((x) => !x.archived)
    },
})
export const createItem = protectedMutation({
    args: {
        restaurantId: v.id("restaurants"),
        categoryId: v.id("menuCategories"),
        name: v.string(),
        description: v.optional(v.string()),
        priceMinor: v.number(),
        available: v.optional(v.boolean()),
        sortOrder: v.optional(v.number()),
    },
    returns: v.id("menuItems"),
    handler: async (ctx, a) => {
        await owner(ctx, a.restaurantId)
        const c = await getCategory(ctx, a.categoryId)
        if (c.restaurantId !== a.restaurantId)
            throw expectedError(ERROR_CODES.NOT_FOUND, "Category not found")
        if (c.archived)
            throw expectedError(ERROR_CODES.CONFLICT, "Category is archived")
        const now = Date.now()
        return ctx.db.insert("menuItems", {
            restaurantId: a.restaurantId,
            categoryId: a.categoryId,
            name: text(a.name),
            description: description(a.description),
            priceMinor: price(a.priceMinor),
            available: a.available ?? true,
            archived: false,
            sortOrder: order(a.sortOrder),
            createdAt: now,
            updatedAt: now,
        })
    },
})
export const updateItem = protectedMutation({
    args: {
        itemId: v.id("menuItems"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        priceMinor: v.optional(v.number()),
        categoryId: v.optional(v.id("menuCategories")),
        sortOrder: v.optional(v.number()),
        imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    },
    returns: item,
    handler: async (ctx, a) => {
        const x = await getItem(ctx, a.itemId)
        await owner(ctx, x.restaurantId)
        if (a.categoryId) {
            const c = await getCategory(ctx, a.categoryId)
            if (c.restaurantId !== x.restaurantId)
                throw expectedError(ERROR_CODES.NOT_FOUND, "Category not found")
            if (c.archived)
                throw expectedError(
                    ERROR_CODES.CONFLICT,
                    "Category is archived"
                )
        }
        const p: Partial<
            Pick<
                Doc<"menuItems">,
                | "name"
                | "description"
                | "priceMinor"
                | "categoryId"
                | "sortOrder"
                | "imageStorageId"
                | "updatedAt"
            >
        > = { updatedAt: Date.now() }
        if (a.name !== undefined) p.name = text(a.name)
        if (a.description !== undefined)
            p.description = description(a.description)
        if (a.priceMinor !== undefined) p.priceMinor = price(a.priceMinor)
        if (a.categoryId !== undefined) p.categoryId = a.categoryId
        if (a.sortOrder !== undefined) p.sortOrder = order(a.sortOrder)
        if (a.imageStorageId !== undefined)
            if (a.imageStorageId !== null) {
                const ownership = await ctx.db
                    .query("storageUploads")
                    .withIndex("by_storage_id", (q) =>
                        q.eq("storageId", a.imageStorageId!)
                    )
                    .unique()
                if (
                    !ownership ||
                    ownership.restaurantId !== x.restaurantId ||
                    ownership.itemId !== a.itemId
                )
                    throw expectedError(
                        ERROR_CODES.FORBIDDEN,
                        "Image storage is not owned by this restaurant"
                    )
                p.imageStorageId = a.imageStorageId
            } else {
                if (x.imageStorageId)
                    await removeOwnedStorage(
                        ctx,
                        x.restaurantId,
                        x.imageStorageId
                    )
                p.imageStorageId = undefined
            }
        await ctx.db.patch(a.itemId, p)
        return getItem(ctx, a.itemId)
    },
})
async function setItemArchived(
    ctx: MutationCtx,
    id: Id<"menuItems">,
    archived: boolean
) {
    const x = await getItem(ctx, id)
    await owner(ctx, x.restaurantId)
    await ctx.db.patch(id, { archived, updatedAt: Date.now() })
    return getItem(ctx, id)
}
export const archiveItem = protectedMutation({
    args: { itemId: v.id("menuItems") },
    returns: item,
    handler: (ctx, a) => setItemArchived(ctx, a.itemId, true),
})
export const restoreItem = protectedMutation({
    args: { itemId: v.id("menuItems") },
    returns: item,
    handler: (ctx, a) => setItemArchived(ctx, a.itemId, false),
})
export const setAvailability = protectedMutation({
    args: { itemId: v.id("menuItems"), available: v.boolean() },
    returns: item,
    handler: async (ctx, a) => {
        const x = await getItem(ctx, a.itemId)
        await owner(ctx, x.restaurantId)
        await ctx.db.patch(a.itemId, {
            available: a.available,
            updatedAt: Date.now(),
        })
        return getItem(ctx, a.itemId)
    },
})
export const reorderItems = protectedMutation({
    args: {
        restaurantId: v.id("restaurants"),
        categoryId: v.id("menuCategories"),
        orderedItemIds: v.array(v.id("menuItems")),
    },
    returns: v.null(),
    handler: async (ctx, a) => {
        await owner(ctx, a.restaurantId)
        const c = await getCategory(ctx, a.categoryId)
        if (c.restaurantId !== a.restaurantId)
            throw expectedError(ERROR_CODES.NOT_FOUND, "Category not found")
        await validateAndReorderItems(
            ctx,
            a.restaurantId,
            a.categoryId,
            a.orderedItemIds
        )
        return null
    },
})

function validateOptions(
    mode: "single" | "multiple",
    min: number,
    max: number,
    required: boolean
) {
    integer(min, "Minimum selections", 0, 100)
    integer(max, "Maximum selections", 1, 100)
    if (min > max || (required && min < 1) || (mode === "single" && max !== 1))
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Selection limits are invalid"
        )
}
async function assertItemOwner(ctx: DbCtx, id: Id<"menuItems">) {
    const x = await getItem(ctx, id)
    await owner(ctx, x.restaurantId)
    return x
}
async function assertGroupOwner(ctx: DbCtx, id: Id<"menuOptionGroups">) {
    const x = await getGroup(ctx, id)
    const i = await assertItemOwner(ctx, x.menuItemId)
    if (x.restaurantId !== i.restaurantId)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Option group not found")
    return { x, i }
}
export const listOptionGroups = protectedQuery({
    args: {
        itemId: v.id("menuItems"),
        includeArchived: v.optional(v.boolean()),
    },
    returns: v.array(group),
    handler: async (ctx, a) => {
        const i = await getItem(ctx, a.itemId)
        const m = await requireActiveMembership(ctx, i.restaurantId)
        if (a.includeArchived && m.role !== "owner")
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        const rows = await ctx.db
            .query("menuOptionGroups")
            .withIndex("by_menu_item_id_and_sort_order", (q) =>
                q.eq("menuItemId", a.itemId)
            )
            .take(MAX_LIST)
        if (rows.some((x) => x.restaurantId !== i.restaurantId))
            throw expectedError(ERROR_CODES.NOT_FOUND, "Option group not found")
        return a.includeArchived ? rows : rows.filter((x) => !x.archived)
    },
})
export const createOptionGroup = protectedMutation({
    args: {
        itemId: v.id("menuItems"),
        name: v.string(),
        selectionMode: v.union(v.literal("single"), v.literal("multiple")),
        required: v.boolean(),
        minSelections: v.number(),
        maxSelections: v.number(),
        sortOrder: v.optional(v.number()),
    },
    returns: v.id("menuOptionGroups"),
    handler: async (ctx, a) => {
        const i = await assertItemOwner(ctx, a.itemId)
        validateOptions(
            a.selectionMode,
            a.minSelections,
            a.maxSelections,
            a.required
        )
        const existing = await ctx.db
            .query("menuOptionGroups")
            .withIndex("by_menu_item_id_and_sort_order", (q) =>
                q.eq("menuItemId", a.itemId)
            )
            .take(51)
        if (existing.length >= 50)
            throw expectedError(ERROR_CODES.CONFLICT, "Too many option groups")
        const now = Date.now()
        return ctx.db.insert("menuOptionGroups", {
            restaurantId: i.restaurantId,
            menuItemId: a.itemId,
            name: text(a.name),
            selectionMode: a.selectionMode,
            required: a.required,
            minSelections: a.minSelections,
            maxSelections: a.maxSelections,
            sortOrder: order(a.sortOrder),
            archived: false,
            createdAt: now,
            updatedAt: now,
        })
    },
})
export const updateOptionGroup = protectedMutation({
    args: {
        optionGroupId: v.id("menuOptionGroups"),
        name: v.optional(v.string()),
        selectionMode: v.optional(
            v.union(v.literal("single"), v.literal("multiple"))
        ),
        required: v.optional(v.boolean()),
        minSelections: v.optional(v.number()),
        maxSelections: v.optional(v.number()),
        sortOrder: v.optional(v.number()),
    },
    returns: group,
    handler: async (ctx, a) => {
        const { x } = await assertGroupOwner(ctx, a.optionGroupId)
        const mode = a.selectionMode ?? x.selectionMode
        const min = a.minSelections ?? x.minSelections
        const max = a.maxSelections ?? x.maxSelections
        const required = a.required ?? x.required
        validateOptions(mode, min, max, required)
        await ctx.db.patch(a.optionGroupId, {
            ...(a.name === undefined ? {} : { name: text(a.name) }),
            selectionMode: mode,
            required,
            minSelections: min,
            maxSelections: max,
            ...(a.sortOrder === undefined
                ? {}
                : { sortOrder: order(a.sortOrder) }),
            updatedAt: Date.now(),
        })
        return getGroup(ctx, a.optionGroupId)
    },
})
async function setGroupArchived(
    ctx: MutationCtx,
    id: Id<"menuOptionGroups">,
    archived: boolean
) {
    const { x } = await assertGroupOwner(ctx, id)
    await ctx.db.patch(x._id, { archived, updatedAt: Date.now() })
    return getGroup(ctx, id)
}
export const archiveOptionGroup = protectedMutation({
    args: { optionGroupId: v.id("menuOptionGroups") },
    returns: group,
    handler: (ctx, a) => setGroupArchived(ctx, a.optionGroupId, true),
})
export const restoreOptionGroup = protectedMutation({
    args: { optionGroupId: v.id("menuOptionGroups") },
    returns: group,
    handler: (ctx, a) => setGroupArchived(ctx, a.optionGroupId, false),
})
export const listOptionChoices = protectedQuery({
    args: {
        optionGroupId: v.id("menuOptionGroups"),
        includeArchived: v.optional(v.boolean()),
    },
    returns: v.array(choice),
    handler: async (ctx, a) => {
        const { x } = await assertGroupRead(ctx, a.optionGroupId)
        const m = await requireActiveMembership(ctx, x.restaurantId)
        if (a.includeArchived && m.role !== "owner")
            throw expectedError(ERROR_CODES.FORBIDDEN, "Owner access required")
        const rows = await ctx.db
            .query("menuOptionChoices")
            .withIndex("by_option_group_id_and_sort_order", (q) =>
                q.eq("optionGroupId", a.optionGroupId)
            )
            .take(MAX_LIST)
        if (rows.some((choice) => choice.restaurantId !== x.restaurantId))
            throw expectedError(
                ERROR_CODES.NOT_FOUND,
                "Option choice not found"
            )
        return a.includeArchived ? rows : rows.filter((x) => !x.archived)
    },
})
async function assertGroupRead(ctx: DbCtx, id: Id<"menuOptionGroups">) {
    const x = await getGroup(ctx, id)
    const i = await getItem(ctx, x.menuItemId)
    if (i.restaurantId !== x.restaurantId)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Option group not found")
    await member(ctx, x.restaurantId)
    return { x, i }
}
export const createOptionChoice = protectedMutation({
    args: {
        optionGroupId: v.id("menuOptionGroups"),
        name: v.string(),
        priceDeltaMinor: v.number(),
        sortOrder: v.optional(v.number()),
    },
    returns: v.id("menuOptionChoices"),
    handler: async (ctx, a) => {
        const { x } = await assertGroupOwner(ctx, a.optionGroupId)
        const existing = await ctx.db
            .query("menuOptionChoices")
            .withIndex("by_option_group_id_and_sort_order", (q) =>
                q.eq("optionGroupId", a.optionGroupId)
            )
            .take(101)
        if (existing.length >= 100)
            throw expectedError(ERROR_CODES.CONFLICT, "Too many option choices")
        const now = Date.now()
        return ctx.db.insert("menuOptionChoices", {
            restaurantId: x.restaurantId,
            optionGroupId: a.optionGroupId,
            name: text(a.name),
            priceDeltaMinor: delta(a.priceDeltaMinor),
            sortOrder: order(a.sortOrder),
            archived: false,
            createdAt: now,
            updatedAt: now,
        })
    },
})
export const updateOptionChoice = protectedMutation({
    args: {
        optionChoiceId: v.id("menuOptionChoices"),
        name: v.optional(v.string()),
        priceDeltaMinor: v.optional(v.number()),
        sortOrder: v.optional(v.number()),
    },
    returns: choice,
    handler: async (ctx, a) => {
        const x = await getChoice(ctx, a.optionChoiceId)
        const { x: g } = await assertGroupOwner(ctx, x.optionGroupId)
        if (x.restaurantId !== g.restaurantId)
            throw expectedError(
                ERROR_CODES.NOT_FOUND,
                "Option choice not found"
            )
        await ctx.db.patch(a.optionChoiceId, {
            ...(a.name === undefined ? {} : { name: text(a.name) }),
            ...(a.priceDeltaMinor === undefined
                ? {}
                : { priceDeltaMinor: delta(a.priceDeltaMinor) }),
            ...(a.sortOrder === undefined
                ? {}
                : { sortOrder: order(a.sortOrder) }),
            updatedAt: Date.now(),
        })
        return getChoice(ctx, a.optionChoiceId)
    },
})
async function setChoiceArchived(
    ctx: MutationCtx,
    id: Id<"menuOptionChoices">,
    archived: boolean
) {
    const x = await getChoice(ctx, id)
    const { x: g } = await assertGroupOwner(ctx, x.optionGroupId)
    if (x.restaurantId !== g.restaurantId)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Option choice not found")
    await ctx.db.patch(id, { archived, updatedAt: Date.now() })
    return getChoice(ctx, id)
}
export const archiveOptionChoice = protectedMutation({
    args: { optionChoiceId: v.id("menuOptionChoices") },
    returns: choice,
    handler: (ctx, a) => setChoiceArchived(ctx, a.optionChoiceId, true),
})
export const restoreOptionChoice = protectedMutation({
    args: { optionChoiceId: v.id("menuOptionChoices") },
    returns: choice,
    handler: (ctx, a) => setChoiceArchived(ctx, a.optionChoiceId, false),
})

export const generateImageUploadUrl = protectedMutation({
    args: { itemId: v.id("menuItems") },
    returns: v.object({
        url: v.string(),
        capability: v.id("pendingStorageUploads"),
    }),
    handler: async (ctx, a) => {
        const itemRow = await getItem(ctx, a.itemId)
        await owner(ctx, itemRow.restaurantId)
        const identity = await requireIdentity(ctx)
        const pending = await ctx.db.insert("pendingStorageUploads", {
            restaurantId: itemRow.restaurantId,
            uploadedByTokenIdentifier: identity.tokenIdentifier,
            itemId: a.itemId,
            expiresAt: Date.now() + 15 * 60 * 1000,
            createdAt: Date.now(),
        })
        return {
            url: await ctx.storage.generateUploadUrl(),
            capability: pending,
        }
    },
})
export const bindImageUpload = protectedMutation({
    args: {
        itemId: v.id("menuItems"),
        capability: v.id("pendingStorageUploads"),
        storageId: v.id("_storage"),
    },
    returns: v.null(),
    handler: async (ctx, a) => {
        const itemRow = await getItem(ctx, a.itemId)
        await owner(ctx, itemRow.restaurantId)
        const identity = await requireIdentity(ctx)
        const pending = await ctx.db.get(a.capability)
        if (
            !pending ||
            pending.restaurantId !== itemRow.restaurantId ||
            pending.itemId !== a.itemId ||
            pending.uploadedByTokenIdentifier !== identity.tokenIdentifier ||
            pending.expiresAt < Date.now()
        ) {
            throw expectedError(
                ERROR_CODES.FORBIDDEN,
                "Upload is not authorized"
            )
        }
        if (pending.storageId)
            throw expectedError(ERROR_CODES.CONFLICT, "Upload is already bound")
        const storageUrl = await ctx.storage.getUrl(a.storageId)
        if (!storageUrl)
            throw expectedError(
                ERROR_CODES.NOT_FOUND,
                "Uploaded image not found"
            )
        const existing = await ctx.db
            .query("storageUploads")
            .withIndex("by_storage_id", (q) => q.eq("storageId", a.storageId))
            .unique()
        if (existing)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Image is already attached"
            )
        const referenced = await ctx.db
            .query("menuItems")
            .withIndex("by_image_storage_id", (q) =>
                q.eq("imageStorageId", a.storageId)
            )
            .take(2)
        if (referenced.length > 0)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Image is already attached"
            )
        await ctx.db.patch(a.capability, { storageId: a.storageId })
        return null
    },
})
export const attachImage = protectedMutation({
    args: {
        itemId: v.id("menuItems"),
        storageId: v.id("_storage"),
        capability: v.id("pendingStorageUploads"),
    },
    returns: item,
    handler: async (ctx, a) => {
        const itemRow = await getItem(ctx, a.itemId)
        await owner(ctx, itemRow.restaurantId)
        const identity = await requireIdentity(ctx)
        const pending = await ctx.db.get(a.capability)
        if (
            !pending ||
            pending.restaurantId !== itemRow.restaurantId ||
            pending.itemId !== a.itemId ||
            pending.uploadedByTokenIdentifier !== identity.tokenIdentifier ||
            pending.expiresAt < Date.now() ||
            pending.storageId !== a.storageId
        ) {
            throw expectedError(
                ERROR_CODES.FORBIDDEN,
                "Upload is not authorized"
            )
        }
        // Convex does not expose upload-token provenance for a blob. The
        // one-time token, owner, tenant, existence, and indexed ownership
        // checks below are the strongest available invariant.
        const storageUrl = await ctx.storage.getUrl(a.storageId)
        if (!storageUrl)
            throw expectedError(
                ERROR_CODES.NOT_FOUND,
                "Uploaded image not found"
            )
        const existing = await ctx.db
            .query("storageUploads")
            .withIndex("by_storage_id", (q) => q.eq("storageId", a.storageId))
            .unique()
        if (existing)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Image is already attached"
            )
        const referenced = await ctx.db
            .query("menuItems")
            .withIndex("by_image_storage_id", (q) =>
                q.eq("imageStorageId", a.storageId)
            )
            .take(2)
        if (referenced.length > 0)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Image is already attached"
            )
        if (itemRow.imageStorageId)
            await removeOwnedStorage(
                ctx,
                itemRow.restaurantId,
                itemRow.imageStorageId
            )
        await ctx.db.insert("storageUploads", {
            storageId: a.storageId,
            restaurantId: itemRow.restaurantId,
            uploadedByTokenIdentifier: identity.tokenIdentifier,
            itemId: a.itemId,
            createdAt: Date.now(),
        })
        await ctx.db.delete("pendingStorageUploads", pending._id)
        await ctx.db.patch(a.itemId, {
            imageStorageId: a.storageId,
            updatedAt: Date.now(),
        })
        return getItem(ctx, a.itemId)
    },
})
async function removeOwnedStorage(
    ctx: MutationCtx,
    restaurantId: Id<"restaurants">,
    storageId: Id<"_storage">
) {
    const ownership = await ctx.db
        .query("storageUploads")
        .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
        .unique()
    if (ownership?.restaurantId !== restaurantId) return
    await ctx.db.delete("storageUploads", ownership._id)
    await ctx.storage.delete(storageId)
}
export const removeImage = protectedMutation({
    args: { itemId: v.id("menuItems") },
    returns: item,
    handler: async (ctx, a) => {
        const row = await getItem(ctx, a.itemId)
        await owner(ctx, row.restaurantId)
        if (row.imageStorageId)
            await removeOwnedStorage(ctx, row.restaurantId, row.imageStorageId)
        await ctx.db.patch(a.itemId, {
            imageStorageId: undefined,
            updatedAt: Date.now(),
        })
        return getItem(ctx, a.itemId)
    },
})
export const resolveImageUrl = protectedQuery({
    args: { itemId: v.id("menuItems") },
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, a) => {
        const row = await getItem(ctx, a.itemId)
        await member(ctx, row.restaurantId)
        if (!row.imageStorageId) return null
        const ownership = await ctx.db
            .query("storageUploads")
            .withIndex("by_storage_id", (q) =>
                q.eq("storageId", row.imageStorageId!)
            )
            .unique()
        if (
            !ownership ||
            ownership.restaurantId !== row.restaurantId ||
            ownership.itemId !== a.itemId
        )
            return null
        return ctx.storage.getUrl(row.imageStorageId)
    },
})

export const cleanupStorage = internalMutation({
    args: { limit: v.number() },
    returns: v.object({ storageDeleted: v.number() }),
    handler: async (ctx, a) => {
        const now = Date.now()
        const limit = Math.min(Math.max(a.limit, 0), 100)
        const pending = await ctx.db
            .query("pendingStorageUploads")
            .withIndex("by_expires_at", (q) => q.lte("expiresAt", now))
            .take(limit)
        for (const row of pending) {
            if (row.storageId) {
                const ownership = await ctx.db
                    .query("storageUploads")
                    .withIndex("by_storage_id", (q) =>
                        q.eq("storageId", row.storageId!)
                    )
                    .unique()
                if (ownership) await ctx.db.delete(ownership._id)
                if (await ctx.storage.getUrl(row.storageId))
                    await ctx.storage.delete(row.storageId)
            }
            await ctx.db.delete(row._id)
        }
        const owned = await ctx.db
            .query("storageUploads")
            .withIndex("by_restaurant_id", (q) => q)
            .take(limit)
        let storageDeleted = 0
        for (const row of owned) {
            const item = await ctx.db.get("menuItems", row.itemId)
            if (
                !item ||
                item.restaurantId !== row.restaurantId ||
                item.imageStorageId !== row.storageId
            ) {
                await ctx.db.delete(row._id)
                await ctx.storage.delete(row.storageId)
                storageDeleted++
            }
        }
        return { storageDeleted }
    },
})
