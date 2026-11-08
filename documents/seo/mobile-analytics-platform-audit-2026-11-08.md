# Mobile loading, analytics and PWA audit — 8 November 2026

The platform loads on the checked mobile storefront pages, but mobile speed and analytics coverage need work. **GA4 is not connected through the currently published GTM container:** its public resource has `tags: []`, `predicates: []`, and `rules: []`. The container loads, but it has no published tracking tags. `G-WPZC537DQY` was absent from the public container and no GA4 request was observed after synthetic consent.

## Scope and limits

- Reviewed root-layout integrations, analytics call sites, consent, service worker, manifest, public data loading, and relevant isolated regressions.
- Tested the public homepage, product listing and one product page in Chromium with a Pixel 7 profile (412 CSS pixels), 4× CPU throttling, and simulated fast/slow 4G. Five cold browser contexts; one observation per scenario, not a benchmark distribution.
- Fast 4G: 9 Mbps download, 80 ms configured latency. Slow 4G: 1.6 Mbps download, 150 ms configured latency. Actual connections also include this machine's network conditions.
- Public documents were visited sequentially. No login, checkout, private-order navigation, payment, data migration or provider-account change was performed. Browser submissions and measurement collection endpoints were blocked. Third-party script/configuration GETs were allowed for the consent run.
- Screenshots were visually inspected for the listing; DOM checks covered all measured pages. All three public page types returned HTTP 200 with no observed page exceptions or HTTP resource errors, and no horizontal overflow. This does not certify all routes or interactive purchase flows.
- Google PageSpeed returned HTTP 429. Field p75 LCP/INP/CLS and a Lighthouse score are unverified. These are browser lab observations, not physical mobile-data measurements.
- **No build or lint was run**, as requested. No storefront source, environment file, production configuration or database was changed.

## Analytics connection status

| Integration | Local environment | Live browser evidence | Conclusion |
| --- | --- | --- | --- |
| GTM `GTM-T3ZWGR7L` | ID missing in `.env` and `.env.local` | Matching initializer and public container loaded after consent | Connected loader, but published container is empty |
| GA4 `G-WPZC537DQY` | ID missing in both files | No direct GA4 script; no matching ID in public GTM resource; no GA4 request | Tracking not connected through the reviewed integration |
| Clarity `z8bi556xww` | ID missing in both files | Matching initializer, tag and runtime loaded; collection attempts observed and blocked | Client integration present; dashboard receipt unverified |
| Meta `1420583090240084` | ID missing in both files | Matching initializer and configuration loaded; PageView request attempted and blocked | Client integration present; dashboard receipt and conversions unverified |
| PWA service worker | `.env.local` contains the flag, with a value different from requested `true` | `/sw.js` registered and active in normal measured contexts | Enabled live, with lifecycle and caching defects described below |

Local configuration and hosted configuration differ. Production values were inferred only from rendered behavior, not from an authenticated hosting settings inventory. Public Next.js IDs require a new build/deployment when changed; local environment edits alone do not update the hosted site.

`components/MarketingTags.tsx` chooses GTM when both GTM and GA4 IDs exist; direct GA4 is the fallback. The current empty GTM resource therefore leaves Google Analytics unconfigured. Put the Google tag and event mappings in the container, or deliberately choose direct GA4. Account changes and publishing were not performed.

Consent behavior is intentional: Clarity/direct GA4 require analytics consent; Meta requires advertising consent; GTM currently requires both. No third-party marketing request was observed in the four undecided-visitor runs. All five granular marketing/GTM consent regression cases passed.

## Mobile measurements

LCP means when the largest visible content element paints. The usual good target is **2.5 seconds or less**; observations above 4 seconds are poor lab results. CLS target is **0.1 or less**.

| Page/scenario | First content paint | Largest content paint | CLS | Decoded HTML | Observed long-task blocking |
| --- | ---: | ---: | ---: | ---: | ---: |
| Homepage, fast 4G | 5.79 s | 5.80 s | 0.000 | 115 KB | 828 ms |
| Homepage, slow 4G | 4.95 s | 4.99 s | 0.000 | 116 KB | 1,052 ms |
| Products, slow 4G | 12.30 s | 21.24 s | 0.031 | 3,659 KB | 2,988 ms |
| One product, slow 4G | 5.48 s | 5.48 s | 0.031 | 147 KB | 1,693 ms |
| Homepage, fast 4G, synthetic consent | 11.50 s | 11.55 s | 0.000 | See raw evidence | 2,044 ms |

