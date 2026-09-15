# Master Prompt — Multi-Tenant QR Menu and Restaurant Order SaaS

## Your Role

Act as a senior SaaS architect and full-stack engineer.

Build a production-ready, multi-tenant QR menu and restaurant ordering platform using the existing project

Do not replace the existing architecture or rebuild the project from scratch. Extend the patterns already established in the repository.

Before editing code:

1. Read `.opencode/[AGENT.md]` completely.
2. Read `docs/[architecture.md]` and the relevant domain documentation.
3. Read `convex/_generated/ai/[guidelines.md]` before modifying Convex code.
4. Inspect the existing authentication, protected-function, model, feature, and UI patterns.
5. Search for existing source-of-truth implementations before creating new ones.
6. Present a short architecture audit and phased implementation plan.
7. Ask only genuinely blocking questions.
8. Wait for my approval before beginning implementation.

After approval, implement the phases sequentially without repeatedly asking for confirmation unless blocked.

---

# Product Overview

Build a multi-tenant SaaS platform for cafés and restaurants.

Restaurant owners subscribe monthly to use the service. Each restaurant receives:

- A public digital menu
- Unique QR codes for its tables
- Anonymous customer ordering
- Realtime order tracking
- A live owner/staff order dashboard
- Browser audio alerts for new orders
- Menu management
- Table management
- Staff access management
- Daily sales reporting
- Monthly revenue reporting
- Subscription and billing management

Multiple restaurants must use the same platform while their data remains strictly isolated.

An owner may manage one or more restaurants. Staff access is assigned per restaurant.

---

# Existing Technology Stack

Keep and use the repository’s existing stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Convex backend and database
- Better Auth with `@convex-dev/better-auth`
- shadcn/ui
- Tailwind CSS
- React Hook Form
- Zod
- Redux Toolkit for transient client state only
- Bun
- Turborepo
- Playwright for browser verification

Do not introduce:

- Prisma
- Drizzle
- Supabase
- Firebase
- A second database
- A second authentication system
- TanStack Query for Convex data
- Unnecessary state-management libraries

Use Convex queries as the realtime client source of truth. Do not copy Convex query results into Redux.

Use Redux only for temporary UI state such as:

- Customer cart
- Open drawers
- Dashboard filters
- Sidebar state
- In-progress form state

---

# Product Assumptions

Use these assumptions unless I change them:

- The SaaS subscription is charged per restaurant per month.
- Customer accounts are not required.
- Customers pay at the restaurant in version one.
- Orders have a separate payment status.
- Staff or owners can mark orders as paid.
- Default currency is MMK but must be configurable per restaurant.
- Default timezone is `Asia/Yangon` but must be configurable.
- This is a POS-style ordering and reporting system.
- Full accounting, inventory management, receipt-printer integration and offline POS operation are outside version-one scope.
- Historical orders must never change when menu names or prices are edited later.
- Deleted menu items should be archived rather than permanently deleted when referenced by orders.

Do not implement a real subscription payment gateway until the provider is confirmed. Create a clean billing-provider boundary and development-safe subscription states without fabricating credentials.

---

# Business Roles

There are two restaurant roles.

## Owner

An owner can:

- Create and manage restaurants
- Update restaurant details
- Create, update, archive and restore menu categories
- Create, update, archive and restore menu items
- Set item prices
- Upload item images
- Mark items available or unavailable
- Create item option groups and choices
- Create and manage tables
- Generate, view and regenerate table QR codes
- View all restaurant orders
- Update order status
- Mark orders as paid or unpaid
- View today’s sales
- View monthly revenue
- View order counts and average order value
- Invite and remove staff
- View and manage the restaurant subscription
- Configure currency, timezone, tax and service charges

## Staff

Staff can only:

- Access restaurants to which they are assigned
- View the live order board
- View table numbers and order line items
- View customer notes
- Move an order from `pending` to `preparing`
- Move an order from `preparing` to `served`
- Mark an order as paid when permission is enabled

Staff cannot:

