# BRD — implementation status

Traceability matrix for **Ecom BRD.docx** (SARA vs Pai International benchmark).

Anything blocked on an external system lives in
[PENDING-EXTERNAL-INTEGRATIONS.md](PENDING-EXTERNAL-INTEGRATIONS.md) and is **not** repeated here
except as a cross-reference.

Legend: **Done** = built in this pass · **Existing** = already in the codebase and verified ·
**Partial** = built but limited (reason given) · **Backlog** = local work, not yet started ·
**Blocked** = needs an external system.

---

## 1. Homepage

| BRD requirement | Status | Where |
| --- | --- | --- |
| Header: logo, search, location/pincode, store locator, account, wishlist, cart | Existing | `components/Header.tsx`, `components/DeliverToPincode.tsx` |
| Top offer bar (free delivery / no-cost EMI / exchange / genuine / stores) | Existing | `components/home/SaraAdvantageBar.tsx` |
| Hero campaign banner with dual CTA | Existing | `components/HeroSection.tsx` |
| Shop by category | Existing | `components/CategoryCircles.tsx`, `components/home/CategoryMosaic.tsx` |
| Today's best deals | Existing | `components/DealsOfTheDay.tsx` |
| Shop by brand | Existing | `components/BrandMarquee.tsx`, `components/home/BrandStrip.tsx` |
| Product card shows EMI/month | **Done** | `EmiFromBadge` in `components/EmiCalculator.tsx` |
| Why SARA / trust metrics | Existing | `components/home/SaraAdvantageBar.tsx`, `components/home/SocialProofBand.tsx` |
| Store network block | Existing | `components/home/StoreCta.tsx` |
| Customer reviews | Existing | `components/Testimonials.tsx` |
| Latest articles (SEO content) | **Done** | `components/home/LatestArticles.tsx` |

## 2. Navigation

| BRD requirement | Status | Where |
| --- | --- | --- |
| Mega menu with multi-column category panels | **Done** | `components/MegaMenu.tsx`, mounted in `components/Header.tsx` |
| Sub-category links per category | **Done** | Driven by the `sub_categories` collection |
| Shop by price bands | **Done** | Five bands, deep-linked to `/products?minPrice=&maxPrice=` |
| Shop by brand inside the menu | **Done** | Driven by the `brands` collection |
| Shop by feature | Partial | Feature keywords are parsed in search; no curated feature landing pages yet |

## 3. Search

| BRD requirement | Status | Where |
| --- | --- | --- |
| Autocomplete with products, brands, categories | Existing | `app/api/search/suggestions/route.ts` |
| "washing machine under 25000" style queries | **Done** | `lib/search-query.ts`, wired into the suggestions API |
| "samsung 55 inch tv" size parsing | **Done** | `lib/search-query.ts` |
| "5 star AC" energy-rating parsing | **Done** | `lib/search-query.ts` |
| Capacity parsing (kg / ton / litre) | **Done** | `lib/search-query.ts` |
| Search history | Existing | localStorage in `components/Header.tsx` |
| Popular searches | Partial | Curated list in `Header.tsx`; not derived from real query volume |

## 4. Category & listing pages

| BRD requirement | Status | Where |
| --- | --- | --- |
| Sort: relevance / price ↑ / price ↓ / newest / discount | **Done** | `lib/product-sort.ts`; wired into `app/category/[id]/page.tsx` and `app/products/page.tsx` |
| Price filter | Existing | Range slider on both listing pages |
| Brand filter | Existing | Both listing pages |
| Spec/feature filters (size, technology, resolution) | **Done** | `lib/product-facets.ts` + `components/SpecFacets.tsx`. Twelve facet groups — screen size, capacity (L/kg/ton), energy rating, display tech, resolution, features, door type, load type, RAM, storage — normalised at read time from `technical_details`, product name and `char_desc`, so no data migration was needed |
| Facet counts and empty-facet suppression | **Done** | Counts come from the pre-facet result set; a facet with fewer than two distinct values is not rendered |
| Search intent deep-links into facets | **Done** | `/products?size=55&star=5&feature=…` set by the suggestions API |
| Active filter pills | Existing | Both listing pages |
| Pagination | Existing | Both listing pages |

