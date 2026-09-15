import { httpRouter } from "convex/server"
import { createClient } from "@convex-dev/better-auth"
import { components } from "./_generated/api"
import { createAuth } from "./betterAuthServer"

/**
 * SOURCE OF TRUTH KEYWORDS: Better Auth HTTP routes, Convex HTTP router, auth handler
 * WHAT: Mounts Better Auth's standard request handlers on Convex.
 * WHY: Auth callbacks and session requests need a server route owned by Convex.
 * WHERE: Next.js auth-server forwards requests to this configured site URL.
 */
const http = httpRouter()
createClient(components.betterAuth).registerRoutes(http, createAuth)
export default http
