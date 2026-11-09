# Merchant product enrichment

Open `/admin/scraper` and use **Merchant product enrichment**. It enriches existing item numbers; the separate **Create new products from Excel** tool retains its original new-product workflow.

## Excel workflow

1. Download `merchant-bulk-scraper-template.xlsx`. The first worksheet needs **itemno** and **product link**. Your existing two-column workbooks are also supported, including Excel hyperlinks.
2. Upload up to 500 rows / 3 MB. Upload checks the dedicated saved-enrichment cache; it does not fetch product pages. Completed item numbers are marked saved and skipped, including when the existing Sara product is inactive. Repeated item numbers are processed once.
3. Choose **Run and save source details**. The server reads the supplied product page, stores its extracted details once and continues after errors. Keep the page open; **Stop after current item** stops subsequent requests.
4. Download the Merchant review CSV or all source evidence. Repeat uploads reuse completed records without fetching them again. Failed requests do not permanently claim the item number and can be retried.
5. Review identifiers against the exact colour, capacity, model and packaging/supplier evidence. Fill **verified manufacturer/supplier source** after that review. Update the catalogue through its reviewed data-maintenance workflow, then use `/admin/catalogue-quality` to validate and preview the first Google submission batch.

Source details are stored in `merchant_product_enrichments`, keyed by normalised Sara item number. The built-in unique `_id` and a five-minute claim lease prevent simultaneous imports from fetching the same item twice. Completed source records are retained. Failed saves release only their own unfinished claim. There is no scheduled rescraping.

The scraper does **not** overwrite existing Sara products, specifications, price, MRP, stock, slugs, visibility, reviews or Google listings. A saved enrichment is source evidence, not a claim that every Merchant field is complete or verified. Missing identifiers and exact-variant review stay visible. Retailer availability is an observation; it is never Sara's stock quantity. The review export reads Sara's price/stock and canonical link from a unique matching catalogue record. Missing or ambiguous matches leave those fields unavailable.

## Sources and fields

Supported sources: Amazon, Flipkart, Reliance Digital, Pai International, LG India, Vijay Sales and Bosch Home. The parser uses product JSON-LD, site-specific data, visible specification rows and labelled manufacturer attributes. It extracts title, brand, description, product images, price observations, availability, condition, model reference, genuine labelled GTIN/MPN candidates and source evidence. The full source record also retains available features, specifications, warranty, package contents and manufacturer information.

GTINs are stored as text and validated for length/checksum. An ASIN, Flipkart FSN or retailer SKU never becomes a GTIN. A model number never automatically becomes MPN. Conflicting and invalid identifiers remain visible as evidence but are not accepted. An empty identifier field never establishes that the manufacturer assigned no identifier.

Primary product JSON-LD images are preferred over unrelated recommendation galleries. When only an older unscoped gallery was captured, the Merchant candidate uses its primary image; other observed images remain in the full source record for review. Image reachability, rights and exact variants still require verification. No images are downloaded or republished by the enrichment workflow.

The template includes the Merchant review fields: title, brand, description, image URL, Sara price, stock, offer ID, GTIN, manufacturer MPN, source verification, Sara product link, currency, condition, availability and additional images. Source price/currency/availability, model reference, fetch time and remaining issues are separate. Shipping/returns, website claim, account/data-source configuration and Google processing approval remain Merchant account tasks.

## Owner-operated commands

Local source preview:

`node scripts/run-merchant-scraper.mjs --probe <workbook.xlsx> [second-workbook.xlsx]`

Run all supplied rows and store the dedicated enrichment cache:

`node --env-file=.env.local scripts/run-merchant-scraper.mjs --store <workbook.xlsx> [second-workbook.xlsx]`

Inspect selected item numbers using `--probe --items=T001,T002`. The runner supports both supplied workbooks together, at most 500 rows per file. It validates all rows before any scrape, preserves hyperlinks and skips completed items. It runs at most two source groups concurrently, sequentially within each group, with one-second pacing. Repeated explicit source refusal opens a circuit instead of repeatedly requesting blocked pages.

`node --env-file=.env.local scripts/export-merchant-scraper.mjs` reconciles the completed run against saved database enrichments and reads Sara's catalogue values into the review export. It writes local reports only. Raw results and cache JSON stay under `.seo-local/merchant-scraper/` and are excluded from publication. The database is unchanged by this export.

Source pages may omit identifiers, block requests, redirect to another region or remove a product. Such gaps cannot be solved by inventing data. The input sample workbooks remain untouched. Initial live checks succeeded for all seven supported sources; separate manufacturer probes returned a labelled LG MPN and valid-checksum GTIN/MPN values from Vijay Sales and Bosch. Those probe values are not mapped onto unrelated Sara items.

## Validation

TypeScript and the focused 27-test suite passed: identifier extraction, all six shared adapters, one-time/concurrent fetch leases, failure recovery, local export recovery, money separation, Merchant behavior and API authorization. Amazon was checked with the supplied real links. The template was exported, re-read and visually checked. Build and lint were skipped at the owner's request. The admin UI has not been tested through a logged-in browser, and no Google write was performed.
