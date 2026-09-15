import { defineApp } from "convex/server"
import { v } from "convex/values"
import betterAuth from "./betterAuth/convex.config"

/**
 * SOURCE OF TRUTH KEYWORDS: Convex component, Better Auth registration, provider composition
 * WHAT: Composes the Better Auth component into the Convex application.
 * WHY: Keeps authentication infrastructure isolated from application tables.
 * WHERE: Auth client and HTTP routes use the registered component.
 */
const app = defineApp({
    env: {
        BETTER_AUTH_SECRET: v.string(),
        SITE_URL: v.string(),
        QR_TOKEN_ENCRYPTION_KEY: v.string(),
    },
})
app.use(betterAuth)

export default app
