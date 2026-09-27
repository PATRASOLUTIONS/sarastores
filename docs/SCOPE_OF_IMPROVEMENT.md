# Scope of Improvement — ecommerce-sara

**Prepared:** 11 August 2026
**Companion document:** [SECURITY_AUDIT_2026-08-11.md](SECURITY_AUDIT_2026-08-11.md)

This document covers everything **outside** the security remediation already completed. Items are ordered by business impact and grouped into delivery phases.

---

## Platform snapshot

| Dimension | Current state |
| --- | --- |
| API routes | 206 files |
| Storefront pages | 125 |
| Admin modules | 64 pages |
| MongoDB collections | 50 (`e-commerce-bytewise`, 87.8 MB) |
| Catalogue | 665 products, all active, all priced, 0 duplicate SKUs or slugs |
| Orders | 104 (46 confirmed, 39 delivered, 16 queued, 2 cancelled, 1 processing) |
| Customers | 9 accounts (4 admin) |
| Automated tests | **0** |
| Type errors | 75 |
| Dependency CVEs | 22 (3 critical, 15 high) |

---

## Phase 1 — Launch blockers (do before go-live)

### 1.1 Broken and dead features

| Issue | Detail | Effort |
| --- | --- | --- |
| **`/admin/external-orders` is non-functional** | The page calls `/api/admin/external-orders`, `.../retry` and `.../cancel`. **None of these routes exist.** The `external_orders` collection holds 56 real records that are unreachable from the UI. | 1–2 days |
| **`/offers` returns 404 but is linked from the homepage** | `components/home/SaraAdvantageBar.tsx` links to it twice. `app/offers/` contains only `loading.tsx`, no `page.tsx`. | 0.5 day |
| **`/search` and `/wishlist` are dead routes** | Same pattern — `loading.tsx` with no `page.tsx`. Not linked from navigation (search goes to `/products`, wishlist to `/dashboard/wishlist`), so delete the folders or build the pages. | 0.5 day |
| **`COLLECTIONS.SLIDES` is undefined** | `GET /api/product-slides` silently returns `[]`; `POST` always 500s. | 1 hour |

### 1.2 Production data hygiene

- **Test categories in production** — `categories` contains `test1`, `test2`, `test3`, which appear in storefront navigation.
- **Orphan categories** — 30 products reference `SMALL APPLIANCE` and `Home & Kitchen`, which have no category document. Category pages for those products will 404.
- **Duplicate cart** — one user has two cart documents, which blocks a unique index on `carts.userId` and can cause inconsistent cart state.
- **124 orphaned payment records** in the old `ecommerce` database need migrating or archiving now that the database split is fixed.
- **Brand data quality** — the `brand` field frequently duplicates `category` (e.g. brand "HOME APPLIANCES"). 7 products have no brand at all. This breaks brand filtering and brand landing pages.
- **PII in the repository** — `order_dump.json` and `order_debug_dump.json` at the repo root contain real order data. Delete them.

### 1.3 Repository hygiene

Root-level one-off debug scripts to remove: `audit-ids.js`, `inspect-api.js`, `inspect-sample.js`, `inspect_order.js`, `exhaustive-audit.js`, `check-assignments.js`, `extract-docx.js`, `tmp-phase2-check.ts`. `README.md` is placeholder scratch notes and should describe setup and deployment.

---

## Phase 2 — Engineering foundations (first 4 weeks post-launch)

### 2.1 Testing — highest-value investment

There is **no test framework at all**: no jest, vitest or playwright config, and no test script. Files named `scripts/test-*` are manual smoke scripts. Every deployment is unverified.

Recommended minimum:

1. **Vitest** for `lib/` units — start with `lib/order-pricing.ts`, `lib/session.ts`, `lib/auth.ts`, `lib/partner/wallet.ts`. These four modules carry the money and identity logic.
2. **Contract tests** for the ~40 highest-traffic API routes, asserting the status code for each role. The audit harness built during this engagement is a working template — it caught 23 unguarded endpoints in one run.
3. **Playwright** for three journeys: browse → cart → checkout → payment; login → order history; admin login → product edit.
4. **CI gate**: run `npx tsc --noEmit`, `npm audit --omit=dev` and the test suite on every push.

### 2.2 Restore the safety nets

- **`npm run lint` is broken** — no ESLint config or dependency exists. Add `eslint-config-next`.
- **`next.config.mjs` silences all errors** — `ignoreDuringBuilds` and `ignoreBuildErrors` mean the build never fails on a type error. Fix the 75 outstanding errors, then remove both flags.
- **75 type errors** concentrated in `app/admin/orders/[id]/page.tsx` (9), `hooks/useCart.ts` (6), `lib/partner/api-keys.ts` (4), `app/admin/products/new/page.tsx` (4), `app/admin/customers/page.tsx` (4).
- **21 route files still use the Next 14 synchronous `params`** signature instead of `params: Promise<{...}>`.

### 2.3 Configuration management