- Create, edit or archive menu items
- Change prices
- Manage tables or QR codes
- View revenue reports
- Manage subscriptions
- Invite or remove users
- Change restaurant settings

Enforce these permissions on the Convex server. Hiding buttons in the UI is not authorization.

If the starter kit contains an internal platform-admin concept, keep it separate from restaurant roles. Do not expose it as another restaurant role.

---

# Customer Experience

Customers do not create an account or sign in.

## Customer Flow

```text
Scan Table QR
→ Browse Menu
→ Select Item
→ Choose Options in Drawer
→ Add to Cart
→ Review Cart
→ Submit Order
→ Receive Order Number
→ Track Live Order Status

```

## Public Menu Requirements

The public menu must:

- Be mobile-first
- Show restaurant name and branding
- Show table identification
- Show menu categories
- Show item image, name, description and price
- Show unavailable items without allowing them to be ordered
- Support category navigation
- Support menu search
- Support item option groups
- Display price changes caused by options
- Provide a sticky cart button
- Work without authentication

## Item Drawer

When a customer selects an item, open a mobile-friendly drawer containing:

- Item image
- Item name
- Description
- Base price
- Required option groups
- Optional option groups
- Single-select and multi-select choices
- Quantity control
- Special instructions
- Calculated item total
- Add-to-cart button

The server must recalculate every price during order submission. Never trust totals received from the browser.

## Cart

The cart must support:

- Adding items
- Updating quantities
- Editing selected options
- Removing items
- Showing subtotal
- Showing tax
- Showing service charge
- Showing grand total
- Clearing the cart
- Preventing duplicate submissions

Persist the temporary cart locally for the current restaurant and table. Never mix carts between restaurants.

## Order Tracking

After submission, show:

- Restaurant name
- Table number
- Human-readable order number
- Ordered items
- Total price
- Payment status
- Current order status
- Realtime status updates
- Order submission time

The public tracking token must expose only that specific order. It must not expose internal Convex IDs or allow access to other orders.

---

# Order Workflow

Use the following server-enforced order state machine:

```text
pending → preparing → served

```

Also support:

```text
pending → cancelled
preparing → cancelled

```

Do not allow invalid transitions such as:

- `served → preparing`
- `cancelled → preparing`
- `pending → served`

Use these labels in the UI:

- `pending`: New Order
- `preparing`: Cooking
- `served`: Served
- `cancelled`: Cancelled

Keep payment status separate:

- `unpaid`
- `paid`
- `refunded`, reserved for future use

Record timestamps and the authenticated user responsible for every status transition.

Make transition mutations idempotent where appropriate and return stable structured errors for conflicts.

---

# Realtime Owner and Staff Dashboard

Create a responsive order dashboard optimized for tablets and desktop screens.

The order board should have:

- New Orders
- Cooking
- Served
- Cancelled

Each order card should display:

- Order number
- Table name or number
- Time submitted
- Time waiting
- Ordered items
- Item quantities
- Selected options
- Customer notes
- Total price
- Payment status
- Current status
- Relevant action buttons

Actions:

- Pending order: `Start Cooking`
- Preparing order: `Mark Served`
- Eligible order: `Cancel Order`
- Authorized user: `Mark Paid`

All lists must update live through Convex subscriptions.

Use bounded queries or pagination for historical orders. Do not use unbounded `.collect()` calls.

---

# Audio Notifications

When a new pending order arrives:

- Play a short audio alert
- Show a toast notification
- Visually highlight the new order
- Update the pending-order count
- Update the browser document title when appropriate

Browser autoplay restrictions must be handled correctly.

Provide an explicit `Enable Order Sound` control that unlocks audio after user interaction.

Do not:

- Replay the alert for old orders after page refresh
- Play the sound for every reactive query update
- Play it when an existing order changes status
- Trigger duplicate sounds during reconnects

Track the last acknowledged order safely within the dashboard session.

---

# Owner Dashboard Modules

Create the following dashboard areas.

## Overview

Show:

