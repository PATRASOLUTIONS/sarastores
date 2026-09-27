# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read [AGENTS.md](AGENTS.md) first.** It is the maintained agent guide and supersedes this file wherever they disagree. Deep-dive references live in `.github/skills/` (`platform-capability-map`, `security-review`, `codebase-audit`) and scoped conventions in `.github/instructions/`. Sections below marked **CORRECTION** were verified wrong against current code.

## Project Overview

A full-stack e-commerce platform ("ecommerce-sara" / Sara Electronics) built on Next.js 15 App Router with React 19, MongoDB, and NextAuth v5 beta. It supports storefront browsing, customer auth, admin management, vendor dashboards, partner API integrations, Razorpay payments, software-license sales, abandoned-cart cron jobs, and Amazon product scraping. Site metadata is generated from a `settings` collection in MongoDB (store name, logo, description).

## Development Commands

```bash
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run start            # Run production build
npm run lint             # next lint

# Database migrations / seeding
npm run seed:admin                       # Create initial admin user
npm run migrate:schema                   # Migrate products to canonical schema
npm run migrate:schema:dry               # Dry-run schema migration
npm run migrate:schema:strict            # Strict (failing) schema migration
```

There is no automated test suite. `scripts/` contains one-off Node/TS scripts (Amazon scrapers, license assigners, CORS verifiers, partner-API test scripts) run directly with `node` / `tsx`.

`tsconfig.json` sets `strict: true`. ESLint and TypeScript build errors are silenced in `next.config.mjs` (`ignoreDuringBuilds`, `ignoreBuildErrors`) — don't rely on `next build` to surface type/lint issues; use `npx tsc --noEmit` for type checks.

## Architecture

### Routing (`app/`)

- App Router. Top-level feature folders: `account/`, `admin/`, `auth/`, `cart/`, `checkout/`, `dashboard/`, `lucky-draw/`, `partner-api-docs/`, `product/`, `products/`, `spin/`, `store-locator/`, `vendor/`, brand landing pages (`bosch/`, `haier/`, `lg/`, `tcl/`), plus policy/marketing pages.
- API routes live under `app/api/` (`admin/`, `auth/`, `cart/`, `coupons/`, `cron/`, `orders/`, `payment/`, `products/`, `razorpay/`, `reviews/`, `scrape-amazon/`, `search/`, `software/`, `vendor/`, etc.). **CORRECTION — there is no `app/api/checkout/` route**; checkout posts to `/api/orders` and `/api/payment/*`.
- Partner API: routes mounted under `/api/v1/partner/*` and excluded from the central middleware (they have their own CORS + API-key auth in `lib/partner/`).
- Root layout (`app/layout.tsx`) reads branding from the `settings` collection via `getSettingsData()` and wires `<Providers>` (theme, auth context, motion config, hot-toast, compare floating bar).
- Admin/vendor page gating: **CORRECTION — `app/admin/layout.tsx` and `app/vendor/layout.tsx` are `"use client"` and gate only in the browser.** There is no server-side check on `/admin` or `/vendor` pages; real enforcement happens per API route. `app/dashboard/layout.tsx` and `app/account/layout.tsx` *are* true server gates (`await getSession()` → `redirect()`) — copy that pattern. Middleware still intentionally does NOT redirect `/admin` HTML requests, to avoid a known race with RSC fetches.

### Middleware (`middleware.ts`)

Edge-runtime middleware. Single source of truth for central **API** authorization:
- Skips `/api/v1/partner/*` (partner has its own CORS+key handling).
- `/api/admin/*` and `/api/spin-wheel/admin/*`: **CORRECTION — middleware only checks that a session exists, then calls `NextResponse.next()`.** It does not check the role. Many handlers under those prefixes have no role check either, so any logged-in customer can reach them. Every admin handler must call `requireAdmin()` / `checkAdminAuthorization()` itself.
- Method+path-based policy for catalog/content/vendor endpoints: storefront GETs are public, writes require admin; vendor endpoints accept `vendor`/`admin`/`superadmin`; coupons split customer-facing vs admin; reviews require any logged-in user.
- Page routes (`/admin`, `/vendor`, `/dashboard`, `/account`): let HTML/RSC through to the layout, which runs the authoritative `getSession()` check. Bouncing HTML in middleware caused a documented "sub-page logs me out, landing page works" race.
- Auth is read from the signed `session` httpOnly cookie (see `lib/session.ts`).

