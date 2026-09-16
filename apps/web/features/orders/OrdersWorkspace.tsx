"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, usePaginatedQuery } from "convex/react"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { api } from "../../../../convex/_generated/api"
import { ConfirmDialog } from "@/components/global/ConfirmDialog"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { toast } from "@workspace/ui/components/sonner"
import { Check, ChevronDown, CircleDollarSign, Clock3, Volume2, X } from "lucide-react"

type Restaurant = Doc<"restaurants">
type Membership = { role: "owner" | "staff"; canMarkPaid: boolean }
type Order = {
    orderId: Id<"orders">
    orderNumber: string
    tableName: string | null
    status: "pending" | "preparing" | "served" | "cancelled"
    paymentStatus: "paid" | "unpaid"
    submittedAt: number
    currency: string
    subtotalMinor: number
    taxMinor: number
    serviceChargeMinor: number
    totalMinor: number
    items: Array<{
        name: string
        quantity: number
        unitPriceMinor: number
        lineTotalMinor: number
        options: Array<{ name: string; priceDeltaMinor: number }>
        notes?: string
    }>
    paidAt?: number
}

const tabs = ["all", "pending", "preparing", "served", "cancelled"] as const
type Tab = (typeof tabs)[number]

function safeError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("owner")) return "Only an owner can do that."
    if (message.includes("paid") && message.includes("cancel")) return "Paid orders cannot be cancelled."
    if (message.includes("permission") || message.includes("forbidden")) return "You do not have permission for that action."
    if (message.includes("transition") || message.includes("conflict")) return "That order changed. Refresh and try again."
    if (message.includes("not found")) return "That order is no longer available."
    return fallback
}

function money(minor: number, currency: string) {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100)
    } catch {
        return `${currency} ${(minor / 100).toFixed(2)}`
    }
}

function relativeTime(value: number) {
    const seconds = Math.round((value - Date.now()) / 1000)
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
    if (Math.abs(seconds) < 60) return formatter.format(seconds, "second")
    const minutes = Math.round(seconds / 60)
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
    return formatter.format(Math.round(minutes / 60), "hour")
}

function idempotencyKey(orderId: string, action: string, keys: Map<string, string>) {
    const key = `${orderId}:${action}`
    const existing = keys.get(key)
    if (existing) return existing
    const created = `${key}:${crypto.randomUUID()}`
    keys.set(key, created)
    return created
}

