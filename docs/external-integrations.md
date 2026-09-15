# External integration patterns

This starterkit does not implement external webhooks, storage, scheduled jobs, or third-party integrations. The following are documented patterns for future work only.

## Signed webhooks

Verify the provider signature against the raw request body before parsing or acting on an event. Reject stale timestamps and invalid signatures. Keep provider secrets in deployment environment variables, never source code or client bundles.

## Idempotency and cleanup

Persist an idempotency key (provider plus event ID) before applying a side effect, and treat repeats as successful no-ops. Add cleanup for retained event records according to the provider's replay window.

## Internal functions and actions

Use `internalQuery`, `internalMutation`, and `internalAction` for server-only work and call them through `internal.*`, never `api.*`. Actions should validate inputs, keep secrets server-side, and delegate database writes to mutations.

## Storage authorization

Authorize ownership before generating upload or download URLs. Do not treat a storage key as authorization; validate the owning record and requested operation in a protected function.

These patterns are not implemented endpoints and do not authorize adding speculative public routes.
