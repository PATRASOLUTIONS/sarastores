---
name: sara-google-analytics
description: Prepare authorized GA4 Data API reports for Sara organic landing pages and ecommerce measurement; distinguish setup, access and data quality.
---

# Sara GA4 reporting

Read `../../../documents/seo/GOOGLE-API-SETUP.md` and
`../../../documents/seo/CLAUDE-SEO-INTEGRATION.md`. Use
`../../../.seo-tools/skills/seo-google/references/ga4-data-api.md` for methodology.

Require a numeric GA4 property ID (not the G- measurement ID), property access,
enabled Data API, analytics.readonly scope, date range, property timezone and currency.
Use a dedicated read-only credential; do not reuse storefront login OAuth implicitly.
Run `python scripts/seo/google-preflight.py`; missing config is an access blocker,
not zero traffic. Prepared request bodies live in `scripts/seo/google-requests.json`.

Validate dimensions/metrics against current GA4 metadata before requesting reports.
Start with Organic Search landing pages, sessions, active users and engagement;
assess ecommerce events such as view_item, add_to_cart, begin_checkout and purchase
from authorized aggregate exports. Check duplicate purchase transaction IDs,
missing item IDs, INR revenue consistency, consent effects and data thresholds.
Do not send synthetic events to the real GA4 property.

Report date/timezone, channel definition, property-level scope, sampling/thresholding,
freshness and quota limitations. Do not equate sessions to Search Console clicks.
Do not fabricate AI referral splits or report unavailable data as zero.
Do not add tracking tags, change consent controls, create custom dimensions or
edit Google property configuration under this integration. Any database change
requires telling the user and separate approval. Keep raw results in `.seo-local/`.
