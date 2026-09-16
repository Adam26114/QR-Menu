import { expect, test } from "vitest"
import {
    getFinalizationRetryDelayMs,
    isPendingBootstrapRoleRequest,
    MAX_FINALIZATION_RETRIES,
    resolveBootstrapRole,
    resolveFinalizedRole,
    resolveSignupCorrelationId,
    sanitizeSignupCorrelationId,
    shouldScheduleRoleClaimReconciliation,
} from "../convex/authBootstrapPolicy"
import { getSafeSignUpErrorMessage } from "../apps/web/lib/errors"
import {
    getSignupCorrelationId,
    withSignupCorrelationHeader,
} from "../apps/web/lib/auth-route"

test("the first requested admin is promoted", () => {
    expect(resolveBootstrapRole(false, "admin")).toBe("admin")
})

test("the first requested user remains a user", () => {
    expect(resolveBootstrapRole(false, "user")).toBe("user")
})

test("later users are forced to user", () => {
    expect(resolveBootstrapRole(true, "admin")).toBe("user")
})

test("forged or malformed roles do not elevate", () => {
    expect(resolveBootstrapRole(false, "owner")).toBe("user")
    expect(resolveBootstrapRole(false, { role: "admin" })).toBe("user")
})

test("serialized contenders have one bootstrap winner", () => {
    const first = resolveBootstrapRole(false, "admin")
    const second = resolveBootstrapRole(true, "admin")
    expect([first, second]).toEqual(["admin", "user"])
})

test("the recorded winner keeps the selected role on retry", () => {
    expect(
        resolveFinalizedRole(
            { role: "admin", winnerUserId: "first" },
            "first",
            "user"
        )
    ).toBe("admin")
})

test("later users cannot inherit the bootstrap role", () => {
    expect(
        resolveFinalizedRole(
            { role: "admin", winnerUserId: "first" },
            "second",
            "admin"
        )
    ).toBe("user")
})

test("legacy bootstrap state without a winner fails closed", () => {
    expect(resolveFinalizedRole({ role: "admin" }, "new-user", "admin")).toBe(
        "user"
    )
})

test("finalized roles ignore forged role claims", () => {
    expect(
        resolveFinalizedRole(
            { role: "user", winnerUserId: "first" },
            "second",
            {
                role: "admin",
            }
        )
    ).toBe("user")
})

test("signup errors expose only safe structured guidance", () => {
    expect(
        getSafeSignUpErrorMessage({
            code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
            message: "secret@example.com",
        })
    ).toContain("already exists")
    expect(
        getSafeSignUpErrorMessage({
            code: "VALIDATION_ERROR",
            message: "password=do-not-show",
        })
    ).toContain("check your name")
    expect(
        getSafeSignUpErrorMessage({ message: "database password=do-not-show" })
    ).not.toContain("database")
    expect(
        getSafeSignUpErrorMessage({ message: "database password=do-not-show" })
    ).not.toContain("do-not-show")
    expect(
        getSafeSignUpErrorMessage({ message: "component unavailable" })
    ).toContain("may have been created")
})

test("finalization retry policy is bounded exponential backoff", () => {
    expect(getFinalizationRetryDelayMs(0)).toBe(1000)
    expect(getFinalizationRetryDelayMs(1)).toBe(2000)
    expect(getFinalizationRetryDelayMs(MAX_FINALIZATION_RETRIES)).toBe(16000)
    expect(MAX_FINALIZATION_RETRIES).toBe(5)
})

test("winner retry preserves the winner while later users fail closed", () => {
    const state = { role: "admin" as const, winnerUserId: "winner" }
    expect(resolveFinalizedRole(state, "winner", "admin")).toBe("admin")
    expect(resolveFinalizedRole(state, "later", "admin")).toBe("user")
})

test("correlation IDs accept only bounded safe values", () => {
    expect(sanitizeSignupCorrelationId("signup-123")).toBe("signup-123")
    expect(sanitizeSignupCorrelationId("secret@example.com")).toBeUndefined()
    expect(sanitizeSignupCorrelationId("x".repeat(65))).toBeUndefined()
    expect(sanitizeSignupCorrelationId({ value: "signup-123" })).toBeUndefined()
})

test("stored signup correlation IDs take precedence over request fallbacks", () => {
    expect(resolveSignupCorrelationId("original-signup", "new-sign-in")).toBe(
        "original-signup"
    )
    expect(resolveSignupCorrelationId(undefined, "new-sign-in")).toBe(
        "new-sign-in"
    )
})

test("terminal retry state is not automatically rescheduled", () => {
    expect(
        shouldScheduleRoleClaimReconciliation({ attempt: 4, terminal: true })
    ).toBe(false)
    expect(
        shouldScheduleRoleClaimReconciliation({ attempt: 1, terminal: false })
    ).toBe(true)
    expect(shouldScheduleRoleClaimReconciliation(undefined)).toBe(true)
})

test("pending bootstrap requests are limited to persisted role values", () => {
    expect(isPendingBootstrapRoleRequest("admin")).toBe(true)
    expect(isPendingBootstrapRoleRequest("user")).toBe(true)
    expect(isPendingBootstrapRoleRequest(null)).toBe(false)
    expect(isPendingBootstrapRoleRequest("owner")).toBe(false)
})

test("invalid or missing route correlation IDs are replaced deterministically", () => {
    expect(getSignupCorrelationId("signup-123", () => "generated-id")).toBe(
        "signup-123"
    )
    expect(
        getSignupCorrelationId("secret@example.com", () => "generated-id")
    ).toBe("generated-id")
    expect(getSignupCorrelationId(null, () => "generated-id")).toBe(
        "generated-id"
    )
})

test("route forwarding preserves method, body, and headers", async () => {
    const request = new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", "x-other": "preserved" },
        body: JSON.stringify({ email: "user@example.com" }),
    })
    const forwarded = withSignupCorrelationHeader(request, "generated-id")
    expect(forwarded.method).toBe("POST")
    expect(forwarded.headers.get("content-type")).toBe("application/json")
    expect(forwarded.headers.get("x-other")).toBe("preserved")
    expect(forwarded.headers.get("x-signup-correlation-id")).toBe(
        "generated-id"
    )
    expect(await forwarded.text()).toContain("user@example.com")
})
