import type { QueryCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { expectedError, ERROR_CODES } from "../lib/errors"

export function validateDateRange(from: string, to: string) {
    const valid = (value: string) => /^\d{8}$/.test(value) && (() => {
        const year = Number(value.slice(0, 4)), month = Number(value.slice(4, 6)), day = Number(value.slice(6, 8))
        const date = new Date(Date.UTC(year, month - 1, day))
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    })()
    if (!valid(from) || !valid(to) || from > to) throw new Error("VALIDATION_FAILED")
    const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(4, 6)) - 1, Number(from.slice(6, 8)))
    const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(4, 6)) - 1, Number(to.slice(6, 8)))
    if ((end - start) / 86400000 + 1 > 366) throw new Error("VALIDATION_FAILED")
}

export async function summaries(ctx: QueryCtx, restaurantId: Id<"restaurants">, from: string, to: string) {
    const rows = await ctx.db.query("salesSummaryDaily").withIndex("by_restaurant_business_date", (q) => q.eq("restaurantId", restaurantId).gte("businessDate", from).lte("businessDate", to)).take(2001)
    if (rows.length > 2000) throw expectedError(ERROR_CODES.CONFLICT, "Summary row limit exceeded")
    return rows.filter((row) => row.paidOrderCount > 0)
}

export async function summaryItems(ctx: QueryCtx, summaryId: Id<"salesSummaryDaily">) {
    const rows = await ctx.db.query("salesSummaryItems").withIndex("by_summary_id", (q) => q.eq("summaryId", summaryId)).take(1001)
    if (rows.length > 1000) throw expectedError(ERROR_CODES.CONFLICT, "Summary item limit exceeded")
    return rows
}