## 5. Product page

| BRD requirement | Status | Where |
| --- | --- | --- |
| MRP, SARA price, savings, discount % | Existing | Buy box in `app/product/[slug]/page.tsx` |
| "EMI from ₹X/month" | **Done** | `components/EmiCalculator.tsx` |
| EMI calculator with tenure + bank selection | **Done** | `components/EmiCalculator.tsx`, `lib/emi.ts` |
| Bank offer table (no-cost EMI, instant discount, cashback) | **Done** | Same; local config until Pine Labs (PL-02/PL-03) |
| Pincode delivery check | Existing | `components/DeliveryEstimator.tsx` |
| Store pickup option | **Done** | `components/FulfilmentSelector.tsx` (checkout); product-page entry point is Backlog |
| Breadcrumbs + BreadcrumbJsonLd | Existing | `app/product/[slug]/page.tsx` |
| Specifications / features / box contents / warranty | Existing | `components/ProductSpecificationTabs.tsx` |
| Reviews with rating + photo filters | Existing | `components/ProductReviewsSection.tsx` |
| Write-a-review form | **Done** | `components/WriteReviewForm.tsx`; `POST /api/reviews` now guards itself, dedupes per customer and derives the verified badge from order history |
| Review photo/video upload | Blocked | EXT-09 — no object storage configured |
| Cross-sell / related products | Existing | "Also viewed" and "Related" rails |
| Frequently bought together / bundles | **Done** | `components/FrequentlyBoughtTogether.tsx` — multi-select bundle with "add all to cart" |
| Accessory relationship on the product model | Backlog | Companions are inferred from price band today; a real `accessoryOf` field would be better |
| Exchange valuation | Blocked | EXT-08 |

## 6. Omnichannel — Click & Pick

| BRD requirement | Status | Where |
| --- | --- | --- |
| Delivery vs store-pickup choice | **Done** | `components/FulfilmentSelector.tsx` |
| Store selection with city filter | **Done** | Same, backed by `/api/stores` |
| Pickup skips address entry and shipping fee | **Done** | `app/checkout/page.tsx` |
| Fulfilment persisted on the order | **Done** | `fulfilment` field in `app/api/orders/route.ts` |
| Reserve stock at the chosen store | Blocked | SAP-02 / SAP-06 |
| Notify the store, "ready for pickup" status | Blocked | SAP-05 / SAP-06 |

## 7. Pincode & delivery

| BRD requirement | Status | Where |
| --- | --- | --- |
| Pincode entry, serviceability, ETA | Existing | `components/DeliveryEstimator.tsx`, `blocked_pincodes` |
| Delivery fee and free-delivery threshold | Existing | `lib/order-pricing.ts`, settings-driven |
| Installation availability flag | **Done** | `installationAvailable` in `lib/product-attributes.ts` |
| Carrier-accurate dates and rates | Blocked | SHIP-01 / SHIP-02 / SHIP-05 |

## 8. Store locator & local SEO

| BRD requirement | Status | Where |
| --- | --- | --- |
| Interactive map locator | Existing | `app/store-locator`, `components/store-locator.tsx` |
| Indexable store directory | **Done** | `app/stores/page.tsx` |
| `/stores/<city>` city pages | **Done** | `app/stores/[city]/page.tsx` |
| Individual store pages with address, hours, phone, directions, WhatsApp | **Done** | `app/stores/[city]/[store]/page.tsx` |
| LocalBusiness / ElectronicsStore JSON-LD per store | **Done** | `buildStoreJsonLd()` in `lib/store-locations.ts` |
| Store pages in the sitemap | **Done** | `app/sitemap.ts` |
| Store photos, per-store offers, per-store stock | Partial | Photo field is read; offers and stock need SAP-02 |

## 9. Offers & campaigns

