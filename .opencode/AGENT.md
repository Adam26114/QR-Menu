# Every rule here must be followed.

## Stack

- **Framework:** Next.js (App Router) with TypeScript and React.
- **Package manager:** bun — `bun install` for every dependency, `bun add` / `bun remove` to change them. Keep a Node.js LTS installed on the machine alongside bun: the Convex CLI needs a real Node.js install to deploy `"use node"` actions, so run it un-forced (`bunx convex dev`, `bunx convex deploy`) rather than under `bun --bun`.
- **Backend + database:** Convex. `convex/schema.ts` is the single source of truth for data shape — no Prisma, no Drizzle, no separate ORM, ever. Keep `bunx convex dev` running in the background during development; it watches `convex/` and keeps `convex/_generated/` current.
- **Auth:** Better Auth via `@convex-dev/better-auth` — a Convex-maintained component, not a third-party bolt-on. Convex's own docs currently describe it as early alpha, so pin `better-auth` and `@convex-dev/better-auth` to exact versions in `package.json`, never `latest` or a loose range.
- **UI:** shadcn/ui + Tailwind CSS.
- **Client state:** Redux Toolkit — for state Convex doesn't own: modals, wizard steps, sidebar/theme, in-progress form drafts, filters before they're applied. Never mirror a Convex query's result into a Redux slice — `useQuery` is already the live, reactive, cached copy of that data; duplicating it into Redux just creates a second, staler source of truth. Store setup lives in `lib/store/` (`store.ts`, typed `hooks.ts` for `useAppDispatch`/`useAppSelector`); slices live in `lib/store/slices/<domain>.slice.ts`.
- **Forms:** React Hook Form + Zod, shadcn approach.

## 1. Build from existing patterns, not new ones

You are building this app as a pattern-recognition model: everything you write should come from patterns and coding practices already in this codebase. Never invent your own architecture, pull in your own libraries, or start a new pattern without first confirming that a similar one doesn't already exist.

The app runs on a SOURCE OF TRUTH global architecture, which is already established – your job is to build into it. Globalize what you write so the app stays modular and future features are a plug-in rather than a rewrite; nothing should be tightly coupled, and swapping a tech stack, a business rule, or a strategy should be easy. That applies to configuration, Redux slices, and the Convex layers — protected function → public API → model — equally; each layer is an independent task.

But don't create blindly. You have to know whether something that already facilitates your work exists. Only when no existing architecture can support the new feature should you build something new.

## 2. How to search: `grep -l` first

The whole codebase carries a `SOURCE OF TRUTH KEYWORDS` line at the top of each file and code block precisely so you can find things without reading everything. This is what keeps context pollution at zero and stops us from burning through session limits.

Before creating any type, function, constant, or component, grep for it by keyword – and you must grep with `-l`. That gives you the list of _files_ where the thing could live; you then narrow to where it's most likely to be and read only those files. It's the fastest path that also protects the context window. If the keyword search turns up nothing, search the codebase normally. If you find it, follow what's already there.

If you do have to create something new, give it its own `SOURCE OF TRUTH KEYWORDS` line with 5–6 specific keywords so the next agent can find it and understand how it works.

Never create a duplicate type, function, component, or block of code because grep felt like work. I have already created all types, if you search for them you will most likely find them. The same goes for the auth scaffolding (`convex/betterAuth/*`, `lib/auth-client.ts`, `lib/auth-server.ts`) and any Redux slice — grep before assuming either needs to be built from scratch.

## 3. The layered architecture

1. **Protected function – the heart of the app.** This is the Convex equivalent of what used to be a protected tRPC procedure. Every query, mutation, or action that touches user data must go through a wrapped builder from `convex-helpers` (`customQuery` / `customMutation` / `customAction`, defined once in `convex/lib/customFunctions.ts`) instead of the raw `query` / `mutation` / `action`. The wrapper calls `ctx.auth.getUserIdentity()` — populated by Better Auth — and throws if there's no session; every function built from it gets the authenticated identity for free. Feature gates, role checks, and permission checks belong in the wrapper (or in a model helper it calls), not re-checked inside individual functions. TypeScript will show you what `ctx` gives you.
2. **`convex/*.ts` files are the public API** - the equivalent of routers. Organize by domain (`convex/restaurants.ts`, `convex/admin.ts`), not one giant file. Keep these thin: validate args with Convex's own `v` validators, call into the model layer, return. Business logic doesn't live here.
3. **`convex/model/*.ts` is the only layer with real logic and direct `ctx.db` calls** – this is Convex's own documented best practice, not invented for this app. Public functions call model functions directly, not `ctx.runQuery` / `ctx.runMutation` (that adds subtransaction overhead you don't need when you're already inside one function) — save `ctx.runQuery` / `ctx.runMutation` / `ctx.runAction` for actually crossing a query/mutation/action boundary. Anything that must never be reachable from the client goes through `internalQuery` / `internalMutation` / `internalAction`, called as `internal.foo.bar`, never `api.foo.bar`.
4. **Auth scaffolding already exists once it's set up** – `convex/betterAuth/*` (component definition, Better Auth instance, generated schema, adapter functions), `convex/convex.config.ts` (registers the component), `convex/auth.config.ts` (tells Convex that Better Auth is a valid identity provider), `convex/auth.ts` (our own auth-related functions, e.g. the current-user query), `convex/http.ts` (mounts Better Auth's routes), `lib/auth-client.ts`, `lib/auth-server.ts`, `components/ConvexClientProvider.tsx`, and `app/api/auth/[...all]/route.ts`. Treat all of it as SOURCE OF TRUTH like everything else — grep first, don't regenerate it from scratch.
5. **`convex/schema.ts` is the single source of truth for data shape.** Convex generates `Doc<"table">` and `Id<"table">` straight from it — see rule 4 below.

