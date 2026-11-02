---
name: sara-product-auditor
description: Audit Sara product pages, metadata, JSON-LD and Merchant feed consistency using public pages or synthetic fixtures; produce evidence and proposed fixes.
---

# Sara product audit

Read `../../../documents/seo/CLAUDE-SEO-INTEGRATION.md` and the existing
`../../../.github/skills/seo/SKILL.md`. Use the original methodology in
`../../../.seo-tools/skills/seo-ecommerce/SKILL.md` and `seo-schema/SKILL.md`.

Trace the shared readers in `lib/seo-product.ts`, `lib/product-metadata-sheet.ts`,
`lib/product-images.ts`, `lib/product-attributes.ts`, and the real product route
`app/product/[slug]/`. Compare initial HTML metadata, visible product facts,
Product JSON-LD and `app/feed/google-merchant.xml/route.ts` by stable SKU.
Uploaded metadata brand and manufacturer can legitimately differ; use
`catalogueBrand`, not a new precedence rule. Money and stock remain authoritative
server values. Audit INR/IN; do not enable EU-only energy requirements by default.

Check Product name, crawlable image, positive Offer price/currency, canonical
slug, availability, genuine identifiers, published-review aggregates, shipping
and published returns. Do not invent reviews, GTINs, price expiry dates, delivery
promises or return windows. Missing-image/price products are findings, not permission
to repair records. Verify policy details against the visible policy, even if a fixture passes.

Run `node --test tests/seo-regression.test.mjs tests/product-metadata-brand.test.mjs`
for isolated behavior; `node scripts/seo/fixtures.mjs` exports synthetic markup
under `.seo-local/fixtures/`. Run reviewed validators through `scripts/seo/run.py`.
Upstream schema PASS alone is insufficient: its price/currency checks are advisory.
Use Sara's additional validator in `scripts/seo/audit.py`.

Return URL/SKU, source/date, severity, observed vs expected facts, proposed code/data
change and verification. Do not change database records, collections or indexes.
Tell the user about any proposed database change and obtain separate approval first.
No storefront changes or deployment under the integration authorization.
