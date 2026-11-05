# Products page speed and Google snippet review

Reviewed 2026-11-05. Public URL: https://www.sarastores.com/products. Review and plan only; no storefront changes, build, lint, deployment, database writes or Google account changes.

## Evidence and limits

- The first public page request timed out at 30 seconds.
- A repeat request after the successful sample also timed out at 30 seconds. These three samples establish a problem worth investigating, but do not isolate hosting, network or database latency.
- A subsequent public request returned HTTP 200: headers after 53,092 ms and complete HTML after 54,166 ms. Decoded HTML was 3,752,028 bytes (3.58 MiB); transfer used Brotli. This is decoded document size, not compressed network transfer size. The response reported `x-vercel-cache: MISS`.
- The successful HTML included `All Products (196 Products)` and `In stock only (196)`, with no `Request failed` or `Retry products` error. These are the displayed in-stock counts at the time of this sample, not a permanent catalogue total.
- The canonical points to the clean Products URL; title and description are present. Public robots.txt allows `/products` but disallows general `/api` crawling.
- Google PageSpeed's unauthenticated API returned HTTP 429 (quota exceeded). No current Lighthouse score, browser LCP, INP or CLS was obtained. Request timings are from this machine and are not a browser performance benchmark or a representative latency percentile.
- The supplied Google snippet was `All Products (0 Products) Request failed: /api/categories (499) Retry products. Genuine ...`. Its crawl date and deployed code version are unknown. The successful live HTML differs, suggesting Google retained an earlier failure state. The snippet alone does not establish an empty inventory or the precise cause of status 499.
- Raw public evidence is under `.seo-local/products-speed/`.

## What the current code does

`app/products/page.tsx` waits for the entire public catalogue and categories before returning the client component. `lib/public-page-data.ts` uses an unbounded listing query, normalizes and validates every record, then serializes them into the page even though only 24 products are displayed. Its catalogue cache lasts 60 seconds per process; categories are only request-memoized.

`app/products/ProductsClient.tsx` refreshes the entire catalogue every 30 seconds and on focus/visibility changes. It fetches serial batches of 500 with `cache: no-store`, without the API's compact `fields=card` projection. Filtering, facet counting and sorting scan the full catalogue in the browser.

The client fallback loads products and categories using one `Promise.all`. If categories fail, it does not apply the successfully fetched products. The result-count heading renders independently of loading/error state, so it can show zero while the error and retry control appear below it. The current server seed helps avoid this initial client dependency, but the fallback remains fragile.

The page also loads managed header/footer content, listing banners, and Razorpay offers. Offers are requested even on the ordinary Products page. Listing banner photos use native images without intrinsic dimensions or responsive sources; product cards already have responsive image sizes and lazy loading.

## Prioritized implementation plan

| Priority | Change | Purpose |
| --- | --- | --- |
| 1 | Return the first 24 matching products, accurate total and facet summaries from the server. Read URL filters before rendering. Query and transfer bounded card data; preserve canonical deduplication, stock rules and feature filters. | Reduce database work, HTML size, hydration and browser filtering cost while keeping counts correct. |
| 1 | Separate category/filter failures from product loading. Retain last successful cards on refresh failure. Show a count only after a successful query; keep technical error and retry regions out of snippets using `data-nosnippet`. | Prevent another indexable zero-count failure state and keep the catalogue usable. |
| 1 | Cache public listing batches, counts and taxonomy across requests with explicit refresh/invalidation. Keep customer identity separate and validate price/stock at checkout. Inspect query performance before proposing indexes. | Reduce cold-request work without caching personal data. Any database/index change requires separate approval. |
| 2 | Replace full-catalogue polling with revalidation of the visible page, coalesced focus refresh and bounded retries. Debounce filter requests and cancel superseded requests. | Stop repeated large transfers and unnecessary rerenders. |
| 2 | Reuse or seed header/footer/taxonomy data; load offer requests and offer UI only when relevant. Make brand-link prefetch use the bounded listing response. | Reduce auxiliary requests and JavaScript while preserving the requested brand prefetch behavior. |
| 2 | Give listing banners real dimensions and responsive sources. Reserve space before loading; prioritize only the image identified as LCP and keep offscreen images lazy. | Reduce image bytes and layout movement. |
| 3 | After deployment, run mobile PageSpeed and Search Console's live URL test, confirm cards/count in rendered HTML, then request recrawling. | Verify performance and let Google replace the old snippet. Google controls snippet selection and refresh timing. |

Do not hardcode a product count or open every `/api` route to crawlers. Products and counts should remain available in server-rendered HTML. Product rich-result markup is a separate concern from the zero-count search snippet; it does not repair a failed listing request.

## Verification for implementation

Use isolated fixtures to check default in-stock results, all-stock results, brand/search/price/specification filters, pagination, counts and category failure handling. Confirm a refresh failure retains existing products and never converts an unknown count into zero. Run TypeScript and focused regressions, respecting the owner's no-build/no-lint instruction.

Compare repeated cold and warm public request timings and document bytes, then obtain an actual mobile Lighthouse report. Target good Core Web Vitals (LCP at most 2.5 seconds, INP at most 200 ms, CLS at most 0.1 at the 75th percentile); these are targets, not measured outcomes or guarantees. Field metrics will lag deployment.
