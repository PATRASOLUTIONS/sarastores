# Bulk scraper and price imports

## Scraper (`/admin/scraper`)

Choose **Download Excel template**, replace the sample row, then **Upload Excel**.
The first worksheet must contain these headers:

| itemno | name | category | sub category | char desc | brand | product link |
| --- | --- | --- | --- | --- | --- | --- |
| REFSAM1187 | Example refrigerator | Refrigerators | Double Door | Example model | Samsung | https://www.amazon.in/dp/B000000000 |

The sample link is a placeholder: replace it with a real product listing.
All fields except `char desc` are required. Format item numbers as **Text** in Excel
to preserve leading zeroes. Imports accept `.xlsx` / `.xls`, up to **500 rows / 3 MB**.
Invalid metadata, unsupported links or duplicate item numbers block the entire
queue before any scraping or database writes. These errors automatically open an
**Edit uploaded Excel sheet** popup showing the uploaded values and all columns,
including extra columns. Invalid rows/cells are highlighted with their original
Excel row numbers and full error details (including unsupported product links).
Select an issue to jump to its page; all rows are accessible in 25-row pages.
Edit cells directly, then choose **Validate & use sheet** to recheck every row and
prepare the corrected queue without re-uploading. Missing template columns appear
as editable blanks. Closing the editor keeps the draft; **Edit uploaded sheet**
reopens it. Editing clears the old queue until the corrected sheet is validated.
Only **Run Scraper** starts scraping. File-size/row-limit or unreadable-file errors
still require a corrected upload. The template uses the same sources
as the single-item scraper: Amazon, Flipkart, LG India, Pai International,
Reliance Digital, Vijay Sales and Bosch Home.

Uploading only prepares a queue. **Run Scraper** asks for confirmation, then
processes rows sequentially through the existing source scraper. The spreadsheet
owns item number, name, category, sub-category, characteristic description and
brand; scraped values cannot replace those fields. Scraping supplies copy, images,
features, reviews and technical specifications.

Each successful row atomically saves its product and `product_specifications`
record, marking the specification `isSynced: true` (auto-approved) and the product
active. Both appear in the existing Products / Product Specifications pages; no
second approval or sync click is needed. Existing prices, MRP, stock and slugs
are preserved. **New products start with zero stock**, not the retailer's stock
estimate; their price/MRP use the source when available, otherwise zero. Use Bulk
Price Update to supply the store's price, MRP and stock before selling them.
When every queued row succeeds, the page automatically opens `/admin/products`.
If any row fails or remains pending, it stays on the queue to show the results.

The admin Products table loads the complete catalogue in authenticated, bounded
pages, including inactive products. Search, category/sub-category filters and
counts operate on that complete list; newly scraped items are not limited to the
first 500 database records. The metadata template export uses the same paginated
loader rather than an oversized limit that the API would silently cap.
If the catalogue changes during loading or a page fails, the page reports an
error instead of treating a partial list as complete. Reload to retry.

The queue reports each row's outcome and continues after errors. Locked
specifications and ambiguous item numbers are rejected without changing either
record. A failed product/spec save rolls back the whole row. **Retry failed / run
pending** skips successful rows; retries use the same item number rather than
creating another product. Concurrent imports of the same item may return a
retryable conflict. MongoDB transactions require a replica set or sharded cluster;
unsupported transactions fail explicitly rather than leaving half-saved records.

Keep the page open: this is a browser-driven queue, not a background job.
**Stop after current item** lets the active request finish and leaves the rest
pending. Navigating away stops subsequent requests; reloading clears the queue.
Successful database saves remain. Bot checks, unavailable source pages and missing
source data cannot be bypassed by a bulk import. The existing single-item review
and PDF workflow remains available separately.

## Price, MRP, stock and customer visibility (`/admin/products`)

Open **Bulk Price Update**, then **Download active products Excel**. This downloads
`active-products-price-mrp-stock.xlsx` containing the current values for **every
customer-visible product** (`active === true`), not just the displayed table page,
search results or category. Inactive products are excluded. It no longer downloads
dummy example rows. The workbook uses this format:

| itemno | price | mrp | stock | active |
| --- | --- | --- | --- | --- |
| REFSAM1187 | 25000 | 30000 | 5 | active |

Edit `active` to **inactive** to hide a product from customers, or **active** to
show it. Existing product rows can also be added to the upload to reactivate
them. Preview displays old/new customer visibility before confirmation. Boolean
`true` / `false` and numeric `1` / `0` equivalents are also accepted.

`itemno` and `price` are required. `mrp`, `stock` and `active` are optional: omitted
or blank cells preserve the stored values. **Stock `0` explicitly marks an item out of
stock.** Price and supplied MRP must be positive finite amounts no greater than
10,000,000; stock must be a whole number from 0 to 1,000,000. Selling price must
not exceed the supplied MRP (or stored MRP when omitted). Currency symbols and
commas in amount cells are accepted.

The export preserves actual zero values and leading-zero item numbers. Missing
money/stock is exported blank rather than fabricated. Correct missing/zero prices
to valid positive amounts before uploading. If there are no active products, or
an active product has a missing/duplicate item number, the download reports an
error instead of silently exporting an incomplete or ambiguous file.

Preview shows old/new price, MRP, stock and visibility and any row validation errors. Confirm
applies all supplied fields for a row in one atomic update, never a price-only
partial update when its MRP/stock/visibility is invalid. Valid rows are applied even if other
rows are invalid; the result reports failures. Concurrent changes during execution
reject that row and require a fresh preview. Ambiguous product matches are
rejected. Repeated item numbers retain the existing last-row-wins behavior.

Existing two/four-column price files and Google Sheet price sync remain supported;
Google Sheets can also include the optional `mrp`, `stock` and `active` columns. The existing
10 MB / 50,000-row price import limits remain unchanged. Preview never writes.
All scrape/publish and price import endpoints require an admin session.

## Isolated regression checks

`node --test tests\bulk-catalog-import.test.mjs` tests actual parsing, publishing
and price-update code with fixture transactions/collections, without contacting
source retailers, the configured database or payment providers.
