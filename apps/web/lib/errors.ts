/**
 * SOURCE OF TRUTH KEYWORDS: safe client errors, Convex error mapping, toast messages, expected codes
 * WHAT: Maps server failures to user-safe messages without exposing arbitrary internals.
 * WHY: Mutation and query feedback must be useful while preserving server details.
 * WHERE: Feature mutation handlers and persistent query errors use this helper.
 */
export function getSafeErrorMessage(error: Error, fallback: string): string {
    const message = error.message
    if (message.includes("AUTH_REQUIRED")) return "Please sign in to continue."
    if (message.includes("FORBIDDEN"))
        return "You do not have permission for that action."
    if (message.includes("NOT_FOUND"))
        return "That project is no longer available."
    if (message.includes("VALIDATION_FAILED"))
        return "Please check the project details and try again."
    if (message.includes("CONFLICT"))
        return "That change conflicts with an existing project."
    return fallback
}

type AuthError = { code?: unknown }

/** Maps Better Auth's structured signup failures without displaying its text. */
export function getSafeSignUpErrorMessage(error: unknown): string {
    const code =
        typeof error === "object" && error !== null && "code" in error
            ? String((error as AuthError).code ?? "").toUpperCase()
            : ""

    if (
        code.includes("ALREADY_EXISTS") ||
        code.includes("DUPLICATE") ||
        code.includes("EMAIL_EXISTS")
    ) {
        return "An account with this email already exists. Sign in instead or use a different email."
    }

    if (
        code.includes("INVALID") ||
        code.includes("VALIDATION") ||
        code.includes("PASSWORD_TOO_SHORT")
    ) {
        return "Please check your name, email, and password, then try again."
    }

    return "We could not confirm your account right now. It may have been created; try signing in or retry with the same details."
}
