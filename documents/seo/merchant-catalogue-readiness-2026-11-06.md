# Sara Merchant catalogue readiness — 6 November 2026

Bytewise Consulting development handoff for Sara Stores.

## Result

The configured catalogue contains 2,446 products and 2,442 specification records. The read-only scan selected 1,471 public product representatives and 196 active, in-stock candidates. All 196 candidates lack a recorded manufacturer GTIN or MPN, including the matched specification records. No candidate can yet be presented as verified Merchant-ready.

The first scan also flagged competing-retailer copy in 149 candidate descriptions. The code now removes the imported “Buy … online at best price …” and “Compare … to shop at Flipkart” sentences while preserving intervening product facts. It still blocks unresolved shopping references. This is output cleanup; original database descriptions and names have not been changed.

The second read-only scan at 08:28 UTC confirmed that all 149 retailer-copy flags are resolved in the generated Merchant content. Its only remaining validation blocker across these 196 candidates is missing manufacturer identifiers. The completed supplier verification worksheet contains 196 rows, with identifier and verification-source gaps left explicit.

The downloaded public feed contained 1,459 items, including 196 marked in stock. It currently substitutes SKU as MPN and declares absent identifiers nonexistent. The deployed feed remains unchanged; the corrections in this checkout have not been deployed. Public-feed and database reads occurred separately and do not constitute a transactional snapshot.

The offline comparison found all 196 candidate offer IDs in that saved feed, with no effective selling-price or availability mismatches. For 179 items the old feed's base price differs from the selling price and its `sale_price` matches the catalogue; this is not an effective price discrepancy. The new mapping exports the selling price directly without inferring sale promotions from MRP. Repeat the saved comparison with `python scripts/seo/compare-merchant-audit-feed.py`.

## Completed code setup

- `/admin/catalogue-quality`: full active/in-stock audit, progress, readiness totals and downloadable supplier verification CSV; existing five-product, explicitly reviewed submission remains separate.
- XML and Merchant API share title formatting, description cleanup, brand authority, checksum validation, identifiers, image selection and INR selling-price rules.
- Internal IDs remain offer IDs and are never used as manufacturer MPNs. Missing identifiers never imply `identifier_exists=no`.
- Recorded selling price is exported directly. Above-MRP conflicts block export rather than rewriting money. Unsupported shipping promises and HSN-as-Google-tax-category mapping are removed.
- Known zero-stock products can remain `out_of_stock` in the XML feed. The initial admin submission workflow selects active, positive-stock products only.
- Duplicate offer IDs, incomplete facts and unsupported conditions block submission. The API checks the actual offer-ID precedence again before sending.
- An empty validated feed returns HTTP 503 with no-store instead of a successful empty catalogue. This prevents an empty successful refresh from clearing an existing Google catalogue. **With the current missing identifiers, the corrected feed will be unavailable after deployment until verified records exist. Resolve identifiers before enabling Google fetches.**

## Exact next steps

1. Open the generated local worksheet at `.seo-local/merchant-catalogue-audit/supplier-verification.csv`, or run the full audit in `/admin/catalogue-quality` and download its supplier sheet. Raw catalogue reports remain local and excluded from publication.
2. Ask the Sara inventory/supplier team for the barcode/GTIN and manufacturer part number for each exact colour, capacity and model variant. Preserve GTIN leading zeros by importing its CSV column as **text**. A model reference is a research hint, not evidence of a manufacturer MPN.
3. Fill the verified manufacturer/supplier source column. Check checksum, exact variant assignment, title, image, rights, price and stock. Do not mark branded electronics as lacking identifiers simply because the spreadsheet is empty.
4. Present the resulting record-ID/field/before/after/source correction preview to the owner for separate catalogue-write approval. The audit and CSV do not apply database updates. The ordinary six-column metadata naming sheet is not an identifier-import workflow.
5. Re-run the read-only audit after approved corrections. Check representative product pages and downloaded XML against the same SKUs; confirm visible prices, availability and policy URLs. Image URLs have been inspected syntactically but not fetched during this audit.
6. Configure `GOOGLE_MERCHANT_ACCOUNT_ID`, `GOOGLE_MERCHANT_DATA_SOURCE_ID`, `GOOGLE_MERCHANT_CLIENT_ID`, `GOOGLE_MERCHANT_CLIENT_SECRET` and `GOOGLE_MERCHANT_REFRESH_TOKEN` in protected local/hosting configuration. All five were missing during this audit. Do not send secrets in chat or worksheets.
7. In Merchant Center, confirm authorised account access, the verified/claimed canonical Sara website, India/English targeting, an online primary API data source with the existing item-ID convention, and accurate shipping/returns settings. These account facts have not been verified here.
8. Deploy and verify the corrected feed only after ready records exist. Choose the existing intended data source; avoid adding a competing source that owns the same IDs. Do not schedule a second uncontrolled feed importer.
9. Review the exact first five-product preview in the admin panel, then explicitly approve that batch. The server rechecks facts and ownership before making Google writes. Download the preview for rollback/review. On an ambiguous provider timeout, check Google before manually retrying.
10. Inspect Merchant processing/diagnostics after submission and resolve actual rejections before reviewing subsequent batches. Google acceptance and listing approval are separate; this audit does not guarantee either.

## Validation and limitations

`npx tsc --noEmit` passed. The focused Merchant, metadata-brand, public-catalogue and SEO regression suites passed all 26 tests; the API route-guard regression also passed (27 tests total). Build and lint were skipped at the owner's request. No database records, indexes, Google settings or Merchant products were changed. No browser/customer checkout smoke test, image-rights verification, supplier verification or authenticated Merchant read was performed.

Read-only repeat command: `node --env-file=.env.local scripts/merchant-catalogue-audit.mjs`. It reads only products/specifications and writes local audit JSON and CSV. Configure missing names using [the integration guide](GOOGLE-API-SETUP.md).

The [Sara Merchant skill](../../.agents/skills/sara-merchant-sync/SKILL.md) requires: “Present the exact preview and obtain explicit approval before any Google write.” It also requires separate approval for database/catalogue changes. The current preview contains zero verified write-ready products, so there is no Google write batch to approve yet.
