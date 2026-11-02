# SEO fixes: testing report

Date: 2026-11-02. Upstream commit: `6be93f45064ffbadced572b5d5c95f55fd263af0`.
The owner's “fix all the gaps” request authorized the documented storefront and
repository SEO fixes. They are implemented locally and have not been deployed.

The subsequent all-public-pages review is documented in
[FULL-PUBLIC-SEO-AUDIT.md](FULL-PUBLIC-SEO-AUDIT.md). It expands the original
five-template browser check to all 44 indexable templates and crawls all 1,315
live sitemap URLs. Its final results supersede the earlier limited sample below.

## Measured results

| Check | Result | Evidence / limit |
|---|---|---|
| Dedicated SEO regressions | PASS | 56 Node tests; metadata, Product markup, canonical origins, sitemap failures, public data boundaries, campaigns/manufacturers, article robustness, store schema, image-host/fallback behavior, responsive/native sizing and build guards, including named ES module imports |
| Image warnings and geometry | PASS | All 134 originally reported image warnings resolved. Actual Next rendering and compiled CSS pass 18 desktop/mobile geometry comparisons and delayed-load sizing. Private previews and natural-size images load directly; optimizer host policy is unchanged. |
| Repository lint | PASS | 1,262 files; zero errors and zero warnings with `--max-warnings 0`; subsequent cleanup documented in [the build/lint report](../lint-and-build-check.md) |
| Full application suite | EXISTING FAILURES | 820/874 pass; 54 failures, all reproduced against HEAD production sources; no new failures in that comparison |
| Adversarial validation | PASS | 15 Python tests, including strict Offer adapter failure, robots longest-match rules, request scope, full-crawl URL restrictions and drift changes |
| Production browser regression | PASS | All 44 indexable templates pass desktop, mobile and JavaScript-disabled checks; primary headings/content retained with APIs and foreign resources blocked |
| Explicit TypeScript check | PASS | `npx tsc --noEmit`; no diagnostics |
| Production build | PASS | `npm run build` through the isolated wrapper, exit 0; 221 static pages generated; strict TypeScript/lint gates enabled; zero lint warnings |
| Fixture outputs | PASS | Product/schema/metadata checks and 48 unique www sitemap URLs; 12 synthetic collections; no real catalogue read |
| Fixture drift | PASS | Baseline established; diff has no changes. Tests detect removed sitemap URLs and changed Offer prices |
| Upstream integrity / discovery prerequisites | PASS | 467 hashes verified; 22 unique skills; 60 Python scripts syntax checked |
| Upstream strict portability | PASS | 35 skills checked; zero errors, warnings or information findings |
| Product eligibility adapter | PASS WITH OPTIONAL ADVISORIES | Sara mandatory price/INR gate passes; upstream reports three Medium and one Info findings for optional policy/delivery, loyalty and variants |
| Python runtime | READY | Python 3.13 / plugin 2.5.0 / Chromium; 93 exact dependency pins; setup preserves an existing environment |
| Python dependency advisory audit | PASS | Pip upgraded from 24.3.1 to 26.2 in the isolated environment; subsequent pip-audit reports no known vulnerabilities |
| Cursor discovery | VERIFIED | Native Customize shows 22 workspace skills; search shows `sara-product-auditor`; no second agent/login executed |
| Codex discovery | VERIFIED | Fresh session advertised all 22 skills and loaded `sara-seo-regression` |
| Integration secret-pattern scan | PASS | 57 files; zero potential secret files; narrow integration-only scan |
| Google private integrations | UNVERIFIED | Existing resource IDs and authorized reporting access missing; no credential discovery or Google resource writes |
| Core Web Vitals / mobile lab performance | UNVERIFIED | Credential-free PageSpeed request returned HTTP 429; no field or lab pass inferred |

## Repository-wide suite comparison

