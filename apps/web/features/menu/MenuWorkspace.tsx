"use client"

import Link from "next/link"
import { Component, type ReactNode, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogClose,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select"
import {
    Search,
    Plus,
    Layers3,
    X,
    ImagePlus,
    Pencil,
    Archive,
    ArchiveRestore,
    ChevronUp,
    ChevronDown,
    Trash2,
} from "lucide-react"
import { formatMinorCurrency } from "@workspace/ui/lib/format-currency"
import { ConfirmDialog } from "@/components/global/ConfirmDialog"

type Props = { restaurant: Doc<"restaurants"> }

function friendlyError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("name")) return "Add a name before saving."
    if (message.includes("price")) return "Enter a valid price."
    if (message.includes("category")) return "Choose an active category."
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
    onCancel,
}: {
    restaurantId: Id<"restaurants">
    category?: Doc<"menuCategories">
    onDone: () => void
    onCancel: () => void
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
            className="grid gap-4"
            onSubmit={submit}
            aria-label={category ? `Edit ${category.name}` : "Add category"}
        >
            <label className="grid gap-1.5 text-sm font-medium">
                Category name
                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Category name"
                    aria-invalid={Boolean(error)}
                    autoFocus
                />
            </label>
            <ErrorMessage error={error} />
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={pending}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                    {pending
                        ? "Saving..."
                        : category
                          ? "Save changes"
                          : "Add category"}
                </Button>
            </div>
        </form>
    )
}

