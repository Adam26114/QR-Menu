"use client"

import { ConvexReactClient } from "convex/react"
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react"
import { authClient } from "@/lib/auth-client"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim()
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is required to initialize Convex. Configure it in the root .env.local file.")
const convex = new ConvexReactClient(convexUrl)

/**
 * SOURCE OF TRUTH KEYWORDS: Convex provider, Better Auth provider, client composition
 * WHAT: Connects the Convex client and Better Auth client for React.
 * WHY: All app queries share one authenticated reactive Convex connection.
 * WHERE: Dashboard layout composes this provider around protected routes.
 */
export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexBetterAuthProvider client={convex} authClient={authClient as AuthClient}>{children}</ConvexBetterAuthProvider>
}