- Today’s paid sales
- Today’s order count
- Today’s average order value
- Current pending orders
- Current cooking orders
- Monthly paid revenue
- Comparison with the previous relevant period when sufficient data exists
- Recent orders

Use the restaurant’s configured timezone when calculating “today.”

Only paid orders should contribute to finalized sales and revenue.

## Orders

Provide:

- Live order board
- Order-detail drawer
- Status filters
- Payment-status filters
- Table filter
- Date filter
- Search by order number
- Paginated order history

## Menu

Provide:

- Category management
- Menu-item management
- Item availability toggle
- Item image
- Description
- Base price
- Option groups
- Option choices
- Required/optional settings
- Minimum and maximum selections
- Sort order
- Archive and restore

## Tables and QR Codes

Provide:

- Create table
- Rename table
- Activate or deactivate table
- Generate a secure QR link
- Preview QR code
- Download or print QR code
- Regenerate a compromised QR token

Do not put raw database IDs in QR URLs.

Suggested route:

```text
/s/[restaurantSlug]/t/[tableToken]

```

## Staff

Provide:

- Invite staff by email
- Assign staff to a restaurant
- View pending invitations
- Revoke invitations
- Remove staff
- View each membership role and status

## Reports

Provide:

- Today’s sales
- Daily sales for a selected date range
- Monthly revenue
- Order count
- Average order value
- Best-selling items
- Payment-status breakdown

Use indexed, bounded queries and atomic summary updates. Do not scan an unlimited order history on every dashboard render.

## Restaurant Settings

Provide:

- Restaurant name
- Unique slug
- Logo
- Contact details
- Address
- Currency
- Timezone
- Tax percentage
- Service-charge percentage
- Order acceptance toggle
- Business hours
- Subscription status

---

# Multi-Tenant Architecture

Restaurant membership must be the authorization boundary.

Never trust a `restaurantId`, `ownerId`, `userId`, role or price supplied by the client.

For every protected query or mutation:

1. Derive the authenticated identity on the server.
2. Load the user’s restaurant membership.
3. Confirm membership is active.
4. Confirm the required role or permission.
5. Scope every read and write to that restaurant.
6. Return stable `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` or `VALIDATION_FAILED` errors.

One restaurant must never be able to:

- Read another restaurant’s menu
- Read another restaurant’s orders
- Change another restaurant’s tables
- View another restaurant’s sales
- Manage another restaurant’s staff
- Access another restaurant’s billing

Use Better Auth for owner and staff identities. Anonymous customers must use a separate, restricted public-ordering API.

Put unauthenticated functions in the repository’s intended public namespace. Public functions must never reuse protected functionality in a way that bypasses tenant authorization.

---

# Suggested Data Model

Design the exact schema after inspecting the repository, but expect separate Convex tables similar to:

- `restaurants`
- `restaurantMemberships`
- `staffInvitations`
- `restaurantTables`
- `menuCategories`
- `menuItems`
- `menuOptionGroups`
- `menuOptionChoices`
- `orders`
- `orderItems`
- `orderItemOptions`
- `orderStatusEvents`
- `dailySalesSummaries`
- `subscriptions`

Do not store growing collections such as menu items, order items or status history as unbounded arrays inside another document.

Important modeling requirements:

- Store money as integer minor units, never floating-point currency.
- Store the restaurant currency with monetary records.
- Snapshot item names, option names and prices into order records.
- Menu edits must not rewrite historical orders.
- Store timestamps in UTC.
- Derive restaurant business-day keys using the restaurant timezone.
- Use secure, random public table tokens.
- Use secure, random order-tracking tokens.
- Add indexes for every important tenant-scoped query.
- Include the tenant identifier early in relevant compound indexes.
- Use separate order and payment statuses.
- Update sales summaries atomically when payment state changes.
- Prevent one order from being counted twice in sales totals.
- Use idempotency keys for public order submission.
- Add audit fields for status and payment changes.

Treat `convex/schema.ts` as the only data-model source of truth.

---

# Subscription Model

Create the domain model for monthly restaurant subscriptions.

