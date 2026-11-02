---
name: sara-seo-regression
description: Run Sara SEO regressions against isolated fixtures for real metadata, product JSON-LD, sitemap, robots and Merchant behavior; report public audit limitations.
---

# Sara SEO regression workflow

Read `../../../documents/seo/CLAUDE-SEO-INTEGRATION.md` for permitted execution.

From the repository root:

1. `python scripts/seo/validate-install.py` checks the upstream pin, integrity,
   YAML, unique names and the shared Cursor/Codex discovery tree.
2. `node --test tests/seo-regression.test.mjs tests/product-metadata-brand.test.mjs`
   exercises the actual application with denied real infrastructure and synthetic data.
3. `node scripts/seo/fixtures.mjs` exports synthetic sitemap/metadata/JSON-LD.
4. `python scripts/seo/audit.py --fixtures` validates those outputs including
   positive INR offers, XML URLs, canonical metadata and explicit coverage limits.
5. With reviewed runtime dependencies installed, use
   `python scripts/seo/run.py run portability_check.py --strict --json` and the
   reviewed upstream schema/metadata validators. Upstream checks do not replace
   Sara's stricter checks or Google's account diagnostics.

For public auditing use `python scripts/seo/audit.py --public`: bounded public
GETs, no credentials, no form submissions or private routes. Browser/Lighthouse
runs and authenticated Google requests require their declared runtime/access.
Never interpret static ReportWebVitals presence or one lab run as field CWV PASS.

Run relevant security regressions and retain sanitized counts. Run explicit
TypeScript/build gates where applicable using `scripts/seo/build-check.mjs`;
its infrastructure guard prevents database connections and external provider calls.
Record failed, blocked and skipped gates accurately. Do not run seeds, migrations,
index creation, backfills or live database smoke scripts. Tell the user about
any proposed database change and obtain separate approval before executing it.