**Never create `middleware.ts`** – Next.js renamed the convention to `proxy.ts`; the framework only reads that file now.

## 4. Production-grade TypeScript

Never use `any`, `unknown`, hardcoded types, or any other TypeScript bypass – this is a production application.

For types, work in this order so we save context:

1. If the type is a database document or its ID, it already exists — use Convex's generated `Doc<"tableName">` / `Id<"tableName">` from `convex/_generated/dataModel`. Never hand-write an interface that duplicates a table already defined in `convex/schema.ts`.
2. If the type is a Convex function's arguments or return value, it's inferred automatically end-to-end between the function definition and `useQuery` / `useMutation` on the client — don't redeclare it. If a validator genuinely needs to be reused as a standalone type, derive it with `Infer<typeof myValidator>` instead of writing the shape twice.
3. Otherwise, check `lib/types` to see whether the custom type already exists, and only create one if it doesn't and it will genuinely be a reusable source of truth.

Types are never written anywhere except `lib/types` (for the cases above that aren't already Convex-generated). Dynamic TypeScript types should be generated for any custom types at all times! Most likely a few types are already created, so leverage those and dynamically construct your own.

Run a TypeScript check every single time you hand something over, to prove the codebase is clean — `bunx tsc --noEmit`, plus `bunx convex codegen` so Convex's own generated types are current too (that's local-only and doesn't touch any deployment). Commit `convex/_generated/` so a fresh clone still typechecks without running the CLI first. Never report a false positive.

## 5. Validate every input with Zod

Every component, form, and endpoint that takes input uses a Zod schema, every single time, with React Hook Form following the shadcn approach ([https://ui.shadcn.com/docs/forms/react-hook-form#approach](https://ui.shadcn.com/docs/forms/react-hook-form#approach)).

This doesn't replace Convex's own validation. Every query, mutation, and action declares its `args` with Convex's `v` validators (from `convex/values`) — Convex enforces this at the framework level, so unlike a form it's not something that can accidentally get skipped. The two aren't redundant: Zod validates what a human typed into a form; the Convex validator guards every call that reaches the function, including ones that never go through a form at all. Don't hand-maintain a Zod schema and a Convex validator for the same shape and let them drift; if one form genuinely needs a single, authored-once schema, `convex-helpers/server/zod4` lets a Convex function take Zod validators directly instead of `v` — reach for it only when the duplication becomes a real problem, not by default.

This is what makes data corruption impossible.

## 6. Inline comment context injection

This is the most important part of your development process: it's how other AI devs grep the codebase and understand each block through its SOT keywords. Above every function or block, write:

```
/**
 * SOURCE OF TRUTH KEYWORDS: Symbol1, Symbol2, TypeA (about 10 keywords, to power the SOT keyword search)
 * WHAT: What this block or function is.
 * WHY: Why it's needed here and why it's done this way.
 * WHERE: Where it's being used.
 */
```

Add ordinary inline comments too, but keep them minimal and outcome-based – don't just narrate the code.

## 7. UI

Before creating any component, check whether a reusable one already exists and use it if so. Never duplicate a component with similar functionality – extend or compose what's there. If you notice yourself copying the pattern of another component, that's the signal to globalize it instead.

Place a component that's reusable across routes or features in `components/global/COMPONENT_NAME_FOLDER`; a component used only inside one route goes in `THE_ROUTE/_components`.

Design every component for reuse: never hardcode logic, layouts, or data into it. Global means it can genuinely be reused anywhere, with custom options such as slots. A table component, for example, owns all the reusable logic – search, pagination, filters – while create, delete, and custom views come in as slots. Keep global components flexible, configurable, production-ready, and strongly typed so they scale across the app. Fewer lines is better.

For a simple new component, follow the design themes already in the app. For a complex one, you have to ask the user for a shadcn UI block link to use as a reference, then rename it to our folder structure naming conventions and globalize it if needed.

**Dashboard reference:** for dashboard/admin screens, the structure to mirror is [shadcnuikit.com/dashboard/default](https://shadcnuikit.com/dashboard/default) — sidebar nav with a ⌘K command palette, stat cards with a delta, a paginated data table, a small chart card, settings/payment-style form cards. It's a paid template and its source isn't ours to copy; rebuild the pattern with our own shadcn components wired to real Convex queries, don't attempt to clone their code.

shadcn components and blocks often arrive with outdated copy that doesn't match this app's branding - fix it.

Never hardcode theme colors (no hex values, `text-white`, `bg-[#...]`, or forced `dark` classes). Always use the theme tokens – `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-primary`, `border` – so everything follows the app theme.

## 8. Delivery

Keep everything production-grade: never create scripts, Convex seed or one-off migration scripts, or probe/testers or anything else that couldn't be pushed to production. Ask my permission before creating any scripts or performing a manual action — that includes running `convex deploy`, regenerating the Better Auth schema (`auth generate`), or anything else that touches a real deployment.

Use barrel exports wherever possible, exporting as a single object where that makes sense.

Never skip a feature or leave it incomplete. If pieces are missing - because you forgot them or because the user never mentioned them - either finish them or tell the user about those outliers.

Don't use git unless told.

## Browser automation safety

Playwright can navigate pages, upload files, submit forms, access authenticated sessions, and perform destructive actions. Request confirmation before production, financial, account, deletion, or other irreversible actions. Never commit credentials or session data.