Subscription states:

- `trialing`
- `active`
- `past_due`
- `cancelled`
- `expired`

The subscription belongs to a restaurant.

Design a provider-independent billing boundary that can later support a confirmed payment provider.

Do not fake a production billing integration.

Until a provider is selected:

- Support development-safe subscription fixtures through approved application paths
- Clearly separate local/demo behavior from production behavior
- Do not commit secrets
- Do not create deployment or migration scripts without permission

Subscription enforcement:

- Active or trialing restaurants can accept customer orders.
- Past-due restaurants may receive a configurable grace period.
- Expired restaurants cannot accept new orders.
- Owners should still be able to sign in and access billing/settings.
- Public menus for expired restaurants should show a polite unavailable state without exposing billing details.

Before implementing a real provider integration, ask me to confirm:

- Subscription provider
- Plan price
- Trial duration
- Grace-period policy
- Webhook requirements
- Per-shop or account-level billing

---

# UI and Design Direction

Use shadcn/ui and the repository’s semantic theme tokens.

Do not hardcode color values.

Customer UI:

- Mobile-first
- Large tap targets
- Clear prices
- Fast category navigation
- Bottom-sheet item configuration
- Sticky cart summary
- Minimal checkout friction
- Skeleton loading states
- Friendly empty and unavailable states

Dashboard UI:

- Responsive sidebar
- Restaurant switcher
- Command/search interface where appropriate
- Stat cards
- Realtime status columns
- Data tables for history
- Drawers for order details
- Clear destructive-action confirmations
- Accessible forms
- Light and dark theme support

All important functionality must be usable on mobile, tablet and desktop.

Meet accessibility basics:

- Keyboard support
- Visible focus states
- Semantic buttons
- Form labels
- Error messages
- Sufficient contrast
- Reduced-motion support
- Meaningful image alt text

---

# Recommended Route Structure

Use the repository’s existing route conventions and adjust after inspection.

Public routes:

```text
/s/[restaurantSlug]/t/[tableToken]
/s/[restaurantSlug]/order/[trackingToken]

```

Authenticated routes:

```text
/dashboard
/dashboard/[restaurantSlug]
/dashboard/[restaurantSlug]/orders
/dashboard/[restaurantSlug]/menu
/dashboard/[restaurantSlug]/tables
/dashboard/[restaurantSlug]/staff
/dashboard/[restaurantSlug]/reports
/dashboard/[restaurantSlug]/settings
/dashboard/[restaurantSlug]/billing

```

Auth routes should continue using the existing Better Auth implementation.

---

# Reliability and Security Requirements

Implement:

- Server-side price validation
- Tenant isolation
- Role-based authorization
- Secure QR tokens
- Secure tracking tokens
- Public order rate limiting
- Duplicate-order prevention
- Input validation
- Bounded queries
- Pagination
- Safe error messages
- Atomic order creation
- Atomic status transitions
- Atomic sales-summary updates
- Soft deletion or archiving for referenced menu records
- Loading, empty and error states
- Audit trail for operational changes

A malicious customer must not be able to:

- Change an item price
- Submit unavailable items
- Use options belonging to another item
- Submit an order to another table by changing a database ID
- View another customer’s order
- Reuse a request to create duplicate orders
- Create unlimited abusive requests

A staff member must not be able to gain owner capabilities by manually calling Convex functions.

---

# Implementation Phases

## Phase 0 — Repository Audit

- Inspect the existing architecture.
- Identify reusable authentication, dashboard, error, form and CRUD patterns.
- Identify the example `projects` feature and propose how to replace it safely.
- List required dependencies before installing anything.
- Present the proposed data model, permissions matrix and routes.
- Ask blocking product questions.
- Wait for approval.

## Phase 1 — SaaS Foundation

- Restaurant model
- Restaurant memberships
- Owner/staff authorization helpers
- Restaurant switcher
- Restaurant onboarding
- Tenant-scoped protected functions
- Tests for cross-tenant access denial

## Phase 2 — Menu and Tables

