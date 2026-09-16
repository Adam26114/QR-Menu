"use client"

import { useState } from "react"
import { useMutation, usePaginatedQuery } from "convex/react"
import type { Id } from "../../../../convex/_generated/dataModel"
import { api } from "../../../../convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"
import { toast } from "@workspace/ui/components/sonner"
import { Building2, ChevronDown, RefreshCw } from "lucide-react"

const statuses = ["trialing", "active", "past_due", "cancelled", "expired"] as const
type Status = (typeof statuses)[number]
type DateField = "trialStartAt" | "trialEndAt" | "currentPeriodStartAt" | "currentPeriodEndAt"

type Restaurant = {
    _id: Id<"restaurants">
    slug: string
    name: string
    archived: boolean
    timezone?: string
    currency?: string
    createdAt: number
    subscriptionAvailable: boolean
    subscription: {
        status: Status
        trialStartAt?: number
        trialEndAt?: number
        currentPeriodStartAt?: number
        currentPeriodEndAt?: number
    }
}

const dateFields: Array<{ key: DateField; label: string }> = [
    { key: "trialStartAt", label: "Trial starts" },
    { key: "trialEndAt", label: "Trial ends" },
    { key: "currentPeriodStartAt", label: "Current period starts" },
    { key: "currentPeriodEndAt", label: "Current period ends" },
]

function dateValue(value?: number) {
    return value ? new Date(value).toISOString().slice(0, 10) : ""
}

function dateTimestamp(value: string) {
    return value ? new Date(`${value}T00:00:00.000Z`).getTime() : null
}

function formatDate(value?: number) {
    return value
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(value)
        : "Not set"
}

function safeError(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("validation") || message.includes("greater than")) return "Check the period dates and try again."
    if (message.includes("permission") || message.includes("admin")) return "You do not have permission to change this policy."
    return "Could not save subscription policy. Try again."
}

function RestaurantPolicyCard({ restaurant }: { restaurant: Restaurant }) {
    const [status, setStatus] = useState<Status>(restaurant.subscription.status)
    const [dates, setDates] = useState<Record<DateField, string>>(() =>
        dateFields.reduce((values, field) => {
            values[field.key] = dateValue(restaurant.subscription[field.key])
            return values
        }, {} as Record<DateField, string>)
    )
    const [saving, setSaving] = useState(false)
    const update = useMutation(api.admin.updateSubscription)
    const canEdit = restaurant.subscriptionAvailable

    async function save() {
        setSaving(true)
        try {
            await update({
                restaurantId: restaurant._id,
                status,
                ...Object.fromEntries(dateFields.map(({ key }) => [key, dateTimestamp(dates[key])])),
            })
            toast.success("Subscription policy saved", { description: `${restaurant.name} is up to date.` })
        } catch (error) {
            toast.error("Subscription policy not saved", { description: safeError(error) })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="overflow-hidden border-border/80">
            <CardHeader className="gap-3 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <CardTitle className="truncate text-lg">{restaurant.name}</CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                        <span>/{restaurant.slug}</span>
                        <span aria-hidden="true">·</span>
                        <span>{restaurant.timezone ?? "Timezone not set"}</span>
                        {restaurant.archived && <span className="font-medium text-amber-700 dark:text-amber-300">Archived</span>}
                    </CardDescription>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${canEdit ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {canEdit ? status.replace("_", " ") : "No subscription record"}
                </span>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="space-y-2 text-sm font-medium">
                        <span>Status</span>
                        <span className="relative block">
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value as Status)}
                                 disabled={saving || !canEdit}
                                className="h-9 w-full appearance-none rounded-lg border bg-background px-3 pr-9 text-sm capitalize outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                {statuses.map((option) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-2.5 right-3 size-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                    </label>
                    {dateFields.map(({ key, label }) => (
                        <label key={key} className="space-y-2 text-sm font-medium">
                            <span>{label}</span>
                            <input
                                type="date"
                                value={dates[key]}
                                onChange={(event) => setDates((current) => ({ ...current, [key]: event.target.value }))}
                                 disabled={saving || !canEdit}
                                className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                        </label>
                    ))}
                </div>
                <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground">
                        {canEdit ? (
                            <>
                                Trial: <span className="text-foreground">{formatDate(restaurant.subscription.trialStartAt)} - {formatDate(restaurant.subscription.trialEndAt)}</span>
                                <span className="mx-2" aria-hidden="true">·</span>
                                Period: <span className="text-foreground">{formatDate(restaurant.subscription.currentPeriodStartAt)} - {formatDate(restaurant.subscription.currentPeriodEndAt)}</span>
                            </>
                        ) : (
                            <span>No subscription record. Add a subscription before editing policy.</span>
                        )}
                    </p>
                    <Button size="sm" onClick={save} disabled={saving || !canEdit}>
                        {saving ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}
                        {saving ? "Saving..." : "Save changes"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

export function AdminWorkspace() {
    const restaurants = usePaginatedQuery(api.admin.listRestaurants, {}, { initialNumItems: 12 })
    const loading = restaurants.status === "LoadingFirstPage"
    const queryError = (restaurants.status as string) === "Error"

    return (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">Platform desk</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Platform controls</h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">Keep subscription policy clear across every restaurant workspace.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <Building2 className="size-4 text-primary" aria-hidden="true" />
                    {loading ? "Loading restaurants" : `${restaurants.results.length} loaded`}
                </div>
            </header>

            <aside className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                These controls change subscription policy only. No tenant operational data is shown here.
            </aside>

            {loading ? (
                <div className="grid gap-4" aria-label="Loading restaurants" role="status">
                    {[1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-muted" />)}
                </div>
            ) : queryError ? (
                <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-destructive">
                    <p className="font-medium">Platform controls could not load.</p>
                    <p className="mt-1 text-sm text-destructive/90">Restaurant subscription policies are unavailable right now. Retry to reload the platform controls.</p>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
                </div>
            ) : restaurants.results.length === 0 ? (
                <Card className="border-dashed"><CardHeader><CardTitle>No restaurants yet</CardTitle><CardDescription>Restaurant workspaces will appear here once they are created.</CardDescription></CardHeader></Card>
            ) : (
                <section aria-label="Restaurant subscription policies" className="grid gap-4">
                    {(restaurants.results as Restaurant[]).map((restaurant) => <RestaurantPolicyCard key={restaurant._id} restaurant={restaurant} />)}
                    {restaurants.status === "CanLoadMore" && <Button variant="outline" className="self-center" onClick={() => restaurants.loadMore(12)}>Load more restaurants</Button>}
                    {restaurants.status === "LoadingMore" && <p className="text-center text-sm text-muted-foreground" role="status">Loading more restaurants...</p>}
                </section>
            )}
        </main>
    )
}
