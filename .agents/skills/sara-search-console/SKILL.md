---
name: sara-search-console
description: Prepare authorized Sara Search Console performance, URL Inspection and submitted-sitemap analyses without changing indexing or Google resources.
---

# Sara Search Console

Read `../../../documents/seo/GOOGLE-API-SETUP.md` and
`../../../documents/seo/CLAUDE-SEO-INTEGRATION.md`. Require an accessible verified property
(`sc-domain:sarastores.com` or the exact URL-prefix property), enabled API,
webmasters.readonly scope and explicit owner-approved reporting access.
Run `python scripts/seo/google-preflight.py` for shape/presence only.

Use `scripts/seo/google-requests.json` as read-request templates. Review
`../../../.seo-tools/skills/seo-google/references/search-console-api.md`.
Query site totals separately from dimensioned query/page rows: anonymized queries
and row limits can undercount totals. Specify search type, dates, timezone and
pagination. Analyze product/category/brand/store URL groups and opportunity queries.
Do not request unsupported AI search types based on upstream prose.

Use URL Inspection on a bounded sample to compare Google-selected and user-declared
canonicals, fetch/index state and robots restrictions. Inspection is of Google's
indexed version, not a live Rich Results Test. Sitemap submission counts do not
prove indexed counts. Respect API quotas; do not continuously retry an access failure.

Save raw query/export data in `.seo-local/`; sanitize reports for accidental PII.
Do not submit/delete sitemaps or notify Indexing API/IndexNow. Google's Indexing API
is not a general product indexing service. No website or database changes;
tell the user about proposed database changes and obtain separate approval first.
