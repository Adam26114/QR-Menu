"use client"

import { createAuthClient } from "better-auth/react"
import { convexClient } from "@convex-dev/better-auth/client/plugins"

/**
 * SOURCE OF TRUTH KEYWORDS: Better Auth client, Convex plugin, browser session
 * WHAT: Creates the browser Better Auth client with the Convex plugin.
 * WHY: Better Auth manages credentials while Convex receives its session token.
 * WHERE: ConvexBetterAuthProvider and auth forms consume this client.
 */
export const authClient = createAuthClient({
  plugins: [convexClient()],
})
