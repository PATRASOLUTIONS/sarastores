# Public storefront SEO audit and fixes

Date: 2026-11-02. Owner-authorized scope: check all public-facing pages and fix
the gaps. The live site is not fully SEO-friendly. The implementation changes
are local and have not been deployed.

## Coverage

The source inventory contains 172 page routes: 44 indexable public templates,
25 noindex utility/transactional pages, and 103 gated account/admin/vendor pages.
All indexable templates have their own or scoped ancestor metadata. Dynamic
templates are exercised with synthetic product, category, subcategory, brand,
campaign, article and store records. This tests templates; it does not certify
every live database record.

A separate, read-only crawl checks all 1,315 URLs in the current live XML sitemap,
including 1,128 product pages. It respects public robots rules, makes sequential
GET requests with a one-second delay, and does not access private pages or APIs.
The crawl completed and the two failed requests were retried. Final live results:

| Live check | Result |
|---|---|
| Sitemap coverage | 1,315 / 1,315 URLs checked |
| Successful HTML responses | 1,313 HTTP 200 |
| Blog index | `/blog` HTTP 500; persisted on retry |
| Public campaign | `/campaign/super-sunday` timed out; persisted on retry |
| Canonical/redirect hostname mismatch | 1,313 successful responses |
| Missing initial-HTML H1 | 1,183 pages |
| Multiple initial-HTML H1s | One page; brand-guidelines template fixed locally |
| Basic public Product/Offer gate | All 1,128 product pages pass; not Merchant or Rich Results approval |
| Duplicate titles | Eight pairs / 16 product URLs; left separate at the owner's request |

Every checked live URL has an HTML or request finding. This is evidence from the
unchanged deployed site, not the local implementation. Duplicate consolidation
was stopped before any production/test edits or additional SKU inspection; no
new product alias redirects or merges were added.

## Implemented changes

- Products, product detail, categories, subcategories, brands, manufacturer
  landing pages, campaigns and software receive sanitized public data from the
  server. Primary content remains available when catalogue APIs are blocked.
  Software output excludes license/provider secrets.
- Indexable asynchronous catalogue routes no longer use streaming loading
  boundaries that leave content hidden without JavaScript. Audits now reject
  headings inside hidden containers as well as invisible animation states.
- Canonicals, shared metadata, sitemap/feed origins and the apex redirect agree
  on `https://www.sarastores.com`. Dynamic missing/disabled records return 404;
  alternate taxonomy names resolve to their stored canonical identifier.
- Sara Care has scoped metadata. Search, wishlist and error utilities have
  noindex metadata. The expired lucky-draw page is archived, has no entry form,
  is noindex, and is excluded from the XML sitemap.
- Promotions display actual selected catalogue products and prices. Removed
  unverified blanket gifts, delivery, installation, warranty and EMI promises,
  stale event dates, and the unsupported blog store-count claim.
- Blog HTML is sanitized and article content headings do not introduce a second
  page H1. Links encode slugs. Malformed article fields are normalized per row;
  invalid dates no longer hide valid articles. Missing or malformed public
  title/slug records are excluded publicly and retained for staff repair.
- Store hours and coordinates are validated. Missing hours prompt contact
  guidance, invalid coordinates are omitted, and supported day ranges expand
  into valid OpeningHoursSpecification entries. No store facts were invented.
- Product structured data no longer invents a generic return window or calendar
  delivery ranges. Existing published policy links and configured shipping fees
  remain. Sitemap source failures are explicit instead of silently publishing
  an incomplete success.

## Verification

| Local check | Result |
|---|---|
| Public initial HTML | 44 / 44 templates pass: status, metadata, canonical, one non-hidden H1, primary text, JSON-LD parsing, image alt attributes |
| Desktop hydration with APIs/foreign resources blocked | 44 / 44 pass; seeded primary content retained |
| Mobile hydration | 44 / 44 pass; no document horizontal overflow at 390px |
| JavaScript-disabled browser | 44 / 44 pass; primary headings/content remain visible |
| Missing public resources and excluded utilities | 14 / 14 probes pass: eight 404 resources and six noindex utilities, including the intended error-page redirect |
| Node SEO regressions | 48 pass |
| Offline Python validation | 15 pass; explicit process exit 0 |
| Explicit TypeScript | `npx tsc --noEmit`, exit 0 |
| Production build | `npm run build` through isolated wrapper, exit 0; type/lint gates enabled; 221 static pages generated; existing nonblocking lint warnings remain |
| Synthetic XML sitemap | HTTP 200; 48 unique www URLs; expired draw and noncanonical Super Sunday alias excluded |
| Full application suite | 820 / 874 pass; 54 existing failures reproduced against HEAD sources |
| Visual checks | 14 synthetic desktop/mobile screenshots captured without page JavaScript; product, products, brands, store and home screenshots inspected |
| Integration secret-pattern scan | 57 files checked; no potential secret files; narrow integration-only scan |

