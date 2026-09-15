import type { DatabaseCtx } from "./identity"
import type { Id } from "../_generated/dataModel"
import { expectedError, ERROR_CODES } from "../lib/errors"

export const MAX_LIST = 200
export function text(value: string, label = "Name") {
    const result = value.trim()
    if (!result || result.length > 120)
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            `${label} is invalid`
        )
    return result
}
export function description(value: string | undefined) {
    if (value !== undefined && value.length > 1000)
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Description is too long"
        )
    return value
}
export function integer(
    value: number,
    label: string,
    min?: number,
    max?: number
) {
    if (
        !Number.isSafeInteger(value) ||
        (min !== undefined && value < min) ||
        (max !== undefined && value > max)
    )
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            `${label} is invalid`
        )
    return value
}
export function price(value: number) {
    return integer(value, "Price", 0)
}
export function delta(value: number) {
    return integer(value, "Price delta", -1_000_000_000, 1_000_000_000)
}
export function order(value: number | undefined) {
    return integer(value ?? 0, "Sort order", 0, 1_000_000)
}

export async function assertOrderableItem(
    ctx: DatabaseCtx,
    itemId: Id<"menuItems">
) {
    const item = await ctx.db.get("menuItems", itemId)
    if (!item) throw expectedError(ERROR_CODES.NOT_FOUND, "Menu item not found")
    if (item.archived || !item.available)
        throw expectedError(ERROR_CODES.CONFLICT, "Menu item is not orderable")
    const category = await ctx.db.get("menuCategories", item.categoryId)
    if (!category || category.restaurantId !== item.restaurantId)
        throw expectedError(ERROR_CODES.NOT_FOUND, "Menu item not found")
    if (category.archived)
        throw expectedError(ERROR_CODES.CONFLICT, "Menu category is archived")
    const groups = await ctx.db
        .query("menuOptionGroups")
        .withIndex("by_menu_item_id_and_sort_order", (q) =>
            q.eq("menuItemId", itemId)
        )
        .take(51)
    if (groups.length > 50)
        throw expectedError(ERROR_CODES.CONFLICT, "Too many option groups")
    for (const group of groups) {
        if (group.restaurantId !== item.restaurantId)
            throw expectedError(ERROR_CODES.NOT_FOUND, "Menu item not found")
        if (group.archived)
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Option group is archived"
            )
        const choices = await ctx.db
            .query("menuOptionChoices")
            .withIndex("by_option_group_id_and_sort_order", (q) =>
                q.eq("optionGroupId", group._id)
            )
            .take(101)
        if (choices.some((choice) => choice.restaurantId !== item.restaurantId))
            throw expectedError(ERROR_CODES.NOT_FOUND, "Menu item not found")
        if (choices.length > 100 || choices.some((choice) => choice.archived))
            throw expectedError(
                ERROR_CODES.CONFLICT,
                "Option choice is archived"
            )
    }
    return item
}
