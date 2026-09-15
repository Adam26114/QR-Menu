import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

/** SOURCE OF TRUTH KEYWORDS: UI slice, project form, Redux local state
 * WHAT: Stores transient UI state only.
 * WHY: Server-owned project data stays in Convex queries.
 * WHERE: Project screens can use this for modal visibility.
 */
const uiSlice = createSlice({ name: "ui", initialState: { projectFormOpen: true }, reducers: {
  setProjectFormOpen: (state, action: PayloadAction<boolean>) => { state.projectFormOpen = action.payload },
} })
export const { setProjectFormOpen } = uiSlice.actions
export default uiSlice.reducer
