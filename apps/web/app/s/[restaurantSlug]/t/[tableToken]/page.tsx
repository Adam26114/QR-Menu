"use client"

import { useParams } from "next/navigation"
import Image from "next/image"
import { useQuery } from "convex/react"

import { api } from "../../../../../../../convex/_generated/api"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
})

function formatPrice(priceMinor: number) {
    return currency.format(priceMinor / 100)
}

function formatSelection(group: {
    selectionMode: "single" | "multiple"
    required: boolean
    minSelections: number
    maxSelections: number
}) {
    if (group.selectionMode === "single") {
        return group.required ? "Required · Choose one" : "Choose one"
    }

    if (group.required) {
        return `Required · Choose ${group.minSelections === group.maxSelections ? `up to ${group.maxSelections}` : `${group.minSelections}-${group.maxSelections}`}`
    }

    return `Choose up to ${group.maxSelections}`
}

export default function PublicTableMenuPage() {
    const params = useParams<{
        restaurantSlug: string | string[]
        tableToken: string | string[]
    }>()
    const restaurantSlug = Array.isArray(params.restaurantSlug)
        ? (params.restaurantSlug[0] ?? "")
        : params.restaurantSlug
    const tableToken = Array.isArray(params.tableToken)
        ? (params.tableToken[0] ?? "")
        : params.tableToken
    const menu = useQuery(api.tables.resolvePublic, {
        restaurantSlug,
        tableToken,
    })

    if (menu === undefined) {
        return (
            <main className="min-h-screen bg-muted/30 px-4 py-12 sm:px-6">
                <div
                    className="mx-auto max-w-3xl"
                    role="status"
                    aria-live="polite"
                >
                    <Card>
                        <CardContent className="flex min-h-40 items-center justify-center py-10 text-sm text-muted-foreground">
                            Loading menu...
                        </CardContent>
                    </Card>
                </div>
            </main>
        )
    }

    if (menu === null) {
        return (
            <main className="min-h-screen bg-muted/30 px-4 py-12 sm:px-6">
                <div className="mx-auto max-w-xl">
                    <Card>
                        <CardHeader>
                            <CardTitle>Menu unavailable</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm leading-6 text-muted-foreground">
                                This table menu is no longer available. Ask a
                                team member for a new QR code.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto max-w-3xl space-y-8">
                <header className="rounded-2xl bg-primary px-6 py-8 text-primary-foreground shadow-sm sm:px-10">
                    <p className="text-sm font-medium tracking-[0.2em] uppercase opacity-80">
                        {menu.table.name}
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                        {menu.restaurant.name}
                    </h1>
                    <p className="mt-3 max-w-xl text-sm leading-6 opacity-85">
                        Browse the menu from your table.
                    </p>
                </header>

                <div className="space-y-10">
                    {menu.categories.map((category) => (
                        <section
                            key={category.name}
                            aria-labelledby={`category-${category.name}`}
                        >
                            <div className="mb-4 flex items-center gap-3">
                                <h2
                                    id={`category-${category.name}`}
                                    className="text-xl font-semibold tracking-tight"
                                >
                                    {category.name}
                                </h2>
                                <div
                                    className="h-px flex-1 bg-border"
                                    aria-hidden="true"
                                />
                            </div>

                            {category.items.length > 0 ? (
                                <div className="grid gap-4">
                                    {category.items.map((item) => (
                                        <Card
                                            key={item.name}
                                            className="gap-0 overflow-hidden py-0 sm:flex-row"
                                        >
                                            {item.imageUrl ? (
                                                <Image
                                                    src={item.imageUrl}
                                                    alt={`${item.name} from ${menu.restaurant.name}`}
                                                    width={352}
                                                    height={192}
                                                    unoptimized
                                                    className="h-48 w-full shrink-0 object-cover sm:h-auto sm:w-44"
                                                />
                                            ) : null}
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <CardHeader className="pt-5 pb-3">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <CardTitle className="text-lg">
                                                            {item.name}
                                                        </CardTitle>
                                                        <span className="shrink-0 font-semibold tabular-nums">
                                                            {formatPrice(
                                                                item.priceMinor
                                                            )}
                                                        </span>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-5 pb-5">
                                                    {item.description ? (
                                                        <p className="text-sm leading-6 text-muted-foreground">
                                                            {item.description}
                                                        </p>
                                                    ) : null}

                                                    {item.options.length > 0 ? (
                                                        <div className="space-y-4 border-t pt-4">
                                                            {item.options.map(
                                                                (group) => (
                                                                    <div
                                                                        key={
                                                                            group.name
                                                                        }
                                                                    >
                                                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                                            <h3 className="text-sm font-medium">
                                                                                {
                                                                                    group.name
                                                                                }
                                                                            </h3>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {formatSelection(
                                                                                    group
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                        <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                                                                            {group.choices.map(
                                                                                (
                                                                                    choice
                                                                                ) => (
                                                                                    <li
                                                                                        key={
                                                                                            choice.name
                                                                                        }
                                                                                        className="flex justify-between gap-3"
                                                                                    >
                                                                                        <span>
                                                                                            {
                                                                                                choice.name
                                                                                            }
                                                                                        </span>
                                                                                        {choice.priceDeltaMinor !==
                                                                                        0 ? (
                                                                                            <span className="shrink-0 tabular-nums">
                                                                                                {choice.priceDeltaMinor >
                                                                                                0
                                                                                                    ? "+"
                                                                                                    : "-"}
                                                                                                {formatPrice(
                                                                                                    Math.abs(
                                                                                                        choice.priceDeltaMinor
                                                                                                    )
                                                                                                )}
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </CardContent>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No items available in this category.
                                </p>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </main>
    )
}
