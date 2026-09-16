import { betterAuth } from "better-auth"
import type { GenericCtx } from "@convex-dev/better-auth"
import { createAuthOptions } from "../betterAuthOptions"

export const auth = betterAuth(createAuthOptions({} as GenericCtx, true))
