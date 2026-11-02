---
name: sara-merchant-sync
description: Prepare preview-only Sara Merchant API synchronization plans and compare Merchant exports with the public feed and product markup by SKU.
---

# Sara Merchant synchronization preview

Read `../../../documents/seo/GOOGLE-API-SETUP.md` for authorization and account prerequisites,
and `../../../documents/seo/CLAUDE-SEO-INTEGRATION.md` for the execution contract.
Use the current Merchant API, not DataForSEO's similarly named marketplace API.
The latter reports Shopping search intelligence and cannot synchronize Sara's account.

Require the Merchant account ID, verified/claimed website, data-source ID and type,
target country/language, feed label, existing item-ID convention, account permissions
and current API availability. Do not infer these from a public feed. Run
`python scripts/seo/google-preflight.py` to check configuration shape only;
it proves neither credentials nor access. Use authenticated read requests only
after the owner supplies an approved credential mechanism and permits that access.

Compare a sanitized authorized export with `/feed/google-merchant.xml` and initial
Product HTML: stable SKU/item ID, URL, title, brand, identifier validity, price,
currency, availability, images, shipping and return policy. Preserve existing IDs
and data-source ownership. Flag stale feeds, duplicate products and conflicting sources.

Produce a diff of proposed inserts/updates/deletions, rejection reasons, affected
IDs, expected price/stock values, request count and rollback approach. The name
"sync" does not authorize writes. Do not upload a feed, call productInputs insert,
delete products, claim a website, change shipping rules or schedule synchronization.
Present the exact preview and obtain explicit approval before any Google write.
Any database/catalogue change requires telling the user and separate approval first.
Store raw exports in `.seo-local/`; no credentials or customer data in reports.
