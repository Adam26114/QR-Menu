"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Minus, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react"

import { api } from "../../../../../../../convex/_generated/api"
import type { Id } from "../../../../../../../convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAppDispatch, useAppSelector } from "../../../../../lib/store/hooks"
import { addCartItem, clearCart, removeCartItem, selectCartItemCount, selectCartPayload, selectCartSubtotalMinor, setCartScope, setCartSubmitting, updateCartQuantity } from "../../../../../lib/store/slices/cart.slice"

type MenuChoice = { choiceId: string; name: string; priceDeltaMinor: number }
type OptionGroup = { groupId: string; name: string; selectionMode: "single" | "multiple"; required: boolean; minSelections: number; maxSelections: number; choices: MenuChoice[] }
type MenuItem = { itemId: string; name: string; description?: string | null; priceMinor: number; available: boolean; imageUrl: string | null; options: OptionGroup[] }

function routeParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? "" }

function money(minor: number, currency?: string) {
    if (!currency) return (minor / 100).toFixed(2)
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100) } catch { return (minor / 100).toFixed(2) }
}

function delta(minor: number, currency?: string) { return minor === 0 ? "" : `${minor > 0 ? "+" : "-"}${money(Math.abs(minor), currency)}` }

function errorText(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (/closed|hours|unavailable|conflict/i.test(message)) return message
    return "We could not place that order. Please check your cart and try again."
}

function useDialogFocusTrap(open: boolean, onClose: () => void, initialFocusRef: RefObject<HTMLElement | null>) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLElement | null>(null)
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose }, [onClose])
    useEffect(() => {
        if (!open) return
        triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        initialFocusRef.current?.focus()
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return }
            if (event.key !== "Tab") return
            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")
             if (!focusable?.length) return
             const first = focusable[0]
             const last = focusable[focusable.length - 1]
             if (!first || !last) return
             if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => {
            document.removeEventListener("keydown", handleKeyDown)
            if (triggerRef.current?.isConnected) triggerRef.current.focus()
        }
    }, [open, initialFocusRef])
    return dialogRef
}

