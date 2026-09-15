import { api } from "../../../../../convex/_generated/api"

/**
 * SOURCE OF TRUTH KEYWORDS: projects API, generated Convex references, project operations
 * WHAT: Exposes the generated project function references to the feature layer.
 * WHY: Feature components should use Convex's generated API rather than handwritten endpoints.
 * WHERE: Project hooks consume these references for reactive data and mutations.
 */
export const projectsApi = api.projects
