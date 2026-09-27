# CLAUDE.md

Working guide for **ecommerce-sara** (Sara Electronics) — a full-stack e-commerce platform on Next.js 15 App Router, React 19, MongoDB (native driver, no ODM), and a custom HMAC-signed cookie session.

Every claim below was verified against the code on 2026-09-05. Where an older doc contradicts this file, this file wins — see [Corrections to older docs](#corrections-to-older-docs).

**Scale:** 219 API route files · ~125 page routes · 94 components · 45 `lib/` modules · 65+ MongoDB collections · 16 hooks · 3 React contexts.

---

## 1. Commands

`node_modules/` may be absent; run `npm install` first. `.env.local` must exist before *any* command that loads app code — [lib/mongodb.ts](lib/mongodb.ts) throws at module load without `MONGODB_URI`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:3000` |
| `npx tsc --noEmit` | **The only real type check. Always run after TS changes.** |
| `npm run build` | Production build. Silently ignores *all* TS and ESLint errors (see [next.config.mjs](next.config.mjs)) |
| `npm start` | Serve the production build |
| `npm run seed:admin` | Create the initial admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) |
| `npm run indexes:core` | Create core MongoDB indexes (reads `.env`) |
| `npm run indexes:retention` | Create retention-collection indexes (reads `.env.local`) |
| `npm run migrate:schema:dry` | Dry-run the canonical product-schema migration — **always run before the real one** |
| `npm run migrate:schema` | Apply the product-schema migration |
| `npm run migrate:schema:strict` | Same, but fails hard on any non-conforming document |

`npm run lint` is **broken** — no ESLint config or dependency is installed. Don't rely on it.

**There is no test framework.** No jest/vitest/playwright config, no `test` script. Files named `scripts/test-*` are manual smoke scripts run by hand against a live server.

---

## 2. Non-negotiable rules

1. **Every route handler guards itself.** [middleware.ts](middleware.ts) *does* enforce roles (see §4), but it is prefix-based and silently misses new paths. Only 77 of 219 route files currently call a guard. Always call `requireUser()` / `requireAdmin()` / `requireVendor()` from [lib/auth.ts](lib/auth.ts) inside the handler.
2. **Derive identity from the session, never from the request.** `userId`, `vendorId`, `partnerId` come from `getSession()` / `getCurrentUserId()` or the authenticated API key — never from `request.json()`, `searchParams`, or a route param.
3. **Recompute all money server-side.** Client-supplied `price`, `subtotal`, `total`, `discount` are display hints only. Use `computeOrderPricing()` from [lib/order-pricing.ts](lib/order-pricing.ts), which re-reads products, software and coupons from MongoDB before any Razorpay order or order document is created.
4. **Keep [lib/session.ts](lib/session.ts) dependency-free.** It runs inside Edge middleware. Web Crypto (`crypto.subtle`), `TextEncoder`, `btoa`/`atob` only — no `Buffer`, no `require("crypto")`, no imports. Breaking this makes every session verify as `null` everywhere.
5. **Use [lib/db-service.ts](lib/db-service.ts) for data access.** [lib/db.ts](lib/db.ts) is `@deprecated` (10 files still import it); it now delegates to the same database, but new code must not use it.
6. **Never hardcode a connection string, key, or password** — including in `scripts/`. Use `process.env` with no fallback.
7. **Always `normalizeId()` before returning documents.** Clients see a string `id`; they must never see `_id`.
8. **Run `npx tsc --noEmit`.** `next build` will not surface type errors.

---

## 3. Architecture at a glance

```
browser
  → Edge middleware.ts        (session verify + path/method authorization)
    → route handler | server layout | server component
      → lib/*                 (auth, db-service, pricing, email, partner, retention…)
        → MongoDB "e-commerce-bytewise"
```

**Runtime:** everything is Node.js serverless except [middleware.ts](middleware.ts) and [app/og/route.tsx](app/og/route.tsx) (`runtime = "edge"`). `serverExternalPackages` plus the webpack `fallback`/`alias: false` lists in [next.config.mjs](next.config.mjs) keep `mongodb`, `node-cron`, `snappy`, `kerberos`, `mongodb-client-encryption`, `@mongodb-js/zstd`, `aws4`, `gcp-metadata` and `socks` out of the browser bundle. Don't remove them.

**Stack:** Next 15.5 · React 19.2 · TypeScript `strict: true` · Tailwind 3.4 + shadcn/Radix · framer-motion 11 · SWR 2.3 · Zod 3.25 · mongodb 6.11 (native driver) · razorpay 2.9 · nodemailer 7 · Leaflet (store locator) · Tiptap (rich text) · recharts (admin charts) · jsPDF + xlsx (exports).

---

## 4. Authentication & authorization

### Session tokens — [lib/session.ts](lib/session.ts)

- Format: `base64url(payload).base64url(hmacSha256(payload))`.
- Payload: `{ id, email, role, dashboardAccess?, allowedPages?, exp }`.
- Cookie: `session`, httpOnly. `SESSION_MAX_AGE` = 24 h.
- Secret: `SESSION_SECRET`, falling back to `NEXTAUTH_SECRET`. Must be ≥16 chars (32+ recommended); missing in production logs a loud one-time error and every session verifies as `null`.
- Rejections are logged with a throttled, structured reason (`logReject`) — that's the first place to look for "the cookie is there but I'm logged out".
- Roles: `user`, `vendor`, `admin`, `superadmin`, plus optional `dashboardAccess: boolean` and `allowedPages: string[]` claims for granular staff access.

`next-auth@5.0.0-beta` is installed but **unused at runtime**. `authOptions` in [lib/auth.ts](lib/auth.ts) is an empty stub, and [app/auth/signin/page.tsx](app/auth/signin/page.tsx) is dead code.

### Guards — [lib/auth.ts](lib/auth.ts)

| Helper | Behaviour |
| --- | --- |
| `getSession()` | Canonical server-side read. Returns `AuthSession \| null`, fails closed. |
| `getCurrentUserId()` | Session user id, or `null` (used for guest-tolerant endpoints like cart/wishlist). |
| `requireUser()` | `{ ok: true, user }` or `{ ok: false, response }` → 401. |
| `requireAdmin()` | Delegates to `checkAdminAuthorization()`; 401 on failure. |
| `requireVendor()` | `vendor` \| `admin` \| `superadmin`; 401 unauthenticated, **403** wrong role. |
| `checkAdminAuthorization()` | Session fast-path for `admin`/`superadmin`, otherwise re-reads the live `users` document so `dashboardAccess` granted after login isn't blocked by a stale token. |
| `requireCron(request)` | [lib/cron-auth.ts](lib/cron-auth.ts) — timing-safe `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`). 503 if the secret isn't configured, 401 if wrong. |

Usage pattern:

```ts
const guard = await requireAdmin()
if (!guard.ok) return guard.response
```

### Middleware — [middleware.ts](middleware.ts)

Matches `/api/:path*`, `/admin/:path*`, `/account/:path*`, `/vendor/:path*`, `/dashboard/:path*`, `/partner-api-test`.

- **Early-returns for `/api/v1/partner/*`** — that surface has its own API-key auth + CORS in [lib/partner/auth.ts](lib/partner/auth.ts).
- **`/api/admin/*` and `/api/spin-wheel/admin/*`**: 401 without a session, 403 unless `admin` / `superadmin` / `dashboardAccess`.
- **Path + method policy table** for the long tail: vendor APIs require a vendor; `/api/events` and `/api/vitals` POSTs are open (anonymous telemetry); `/api/leads/settings` GET and `/api/leads` POST are open (storefront lead form); an `adminAll` list (software licenses, license keys, scraped products, lead settings/export, product + spec exports) is admin-only for every method; order bulk-upload/bulk-update/assign-license writes are admin-only; coupon writes are admin except `validate`/`redeem`; review writes require any logged-in user; an `adminWrite` list (~24 catalog/content prefixes) is admin-only for writes with GET public — carved out for `/api/products/bulk` POST (compare page), `/api/employees/validate` (in-store checkout before login) and `/api/contact-inquiries` POST (public form).
- **Page routes are deliberately not redirected in middleware** for `/dashboard` and `/account` (and `/admin` GETs). The layouts do the authoritative check. Adding a 307 here reintroduces a documented RSC race where sub-pages bounced logged-in users to `/` while the landing page worked.

### Page gating

| Area | Layout | Gate |
| --- | --- | --- |
| `/admin` | [app/admin/layout.tsx](app/admin/layout.tsx) | ✅ Server. `export const dynamic = "force-dynamic"`, `await getSession()`, redirect to `/login?redirect=/admin`, then requires `admin`/`superadmin`/`dashboardAccess`. Renders `AdminClientShell`. |
| `/dashboard` | [app/dashboard/layout.tsx](app/dashboard/layout.tsx) | ✅ Server. `getSession()` → `redirect()`. |
| `/account` | [app/account/layout.tsx](app/account/layout.tsx) | ✅ Server gate + client shell. **Copy this pattern for new privileged areas.** |
| `/vendor` | [app/vendor/layout.tsx](app/vendor/layout.tsx) | ❌ `"use client"` — `useAuth()` + `useEffect` redirect only. The one remaining client-only gate; real enforcement is per API route. |

---

## 5. Data layer

### Three modules, one database

| Module | Role |
| --- | --- |
| [lib/mongodb.ts](lib/mongodb.ts) | Low-level `MongoClient` singleton (cached on `globalThis` in dev to survive HMR). `connectToDatabase()` returns `{ client, db }` for database **`e-commerce-bytewise`**. Validates `MONGODB_URI` at module load. Pool 10, 5 s server selection, 45 s socket, IPv4 only. |
| [lib/db-service.ts](lib/db-service.ts) | **The layer to use.** Generic CRUD: `getAll`, `getById`, `create`, `update`, `remove`, `findOne`, `findMany`, `count`, `aggregate`, `insertMany`, `updateMany`, `deleteMany`, index helpers, plus `getCollection`, `normalizeId`, `createObjectId`, the `COLLECTIONS` constant, and the settings/footer singleton helpers. |
| [lib/db.ts](lib/db.ts) | `@deprecated` thin wrapper. It now delegates to `connectToDatabase()`, so it hits the *same* database — but 10 files still import it and new code must not. |

`getById` tries `ObjectId` first, then string `_id`, then an `id` field. Keep that fallback order when adding lookups.

`normalizeId` strips `_id`, deletes any pre-existing `id` field so it can't shadow the real one, and appends `id: _id.toString()` last.

### `getSettingsData()` / image offloading

The `settings` document holds ~900 KB of base64 images. `getSettingsData()` runs an aggregation that detects `data:` URIs and swaps them for `/api/media/<type>/<id>?v=<len>` URLs so the root layout never ships them. `setSettingsData()` drops any field that came back as a media URL so a client round-trip can't erase the stored image. See [lib/media.ts](lib/media.ts) and [lib/media-store.ts](lib/media-store.ts).

### Collections actually referenced in code

**Catalog:** `products`, `categories`, `sub_categories`, `brands`, `product_specifications`
**Shopping:** `carts`, `wishlists`, `compare`
**Orders/payments:** `orders`, `payments`, `counters`, `external_orders`
**Identity:** `users`, `customer_profiles`, `customer_events`
**Feedback:** `reviews`, `complaints`, `contact_inquiries`, `leads`, `lead_settings`
**Content:** `settings`, `footer`, `hero_slides`, `hero_images`, `split_cards`, `animated_banners`, `advertisements`, `product_advertisements`, `offers`, `featured_products`, `home_components`, `testimonials`, `product_slides`, `campaign_pages`, `email_templates`, `campaign_history`, `site_features`
**Spin wheel:** `spinWheelCampaigns` + per-campaign shards `spin_<slug>_participants|inventory|couponCodes|coupons|otps|visits`; the `default` campaign uses legacy camelCase `spinWheelParticipants`, `spinWheelInventory`, … (see [lib/spin-wheel-campaigns.ts](lib/spin-wheel-campaigns.ts))
**Lucky draw:** `lucky_draw_campaigns`, `lucky_draw_participants`, `lucky_draw_winners`
**Partner:** `partners`, `partner_api_keys`, `partner_wallets`, `wallet_transactions`, `partner_products`, `partner_orders`, `partner_payments`, `payouts`
**Software:** `software_products`, `license_keys`, `software_licenses`
**Stores/logistics:** `store_locations`, `store_qr_codes`, `blocked_pincodes`
**Ops:** `employees`, `coupons`, `analytics_events`, `web_vitals`

`COLLECTIONS.CART` (`"cart"`) and `COLLECTIONS.WISHLIST` (`"wishlist"`) are **dead constants** — the live collections are `carts` and `wishlists`. `COLLECTIONS.SLIDES` is `"product_slides"` and is used by [app/api/product-slides/route.ts](app/api/product-slides/route.ts).

---

## 6. `lib/` module map

### Core
- **session.ts** — signed session tokens (see §4). Edge-safe.
- **auth.ts** — `getSession`, `getCurrentUserId`, `requireUser`/`requireAdmin`/`requireVendor`, `checkAdminAuthorization`, `isAdmin`, stub `authOptions`.
- **cron-auth.ts** — `requireCron(request)` bearer-secret check for `/api/cron/*`.
- **mongodb.ts / db-service.ts / db.ts** — see §5.
- **api-error.ts** — `handleApiError(error, message?)` → `{ error, success: false }` 500. Used in 42 route files.
- **api-client.ts** — `apiFetch()` for admin/dashboard/account client calls; sets `credentials: "include"` so httpOnly cookies survive CDN/proxy hops, and normalises JSON/error handling.
- **validation.ts** — Zod schemas: `phoneSchema`, `pincodeSchema`, `emailSchema`, `passwordSchema`, `simplePasswordSchema`, `nameSchema`, `urlSchema`, `priceSchema`, `quantitySchema`, `LoginSchema`, `RegisterSchema`, `ForgotPasswordSchema`, `ResetPasswordSchema`, `ChangePasswordSchema`, `UpdateProfileSchema`, `UpdateConsentSchema`, `UnsubscribeSchema`, `AddressSchema`, `ProductVariantSchema`, `CreateProductSchema`, `UpdateProductSchema`, `OrderItemSchema`, `CreateOrderSchema`, `UpdateOrderStatusSchema`, `ReviewSchema`, `ContactFormSchema`, `ComplaintSchema`. **Only ~5 routes import from here** — several others define inline schemas. New write routes must use it.

### Commerce
- **order-pricing.ts** — `computeOrderPricing()`: loads products + software from Mongo, applies GST, shipping (free above a configurable threshold), coupon discounts. Returns `PricingSuccess | PricingError`. Authoritative.
- **order-id.ts** — `generateOrderId()` → `SARAECOM-<seq>` via the `counters` collection; `isSaraOrderId()`.
- **razorpay.ts** — `getRazorpayClient(opts)` factory (supports per-partner keys), `verifyRazorpayPayment()` confirming capture *and* amount.
- **license-service.ts** — `findAvailableLicense()`, `assignLicense()` over `software_licenses`.
- **software-service.ts** — CRUD over `software_products`.
- **product-schema.ts** — canonical product schema + column aliases; the migration script targets it.
- **coupon / offer logic** lives in the route handlers, not a lib module.

### Growth & retention
- **lib/retention/** — `cart-recovery.ts` (`runCartRecovery({ dryRun })`, DB-backed reminder state, max 2 emails), `wishlist-alerts.ts` (price drop / restock), `lifecycle.ts`, `segmentation.ts`, `rules.ts` (thresholds), `messages.ts`.
- **lib/marketing/** — `campaigns.ts` (template catalogue), `segments.ts` (audiences), `occasions.ts` (festival calendar), `email-layout.ts`, `whatsapp.ts` (AskEva; `isConfigured()` gates on `ASKEVA_API_KEY` + `ASKEVA_API_URL`).
- **customer-profile.ts** — `customer_profiles` rollup: lifetime spend, order count, tier, consent flags, `unsubscribeToken`. Only orders in `EARNING_STATUSES` count.
- **spin-wheel-campaigns.ts / spin-wheel-notifications.ts** — campaign shards, weighted prize draw, winner notification via WhatsApp + email.
- **lucky-draw.ts** — campaign/participant/winner types, crypto-random `pickRandom()`, draw tokens.
- **admin-alerts.ts** — low-license-inventory email to admins.

### Platform
- **lib/partner/** — `auth.ts` (API-key authentication + CORS via `PARTNER_ALLOWED_ORIGINS`, `createSuccessResponse`/`createErrorResponse`), `api-keys.ts` (issue/hash/validate), `service.ts`, `wallet.ts`, `orders.ts`, `rate-limit.ts`, `types.ts`, `index.ts` barrel.
- **encryption.ts** — AES-256-GCM for partner secrets; `API_KEY_ENCRYPTION_SECRET` or `PARTNER_API_KEY_SECRET`.
- **integrations.ts** — integration registry (kGen/eXlr8, MockPay, Amazon scraper).
- **cache.ts** — `lru-cache` wrapper (500 items / 50 MB) with `CACHE_TTL` presets.
- **rate-limit.ts** — in-memory sliding window (`AUTH` 5/15 min, `API` 100/min). **Resets on every serverless cold start — needs Redis for real protection.**
- **botDetection.ts** — reCAPTCHA v3 verification.
- **email.ts / emailTemplates.ts / promoTemplates.ts** — Nodemailer SMTP + 50 KB+ of HTML templates.
- **seo.tsx / seo-metadata.ts / jsonld-store.ts** — `buildPageMetadata()`, JSON-LD generators and components. Rendered via [components/SiteJsonLd.tsx](components/SiteJsonLd.tsx) in the root layout, plus per-page `*JsonLdServer.tsx` components.
- **qr-pamphlet.ts** — jsPDF + qrcode store pamphlets.
- **analytics.ts** — client GA4/dataLayer wrapper, mirrors to `/api/events`.
- **performance.ts** — Web Vitals thresholds/types.
- **utils.ts** — `cn()` (clsx + tailwind-merge). **animations.ts** — framer-motion presets.
- **Reference data:** `store-data.ts`, `indiaData.ts`, `brandGuidelines.ts`, `complaintTypes.ts`, `electronicEmojis.ts`, `mock-data.ts`.
- **security-headers.ts** — unused; the real CSP lives in [next.config.mjs](next.config.mjs).
- **lib/cron/abandoned-cart.ts** — superseded by `lib/retention/cart-recovery.ts`; its import in [instrumentation.ts](instrumentation.ts) is commented out.

---

## 7. API surface (219 route files)

### Conventions

- **Next 15 async params everywhere:** `context: { params: Promise<{ id: string }> }` then `await context.params`. No route file still uses the Next 14 sync form.
- **Success:** `NextResponse.json({ success: true, data })` or the bare normalised document/array.
- **Error:** `NextResponse.json({ error: "message" }, { status })`. Wrap unexpected throws in `handleApiError`.
- **Partner routes are different:** they use `createSuccessResponse` / `createErrorResponse` from [lib/partner/auth.ts](lib/partner/auth.ts) and attach CORS headers.
- **Cron routes** call `requireCron(request)` and accept `?dryRun=1`.

### Namespaces

**Auth** `/api/auth/*` — `login`, `signup`, `logout`, `session`, `verify-email`, `forgot-password`, `reset-password`, `google` + `google/callback`, `config`, `store-purchase`. Login/signup use Zod + bcrypt + reCAPTCHA/bot detection and issue the signed cookie.

**Catalog** `/api/products/*` (list with `fields=card` projection, `[id]`, `sku/[sku]`, `specifications/*`, `bulk`, `bulk-price-update`, `bulk-update-mrp`, `bulk-metadata-update`, `upload-excel`, `export`, `activate-all`, `google-sheet-price-sync`), `/api/categories/*`, `/api/sub-categories/*` (+ `extract-from-products`), `/api/brands`, `/api/search/suggestions`. GETs public, writes admin-only.

**Commerce** `/api/cart`, `/api/wishlist` (both guest-tolerant via `getCurrentUserId()`), `/api/coupons/*` (`validate`/`redeem` customer-facing, rest admin), `/api/reviews/*`, `/api/orders/*` (`[id]`, `[id]/invoice`, `[id]/assign-license`, `track`, `bulk-upload`, `bulk-update`), `/api/payment/create-order`, `/api/payment/verify`, `/api/payments`, `/api/razorpay/offers`.

**Content** `/api/settings`, `/api/footer`, `/api/hero-slides`, `/api/home-components`, `/api/featured-products`, `/api/offers`, `/api/offer-products`, `/api/advertisements`, `/api/product-advertisements`, `/api/animated-banner`, `/api/split-cards`, `/api/testimonials`, `/api/product-slides`, `/api/content/[type]`, `/api/campaign-pages/[slug]`, `/api/media/[type]/[id]`.

**Admin** `/api/admin/*` (~45 routes) — partners + API keys + wallets + payouts + commissions, campaign pages/history/recipients, `send-campaign`, email templates, marketing templates + WhatsApp, external orders, lucky draw, store locations, store QR (+ bulk + analytics), segments, retention overview, features, database clear, assign-missing-licenses.

**Gamification** `/api/spin-wheel/*` — public `spin`, `register`, `track`, `otp/send`, `otp/verify`; admin `campaigns`, `campaigns/[slug]`, `analytics`, `dashboard`, `inventory`, `participants`, `stores`, `coupons`, `coupon-codes`, `export`. `/api/lucky-draw/[token]` + `draw` + `notify`.

**Software** `/api/software/*`, `/api/software/license-keys/*`, `/api/software-licenses`.

**Vendor** `/api/vendor/products` and `/api/vendor/products/[id]` — currently rely on the middleware vendor check; add `requireVendor()` when you touch them.

**Partner API v1** `/api/v1/partner/*` (16 routes) — `register`, `api-keys/domains`, `orders` (+ `[orderId]`, `cancel`, `status/[id]`, `razorpay/create`, `razorpay/verify`), `products` (+ `[productId]`, `specifications`, `stock-check`), `wallet` (`balance`, `transactions`, `payouts`, `payout`, `bank-accounts`). Bypasses middleware entirely; authenticated by API key with its own rate limiting and CORS. Docs at [app/partner-api-docs](app/partner-api-docs), tester at [app/partner-api-test](app/partner-api-test) (admin-gated).

**Integrations** `/api/integrations/exlr8/*` — `webhook`, `queue-order`, `place-order`, `orders`, `products`, `external/[id]`, `wallet/balance`, `wallet/transactions`.

**Cron** `/api/cron/*` — `cart-recovery`, `wishlist-alerts`, `lifecycle-reminders`, `segment-customers`, `rebuild-profiles`, `init`. All require `CRON_SECRET`.

**Telemetry & misc** `/api/events`, `/api/vitals`, `/api/health`, `/api/unsubscribe`, `/api/notifications/email`, `/api/india/states`, `/api/india/cities`, `/api/blocked-pincodes`, `/api/stores`, `/api/store-qr/scan/[id]`, `/api/employees` + `validate`, `/api/leads` (+ `settings`, `export`), `/api/complaints/*`, `/api/contact*`, `/api/users/*`, `/api/user/recently-viewed`, `/api/account/preferences`, `/api/scrape-amazon`, `/api/scraped-products`.

**Debug / seed / test routes** — `/api/debug/*`, `/api/debug-categories`, `/api/debug-product/[id]`, `/api/direct-update/[id]`, `/api/test-db`, `/api/test-connection`, `/api/test-product-update`, `/api/migrate`, `/api/seed-database`, `/api/seed-categories`, `/api/clear_database`. The destructive ones call `checkAdminAuthorization()`; several read-only ones (`debug/session`, `debug/cookie`, `test-db`, `test-connection`, `debug-categories`) are **unguarded** and should be deleted or gated before a public launch.

---

## 8. Front end

### Routing

**Storefront:** `/` · `/products` · `/product/[slug]` · `/category/[id]` · `/sub-category/[id]` · `/brands` + `/brands/[slug]` · `/search` · `/cart` · `/checkout` · `/wishlist` · `/compare` · `/offers` · `/software` · `/spin` · `/lucky-draw` · `/rewards` · `/store-locator` · `/track` · `/thank-you` · `/campaign/[id]`.
**Brand & campaign landings:** `/bosch` · `/haier` · `/lg` · `/tcl` · `/epic-sale` · `/subham`.
**Content:** `/about` · `/contact` · `/faq` · `/complaints` · `/privacy-policy` · `/terms-and-conditions` · `/cancellation-policy` · `/brand-guidelines` · `/credits`.
**Auth:** `/login` · `/register` · `/forgot-password` · `/reset-password` · `/verify-email` (+ dead `/auth/signin`).
**Privileged:** `/admin/*` (38 sub-areas — products, categories, sub-categories, brands, orders, customers, payments, coupons/promotions, hero-slides, advertisements, product-advertisements, product-specifications, home, home-components, settings, employees, leads, contact-inquiries, complaints, software, spin-wheel, lucky-draw, partners, partner-payouts, external-orders, store-locations, store-qr, blocked-pincodes, campaign-pages, amazon-scraper, integrations, migrate, features, documentation, customer-centric, dashboard), `/vendor/*`, `/dashboard/*` (orders, cart, wishlist, offers, instore-purchases, settings), `/account/*` (profile, orders, preferences).
**Machine-readable:** [app/sitemap.ts](app/sitemap.ts) (slug-based), [app/robots.ts](app/robots.ts), [app/manifest.ts](app/manifest.ts), [app/feed.xml](app/feed.xml), [app/llms.txt](app/llms.txt), [app/llm.txt](app/llm.txt), [app/og/route.tsx](app/og/route.tsx).

### Rendering model

- [app/layout.tsx](app/layout.tsx) is a **server component**. `generateMetadata()` races `getSettingsData()` against a 1.5 s timeout so a slow settings read can't block first paint. It renders preconnects (Amazon CDN, Razorpay, Firebase), `<SiteJsonLd />`, `<ReportWebVitals />`, `<Providers>`, Vercel `Analytics` + `SpeedInsights`, and an inline script that unregisters stale service workers and clears `caches` unless `NEXT_PUBLIC_ENABLE_PWA_SW=true`.
- [app/page.tsx](app/page.tsx) is a **server component** that emits static FAQ JSON-LD and renders `<HomeExperience />` (client), which orchestrates all homepage data via `usePrefetchHomeProducts()` and `fetchWithCache()` and code-splits below-the-fold sections with `dynamic()`.
- [app/providers.tsx](app/providers.tsx) (`"use client"`) wires `ThemeProvider` (**`forcedTheme="light"` — `dark:` variants never fire**), `MotionConfig`, `AuthProvider`, `CartProvider`, `CartUIProvider`, `<Toaster position="top-right" />` (react-hot-toast), `CompareFloating`, `CartQuickAccess`, `CartSidebar`, `AntiInspect`.

### Contexts — `contexts/`

- **AuthContext** — `user`, `isLoading`, `isAuthenticated`, `isAdmin`, `isVendor`, `login`, `signup`, `logout`, `updateProfile`, `checkAuthAndRedirect`. Reads `/api/auth/session`; persists only `{ id, role }` to localStorage as a hydration hint. Enforces 24 h session + 12 h inactivity timeouts client-side.
- **CartContext** — cart items, add/update/remove/clear, order helpers, DB sync. Singleton per `userId` with a single in-flight GET shared across consumers to kill request storms.
- **CartUIContext** — sidebar open state, `lastAddedId` flash highlight, Esc-to-close, mobile scroll lock.

### Hooks — `hooks/`

`useCart`, `useWishlist`, `useCompare` (localStorage, max 6), `useOffers`, `usePrefetchHomeProducts`, `useSettingsData` (SWR), `useFooterData` (SWR), `useProductSpecImages` (SWR), `useDebounce` + `useDebouncedCallback`, `useReducedMotion` / `useScrollState` / `useStaggerReveal` (in `useAnimations.ts`), `useRateLimit` (3 attempts / 5 min lockout on auth forms), `useRecaptcha`, `useAdminAuth` (**deprecated, localStorage-only — do not use**).

### Components — `components/` (94 `.tsx`)

Subfolders: `ui/` (9 shadcn/Radix primitives + Tiptap `RichTextEditor`), `admin/`, `home/` (11 homepage sections), `motion/`, `icons/`. Largest surfaces: [Header.tsx](components/Header.tsx) (~46 KB), [ProductSpecificationTabs.tsx](components/ProductSpecificationTabs.tsx) (~46 KB), [store-locator.tsx](components/store-locator.tsx) (~40 KB).

**Client conventions:** `react-hot-toast` only (68 imports; `sonner` is installed but imported **zero** times — don't introduce it). Admin/dashboard/account fetches go through `apiFetch` from [lib/api-client.ts](lib/api-client.ts). Tailwind custom palette: brand `primary` `#0F2557`, `accent` `#FF6A2C`, plus per-bank colours for Razorpay offer badges.

### Client-side caching — [utils/cache.ts](utils/cache.ts)

`fetchWithCache()` layers an in-memory map over IndexedDB with stale-while-revalidate and a 5-minute default TTL; `prefetch`/`prefetchAll`/`revalidateCache` complete the API. [utils/catalog.ts](utils/catalog.ts) holds the taxonomy normalisers (`categoryOf`, `brandOf`, `isInStock`) and the homepage rail/tile builders.

---

## 9. Environment variables

`.env.local` is required. **[.env.example](.env.example) is unusable as-is** — every line is commented out, it declares `SMTP_PASSWORD` while the code reads `SMTP_PASS`, and it is missing most of the variables below. Check actual `process.env` usage before assuming a name.

| Area | Variables |
| --- | --- |
| Database | `MONGODB_URI` (required, throws at import) |
| Session | `SESSION_SECRET` → falls back to `NEXTAUTH_SECRET`; `NEXTAUTH_URL` |
| Seeding | `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Cron | `CRON_SECRET` (≥16 chars, required by `/api/cron/*`) |
| OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `CONTACT_ADMIN_EMAIL`, `VENDOR_EMAIL` |
| WhatsApp (AskEva) | `ASKEVA_API_KEY`, `ASKEVA_API_URL`, `ASKEVA_SENDER_NUMBER` |
| Partner API | `PARTNER_API_KEY_SECRET`, `API_KEY_ENCRYPTION_SECRET`, `PARTNER_ALLOWED_ORIGINS` |
| eXlr8 | `EXLR8_BASE_URL`, `EXLR8_CLIENT_ID`, `EXLR8_CLIENT_SECRET`, `EXLR8_WEBHOOK_SECRET` |
| Bot defence | `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` |
| Misc | `REVOKE_PASSWORD`, `AMAZON_SCRAPER_WORD`, `NEXT_PUBLIC_GOOGLE_SHEET_PRICE_SYNC_ID`, `ENABLE_DEBUG_ROUTES`, `NEXT_PUBLIC_ENABLE_PWA_SW` |
| URLs (three overlapping — keep in sync) | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, plus auto `VERCEL_URL` |

---

## 10. Deployment & scheduled work

[vercel.json](vercel.json) contains **headers and redirects only — no `crons` block**:

- CORS + `X-Robots-Tag: noindex` for `/api/v1/partner/(.*)`.
- CDN caching: products `s-maxage=60`, categories & home-components `s-maxage=120`, settings `s-maxage=300`, everything else under `/api/` `no-store`.
- Permanent redirects for `/ott*`, `/customer-login`, `/redeem` to `ott.systechdigital.co.in`.

[instrumentation.ts](instrumentation.ts) polyfills `localStorage` on the server and *would* start `node-cron` jobs, but the import is commented out — it still logs `✅ Cron jobs initialized successfully`. **Nothing runs on a schedule today.** The `/api/cron/*` routes are the intended entry points; wire them to Vercel Cron or an external scheduler with `Authorization: Bearer $CRON_SECRET`.

Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, immutable cache for `/images` and `/fonts`) are defined in [next.config.mjs](next.config.mjs). HSTS and `upgrade-insecure-requests` are production-only so local HTTP dev works; `script-src` allows `unsafe-eval` in dev for HMR.

---

## 11. Known bugs & tech debt

| Issue | Detail |
| --- | --- |
| **Post-order cart is never cleared** | [app/api/orders/route.ts](app/api/orders/route.ts) line ~583 calls `getCollection("cart")` — singular. The real collection is `carts`, so the `updateOne` (with `upsert: false`) silently matches nothing. |
| Guard coverage | Only 77 of 219 route files call a `lib/auth.ts` guard. The middleware policy table covers most gaps today, but any new path outside those prefixes is unprotected by default. |
| Unguarded debug/test routes | `/api/debug/session`, `/api/debug/cookie`, `/api/test-db`, `/api/test-connection`, `/api/test-product-update`, `/api/debug-categories` have no auth. |
| `/vendor` gating | Client-only; anonymous users receive the HTML shell before the redirect fires. Convert to the `/account` server-gate pattern. |
| Validation | ~5 routes use [lib/validation.ts](lib/validation.ts); most write routes accept unvalidated JSON. |
| `@/lib/db` importers | 10 files (payment verify, payments, product SKU, scrape-amazon, scraped-products, software-licenses, advertisements `[id]`, both partner Razorpay routes). Migrate them to `db-service`. |
| Rate limiting | In-memory only; resets on every cold start. Needs Redis. |
| Build safety | `ignoreBuildErrors` + `ignoreDuringBuilds` mean a broken build ships. `npx tsc --noEmit` is the only gate, and there are no tests. |
| Image allowlist | [next.config.mjs](next.config.mjs) `remotePatterns` ends with a catch-all `hostname: "**"`, which defeats the point of the allowlist. |
| Firebase | Referenced in CSP, preconnects and the image allowlist, but no Firebase SDK is installed and no upload route exists. |

---

## 12. Corrections to older docs

`CLAUDE.legacy.md`, `AGENTS.md` and several files under `docs/` predate the current code. Verified differences:

| Older claim | Reality today |
| --- | --- |
| "`app/admin/layout.tsx` is `"use client"`; there is no server gate on `/admin`" | It **is** a server component with `force-dynamic`, `getSession()` and `redirect()`. |
| "Middleware only checks that a session exists for `/api/admin/*`" | It checks the **role** (`admin`/`superadmin`/`dashboardAccess`) and returns 401/403, plus a full path+method policy table for the rest of the API. |
| "`lib/db.ts` targets database `ecommerce`, a data-integrity risk" | `connectDB()` now delegates to `connectToDatabase()` and hits `e-commerce-bytewise` like everything else. It is merely deprecated. |
| "`COLLECTIONS.SLIDES` is undefined, so `/api/product-slides` returns `[]` / 500s" | It is defined as `"product_slides"` and the route works. |
| "21 route files still use the Next 14 sync `params` form" | Zero do. All use `params: Promise<…>`. |
| "Product pages live at `app/product/[id]`" | They live at [app/product/[slug]](app/product/%5Bslug%5D). Categories are still `[id]`. |
| "`app/sitemap.ts` emits ObjectIds" | It emits `slug` with an ObjectId fallback. |
| "JSON-LD helpers in `lib/seo.tsx` are never rendered" | [components/SiteJsonLd.tsx](components/SiteJsonLd.tsx) is rendered in the root layout; product/category/brand/store pages each render their own `*JsonLdServer.tsx`; `BreadcrumbJsonLd` is used on product pages. |
| "`llms.txt`, `manifest`, `feed.xml`, `web-vitals` reporting, Razorpay/Firebase preconnects are TODO" | All exist: [app/llms.txt](app/llms.txt), [app/llm.txt](app/llm.txt), [app/manifest.ts](app/manifest.ts), [app/feed.xml](app/feed.xml), [components/ReportWebVitals.tsx](components/ReportWebVitals.tsx) + `/api/vitals`, preconnects in [app/layout.tsx](app/layout.tsx). |
| "`app/page.tsx` is `"use client"`" | It is a server component rendering a client `HomeExperience`. |
| Collections `cart`, `wishlist`, `software`, `inquiries`, `vendors`, `notifications`, `licenses`, `store_purchases`, `scrape_jobs`, `categories_test`, `orders_test` | Do not exist. Real names: `carts`, `wishlists`, `software_products`, `contact_inquiries`. The rest are fictional. |
| "`app/api/checkout/` route" | Does not exist. Checkout posts to `/api/orders` and `/api/payment/*`. |
| "Abandoned-cart cron is live" | Disabled. Superseded by `/api/cron/cart-recovery` + [lib/retention/cart-recovery.ts](lib/retention/cart-recovery.ts), which nothing currently triggers. The 10 docs in `docs/abandoned-cart/` all describe it as working. |

---

## 13. Repo hygiene

Root-level `audit-ids.js`, `inspect-api.js`, `inspect-sample.js`, `inspect_order.js`, `exhaustive-audit.js`, `check-assignments.js`, `extract-docx.js`, `tmp-phase2-check.ts`, `order_dump.json`, `order_debug_dump.json` are one-off debug leftovers, not part of the app. **The two JSON dumps contain real order data — treat as PII.** `README.md` is placeholder scratch notes. `pdf-gen/` and `proposal/` generate sales collateral, not product code. `CLAUDE.legacy.md` is the superseded version of this file, kept only because the repo is not under version control — delete it once you've confirmed nothing else references it.

**Other docs:** [AGENTS.md](AGENTS.md) (partly stale — see §12), [FEATURES.md](FEATURES.md) (business-facing catalogue), [GAPS.md](GAPS.md), [PLATFORM_COMPARISON.md](PLATFORM_COMPARISON.md), and `docs/` (`abandoned-cart/`, `analysis/`, `architecture/`, `brand/`, `features/`, `operations/`, `partner-api/`, `security/`, `spin-wheel/`, `whatsapp/`). Treat all of them as historical unless verified.
