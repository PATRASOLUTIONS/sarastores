# AGENTS.md

Agent guide for **ecommerce-sara** (Sara Electronics) — a full-stack e-commerce platform on Next.js 15 App Router, React 19, MongoDB (native driver, no ODM), and a custom HMAC session auth.

Scale: ~602 TS/TSX files · 125 pages · 197 API route files · 45 `lib/` modules · 40+ MongoDB collections.

> **Trust [CLAUDE.md](CLAUDE.md) over this file.** CLAUDE.md was re-verified against the code on 2026-09-05; several claims below (admin layout gating, middleware role checks, `lib/db.ts` database, `COLLECTIONS.SLIDES`, Next 14 sync `params`, route counts) are now stale. See §12 of CLAUDE.md.

## Deep-dive references

Load these on demand instead of re-deriving the information:

| Need | Skill |
| --- | --- |
| What features/routes/APIs exist | `.github/skills/platform-capability-map/SKILL.md` |
| Security rules, OWASP findings, known holes | `.github/skills/security-review/SKILL.md` |
| Code standards, anti-patterns, tech debt | `.github/skills/codebase-audit/SKILL.md` |

Feature docs live in [docs/](docs/) — notably [docs/features/](docs/features/), [docs/partner-api/](docs/partner-api/), [docs/security/](docs/security/), [docs/spin-wheel/](docs/spin-wheel/). [FEATURES.md](FEATURES.md) is the business-facing feature catalogue.

## Commands

`node_modules/` may be absent; `npm install` first.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `localhost:3000` |
| `npx tsc --noEmit` | **The only real type check — always run after TS changes** |
| `npm run build` | Production build. Silently ignores all TS + ESLint errors |
| `npm run seed:admin` | Create the initial admin user |
| `npm run migrate:schema:dry` | Dry-run the canonical product-schema migration (**always before the real one**) |
| `npm run migrate:schema` | Apply the product-schema migration |

`npm run lint` is **broken** — no ESLint config or dependency exists. Don't rely on it.

There is **no test framework** (no jest/vitest/playwright config, no test script). Files named `scripts/test-*` are manual smoke scripts run by hand against a live server.

## Non-negotiable rules

1. **Never rely on [middleware.ts](middleware.ts) for authorization.** For `/api/admin/*` it only checks *that a session exists*, then calls `NextResponse.next()`. Every route handler must independently call `requireUser()` / `requireAdmin()` / `requireVendor()` from [lib/auth.ts](lib/auth.ts). ~99 of 197 route files currently violate this — do not copy them.
2. **Derive identity from the session, never from the request.** `userId`, `vendorId`, `partnerId` come from `getSession()` or the authenticated API key — never from `request.json()`, `searchParams`, or a route param.
3. **Recompute all money server-side.** Client-supplied `price`, `subtotal`, `total`, `discount` are display hints only. Look up products and coupons from MongoDB before creating a Razorpay order or an order document.
4. **Keep [lib/session.ts](lib/session.ts) Edge-safe.** It runs inside middleware. No `Buffer`, no `require("crypto")`, no imports — Web Crypto plus `btoa`/`atob` only. Breaking this makes every session verify as `null`.
5. **Never import `@/lib/db`.** `connectDB()` points at database `ecommerce`; everything else uses `e-commerce-bytewise`. Use [lib/db-service.ts](lib/db-service.ts).
6. **Never hardcode a connection string, key, or password** — including in `scripts/`. Use `process.env` with no fallback.
7. **Run `npx tsc --noEmit`** — `next build` will not surface type errors.

## Architecture

Request flow: browser → Edge [middleware.ts](middleware.ts) → route handler or server layout → `lib/` → MongoDB.

- **Middleware** matches `/api/:path*`, `/admin/*`, `/account/*`, `/vendor/*`, `/dashboard/*`, `/partner-api-test`. It skips `/api/v1/partner/*` entirely (that surface has its own API-key auth + CORS in [lib/partner/auth.ts](lib/partner/auth.ts)). It lets page HTML/RSC through by design — do not add a redirect for `/admin` HTML, it reintroduces a documented RSC race.
- **Page gating is inconsistent.** [app/dashboard/layout.tsx](app/dashboard/layout.tsx) and [app/account/layout.tsx](app/account/layout.tsx) are true server gates (`await getSession()` → `redirect()`). [app/admin/layout.tsx](app/admin/layout.tsx) and [app/vendor/layout.tsx](app/vendor/layout.tsx) are `"use client"` and gate only in the browser. Follow the `account` pattern (server layout + client shell) for new privileged areas.
- **Runtime:** everything is Node.js serverless except [app/og/route.tsx](app/og/route.tsx) (`runtime = "edge"`) and middleware. `serverExternalPackages` and the webpack `alias: false` list in [next.config.mjs](next.config.mjs) keep MongoDB out of the browser bundle — don't remove them.
- **Auth:** custom HMAC-SHA256 signed cookie. `next-auth` is installed but **unused** at runtime; `authOptions` in [lib/auth.ts](lib/auth.ts) is a stub and [app/auth/signin/page.tsx](app/auth/signin/page.tsx) is dead code. Roles: `user`, `vendor`, `admin`, `superadmin`, plus optional `dashboardAccess` / `allowedPages` claims.

