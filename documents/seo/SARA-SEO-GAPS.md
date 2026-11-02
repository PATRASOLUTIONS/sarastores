# Sara SEO gaps: implementation and remaining verification

Updated 2026-11-02 after the owner's “fix all the gaps” instruction. SEO code and
repository configuration fixes are implemented locally; they are not deployed.

The later all-public-pages review expands coverage to 44 indexable templates and
a complete 1,315-URL live sitemap crawl. See
[FULL-PUBLIC-SEO-AUDIT.md](FULL-PUBLIC-SEO-AUDIT.md) for the current assessment,
remaining live failures and expanded rendering/content/store/blog fixes.

## Implemented fixes

| Gap | Result and evidence |
|---|---|
| Public content depended on robots-blocked APIs | Home, products, product detail, category, subcategory, brand/manufacturer, campaign and software pages now receive server-loaded public data. Loading boundaries hiding catalogue content without JavaScript are removed. The full public audit records final runtime coverage. |
| Redirect/canonical host disagreement | Sara origins normalize to `https://www.sarastores.com`; shared metadata, sitemap/feed origins and the apex redirect align. Preview/local origins remain usable. Source tests cover host normalization and redirect preservation. |
| Sitemap silently published partial results | Catalogue-source failures now throw; store/article loaders support strict sitemap reads. Normal storefront fallback behavior remains intact. Tests exercise failures. All current live sitemap URLs are crawled; comparison with underlying catalogue totals remains unverified. |
| Product policy invented blanket promises | Removed the generic two-day return window, ReturnByMail, and calendar handling/transit estimates. Markup retains published policy URL and shipping fees from existing settings. Business facts must be confirmed before adding optional policy/delivery details. |
| Upstream eligibility diagnostics could still PASS invalid offers | The reviewed adapter runs mandatory Sara checks first. Missing, boolean, nonpositive or nonfinite prices and missing INR currency fail. An adversarial adapter test proves missing price cannot reach an upstream PASS. |
| Dependency versions floated | First-install setup uses 93 exact Python package pins. Isolated pip upgraded to 26.2; subsequent pip-audit found no known vulnerabilities. Upstream source remains pinned and unchanged. |
| Cursor skill discovery was unverified | Native Customize showed 22 workspace skills; search displayed `sara-product-auditor`. Codex discovery was also observed in a fresh session. |
| Drift required SQLite | Local JSON baseline/diff now compares synthetic metadata, schemas and sitemap URLs without creating a database. Unchanged baseline produces an empty diff; tests detect removed URLs and changed prices. |
| Validation could report success with incomplete evidence | Public audit failure exits, strict price/currency checks, robots longest-match handling, browser request boundaries and isolated build guards have regression coverage. |
| Heuristic advice appeared authoritative | Upstream scores, loyalty/variant suggestions and content-length advice remain labeled advisory; they do not establish Google eligibility or ranking requirements. |

## Remaining external verification

| Need | Current status / next input |
|---|---|
| Search Console, GA4, Merchant and GBP | Unverified. Existing resource IDs and authorized reporting access are required; no credentials were discovered or accounts provisioned. See GOOGLE-API-SETUP.md. |
| Field CWV and mobile lab performance | Public PageSpeed returned HTTP 429. The local collector separates URL/origin p75 LCP/INP/CLS from lab metrics; it reports UNVERIFIED until approved quota or an export is available. |
| Actual policy and store facts | Confirm the visible 48-hour defect-reporting rule, delivery working-day estimates and current store information. Optional Merchant policy/delivery enrichment remains incomplete rather than making unsupported promises. |
| Live deployment/indexing/Merchant acceptance | Local fixes need deployment under the owner's release process, then public verification. No index submission, Merchant synchronization or GBP write ran. Fixture tests do not certify every live SKU, GTIN, price, stock or review. |
| Full application regression suite | 820/874 tests pass; 54 failures all reproduce against HEAD production sources. The dedicated SEO suite passes, but the repository-wide release gate is not green. See the testing report for comparison and scope. |

The dependency lock pins versions for the verified Windows Python 3.13 runtime;
it does not lock wheel hashes, prove signed artifact provenance, or certify native
PDF support. Drift coverage is synthetic and local, not scheduled live monitoring.
A valid Product Offer is not Merchant approval or a Google Rich Results Test.

See SEO-TESTING-REPORT.md for measured results. Evidence remains ignored under
`.seo-local/`; reports remain under `documents/`, outside the public deployment.