export function OrdersWorkspace({ restaurant, membership }: { restaurant: Restaurant; membership: Membership }) {
    const [tab, setTab] = useState<Tab>("all")
    const [confirmOrder, setConfirmOrder] = useState<Id<"orders"> | null>(null)
    const [working, setWorking] = useState<string | null>(null)
    const [alertsEnabled, setAlertsEnabled] = useState(false)
    const [pendingAlerts, setPendingAlerts] = useState(0)
    const keys = useRef(new Map<string, string>())
    const alerted = useRef(new Map<string, number>())
    const baseline = useRef(0)
    const originalTitle = useRef<string | null>(null)
    const seen = useRef(new Set<string>())
    const audio = useRef<AudioContext | null>(null)
    const statusMutation = useMutation(api.orders.updateStatus)
    const paymentMutation = useMutation(api.orders.updatePayment)
    const alertFeed = usePaginatedQuery(api.orders.list, { restaurantId: restaurant._id }, { initialNumItems: 12 })
    const displayFeed = usePaginatedQuery(
        api.orders.list,
        { restaurantId: restaurant._id, ...(tab === "all" ? {} : { status: tab }) },
        { initialNumItems: 12 },
    )
    const alertOrders = alertFeed.results as Order[]
    const visible = displayFeed.results as Order[]
    const pendingLoadedCount = alertOrders.filter((order) => order.status === "pending").length

    useEffect(() => {
        if (originalTitle.current === null) originalTitle.current = document.title
        if (!alertsEnabled) return
        if (baseline.current === 0 && alertOrders.length) {
            baseline.current = Math.max(...alertOrders.map((order) => order.submittedAt))
            alertOrders.forEach((order) => seen.current.add(order.orderId))
            return
        }
        let added = 0
        for (const order of alertOrders) {
            const known = seen.current.has(order.orderId)
            seen.current.add(order.orderId)
            if (order.status !== "pending") alerted.current.delete(order.orderId)
            if (!known && order.status === "pending" && order.submittedAt >= baseline.current && !alerted.current.has(order.orderId)) {
                alerted.current.set(order.orderId, Date.now())
                if (alerted.current.size > 500) alerted.current.delete(alerted.current.keys().next().value as string)
                added += 1
                toast(`New order ${order.orderNumber}`, { description: `${order.tableName ?? "No table"} is waiting.` })
                try {
                    if (!audio.current) audio.current = new AudioContext()
                    const context = audio.current
                    const oscillator = context.createOscillator()
                    const gain = context.createGain()
                    oscillator.frequency.value = 660
                    gain.gain.setValueAtTime(0.04, context.currentTime)
                    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12)
                    oscillator.connect(gain).connect(context.destination)
                    oscillator.start()
                    oscillator.stop(context.currentTime + 0.12)
                } catch { /* Audio is optional and may be unavailable. */ }
            }
        }
        if (added || pendingAlerts > alerted.current.size)
            queueMicrotask(() => setPendingAlerts(alerted.current.size))
        if (pendingAlerts > 0) document.title = `(${pendingAlerts}) ${originalTitle.current ?? "Orders"}`
        else document.title = originalTitle.current ?? document.title
    }, [alertsEnabled, alertOrders, pendingAlerts])

    useEffect(() => () => {
        if (originalTitle.current) document.title = originalTitle.current
        audio.current?.close().catch(() => undefined)
    }, [])

    const enableAlerts = () => {
        baseline.current = alertOrders.length ? Math.max(...alertOrders.map((order) => order.submittedAt)) : Date.now()
        alertOrders.forEach((order) => seen.current.add(order.orderId))
        setAlertsEnabled(true)
        toast.success("Order alerts enabled.")
    }

    const runStatus = async (order: Order, status: "preparing" | "served" | "cancelled") => {
        const action = `status-${status}`
        setWorking(`${order.orderId}:${action}`)
        try {
            await statusMutation({ orderId: order.orderId, status, idempotencyKey: idempotencyKey(order.orderId, action, keys.current) })
            toast.success(status === "preparing" ? "Order is being prepared." : status === "served" ? "Order marked served." : "Order cancelled.")
            setConfirmOrder(null)
        } catch (error) { toast.error(safeError(error, "Could not update the order.")) } finally { setWorking(null) }
    }
    const runPayment = async (order: Order, paymentStatus: "paid" | "unpaid") => {
        const action = `payment-${paymentStatus}`
        setWorking(`${order.orderId}:${action}`)
        try {
            await paymentMutation({ orderId: order.orderId, paymentStatus, idempotencyKey: idempotencyKey(order.orderId, action, keys.current) })
            toast.success(paymentStatus === "paid" ? "Order marked paid." : "Order marked unpaid.")
        } catch (error) { toast.error(safeError(error, "Could not update payment.")) } finally { setWorking(null) }
    }

    return <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Live order operations</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant.name}</h1>
                <p className="mt-1 text-muted-foreground">A live queue for the service desk.</p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3 text-right shadow-sm"><p className="text-2xl font-semibold tabular-nums">{pendingLoadedCount}</p><p className="text-xs text-muted-foreground">pending loaded</p></div>
        </header>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Order status filters">{tabs.map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{value} {value === "pending" && <span className="ml-1 tabular-nums">{pendingLoadedCount}</span>}</button>)}</div>
            <Button variant={alertsEnabled ? "secondary" : "outline"} onClick={enableAlerts} disabled={alertsEnabled} aria-describedby="alerts-help"><Volume2 /> {alertsEnabled ? "Alerts enabled" : "Enable alerts"}</Button>
        </div>
        <p id="alerts-help" className="text-xs text-muted-foreground">Sound alerts stay off until you enable them. Existing orders will not trigger an alert.</p>
        {displayFeed.status === "LoadingFirstPage" && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Loading live orders...</p>}
        {displayFeed.status !== "LoadingFirstPage" && visible.length === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No {tab === "all" ? "orders" : tab + " orders"} to show.</p>}
        <div className="grid gap-4 lg:grid-cols-2">{visible.map((order) => <OrderCard key={order.orderId} order={order} membership={membership} working={working} onStatus={runStatus} onPayment={runPayment} onCancel={() => setConfirmOrder(order.orderId)} />)}</div>
        {displayFeed.status === "CanLoadMore" && <Button variant="outline" onClick={() => displayFeed.loadMore(12)}><ChevronDown /> Load more</Button>}
        {displayFeed.status === "LoadingMore" && <p className="text-center text-sm text-muted-foreground">Loading more orders...</p>}
        <ConfirmDialog open={confirmOrder !== null} onOpenChange={(open) => !open && setConfirmOrder(null)} title="Cancel this order?" description="This cannot be undone. Paid orders cannot be cancelled." confirmLabel="Cancel order" cancelLabel="Keep order" pending={working !== null} onConfirm={async () => { const order = visible.find((item) => item.orderId === confirmOrder); if (order) await runStatus(order, "cancelled") }} />
    </section>
}

