import { configureStore, type Middleware } from "@reduxjs/toolkit"
import cartReducer, {
    loadPersistedCart,
    persistCart,
    restoreCart,
} from "./slices/cart.slice"

/**
 * SOURCE OF TRUTH KEYWORDS: Redux store, UI state, configureStore, typed state
 * WHAT: Configures Redux Toolkit for client-only UI state.
 * WHY: Convex remains the source of truth for server data and query results.
 * WHERE: Providers supplies this store to the Next app.
 */
export const store = configureStore({
    reducer: { cart: cartReducer },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(((api) => (next) => (action) => {
            const result = next(action)
            if (typeof window !== "undefined" && typeof action === "object" && action !== null && "type" in action && typeof action.type === "string" && action.type.startsWith("cart/")) {
                persistCart(window.localStorage, api.getState().cart)
            }
            return result
        }) satisfies Middleware),
})

if (typeof window !== "undefined") {
    const persisted = loadPersistedCart(window.localStorage)
    store.dispatch(restoreCart(persisted))
}
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
