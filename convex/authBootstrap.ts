import { internalMutation, query } from "./_generated/server"
import { components, internal } from "./_generated/api"
import { v } from "convex/values"
import {
  getFinalizationRetryDelayMs,
  MAX_FINALIZATION_RETRIES,
  isPendingBootstrapRoleRequest,
  resolveFinalizedRole,
  resolveSignupCorrelationId,
  sanitizeSignupCorrelationId,
  shouldScheduleRoleClaimReconciliation,
} from "./authBootstrapPolicy"

export const isBootstrapAvailable = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("authBootstrap")
      .withIndex("by_key", (query) => query.eq("key", "singleton"))
      .unique()
    return existing === null
  },
})

/** Promotes the first persisted user, after Better Auth has committed it. */
export const finalizeRoleClaim = internalMutation({
  args: {
    userId: v.string(),
    retryAttempt: v.optional(v.number()),
    correlationId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", operator: "eq", value: args.userId }],
    })
    if (user === null) return null

    const existing = await ctx.db
      .query("authBootstrap")
      .withIndex("by_key", (query) => query.eq("key", "singleton"))
      .unique()

    // The bootstrap row is the durable decision. This is important when the
    // Better Auth user was committed but the component update failed: a
    // retry must not reinterpret the request as a later-user signup.
    const role = resolveFinalizedRole(
      existing,
      args.userId,
      user.bootstrapRoleRequest,
    )
    if (existing === null) {
      await ctx.db.insert("authBootstrap", {
        key: "singleton",
        role,
        winnerUserId: args.userId,
      })
    }

    try {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", operator: "eq", value: args.userId }],
          update: { role, bootstrapRoleRequest: null },
        },
      })
      if (existing !== null && existing.retryStates?.[args.userId] !== undefined) {
        const retryStates = { ...existing.retryStates }
        delete retryStates[args.userId]
        await ctx.db.patch(existing._id, { retryStates })
      }
    } catch {
      // The reservation is durable before the component update. The per-user
      // state makes retries bounded and safe when multiple hooks race.
      const currentAttempt = Math.max(
        0,
        args.retryAttempt ?? 0,
        existing?.retryStates?.[args.userId]?.attempt ?? 0,
      )
      const nextAttempt = currentAttempt + 1
      const terminal = nextAttempt >= MAX_FINALIZATION_RETRIES
      const retryStates = { ...(existing?.retryStates ?? {}) }
      retryStates[args.userId] = {
        attempt: nextAttempt,
        correlationId: resolveSignupCorrelationId(
          existing?.retryStates?.[args.userId]?.correlationId,
          args.correlationId,
        ),
        terminal,
      }
      const state = existing ?? await ctx.db
        .query("authBootstrap")
        .withIndex("by_key", (query) => query.eq("key", "singleton"))
        .unique()
      if (state !== null) await ctx.db.patch(state._id, { retryStates })
      const diagnostic = {
        attempt: nextAttempt,
        correlationId: resolveSignupCorrelationId(
          existing?.retryStates?.[args.userId]?.correlationId,
          args.correlationId,
        ),
      }
      if (terminal) {
        console.error("auth_bootstrap_finalization_terminal", diagnostic)
      } else {
        console.warn("auth_bootstrap_finalization_retry_scheduled", diagnostic)
        await ctx.scheduler.runAfter(getFinalizationRetryDelayMs(currentAttempt), internal.authBootstrap.finalizeRoleClaim, {
          userId: args.userId,
          retryAttempt: nextAttempt,
          correlationId: diagnostic.correlationId,
        })
      }
    }
    return null
  },
})

/** Internal operator recovery for a terminal component outage. */
export const retryTerminalRoleClaim = internalMutation({
  args: { userId: v.string(), correlationId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("authBootstrap")
      .withIndex("by_key", (query) => query.eq("key", "singleton"))
      .unique()
    if (state === null || state.retryStates?.[args.userId]?.terminal !== true) return null

    const retryStates = { ...state.retryStates }
    delete retryStates[args.userId]
    await ctx.db.patch(state._id, { retryStates })
    await ctx.scheduler.runAfter(0, internal.authBootstrap.finalizeRoleClaim, {
      userId: args.userId,
      retryAttempt: 0,
      correlationId: sanitizeSignupCorrelationId(args.correlationId),
    })
    console.warn("auth_bootstrap_terminal_recovery_scheduled", {
      attempt: 0,
      correlationId: sanitizeSignupCorrelationId(args.correlationId),
    })
    return null
  },
})

/** Reopens bounded finalization for a user who authenticates after an outage. */
export const reconcileRoleClaim = internalMutation({
  args: { userId: v.string(), correlationId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("authBootstrap")
      .withIndex("by_key", (query) => query.eq("key", "singleton"))
      .unique()
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", operator: "eq", value: args.userId }],
    })
    const retryState = state?.retryStates?.[args.userId]
    if (
      user === null ||
      (retryState === undefined && !isPendingBootstrapRoleRequest(user.bootstrapRoleRequest)) ||
      !shouldScheduleRoleClaimReconciliation(retryState)
    ) return null

    await ctx.scheduler.runAfter(0, internal.authBootstrap.finalizeRoleClaim, {
      userId: args.userId,
      retryAttempt: retryState?.attempt ?? 0,
      correlationId: resolveSignupCorrelationId(retryState?.correlationId, args.correlationId),
    })
    return null
  },
})
