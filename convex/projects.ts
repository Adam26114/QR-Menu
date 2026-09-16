import {
    paginationOptsValidator,
    paginationResultValidator,
} from "convex/server"
import { v } from "convex/values"
import { protectedMutation, protectedQuery } from "./lib/customFunctions"
import {
    createProject,
    deleteProject,
    listProjects,
    updateProject,
} from "./model/projects"

/**
 * SOURCE OF TRUTH KEYWORDS: projects API, public query, public mutation, owner scoped CRUD
 * WHAT: Exposes the minimal validated project API to the client.
 * WHY: Public functions remain thin while the model owns business rules.
 * WHERE: The projects feature UI calls these generated references.
 */
const project = v.object({
    _id: v.id("projects"),
    _creationTime: v.number(),
    tokenIdentifier: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})

export const list = protectedQuery({
    args: { paginationOpts: paginationOptsValidator },
    returns: paginationResultValidator(project),
    handler: (ctx, args) =>
        listProjects(ctx, ctx.identity.tokenIdentifier, args.paginationOpts),
})
export const create = protectedMutation({
    args: { name: v.string(), description: v.optional(v.string()) },
    returns: v.id("projects"),
    handler: (ctx, args) =>
        createProject(
            ctx,
            ctx.identity.tokenIdentifier,
            args.name,
            args.description
        ),
})
export const update = protectedMutation({
    args: {
        projectId: v.id("projects"),
        name: v.string(),
        description: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await updateProject(
            ctx,
            ctx.identity.tokenIdentifier,
            args.projectId,
            args.name,
            args.description
        )
        return null
    },
})
export const remove = protectedMutation({
    args: { projectId: v.id("projects") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await deleteProject(ctx, ctx.identity.tokenIdentifier, args.projectId)
        return null
    },
})
