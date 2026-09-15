import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "./store"

/** SOURCE OF TRUTH KEYWORDS: typed Redux hooks, dispatch, selector
 * WHAT: Exposes typed Redux hooks.
 * WHY: Components avoid untyped store access.
 * WHERE: Client UI components use these hooks for local state.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