- Category CRUD
- Menu-item CRUD
- Option groups and choices
- Availability
- Archive and restore
- Table management
- Secure QR generation
- Owner dashboard interfaces

## Phase 3 — Anonymous Customer Ordering

- Public menu
- Item drawer
- Cart
- Server-side total calculation
- Order submission
- Idempotency
- Order confirmation
- Secure public tracking
- Responsive customer interface

## Phase 4 — Realtime Operations

- Live order board
- Status state machine
- Order details
- Audio alerts
- Toast notifications
- Payment-status management
- Owner and staff permission enforcement

## Phase 5 — Sales and Reports

- Daily sales summaries
- Monthly revenue
- Average order value
- Best-selling items
- Paginated order history
- Restaurant-timezone handling

## Phase 6 — Subscription Domain

- Subscription states
- Feature gating
- Billing settings
- Provider boundary
- Expired and past-due behavior
- Do not connect a real gateway until confirmed

## Phase 7 — Verification and Polish

- Unit tests for pricing and state transitions
- Authorization tests
- Cross-tenant security tests
- Duplicate-submission tests
- Responsive browser testing
- Complete customer-flow Playwright test
- Complete owner-flow Playwright test
- Accessibility check
- Typecheck
- Lint
- Tests
- Production build

---

# Required Test Journeys

## Customer Journey

```text
Open valid table QR
→ Browse categories
→ Open item drawer
→ Select required options
→ Add multiple items
→ Edit cart
→ Submit once
→ Receive order number
→ See pending status
→ See realtime preparing status
→ See realtime served status

```

## Owner Journey

```text
Sign in
→ Select restaurant
→ Create category
→ Create menu item
→ Create table
→ Generate QR
→ Receive new order
→ Hear one audio alert
→ Start cooking
→ Mark served
→ Mark paid
→ See dashboard sales update

```

## Staff Journey

```text
Sign in
→ Open assigned restaurant
→ View pending orders
→ View ordered items
→ Start cooking
→ Mark served
→ Confirm owner-only pages are inaccessible

```

## Tenant-Isolation Journey

```text
Create Restaurant A and Restaurant B
→ Assign different users
→ Attempt cross-restaurant reads and writes
→ Confirm every attempt is rejected server-side

```

---

# Engineering Rules

Follow these rules throughout implementation:

- Use Bun commands only.
- Preserve exact pinned auth-package versions.
- Do not upgrade the framework unless requested.
- Use existing repository patterns before adding new abstractions.
- Keep Convex public functions thin.
- Keep business logic in `convex/model`.
- Use protected wrappers for authenticated operations.
- Use strict public functions for anonymous customer operations.
- Validate forms with Zod.
- Validate Convex arguments with Convex validators.
- Do not use `any` or duplicate generated Convex types.
- Use `Doc<"table">` and `Id<"table">`.
- Do not hand-edit generated Convex files.
- Do not trust client-computed totals.
- Do not use unbounded arrays or unbounded database reads.
- Do not run deployment commands.
- Do not use Git unless I request it.
- Ask permission before creating migration, seed or deployment scripts.
- Do not leave placeholder buttons or fake completed features.
- Do not silently skip failed verification.
- Keep a short record of architectural decisions and unresolved items.

After every phase, run the relevant checks. Before final handoff, run:

```bash
bun run codegen
bun run typecheck
bun run lint
bun run test
bun run build

```

If a command does not exist, inspect the repository and propose the smallest correct script addition instead of inventing a different package-manager workflow.

Use Playwright to verify the completed flows in a real browser after the development server starts.

---

# First Response Required From You

Do not begin coding in your first response.

Return:

1. What already exists in the starter kit
2. What can be reused
3. What must be replaced or extended
4. Proposed tenant and permission architecture
5. Proposed Convex tables and important indexes
6. Proposed public and dashboard routes
7. Implementation phases
8. Dependencies you expect to add
9. Security risks and how you will prevent them
10. Blocking questions only

Keep the first response precise and implementation-oriented. Do not generate generic SaaS advice.
