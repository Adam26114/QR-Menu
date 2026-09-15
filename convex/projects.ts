import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import { createProject, deleteProject, listProjects, updateProject } from "./model/projects"

/**
 * SOURCE OF TRUTH KEYWORDS: projects API, public query, public mutation, owner scoped CRUD
 * WHAT: Exposes the minimal validated project API to the client.
 * WHY: Public functions remain thin while the model owns business rules.
 * WHERE: The projects feature UI calls these generated references.
 */
export const list = protectedQuery({ args: { paginationOpts: paginationOptsValidator }, handler: (ctx, args) => listProjects(ctx, ctx.identity.subject, args.paginationOpts) })
export const create = protectedMutation({ args: { name: v.string(), description: v.optional(v.string()) }, handler: (ctx, args) => createProject(ctx, ctx.identity.subject, args.name, args.description) })
export const update = protectedMutation({ args: { projectId: v.id("projects"), name: v.string(), description: v.optional(v.string()) }, handler: (ctx, args) => updateProject(ctx, ctx.identity.subject, args.projectId, args.name, args.description) })
export const remove = protectedMutation({ args: { projectId: v.id("projects") }, handler: (ctx, args) => deleteProject(ctx, ctx.identity.subject, args.projectId) })
