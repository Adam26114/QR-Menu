"use client"

import { useMutation } from "convex/react"
import { projectsApi } from "../api/projects"

/** SOURCE OF TRUTH KEYWORDS: create project hook, Convex mutation, create pending
 * WHAT: Returns the project creation mutation.
 * WHY: Create pending state stays independent from row operations.
 * WHERE: ProjectsView uses this hook for the create form.
 */
export function useCreateProject() { return useMutation(projectsApi.create) }
