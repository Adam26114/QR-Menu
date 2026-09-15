"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import {
    Archive,
    CheckCircle2,
    Clock3,
    LockKeyhole,
    RotateCcw,
} from "lucide-react"
import { api } from "../../../../convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"
import { RestaurantSettingsForm } from "./RestaurantSettingsForm"
import { MenuWorkspace } from "../menu/MenuWorkspace"
import { TablesWorkspace } from "./TablesWorkspace"

export function RestaurantWorkspace({
    section = "overview",
}: {
    section?: string
}) {
    const { restaurantSlug } = useParams<{ restaurantSlug: string }>()
    const restaurant = useQuery(api.restaurants.resolveSlug, {
        slug: restaurantSlug,
    })
    const membership = useQuery(
        api.restaurants.getMembership,
        restaurant ? { restaurantId: restaurant._id } : "skip"
    )
    const canAccept = useQuery(
        api.restaurants.canAcceptOrders,
        restaurant ? { restaurantId: restaurant._id } : "skip"
    )
    const subscription = useQuery(
        api.subscriptions.get,
        restaurant ? { restaurantId: restaurant._id } : "skip"
    )
    const restricted = section !== "overview" && section !== "orders"
    if (!restaurant || !membership)
        return (
            <div className="mx-auto max-w-5xl animate-pulse space-y-4">
                <div className="h-10 w-2/3 rounded bg-muted" />
                <div className="h-36 rounded-xl bg-muted" />
            </div>
        )
    if (restricted && membership.role !== "owner")
        return <ReadOnlyState section={section} />
    if (section === "settings")
        return <RestaurantSettingsForm restaurant={restaurant} />
    if (section === "menu") return <MenuWorkspace restaurant={restaurant} />
    if (section === "tables") return <TablesWorkspace restaurant={restaurant} />
    if (section === "overview")
        return (
            <Overview
                restaurant={restaurant}
                canAccept={canAccept}
                subscription={subscription}
            />
        )
    return <Placeholder section={section} />
}

function Overview({
    restaurant,
    canAccept,
    subscription,
}: {
    restaurant: NonNullable<
        ReturnType<typeof useQuery<typeof api.restaurants.resolveSlug>>
    >
    canAccept?: boolean
    subscription?: { status: string } | null
}) {
    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <header>
                <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                    {restaurant.slug}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                    {restaurant.name}
                </h1>
                <p className="mt-2 text-muted-foreground">
                    A calm view of the service desk.
                </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatusCard
                    label="Order acceptance"
                    value={canAccept ? "Open" : "Closed"}
                    icon={<CheckCircle2 className="size-4" />}
                    tone={
                        canAccept ? "text-emerald-600" : "text-muted-foreground"
                    }
                />
                <StatusCard
                    label="Subscription"
                    value={subscription?.status ?? "Not active"}
                    icon={<Clock3 className="size-4" />}
                />
                <StatusCard
                    label="Currency"
                    value={restaurant.currency ?? "MMK"}
                />
                <StatusCard
                    label="Timezone"
                    value={restaurant.timezone ?? "Asia/Yangon"}
                />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Restaurant profile</CardTitle>
                    <CardDescription>
                        Operational details used across your workspace.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                    <Detail label="Phone" value={restaurant.phone} />
                    <Detail label="Email" value={restaurant.email} />
                    <Detail label="Address" value={restaurant.address} />
                    <Detail
                        label="Archive state"
                        value={restaurant.archived ? "Archived" : "Active"}
                    />
                    <Detail
                        label="Tax"
                        value={`${(restaurant.taxBps ?? 0) / 100}%`}
                    />
                    <Detail
                        label="Service charge"
                        value={`${(restaurant.serviceChargeBps ?? 0) / 100}%`}
                    />
                </CardContent>
            </Card>
        </section>
    )
}

function StatusCard({
    label,
    value,
    icon,
    tone = "text-foreground",
}: {
    label: string
    value: string
    icon?: React.ReactNode
    tone?: string
}) {
    return (
        <Card className="gap-3 py-5">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardDescription>{label}</CardDescription>
                {icon}
            </CardHeader>
            <CardContent>
                <p className={`text-lg font-semibold capitalize ${tone}`}>
                    {value}
                </p>
            </CardContent>
        </Card>
    )
}
function Detail({ label, value }: { label: string; value?: string }) {
    return (
        <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {label}
            </p>
            <p className="mt-1 font-medium">{value || "Not set"}</p>
        </div>
    )
}
function Placeholder({ section }: { section: string }) {
    return (
        <Card className="mx-auto max-w-3xl border-dashed">
            <CardHeader>
                <CardTitle>
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                </CardTitle>
                <CardDescription>
                    This workspace area is not implemented yet.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    The navigation is ready, but live {section} management is
                    coming soon. No sample data is shown here.
                </p>
                <Link
                    href=".."
                    className={`${buttonVariants({ variant: "outline" })} mt-5`}
                >
                    Back to overview
                </Link>
            </CardContent>
        </Card>
    )
}
function ReadOnlyState({ section }: { section: string }) {
    return (
        <Card className="mx-auto max-w-3xl border-dashed">
            <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted">
                    <LockKeyhole className="size-5 text-muted-foreground" />
                </div>
                <CardTitle>
                    {section.charAt(0).toUpperCase() + section.slice(1)} is
                    owner-only
                </CardTitle>
                <CardDescription>
                    Your staff access includes the workspace and orders. This
                    area is read-only and not available to staff.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Link
                    href=".."
                    className={buttonVariants({ variant: "outline" })}
                >
                    Back to overview
                </Link>
            </CardContent>
        </Card>
    )
}

export function ArchiveControls({
    restaurantId,
    archived,
}: {
    restaurantId: string
    archived: boolean
}) {
    const archive = useMutation(api.restaurants.archive)
    const restore = useMutation(api.restaurants.restore)
    return (
        <div className="flex flex-wrap gap-2">
            {archived ? (
                <Button
                    variant="outline"
                    onClick={() =>
                        restore({ restaurantId: restaurantId as never })
                    }
                >
                    <RotateCcw aria-hidden="true" /> Restore restaurant
                </Button>
            ) : (
                <Button
                    variant="destructive"
                    onClick={() =>
                        archive({ restaurantId: restaurantId as never })
                    }
                >
                    <Archive aria-hidden="true" /> Archive restaurant
                </Button>
            )}
        </div>
    )
}
