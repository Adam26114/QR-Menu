import { betterAuth } from "better-auth"
import { internal } from "./_generated/api"
import type { GenericCtx } from "@convex-dev/better-auth"
import { createAuthOptions } from "./betterAuthOptions"
import { sanitizeSignupCorrelationId } from "./authBootstrapPolicy"

export const createAuth = (ctx: GenericCtx) =>
  betterAuth({
    ...createAuthOptions(ctx, false),
    databaseHooks: {
      user: {
        create: {
          before: async (user: Record<string, unknown>) => {
            const requestedRole = user.role === "admin" ? "admin" : "user"
            return {
              data: {
                ...user,
                role: "user",
                bootstrapRoleRequest: requestedRole,
              },
            }
          },
          after: async (user: Record<string, unknown>, context) => {
            if (!("runMutation" in ctx)) throw new Error("Better Auth user creation requires a mutation-capable context")
            if (typeof user.id !== "string") return
            // Better Auth 1.6 supplies the originating request on database
            // hooks. Retries carry this sanitized value explicitly because
            // scheduled mutations do not have an HTTP request context.
            const correlationId = sanitizeSignupCorrelationId(
              context?.request?.headers.get("x-signup-correlation-id"),
            )
            await ctx.runMutation(internal.authBootstrap.finalizeRoleClaim, {
              userId: user.id,
              correlationId,
            })
          },
        },
        update: {
          before: async (user: Record<string, unknown>) => {
            if (Object.prototype.hasOwnProperty.call(user, "role")) return false
          },
        },
      },
      session: {
        create: {
          after: async (session: Record<string, unknown>, context) => {
            const correlationId =
              sanitizeSignupCorrelationId(
                context?.request?.headers.get("x-signup-correlation-id"),
              ) ?? sanitizeSignupCorrelationId(crypto.randomUUID())
            try {
              if (!("runMutation" in ctx)) throw new Error("Better Auth session creation requires a mutation-capable context")
              if (typeof session.userId !== "string") return
              await ctx.runMutation(internal.authBootstrap.reconcileRoleClaim, {
                userId: session.userId,
                correlationId,
              })
            } catch {
              console.warn("auth_bootstrap_session_reconciliation_failed", { correlationId })
            }
          },
        },
      },
    },
  })
