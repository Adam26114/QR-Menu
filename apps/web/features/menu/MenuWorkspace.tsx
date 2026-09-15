"use client"

import { Component, type ReactNode, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"

type Props = { restaurant: Doc<"restaurants"> }

function friendlyError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("name")) return "Add a name before saving."
    if (message.includes("price")) return "Enter a valid price."
    if (message.includes("selection"))
        return "Check the selection limits and try again."
    if (message.includes("archived"))
        return "Restore the archived record before editing it."
    return fallback
}

function ErrorMessage({
    error,
    fallback = "Unable to save this change. Please try again.",
}: {
    error?: unknown
    fallback?: string
}) {
    return error ? (
        <p role="alert" className="text-sm text-destructive">
            {friendlyError(error, fallback)}
        </p>
    ) : null
}

function QueryErrorBoundary({ children }: { children: ReactNode }) {
    return <QueryErrorBoundaryImpl>{children}</QueryErrorBoundaryImpl>
}

class QueryErrorBoundaryImpl extends Component<
    { children: ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false }
    static getDerivedStateFromError() {
        return { hasError: true }
    }
    render() {
        return this.state.hasError ? (
            <p role="alert" className="text-sm text-destructive">
                Unable to load menu data. Please refresh and try again.
            </p>
        ) : (
            this.props.children
        )
    }
}

function CategoryEditor({
    restaurantId,
    category,
    onDone,
}: {
    restaurantId: Id<"restaurants">
    category?: Doc<"menuCategories">
    onDone: () => void
}) {
    const save = useMutation(
        category ? api.menu.updateCategory : api.menu.createCategory
    )
    const [name, setName] = useState(category?.name ?? "")
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (pending) return
        if (!name.trim()) {
            setError(new Error("name"))
            return
        }
        setError(undefined)
        setPending(true)
        try {
            if (category)
                await save({ categoryId: category._id, name: name.trim() })
            else await save({ restaurantId, name: name.trim() })
            onDone()
        } catch (e) {
            setError(e)
        } finally {
            setPending(false)
        }
    }
    return (
        <form
            className="flex flex-wrap gap-2"
            onSubmit={submit}
            aria-label={category ? `Edit ${category.name}` : "Add category"}
        >
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                aria-label="Category name"
                aria-invalid={Boolean(error)}
            />
            <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : category ? "Save" : "Add"}
            </Button>
            <ErrorMessage error={error} />
        </form>
    )
}

function ItemEditor({
    restaurantId,
    categoryId,
    item,
    onDone,
}: {
    restaurantId: Id<"restaurants">
    categoryId: Id<"menuCategories">
    item?: Doc<"menuItems">
    onDone: () => void
}) {
    const create = useMutation(api.menu.createItem)
    const update = useMutation(api.menu.updateItem)
    const setAvailability = useMutation(api.menu.setAvailability)
    const [name, setName] = useState(item?.name ?? "")
    const [description, setDescription] = useState(item?.description ?? "")
    const [priceMinor, setPrice] = useState(String(item?.priceMinor ?? 0))
    const [available, setAvailable] = useState(item?.available ?? true)
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (pending) return
        const price = Number(priceMinor)
        if (!name.trim()) {
            setError(new Error("name"))
            return
        }
        if (!Number.isFinite(price) || price < 0) {
            setError(new Error("price"))
            return
        }
        setError(undefined)
        setPending(true)
        try {
            if (item) {
                await update({
                    itemId: item._id,
                    name: name.trim(),
                    description: description.trim(),
                    priceMinor: price,
                })
                if (item.available !== available)
                    await setAvailability({ itemId: item._id, available })
            } else
                await create({
                    restaurantId,
                    categoryId,
                    name: name.trim(),
                    description: description.trim(),
                    priceMinor: price,
                    available,
                })
            onDone()
        } catch (e) {
            setError(e)
        } finally {
            setPending(false)
        }
    }
    return (
        <form
            className="grid gap-2 rounded-md border border-dashed p-3"
            onSubmit={submit}
            aria-label={item ? `Edit ${item.name}` : "Add menu item"}
        >
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
                aria-label="Item name"
                aria-invalid={Boolean(error)}
            />
            <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                aria-label="Item description"
                rows={3}
            />
            <Input
                type="number"
                min="0"
                value={priceMinor}
                onChange={(e) => setPrice(e.target.value)}
                aria-label="Price in minor units"
            />
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                />{" "}
                Available to order
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={pending}>
                    {pending ? "Saving..." : item ? "Save item" : "Add item"}
                </Button>
                <ErrorMessage error={error} />
            </div>
        </form>
    )
}