## Conventions

Scoped rules live in `.github/instructions/` and load automatically for the relevant files:

- [.github/instructions/api-routes.instructions.md](.github/instructions/api-routes.instructions.md) — route handler shape, guards, validation, responses
- [.github/instructions/data-access.instructions.md](.github/instructions/data-access.instructions.md) — MongoDB access, collections, indexes
- [.github/instructions/react-components.instructions.md](.github/instructions/react-components.instructions.md) — client/server components, styling, state

Quick summary:

- **Data access:** `lib/db-service.ts` (`getAll`, `getById`, `create`, `getCollection`, `normalizeId`, `COLLECTIONS`). Always `normalizeId` before returning — clients see a string `id`, never `_id`.
- **Validation:** Zod schemas in [lib/validation.ts](lib/validation.ts) with `safeParse`. Currently only 3 files use it; new write routes must.
- **Errors:** return `{ error: string }` with a correct status; wrap unexpected throws in `handleApiError` from [lib/api-error.ts](lib/api-error.ts). Partner routes use `createSuccessResponse` / `createErrorResponse` from [lib/partner/auth.ts](lib/partner/auth.ts) instead.
- **Next 15 params are a Promise:** `context: { params: Promise<{ id: string }> }` then `await context.params`. 21 route files still use the Next 14 sync form — don't copy them.
- **Toasts:** `react-hot-toast` only. `sonner` is installed but imported zero times.
- **Dark mode is disabled** (`forcedTheme="light"` in [app/providers.tsx](app/providers.tsx)) — `dark:` variants will not fire.
- **Client API calls** in admin/dashboard/account go through `apiFetch` from [lib/api-client.ts](lib/api-client.ts) (sends cookies).

## Environment

`MONGODB_URI` is validated at module load in [lib/mongodb.ts](lib/mongodb.ts) — it throws without it, so `.env.local` must exist before any build. `SESSION_SECRET` (or `NEXTAUTH_SECRET`) must be ≥16 chars.

**`.env.example` is unusable as-is:** every line is commented out, it declares `SMTP_PASSWORD` while code reads `SMTP_PASS`, and ~27 variables the code reads are missing from it. Check actual `process.env` usage before assuming a variable name.

Three overlapping URL variables exist — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` — with three different fallbacks. Keep them in sync.

## Corrections to older docs

[CLAUDE.md](CLAUDE.md) and several `docs/` files are stale. Verified against current code:

| Claim | Reality |
| --- | --- |
| "The admin layout is the authoritative server-side check" | [app/admin/layout.tsx](app/admin/layout.tsx) is `"use client"`. There is no server-side gate on `/admin` pages. |
| Collections `cart`, `wishlist`, `software`, `inquiries` | Real names are `carts`, `wishlists`, `software_products`, `contact_inquiries`. `COLLECTIONS.CART` / `COLLECTIONS.WISHLIST` are dead constants no code uses. |
| Collections `vendors`, `notifications`, `licenses`, `store_purchases`, `scrape_jobs`, `categories_test`, `orders_test` | Do not exist anywhere in code. |
| `spin_wheel_*` collections | Real pattern is `spin_<slug>_*`, with legacy camelCase `spinWheel*` for the `default` campaign ([lib/spin-wheel-campaigns.ts](lib/spin-wheel-campaigns.ts)). |
| `app/api/checkout/` route | Does not exist. Checkout posts to `/api/orders` and `/api/payment/*`. |
| Abandoned-cart cron is live | Disabled — the import is commented out in [instrumentation.ts](instrumentation.ts), which still logs "✅ Cron jobs initialized successfully". `vercel.json` has no `crons` block. The 10 docs in [docs/abandoned-cart/](docs/abandoned-cart/) all describe it as working. |
| Firebase storage integration | No Firebase SDK is installed and no file-upload route exists. Only CSP/image allowlist entries reference it. |

Other live bugs worth knowing: `COLLECTIONS.SLIDES` is undefined, so `GET /api/product-slides` silently returns `[]` and `POST` always 500s.

## Repo hygiene

Root-level `audit-ids.js`, `inspect-*.js`, `inspect_order.js`, `exhaustive-audit.js`, `check-assignments.js`, `extract-docx.js`, `order_dump.json`, `order_debug_dump.json` are one-off debug leftovers, not part of the app. The two JSON dumps contain order data — treat as PII. `README.md` is placeholder scratch notes.
