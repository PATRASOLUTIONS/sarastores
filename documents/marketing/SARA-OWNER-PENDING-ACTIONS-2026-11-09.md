# Sara Stores: completed improvements and owner actions

Updated: 9 November 2026. This is the actionable handoff after working on the pending development and latency tasks. All changes described as completed below are in the local repository; production deployment and account receipt are separate checks.

The broader delivery history, Customer Flow/Page Flow demonstration list, marketing plan and campaign launch gates are in [the team work report](SARA-TEAM-WORK-STATUS-AND-MARKETING-PLAN-2026-11-09.md).

## 1. Completed in this work

| Work | Result | Evidence |
| --- | --- | --- |
| Product/offer listing latency | Initial server rendering sends 24 bounded product cards rather than the whole catalogue. Search, taxonomy, specifications, stock, price, ratings, discounts, sorting and pagination run on the server. Filter counts still cover the matching catalogue. | [Listing page](../../app/products/page.tsx), [query engine](../../lib/catalogue-listing.ts), [public listing API](../../app/api/products/listing/route.ts) |
| Crawlable listing navigation | Numbered pages have real URLs carrying the current filters. Server rendering applies those filters before hydration. | [Listing client](../../app/products/ProductsClient.tsx), isolated rendering/control tests |
| Repeated catalogue reads | Concurrent reads share a server-only normalized index for 60 seconds. Specification/detail data stays on the server; each request returns only its selected cards and counts. Repeated browser refreshes request one page. The catalogue read has an 8-second MongoDB timeout. | [Listing data/cache](../../lib/catalogue-listing-data.ts), [public loader](../../lib/public-page-data.ts) |
| Browser JavaScript | The browser imports the listing contract rather than the server filter/index engine. Full-catalogue client filtering and polling were removed. | [Shared contract](../../lib/catalogue-listing-contract.ts) |
| PWA lifecycle | Enabled PWA registration keeps existing caches instead of unregistering workers and deleting every cache on each full load. Disabling the feature removes only Sara-owned workers/caches. | [Registration helper](../../lib/pwa-registration.ts), [root layout](../../app/layout.tsx) |
| PWA cache correctness | Same-origin, approved public endpoints and fixed/static assets only; no page navigations, private/customer/payment APIs, authenticated requests or mutation caching. Expired public data is not returned as a successful offline response. Cache size/entry limits and storage-failure fallback protect normal networking. | [Worker v5](../../public/sw.js), isolated cache/expiry/privacy tests |
| Bank offer latency | Concurrent Razorpay offer reads share a 60-second server cache. Eligibility uses provider values converted from paise to INR. Failures stay unavailable and are retried, rather than cached as invented offers. | [Offer reader](../../lib/razorpay-offer-data.ts), provider fixtures |
| Customer journey continuity | An auth refresh on the same page no longer creates another tracked page visit. Checkout route entry records `checkout_started`; the commerce `begin_checkout` remains attached to checkout validation with real items/value. Both map to the Customer Flow checkout node. | [Journey tracker](../../components/CustomerJourneyTracker.tsx), [stage mapping](../../lib/customer-flow.ts) |
| Header search payload | Search/trending suggestions use a narrow public projection without detail, reviews or raw imports. | [Header](../../components/Header.tsx), [product API](../../app/api/products/route.ts) |
| Meta commerce events | ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase, Lead and CompleteRegistration use the existing pixel after advertising consent. Contact fields are excluded; purchase event IDs and session deduplication prevent repeated browser dispatch. A bounded local queue handles consent-gated pixel initialization without polling. | [Mapper](../../lib/meta-commerce.ts), [analytics emitter](../../lib/analytics.ts), [pixel setup](../../components/MarketingTags.tsx) |
| Catalogue error recovery | Products and Offers show a safe retry screen when initial server loading fails, instead of presenting an empty successful catalogue. | [Retry screen](../../components/products/CatalogueListingError.tsx) |
| Public API errors | Legacy product API responses no longer include raw database exception messages. | [Product API](../../app/api/products/route.ts) |
| Regression blockers | Updated stale fixtures for current contact verification, pickup-only Pay at Store, stock, gifts, variant-aware cart keys, scraper skip-existing behavior, current Merchant facts and data-export rules. Kept assertions for real money, authorization, rollback, no overwrites and duplicate prevention. The main regression suite is passing. | [Regression tests](../../tests/) |

