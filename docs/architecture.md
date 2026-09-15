# Architecture

## Default data flow

Convex is the default backend and data source for this starterkit. The schema is the source of truth, protected wrappers enforce identity, thin public functions expose the generated API, and model files contain direct database logic:

`convex/schema.ts` -> `convex/lib/customFunctions.ts` -> `convex/*.ts` -> `convex/model/*.ts` -> generated `api`

Top-level project functions are protected client APIs. The `public/*` namespace is intentionally unauthenticated only, `system/*` is internal-only, and `model/*` contains plain logic and is not a security boundary. `ownerId` currently represents personal ownership, not tenancy; organizations, memberships, and roles require a separate schema migration.

Expected failures use structured `ConvexError` codes (`AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, and `CONFLICT`). The client maps these to safe messages and never renders arbitrary server exception text.

## Convex code generation setup

Generated files in `convex/_generated` are produced by the Convex CLI and are intentionally not hand-written or fabricated. Before typechecking or building, copy the example environment file to the root:

```bash
cp .env.example .env.local
```

Configure `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `SITE_URL`, and a non-empty `BETTER_AUTH_SECRET`. Obtain or configure a valid Convex deployment, including `CONVEX_DEPLOYMENT` when running codegen directly. Run either `bunx convex dev` or `bun run codegen`, then run `bun run typecheck` and `bun run build`:

```bash
bunx convex dev
# or: bun run codegen
bun run typecheck
bun run build
```

The root `codegen` script runs `bunx convex codegen`; it performs local code generation and does not deploy Convex. If a valid deployment is unavailable, generated files remain absent and typecheck/build stay blocked by imports from `convex/_generated`.

The root providers compose Redux and the global Sonner toaster only. The dashboard layout initializes the Convex client and then resolves the Better Auth session before it mounts feature pages, so public landing and sign-in routes can render without Convex configuration. Feature hooks use `useQuery` and `useMutation` directly, so Convex remains the only cache for Convex data.

## Authentication and theme configuration

The browser Better Auth client uses its same-origin default and the Convex client plugin, so `NEXT_PUBLIC_SITE_URL` is not required in the web app. The Convex Better Auth server keeps an explicit `SITE_URL` base URL and requires both `SITE_URL` and `BETTER_AUTH_SECRET` at initialization. `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` remain required for the client and server bridge. Copy the root `.env.example` to `.env.local` with `cp .env.example .env.local`; dashboard routes require the Convex values while public routes do not initialize the Convex client.

The `next-themes` provider remains responsible for the theme anti-flash script. Next.js 16.2 with React 19.2 can emit a known upstream `next-themes` script compatibility warning; it is not a reason to remove or replace that script, and theme behavior should remain correct.

## Feature structure

The projects example demonstrates the reusable pattern:

- `features/projects/api` owns generated API references.
- `features/projects/hooks` owns Convex data hooks.
- `features/projects/components` owns forms and item presentation.
- `features/projects/schemas.ts` owns shared Zod input validation.
- Route pages compose the feature entrypoint and contain no business logic.
- The projects list uses the indexed `by_owner_updated` query with bounded cursor pages of 10 records. `usePaginatedQuery` reports first-page, load-more, exhausted, and error states; Convex remains the source of truth.

## HTTP and tables

Hono is reserved for public or multi-client HTTP APIs. TanStack Query is intentionally not used as a second Convex cache; it may be added later for external REST APIs. TanStack Table is approved for generic, feature-local table columns when a table is needed.
