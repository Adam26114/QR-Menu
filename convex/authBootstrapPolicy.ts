export type BootstrapRole = "admin" | "user"

export type BootstrapState = {
  role: BootstrapRole
  winnerUserId?: string
}

export const MAX_FINALIZATION_RETRIES = 5
export const FINALIZATION_RETRY_BASE_MS = 1_000
export const FINALIZATION_RETRY_MAX_MS = 30_000

export function getFinalizationRetryDelayMs(attempt: number): number {
  const boundedAttempt = Math.max(0, Math.min(attempt, MAX_FINALIZATION_RETRIES - 1))
  return Math.min(FINALIZATION_RETRY_BASE_MS * 2 ** boundedAttempt, FINALIZATION_RETRY_MAX_MS)
}

export function sanitizeSignupCorrelationId(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(value) ? value : undefined
}

export function resolveSignupCorrelationId(stored: unknown, requested: unknown): string | undefined {
  return typeof stored === "string" ? stored : sanitizeSignupCorrelationId(requested)
}

export function shouldScheduleRoleClaimReconciliation(
  retryState: { terminal: boolean } | undefined,
): boolean {
  return retryState?.terminal !== true
}

export function isPendingBootstrapRoleRequest(value: unknown): value is BootstrapRole {
  return value === "admin" || value === "user"
}

export function resolveBootstrapRole(
  hasBootstrapClaim: boolean,
  requestedRole: unknown,
): BootstrapRole {
  if (hasBootstrapClaim) return "user"
  return requestedRole === "admin" ? "admin" : "user"
}

export function resolveFinalizedRole(
  existing: BootstrapState | null,
  currentUserId: string,
  requestedRole: unknown,
): BootstrapRole {
  if (existing === null) return resolveBootstrapRole(false, requestedRole)
  if (existing.winnerUserId === currentUserId) return existing.role
  return "user"
}