Customer Flow, GA4 Page Flow and the Catalogue Quality Excel upload/template were already implemented before this task. They were retained and included in focused regression verification. The Excel template contains actual catalogue values; missing manufacturer facts still need the inventory team.

## 2. Measured improvement and practical limits

An isolated comparison with **1,200 synthetic products** measured:

| Measurement | Result |
| --- | ---: |
| Full-catalogue JSON, same fixture | 4,316,671 bytes |
| One paged listing response, including filter counts | 14,722 bytes |
| Raw payload reduction | 99.66% |
| Gzip comparison, same repetitive synthetic fixture | 31,357 bytes to 945 bytes |
| Initial index construction, local CPU | 69.87 ms |
| Warm query median / p95, 25 local runs | 18.68 ms / 23.11 ms |

Reproduce with `npm run benchmark:listing`. The sanitized fixture result is generated under `.seo-local/catalogue-performance-comparison.json`.

These numbers measure synthetic payload and local CPU, **not production response latency, browser load time, mobile data or Core Web Vitals**. They exclude MongoDB networking, cold starts, hosting region, third-party tags and rendering. The previous 8 November slow-4G lab result for the listing was about 21.24 seconds LCP and 3.57 MiB HTML; this work does not claim that hosted result is fixed until the new release is deployed and measured.

The private index still reads catalogue/specification facts on a cold start or expiry. It is a per-process optimization, not a persistent indexed search service. Listing display data can lag inventory updates by the 60-second index lifetime plus up to 30 seconds of public CDN caching. Checkout continues to recompute current price and availability server-side. Do not use listing cards as payment authority.

## 3. Verification

| Check | Result |
| --- | --- |
| `npm test` | **1,004 passed, 0 failed** |
| `npm run test:performance` | **49 passed, 0 failed** |
| Customer journey, Customer Flow, GA4 Page Flow, Merchant, Catalogue Quality Excel and route-guard selection | **67 passed, 0 failed** |
| Bank-offer cache, currency conversion and failure fixtures | **3 passed, 0 failed** |
| TypeScript, `npx tsc --noEmit --incremental false` | **Passed** |
| Meta commerce, consent memory and journey tracker fixtures | **13 passed, 0 failed** |
| Build / lint | **Not run, as instructed** |
| Production configuration presence/syntax | **Blocked by the owner configuration items in section 5** |

The suites overlap, so their counts must not be added together as a count of distinct tests. Verification used isolated fixtures; it did not charge cards, send customer messages, publish Google tags, submit Merchant products or change the production database. Fixture alignment is not a substitute for payment-provider and hosted acceptance testing.

## 4. Owner actions: measurement and Google setup

### P0: authorize GA4 reporting so Page Flow can receive data

