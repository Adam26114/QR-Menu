import type { Doc } from "../_generated/dataModel"
import { expectedError, ERROR_CODES } from "../lib/errors"
import { normalizeEmail } from "./identity"

export { normalizeEmail }

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_TOKEN_LENGTH = 256

export async function hashInvitationToken(token: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(token)
    )
    let binary = ""
    for (const byte of new Uint8Array(digest))
        binary += String.fromCharCode(byte)
    return btoa(binary)
}

export function validateToken(token: string): void {
    if (!token.trim() || token.length > MAX_TOKEN_LENGTH)
        throw expectedError(
            ERROR_CODES.VALIDATION_FAILED,
            "Invitation token is invalid"
        )
}

export type InvitationStatus = "pending" | "expired" | "revoked" | "accepted"

export function invitationStatus(
    invitation: Pick<
        Doc<"staffInvitations">,
        "expiresAt" | "revokedAt" | "acceptedAt"
    >,
    now = Date.now()
): InvitationStatus {
    if (invitation.acceptedAt !== undefined) return "accepted"
    if (invitation.revokedAt !== undefined) return "revoked"
    if (invitation.expiresAt <= now) return "expired"
    return "pending"
}
