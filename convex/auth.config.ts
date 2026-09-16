import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config"
import type { AuthConfig } from "convex/server"

/**
 * SOURCE OF TRUTH KEYWORDS: Better Auth JWT, Convex identity provider, auth config
 * WHAT: Registers Better Auth as the Convex identity provider.
 * WHY: Convex validates session JWTs before protected functions run.
 * WHERE: Convex deployment reads this provider configuration.
 */
export default {
    providers: [getAuthConfigProvider()],
} satisfies AuthConfig