function OrderCard({ order, membership, working, onStatus, onPayment, onCancel }: { order: Order; membership: Membership; working: string | null; onStatus: (order: Order, status: "preparing" | "served") => Promise<void>; onPayment: (order: Order, status: "paid" | "unpaid") => Promise<void>; onCancel: () => void }) {
    const busy = working?.startsWith(order.orderId) ?? false
    const canUpdatePayment = order.paymentStatus === "paid" ? membership.role === "owner" : membership.canMarkPaid
    return <Card className="overflow-hidden border-border/80"><CardHeader className="gap-3 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-lg">Order {order.orderNumber}</CardTitle><p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted-foreground"><span>{order.tableName ?? "No table"}</span><span aria-hidden="true">·</span><time dateTime={new Date(order.submittedAt).toISOString()} title={new Date(order.submittedAt).toLocaleString()}>{relativeTime(order.submittedAt)}</time></p></div><div className="flex gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold capitalize text-primary">{order.status}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${order.paymentStatus === "paid" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>{order.paymentStatus}</span></div></CardHeader><CardContent className="space-y-4 pt-5"><ul className="space-y-3">{order.items.map((item, index) => <li key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm"><div><span className="font-medium">{item.quantity} × {item.name}</span>{item.options.length > 0 && <p className="text-xs text-muted-foreground">{item.options.map((option) => option.name).join(", ")}</p>}{item.notes && <p className="text-xs text-muted-foreground italic">Note: {item.notes}</p>}</div><span className="shrink-0 tabular-nums">{money(item.lineTotalMinor, order.currency)}</span></li>)}</ul><div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs text-muted-foreground"><span>Subtotal<br /><b className="text-foreground">{money(order.subtotalMinor, order.currency)}</b></span><span>Tax / service<br /><b className="text-foreground">{money(order.taxMinor + order.serviceChargeMinor, order.currency)}</b></span><span className="text-right">Total<br /><b className="text-base text-foreground">{money(order.totalMinor, order.currency)}</b></span></div><div className="flex flex-wrap gap-2"><div className="flex flex-1 flex-wrap gap-2">{order.status === "pending" && <Button size="sm" disabled={busy} onClick={() => onStatus(order, "preparing")}><Clock3 /> Start preparing</Button>}{order.status === "preparing" && <Button size="sm" disabled={busy} onClick={() => onStatus(order, "served")}><Check /> Mark served</Button>}{(order.status === "pending" || order.status === "preparing") && order.paymentStatus === "unpaid" && membership.role === "owner" && <Button size="sm" variant="destructive" disabled={busy} onClick={onCancel}><X /> Cancel</Button>}</div>{order.status !== "cancelled" && canUpdatePayment && <Button size="sm" variant="outline" disabled={busy} onClick={() => onPayment(order, order.paymentStatus === "paid" ? "unpaid" : "paid")}><CircleDollarSign /> Mark {order.paymentStatus === "paid" ? "unpaid" : "paid"}</Button>}</div></CardContent></Card>
}
