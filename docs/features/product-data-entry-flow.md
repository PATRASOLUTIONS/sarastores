# Product data-entry flow

How a product gets from a supplier listing into the Sara catalogue.

**Admin → Catalogue → Product Scraper** (`/admin/scraper`)

---

## 1. The three steps

```
  Fetch  ──────────▶  Review  ──────────▶  Published
  SKU + link          check master data     product + specification
                      see what was found    written together
```

One screen. You never have to visit a second page to complete a product.

### Step 1 — Fetch

| Field | What to enter |
| --- | --- |
| **SAP item number** | The item number from SAP. This is the join key for everything — product, specification and storefront URL all hang off it. |
| **Product link** | Paste any supported product URL. The source is detected automatically and shown under the box. |

Press **Fetch product data**. It takes 15–60 seconds depending on the source.

### Step 2 — Review

Two blocks:

- **Master data** — the seven fields SAP will own. Pre-filled from the listing as a
  suggestion. Category and sub-category are required; the rest are editable.
- **Scraped enrichment** — counts of images, specifications, features, box contents
  and reviews, with an expandable specification list and an image strip.

If the source has no specification table, the page says so instead of silently
saving an empty sheet.

### Step 3 — Published

The product is created **inactive** so nothing reaches the storefront unreviewed.
Three links: open the specification sheet, preview the storefront page, or go to
the product list to activate it.

---

## 2. What each source gives you

Verified against live pages on 2026-09-10 (5 refrigerators / washing machines per source).

| Source | Name / Brand / Price | MRP | Images | Specifications | Reviews |
| --- | --- | --- | --- | --- | --- |
| **Amazon** | Yes | Yes | 11–17 | **30–40** | No |
| **LG India** | Name and brand only — LG does not publish a selling price | Yes (MSRP) | 12 | **28–104** | No |
| **Flipkart** | Yes | Yes | 5–12 | **26–46** | Yes, with ratings |
| **Bosch Home** | Yes, where the model is sold online | Yes | 6–9 | **27–41** | Rating only |
| **Reliance Digital** | Yes, including their item code | Yes | 1–9 | **31–40** | No |
| **Pai International** | Yes, including their SKU | Yes | 2–9 | **14–29** | Only where the listing has them |
| **Vijay Sales** | Yes | Yes | 5–12 | **None published** | No |
| **Vendor PDF** | Name, brand and model; price only if the sheet quotes one | Sometimes | None | **27–37** | No |

**Practical guidance.** LG, Bosch and Reliance Digital give the deepest specification
sheets; Flipkart adds warranty and importer declarations; Pai and Vijay Sales give Indian
retail pricing and their own SKU.

**Store vs online variants.** Amazon and Flipkart usually list an online-exclusive model
code, so it will not match a SAP item number. Bosch, Reliance Digital, Vijay Sales, Pai
and the other brand sites carry the offline/store variant, so use those when the model
code matters — each one puts it in `CHAR DESC` automatically.

Where a source genuinely publishes nothing — LG box contents, Vijay Sales specifications,
Bosch reviews — the review screen says so and you can fill it in on the Specifications page.

### Products with no listing anywhere

Use **Upload spec sheet (PDF)** on the same screen. It reads the vendor's own PDF and
produces the same review screen as a scraped link.

It works on spec sheets with a real text layer (27–37 specification rows on Bosch's
sheets). It cannot read an EDM flyer that was exported as a flattened image — there is no
text to extract, and the screen says so explicitly rather than returning empty fields.
Product photography is never imported from a PDF; add images from the brand listing.

### How each source is read

Only Amazon renders its product data into the served HTML. The rest are single-page apps,
so the scraper reads the payload the page itself renders from:

