import { customAction, customMutation, customQuery } from "convex-helpers/server/customFunctions"
import { action, mutation, query } from "../_generated/server"
import { expectedError, ERROR_CODES } from "./errors"

/**
 * SOURCE OF TRUTH KEYWORDS: protected query, protected mutation, identity, authentication wrapper
 * WHAT: Provides builders that require a Convex identity before executing user-data functions.
 * WHY: Authentication is centralized so every domain function follows the same security boundary.
 * WHERE: Public domain APIs build all user-data queries and mutations from these wrappers.
 */
const requireIdentity = {
  args: {},
  input: async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw expectedError(ERROR_CODES.AUTH_REQUIRED, "Authentication required")
    return { ctx: { identity }, args: {} }
  },
}

export const protectedQuery = customQuery(query, requireIdentity)
export const protectedMutation = customMutation(mutation, requireIdentity)
export const protectedAction = customAction(action, requireIdentity)
