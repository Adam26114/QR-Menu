import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import type { PaginationOptions } from "convex/server"
import { expectedError, ERROR_CODES } from "../lib/errors"

type ProjectContext = QueryCtx | MutationCtx

const PROJECT_NAME_MAX_LENGTH = 120
const PROJECT_DESCRIPTION_MAX_LENGTH = 500

/**
 * SOURCE OF TRUTH KEYWORDS: project name validation, normalized project input
 * WHAT: Trims and bounds names before they reach the database.
 * WHY: Model functions are also safe when called directly, outside the public API.
 * WHERE: Project creation and updates use this validation boundary.
 */
function normalizeProjectName(name: string): string {
  const normalizedName = name.trim()
  if (!normalizedName)
    throw expectedError(
      ERROR_CODES.VALIDATION_FAILED,
      "Project name is required"
    )
  if (normalizedName.length > PROJECT_NAME_MAX_LENGTH) {
    throw expectedError(
      ERROR_CODES.VALIDATION_FAILED,
      `Project name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer`
    )
  }
  return normalizedName
}

/**
 * SOURCE OF TRUTH KEYWORDS: project model, owner scope, project CRUD, direct database access
 * WHAT: Contains project persistence and ownership checks.
 * WHY: Business rules and direct ctx.db access stay out of the public API layer.
 * WHERE: convex/projects.ts delegates every project operation here.
 */
export function listProjects(
  ctx: QueryCtx,
  tokenIdentifier: string,
  paginationOpts: PaginationOptions
) {
  // Legacy ownerId-only documents are intentionally not exposed; PRD retires the starter Projects surface without migration.
  return ctx.db
    .query("projects")
    .withIndex("by_token_identifier_updated", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier)
    )
    .order("desc")
    .paginate(paginationOpts)
}

export async function createProject(
  ctx: MutationCtx,
  tokenIdentifier: string,
  name: string,
  description?: string
): Promise<Id<"projects">> {
  const now = Date.now()
  return await ctx.db.insert("projects", {
    tokenIdentifier,
    name: normalizeProjectName(name),
    description: normalizeDescription(description),
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateProject(
  ctx: MutationCtx,
  tokenIdentifier: string,
  projectId: Id<"projects">,
  name: string,
  description?: string
): Promise<void> {
  const project = await getOwnedProject(ctx, tokenIdentifier, projectId)
  await ctx.db.patch("projects", project._id, {
    name: normalizeProjectName(name),
    description: normalizeDescription(description),
    updatedAt: Date.now(),
  })
}

export async function deleteProject(
  ctx: MutationCtx,
  tokenIdentifier: string,
  projectId: Id<"projects">
): Promise<void> {
  const project = await getOwnedProject(ctx, tokenIdentifier, projectId)
  await ctx.db.delete("projects", project._id)
}

function normalizeDescription(description?: string): string | undefined {
  const normalizedDescription = description?.trim()
  if (
    normalizedDescription &&
    normalizedDescription.length > PROJECT_DESCRIPTION_MAX_LENGTH
  ) {
    throw expectedError(
      ERROR_CODES.VALIDATION_FAILED,
      `Description must be ${PROJECT_DESCRIPTION_MAX_LENGTH} characters or fewer`
    )
  }
  return normalizedDescription || undefined
}

async function getOwnedProject(
  ctx: ProjectContext,
  tokenIdentifier: string,
  projectId: Id<"projects">
): Promise<Doc<"projects">> {
  const project = await ctx.db.get("projects", projectId)
  if (!project) throw expectedError(ERROR_CODES.NOT_FOUND, "Project not found")
  if (project.tokenIdentifier !== tokenIdentifier)
    throw expectedError(ERROR_CODES.FORBIDDEN, "You cannot access this project")
  return project
}