- [ ] Use the Google account with **Viewer or higher** access to GA4 property **530847951**. Confirm the property belongs to the Sara storefront and that the Analytics Data API is enabled in the OAuth project's Google Cloud console.
- [ ] Open OAuth 2.0 Playground settings, enable **Use your own OAuth credentials**, and enter the dedicated GA4 reporting client privately. The client needs the Playground redirect URI `https://developers.google.com/oauthplayground`.
- [ ] In Step 1 authorize exactly `https://www.googleapis.com/auth/analytics.readonly`. Sign in with the account that has property access. Request offline access/new consent so a new refresh token is issued.
- [ ] In Step 2 exchange the authorization code. Put the new refresh token into `GOOGLE_GA4_REFRESH_TOKEN` in `.env.local`, and into the hosting Production environment through its secure settings. Keep the matching `GOOGLE_GA4_CLIENT_ID` and `GOOGLE_GA4_CLIENT_SECRET` together. Do not put secrets into this document, Git or chat.
- [ ] Set server reporting property `GOOGLE_GA4_PROPERTY_ID=530847951` and hostname `GOOGLE_GA4_HOSTNAME=sarastores.com`. The measurement ID is a different identifier and cannot replace the property ID.
- [ ] In Playground Step 3 choose **GET**, URI `https://analyticsdata.googleapis.com/v1beta/properties/530847951/metadata`, no request body. Expect **200**. `ACCESS_TOKEN_SCOPE_INSUFFICIENT` means Step 1 must be reauthorized; Step 3 cannot expand an old token's scopes.
- [ ] After metadata succeeds, reload the deployed `/admin/page-flow`, use a date range with real traffic, and verify the reported hostname/device/source counts. Record property timezone, range and any thresholds/freshness restrictions.
- [ ] Replace the OAuth credentials/tokens previously shared in chat through the account's secure settings, then update the matching hosting/local configuration privately.

**Why this remains yours:** the latest read-only token check returned `invalid_grant`; earlier access had insufficient Analytics scope. Refreshing that token in application code cannot grant access. The reporting code already distinguishes those failures and never substitutes fabricated zero traffic. The reporting skill requires "property access, enabled Data API, analytics.readonly scope" and metadata validation: [sara-google-analytics](../../.agents/skills/sara-google-analytics/SKILL.md).

### P0: deploy and verify the direct Google tag

The November 9 follow-up found the live storefront using **GTM-T3ZWGR7L**, whose publicly published configuration still had empty tags/rules. The provided Google snippet for **G-WPZC537DQY** is valid. The local application now installs that Google tag directly, once, after analytics consent; advertising consent is independent. It queues ecommerce events before script readiness and avoids manually duplicating Google's automatic page views. GTM stays inactive in direct mode even if its ID remains configured.

- [ ] In hosting Production settings set `NEXT_PUBLIC_GOOGLE_TAG_MODE=direct` and `NEXT_PUBLIC_GA_ID=G-WPZC537DQY`, then deploy the updated application. No hosting token, linked project or Vercel CLI was configured in this workspace during the follow-up, so no deployment was performed. Public Next.js settings need to be included in the release, not only changed in a running server's environment.
- [ ] Test the live site with analytics consent accepted and an unblocked browser. Confirm the Google script and collection requests, then verify Tag Assistant and GA4 Realtime. A fresh automated test that does not accept analytics consent may still report that no tag was detected.
- [ ] Verify the web stream has enhanced history page-view measurement enabled. Check one initial page view and one per client navigation, and compare genuine paid purchases with order records.
- [ ] Keep reporting OAuth repair separate: direct tracking does not repair Page Flow's invalid reporting grant.

Follow-up verification passed TypeScript and all 376 selected tag, consent, commerce, audit and readiness regressions; no build or lint was run. See [the connection and verification runbook](../integrations/google-tag-connection.md). GTM publishing is optional for this direct setup. If the team later selects `NEXT_PUBLIC_GOOGLE_TAG_MODE=gtm`, first publish and verify the Google tag plus GA4 ecommerce event tags; exclude `page_view` and internal `checkout_started` from the ecommerce custom-event trigger. The configurable GTM loader requires both analytics and advertising consent. Do not install a second direct Google snippet or duplicate Meta commerce tags through GTM.

### P1: Merchant, Search Console, Business Profile and Ads