| BRD requirement | Status | Where |
| --- | --- | --- |
| Dedicated offers hub | Existing | `app/offers/page.tsx` |
| Bank offers | Existing | `components/BankOffersMarquee.tsx`, `/api/razorpay/offers` |
| EMI offers with real numbers | **Done** | EMI calculator |
| Reusable campaign landing pages | Existing | `app/campaign/[slug]`, `campaign_pages` collection |
| Campaign pages in the sitemap | **Done** | `app/sitemap.ts` |
| Coupon codes | Existing | `/api/coupons/*`, applied at checkout |
| Offer sections (today's deals, mega sale, clearance, store-exclusive) | **Done** | `lib/offer-sections.ts` + `components/OfferShelf.tsx`; offers carry `section`, `storeIds` and `endsAt` |
| Clearance urgency (time left, units left) | **Done** | `components/OfferShelf.tsx` |

## 10. Content & SEO

| BRD requirement | Status | Where |
| --- | --- | --- |
| XML sitemap | Existing → extended | `app/sitemap.ts` now includes stores, offers and campaigns |
| robots.txt | Existing | `app/robots.ts` |
| Canonical URLs | Existing | `lib/seo-metadata.ts`, per-page metadata |
| Product / Breadcrumb / Organization / WebSite / LocalBusiness / FAQ schema | Existing → extended | `components/SiteJsonLd.tsx`, per-page `*JsonLdServer.tsx`, plus new store JSON-LD |
| SEO title / meta description per product | **Done** | `seoTitle` / `seoDescription` in `lib/product-attributes.ts`, consumed by the feed |
| Google Merchant Center feed | **Done** | `app/feed/google-merchant.xml/route.ts` |
| Feed submission to GMC | Blocked | EXT-01 |
| Blog / buying guides | **Done** | `articles` collection via `lib/articles.ts`; `/blog`, `/blog/[slug]`, admin editor at `/admin/articles`, Article JSON-LD, HTML sanitised on write |
| Location landing pages | **Done** | `/stores/<city>` |

## 11. Cart & checkout

| BRD requirement | Status | Where |
| --- | --- | --- |
| Line items, quantity, remove | Existing | `app/cart/page.tsx` |
| "You save ₹X" | **Done** | MRP lookup + savings row and banner in `app/cart/page.tsx` |
| Discount-on-MRP line in the summary | **Done** | Same |
| Free-delivery nudge | Existing | `app/cart/page.tsx` |
| Coupon line | Existing | Applied at checkout |
| ≤3-step checkout | Existing | 2 steps: details → payment |
| Payment options (UPI / card / net banking / EMI / COD) | Existing | `components/PaymentGateway.tsx` |
| Guest checkout | **Done** | "Continue as guest" in `app/checkout/page.tsx`; `POST /api/orders` accepts guests, rate limited per IP |
| Guest order retrieval | **Done** | Capability token from `lib/guest-order.ts`, viewed at `app/order/[id]/page.tsx`, emailed to the customer |
| Post-purchase account creation | **Done** | Confirmation screen links to `/register?email=…`, which now prefills |
| Post-order cart clear | **Fixed** | `app/api/orders/route.ts` was clearing `cart` instead of `carts`, so it silently no-opped |

## 12. Product data model

| BRD field | Status | Where |
| --- | --- | --- |
| SKU, brand, model, category, subcategory, MRP, price, discount, stock | Existing | `products` collection |
| GTIN, MPN, model number | **Done** | `lib/product-attributes.ts` |
| HSN, GST rate | **Done** | Same (per-product GST with an 18% fallback) |
| Warranty (text + months) | **Done** | Same, including free-text parsing |
| Dimensions, weight | **Done** | Same, including "80 x 45 x 30 cm" parsing |
| Store stock, pincode stock | Partial | `storeStock[]` shape defined; no feed populates it — SAP-02 |
| EMI / exchange / COD / free delivery / installation flags | **Done** | Same |
| SEO title, meta description | **Done** | Same |
| Effective price start/end dates | **Done** | `priceValidFrom` / `priceValidTo` + `isPriceWindowActive()` |
| Images: front/rear/side/lifestyle/360 | **Done** | `lib/product-images.ts` defines the standard; coverage report at `/admin/image-coverage` gives merchandising a prioritised worklist |
| Image allowlist hardening | **Fixed** | `next.config.mjs` `remotePatterns` ended with a `**` catch-all that made the optimizer an open image proxy — replaced with a concrete host list |

## 13. Analytics

| BRD requirement | Status | Where |
| --- | --- | --- |
| GA4 e-commerce events (view_item, search, add_to_cart, begin_checkout, purchase, …) | Existing | `lib/analytics.ts` |
| Store locator / pincode / WhatsApp / call / EMI events | **Done** | `check_pincode`, `view_store_locator`, `select_store`, `get_directions`, `whatsapp_click`, `call_click`, `view_emi_options`, `select_emi_plan`, `select_fulfilment`, `view_offer` in `lib/analytics.ts`, emitted from the delivery estimator, store locator, store pages, EMI calculator, fulfilment selector and offer shelves |
| GA4 property, Meta Pixel + CAPI, Google Ads, Clarity, Search Console | Blocked | EXT-02..EXT-06 |

## 14. Performance & mobile

| BRD requirement | Status | Where |
| --- | --- | --- |
| Core Web Vitals reporting | Existing | `components/ReportWebVitals.tsx` → `/api/vitals` |
| WebP/AVIF, responsive sizes, lazy loading | Existing | `next.config.mjs` image config |
| CDN caching for API responses | Existing | `vercel.json` |
| Mobile sticky buy bar | Existing | `app/product/[slug]/page.tsx` |
| Image allowlist hardening | **Fixed** | See §12 |

## 16. Loyalty programme

| BRD requirement | Status | Where |
| --- | --- | --- |
| Points balance | **Done** | Append-only ledger in `lib/loyalty.ts`; balance is summed from entries, never cached |
| Earn on purchase | **Done** | Credited only when an order reaches `delivered`/`completed`, idempotent per order |
| Tier-based earn rate | **Done** | Silver 2 / Gold 3 / Platinum 4 points per ₹100, driven by the existing `customer_profiles` tier |
| Redemption at checkout | **Done** | `components/LoyaltyRedeemer.tsx`; quoted then debited server-side, capped at 20% of the order |
| Points expiry | **Done** | 365-day lifetime, with an "expiring soon" warning on `/rewards` |
| Reversal on cancel/return/refund | **Done** | `reverseOrderPoints()` in `lib/loyalty.ts` |
| Purchase history, wishlist, orders in account | Existing | `/account`, `/dashboard` |
| Referral rewards | Backlog | No referral model yet |
| Points ledger synced to CRM | Blocked | CRM-04 |

## 15. About Us

| BRD requirement | Status | Where |
| --- | --- | --- |
| Company stats | Existing | `app/about/page.tsx` |
| Leadership | Existing | Same |
| Values | Existing | Same |
| Brand story | **Done** | `components/about/CompanyStory.tsx` |
| Customer milestones (stores, customers, cities, partners) | **Done** | Same |
| Certifications & brand partnerships | **Done** | Same — authorised dealer, manufacturer warranty, certified installation, GST invoicing |
| "Find your nearest SARA store" CTA | **Done** | Same |
| Awards, media coverage, store gallery | Backlog | Needs business-supplied assets; `MILESTONES` in the component is the hook for dated history |

---

## Suggested next slice (all local, no external dependency)

1. **Claim guest orders on sign-up** — match `isGuest` orders by email when an account is created
   with the same address, so history is not lost.
2. **Shop-by-feature landing pages** (`/mobiles/5g-smartphones/` and similar) on top of the facet
   engine.
3. **Popular searches** derived from real query volume rather than a curated list.
4. **Review moderation queue** — reviews publish immediately today.
5. **Accessory relationships** on the product model to replace the inferred bundle companions.
6. **Referral rewards** on top of the loyalty ledger.
7. **Awards, media coverage and store gallery** on About Us — needs business-supplied assets.
