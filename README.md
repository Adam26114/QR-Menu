# Restaurant operations platform

This is a Next.js 16 monorepo template with shadcn/ui, Convex, and Better Auth.

## Convex architecture

- `convex/schema.ts` is the source of truth for application data.
- Protected wrappers in `convex/lib/customFunctions.ts` require server-side identity.
- Public domain APIs in `convex/*.ts` delegate to business logic in `convex/model/*`.
- Top-level restaurant domain functions are protected client APIs exposed through Convex's generated `api`. `public/*` is intentionally unauthenticated, `system/*` is internal-only, and `model/*` is plain logic rather than a security boundary.
- Restaurant operations are tenant-scoped through active memberships, with role-based admin controls enforcing access to each restaurant.
- Expected Convex failures use stable structured codes and are mapped to safe client messages.
- Better Auth is composed through the Convex component and mounted at `/api/auth/*`.
- Redux stores transient UI state only; Convex queries remain the source of truth for server data.
- The web app provides restaurant operations under the dashboard routes.
- Convex is the default backend. Use Hono only for public or multi-client HTTP APIs.
- TanStack Query is not used for Convex data; it may be added later for external REST APIs. TanStack Table is approved for generic data tables when a feature needs one.

Copy `.env.example` to the root `.env.local` before configuring the app:

```bash
cp .env.example .env.local
```

Configure `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `SITE_URL`, and a non-empty `BETTER_AUTH_SECRET`. Obtain or configure a valid Convex deployment, including `CONVEX_DEPLOYMENT` when running codegen directly. Then run `bunx convex dev` or `bun run codegen`, followed by `bun run typecheck` and `bun run build`. `bun run codegen` runs the local Convex CLI and does not deploy Convex. Public landing and sign-in pages do not initialize Convex; dashboard routes require `NEXT_PUBLIC_CONVEX_URL`. The browser Better Auth client uses same-origin defaults and does not require `NEXT_PUBLIC_SITE_URL`. `BETTER_AUTH_SECRET` and `SITE_URL` must also be configured in the Convex deployment environment. The Better Auth component schema is generated as part of that setup. If no valid deployment is available, `convex/_generated` remains absent and typecheck/build cannot complete until codegen has run.

Next.js 16.2 with React 19.2 may report an upstream `next-themes` script compatibility warning. The warning is known and does not require removing the provider or its anti-flash script; theme behavior should remain correct.

Restaurant lists are cursor-paginated in bounded pages of 10 using Convex's indexed query and `usePaginatedQuery`. The UI supports first-page loading, empty results, query errors with retry, loading more, and exhausted pages.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
bunx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button"
```

## Playwright MCP

This starterkit includes a project-local OpenCode MCP configuration for the official Playwright MCP server. After adding or changing `opencode.json`, restart OpenCode so it loads the configuration. The server is launched with `bunx`, so it is not installed as an application dependency.

Install the browser binaries before using browser automation:

```bash
bunx playwright install
```

For CI, run the MCP server in headless mode with `--headless`. This configuration is project-local and can be reused by future projects created from this starterkit. Review browser actions carefully before allowing them to run against real services.

## Playwright E2E

Run the public smoke suite with `bun run e2e`. It starts the local web app by default; set `PLAYWRIGHT_BASE_URL` to use an already-running deployment instead. In CI, authenticated coverage requires `E2E_ADMIN_AUTH_STATE`, `E2E_OWNER_AUTH_STATE`, `E2E_STAFF_AUTH_STATE`, and `E2E_RESTAURANT_SLUG` as Playwright storage-state JSON files or fixture values. `E2E_AUTH_STATE` may be kept as a legacy generic fixture, but it does not enable owner or staff role coverage. Optionally set `E2E_USER_AUTH_STATE` for non-admin redirect coverage and `E2E_OTHER_RESTAURANT_SLUG` for tenant-isolation coverage; the other tenant fixture must be distinct from `E2E_RESTAURANT_SLUG`. Do not provide or commit credentials, storage-state files, or other secrets.
