# Google Merchant API integration

The Google Merchant panel in `/admin/catalogue-quality` previews and submits batches of up to five publicly selected, active, in-stock products. It uses Merchant API **v1**, not the retired Content API. Full-admin authorization is required for preview and submission.

Metadata imports in `/admin/products` format names in both preview and saved updates: `APPLE IPHONE 15 (128GB) BLACK` becomes `Apple iPhone 15 (128GB) Black`. Brand classification, item numbers, existing URLs and manufacturer identifiers retain their original values. Existing database products are not renamed automatically.

## Operator setup

1. Verify and claim the public Sara website in the existing Merchant account. Review business identity, free-listing eligibility, actual tax-inclusive prices, serviceable locations, shipping charges/times and return policy.
2. Enable Merchant API in the owner-controlled Google Cloud project and complete Google's developer-registration prerequisites. Create/review an **online primary API data source** with India included in its countries and English/IN locale. Avoid parallel overlapping XML and API sources; this integration refuses to move products from another source.
3. Obtain dedicated OAuth credentials and an offline refresh token with `https://www.googleapis.com/auth/content`, using an authorized principal with access to the intended Merchant account. Do not reuse customer login or Business Profile tokens. Follow the official consent flow outside chat; never paste secrets into chat or the admin panel.
4. Configure the following server-only values in `.env.local` locally and the hosting provider's protected environment for deployment. Never modify `.env` or create extra environment files. Obtain/store credential material outside the OneDrive project with appropriate per-user access restrictions.

| Variable | Purpose |
|---|---|
| `GOOGLE_MERCHANT_ACCOUNT_ID` | Numeric existing Merchant account ID |
| `GOOGLE_MERCHANT_DATA_SOURCE_ID` | Numeric existing primary API source ID |
| `GOOGLE_MERCHANT_FEED_LABEL` | Existing item feed label; defaults to `IN` |
| `GOOGLE_MERCHANT_CLIENT_ID` | Dedicated authorized OAuth client ID |
| `GOOGLE_MERCHANT_CLIENT_SECRET` | Server-only client secret |
| `GOOGLE_MERCHANT_REFRESH_TOKEN` | Server-only offline OAuth token |
| `NEXT_PUBLIC_SITE_URL` | Canonical public HTTPS website origin |
| `SESSION_SECRET` | Existing session secret also signs short-lived previews; `NEXTAUTH_SECRET` is the existing fallback |

No credential values, resource claims, data-source creation or configuration changes are performed by this implementation. Configuration presence is not proof of authenticated account access.

## Review and submission

Open Catalogue quality and choose **Preview active, in-stock products**. Inspect each item's exact Google request, fix reported data issues through the existing product workflow, and refresh the preview. Missing identifiers are not automatically marked nonexistent, and SKU is never substituted for MPN. An explicit `identifierExists=false` product assertion can represent genuinely identifier-free products; confirm manufacturer facts before setting it. The current UI does not set that assertion automatically.

The initial integration supports new stock. It blocks images outside HTTPS, placeholder URLs, `/api/` images, and products whose only images exist in specification records; review the existing product image fields without duplicating assets unnecessarily. It blocks competitor-directed descriptions rather than silently rewriting product data. Current stock and money remain server-authoritative.

After reviewing the batch and actual shipping/returns settings, select the confirmation checkbox and **Send reviewed products to Google**. The server verifies a signed preview bound to the admin, account, source, selected IDs and exact request payload. Previews expire after ten minutes. Current product facts and availability are re-read before submission. Changes require a new review.

Google source type/country/language and existing product ownership are checked before the first write. The insertion operation can create or update products within the configured source. It does not delete products, create resources, claim domains, change policies or run on a schedule. A product becoming inactive/out of stock later is not automatically removed or updated in Google; use a separately authorized lifecycle workflow before expanding beyond this manual initial launch.

Successful insertion means Google received the input, not that the listing is approved. Inspect Merchant Center processing and item/account diagnostics. A provider rejection or uncertain network outcome stops further writes in that batch. Check unknown outcomes in Merchant Center before retrying. Downloading the batch preview preserves the exact request data without tokens for operator review.

## API endpoints

- `GET /api/admin/google-merchant?offset=0`: read-only, five-item paginated preview and configuration names/status.
- `POST /api/admin/google-merchant`: `{ "token": "signed-preview-from-GET", "confirmed": true }`; accepts no client-supplied prices, product payloads or account IDs.

## Verification

`npm run test:merchant` runs isolated formatter, product-input, authorization, preview-binding, stale-data, source-ownership and uncertain-request regressions without real database or Google calls. The implementation passed TypeScript checks, 14 focused Merchant/brand/route tests, and six existing metadata import tests. Build and lint were skipped at the owner's request. The broader import suite has 15 failures outside these metadata assertions, reproduced with the committed metadata implementation; it is not reported as passing. No authenticated Google connection or live browser submission has been verified.

Official references checked during implementation:

- https://developers.google.com/merchant/api/reference/rest/products_v1/accounts.productInputs/insert
- https://developers.google.com/merchant/api/reference/rest/products_v1/accounts.productInputs
- https://developers.google.com/merchant/api/reference/rest/datasources_v1/accounts.dataSources
- https://merchantapi.googleapis.com/$discovery/rest?version=products_v1
- https://support.google.com/merchants/answer/7052112?hl=en