### Auth & Sessions (`lib/session.ts`, `lib/auth.ts`, `contexts/AuthContext.tsx`)

- **No NextAuth at runtime for normal auth** — `next-auth` is in `package.json` and `authOptions` in `lib/auth.ts` is a stub. Real auth uses a custom HMAC-SHA256 signed session token.
- Token format: `base64url(payload).base64url(hmac(payload))`. Secret from `SESSION_SECRET` (falls back to `NEXTAUTH_SECRET`); required to be ≥16 chars. Token is 24h (`SESSION_MAX_AGE`).
- `lib/session.ts` is dependency-free (Web Crypto + `btoa`/`atob`) so it runs in **both Edge and Node runtimes**. It has explicit `isEdgeRuntime` detection — `require("crypto")` is intentionally forbidden on Edge to avoid the historical "all sessions verify as null" bug.
- `getSession()` in `lib/auth.ts` is the canonical server-side read; use `requireUser()` / `requireAdmin()` / `requireVendor()` guards in API route handlers.
- `contexts/AuthContext.tsx` is the client-side mirror (login/logout, signup, session refresh).
- Roles: `admin`, `superadmin`, `vendor`, `user`. `dashboardAccess` and `allowedPages` are optional session claims used for granular admin permissions.

### Data layer

- `lib/mongodb.ts` exports a `clientPromise` singleton (cached on `globalThis` in dev to survive HMR). **Database name is `e-commerce-bytewise`** (note: `lib/db.ts` uses `ecommerce`; some code uses one, some the other — `db-service.ts` works in `ecommerce`. Prefer the project's actual MongoDB URI to confirm which DB the running app hits).
- `lib/db-service.ts` provides generic CRUD (`getAll`, `getById`, `create`, `update`, `remove`, `findOne`, `findMany`, `count`, `aggregate`, `insertMany`, `updateMany`, `deleteMany`, indexes) plus `normalizeId` (strips Mongo `_id`, exposes string `id`). Also exports `COLLECTIONS` constants for common collections.
- Collection names verified in code: `products`, `users`, `orders`, `carts`, `wishlists`, `categories`, `sub_categories`, `reviews`, `coupons`, `counters`, `payments`, `product_specifications`, `settings`, `footer`, `advertisements`, `product_advertisements`, `hero_slides`, `split_cards`, `animated_banners`, `testimonials`, `offers`, `featured_products`, `home_components`, `site_features`, `campaign_pages`, `email_templates`, `campaign_history`, `brands`, `leads`, `lead_settings`, `contact_inquiries`, `complaints`, `employees`, `store_locations`, `store_qr_codes`, `blocked_pincodes`, `external_orders`, `software_products`, `license_keys`, `software_licenses`, `partners`, `partner_api_keys`, `partner_wallets`, `partner_orders`, `partner_products`, `partner_payments`, `wallet_transactions`, `partner_payouts`, `spinWheelCampaigns`, and per-campaign `spin_<slug>_*` shards.
- **CORRECTION — these names in earlier revisions of this file do not exist in code:** `cart` (real: `carts`), `wishlist` (real: `wishlists`), `software` (real: `software_products`), `inquiries` (real: `contact_inquiries`), `licenses`, `vendors`, `notifications`, `store_purchases`, `scrape_jobs`, `product_slides`, `categories_test`, `orders_test`. The `spin_wheel_*` prefix is also wrong — see `lib/spin-wheel-campaigns.ts`.
- **CORRECTION — `COLLECTIONS.SLIDES` is undefined**, so `GET /api/product-slides` silently returns `[]` and `POST` always 500s. `COLLECTIONS.CART` and `COLLECTIONS.WISHLIST` are dead constants no code uses.

### Domain modules in `lib/`

- `email.ts` + `emailTemplates.ts` + `promoTemplates.ts` — Nodemailer-based email; 50KB+ of HTML templates.
- `spin-wheel-notifications.ts` — spin-the-wheel prize workflow (cron-driven, notifies winners via WhatsApp/email).
- `botDetection.ts`, `rate-limit.ts` (in-memory sliding window; replace with Redis in production), `security-headers.ts` — security primitives.
- `cache.ts` — `lru-cache`-based API cache wrapper.
- `validation.ts` — Zod schemas for inputs (login, signup, checkout, product, etc.).
- `product-schema.ts` — canonical product schema (migrations target this).
- `razorpay.ts` — `getRazorpayClient()` factory; per-partner keys supported.
- `encryption.ts` — used for storing partner API keys / secrets.
- `performance.ts` — perf logging helpers.
- `lib/cron/abandoned-cart.ts` — `node-cron` jobs (every 2 min + hourly) for abandoned-cart emails. Invoked from `instrumentation.ts` (currently commented out — see `instrumentation.ts` for re-enable). Uses `__non_webpack_require__` / `eval('require')` to hide `node-cron` from Webpack bundling.
- `lib/partner/` — `api-keys.ts`, `auth.ts`, `orders.ts`, `service.ts`, `wallet.ts`, `rate-limit.ts`, `types.ts` — partner API surface.

### Hooks & client state (`hooks/`)

- `useCart.ts`, `useWishlist.ts`, `useCompare.ts` — client-side cart/wishlist/compare (SWR-backed; syncs with `/api/cart` etc.).
- `useAdminAuth.ts`, `useRateLimit.ts`, `useRecaptcha.ts`, `useDebounce.ts`, `useAnimations.ts`, `usePrefetchHomeProducts.ts`, `useOffers.ts`, `useFooterData.ts`, `useSettingsData.ts`, `useProductSpecImages.ts`.

### Components (`components/`)

- Top-level: `Header.tsx` (~46KB — search, nav, cart, account), `Footer.tsx`, `Navbar.tsx`, `HeroSection.tsx`, `ProductSlideshow.tsx`, `CategorySection.tsx`, `CategoryProductCard.tsx`, `CategoryProductsSection.tsx`, `FeaturedProducts.tsx`, `ProductHeroSlider.tsx`, `ProductReviews.tsx`, `ProductSpecificationTabs.tsx` (~46KB), `AddToCartButton.tsx`, `PaymentGateway.tsx`, `LeadForm.tsx`, `InStorePurchase.tsx`, `ContactForm.tsx`, `StoreLocator.tsx` (~40KB), `ExcelUpload.tsx`, `SearchAutocomplete.tsx`, `AdvertisementCarousel.tsx`, `AnimatedBanner.tsx`, `BankOffersMarquee.tsx`, `BrandMarquee.tsx`, `CategoryCircles.tsx`, `CategoryShowcase.tsx`, `DealsOfTheDay.tsx`, `DeliverToPincode.tsx`, `DeliveryEstimator.tsx`, `ErrorBoundary.tsx`, `FeatureCards.tsx`, `FeaturedBrands.tsx`, `Loader.tsx`, `OTTSection.tsx`, `OfferSection.tsx`, `OffersStrip.tsx`, `OptimizedImage.tsx`, `PopularProductsSection.tsx`, `ProductAdvertisements.tsx`, `RecentlyViewed.tsx`, `SalesChart.tsx`, `SiteFeatures.tsx`, `StaticProductAdvertisements.tsx`, `SubCategoriesMarquee.tsx`, `TestimonialSection.tsx`, `TopBrands.tsx`, `TrustBar.tsx`, `CompareFloating.tsx`.
- Subdirs: `admin/` (admin-side UI), `motion/` (framer-motion helpers), `ui/` (Radix-based shadcn/ui primitives).
- `store-locator.tsx` is a top-level single-file module (~40KB).

### Config / build

- `next.config.mjs`:
  - `reactStrictMode: true`; ESLint + TS errors silenced at build.
  - `images.domains` + `remotePatterns` whitelist `placehold.co`, `m.media-amazon.com`, `firebasestorage.googleapis.com`, `**.googleusercontent.com`, `images.unsplash.com`, plus a catch-all `**`.
  - `serverExternalPackages` + webpack `fallback`/`alias` for MongoDB/native modules so the Edge bundle does not try to require `mongodb`, `node-cron`, `snappy`, `kerberos`, `mongodb-client-encryption`, `@mongodb-js/zstd`, `aws4`, `gcp-metadata`, `socks`.
  - Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, immutable cache for `/images` & `/fonts`). HSTS + `upgrade-insecure-requests` are gated on `NODE_ENV=production` so local dev over HTTP works.
