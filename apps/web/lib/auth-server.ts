import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs"

/**
 * SOURCE OF TRUTH KEYWORDS: Next.js auth server, Better Auth handler, token fetcher
 * WHAT: Configures the server-side Better Auth bridge for Next.js.
 * WHY: Server routes can forward Better Auth requests without inventing an adapter.
 * WHERE: The catch-all auth route exports its GET and POST handlers.
 */
/**
 * SOURCE OF TRUTH KEYWORDS: required client-visible Convex environment, fail-fast config
 * WHAT: Rejects missing Convex URLs instead of passing empty strings to the bridge.
 * WHY: Auth requests cannot be configured safely without both endpoints.
 * WHERE: The Next.js Better Auth server bridge uses this helper at module initialization.
 */
function requiredEnv(
    name: "NEXT_PUBLIC_CONVEX_URL" | "NEXT_PUBLIC_CONVEX_SITE_URL"
): string {
    const value = process.env[name]?.trim()
    if (!value)
        throw new Error(
            `${name} is required to initialize the Better Auth server bridge`
        )
    return value
}

export const authServer = convexBetterAuthNextJs({
    convexUrl: requiredEnv("NEXT_PUBLIC_CONVEX_URL"),
    convexSiteUrl: requiredEnv("NEXT_PUBLIC_CONVEX_SITE_URL"),
})