type GroupProps = {
    itemId: Id<"menuItems">
    group?: Doc<"menuOptionGroups">
    onDone: () => void
}
function OptionGroupForm({ itemId, group, onDone }: GroupProps) {
    const save = useMutation(
        group ? api.menu.updateOptionGroup : api.menu.createOptionGroup
    )
    const [name, setName] = useState(group?.name ?? "")
    const [mode, setMode] = useState<"single" | "multiple">(
        group?.selectionMode ?? "single"
    )
    const [required, setRequired] = useState(group?.required ?? false)
    const [min, setMin] = useState(String(group?.minSelections ?? 0))
    const [max, setMax] = useState(String(group?.maxSelections ?? 1))
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (pending) return
        const minimum = Number(min)
        const maximum = Number(max)
        if (!name.trim()) {
            setError(new Error("name"))
            return
        }
        if (minimum < 0 || maximum < minimum) {
            setError(new Error("selection"))
            return
        }
        setError(undefined)
        setPending(true)
        try {
            const values = {
                name: name.trim(),
                selectionMode: mode,
                required,
                minSelections: minimum,
                maxSelections: maximum,
            }
            if (group) await save({ optionGroupId: group._id, ...values })
            else await save({ itemId, ...values })
            onDone()
        } catch (e) {
            setError(e)
        } finally {
            setPending(false)
        }
    }
    return (
        <form
            className="grid gap-3 rounded-md border border-dashed p-3"
            aria-label={
                group ? `Edit ${group.name} option group` : "Add option group"
            }
            onSubmit={submit}
        >
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Option group name"
                aria-label="Option group name"
            />
            <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                    Selection mode
                    <select
                        className="h-9 rounded-md border bg-background px-2"
                        value={mode}
                        onChange={(e) =>
                            setMode(e.target.value as "single" | "multiple")
                        }
                    >
                        <option value="single">Single choice</option>
                        <option value="multiple">Multiple choices</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 self-end text-sm">
                    <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) => setRequired(e.target.checked)}
                    />{" "}
                    Required
                </label>
                <label className="grid gap-1 text-sm">
                    Minimum selections
                    <Input
                        type="number"
                        min="0"
                        value={min}
                        onChange={(e) => setMin(e.target.value)}
                    />
                </label>
                <label className="grid gap-1 text-sm">
                    Maximum selections
                    <Input
                        type="number"
                        min="0"
                        value={max}
                        onChange={(e) => setMax(e.target.value)}
                    />
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={pending}>
                    {pending ? "Saving..." : group ? "Save group" : "Add group"}
                </Button>
                {group && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onDone}
                        disabled={pending}
                    >
                        Cancel
                    </Button>
                )}
                <ErrorMessage error={error} />
            </div>
        </form>
    )
}

function OptionChoiceEditor({
    groupId,
    choice,
    onDone,
}: {
    groupId: Id<"menuOptionGroups">
    choice?: Doc<"menuOptionChoices">
    onDone: () => void
}) {
    const save = useMutation(
        choice ? api.menu.updateOptionChoice : api.menu.createOptionChoice
    )
    const [name, setName] = useState(choice?.name ?? "")
    const [price, setPrice] = useState(String(choice?.priceDeltaMinor ?? 0))
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (pending) return
        const delta = Number(price)
        if (!name.trim()) {
            setError(new Error("name"))
            return
        }
        if (!Number.isFinite(delta)) {
            setError(new Error("price"))
            return
        }
        setError(undefined)
        setPending(true)
        try {
            if (choice)
                await save({
                    optionChoiceId: choice._id,
                    name: name.trim(),
                    priceDeltaMinor: delta,
                })
            else
                await save({
                    optionGroupId: groupId,
                    name: name.trim(),
                    priceDeltaMinor: delta,
                })
            onDone()
        } catch (e) {
            setError(e)
        } finally {
            setPending(false)
        }
    }
    return (
        <form className="flex flex-wrap gap-2" onSubmit={submit}>
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Choice name"
                aria-label="Choice name"
            />
            <Input
                className="w-36"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-label="Price adjustment in minor units"
                placeholder="Price delta"
            />
            <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving..." : choice ? "Save choice" : "Add choice"}
            </Button>
            {choice && (
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onDone}
                    disabled={pending}
                >
                    Cancel
                </Button>
            )}
            <ErrorMessage error={error} />
        </form>
    )
}

function confirmArchive(label: string) {
    return (
        typeof window === "undefined" ||
        window.confirm(`Archive ${label}? You can restore it later.`)
    )
}