Build/browser fixtures use 12 synthetic collections. Real database connections,
provider requests and environment-file reads are blocked. Evidence is ignored
under `.seo-local/`: `full-public/summary.json`, `full-public/pages.jsonl`,
`public-route-audit.json`, `public-browser-audit.json`, `public-browser-mobile.json`,
`public-browser-no-js-audit.json`, `public-boundary-audit.json`, `public-qa/`,
`public-fixture-sitemap.json`, `public-seo-tests.log`, `public-python-tests.log`,
`public-types.log`, `public-all-tests.log` and `build-result.json`.

The repository-wide suite has existing failures documented in
[SEO-TESTING-REPORT.md](SEO-TESTING-REPORT.md). Passing SEO checks do not make that
release gate green.

## Remaining limits

The live `/blog` returned HTTP 500 during the crawl. Malformed article fields
reproduce failures in isolated production SSR and those paths are fixed locally;
the live cause is unconfirmed without hosted logs/data. The campaign timeout also
persisted on retry; the public campaign template now receives server-loaded data,
but this does not establish the cause of the deployed timeout. The 16 duplicate
product URLs are intentionally left separate as requested.

Deployment and a follow-up live audit are still required. Google indexing,
Search Console, GA4, Merchant acceptance and Business Profile consistency are
unverified because authorized resources were not supplied. Public PageSpeed
returned 429, so field Core Web Vitals and mobile lab performance remain
unverified. External image availability, every SKU's GTIN/reviews/content quality,
and real store/policy facts are not certified by fixture checks. A site-wide
Store node without a supplied physical address is not claimed eligible for local
rich results. No overall SEO score or guaranteed ranking is inferred.

No deployment, customer-data mutation, tracking change, Merchant upload,
indexing submission or Business Profile edit ran.

## Public template coverage

Each route below passes the initial-HTML, desktop, mobile and JavaScript-disabled checks. Dynamic routes use synthetic examples; all live sitemap URLs are covered separately above.

| Route template | Result |
|---|---|
| `/` | PASS |
| `/about` | PASS |
| `/blog` | PASS |
| `/blog/[slug]` | PASS |
| `/bosch` | PASS |
| `/brand-guidelines` | PASS |
| `/brands` | PASS |
| `/brands/[slug]` | PASS |
| `/business-enquiries` | PASS |
| `/campaign/[slug]` | PASS |
| `/cancellation-policy` | PASS |
| `/careers` | PASS |
| `/category/[id]` | PASS |
| `/complaints` | PASS |
| `/contact` | PASS |
| `/corporate-information` | PASS |
| `/disclaimer` | PASS |
| `/emi` | PASS |
| `/epic-sale` | PASS |
| `/faq` | PASS |
| `/ganesh` | PASS |
| `/haier` | PASS |
| `/installation` | PASS |
| `/lg` | PASS |
| `/offers` | PASS |
| `/press` | PASS |
| `/privacy-policy` | PASS |
| `/product/[slug]` | PASS |
| `/products` | PASS |
| `/returns` | PASS |
| `/rewards` | PASS |
| `/sara-care` | PASS |
| `/shipping-policy` | PASS |
| `/sitemap` | PASS |
| `/software` | PASS |
| `/store-locator` | PASS |
| `/stores` | PASS |
| `/stores/[city]` | PASS |
| `/stores/[city]/[store]` | PASS |
| `/sub-category/[name]` | PASS |
| `/super-sunday` | PASS |
| `/tcl` | PASS |
| `/terms-and-conditions` | PASS |
| `/warranty` | PASS |
