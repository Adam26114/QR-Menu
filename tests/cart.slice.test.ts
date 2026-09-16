import { configureStore } from "@reduxjs/toolkit"
import { describe, expect, it } from "vitest"
import cartReducer, {
    addCartItem,
    clearCart,
    loadPersistedCart,
    removeCartItem,
    selectCartItemCount,
    selectCartPayload,
    selectCartSubtotalMinor,
    setCartScope,
    updateCartQuantity,
} from "../apps/web/lib/store/slices/cart.slice"

const item = (overrides: Partial<Parameters<typeof addCartItem>[0]> = {}) => ({
    lineId: "line-1",
    itemId: "burger",
    name: "Burger",
    unitPriceMinor: 1000,
    quantity: 1,
    options: [],
    ...overrides,
})

const makeStore = () => configureStore({ reducer: cartReducer })

describe("cart slice", () => {
    it("merges identical items using canonical option order", () => {
        const store = makeStore()
        store.dispatch(addCartItem(item({ options: [{ choiceId: "b", name: "B", priceDeltaMinor: 0 }, { choiceId: "a", name: "A", priceDeltaMinor: 100 }], quantity: 2 })))
        store.dispatch(addCartItem(item({ lineId: "line-2", options: [{ choiceId: "a", name: "A", priceDeltaMinor: 100 }, { choiceId: "b", name: "B", priceDeltaMinor: 0 }], quantity: 3 })))
        expect(store.getState().items).toHaveLength(1)
        expect(store.getState().items[0].quantity).toBe(5)
    })

    it("keeps distinct options and notes as separate lines", () => {
        const store = makeStore()
        store.dispatch(addCartItem(item({ notes: "No onions" })))
        store.dispatch(addCartItem(item({ lineId: "line-2", options: [{ choiceId: "cheese", name: "Cheese", priceDeltaMinor: 100 }] })))
        expect(store.getState().items).toHaveLength(2)
    })

    it("updates quantity, removes at zero, and clears", () => {
        const store = makeStore()
        store.dispatch(addCartItem(item()))
        store.dispatch(updateCartQuantity({ lineId: "line-1", quantity: 4 }))
        expect(store.getState().items[0].quantity).toBe(4)
        store.dispatch(removeCartItem("line-1"))
        store.dispatch(addCartItem(item()))
        store.dispatch(updateCartQuantity({ lineId: "line-1", quantity: 0 }))
        expect(store.getState().items).toHaveLength(0)
        store.dispatch(addCartItem(item()))
        store.dispatch(clearCart())
        expect(store.getState().items).toHaveLength(0)
    })

    it("computes display selectors and a server-safe payload", () => {
        const store = makeStore()
        store.dispatch(addCartItem(item({ quantity: 2, options: [{ choiceId: "extra", name: "Extra", priceDeltaMinor: 300 }], notes: "Well done" })))
        const state = store.getState()
        expect(selectCartSubtotalMinor(state)).toBe(2600)
        expect(selectCartItemCount(state)).toBe(2)
        expect(selectCartPayload(state)).toEqual([{ itemId: "burger", quantity: 2, choiceIds: ["extra"], notes: "Well done" }])
    })

    it("isolates items when the restaurant/table scope changes", () => {
        const store = makeStore()
        store.dispatch(setCartScope({ restaurantSlug: "one", tableToken: "a" }))
        store.dispatch(addCartItem(item()))
        store.dispatch(setCartScope({ restaurantSlug: "one", tableToken: "a" }))
        expect(store.getState().items).toHaveLength(1)
        store.dispatch(setCartScope({ restaurantSlug: "two", tableToken: "b" }))
        expect(store.getState().items).toHaveLength(0)
    })

    it("ignores malformed and stale persisted values", () => {
        const malformed = { getItem: () => "not json" }
        const stale = { getItem: () => JSON.stringify({ version: 0, scope: null, items: [] }) }
        expect(loadPersistedCart(malformed)).toBeNull()
        expect(loadPersistedCart(stale)).toBeNull()
    })
})
