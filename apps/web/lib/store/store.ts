import { configureStore } from "@reduxjs/toolkit"
import uiReducer from "./slices/ui.slice"

/**
 * SOURCE OF TRUTH KEYWORDS: Redux store, UI state, configureStore, typed state
 * WHAT: Configures Redux Toolkit for client-only UI state.
 * WHY: Convex remains the source of truth for server data and query results.
 * WHERE: Providers supplies this store to the Next app.
 */
export const store = configureStore({ reducer: { ui: uiReducer } })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