The initial full `npm test` run passed 818 of 874 tests and failed 56. A read-only
comparison reran the same tests with HEAD contents substituted for the 16 modified
production TypeScript files in memory. It reproduced 54 of those failures; the
two others expected the old apex email origin. Those assertions now expect www.
The comparison also failed four new canonical-origin expectations, as expected
against the old HEAD implementation. No working file was reverted or replaced.
The final full rerun passed 820/874 and failed 54. All 54 remaining failure names
occur in the HEAD source comparison; there are no current-only failures.

Existing failures include a missing `useCallback` React harness stub, old auth
access assumptions, catalogue query/projection fixtures and checkout/scraper/import
fixture expectations. They are separate from the passing SEO suite. This report
does not claim a green repository-wide release gate. The final rerun and comparison
are recorded in `.seo-local/fix-all-tests.log` and `head-comparison.json`.

## What changed and how it was checked

`lib/public-page-data.ts` supplies server-rendered public data using the existing
visibility/name-selection, response schemas, brand precedence and pricing rules.
It restricts fields and rebuilds public raw metadata; a test excludes private
operational fields. Interactive clients retain the supplied content when catalogue
APIs are unavailable. The all-public-template browser checks confirm actual built HTML,
hydrated content and JavaScript-disabled visibility rather than source strings alone.

Both Sara hosts now resolve to www through shared origin handling. The apex
redirect preserves paths. Product markup no longer claims a generic two-day return
window, mail returns or unverified calendar delivery ranges. Existing shipping
fees and visible policy link remain. Optional Merchant enrichment needs confirmed
business facts; upstream optional-field diagnostics are not waived eligibility
tests or instructions to invent policies.

Sitemap catalogue failures now throw instead of publishing a partial success.
Store/article strict reads fail explicitly, while ordinary page fallbacks remain.
The synthetic build opens no database connection, reads no environment-file values,
and denies provider access. Settings/store fallbacks are intentionally exercised;
synthetic article/store records do not certify live completeness or business facts.

## Evidence and limits

All evidence is local and ignored: `.seo-local/build.log`, `build-result.json`,
`local-render.json`, `fix-seo-tests.log`, `fix-types.log`, `head-comparison.json`,
`cursor-discovery.json`, `installation-validation.json`, `drift/`, `fixtures/`,
`performance/summary.json` and `runtime/dependency-audit.json`.

The all-image migration adds `all-image-lint-before.json`,
`all-image-lint-after.json`, `all-image-types.log`, `all-image-seo-tests.log`,
`all-image-full-tests.log`, `all-image-pricing-tests.log`, `image-migration-result.json`
and `site-image-layout.json`. All 54 final full-suite failure names match the earlier
baseline. The isolated loader now transpiles local `.mjs` modules for its VM, and
manufacturer SSR tests use the application's real Next image configuration.
Image fixtures use synthetic SVGs and intercepted `.invalid` URLs, with no external
image requests. The layout comparison includes natural size, maximum height, fixed
size, CSS aspect ratio, responsive width, fixed height, explicit dimensions, one
explicit dimension and inline sizing. No live optimization savings are claimed.

The earlier live sample checked seven public pages and inspected 1,315 sitemap URLs. It
observed apex canonicals after www redirects and API-dependent missing headings,
empty products and false Not Found states. That evidence predates these local
fixes. The later full crawl fetched all 1,315 sitemap URLs; see the full public
audit for final findings and the owner's 16-link exclusion. Live remediation and
indexing must be checked after deployment.

Version pins are for the verified Windows Python 3.13 environment, without wheel
hashes or independent signed provenance. A clean advisory audit is time-specific,
not proof of absolute safety. Native PDF support was not certified. JSON drift is
synthetic and local, without SQLite or a scheduled live crawler. Browser checks
block images/fonts and auxiliary APIs, so they establish primary-content resilience
rather than visual quality, shopping flow correctness or CWV.

No live product/store data, tracking tags, private Google resources, Merchant
uploads, Business Profile edits, indexing submissions or deployment were changed.