| Source | Data read from |
| --- | --- |
| **Flipkart** | `Product` JSON-LD, plus the `window.__INITIAL_STATE__` Redux store for the spec table, MRP and breadcrumb |
| **LG India** | The streamed React server-component payload (`self.__next_f`), which carries `productInfo` and `productSpecTechSpecList` |
| **Bosch Home** | `Product` JSON-LD for identity and gallery; the RSC payload for grouped `specifications`, `recommendedRetailPrice` and `highlights` |
| **Reliance Digital** | `window.__INITIAL_STATE__` (`productDetailsPage.product` + `product_meta`) for spec groups, highlights, gallery and MRP |
| **Pai International** | `__NEXT_DATA__` and `Product` JSON-LD, enriched from their `/api/product-detail/<slug>/` endpoint |
| **Vijay Sales** | `Product` JSON-LD, the `data-mrp` / `data-flix-mpn` / `data-gallery-items` attributes, and Magento GraphQL at `vsprod.vijaysales.com` for the long copy |
| **Vendor PDF** | Positioned text runs from `unpdf`, re-assembled into visual rows and split into label/value columns |

Selectors against rendered DOM classes were removed — Flipkart, LG and Bosch obfuscate and
rotate them, so anything built on them breaks within weeks.

---

## 3. Where the data lands

```
                    ┌─ products              (catalogue record, inactive)
scraper ──▶ SKU ────┤
                    └─ product_specifications (specification sheet)
                                │
                                └──▶ /product/<slug>   DETAILS & SPECS tab
```

Both records key off the SKU. The specification document always has the same
shape regardless of source — see `lib/product-specification-schema.ts`.

---

## 4. SAP integration

Seven fields are marked as SAP-owned in `lib/scrapers/types.ts`:

```ts
SAP_OWNED_FIELDS = ["sku", "name", "category", "subCategory", "brand", "charDesc", "price"]
```

Scrapers only ever **suggest** these. Everything else — specifications, images,
marketing copy, box contents, reviews — is enrichment that SAP does not carry and
the scraper owns.

When SAP lands, point it at those seven fields. Nothing else in the pipeline has
to change, and re-running a scrape will not fight SAP for ownership of master data.

---

## 5. Worked example — Samsung 322 L refrigerator

1. Item number: `REFSAM1187`
2. Link: `https://www.paiinternational.in/product-details/samsung-322-litres-2-star-double-door-frost-free-4`
3. Fetch → detected **Pai International**
4. Master data comes back as:
   - Name — Samsung 322 Litres 2 Star Double Door Frost Free Refrigerator (RT37C4522S8/HL)
   - Brand — Samsung · Category — Double Door Refrigerator · Price — 38799.99
5. Fill **Sub-category** (`REFRIGERATOR`) and **CHAR DESC** (`RT37C4522S8`) — Pai
   does not supply either.
6. Save → product and specification written, storefront preview link appears.
7. Add specifications by hand, then activate the product.

---

## 6. Troubleshooting

| Message | Meaning |
| --- | --- |
| *Unrecognised link* | Host is not Amazon, Flipkart, Pai or LG. |
| *The site refused the request (HTTP 429/403)* | Rate-limited. Wait a minute and retry. |
| *served a bot check instead of the product page* | The source detected automation. Retry later or enter manually. |
| *Item number and name are required* | SKU or name is blank. |
| *Category and sub-category are required* | Both must be set before saving. |
| *SKU … not found in database* | The product record was not created first — re-run from step 1. |

---

## 7. Extending to another source

1. Add the host and a `ScraperSource` value in `lib/scrapers/http.ts` (`HOST_MAP`).
2. Write an adapter in `lib/scrapers/adapters.ts` returning `ScrapedProduct`.
3. Register it in the `ADAPTERS` map.

Check for a JSON-LD `Product` block first (`findLdType`) and `__NEXT_DATA__`
second (`nextData`) — between them they covered three of the four sources here,
and unlike CSS classes they do not change when the site is restyled.

Only add hosts you intend to fetch: `detectSource` parses the URL and matches on
hostname, which is what stops a crafted link turning the scraper into an SSRF.