- `tailwind.config.ts`, `postcss.config.mjs` — Tailwind v3 + autoprefixer + `tw-animate-css`.
- `vercel.json` — Vercel deployment config.
- `instrumentation.ts` — polyfills `localStorage` on server runtime; loads `node-cron` jobs in Node runtime (currently commented out for the abandoned-cart import).
- `app/sitemap.ts`, `app/robots.ts` — dynamic SEO from MongoDB.

### Environment

`.env.example` / `.env.local` are the templates. Critical variables:
- `MONGODB_URI` — required (validated at module load in `lib/mongodb.ts`).
- `SESSION_SECRET` (or `NEXTAUTH_SECRET`) — required in production; ≥16 chars.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — payments.
- `NEXT_PUBLIC_SITE_URL` — used for absolute URLs in metadata.
- `NEXT_PUBLIC_ENABLE_PWA_SW` — opt-in service worker (default off, see `app/layout.tsx` — the inline script unregisters stale workers and clears `caches` on every load to avoid serving broken images after deploys).

### Partner API

`/api/v1/partner/*` is a separately authenticated surface for third-party partners (key issuance in `lib/partner/api-keys.ts`, signed request auth in `lib/partner/auth.ts`, rate limit in `lib/partner/rate-limit.ts`, order + wallet flows in `lib/partner/orders.ts` and `lib/partner/wallet.ts`). Keys/secrets are stored encrypted via `lib/encryption.ts`. Partner routes are documented at `app/partner-api-docs/` and testable at `app/partner-api-test/`.