- **`.env.example` is unusable** — every line is commented out, it declares `SMTP_PASSWORD` while the code reads `SMTP_PASS`, and ~27 variables the code reads are missing entirely.
- **`.env.local` is fully commented out** (0 active variables), which silently makes `npm run indexes:retention` fail since it loads that file.
- **Three overlapping URL variables** — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` — with three different fallbacks. `NEXTAUTH_URL` is currently missing its scheme (`systechdigital.co.in`).
- **`DB_NAME` and `MONGODB` are ignored** — the database name is hardcoded in `lib/mongodb.ts`.

---

## Phase 3 — Performance and scale

### 3.1 Images (largest remaining win)

Page weight is fixed, but the underlying assets are not. The three hero images are **3.4 MB, 3.4 MB and 4.4 MB PNGs** — a first-time visitor still downloads ~11 MB of hero art, and one document is 5.9 MB against MongoDB's 16 MB limit.

Two options:
- **Content fix (free):** re-export as WebP at display resolution — roughly 150 KB each, a 97% reduction.
- **Engineering fix:** add `sharp` transcoding to `/api/media/[type]/[id]` to serve WebP/AVIF at a requested width. Protects against whatever gets uploaded next.

**Strategic recommendation:** stop storing images in MongoDB. Move to Vercel Blob, S3 or Cloudinary and store URLs. The current media route is a bridge, not a destination.

### 3.2 Caching

Every HTML response sends `Cache-Control: private, no-cache, no-store` — nothing is CDN-cacheable, including anonymous product pages. Introduce ISR or `s-maxage` for catalogue pages.

### 3.3 Query patterns

- `getAll()` applies **no default limit and no sort**; some callers pass `{ limit: 0 }`, an unbounded collection scan.
- 12 core indexes were created during the audit. The 14 partner-API indexes specified in `docs/partner-api/PARTNER_SELLING_SYSTEM.md` were never implemented.
- `createTransaction` in `lib/partner/wallet.ts` does a read-modify-write on wallet balances and is **racy**. `releasePendingBalance` in the same file does it correctly with `$inc` inside a guarded filter — follow that pattern.

### 3.4 Scaling prerequisites

- Rate limiting is in-memory; move to Redis before running more than one instance.
- Cron jobs run via `requireCron` HTTP endpoints but `vercel.json` has **no `crons` block** — nothing is scheduled. The 10 documents in `docs/abandoned-cart/` describe a system that is disabled in `instrumentation.ts`.

---

## Phase 4 — Architecture and maintainability

### 4.1 Consolidate the data layer

Three overlapping modules exist. `lib/db.ts` now delegates correctly but should be **deleted** and its nine importers repointed at `lib/db-service.ts`.

### 4.2 Fix the documented-but-wrong constants

`COLLECTIONS.CART` (`"cart"`) and `COLLECTIONS.WISHLIST` (`"wishlist"`) are dead — the real collections are `carts` and `wishlists`. `COLLECTIONS.SLIDES` is undefined.

### 4.3 Adopt validation consistently

`lib/validation.ts` holds Zod schemas but only three files use it. Every write route should validate with `safeParse`. This single practice is what blocked the NoSQL injection attempts during the audit.

### 4.4 Large files needing decomposition

`components/Header.tsx` (~46 KB), `components/ProductSpecificationTabs.tsx` (~46 KB), `components/store-locator.tsx` (~40 KB), `app/admin/partners/[partnerId]/page.tsx` (2,100+ lines).

### 4.5 Documentation drift

`CLAUDE.md` and several files under `docs/` describe collections and routes that do not exist. `AGENTS.md` is accurate — consolidate onto it and delete the stale material.

---

## Phase 5 — Growth features

### 5.1 Conversion

- **Reviews are empty and no product has a rating** — social proof is entirely absent. Ratings are the single highest-impact conversion lever for electronics retail.
- **77 products have no MRP**, so no strike-through pricing or discount badge.
- Abandoned-cart recovery exists in code but is not scheduled.

### 5.2 SEO

Already in place: sitemap, robots, per-product metadata, Product JSON-LD, `llms.txt`, feed, manifest, Organization/Store JSON-LD.

Remaining gaps:
- `app/sitemap.ts` emits `/product/${_id}` instead of the slug, despite every product having a valid slug.
- No `BreadcrumbJsonLd` on product, category or brand pages (the utility exists in `lib/seo.tsx`, used nowhere).
- No `ItemList`/`CollectionPage` schema on category pages.
- `web-vitals@5.1.0` is installed but never imported — no INP data.
- Missing `gtin` in Product JSON-LD blocks Google Shopping eligibility.

### 5.3 Operational visibility

There is no error tracking, no structured logging and no uptime monitoring. Add Sentry (or equivalent) plus a health-check monitor on `/api/health` before scaling marketing.

---

## Suggested sequencing

| Phase | Focus | Indicative effort |
| --- | --- | --- |
| **1** | Launch blockers, data hygiene, credential rotation | 1 week |
| **2** | Testing, CI, type errors, config management | 3–4 weeks |
| **3** | Image pipeline, caching, indexes, Redis | 2–3 weeks |
| **4** | Data-layer consolidation, validation, refactors | 3–4 weeks |
| **5** | Reviews, SEO, monitoring, growth | Ongoing |

**Highest return per unit of effort:** Phase 1 (small, unblocks launch), then §2.1 testing (prevents recurrence of exactly the class of bug this audit found), then §3.1 images (97% asset reduction for zero code change).
