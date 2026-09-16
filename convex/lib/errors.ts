import { ConvexError } from "convex/values"

/**
 * SOURCE OF TRUTH KEYWORDS: ConvexError, expected error codes, safe server errors, authorization
 * WHAT: Defines the stable error contract for expected application failures.
 * WHY: Clients can handle known failures without receiving internal exception details.
 * WHERE: Protected functions and model validation use these helpers.
 */
export const ERROR_CODES = {
    AUTH_REQUIRED: "AUTH_REQUIRED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    CONFLICT: "CONFLICT",
} as const

export type ExpectedErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function expectedError(
    code: ExpectedErrorCode,
    message: string
): ConvexError<{ code: ExpectedErrorCode; message: string }> {
    return new ConvexError({ code, message })
}