function ItemConfigurator({ item, currency, onClose }: { item: MenuItem; currency?: string; onClose: () => void }) {
    const dispatch = useAppDispatch()
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useDialogFocusTrap(true, onClose, closeButtonRef)
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState("")
    const [selected, setSelected] = useState<Record<string, string[]>>({})
    const [error, setError] = useState("")

    const toggle = (group: OptionGroup, choiceId: string) => {
        setSelected((current) => {
            const values = current[group.groupId] ?? []
            if (group.selectionMode === "single") return { ...current, [group.groupId]: [choiceId] }
            if (values.includes(choiceId)) return { ...current, [group.groupId]: values.filter((id) => id !== choiceId) }
            if (values.length >= group.maxSelections) return current
            return { ...current, [group.groupId]: [...values, choiceId] }
        })
    }
    const add = () => {
        const invalid = item.options.find((group) => {
            const count = selected[group.groupId]?.length ?? 0
            return count < group.minSelections || count > group.maxSelections
        })
        if (invalid) { setError(`${invalid.name}: choose ${invalid.minSelections === invalid.maxSelections ? invalid.minSelections : `${invalid.minSelections}-${invalid.maxSelections}`} option${invalid.minSelections === 1 && invalid.maxSelections === 1 ? "" : "s"}.`); return }
        const options = item.options.flatMap((group) => (selected[group.groupId] ?? []).map((choiceId) => {
            const choice = group.choices.find((candidate) => candidate.choiceId === choiceId)!
            return { choiceId: choice.choiceId, name: choice.name, priceDeltaMinor: choice.priceDeltaMinor }
        }))
        dispatch(addCartItem({ lineId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`, itemId: item.itemId, name: item.name, unitPriceMinor: item.priceMinor, quantity, options, notes: notes.trim() || undefined }))
        onClose()
    }
    const selectedPrice = item.priceMinor + item.options.flatMap((g) => selected[g.groupId] ?? []).reduce((total, id) => total + (item.options.flatMap((g) => g.choices).find((c) => c.choiceId === id)?.priceDeltaMinor ?? 0), 0)
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
        <div ref={dialogRef} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="configurator-title">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
                <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Customize your plate</p><h2 id="configurator-title" className="mt-1 text-2xl font-semibold tracking-tight">{item.name}</h2></div>
                <Button ref={closeButtonRef} variant="ghost" size="icon" aria-label="Close item configurator" onClick={onClose}><X /></Button>
            </div>
            <div className="space-y-6 px-5 py-6 sm:px-7">
                {item.options.map((group) => { const values = selected[group.groupId] ?? []; return <fieldset key={group.groupId} className="space-y-3"><legend className="flex w-full justify-between gap-4 text-sm font-semibold"><span>{group.name}</span><span className="font-normal text-muted-foreground">{group.required ? "Required" : "Optional"} · {group.selectionMode === "single" ? "Choose one" : `Up to ${group.maxSelections}`}</span></legend><div className="grid gap-2 sm:grid-cols-2">{group.choices.map((choice) => { const checked = values.includes(choice.choiceId); return <label key={choice.choiceId} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors ${checked ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}><input type={group.selectionMode === "single" ? "radio" : "checkbox"} name={`group-${group.groupId}`} checked={checked} onChange={() => toggle(group, choice.choiceId)} className="size-4 accent-primary" /> <span className="flex-1 text-sm">{choice.name}</span>{choice.priceDeltaMinor !== 0 && <span className="text-xs tabular-nums text-muted-foreground">{delta(choice.priceDeltaMinor, currency)}</span>}</label> })}</div></fieldset> })}
                <div className="space-y-2"><label htmlFor="item-notes" className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></label><Textarea id="item-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any requests for the kitchen?" rows={3} /></div>
                {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5"><div className="flex items-center gap-2 rounded-xl border p-1"><Button variant="ghost" size="icon-sm" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}><Minus /></Button><span className="w-8 text-center font-semibold tabular-nums">{quantity}</span><Button variant="ghost" size="icon-sm" aria-label="Increase quantity" onClick={() => setQuantity((value) => value + 1)}><Plus /></Button></div><Button size="lg" onClick={add}><ShoppingBag /> Add to cart · {money(selectedPrice * quantity, currency)}</Button></div>
            </div>
        </div>
    </div>
}

 function CartPanel({ currency, onCheckout, submitting }: { currency?: string; onCheckout: () => void; submitting: boolean }) {
    const dispatch = useAppDispatch()
    const cart = useAppSelector((state) => state.cart)
    const count = useAppSelector((state) => selectCartItemCount(state.cart))
    const subtotal = useAppSelector((state) => selectCartSubtotalMinor(state.cart))
    return <Card className="sticky top-6 gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/30 py-5"><CardTitle className="flex items-center justify-between text-lg">Your order <span className="text-sm font-normal text-muted-foreground">{count} {count === 1 ? "item" : "items"}</span></CardTitle></CardHeader><CardContent className="space-y-4 p-4">{cart.items.length === 0 ? <div className="py-8 text-center"><ShoppingBag className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 text-sm text-muted-foreground">Your order is empty.</p><p className="mt-1 text-xs text-muted-foreground">Add something delicious to get started.</p></div> : <><div className="space-y-4">{cart.items.map((item) => { const unit = item.unitPriceMinor + item.options.reduce((sum, option) => sum + option.priceDeltaMinor, 0); return <div key={item.lineId} className="space-y-2 border-b pb-4 last:border-0"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{item.name}</p>{item.options.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{item.options.map((o) => o.name).join(", ")}</p>}{item.notes && <p className="mt-1 text-xs italic text-muted-foreground">{item.notes}</p>}</div><span className="text-sm font-medium tabular-nums">{money(unit * item.quantity, currency)}</span></div><div className="flex items-center justify-between"><div className="flex items-center gap-1 rounded-lg border p-0.5"><Button variant="ghost" size="icon-xs" aria-label={`Decrease ${item.name}`} onClick={() => dispatch(updateCartQuantity({ lineId: item.lineId, quantity: item.quantity - 1 }))}><Minus /></Button><span className="w-6 text-center text-xs font-semibold tabular-nums">{item.quantity}</span><Button variant="ghost" size="icon-xs" aria-label={`Increase ${item.name}`} onClick={() => dispatch(updateCartQuantity({ lineId: item.lineId, quantity: item.quantity + 1 }))}><Plus /></Button></div><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => dispatch(removeCartItem(item.lineId))}><Trash2 /> Remove</Button></div></div> })}</div><div className="flex items-center justify-between border-t pt-4 text-sm"><span>Subtotal</span><strong className="text-base tabular-nums">{money(subtotal, currency)}</strong></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => dispatch(clearCart())}>Clear</Button><Button className="flex-[2]" disabled={submitting} onClick={onCheckout}>{submitting ? "Sending..." : "Place order"}</Button></div></>}</CardContent></Card>
}

export default function PublicTableMenuPage() {
    const params = useParams<{ restaurantSlug: string | string[]; tableToken: string | string[] }>()
    const restaurantSlug = routeParam(params.restaurantSlug); const tableToken = routeParam(params.tableToken)
    const menu = useQuery(api.tables.resolvePublic, { restaurantSlug, tableToken })
    const submit = useMutation(api.orders.submitPublic); const router = useRouter(); const dispatch = useAppDispatch()
    const cart = useAppSelector((state) => state.cart); const count = useAppSelector((state) => selectCartItemCount(state.cart)); const subtotal = useAppSelector((state) => selectCartSubtotalMinor(state.cart))
    const [search, setSearch] = useState(""); const [activeItem, setActiveItem] = useState<MenuItem | null>(null); const [cartOpen, setCartOpen] = useState(false); const [submitError, setSubmitError] = useState("")
    const cartTriggerRef = useRef<HTMLButtonElement>(null); const cartCloseButtonRef = useRef<HTMLButtonElement>(null); const cartDialogRef = useDialogFocusTrap(cartOpen, () => setCartOpen(false), cartCloseButtonRef)
    const idempotencyKeyRef = useRef<string | null>(null)
    useEffect(() => { dispatch(setCartScope({ restaurantSlug, tableToken })) }, [dispatch, restaurantSlug, tableToken])
    const filtered = useMemo(() => menu?.categories.map((category) => ({ ...category, items: category.items.filter((item) => `${item.name} ${item.description ?? ""} ${category.name}`.toLowerCase().includes(search.toLowerCase())) })).filter((category) => category.items.length > 0) ?? [], [menu, search])
    const cartAttemptSignature = JSON.stringify({ scope: cart.scope, payload: selectCartPayload(cart) })
    useEffect(() => { idempotencyKeyRef.current = null }, [cartAttemptSignature])
    const currency = menu?.restaurant.currency
    const checkout = async () => { if (cart.scope?.restaurantSlug !== restaurantSlug || cart.scope?.tableToken !== tableToken || count === 0 || cart.submitting) return; setSubmitError(""); const idempotencyKey = idempotencyKeyRef.current ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`); idempotencyKeyRef.current = idempotencyKey; dispatch(setCartSubmitting(true)); try { const result = await submit({ restaurantSlug, tableToken, idempotencyKey, items: selectCartPayload(cart) as Array<{ itemId: Id<"menuItems">; quantity: number; choiceIds: Id<"menuOptionChoices">[]; notes?: string }> }); idempotencyKeyRef.current = null; dispatch(clearCart()); router.push(`/s/${restaurantSlug}/order/${result.trackingToken}`) } catch (error) { setSubmitError(errorText(error)) } finally { dispatch(setCartSubmitting(false)) } }
    if (menu === undefined) return <main className="min-h-screen bg-muted/20 px-4 py-12"><div className="mx-auto max-w-xl"><Card><CardContent className="flex min-h-40 items-center justify-center text-sm text-muted-foreground" role="status">Loading menu...</CardContent></Card></div></main>
    if (menu === null) return <main className="min-h-screen bg-muted/20 px-4 py-12"><Card className="mx-auto max-w-xl"><CardHeader><CardTitle>Menu unavailable</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">This table menu is no longer available. Ask a team member for a new QR code.</p></CardContent></Card></main>
    return <main className="min-h-screen bg-[#fbfaf7] pb-28 text-foreground"><div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8"><header className="relative overflow-hidden rounded-3xl bg-[#193c35] px-6 py-8 text-[#f5f0df] shadow-xl sm:px-10 sm:py-12"><div className="absolute -right-12 -top-16 size-56 rounded-full border-[24px] border-[#d6a84f]/25" aria-hidden="true" /><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d6a84f]">{menu.table.name} · now serving</p><h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">{menu.restaurant.name}</h1><p className="mt-4 max-w-lg text-sm leading-6 text-[#dfe6d9]">Take your time. Everything is made to order.</p></header><div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The menu</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">What are you in the mood for?</h2></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search menu" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dishes or categories" className="h-10 rounded-full pl-9" /></div></div><div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-10">{filtered.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No dishes match “{search}”.</CardContent></Card> : filtered.map((category) => <section key={category.categoryId} aria-labelledby={`category-${category.categoryId}`}><div className="mb-4 flex items-center gap-3"><h3 id={`category-${category.categoryId}`} className="text-xl font-semibold tracking-tight">{category.name}</h3><div className="h-px flex-1 bg-border" aria-hidden="true" /></div><div className="grid gap-3">{category.items.map((item) => <Card key={item.itemId} className={`overflow-hidden py-0 transition-shadow ${item.available ? "hover:shadow-md" : "opacity-70"}`}><div className="flex min-h-36">{item.imageUrl && <Image src={item.imageUrl} alt={`${item.name} from ${menu.restaurant.name}`} width={180} height={180} unoptimized className="hidden w-32 shrink-0 object-cover sm:block" />}<div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5"><div><div className="flex items-start justify-between gap-3"><h4 className="font-semibold">{item.name}</h4><span className="shrink-0 font-semibold tabular-nums">{money(item.priceMinor, currency)}</span></div>{item.description && <p className="mt-2 text-sm leading-5 text-muted-foreground">{item.description}</p>}</div><div className="mt-4">{item.available ? <Button size="sm" onClick={() => setActiveItem(item)}><Plus /> Add</Button> : <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Unavailable</span>}</div></div></div></Card>)}</div></section>)}</div><aside className="hidden lg:block"><CartPanel currency={currency} onCheckout={checkout} submitting={cart.submitting} />{submitError && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{submitError}</p>}</aside></div></div><div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 shadow-2xl backdrop-blur lg:hidden"><Button ref={cartTriggerRef} className="mx-auto flex h-12 w-full max-w-2xl justify-between rounded-xl px-4" onClick={() => setCartOpen(true)}><span className="flex items-center gap-2"><ShoppingBag /> View order <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">{count}</span></span><span className="tabular-nums">{money(subtotal, currency)} <span aria-hidden="true">→</span></span></Button></div>{cartOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><div ref={cartDialogRef} className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-background p-4" role="dialog" aria-modal="true" aria-labelledby="cart-title"><h2 id="cart-title" className="sr-only">Your order</h2><div className="mb-2 flex justify-end"><Button ref={cartCloseButtonRef} variant="ghost" size="icon" aria-label="Close order" onClick={() => setCartOpen(false)}><X /></Button></div><CartPanel currency={currency} onCheckout={checkout} submitting={cart.submitting} />{submitError && <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{submitError}</p>}</div></div>}{activeItem && <ItemConfigurator item={activeItem} currency={currency} onClose={() => setActiveItem(null)} />}</main>
}
