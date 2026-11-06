# Google Merchant readiness — Sara Stores

Checked 2026-11-06. **Verdict: the public feed exists, but the full catalogue is not ready for submission.** Merchant Center can be set up while the product-data issues are resolved. Free listings are a useful acquisition channel, but acceptance does not guarantee impressions or sales.

## Evidence and scope

- Public feed: https://www.sarastores.com/feed/google-merchant.xml — HTTP 200, valid parseable RSS/XML, 3,521,182 bytes.
- All 1,459 exported items were inspected for the fields and counts below. This is the feed population, not a count of every admin/database product.
- Live robots rules permit public product pages and this feed. `/admin` is blocked appropriately.
- One product landing page and the published shipping and returns pages were fetched; all returned HTTP 200. The product has one H1, indexable metadata, a clean canonical, and initial-HTML Product JSON-LD. Its INR 19,499 offer and in-stock availability match the feed's effective sale price and availability.
- Twelve isolated SEO/brand regression tests passed. They do not establish every live product's accuracy or Merchant acceptance.
- No build or lint ran. No live database access, order/payment test, authenticated Google access, submission, scheduling, deployment, or application code change occurred.
- Raw public evidence: `.seo-local/merchant-readiness/` (ignored local files). Source review covered the feed, product metadata/schema readers, catalogue selection and quality checks, and policy routes.

## Live feed findings

| Observation | Count | Implication / proposed action |
|---|---:|---|
| Exported products | 1,459 | Feed exists; unique item IDs have no duplicates in this snapshot. Preserve IDs across updates. |
| In stock | 196 | Prioritize verified, purchasable items for initial launch. |
| Out of stock | 1,263 | Valid availability value, but these items will not provide the same purchase opportunity as stocked products. Reconcile with actual inventory. |
| GTIN supplied | 0 | Establish genuine manufacturer identifiers for the initial launch items. Missing from this feed does not prove none exist in the original records. |
| `identifier_exists=no` | 1,459 | The exporter treats missing stored identifiers as proof the product has none. For branded electronics, verify manufacturer-assigned identifiers before asserting this. Google warns that `no` can cause disapproval when identifiers exist. |
| MPN equals internal item ID | 1,459 | Code falls back to SKU, e.g. `T019607`. An internal SKU is appropriate as `g:id`, but is not evidence of a manufacturer part number. Remove the fallback in a proposed code change; use only a genuine MPN. |
| Descriptions mention Flipkart, Amazon, Croma or Reliance Digital | 827 | Google specifies product-only descriptions without competitor information. Review and replace retailer-directed copy with accurate Sara product descriptions. Example `T018855` ends with “shop at Flipkart”. |
| Titles contain capitals and no lowercase letters | 1,445 | Google says not to use all-capital titles. Apply readable capitalization while preserving brand/model spelling and exact variant details. |
| Description exceeds 5,000 characters | 1 | The generic description path is truncated, but the `seoDescription` path is not. Enforce the limit consistently. |
| Item-level shipping supplied | 0 | Not independently a failure: shipping can be configured in Merchant Center. Verify account shipping charges, serviceable locations and delivery times against the actual checkout and published policy. |

All exported items have a brand. Main image URLs are syntactically HTTP(S), with no detected placeholder markers or `/api/` URLs. Actual image fetchability, resolution, visual correctness and usage rights were not verified. Images are hosted on third-party retailer/CDN domains; verify reliable access and permission to use them.

Example checked: SKU `T019607`, MOTOROLA G37 (4GB+64GB) PANTONE NAUTICAL BLUE.
https://www.sarastores.com/product/motorola-g37-pantone-nautical-blue-64-gb-6ae42959e0a4b8aa4ec086a5

The feed links use the apex `sarastores.com` host and redirect successfully to `www.sarastores.com`, which is canonical. Align feed URLs with the canonical public origin during the proposed feed changes.

## Source-level risks to resolve

1. `app/feed/google-merchant.xml/route.ts:152` substitutes SKU for missing MPN, and line 153 derives `identifier_exists` solely from loaded fields.
2. The feed projection omits many legacy/raw identifier keys recognized by `lib/product-attributes.ts`. It also omits specification-image sources used by `lib/seo-product.ts`. Products may lose existing identifiers or be excluded for missing top-level images despite having page images. Reuse consistent read-only mappings; do not duplicate or rewrite records just to satisfy the feed.
3. Feed stock uses `Number(product.stock) > 0`; product pages use `isProductUnavailable`, which also considers purchase restrictions and `inStock=false`. The checked item agrees, but all-item agreement is unverified.
4. The feed emits `condition=new` for every item. Confirm the launch selection contains only new stock or map actual conditions explicitly.
5. The optional warranty `product_detail` is emitted as scalar text instead of structured subelements. No current exported item contains it, so this is a latent formatting risk.
6. The feed can serve stale content through its cache policy. Check acceptable refresh times for fast-moving prices and stock; a scheduled Google fetch cannot by itself guarantee immediate updates.

The existing `/admin/catalogue` page manages categories, subcategories and brands. Products are managed under `/admin/products`; `/admin/catalogue-quality` provides a useful internal review. Its “ready” status is not a Google approval verdict.

## Merchant Center status

Local configuration-only preflight reports the Merchant account ID and data-source ID missing/unidentified, and access unverified. This does **not** prove the owner has no Merchant account or that its shipping rules are absent. No account was opened or queried.

For a scheduled XML fetch, a custom Merchant API integration is not required. Confirm business information, the verified/claimed website, India/English destination settings, shipping and return policies, and free-listing eligibility in the actual account. Check for existing data sources before adding another to avoid duplicate/conflicting products.

The public shipping policy is at `/shipping-policy`; returns are at `/returns`. Their reachability was verified, but business accuracy and account-policy agreement require operator confirmation. Full checkout, serviceability, final tax-inclusive pricing and payment completion remain unverified.

## Recommended launch sequence

1. Select a small group of the 196 stocked products with confirmed exact variants, manufacturer identifiers, pricing, images and serviceability.
2. Prepare feed mapping/format fixes and truthful copy changes. Keep item IDs stable. Review any proposed product-record changes separately before applying them.
3. Recheck initial page HTML, effective feed price, stock, image access and purchase availability for the launch selection.
4. Complete/review Merchant Center business, domain, shipping and return settings. Use a URL-based scheduled fetch when ready; API credentials are unnecessary for that method.
5. Submit the reviewed selection, inspect Google's item/account diagnostics, resolve disapprovals, and expand once the initial listings are accepted. Account approval is a separate Google decision.

## Official reference

Google's product-data specification was fetched during this audit:
https://support.google.com/merchants/answer/7052112?hl=en

It requires accurate landing-page agreement, stable IDs, truthful identifiers, product-only descriptions, appropriate capitalization, crawlable exact-product images, and applicable shipping/checkout compliance. Optional marketing recommendations and internal catalogue checks must not be presented as universal Google requirements.
