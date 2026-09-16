"use client"

import { useMutation } from "convex/react"
import { projectsApi } from "../api/projects"

/** SOURCE OF TRUTH KEYWORDS: delete project hook, Convex mutation, row deletion
 * WHAT: Returns the project deletion mutation.
 * WHY: Delete confirmation and pending state stay scoped to one row.
 * WHERE: ProjectsView uses this hook for confirmed deletions.
 */
export function useDeleteProject() {
    return useMutation(projectsApi.remove)
}
