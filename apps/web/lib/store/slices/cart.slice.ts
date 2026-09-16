import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

export type CartScope = {
    restaurantSlug: string
    tableToken: string
}

export type CartItem = {
    lineId: string
    itemId: string
    name: string
    unitPriceMinor: number
    quantity: number
    options: Array<{
        choiceId: string
        name: string
        priceDeltaMinor: number
    }>
    notes?: string
}

export type CartState = {
    scope: CartScope | null
    items: CartItem[]
    hydrated: boolean
    submitting: boolean
}

export const CART_STORAGE_KEY = "pos-qr:cart:v1"

const initialState: CartState = {
    scope: null,
    items: [],
    hydrated: false,
    submitting: false,
}

const optionKey = (item: CartItem) =>
    [...item.options.map((option) => option.choiceId)].sort().join("\u0000")

const sameLine = (left: CartItem, right: CartItem) =>
    left.itemId === right.itemId &&
    optionKey(left) === optionKey(right) &&
    (left.notes ?? "") === (right.notes ?? "")

const newLineId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isScope = (value: unknown): value is CartScope => {
    if (!value || typeof value !== "object") return false
    const scope = value as Record<string, unknown>
    return (
        typeof scope.restaurantSlug === "string" &&
        typeof scope.tableToken === "string"
    )
}

const isItem = (value: unknown): value is CartItem => {
    if (!value || typeof value !== "object") return false
    const item = value as Record<string, unknown>
    return (
        typeof item.lineId === "string" &&
        typeof item.itemId === "string" &&
        typeof item.name === "string" &&
        typeof item.unitPriceMinor === "number" &&
        Number.isFinite(item.unitPriceMinor) &&
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        Array.isArray(item.options) &&
        item.options.every((option) => {
            if (!option || typeof option !== "object") return false
            const value = option as Record<string, unknown>
            return (
                typeof value.choiceId === "string" &&
                typeof value.name === "string" &&
                typeof value.priceDeltaMinor === "number" &&
                Number.isFinite(value.priceDeltaMinor)
            )
        }) &&
        (item.notes === undefined || typeof item.notes === "string")
    )
}

export type PersistedCart = {
    version: 1
    scope: CartScope | null
    items: CartItem[]
}

export function loadPersistedCart(storage: Pick<Storage, "getItem">): PersistedCart | null {
    try {
        const raw = storage.getItem(CART_STORAGE_KEY)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object") return null
        const value = parsed as Record<string, unknown>
        if (
            value.version !== 1 ||
            (value.scope !== null && !isScope(value.scope)) ||
            !Array.isArray(value.items) ||
            !value.items.every(isItem)
        ) {
            return null
        }
        return {
            version: 1,
            scope: value.scope as CartScope | null,
            items: value.items as CartItem[],
        }
    } catch {
        return null
    }
}

export function persistCart(
    storage: Pick<Storage, "setItem">,
    state: Pick<CartState, "scope" | "items">,
) {
    try {
        storage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify({ version: 1, scope: state.scope, items: state.items }),
        )
    } catch {
        // Persistence is best-effort; the Redux state remains usable when storage is unavailable.
    }
}

const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        setCartScope: (state, action: PayloadAction<CartScope | null>) => {
            const next = action.payload
            if (
                state.scope?.restaurantSlug !== next?.restaurantSlug ||
                state.scope?.tableToken !== next?.tableToken
            ) {
                state.items = []
            }
            state.scope = next
        },
        addCartItem: (state, action: PayloadAction<CartItem>) => {
            const item = action.payload
            const existing = state.items.find((candidate) => sameLine(candidate, item))
            if (existing) {
                existing.quantity += item.quantity
            } else {
                state.items.push({ ...item, lineId: item.lineId || newLineId() })
            }
        },
        updateCartQuantity: (
            state,
            action: PayloadAction<{ lineId: string; quantity: number }>,
        ) => {
            const item = state.items.find((candidate) => candidate.lineId === action.payload.lineId)
            if (!item) return
            if (action.payload.quantity <= 0) {
                state.items = state.items.filter((candidate) => candidate.lineId !== action.payload.lineId)
            } else {
                item.quantity = action.payload.quantity
            }
        },
        removeCartItem: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter((item) => item.lineId !== action.payload)
        },
        clearCart: (state) => {
            state.items = []
        },
        setCartSubmitting: (state, action: PayloadAction<boolean>) => {
            state.submitting = action.payload
        },
        markCartHydrated: (state) => {
            state.hydrated = true
        },
        restoreCart: (state, action: PayloadAction<PersistedCart | null>) => {
            if (action.payload) {
                state.scope = action.payload.scope
                state.items = action.payload.items
            }
            state.hydrated = true
        },
    },
})

export const {
    setCartScope,
    addCartItem,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    setCartSubmitting,
    markCartHydrated,
    restoreCart,
} = cartSlice.actions

export const selectCartSubtotalMinor = (state: CartState) =>
    state.items.reduce(
        (total, item) =>
            total +
            (item.unitPriceMinor +
                item.options.reduce((optionsTotal, option) => optionsTotal + option.priceDeltaMinor, 0)) *
                item.quantity,
        0,
    )
export const selectCartItemCount = (state: CartState) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
export const selectCartPayload = (state: CartState) =>
    state.items.map(({ itemId, quantity, options, notes }) => ({
        itemId,
        quantity,
        choiceIds: options.map((option) => option.choiceId).sort(),
        notes,
    }))

export default cartSlice.reducer