function OptionGroup({ group }: { group: Doc<"menuOptionGroups"> }) {
    const choices = useQuery(api.menu.listOptionChoices, {
        optionGroupId: group._id,
        includeArchived: true,
    })
    const archive = useMutation(api.menu.archiveOptionGroup)
    const restore = useMutation(api.menu.restoreOptionGroup)
    const archiveChoice = useMutation(api.menu.archiveOptionChoice)
    const restoreChoice = useMutation(api.menu.restoreOptionChoice)
    const [editing, setEditing] = useState(false)
    const [editingChoice, setEditingChoice] =
        useState<Id<"menuOptionChoices">>()
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    async function run(action: () => Promise<unknown>) {
        if (pending) return
        setError(undefined)
        setPending(true)
        try {
            await action()
        } catch (e) {
            setError(e)
        } finally {
            setPending(false)
        }
    }
    return (
        <div
            className={`grid gap-3 rounded-lg border p-4 ${group.archived ? "opacity-70" : ""}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className="font-medium">
                        {group.name}{" "}
                        {group.archived && (
                            <span className="text-sm text-muted-foreground">
                                (archived)
                            </span>
                        )}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        {group.selectionMode === "multiple"
                            ? "Choose multiple"
                            : "Choose one"}{" "}
                        · {group.required ? "Required" : "Optional"} ·{" "}
                        {group.minSelections}-{group.maxSelections} selections
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!group.archived && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing((value) => !value)}
                            disabled={pending}
                        >
                            {editing ? "Close" : "Edit group"}
                        </Button>
                    )}
                    {group.archived ? (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                                run(() => restore({ optionGroupId: group._id }))
                            }
                            disabled={pending}
                        >
                            Restore
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                if (confirmArchive("this option group"))
                                    void run(() =>
                                        archive({ optionGroupId: group._id })
                                    )
                            }}
                            disabled={pending}
                        >
                            Archive
                        </Button>
                    )}
                </div>
            </div>
            {editing && !group.archived && (
                <OptionGroupForm
                    itemId={group.menuItemId}
                    group={group}
                    onDone={() => setEditing(false)}
                />
            )}
            <div className="grid gap-2 pl-3 sm:pl-5">
                <div className="flex items-center justify-between gap-2">
                    <h5 className="text-sm font-medium">Choices</h5>
                    {!group.archived && (
                        <OptionChoiceEditor
                            groupId={group._id}
                            onDone={() => setError(undefined)}
                        />
                    )}
                </div>
                {choices === undefined ? (
                    <p className="text-sm text-muted-foreground" role="status">
                        Loading choices...
                    </p>
                ) : choices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No choices yet. Add one above.
                    </p>
                ) : (
                    choices.map((choice) => (
                        <div
                            key={choice._id}
                            className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${choice.archived ? "opacity-60" : ""}`}
                        >
                            <span className="text-sm">
                                {choice.name}{" "}
                                <span className="text-muted-foreground">
                                    ({choice.priceDeltaMinor >= 0 ? "+" : ""}
                                    {choice.priceDeltaMinor})
                                </span>
                                {choice.archived && (
                                    <span className="ml-1 text-muted-foreground">
                                        (archived)
                                    </span>
                                )}
                            </span>
                            <div className="flex gap-2">
                                {!group.archived && !choice.archived && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            setEditingChoice(choice._id)
                                        }
                                        disabled={pending}
                                    >
                                        Edit
                                    </Button>
                                )}
                                {group.archived ? null : choice.archived ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                            run(() =>
                                                restoreChoice({
                                                    optionChoiceId: choice._id,
                                                })
                                            )
                                        }
                                        disabled={pending}
                                    >
                                        Restore
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            if (confirmArchive("this choice"))
                                                void run(() =>
                                                    archiveChoice({
                                                        optionChoiceId:
                                                            choice._id,
                                                    })
                                                )
                                        }}
                                        disabled={pending}
                                    >
                                        Archive
                                    </Button>
                                )}
                            </div>
                            {!group.archived && editingChoice === choice._id && (
                                <OptionChoiceEditor
                                    groupId={group._id}
                                    choice={choice}
                                    onDone={() => setEditingChoice(undefined)}
                                />
                            )}
                        </div>
                    ))
                )}
            </div>
            <ErrorMessage error={error} />
        </div>
    )
}

