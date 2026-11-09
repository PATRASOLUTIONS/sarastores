# Fill missing catalogue data from Excel

Open `/admin/catalogue-quality` and use **Fill missing data from Excel**. Full administrator access is required.

1. Choose **Download Excel template** to download the current catalogue with itemno, name and all available supported values already filled in; no scan is required. After a scan, **Download filtered catalogue Excel** includes the products matching the review filters, including matching products without issues. Genuine missing values remain blank.
2. Fill verified missing values in the first worksheet. Match by **itemno**. For a product missing its item number, retain its **product id** from the downloaded scan workbook and supply the verified itemno. Keep both identifiers when available. This upload updates existing products; it does not create new ones.
3. Upload the workbook and choose **Preview upload**. Review field changes, preserved fields and row errors. Existing classification may be mapped into the current hierarchy; those changes appear in the preview too.
4. Select the approval checkbox, then choose **Save missing data**. Correct all row errors before saving. Rescan the catalogue after a successful import.

Supported columns: product id, itemno, name, division, category, segment, brand, description, char desc, sub category, manufacturer name, model number, gtin, mpn, hsn code, gst rate, warranty, warranty months, images, seo title, seo description, price, mrp and stock.

Fill the blanks and remove rows you are not correcting before uploading. Downloads can include more than 500 products; upload only the rows you are correcting, at most 500 at a time. Blank cells are skipped. Populated values, including facts found in existing raw imports and linked specifications, are preserved. Existing legacy values are allowed to round-trip unchanged; validation is applied to values being filled. Existing **zero stock, zero GST and zero warranty months are valid values** and are preserved. Missing/nonpositive selling prices and absent actual MRP are blank in the download and can be filled with verified positive amounts. Existing price/stock changes belong in the Products page bulk price workflow.

Format itemno, GTIN and HSN as **Text** in Excel to preserve leading zeroes. Use values instead of formulas. Separate image URLs with semicolons; use HTTPS URLs or same-site paths. Barcodes must pass the GTIN checksum; HSN format validation does not certify the tax classification. Plain division/category/segment headers describe the storefront hierarchy. Legacy `Category/Group Name` maps to division and `sub-category/PROD DESC` maps to category, following the existing metadata-sheet convention.

Upload limits: `.xlsx` / `.xls`, **3 MB / 500 rows**, first worksheet only. Downloads read up to 20,000 selected products in bounded pages and reject changed/incomplete selections or a workbook over 4 MB, rather than returning a partial file. Duplicate columns, unknown headers, formulas, duplicate item numbers, repeated product IDs, ambiguous matches, invalid new identifiers and conflicting product-id/itemno pairs are rejected.

Preview performs read-only catalogue/specification queries. Saving re-reads the products and specifications inside one MongoDB transaction and compares them to the approved preview. A changed workbook/catalogue requires a new preview. A failed save rolls back the entire upload; MongoDB replica-set/sharded-cluster transaction support is required. Raw import mirrors and specification records are not rewritten. No live migration, provider action or deployment is performed by this workflow.

Run isolated checks with `npm run test:catalogue-quality`. Tests cover actual Excel parsing, identity lookup, missing-value preservation, approval binding, full-admin authorization and transaction rollback without using the configured database.