## Common Pitfalls

- **`db.ts` vs `db-service.ts` vs `mongodb.ts`:** Three near-overlapping modules. `lib/mongodb.ts` is the low-level client; `lib/db-service.ts` is the generic CRUD layer used by API routes; `lib/db.ts` is a thin wrapper. They use different DB names — confirm which is in use before changing.
- **Edge runtime:** `lib/session.ts` must stay Edge-safe. Do not introduce `Buffer` or `require("crypto")` calls into it; use `crypto.subtle` and the existing `btoa`/`atob` paths.
- **Middleware redirects:** Don't add a 307 redirect to `/admin`/`/dashboard`/`/account` HTML in middleware — the layout-redirect pattern was deliberately chosen to fix a sub-page RSC race. But note the correction above: only `/dashboard` and `/account` actually have a server-side `getSession()` check. Middleware is **not** an authorization boundary for APIs either; every route handler must guard itself with `requireUser()` / `requireAdmin()` / `requireVendor()`.
- **Never import `@/lib/db`:** `connectDB()` targets database `ecommerce` while `lib/mongodb.ts` and `lib/db-service.ts` target `e-commerce-bytewise`. Nine files (including payment verification) still import it — that is a live data-integrity risk, not a pattern to follow.
- **TypeScript safety:** `next build` is configured to ignore type errors. Always run `npx tsc --noEmit` separately when changing types.
- **MongoDB `_id` vs `id`:** API responses use normalized string `id` (from `normalizeId`). Don't pass raw Mongo `_id` to the client. `getById` tries ObjectId first, then string `_id`, then `id` field — keep that fallback order when adding new lookup patterns.
- **Web Crypto availability:** If a deployment platform doesn't support `crypto.subtle`, sessions silently fail. The Edge runtime path throws with an explicit message; Node path falls back to `crypto.createHmac`.
- **Cron + instrumentation:** `instrumentation.ts` currently has the abandoned-cart import commented out. To re-enable, uncomment both lines in `register()` and ensure `NEXT_RUNTIME === 'nodejs'` (Vercel serverless functions don't run long-lived cron — Vercel Cron or an external scheduler is the typical deployment).
- **CSP & service workers:** The root layout unregisters any existing service workers and clears `caches` on every load to prevent stale-bundle bugs after deploys. The PWA worker only re-registers when `NEXT_PUBLIC_ENABLE_PWA_SW=true`.
- **Rate limiting is in-memory** (`lib/rate-limit.ts`); horizontal scaling requires swapping in Redis.

## SEO & 2026 Market Readiness

The site ships with a decent foundation (sitemap, robots, per-product metadata, Product JSON-LD, Vercel Speed Insights, AVIF/WebP images, immutable cache for `/images` and `/fonts`). The section below is the **exhaustive TODO for SEO/AI-search parity with 2026 standards** — work it in roughly the order listed, since later items depend on earlier ones.

### P0 — Critical (do first; these move the needle on AI/Google visibility)

- **`llms.txt` and `llm.txt` at site root.** ChatGPT, Claude, Perplexity, Google AI Overviews and Bing Copilot consult these to ground product answers. Create `app/llms.txt/route.ts` and `app/llm.txt/route.ts` returning a plain-text index of the store: store name/description, top-level categories, top-N best-selling product slugs (name + one-line spec + canonical URL), brand pages, support/contact, policy pages. Re-use the same data sources as `app/sitemap.ts`. Suggested schema (Markdown headings, ~5KB max):
  ```
  # Sara Electronics
  > One-line store description.
  ## Categories
  - [Televisions](https://.../category/<slug>): short list of sub-categories
  ## Products
  - [Samsung 55" Crystal UHD](https://.../product/<slug>): ₹price, key specs
  ## Brand pages
  ...
  ## Policies
  ...
  ```
- **`public/og-image.jpg` (1200×630).** Referenced from `app/layout.tsx` and product/category layouts as a fallback. Currently missing — `next build` will 404 the fallback when a product has no image.
- **`public/manifest.webmanifest` + PWA basics.** `app/manifest.ts` (Next.js MetadataRoute.Manifest) with `name`, `short_name`, `icons` (192/512/maskable), `theme_color`, `background_color`, `display: "standalone"`, `start_url`, `scope`, `categories: ["shopping"]`. Link it from root `metadata.icons`/`metadata.manifest`. Service worker is intentionally **off by default** (see `app/layout.tsx`) — keep that.
- **Render `OrganizationJsonLd` + `WebSiteJsonLd` in `app/layout.tsx`.** Components exist in `lib/seo.tsx` but are never used. Required for: Google Knowledge Panel, sitelinks search box, brand searches, AI-citation grounding. Use `settings` collection for `name`, `url`, `logo`, `sameAs` (social links), `contactPoint`. `WebSiteJsonLd` already wires `potentialAction` → `/products?q={search_term_string}`.
- **Render `BreadcrumbJsonLd` on every product, category, sub-category, and brand page.** Defined in `lib/seo.tsx`, used in zero places. Without it, breadcrumbs in SERP are missing.
- **`LocalBusinessJsonLd` on the homepage and `/store-locator`.** Defined but unused. India-targeted: `addressCountry: "IN"`, `areaServed: "IN"`, plus `geo` and `openingHours` from settings. Required for "electronics store near me" queries.
- **Canonical & `hreflang` consistency.** All product/category/brand layouts already set `alternates.canonical`. Add `alternates.languages: { "en-IN": url, "x-default": url }` (single locale today, but declared) on the root layout.

### P1 — High (rich results & modern search surfaces)

- **Render `FAQJsonLd` on the homepage, brand landing pages (`bosch/`, `haier/`, `lg/`, `tcl/`), and `/complaints` (or a new FAQ page).** Defined in `lib/seo.tsx`. FAQ rich results improve CTR even when position doesn't change.
- **Add `ItemList` / `CollectionPage` JSON-LD to category and sub-category pages.** Group the listed products under `@type: ItemList` with `itemListElement` referencing each product URL. Helps Google surface category snippets.
- **Image SEO:**
  - Add `ImageObject` JSON-LD (`@type: ImageObject`) for the primary product image, with `contentUrl`, `width`, `height`, `thumbnail`.
  - Audit `components/OptimizedImage.tsx` and every `<img>`/`<Image>` for descriptive `alt` text — many product card components probably emit empty alt. Empty alt hurts Google Images traffic (still ~20% of e-commerce clicks).
- **`gtin`/`mpn`/`isbn` in Product JSON-LD** for Google Shopping eligibility. `mpn` is already in `app/product/[id]/structured-data.tsx`. Add `gtin` (read from `product.gtin` or `product.ean`) when present.
- **Speakable schema** on blog/help content (none today, but plan for it). Marks sections the assistant can read aloud in voice search.
- **`web-vitals` reporting.** `web-vitals@5.1.0` is installed but unused. Add a small client component (`components/ReportWebVitals.tsx`) calling `web-vitals` and POSTing to `/api/vitals` so you can watch INP regressions in production. Vercel Speed Insights already covers a portion, but raw INP/CLS data per route is essential — **INP has fully replaced FID as a Core Web Vital** and is the single biggest ranking-factor shift since 2024.
- **`preconnect`/`dns-prefetch` for Razorpay + Firebase** in root `layout.tsx` (Amazon CDN is already there). Add `https://api.razorpay.com`, `https://*.razorpay.com`, `https://*.firebaseio.com`, `https://firestore.googleapis.com`.

### P2 — Medium (UX signals and feed surfaces)

- **Sitemap with slugs, not ObjectIds.** `app/sitemap.ts` currently emits `/product/${p._id.toString()}` and `/category/${c._id.toString()}`. If the products collection has a `slug` (it should — see `lib/product-schema.ts`), emit `/product/${p.slug}`. Better keywords in the URL, better click-through.
- **`<link rel="alternate" type="application/rss+xml">` in root metadata.** Add a simple RSS feed at `app/feed.xml/route.ts` listing the latest N active products. Helps aggregators, Feedly customers, and any custom integrations.
- **Pagination `rel="next"/"rel="prev"`** on paginated category pages (the URL pattern `/category/[id]?page=N` exists in many category views). Use Next.js `metadata.alternates`.
- **Move the root `<title>`/`<description>` decision into a single `generateMetadata`** on the root layout, fed from the `settings` collection — already done in `app/layout.tsx`. Make sure `app/page.tsx` doesn't add an extra client-side metadata race.
- **Convert `app/page.tsx` (currently `"use client"`) to a hybrid.** Keep interactive bits as client components; lift the data-fetch into a server component so first-paint HTML includes the homepage product/category list (better LCP, indexable HTML for search engines without JS).
- **404 / not-found structured data.** `app/not-found.tsx` exists; add `SpecialAnnouncement` or a simple `WebPage` JSON-LD noting the 404.
- **`/search` page metadata.** Search-autocomplete exists (`components/SearchAutocomplete.tsx`); a dedicated `/search?q=` route with `noIndex` for empty results, `index` for result pages, would capture long-tail SERP.

### P3 — Nice to have (defensible differentiation)

- **Sustainability / trust badges in `Organization` schema**: `award`, `foundingDate`, `founder`, `numberOfEmployees`, `knowsLanguage`, `areaServed`.
- **Customer review markup surfaced in SERP**: render top reviews on each product page with `Review` JSON-LD (already in `app/product/[id]/structured-data.tsx`, but verify `datePublished`/`author` are populated).
- **"Near me" + `openingHoursSpecification`** populated from `settings` for the local-business schema.
- **Currency-specific OG meta**: `og:price:amount`, `og:price:standard_amount`, `og:price:currency` — partially done; make sure `standard_amount` (MRP) is included where discounts exist.
- **Inferred from `app/brands/[slug]/page.tsx`**: per-brand meta description, OG image (brand logo), and a `Brand` JSON-LD entity linking to its products. This powers the brand-panel SERP feature.
- **Per-route INP budgets**: define acceptable INP per template (home ≤ 200ms, PLP ≤ 200ms, PDP ≤ 200ms) and instrument via `web-vitals`.

### What to avoid (things that will *hurt* SEO in 2026)

- **Don't block AI bots in `robots.ts`** without thought. The default blocks `/api/`, `/admin/`, `/dashboard/`, etc. — that's correct. But never add `User-agent: GPTBot` / `PerplexityBot` to disallow globally; it makes your products invisible to AI shopping answers. If you must throttle, use rate-limiting on the partner API surface, not robots.
- **Don't ship duplicate content from `?sort=`, `?page=`, `?color=` filter combinations.** Use `rel="canonical"` to the unfiltered/root category URL, or `noIndex` for filter combinations.
- **Don't emit client-only metadata.** Anything behind `"use client"` that mutates the document head via `next/head` is invisible to crawlers. Keep metadata in `layout.tsx`/`page.tsx` server components.
- **Don't skip `alt` text on product images** for decorative reasons — use `alt=""` only for truly decorative imagery, never for product shots. Empty alt on a product image is a Google Images lost-click.
- **Don't disable the service worker file (`public/sw.js`)** with a hardcoded `false` once PWA basics are in place. The current safe-default (auto-unregister) is correct; flipping it to opt-in is the right path forward.

### Quick wins (under 1 hour each)

1. Add `OrganizationJsonLd` + `WebSiteJsonLd` to `app/layout.tsx` — wires Google Knowledge Panel and sitelinks search box immediately.
2. Add `BreadcrumbJsonLd` to `app/product/[id]/page.tsx` and `app/category/[id]/page.tsx` — wire existing utility to existing routes.
3. Create `app/llms.txt/route.ts` — 30 lines, big AI-visibility win.
4. Add `public/og-image.jpg` (1200×630) — fills the missing-image 404.
5. Create `app/manifest.ts` — declarative PWA manifest, ~20 lines.
6. Add `web-vitals` reporter (`components/ReportWebVitals.tsx` + `app/api/vitals/route.ts`) — start seeing real INP data in production.
