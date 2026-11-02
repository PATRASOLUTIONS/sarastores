# Public content rendering findings

Source audit: 2026-11-02. Scope is all nonprivileged public page templates in the
repository, excluding customer transactions, authentication, participation/token
screens, internal demos and privileged dashboards. No live catalogue, credentials
or external provider was accessed. This is template evidence, not certification
of every database record or Google's indexed content.

## Findings and implementation

| Priority | Route/template | Initial evidence | Action/status |
|---|---|---|---|
| High | `/sub-category/[name]` | Client page started loading with no name/products and fetched three robots-blocked APIs. `/api/products` without paging also supplied only a bounded catalogue subset. | Main agent implementing server taxonomy/product seed and server missing-route checks. |
| High | `/campaign/[slug]` | Client page initially rendered a spinner without its heading/products; all content depended on the campaign API. | Main agent implementing public server campaign seed. |
| High | `/super-sunday` / `CampaignExperience` | Fixed campaign was loaded only after hydration; robots-blocked API failure replaced its contents with an error. | Implemented server `getPublicPageCampaign` seed, server `notFound`, and client preservation of seeded content. |
| High | `/software` | Client page started loading with no H1/catalogue and fetched software after hydration. | Main agent implementing public server seed; private integration/provider catalogue must remain separate. |
| High | `/bosch`, `/haier`, `/lg`, `/tcl` | Brand titles existed but primary product shelves were empty in initial HTML. Products were fetched from the default bounded API and filtered by manufacturer instead of authoritative catalogue brand. Hero text was initially opacity-zero until IntersectionObserver. | Implemented server public product seed, authoritative brand selection and positive prices; preserved interactive UI, skip seeded initial fetch, and make hero visible without JS. |
| Medium | `/brands` | Brand directory depended on client brands, complete product pages and logo API requests; title existed but directory links/counts were not initially rendered. | Main agent implementing public server directory seed. |
| Medium | `/brand-guidelines` | Public typography/example page included two actual H1 elements. | Demonstration H1 replaced with a styled div; public brand-kit intent and primary H1 preserved. Rendered semantic-heading regression passes. |
| Medium | `/ganesh` | Shelves used `active:true` rather than shared public selection, and copy asserted an ended 2026 promotion with blanket EMI/install/delivery promises. | Uses normalized public loader (shared publicCatalogueFilter), positive price/stock and current policy-linked wording. Removed stale date urgency and invented payment/delivery promises. Existing shelf threshold regression passes. |
| High | `/epic-sale` | Static brochure invented prices, MRP, gifts, daily EMI and urgent midnight timing without catalogue links. | Server page now derives current in-stock public products, actual price/MRP/discount and direct product links. Replaced gifts/loan/timing promises with policy-linked availability wording; original card and hero styling retained. |
| Low | `/subham` | Contains a real `motion.h1`, so a simple source search for `<h1` falsely says it has none. Heading “Stronger Together” does not identify either partner; animation starts opacity-zero. | Prefer a descriptive partner heading and visible initial animation state if this remains an indexable partnership page. Business relationship facts need confirmation. |
| Low | Manufacturer artwork / warranty | Dedicated templates implied authentic branded stock photos and blanket 2/3/10-year warranty periods. | Unsplash photos now labeled illustrative, fixed warranty promises replaced with product-specific warranty information and a policy link. Actual branded artwork/model warranty facts still need business verification. |

Six targeted Node regressions pass across `tests/seo-manufacturer-pages.test.mjs`
and `tests/seo-public-promotions.test.mjs`: public selection, initial manufacturer
content, fixed campaign SSR/404, current promotion money and policy wording,
expired contest archive/noindex, and one brand-kit H1. The existing Ganesh shelf
threshold test also passes individually. Final TypeScript/build and browser
verification belongs to the consolidated main-agent check.

The declared 15 January to 28 February 2026 lucky draw is now an explicit archive.
The server wrapper hides the participation client after that end date; the layout
is noindex with archive metadata and no conflicting current prize promises. The
main agent must remove the expired static contest from the XML sitemap.

## Content that already renders usefully

- Shared `PolicyPage` supplies a meaningful H1 and structured sections for returns,
  shipping, warranty, EMI, installation, disclaimer and corporate-information pages.
  A zero-H1 count in a route source alone is not an actual rendered-heading defect.
- Blog index and article detail are server components with visible headings, article
  copy, descriptive cover-image alt text and internal links. Article detail checks
  missing records server-side and includes article structured data. Actual article
  quality, author expertise and data completeness remain unverified.
- Store index, city and store detail have server titles/content and navigation.
  Store-locator has a component-provided heading rather than a route-local H1.
  Actual store facts, current hours, coordinates and profile consistency remain
  separate verification requirements.
- About, contact, careers, business-enquiries, complaints, FAQ and policy templates
  contain meaningful headings/content before interactive form submissions. Form
  endpoints do not need crawler access for the primary explanatory copy to render.
- About intentionally uses mutually exclusive hero/fallback H1 branches; its two
  source occurrences are not two simultaneous page headings.
- Home, products, product, category and configured brand templates already received
  the prior server content fixes and are preserved by this audit.

## Verification limits

Source review can identify API-dependent rendering, heading mistakes, incomplete
query use and generic content. It cannot establish traffic, field CWV, Merchant
approval, image correctness for every SKU or complete visible product descriptions.
Do not assign a full-site SEO score from this limited source evidence. Final
browser tests should inspect raw HTML and hydrated DOM with APIs blocked, and
public/live catalogue checks should be reported separately after deployment.
