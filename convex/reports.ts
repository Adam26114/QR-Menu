import { v } from "convex/values"
import { protectedQuery } from "./lib/customFunctions"
import { expectedError, ERROR_CODES } from "./lib/errors"
import { requireActiveMembership } from "./model/identity"
import { summaries, summaryItems, validateDateRange } from "./model/reports"

const dates = { fromBusinessDate: v.string(), toBusinessDate: v.string() }
const paymentBreakdown = v.object({ cashMinor: v.number(), cardMinor: v.number(), digitalMinor: v.number(), otherMinor: v.number() })
const summaryResult = v.object({ fromBusinessDate: v.string(), toBusinessDate: v.string(), groups: v.array(v.object({ currency: v.string(), timezone: v.string(), orderCount: v.number(), subtotalMinor: v.number(), taxMinor: v.number(), serviceChargeMinor: v.number(), totalMinor: v.number(), averageOrderValueMinor: v.number(), paymentBreakdown, days: v.array(v.object({ businessDate: v.string(), orderCount: v.number(), totalMinor: v.number() })) })) })

function validate(from: string, to: string) {
    try { validateDateRange(from, to) } catch { throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Business date range is invalid") }
}

export const getSummary = protectedQuery({
    args: { restaurantId: v.id("restaurants"), ...dates }, returns: summaryResult,
    handler: async (ctx, args) => {
        await requireActiveMembership(ctx, args.restaurantId, "owner")
        validate(args.fromBusinessDate, args.toBusinessDate)
        const rows = await summaries(ctx, args.restaurantId, args.fromBusinessDate, args.toBusinessDate)
        const grouped = new Map<string, { currency: string; timezone: string; orderCount: number; subtotalMinor: number; taxMinor: number; serviceChargeMinor: number; totalMinor: number; cashMinor: number; cardMinor: number; digitalMinor: number; otherMinor: number; days: { businessDate: string; orderCount: number; totalMinor: number }[] }>()
        for (const row of rows) {
            const key = `${row.currency}\0${row.timezone}`
            const group = grouped.get(key) ?? { currency: row.currency, timezone: row.timezone, orderCount: 0, subtotalMinor: 0, taxMinor: 0, serviceChargeMinor: 0, totalMinor: 0, cashMinor: 0, cardMinor: 0, digitalMinor: 0, otherMinor: 0, days: [] }
            group.orderCount += row.paidOrderCount; group.subtotalMinor += row.subtotalMinor; group.taxMinor += row.taxMinor; group.serviceChargeMinor += row.serviceChargeMinor; group.totalMinor += row.totalMinor
            group.cashMinor += row.cashMinor; group.cardMinor += row.cardMinor; group.digitalMinor += row.digitalMinor; group.otherMinor += row.otherMinor
            group.days.push({ businessDate: row.businessDate, orderCount: row.paidOrderCount, totalMinor: row.totalMinor }); grouped.set(key, group)
        }
        return { fromBusinessDate: args.fromBusinessDate, toBusinessDate: args.toBusinessDate, groups: [...grouped.values()].map((group) => ({ currency: group.currency, timezone: group.timezone, orderCount: group.orderCount, subtotalMinor: group.subtotalMinor, taxMinor: group.taxMinor, serviceChargeMinor: group.serviceChargeMinor, totalMinor: group.totalMinor, averageOrderValueMinor: group.orderCount ? Math.floor(group.totalMinor / group.orderCount) : 0, paymentBreakdown: { cashMinor: group.cashMinor, cardMinor: group.cardMinor, digitalMinor: group.digitalMinor, otherMinor: group.otherMinor }, days: group.days.sort((a, b) => a.businessDate.localeCompare(b.businessDate)) })) }
    },
})

export const getBestSellingItems = protectedQuery({
    args: { restaurantId: v.id("restaurants"), ...dates, limit: v.optional(v.number()) },
    returns: v.array(v.object({ name: v.string(), currency: v.string(), timezone: v.string(), quantity: v.number(), grossMinor: v.number() })),
    handler: async (ctx, args) => {
        await requireActiveMembership(ctx, args.restaurantId, "owner")
        validate(args.fromBusinessDate, args.toBusinessDate)
        const limit = args.limit ?? 50
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw expectedError(ERROR_CODES.VALIDATION_FAILED, "Limit is invalid")
        const totals = new Map<string, Map<string, { name: string; currency: string; timezone: string; quantity: number; grossMinor: number }>>()
        for (const summary of await summaries(ctx, args.restaurantId, args.fromBusinessDate, args.toBusinessDate)) {
            for (const item of await summaryItems(ctx, summary._id)) {
                if (item.quantity <= 0 || item.grossMinor <= 0) continue
                const groupKey = `${summary.currency}\0${summary.timezone}`
                const group = totals.get(groupKey) ?? new Map<string, { name: string; currency: string; timezone: string; quantity: number; grossMinor: number }>()
                const total = group.get(item.name) ?? { name: item.name, currency: summary.currency, timezone: summary.timezone, quantity: 0, grossMinor: 0 }
                total.quantity += item.quantity; total.grossMinor += item.grossMinor; group.set(item.name, total); totals.set(groupKey, group)
            }
        }
        return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).flatMap(([, group]) => [...group.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, limit))
    },
})
