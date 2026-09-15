import { createClient } from "@convex-dev/better-auth"
import type { GenericCtx } from "@convex-dev/better-auth"
import { components } from "./_generated/api"
import { query } from "./_generated/server"
import authSchema from "./betterAuth/schema"
import type { DataModelFromSchemaDefinition } from "convex/server"
import { v } from "convex/values"

type AuthDataModel = DataModelFromSchemaDefinition<typeof authSchema>

const authComponent = createClient<AuthDataModel, typeof authSchema>(components.betterAuth, {
  local: { schema: authSchema },
})

/**
 * SOURCE OF TRUTH KEYWORDS: current user, Better Auth client API, authenticated identity
 * WHAT: Exposes the component's current-user query to the app.
 * WHY: Client code can read the authenticated user without duplicating auth storage.
 * WHERE: Auth-aware UI may call api.auth.getAuthUser.
 */
export const { getAuthUser } = authComponent.clientApi()

/**
 * SOURCE OF TRUTH KEYWORDS: admin authorization, persisted Better Auth role
 * WHAT: Derives the current Better Auth user from the authenticated Convex context and checks its stored role.
 * WHY: Admin access must not depend on client-provided role or session metadata.
 * WHERE: Admin-only UI routes use this result as their server-backed authorization seam.
 */
export const isAdmin = query({
  args: {},
  returns: v.object({ authorized: v.boolean() }),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx as GenericCtx<AuthDataModel>)
    return { authorized: user?.role === "admin" }
  },
})