function ItemEditor({
    restaurantId,
    categoryId,
    categories,
    item,
    onDone,
    onCancel,
}: {
    restaurantId: Id<"restaurants">
    categoryId: Id<"menuCategories">
    categories: Doc<"menuCategories">[]
    item?: Pick<
        Doc<"menuItems">,
        "_id" | "name" | "description" | "priceMinor" | "available"
    > & {
        imageUrl?: string | null
    }
    onDone: () => void
    onCancel: () => void
}) {
    const create = useMutation(api.menu.createItem)
    const update = useMutation(api.menu.updateItem)
    const setAvailability = useMutation(api.menu.setAvailability)
    const generateImageUploadUrl = useMutation(api.menu.generateImageUploadUrl)
    const bindImageUpload = useMutation(api.menu.bindImageUpload)
    const attachImage = useMutation(api.menu.attachImage)
    const removeImage = useMutation(api.menu.removeImage)
    const activeCategories = categories.filter((entry) => !entry.archived)
    const [name, setName] = useState(item?.name ?? "")
    const [description, setDescription] = useState(item?.description ?? "")
    const [priceMinor, setPrice] = useState(String(item?.priceMinor ?? 0))
    const [available, setAvailable] = useState(item?.available ?? true)
    const [selectedCategoryId, setSelectedCategoryId] =
        useState<Id<"menuCategories">>(categoryId)
    const selectedCategoryIsActive = activeCategories.some(
        (entry) => entry._id === selectedCategoryId
    )
    const selectedCategory = categories.find(
        (entry) => entry._id === selectedCategoryId
    )
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    const [imagePending, setImagePending] = useState(false)
    const [imageError, setImageError] = useState<unknown>()
    const [imageStatus, setImageStatus] = useState<string>()
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
        if (!selectedCategoryIsActive) {
            setError(new Error("category"))
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
                    categoryId: selectedCategoryId,
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
    async function uploadImage(file: File) {
        if (!item || imagePending) return
        setImageError(undefined)
        setImageStatus("Preparing image upload...")
        setImagePending(true)
        try {
            const { url, capability } = await generateImageUploadUrl({
                itemId: item._id,
            })
            setImageStatus("Uploading image...")
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": file.type || "application/octet-stream",
                },
                body: file,
            })
            if (!response.ok) throw new Error("upload")
            const payload: unknown = await response.json()
            if (
                !payload ||
                typeof payload !== "object" ||
                !("storageId" in payload) ||
                typeof payload.storageId !== "string"
            )
                throw new Error("upload")
            const storageId = payload.storageId as Id<"_storage">
            setImageStatus("Finalizing image upload...")
            await bindImageUpload({
                itemId: item._id,
                storageId,
                capability,
            })
            setImageStatus("Attaching image...")
            await attachImage({
                itemId: item._id,
                storageId,
                capability,
            })
            setImageStatus("Image attached.")
        } catch (e) {
            setImageError(e)
            setImageStatus(undefined)
        } finally {
            setImagePending(false)
        }
    }
    async function handleImageChange(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0]
        if (file) await uploadImage(file)
        event.target.value = ""
    }
    async function handleRemoveImage() {
        if (!item || imagePending) return
        setImageError(undefined)
        setImageStatus("Removing image...")
        setImagePending(true)
        try {
            await removeImage({ itemId: item._id })
            setImageStatus("Image removed.")
        } catch (e) {
            setImageError(e)
            setImageStatus(undefined)
        } finally {
            setImagePending(false)
        }
    }
    return (
        <form
            className="grid gap-5"
            onSubmit={submit}
            aria-label={item ? `Edit ${item.name}` : "Add menu item"}
        >
            <label className="grid gap-1.5 text-sm font-medium">
                Product name
                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Americano, pepperoni pizza, etc."
                    aria-invalid={Boolean(error)}
                    autoFocus={!item}
                />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                    Price in minor units
                    <Input
                        type="number"
                        min="0"
                        step="1"
                        value={priceMinor}
                        onChange={(event) => setPrice(event.target.value)}
                        inputMode="numeric"
                    />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                    Category
                    {item ? (
                        <div className="flex h-10 items-center rounded-md border border-input px-3 text-sm">
                            <span className="mr-2 inline-grid size-5 place-items-center rounded-md bg-muted text-xs font-semibold">
                                {selectedCategory?.name
                                    .slice(0, 1)
                                    .toUpperCase()}
                            </span>
                            {selectedCategory?.name ?? "Unknown category"}
                        </div>
                    ) : (
                        <Select
                            value={selectedCategoryId}
                            onValueChange={(value) => {
                                if (
                                    value &&
                                    activeCategories.some(
                                        (entry) => entry._id === value
                                    )
                                )
                                    setSelectedCategoryId(
                                        value as Id<"menuCategories">
                                    )
                            }}
                        >
                            <SelectTrigger className="h-10 w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {activeCategories.map((entry) => (
                                    <SelectItem
                                        key={entry._id}
                                        value={entry._id}
                                    >
                                        <span className="mr-2 inline-grid size-5 place-items-center rounded-md bg-muted text-xs font-semibold">
                                            {entry.name
                                                .slice(0, 1)
                                                .toUpperCase()}
                                        </span>
                                        {entry.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
                Description (optional)
                <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the dish for guests"
                    rows={3}
                />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3 text-sm">
                <span>
                    <span className="block font-medium">
                        Available to order
                    </span>
                    <span className="block text-xs text-muted-foreground">
                        Show this item on the guest menu.
                    </span>
                </span>
                <Switch
                    checked={available}
                    onCheckedChange={setAvailable}
                    aria-label={`Mark ${name || "item"} ${available ? "unavailable" : "available"}`}
                />
            </label>

            {!item ? (
                <div className="grid min-h-36 place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                    <div>
                        <span className="mx-auto grid size-10 place-items-center rounded-full border bg-background">
                            <ImagePlus className="size-5 text-muted-foreground" />
                        </span>
                        <p className="mt-3 text-sm font-medium">
                            Image available after saving
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Save this item first, then reopen it to select an
                            image.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-3">
                    <div>
                        <p className="text-sm font-medium">Product image</p>
                        <p className="text-xs text-muted-foreground">
                            Select an image from your device.
                        </p>
                    </div>
                    {item.imageUrl ? (
                        <div className="grid gap-2">
                            <div className="relative aspect-[16/9] max-h-52 overflow-hidden rounded-xl border bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element -- Convex signed storage URLs are runtime external URLs not configured for next/image. */}
                                <img
                                    src={item.imageUrl}
                                    alt={`${item.name} product image`}
                                    className="size-full object-cover"
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={() => void handleRemoveImage()}
                                    disabled={imagePending || pending}
                                    aria-label="Remove product image"
                                    title="Remove image"
                                    className="absolute top-2 right-2 size-8 bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                            <label
                                className={`flex min-h-9 items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm font-medium transition-colors ${imagePending || pending ? "pointer-events-none cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
                                aria-disabled={imagePending || pending}
                            >
                                {imagePending
                                    ? "Updating image..."
                                    : "Replace image"}
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    disabled={imagePending || pending}
                                    aria-label="Replace item image"
                                    className="sr-only"
                                />
                            </label>
                        </div>
                    ) : (
                        <label
                            className={`flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-5 text-center text-sm transition-colors ${imagePending || pending ? "pointer-events-none cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
                            aria-disabled={imagePending || pending}
                        >
                            <span className="grid size-10 place-items-center rounded-full border bg-background">
                                <ImagePlus className="size-5 text-muted-foreground" />
                            </span>
                            <span className="font-medium">
                                {imagePending
                                    ? "Updating image..."
                                    : "Select image"}
                            </span>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                disabled={imagePending || pending}
                                aria-label="Upload item image"
                                className="sr-only"
                            />
                        </label>
                    )}
                    {imageStatus && (
                        <p
                            className="text-sm text-muted-foreground"
                            role="status"
                        >
                            {imageStatus}
                        </p>
                    )}
                    <ErrorMessage
                        error={imageError}
                        fallback="Unable to update the item image. Please try again."
                    />
                </div>
            )}

            <ErrorMessage error={error} />
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={pending}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={pending || !selectedCategoryIsActive}
                >
                    {pending ? "Saving..." : item ? "Save changes" : "Add item"}
                </Button>
            </div>
        </form>
    )
}

function MenuItemCard({
    item,
    category,
    currency,
    onEdit,
    onManageCategory,
    onToggleAvailability,
    children,
}: {
    item: {
        _id: Id<"menuItems">
        name: string
        description?: string
        priceMinor: number
        available: boolean
        archived: boolean
        imageUrl: string | null
    }
    category: Doc<"menuCategories">
    currency?: string
    onEdit?: () => void
    onManageCategory?: () => void
    onToggleAvailability?: () => void
    children?: ReactNode
}) {
    return (
        <article className="group grid min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
            <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-muted text-sm text-muted-foreground">
                {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Convex signed storage URLs are runtime external URLs not configured for next/image.
                    <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="grid place-items-center gap-1 text-center">
                        <ImagePlus className="size-7 opacity-50" />
                        <span>No image added</span>
                    </div>
                )}
                <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1">
                    <Badge
                        variant={item.available ? "secondary" : "outline"}
                        className="bg-background/90 backdrop-blur-sm"
                    >
                        {item.available ? "Available" : "Unavailable"}
                    </Badge>
                    {item.archived && (
                        <Badge variant="destructive">Archived</Badge>
                    )}
                </div>
            </div>
            <div className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {category.name}
                        </p>
                        <h3 className="mt-1 truncate font-semibold">
                            {item.name}
                        </h3>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                        {formatMinorCurrency(item.priceMinor, currency)}
                    </span>
                </div>
                {item.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                    </p>
                )}
                {category.archived && (
                    <p className="text-xs text-muted-foreground">
                        Category archived
                    </p>
                )}
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 border-t px-3 py-2">
                {onToggleAvailability &&
                !item.archived &&
                !category.archived ? (
                    <label className="flex items-center gap-2 text-xs font-medium">
                        <Switch
                            checked={item.available}
                            onCheckedChange={onToggleAvailability}
                            aria-label={`Mark ${item.name} ${item.available ? "unavailable" : "available"}`}
                        />
                        Available
                    </label>
                ) : (
                    <span />
                )}
                <div className="flex items-center gap-1">
                    {onEdit && (
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={onEdit}
                            aria-label={`Edit ${item.name}`}
                            title="Edit item"
                        >
                            <Pencil className="size-4" />
                        </Button>
                    )}
                    {onManageCategory && (
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={onManageCategory}
                            aria-label={`Manage ${category.name}`}
                            title="Manage category"
                        >
                            <Layers3 className="size-4" />
                        </Button>
                    )}
                    {children}
                </div>
            </div>
        </article>
    )
}

type FocusedEditor =
    | { kind: "category"; id?: Id<"menuCategories"> }
    | { kind: "item"; id?: Id<"menuItems">; categoryId: Id<"menuCategories"> }

function FocusedEditorContent({
    restaurantId,
    categories,
    focusedEditor,
    focusedCategory,
    focusedItem,
    onDone,
}: {
    restaurantId: Id<"restaurants">
    categories: Doc<"menuCategories">[]
    focusedEditor: FocusedEditor
    focusedCategory?: Doc<"menuCategories">
    focusedItem?: Doc<"menuItems">
    onDone: () => void
}) {
    return (
        <div className="grid min-w-0 gap-4 overflow-hidden">
            {focusedEditor.kind === "category" && (
                <CategoryEditor
                    restaurantId={restaurantId}
                    category={focusedCategory}
                    onDone={onDone}
                    onCancel={onDone}
                />
            )}
            {focusedEditor.kind === "item" && (
                <div className="grid min-w-0 gap-4">
                    <ItemEditor
                        restaurantId={restaurantId}
                        categoryId={focusedEditor.categoryId}
                        categories={categories}
                        item={focusedItem}
                        onDone={onDone}
                        onCancel={onDone}
                    />
                </div>
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
    const [categoryFilter, setCategoryFilter] = useState<
        Id<"menuCategories"> | "all"
    >("all")
    const [showArchived, setShowArchived] = useState(false)
    const [focusedEditor, setFocusedEditor] = useState<FocusedEditor>()
    const [error, setError] = useState<unknown>()
    const [pending, setPending] = useState(false)
    const [confirm, setConfirm] = useState<{
        kind: "category" | "item"
        id: string
    }>()
    const [search, setSearch] = useState("")
    const [manageCategories, setManageCategories] = useState(false)
    if (categories === undefined || items === undefined)
        return <p role="status">Loading menu...</p>
    const active = categories.filter((category) => !category.archived)
    const visibleCategories = categories.filter(
        (category) => showArchived || !category.archived
    )
    const category =
        categories.find(
            (value) =>
                value._id === selected && (showArchived || !value.archived)
        ) ?? active[0]
    const query = search.trim().toLowerCase()
    const catalogItems = items.filter((item) => {
        const itemCategory = categories.find(
            (entry) => entry._id === item.categoryId
        )
        if (!itemCategory) return false
        return showArchived || (!item.archived && !itemCategory.archived)
    })
    const categoryItems = catalogItems
        .filter((item) =>
            categoryFilter === "all" ? true : item.categoryId === categoryFilter
        )
        .filter((item) => {
            const categoryName =
                categories.find((entry) => entry._id === item.categoryId)
                    ?.name ?? ""
            return (
                !query ||
                item.name.toLowerCase().includes(query) ||
                (item.description ?? "").toLowerCase().includes(query) ||
                categoryName.toLowerCase().includes(query)
            )
        })
    const visibleItems = categoryItems
        .map((item) => ({
            item,
            category: categories.find((entry) => entry._id === item.categoryId),
        }))
        .filter(
            (
                entry
            ): entry is {
                item: (typeof items)[number]
                category: Doc<"menuCategories">
            } => Boolean(entry.category)
        )
    const focusedEditorRecord = focusedEditor?.id
        ? focusedEditor.kind === "category"
            ? categories.find((value) => value._id === focusedEditor.id)
            : items.find((value) => value._id === focusedEditor.id)
        : undefined
    const visibleFocusedEditor =
        focusedEditor &&
        (!focusedEditor.id ||
            (focusedEditorRecord &&
                (showArchived || !focusedEditorRecord.archived)))
            ? focusedEditor
            : undefined
    const focusedCategory =
        visibleFocusedEditor?.kind === "category"
            ? categories.find((value) => value._id === visibleFocusedEditor.id)
            : undefined
    const focusedItem =
        visibleFocusedEditor?.kind === "item"
            ? items.find((value) => value._id === visibleFocusedEditor.id)
            : undefined
    async function run(action: () => Promise<unknown>) {
        if (pending) return
        setError(undefined)
        setPending(true)
        try {
            await action()
            return true
        } catch (e) {
            setError(e)
            return false
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
    async function moveItem(
        targetCategory: Doc<"menuCategories">,
        index: number,
        direction: -1 | 1
    ) {
        if (search.trim()) return
        const targetItems = (items ?? []).filter(
            (item) => item.categoryId === targetCategory._id && !item.archived
        )
        const next = [...targetItems]
        const target = index + direction
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target]!, next[index]!]
        await run(() =>
            reorderItems({
                restaurantId: restaurant._id,
                categoryId: targetCategory._id,
                orderedItemIds: next.map((value) => value._id),
            })
        )
    }
    return (
        <section className="mx-auto grid max-w-7xl min-w-0 gap-7 overflow-x-hidden font-sans break-words">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                        Owner workspace / menu
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                        Your menu, at a glance
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                        Keep every dish photo-ready and easy for guests to
                        discover on your QR menu.
                    </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                    <Button
                        type="button"
                        onClick={() => {
                            const target =
                                category && !category.archived
                                    ? category
                                    : active[0]
                            if (!target) {
                                setError(
                                    new Error(
                                        "Add a category before adding an item."
                                    )
                                )
                                return
                            }
                            setCategoryFilter(target._id)
                            setSelected(target._id)
                            setFocusedEditor({
                                kind: "item",
                                categoryId: target._id,
                            })
                        }}
                    >
                        <Plus className="mr-2 size-4" />
                        Add item
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setManageCategories((value) => !value)}
                    >
                        <Layers3 className="mr-2 size-4" />
                        Manage categories
                    </Button>
                    <Link
                        className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                        href={`/dashboard/${restaurant.slug}/tables`}
                    >
                        Tables
                    </Link>
                </div>
            </header>
            <div
                className="flex flex-col gap-3 sm:flex-row sm:items-center"
                aria-label="Menu search and filters"
            >
                <label className="relative min-w-0 flex-1 sm:max-w-md">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search dishes, descriptions, or categories"
                        aria-label="Search menu"
                        className="h-10 pl-9"
                    />
                </label>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(event) => {
                            const nextShowArchived = event.target.checked
                            setShowArchived(nextShowArchived)
                            if (!nextShowArchived && selected) {
                                const selectedCategory = categories.find(
                                    (value) => value._id === selected
                                )
                                if (selectedCategory?.archived) {
                                    setSelected(undefined)
                                    setCategoryFilter("all")
                                }
                            }
                        }}
                    />{" "}
                    Show archived
                </label>
            </div>
            <div
                className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
                aria-label="Menu categories"
            >
                <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    aria-pressed={categoryFilter === "all"}
                    className={`min-w-28 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        categoryFilter === "all"
                            ? "border-primary bg-primary/10"
                            : "bg-card hover:bg-accent"
                    }`}
                >
                    <span className="grid size-9 place-items-center rounded-lg bg-muted font-semibold">
                        A
                    </span>
                    <span className="mt-3 block text-sm font-semibold">
                        All items
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {catalogItems.length} dishes
                    </span>
                </button>
                {visibleCategories.map((value) => (
                    <button
                        key={value._id}
                        type="button"
                        onClick={() => {
                            setCategoryFilter(value._id)
                            setSelected(value._id)
                        }}
                        aria-pressed={categoryFilter === value._id}
                        className={`min-w-28 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                            categoryFilter === value._id
                                ? "border-primary bg-primary/10"
                                : "bg-card hover:bg-accent"
                        } ${value.archived ? "opacity-60" : ""}`}
                    >
                        <span className="grid size-9 place-items-center rounded-lg bg-muted font-semibold">
                            {value.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="mt-3 block max-w-28 truncate text-sm font-semibold">
                            {value.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {
                                catalogItems.filter(
                                    (item) => item.categoryId === value._id
                                ).length
                            }{" "}
                            dishes{value.archived ? " / archived" : ""}
                        </span>
                    </button>
                ))}
            </div>
            <ErrorMessage
                error={error}
                fallback="Unable to update the menu. Please try again."
            />
            {manageCategories && (
                <Card>
                    <CardHeader>
                        <CardTitle>Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-fit"
                            onClick={() =>
                                setFocusedEditor({ kind: "category" })
                            }
                        >
                            <Plus className="mr-2 size-4" />
                            Add category
                        </Button>
                        {categories.length === 0 ? (
                            <p
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                No categories yet. Add one above to start
                                building the menu.
                            </p>
                        ) : (
                            categories
                                .filter(
                                    (value) => showArchived || !value.archived
                                )
                                .map((value) => {
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
                                                onClick={() => {
                                                    setSelected(value._id)
                                                    setCategoryFilter(value._id)
                                                }}
                                                aria-pressed={
                                                    category?._id === value._id
                                                }
                                            >
                                                {value.name}
                                                {value.archived
                                                    ? " (archived)"
                                                    : ""}
                                            </Button>
                                            {!value.archived && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            setFocusedEditor({
                                                                kind: "category",
                                                                id: value._id,
                                                            })
                                                        }
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => {
                                                            setConfirm({
                                                                kind: "category",
                                                                id: value._id,
                                                            })
                                                        }}
                                                        disabled={pending}
                                                    >
                                                        Archive
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            void moveCategory(
                                                                index,
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
                                                            void moveCategory(
                                                                index,
                                                                1
                                                            )
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
                                                                categoryId:
                                                                    value._id,
                                                            })
                                                        )
                                                    }
                                                    disabled={pending}
                                                >
                                                    Restore
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })
                        )}
                    </CardContent>
                </Card>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map(({ item, category: itemCategory }) => {
                    const reorderList = items.filter(
                        (entry) =>
                            entry.categoryId === itemCategory._id &&
                            !entry.archived
                    )
                    const reorderIndex = reorderList.findIndex(
                        (entry) => entry._id === item._id
                    )
                    const searchPreventsReorder = Boolean(search.trim())
                    const moveUpDisabled =
                        pending || searchPreventsReorder || reorderIndex <= 0
                    const moveDownDisabled =
                        pending ||
                        searchPreventsReorder ||
                        reorderIndex < 0 ||
                        reorderIndex >= reorderList.length - 1
                    return (
                        <MenuItemCard
                            key={item._id}
                            item={item}
                            category={itemCategory}
                            currency={restaurant.currency}
                            onEdit={
                                !itemCategory.archived && !item.archived
                                    ? () =>
                                          setFocusedEditor({
                                              kind: "item",
                                              id: item._id,
                                              categoryId: itemCategory._id,
                                          })
                                    : undefined
                            }
                            onManageCategory={
                                !itemCategory.archived
                                    ? () =>
                                          setFocusedEditor({
                                              kind: "category",
                                              id: itemCategory._id,
                                          })
                                    : undefined
                            }
                            onToggleAvailability={
                                !itemCategory.archived && !item.archived
                                    ? () =>
                                          void run(() =>
                                              setAvailability({
                                                  itemId: item._id,
                                                  available: !item.available,
                                              })
                                          )
                                    : undefined
                            }
                        >
                            {!itemCategory.archived && !item.archived && (
                                <>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() =>
                                            setConfirm({
                                                kind: "item",
                                                id: item._id,
                                            })
                                        }
                                        disabled={pending}
                                        aria-label={`Archive ${item.name}`}
                                        title="Archive item"
                                    >
                                        <Archive className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() =>
                                            void moveItem(
                                                itemCategory,
                                                reorderIndex,
                                                -1
                                            )
                                        }
                                        disabled={moveUpDisabled}
                                        aria-label={`Move ${item.name} up`}
                                        title={
                                            searchPreventsReorder
                                                ? "Clear search to reorder items"
                                                : reorderIndex <= 0
                                                  ? "Already first in category"
                                                  : "Move up"
                                        }
                                    >
                                        <ChevronUp className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() =>
                                            void moveItem(
                                                itemCategory,
                                                reorderIndex,
                                                1
                                            )
                                        }
                                        disabled={moveDownDisabled}
                                        aria-label={`Move ${item.name} down`}
                                        title={
                                            searchPreventsReorder
                                                ? "Clear search to reorder items"
                                                : reorderIndex >=
                                                    reorderList.length - 1
                                                  ? "Already last in category"
                                                  : "Move down"
                                        }
                                    >
                                        <ChevronDown className="size-4" />
                                    </Button>
                                </>
                            )}
                            {item.archived && (
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() =>
                                        void run(() =>
                                            restoreItem({ itemId: item._id })
                                        )
                                    }
                                    disabled={pending}
                                    aria-label={`Restore ${item.name}`}
                                    title="Restore item"
                                >
                                    <ArchiveRestore className="size-4" />
                                </Button>
                            )}
                        </MenuItemCard>
                    )
                })}
            </div>
            {visibleItems.length === 0 && (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
                    <p className="font-medium">
                        {search.trim()
                            ? "No dishes match your search"
                            : "No menu items yet"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {search.trim()
                            ? "Try a different dish, description, or category."
                            : "Add an item to start building your visual menu."}
                    </p>
                </div>
            )}
            <Dialog
                open={Boolean(visibleFocusedEditor)}
                onOpenChange={(open) => !open && setFocusedEditor(undefined)}
            >
                <DialogContent
                    overlayClassName="bg-background/70 backdrop-blur-sm"
                    className="gap-0 p-0 sm:max-w-2xl"
                >
                    <DialogHeader className="relative border-b px-6 py-5 pr-12 text-left">
                        <DialogTitle>
                            {visibleFocusedEditor?.kind === "category"
                                ? focusedCategory
                                    ? `Edit ${focusedCategory.name}`
                                    : "Add category"
                                : focusedItem
                                  ? `Edit ${focusedItem.name}`
                                  : "Add menu item"}
                        </DialogTitle>
                        <DialogDescription>
                            {visibleFocusedEditor?.kind === "category"
                                ? "Organize the sections guests browse."
                                : "Add the details guests need to choose this dish."}
                        </DialogDescription>
                        <DialogClose
                            render={
                                <button
                                    type="button"
                                    aria-label="Close editor"
                                    title="Close editor"
                                    className="absolute top-5 right-5 rounded-md p-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <X className="size-4" />
                                </button>
                            }
                        />
                    </DialogHeader>
                    {visibleFocusedEditor && (
                        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-5">
                            <FocusedEditorContent
                                key={`${visibleFocusedEditor.kind}-${visibleFocusedEditor.id ?? "new"}-${visibleFocusedEditor.kind === "item" ? visibleFocusedEditor.categoryId : ""}`}
                                restaurantId={restaurant._id}
                                categories={categories}
                                focusedEditor={visibleFocusedEditor}
                                focusedCategory={focusedCategory}
                                focusedItem={focusedItem}
                                onDone={() => setFocusedEditor(undefined)}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={Boolean(confirm)}
                onOpenChange={(open) => !open && setConfirm(undefined)}
                title={`Archive this ${confirm?.kind === "item" ? "item" : "category"}?`}
                description="You can restore this record later."
                confirmLabel="Archive"
                cancelLabel="Cancel"
                pending={pending}
                onConfirm={async () => {
                    if (!confirm) return
                    const succeeded = await run(() =>
                        confirm.kind === "item"
                            ? archiveItem({
                                  itemId: confirm.id as Id<"menuItems">,
                              })
                            : archiveCategory({
                                  categoryId:
                                      confirm.id as Id<"menuCategories">,
                              })
                    )
                    if (!succeeded)
                        throw new Error("Unable to complete this action.")
                    if (confirm.kind === "category") {
                        setCategoryFilter("all")
                        if (selected === confirm.id) setSelected(undefined)
                        if (
                            focusedEditor?.kind === "category" &&
                            focusedEditor.id === confirm.id
                        )
                            setFocusedEditor(undefined)
                    }
                    setConfirm(undefined)
                }}
            />
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
