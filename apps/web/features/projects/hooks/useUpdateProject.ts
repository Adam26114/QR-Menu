"use client"

import { useMutation } from "convex/react"
import { projectsApi } from "../api/projects"

/** SOURCE OF TRUTH KEYWORDS: update project hook, Convex mutation, row update
 * WHAT: Returns the project update mutation.
 * WHY: Update state can be keyed by project ID without blocking other rows.
 * WHERE: ProjectsView uses this hook for edit forms.
 */
export function useUpdateProject() { return useMutation(projectsApi.update) }
