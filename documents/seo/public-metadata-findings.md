# Public metadata and indexing findings

Audit date: 2026-11-02. This source review covers nonprivileged page routes and
ancestor layouts, excluding admin/account/dashboard/vendor, APIs and credentials.
It is part of the site-wide remediation; no live database or Google API was used.

## Confirmed gaps and fixes applied

| Route | Finding | Applied change |
|---|---|---|
| `/sara-care` | Inherited homepage metadata and canonical despite distinct service content | Added page-specific title, description, canonical and aligned sharing metadata in `app/sara-care/layout.tsx`. Root agent is adding sitemap discovery. |
| `/wishlist` | Personal wishlist inherited indexable homepage metadata; robots disallow alone is not noindex | Added noindex metadata with a token-free wishlist canonical in `app/wishlist/layout.tsx`. |
| `/search`, `/error` | Legacy redirect endpoints inherited homepage metadata | Added route-specific noindex metadata, leaving redirects intact. |
| `/sub-category/[name]` | Missing/disabled taxonomy could return a noindex 200, and hyphen replacement lost exact stored names | Layout/metadata now resolve active stored taxonomy, preserve exact hyphenated names, canonicalize aliases to stored name and call server `notFound()` for missing/disabled rows. |
| `/super-sunday` | Fixed campaign alias declared its own indexable canonical even when campaign absent; duplicate campaign route | Layout/metadata require active `super-sunday` campaign and canonicalize to `/campaign/super-sunday`. The canonical campaign route already enters XML sitemap only when active; the alias does not need a separate sitemap entry. |
| Shared category lookup | Disabled category rows could resolve through ID/slug/name and emit metadata/schema before child checks | `lib/seo-category.ts` now excludes disabled records consistently. |
| Article detail/schema | Legacy special-character slugs could disagree with metadata and authored body h1 duplicated the page title | Schema/related links encode the slug; sanitized render content transforms body h1 into h2 using a DOM parser without changing stored data. |
| Public article reads | Legacy object title/category fields can fail React rendering; one invalid date emptied the entire article list | Normalize public string/date fields safely, retain good published records, exclude malformed required title/slug from public list/detail and preserve staff access for repair. |
| Store pages/schema | Missing opening hours defaulted to invented 9 AM–9 PM, and numeric invalid coordinates could become geo | Stored hours remain unchanged; missing hours are omitted from markup and shown as contact guidance. Coordinates require finite latitude/longitude in valid ranges. |
| Site-wide Store hours schema | Day ranges only emitted their endpoints; malformed strings became incomplete specification objects | Expand weekday ranges/lists to Schema.org day URLs with validated clocks; omit unparseable specifications and retain only recorded source text. |

Metadata derives from existing visible page content and campaign records; no new
coverage, price, promotional entitlement or business-policy fact was invented.
All fourteen focused tests in `tests/seo-public-metadata.test.mjs` passed, covering
missing/disabled server checks, exact hyphenated taxonomy aliases and a real
article render with legacy unsafe HTML, one h1 and matching encoded schema/canonical,
missing store hours, invalid geographic coordinates, correct weekday ranges,
malformed legacy article records and absence of six script-dependent loading shells. The root
agent handles the final combined TypeScript/build/browser checks.

## Findings passed to the root agent

- `/sara-care` needs XML and HTML sitemap discovery to avoid becoming orphaned.
- Ganesh/epic-sale content and metadata hardcode dated or blanket bank/EMI and
  installation claims. They need current eligibility facts or conditional copy;
  source review cannot certify them as current promotions.
- Client catalogue/marketing fetches on other public routes may still leave empty
  primary content when APIs are unavailable. Source metadata coverage does not prove
  rendered content; the root agent's broader browser audit must check this condition.

## What already works

Public policy/company pages generally use `pageMetadata` or full shared metadata
helpers. Product/category/brand pages have server metadata and canonical identifiers;
Product/Breadcrumb, category/brand ItemList and article/store schemas are supplied
server-side. Blog index/detail content already renders on the server. Transactional
and private participation routes generally have noindex metadata and are excluded
from XML sitemap. Faceted query URLs are blocked by robots and clean-canonicalized.

The raw route inventory is `.seo-local/public-metadata-inventory.json`. This is
source evidence, not a full live-catalogue crawl or a claim of rankings, field CWV,
Merchant acceptance, verified store facts or Google index status.

The site-wide Store node can lack a physical address when settings do not provide
one. Its address is not invented; LocalBusiness rich-result eligibility remains
unverified in that case. Specific store pages depend on the actual stored location
records and should be reconciled with Business Profile facts before claiming full
local-SEO consistency.

The public crawl observed a live `/blog` 500. Isolated production SSR reproduced
errors from object-valued article title/category fields, and local normalization
fixes those code paths. This does not prove the live database contains those
fields or that they caused that response; hosted logs/data were not accessed.
Unsupported HTTPS cover hosts did not fail production SSR in the isolated test;
the existing image optimizer allowlist remains unchanged. Invalid dates previously
hid all rows through the list fallback rather than producing that 500.