- [ ] Verify/claim the correct website in Merchant Center; align its canonical host and Search Console ownership with `https://www.sarastores.com`.
- [ ] Inventory team: open `/admin/catalogue-quality`, download the template containing current `itemno`, name and other values, fill **verified** missing GTIN/EAN or manufacturer MPN, brand/model/specifications/images and required facts, upload, review preview and save through the existing approved workflow. Internal item numbers are not manufacturer MPNs.
- [ ] Re-audit the selection. The dated Merchant review had 196 in-stock candidates missing required identifiers; that is historical evidence, not a new live count.
- [ ] Merchant owner: complete shipping/delivery coverage, charges, returns/refunds, business/contact details and policy verification. Start with the existing reviewed five-product submission workflow, resolve Google diagnostics, then expand eligible products.
- [ ] Decide and authorize the inventory/feed update cadence, failure owner and out-of-stock/offer-expiry handling before using Shopping ads. Do not upload an unverified or empty replacement feed.
- [ ] Search Console owner: verify the domain, submit the deployed sitemap, inspect priority product/category/store pages, review exclusions/canonicals and monitor actual indexing. Indexing is controlled by Google.
- [ ] Business Profile owner: verify each genuine store, opening hours, address, phone and service details. Supply approved photos and factual reviews/testimonials.
- [ ] Ads owner: grant access, link GA4/Merchant as appropriate, configure billing, review policy eligibility and approve a small test budget. The browser commerce mapping/deduplication is implemented; verify actual receipt in Meta Test Events and compare Purchase with paid orders before selecting Meta purchase campaigns. Use this direct pixel mapping once; do not also configure duplicate Meta commerce tags in GTM.

## 5. Owner actions: production configuration and operations

The local production-mode preflight reports the following names/conditions. It does **not** inspect the hosting dashboard or certify hosted credentials.