The consent run is not a controlled comparison proving tracker overhead: server/network conditions varied and collection was blocked. It does demonstrate that this sampled consented load was slow.

Long-task blocking is the sum of each observed task's duration above 50 ms. It is an interaction-risk signal, **not measured INP or Lighthouse TBT**. Resource transfers include only sizes exposed by browser timing; they are not a complete mobile data bill.

The first fast-4G navigation received its first byte at approximately 2.85 seconds from navigation start; subsequent undecided runs were approximately 0.14–0.16 seconds. A separate initial HEAD command took approximately 10 seconds overall, including connection/setup. Those values show variability, not a proven persistent 10-second server TTFB. Single-run requestStart-to-responseStart timings cannot establish real-world p75 latency.

The sampled public HTML responses were `private, no-cache, no-store` with Vercel `MISS`. The first homepage response identified `bom1::iad1`. Review function and database placement and public-page cacheability; the identifier alone does not prove the cause of latency. Never share-cache authenticated layouts or personalized responses.

## Prioritized work

1. **Connect GA4 in the published GTM container.** It currently contains zero tags/rules. Verify Google tag initialization, ecommerce mappings, route changes and consent behavior using authorized account tools. Clarity and Meta being present does not establish GA4 delivery.
2. **Reduce the product-listing payload.** `app/products/page.tsx` passes the full public catalogue to `ProductsClient`, and `getPublicPageProducts()` materializes the complete projected result. The measured HTML was about 3.57 MiB before compression. Render a bounded initial page and load subsequent pages/filter results with pagination, keeping indexable product links and server-rendered content. Avoid duplicating catalogue data in initial hydration.
3. **Correct PWA lifecycle handling before relying on it for mobile speed.** The root inline script unregisters every worker and deletes every cache on each full page load, then registers `/sw.js` when enabled. This defeats persistent caching and creates races. Preserve the active worker when enabled and remove only explicitly owned obsolete caches on version change.
4. **Bound service-worker API caching.** `public/sw.js` uses substring route matching, ignores response privacy/cache-control, and returns cached API data even after the nominal five-minute age. Background cache writes are not tied to the fetch event lifetime. Restrict caching to exact public read endpoints, respect `no-store`/private responses, enforce an actual expiry and provide a defined offline fallback. Checkout must always revalidate current prices and stock server-side.
5. **Complete event coverage.** Existing call sites cover add/remove cart, checkout start/purchase, fulfilment, EMI, offers, store/pincode/call/WhatsApp. Helpers for product view, cart view, payment-info, search, signup, login and lead submission have no application call sites in the reviewed source. Meta currently sends PageView only; app-level purchase/add-to-cart Meta events are absent. GTM mappings are also absent because the published container is empty.
6. **Verify client-side navigation pageviews.** Root scripts persist across App Router navigation, and Meta initialization sends PageView once. There is no explicit route-change pageview bridge in MarketingTags. GA4 history settings, Meta route pageviews and duplicate prevention need verification. The attempted browser navigation selected a hidden desktop link and timed out; this is an audit-selector limitation, not evidence of a broken mobile link.
7. **Reduce nonessential mobile work and image bytes.** The measured homepage banner requested a 1080-pixel variant; the product hero requested a 1200-pixel optimized image. Evaluate these sizes against device pixel density and compressed bytes. Festival particles are visible on mobile and are already deferred/reduced-motion aware; profile their contribution before attributing the observed long tasks to them. Move unused Firebase/payment preconnects away from the root where appropriate.
8. **Investigate failing isolated regressions.** The selected suite consistently produced 71 passes and 16 failures. Homepage and marketing consent tests passed. Failures involved catalogue/order-pricing, checkout/coupon/payment-intent expectations and personal-data export. Many returned an earlier rejection instead of the expected status. Determine whether fixture assumptions or implementation changed; these failures alone do not prove live payment corruption or data exposure.

## Required evidence before a full-platform pass

Real-device tests on cellular 4G/5G and weak connectivity, repeated warm/cold mobile loads, real-user p75 LCP/INP/CLS segmented by mobile, authorized GA4 DebugView/GTM Preview and Meta Test Events, Clarity dashboard receipt, isolated checkout success/failure and reload recovery, and PWA repeat-load/offline/update verification remain unverified.

Raw evidence and screenshots are kept locally in `.seo-local/mobile-platform-2026-11-08/`; regression output is `regression-results.txt`. PageSpeed failure evidence is `.seo-local/performance/summary.json`. The raw tracking URLs contain synthetic browser identifiers and are not copied into this publishable report.
