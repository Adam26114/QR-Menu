import { createClient } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { components } from "./_generated/api"
import { env } from "./_generated/server"
import type { GenericCtx } from "@convex-dev/better-auth"
import authConfig from "./auth.config"

export const createAuthOptions = (ctx: GenericCtx, forSchema = true) => ({
  database: createClient(components.betterAuth).adapter(ctx),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string" as const, required: true, input: true, defaultValue: "user" },
      userId: { type: "string" as const, required: false, input: false },
      bootstrapRoleRequest: { type: "string" as const, required: false, input: false },
    },
  },
  plugins: [convex({ authConfig })],
  secret: forSchema ? "schema-generation-secret" : requiredEnv("BETTER_AUTH_SECRET"),
  baseURL: forSchema ? "http://localhost:3000" : requiredEnv("SITE_URL"),
})

function requiredEnv(name: "BETTER_AUTH_SECRET" | "SITE_URL"): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required to initialize Better Auth`)
  return value
}