| Priority | Setting / action | What you need to do |
| --- | --- | --- |
| P0 | `RAZORPAY_KEY_ID` | Production preflight sees a test-mode key. Obtain/enable the correct live account key and matching secret in secure Production settings; validate sandbox checkout first. Never change a sandbox project to live merely to silence a check. |
| P0 if Pine Labs is offered | `PINELABS_ENVIRONMENT`, `PINELABS_CALLBACK_SECRET` | Finish provider onboarding; configure production environment and the actual hexadecimal callback signing key. If Pine Labs is not approved, explicitly disable it and verify checkout does not offer it. |
| P0 | `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Supply valid SMTP credentials and a verified sender. Confirm SMTP host/port/TLS and SPF/DKIM/DMARC. Use an authorized operator mailbox for a controlled test, then confirm order/reset email delivery. |
| P1 | `INDEXNOW_SITE_URL` | Match `NEXT_PUBLIC_SITE_URL` and the deployed canonical host; retain the existing verified IndexNow key and endpoint. |
| P0 for partner integration | `PARTNER_ALLOWED_ORIGINS` | Localhost entries fail production HTTPS validation. Set only the real approved HTTPS partner origins in Production; local development origins stay local. |
| P0 | GA4 reporting environment | Replace the invalid grant with the correctly scoped credential from section 4. Presence of a variable is not proof the credential works. |
| P0 | Hosting release | Deploy this reviewed source through the project's normal release process. `NEXT_PUBLIC_*` changes require a fresh release. Build/lint were intentionally not run in this task; the hosting release pipeline still needs its normal gates. |
| P0 | Backups/rollback | Confirm a restorable database backup and a known rollback release. Do not execute bulk catalogue changes or migrations to demonstrate a page. |
| P1 | Function/database region | Confirm hosting region and MongoDB region are close. Measure cold/warm response times before choosing a migration, plan upgrade or index change. Those changes require the real hosting/database operator and appropriate review. |
| P1 | Cron/recovery operations | Verify hosting-plan cron support, `CRON_SECRET`, provider settings, consent/suppression, daily caps and dry-run logs for the configured maintenance/outreach/product-email jobs. Review sending/retention deletion before activation. |
| P1 | Monitoring ownership | Assign owners for payment/webhook failures, order reconciliation, email/WhatsApp failures, report authorization, Merchant diagnostics and cron skips/errors. Review hosting/provider logs and set alerts in the actual monitoring accounts. |

See [production environment reference](../integrations/production-environment.md). Keep `.env` unchanged; runtime local additions belong in `.env.local`. The owner-approved names-only inventory must not receive credential assignments.

## 6. Release acceptance: checks you must complete on the hosted site

- [ ] Confirm the release contains `/admin/customer-flow`, `/admin/page-flow`, Catalogue Quality Excel upload/template, the new `/api/products/listing` and worker v5. Use the current authorized admin role to verify access controls and real data tables.
- [ ] Repeat mobile browser tests on homepage, products, filtered products, offers, product detail, cart and checkout. Use guest and registered sessions, denied/granted consent, grid/list views, filters, sorting, pagination, failure/retry and return navigation.
- [ ] Use at least one real Android phone and one iPhone on actual mobile data. Record phone/network/location and multiple cold/warm runs; include slow/unstable connectivity and reconnect. Verify taps, forms, image rendering and checkout recovery, not only whether the page opens.
- [ ] Measure transferred bytes, TTFB, LCP, INP and CLS after deployment. Use repeated lab runs and field p75 where available; target LCP <=2.5s, INP <=200ms, CLS <=0.1. Do not mark physical-mobile performance passed without the observations.
- [ ] After an old-worker update/reload, verify v5 owns the Sara caches, public assets load normally, private APIs are never cached, and offline checkout never falsely succeeds with stale data.
- [ ] Verify payment success/failure/pending/retry, changed price/stock, declined/mandatory gifts, coupon changes, pickup stock, webhook replay and order recovery against approved provider sandbox/UAT. Coordinate the production financial sign-off with Sara operations.
- [ ] Compare genuine GA4 purchases and revenue with verified orders. Check duplicates, refunds and consent effects. Customer Flow identifies consented tracked customers; Page Flow supplies aggregate GA4 page users. Google aggregate reports cannot reveal anonymous visitors' names/phone numbers.
- [ ] Show the Sara team an approved hosted demo and record the release version, date, owners and evidence for each completed gate.

## 7. Business work still needed before marketing

- [ ] Approve advertised products, stock quantities, margins, delivery promises, warranties, installation/EMI terms, returns and offer expiry. Supply missing facts; development cannot invent them.
- [ ] Approve budget, target areas, channel priorities, campaign offers, creative assets and who handles enquiries/order issues. The existing plan's allocation is a proposal, not approved spend.
- [ ] Use consistent UTM names on all campaign/store links. Establish a 14-day measurement baseline after tracking is working; historical unrecorded visits cannot be recreated.
- [ ] Start Merchant free listings and priority local/SEO work, then a small paid search/Shopping pilot after payment, tracking, stock, policy and mobile release gates pass. Scale using actual conversion, contribution margin and return/refund evidence.
- [ ] Refresh original product/store content and genuinely earned reviews. Obtain approved marketing consent before email/WhatsApp/SMS retention campaigns.

## 8. Development work conditional on your decisions

These are still pending, and are not represented as completed:

- **Optional Meta Conversions API:** browser commerce mapping is completed. If a server-side Meta integration is selected, it still needs the authorized account token/configuration, a consented server event design, and browser/server deduplication using the same `order-<transaction_id>` event ID. Hosted Pixel Test Events and genuine purchase reconciliation remain owner acceptance work.
- **Managed alerting and provider acceptance:** configure the selected hosting/monitoring/provider accounts and test their genuine delivery/webhook behavior. Existing local guards and sanitized errors are not a working alert service.
- **Catalogue scale work:** if cold-start/database profiling remains slow, review materialized catalogue search/facet data, database indexes or a dedicated search service against real catalogue scale. The current read-time index improves the present payload but does not make all future database scans disappear.
- **Campaign content and iteration:** final category/brand copy, creatives, landing-page changes and offer promises depend on Sara-approved facts and the first real traffic/conversion baseline.

The remaining account setup, data corrections, budgets, deployment and physical-device sign-off need the owner/team. No live campaign spend, production database mutation or customer outreach was performed in this development task.
