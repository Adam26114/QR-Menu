"use client"

import { usePaginatedQuery } from "convex/react"
import { projectsApi } from "../api/projects"

/**
 * SOURCE OF TRUTH KEYWORDS: projects pagination, usePaginatedQuery, cursor, bounded page
 * WHAT: Provides the reactive paginated project collection.
 * WHY: Convex owns cursor state and avoids duplicating server data in client state.
 * WHERE: ProjectsView renders pages and requests more records.
 */
export function useProjects() {
    return usePaginatedQuery(projectsApi.list, {}, { initialNumItems: 10 })
}