function OptionGroupsEditor({ item }: { item: Doc<"menuItems"> }) {
    const groups = useQuery(api.menu.listOptionGroups, {
        itemId: item._id,
        includeArchived: true,
    })
    const [adding, setAdding] = useState(false)
    if (groups === undefined)
        return (
            <p className="text-sm text-muted-foreground" role="status">
                Loading option groups...
            </p>
        )
    return (
        <div className="grid gap-3 rounded-md bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="font-medium">Options</h3>
                    <p className="text-sm text-muted-foreground">
                        Customize choices and add-ons for this item.
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAdding((value) => !value)}
                >
                    {adding ? "Close" : "Add option group"}
                </Button>
            </div>
            {adding && (
                <OptionGroupForm
                    itemId={item._id}
                    onDone={() => setAdding(false)}
                />
            )}
            {groups.length === 0 && !adding ? (
                <p className="text-sm text-muted-foreground">
                    No option groups yet. Add one to offer choices.
                </p>
            ) : (
                groups.map((group) => (
                    <OptionGroup key={group._id} group={group} />
                ))
            )}
        </div>
    )
}

function MenuWorkspaceContent({ restaurant }: Props) {
    const categories = useQuery(api.menu.listCategories, {
        restaurantId: restaurant._id,
        includeArchived: true,
    })
    const items = useQuery(api.menu.listItems, {
        restaurantId: restaurant._id,
        includeArchived: true,
    })
    const reorderCategories = useMutation(api.menu.reorderCategories)
    const reorderItems = useMutation(api.menu.reorderItems)
    const archiveCategory = useMutation(api.menu.archiveCategory)
    const restoreCategory = useMutation(api.menu.restoreCategory)
    const archiveItem = useMutation(api.menu.archiveItem)
    const restoreItem = useMutation(api.menu.restoreItem)
    const setAvailability = useMutation(api.menu.setAvailability)
    const [selected, setSelected] = useState<Id<"menuCategories">>()
    const [editingCategory, setEditingCategory] =
        useState<Id<"menuCategories">>()
    const [editingItem, setEditingItem] = useState<Id<"menuItems">>()
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    if (categories === undefined || items === undefined)
        return <p role="status">Loading menu...</p>
    const active = categories.filter((category) => !category.archived)
    const category =
        categories.find((value) => value._id === selected) ?? active[0]
    const categoryItems = category
        ? items.filter((item) => item.categoryId === category._id)
        : []
    const activeCategoryItems = categoryItems.filter((item) => !item.archived)
    async function run(action: () => Promise<unknown>) {
        if (pending) return
        setError(undefined)
        setPending(true)
        try {
            await action()
        } catch (e) {
            setError(e)
        } finally {
            setPending(false)
        }
    }
    async function moveCategory(index: number, direction: -1 | 1) {
        const next = [...active]
        const target = index + direction
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target]!, next[index]!]
        await run(() =>
            reorderCategories({
                restaurantId: restaurant._id,
                orderedCategoryIds: next.map((value) => value._id),
            })
        )
    }
    async function moveItem(index: number, direction: -1 | 1) {
        if (!category) return
        const next = [...activeCategoryItems]
        const target = index + direction
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target]!, next[index]!]
        await run(() =>
            reorderItems({
                restaurantId: restaurant._id,
                categoryId: category._id,
                orderedItemIds: next.map((value) => value._id),
            })
        )
    }
    return (
        <section className="mx-auto grid max-w-6xl gap-6">
            <ErrorMessage
                error={error}
                fallback="Unable to update the menu. Please try again."
            />
            <Card>
                <CardHeader>
                    <CardTitle>Menu categories</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                    <CategoryEditor
                        restaurantId={restaurant._id}
                        onDone={() => setError(undefined)}
                    />
                    {categories.length === 0 ? (
                        <p
                            className="text-sm text-muted-foreground"
                            role="status"
                        >
                            No categories yet. Add one above to start building
                            the menu.
                        </p>
                    ) : (
                        categories.map((value) => {
                            const index = active.findIndex(
                                (entry) => entry._id === value._id
                            )
                            return (
                                <div
                                    key={value._id}
                                    className="flex flex-wrap items-center gap-2"
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setSelected(value._id)}
                                        aria-pressed={
                                            category?._id === value._id
                                        }
                                    >
                                        {value.name}
                                        {value.archived ? " (archived)" : ""}
                                    </Button>
                                    {!value.archived && (
                                        <>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() =>
                                                    setEditingCategory(
                                                        value._id
                                                    )
                                                }
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    if (
                                                        confirmArchive(
                                                            "this category"
                                                        )
                                                    )
                                                        void run(() =>
                                                            archiveCategory({
                                                                categoryId:
                                                                    value._id,
                                                            })
                                                        )
                                                }}
                                                disabled={pending}
                                            >
                                                Archive
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() =>
                                                    void moveCategory(index, -1)
                                                }
                                                disabled={pending}
                                            >
                                                Up
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() =>
                                                    void moveCategory(index, 1)
                                                }
                                                disabled={pending}
                                            >
                                                Down
                                            </Button>
                                        </>
                                    )}
                                    {value.archived && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() =>
                                                void run(() =>
                                                    restoreCategory({
                                                        categoryId: value._id,
                                                    })
                                                )
                                            }
                                            disabled={pending}
                                        >
                                            Restore
                                        </Button>
                                    )}
                                    {editingCategory === value._id && (
                                        <CategoryEditor
                                            restaurantId={restaurant._id}
                                            category={value}
                                            onDone={() =>
                                                setEditingCategory(undefined)
                                            }
                                        />
                                    )}
                                </div>
                            )
                        })
                    )}
                </CardContent>
            </Card>
            {category && (
                <Card>
                    <CardHeader>
                        <CardTitle>{category.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {!category.archived && (
                            <ItemEditor
                                restaurantId={restaurant._id}
                                categoryId={category._id}
                                onDone={() => setError(undefined)}
                            />
                        )}
                        {categoryItems.length === 0 ? (
                            <p
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                No active items in this category yet. Add one
                                above.
                            </p>
                        ) : (
                            categoryItems.map((item) => (
                                <div
                                    key={item._id}
                                    className="grid gap-3 rounded border p-3"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <span className="font-medium">
                                                {item.name} - {item.priceMinor}
                                            </span>
                                            {item.description && (
                                                <p className="text-sm text-muted-foreground">
                                                    {item.description}
                                                </p>
                                            )}
                                            <p className="text-sm text-muted-foreground">
                                                {item.available
                                                    ? "Available"
                                                    : "Unavailable"}
                                                {item.archived
                                                    ? " · Archived"
                                                    : ""}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {!category.archived && !item.archived && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            void run(() =>
                                                                setAvailability(
                                                                    {
                                                                        itemId: item._id,
                                                                        available:
                                                                            !item.available,
                                                                    }
                                                                )
                                                            )
                                                        }
                                                        disabled={pending}
                                                    >
                                                        {item.available
                                                            ? "Mark unavailable"
                                                            : "Mark available"}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setEditingItem(
                                                                editingItem ===
                                                                    item._id
                                                                    ? undefined
                                                                    : item._id
                                                            )
                                                        }
                                                        disabled={pending}
                                                    >
                                                        {editingItem ===
                                                        item._id
                                                            ? "Close"
                                                            : "Edit"}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (
                                                                confirmArchive(
                                                                    "this item"
                                                                )
                                                            )
                                                                void run(() =>
                                                                    archiveItem(
                                                                        {
                                                                            itemId: item._id,
                                                                        }
                                                                    )
                                                                )
                                                        }}
                                                        disabled={pending}
                                                    >
                                                        Archive
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            void moveItem(
                                                                activeCategoryItems.findIndex(
                                                                    (entry) =>
                                                                        entry._id ===
                                                                        item._id
                                                                ),
                                                                -1
                                                            )
                                                        }
                                                        disabled={pending}
                                                    >
                                                        Up
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            void moveItem(
                                                                activeCategoryItems.findIndex(
                                                                    (entry) =>
                                                                        entry._id ===
                                                                        item._id
                                                                ),
                                                                1
                                                            )
                                                        }
                                                        disabled={pending}
                                                    >
                                                        Down
                                                    </Button>
                                                </>
                                            )}
                                            {item.archived && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() =>
                                                        void run(() =>
                                                            restoreItem({
                                                                itemId: item._id,
                                                            })
                                                        )
                                                    }
                                                    disabled={pending}
                                                >
                                                    Restore
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {!category.archived &&
                                        !item.archived &&
                                        editingItem === item._id && (
                                        <ItemEditor
                                            restaurantId={restaurant._id}
                                            categoryId={category._id}
                                            item={item}
                                            onDone={() =>
                                                setEditingItem(undefined)
                                            }
                                        />
                                    )}
                                    {!item.archived && (
                                        <OptionGroupsEditor item={item} />
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            )}
        </section>
    )
}

export function MenuWorkspace({ restaurant }: Props) {
    return (
        <QueryErrorBoundary>
            <MenuWorkspaceContent restaurant={restaurant} />
        </QueryErrorBoundary>
    )
}
