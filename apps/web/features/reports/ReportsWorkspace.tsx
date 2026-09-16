"use client"

import { useState } from "react"
import type { Doc } from "../../../../convex/_generated/dataModel"
import { api } from "../../../../convex/_generated/api"
import { useQuery } from "convex/react"
import { CalendarDays, CircleAlert, TrendingUp } from "lucide-react"
import { FeatureErrorBoundary } from "@/components/global/FeatureErrorBoundary"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

type Restaurant = Doc<"restaurants">
type Summary = NonNullable<ReturnType<typeof useQuery<typeof api.reports.getSummary>>>
type ReportGroup = Summary["groups"][number]
type BestItem = NonNullable<ReturnType<typeof useQuery<typeof api.reports.getBestSellingItems>>>[number]

function dateValue(date: Date) {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const day = String(date.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function businessDateInTimezone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
    const get = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? ""
    return `${get("year")}-${get("month")}-${get("day")}`
}

function shiftBusinessDate(value: string, days: number) {
    const date = new Date(`${value}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date
}

function businessDate(value: string) {
    return value.replaceAll("-", "")
}

function dateFromBusinessDate(value: string) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function money(minor: number, currency: string) {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100)
    } catch {
        return `${currency} ${(minor / 100).toFixed(2)}`
    }
}

export function ReportsWorkspace({ restaurant }: { restaurant: Restaurant }) {
    return (
        <FeatureErrorBoundary>
            <ReportsContent restaurant={restaurant} />
        </FeatureErrorBoundary>
    )
}

function ReportsContent({ restaurant }: { restaurant: Restaurant }) {
    const timezone = restaurant.timezone ?? "UTC"
    const today = businessDateInTimezone(new Date(), timezone)
    const previousSixDays = dateValue(shiftBusinessDate(today, -6))
    const [fromDate, setFromDate] = useState(previousSixDays)
    const [toDate, setToDate] = useState(today)
    const [appliedRange, setAppliedRange] = useState({ from: businessDate(previousSixDays), to: businessDate(today) })
    const rangeDays = (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000 + 1
    const invalidRange = !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate || rangeDays > 366
    const summary = useQuery(api.reports.getSummary, invalidRange ? "skip" : { restaurantId: restaurant._id, fromBusinessDate: appliedRange.from, toBusinessDate: appliedRange.to })
    const items = useQuery(api.reports.getBestSellingItems, invalidRange ? "skip" : { restaurantId: restaurant._id, fromBusinessDate: appliedRange.from, toBusinessDate: appliedRange.to, limit: 20 })
    const reportGroups = summary?.groups.filter((group) => group.orderCount > 0) ?? []
    const loadedItems = items?.filter((item) => item.quantity > 0) ?? []
    const loading = !invalidRange && (summary === undefined || items === undefined)
    const noSales = reportGroups.length === 0

    function applyRange() {
        if (invalidRange) return
        setAppliedRange({ from: businessDate(fromDate), to: businessDate(toDate) })
    }

    function setPreset(preset: "today" | "month") {
        const now = businessDateInTimezone(new Date(), timezone)
        const from = preset === "today" ? now : dateValue(new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1, 1)))
        setFromDate(from)
        setToDate(now)
        setAppliedRange({ from: businessDate(from), to: businessDate(now) })
    }

    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Sales reports</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant.name}</h1>
                    <p className="mt-1 text-muted-foreground">A clear snapshot of paid sales, by business date.</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                    <span>Inclusive dates</span>
                </div>
            </header>

            <form className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); applyRange() }}>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="reports-from">From date
                        <input id="reports-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium" htmlFor="reports-to">To date
                        <input id="reports-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={invalidRange}>Apply</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPreset("today")}>Today</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPreset("month")}>This month</Button>
                </div>
            </form>
            {invalidRange && <Feedback tone="error">Choose a valid inclusive range where the from date is on or before the to date, and keep it within 366 days.</Feedback>}
            {loading && <LoadingState />}
            {!loading && summary && items && noSales && <Feedback>There are no paid sales in this date range. Try a wider range to see activity.</Feedback>}
            {!loading && reportGroups.map((group) => <GroupReport key={`${group.currency}-${group.timezone}`} group={group} items={loadedItems.filter((item) => item.currency === group.currency && item.timezone === group.timezone)} />)}
        </section>
    )
}

function LoadingState() {
    return <div className="grid gap-4" aria-live="polite" aria-busy="true"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /><span className="sr-only">Loading sales reports</span></div>
}

function Feedback({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "error" }) {
    return <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl border p-5 text-sm ${tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-dashed text-muted-foreground"}`}><div className="flex items-start gap-3">{tone === "error" && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}<p>{children}</p></div></div>
}

function GroupReport({ group, items }: { group: ReportGroup; items: BestItem[] }) {
    const payment = group.paymentBreakdown
    const metrics = [
        ["Paid orders", group.orderCount.toLocaleString()],
        ["Gross sales", money(group.totalMinor, group.currency)],
        ["Average order", money(group.averageOrderValueMinor, group.currency)],
        ["Subtotal", money(group.subtotalMinor, group.currency)],
        ["Tax / service", money(group.taxMinor + group.serviceChargeMinor, group.currency)],
    ]
    return <section className="flex flex-col gap-4" aria-labelledby={`group-${group.currency}-${group.timezone}`}>
        <div className="flex flex-col gap-1 border-l-4 border-primary pl-4"><h2 id={`group-${group.currency}-${group.timezone}`} className="text-xl font-semibold">{group.currency} sales</h2><p className="text-sm text-muted-foreground">Snapshot timezone: <span className="font-medium text-foreground">{group.timezone}</span> · {dateFromBusinessDate(group.days[0]?.businessDate ?? "") || "Selected range"}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([label, value]) => <Card key={label} className="gap-3 py-4"><CardHeader className="px-5"><CardDescription>{label}</CardDescription></CardHeader><CardContent className="px-5"><p className="text-lg font-semibold tabular-nums">{value}</p></CardContent></Card>)}</div>
        <Card><CardHeader><CardTitle className="text-base">Payment mix</CardTitle><CardDescription>Paid sales in {group.currency}; no currencies are combined.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{[["Cash", payment.cashMinor], ["Card", payment.cardMinor], ["Digital", payment.digitalMinor], ["Other", payment.otherMinor]].map(([label, value]) => <div key={label as string}><p className="text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{money(value as number, group.currency)}</p></div>)}</CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card><CardHeader><CardTitle className="text-base">Daily totals</CardTitle><CardDescription>Business dates in {group.timezone}.</CardDescription></CardHeader><CardContent>{group.days.length ? <div className="divide-y">{group.days.map((day) => <div key={day.businessDate} className="flex items-center justify-between gap-4 py-3 text-sm"><time dateTime={dateFromBusinessDate(day.businessDate)} className="text-muted-foreground">{dateFromBusinessDate(day.businessDate)}</time><span className="text-right"><span className="mr-3 text-muted-foreground">{day.orderCount} {day.orderCount === 1 ? "order" : "orders"}</span><strong className="tabular-nums">{money(day.totalMinor, group.currency)}</strong></span></div>)}</div> : <p className="text-sm text-muted-foreground">No daily totals for this range.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-primary" aria-hidden="true" />Best-selling items</CardTitle><CardDescription>Top items by quantity sold.</CardDescription></CardHeader><CardContent>{items.length ? <ul className="divide-y">{items.map((item) => <li key={`${item.currency}-${item.name}`} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate font-medium">{item.name}<span className="ml-2 text-muted-foreground">×{item.quantity}</span></span><span className="shrink-0 tabular-nums">{money(item.grossMinor, item.currency)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No item sales for this range.</p>}</CardContent></Card>
        </div>
    </section>
}
