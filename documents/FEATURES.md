# Sara Electronics — Complete Platform Feature Documentation

> Full-stack e-commerce platform built on Next.js 15, React 19, MongoDB, and Razorpay.  
> Designed for competing with Amazon in the Indian electronics retail market.

---

## Table of Contents

1. [Storefront & Customer Experience](#1-storefront--customer-experience)
2. [Campaigns, Marketing & Sales](#2-campaigns-marketing--sales)
3. [Product Management](#3-product-management)
4. [Order Management](#4-order-management)
5. [Payment System](#5-payment-system)
6. [Customer & User Management](#6-customer--user-management)
7. [Coupon & Discount Engine](#7-coupon--discount-engine)
8. [Partner & Vendor System](#8-partner--vendor-system)
9. [Software & Digital Products](#9-software--digital-products)
10. [Spin the Wheel & Gamification](#10-spin-the-wheel--gamification)
11. [Lead Generation & Support](#11-lead-generation--support)
12. [SEO & AI Discoverability](#12-seo--ai-discoverability)
13. [Security & Infrastructure](#13-security--infrastructure)
14. [Analytics & Reporting](#14-analytics--reporting)
15. [Admin Panel Features](#15-admin-panel-features)
16. [Launch Checklist](#16-launch-checklist)

---

## 1. Storefront & Customer Experience

### Marketing & Controls (`/admin/marketing`)
- Central admin page with tabs for Homepage, Products & Offers, Product Details, Cart, Brands, About SARA, Header and Footer. The admin sidebar groups storefront content, promotions, campaigns and gamification under **Marketing & Controls**.
- Section editors expose marketing text, image URLs/uploads, CTA destinations, visibility and ordering. Existing hero/promo placements still use Banners & Promos; the central page links to that manager rather than creating a conflicting source of banners.
- Homepage shortcuts, headings, benefits and store messaging; listing offer labels, fallback promotions and service copy; product trust labels, pickup promotion, suggestions and FAQs; cart messaging; brand-directory copy; About story, vision, mission, journey and artwork; header announcement/navigation; footer newsletter, link columns, brand message and download labels are wired to saved controls.
- Page-level homepage/About/Brands sections and footer columns can be reordered. Purchase controls, listing filters and bank eligibility retain their fixed functional layout; the editor explicitly distinguishes these sections. Marketing visibility never removes catalog prices, payment controls, required suggestion disclosures or cookie preferences.
- Data persists in MongoDB `marketing_content` through a route-local admin guard and validated writes. Revision conflicts return an explicit reload error rather than overwriting another editor's changes. Public content refreshes on focus and every 30 seconds, with visible retry states on failures.
- Existing catalog prices/stock, genuine reviews, store totals, company figures, app/social URLs and Razorpay bank/EMI terms remain in their authoritative managers. The page groups links to branding/settings, categories/brands, banners, coupons, campaigns/templates, newsletters and gamification controls.

### Homepage
- Reference layout from `design/app-layout/homepage.PNG`, with the existing site-wide theme, header and footer preserved
- Hero carousel with two side offers, followed by a six-item service-benefits strip
- Ten circular category shortcuts and a six-product Today's Deals grid with working Add to Cart buttons
- Exchange, EMI and Super Sunday promotion cards, followed by circular top-brand links
- Store finder and Why Choose SARA highlights with the live store count
- Real in-stock catalogue products, prices and discounts; ratings appear only when supplied by the catalogue
- Loading, empty and retryable error states for deals; no artificial countdown or unverified exchange-value promise
- Responsive layout with horizontally scrollable categories/brands and two-column mobile product cards
- Reusable artwork extracted from the supplied reference lives in `public/homepage/`; sections are real interactive components, not a screenshot

### Product-card comparison
- Homepage deals, product listings and shared category/brand product cards expose a labeled Compare button with an Added to Compare state.
- Buttons toggle the existing persistent comparison list without navigating away. The floating comparison shortcut updates across cards, and the six-product limit shows an explicit message rather than reporting an unsuccessful addition.

### Product details (`/product/[slug]`)
- Three-column desktop gallery, product highlights and purchase panel, with responsive mobile controls and working cart, wishlist and recommendation actions.
- Purchase-panel service icons and labels use the storefront blue. Frequently Bought Together shows up to six available catalog suggestions, explicitly labeled as suggestions rather than purchase-history pairings. The full paginated catalog supplies exact subcategory matches first, followed by related products using the shared shopper-facing category normalization; products need not be cheaper than the viewed item. Loading, retryable errors and genuinely empty categories remain visible instead of hiding the section.
- Specifications opens the details table directly. Product Images is a separate top-level tab showing the manufacturer-provided images; SKU-linked specification records supply the table, images and box contents.
- Product Images extracts images from saved manufacturer HTML/lazy-image attributes and background-image URLs without executing that HTML. It repairs known legacy image-host substitutions, falls back to the supplied image list/gallery when no manufacturer images exist, and shows individual image failures with retry controls. Scraper text cleanup preserves asset URLs.
- Offers and EMI Options show only active, date-valid Razorpay offers meeting the product-value minimum, with the returned terms, payment method and limits. The old manually entered product-page bank-offer cards no longer supplement this live source. Missing credentials, upstream errors and empty results do not produce fictional bank offers or estimated monthly instalments; failures expose retry controls.
- Customer reviews appear only in the filterable Reviews tab, without a duplicate section below Overview. The tab uses the customer-review API and submission form, and new submissions update the product's rating summary. Manufacturer-recorded reviews retain their supplied ratings, dates and verification flags rather than invented statistics.
- Signed-in customers can submit genuine reviews to MongoDB `reviews`, with one review per customer/product. Creation, owner/admin edits and deletion update the product's stored `reviewsCount`, `reviewCount`, `rating` and `ratingSum` in the same MongoDB transaction. Public reads include published reviews and legacy reviews without a moderation status; purchase verification is derived from the customer's delivered/completed orders. No sample customer reviews are seeded.
- Shared header/footer and product SEO remain unchanged. Unsupported exchange guarantees, fixed warranty/delivery promises, video/360-degree viewers and fictional variant controls are not added to mimic the reference.

### Cart (`/cart`)
- Reference-style item rows, bulk selection/removal, quantity controls, wishlist moves, four-step tracker, price-summary panel, live offers, recommendation cards and four linked service benefits.
- MRPs, prices and stock come from catalog lookups. Refreshed positive prices update the shared cart so the drawer and checkout keep the same displayed amounts. Customers can open checkout to review unavailable items, with explicit stock warnings; known insufficient stock blocks progression to payment, and the server rechecks availability before creating payments or orders. Failed price or shipping checks give actionable feedback on clicking Proceed to Checkout instead of silently disabling it. Quantities can exceed 20 when stock permits; carts allow at most 20 different products and ₹10 lakh in product value, enforced again with catalog prices at cart-save and order/payment creation.
- Cart promotional artwork uses the Cart promotional banner placement in Admin → Banners & Promos. Admin can upload an image, edit title/subtitle/link/colours, order banners and toggle visibility. With no enabled Cart banner, the promotional card is hidden.
- Shipping uses the same configured fee and free-shipping threshold as checkout, including tax-inclusive hardware-only eligibility. Summary totals cover all cart items; selection is only for bulk removal and remains stable after quantity edits.
- Coupons link to the existing checkout coupon form. Recommendations use genuinely available catalog products, not fictional accessory prices or purchase-history claims.
- Guest carts restore from local storage on navigation or reload without account/API access; wishlist moves still require sign-in.
- The `electronicparadise.in/cdn/shop/` product-image source is explicitly allowed for Next image optimization. The cart page, quick-access strip and drawer share direct supplier-image rendering with logged failures and a placeholder, preventing other supplier hosts from crashing those surfaces without restoring a wildcard host.
- Shared header/footer are preserved and `/cart` remains noindex.

### Brands (`/brands`)
- Reference-style product-montage hero, search/category controls, a continuous A-Z filter bar, compact five-column desktop brand cards and linked service-benefits strip.
- Cards use enabled admin brands and real catalog manufacturers, with configured logos, explicit brand names and shopper-facing categories. Reference artwork improves the seven overlapping default logos without overriding custom logo URLs. The full paginated active catalog backs filtering, including categories beyond the three shown on a card.
- Enabled brand landing pages receive brand links; other cards link to their product-brand filter. Search, category and initial-letter filters combine, with a clear-filters action for empty results.
- Loading and retryable failures are explicit. Admin-managed Brands hero banners still override the default artwork and copy. Shared header/footer and the clean `/brands` canonical are preserved.
- Service copy describes genuine products, available EMI, assistance and shipping-policy terms without inventing all-bank coverage, exchange guarantees or unconditional free delivery.

### About SARA (`/about`)
- Reference-style showroom hero, five-part company-statistics strip, family story and principles, vision/mission/values, horizontal journey, showroom banner and linked service-benefits strip.
- Years, store count and customer count come from Admin Settings rather than duplicated literals; absent figures are explicitly marked unspecified. Branding storefront/lifestyle images override the reference artwork.
- The journey uses undated themes rather than unverified founding dates, historical store counts or customer milestones. Copy avoids unsupported in-house installation, free-delivery, bank-coverage and unconditional warranty claims.
- Shared header, global theme and footer are preserved. Journey anchors, shopping, EMI, warranty, contact and store-locator links are functional.

### Footer
- Reference-style blue newsletter/social strip above a compact navy footer with Shop, Customer Service, About SARA and Legal columns
- Existing newsletter submission, duplicate-submit protection and cookie/privacy controls are preserved
- Newsletter signup is saved in MongoDB `leads` with category `Newsletter`; success/errors appear inline and in toasts. View subscribers under `/admin/leads` using the Newsletter category.
- The SARA footer logo stays red, with a linked "Built by Bytewise Consulting LLP" credit
- Social destinations use configured branding URLs; unconfigured icons are visibly muted and are not links
- Google Play and App Store badges use optional `playStoreUrl` and `appStoreUrl` settings; missing destinations are explicitly marked unavailable
- The generated QR targets optional `appDownloadUrl`, then the configured app-store link, or the current storefront origin with a "to Shop Online" label
- Responsive two-column link layout on mobile; shared site theme and homepage sections are unchanged

### Product Catalog (`/products`)
- Offers-focused reference layout: compact blue hero, horizontal offer categories, three promotion cards, category sidebar, four-column desktop results, 24 products per page, numbered pagination and linked shopping-service strip. Existing header, footer and admin-managed listing banners are preserved.
- All Offers and Brand Offers show real catalog markdowns; All Products retains the complete catalog. Existing search/category/brand/price/SKU-facet links open All Products automatically, including products above ₹2 lakh. The full paginated catalog supplies results, counts and facets rather than the first 500 products.
- Category, brand, price, discount, genuine customer rating, in/out-of-stock and SKU specification filters combine with featured, price, discount, newest, rating and alphabetical sorting. URL changes reset previous filters; loading, empty and retryable failures are visible.
- Bank Offers uses active, date-valid Razorpay offers meeting each product's minimum value. No Cost EMI additionally requires explicit no-cost EMI terms; ordinary EMI is not labeled no-cost. Returned bank terms and retry states remain visible. Festival, bundle and online-exclusive eligibility is not invented from unrelated offer records; exchange opens an assistance state instead of promising a fixed value.
- Cards display supplied MRPs, real savings and verified rating summaries only, without estimated MRPs, synthetic ratings or monthly instalments. Wishlist, persistent Compare (max six) and stock-aware Add to Cart remain available.
- `/products` metadata describes offers and savings while retaining the clean, parameter-free canonical.

### Product Detail Page (`/product/[slug]`)
- Image gallery: thumbnail pagination, lightbox, hover-zoom, auto-slide
- Price display: MRP, selling price, discount percentage
- Quantity selector
- Add to Cart / Buy Now buttons
- Wishlist toggle
- Share: Web Share API, clipboard copy, WhatsApp share
- Product specification tabs (~46KB of spec rendering)
- Reviews section with star ratings
- Related products
- Delivery estimator (pincode-based)
- Bank offers marquee
- Site features trust badges
- Product JSON-LD (Schema.org) + BreadcrumbJsonLd
- Recently viewed recording
- Sticky mobile buy bar

### Category & Sub-Category Pages
- Sidebar filters (same as `/products`)
- BreadcrumbList + ItemList JSON-LD
- Paginated product grid with `CategoryProductCard`

### Brand Pages
- `/brands` — index of all enabled brands with logos and taglines
- `/brands/[slug]` — dynamic brand landing pages with hero banner, features, category gallery, product grid, trust badges, lead form
- Hardcoded brand pages: `/bosch`, `/haier`, `/lg`, `/tcl`

### Software Store (`/software`)
- Dedicated software product catalog
- Pack size selection (1-5 devices)
- Validity period selection (1-5 years)
- Pricing tiers per pack/validity
- System requirements display
- Filters: search, price range, categories

### Cart (`/cart`)
- Cart items with image, name, SKU, price, quantity controls
- Software-specific display (max devices, validity, license info)
- Remove item, save for later, clear cart
- Animated item transitions (Framer Motion)
- Order summary: subtotal, 18% GST, shipping (free above Rs.1,000), total
- Free shipping threshold nudge

### Checkout (`/checkout`)
- Single-page checkout: delivery address, delivery/pickup options, payment selection and an order-summary pay button are shown together, without Next/Back screens.
- Signed-in checkout loads the saved account name, email, phone and delivery address from the account profile. Autofill preserves customer edits, including edits made while the profile is loading; failures provide a retry or manual-entry option. Guests enter their own details.
- Signed-in customers can save multiple Home, Work or Other delivery addresses, select them on future checkouts, edit or remove them. Addresses are stored against the authenticated account in `user_addresses` and are erased on account deletion. The most recently saved address is offered first; customers can also use an address without saving it. Guest addresses are not stored.
- Pickup cards use the same configured storefront illustration as the store locator when a store has no individual photo.
- Successful checkout opens `/thank-you?orderId=...` with a reference-style confirmation banner, authoritative item summary, delivery/pickup and payment details, order journey, available catalog recommendations and rewards links. Guest capability tokens are preserved; reloading fetches the order through authenticated/token-verified APIs. Payment confirmation is shown only when the server reports verification; unconfirmed/COD payments and future delivery stages are not presented as completed.
- The `/dashboard` account overview uses a compact welcome banner, three recent-order cards and five recently viewed products with working wishlist/add-to-cart controls. New accounts see clearly labelled live recommendations instead. Saved delivery addresses share checkout's account-owned address book and can be added, edited or removed; profile details include the recorded date of birth. Missing orders/products/addresses show loading, empty or retryable error states, not fictional data. Reviews management and saved payment cards are marked unavailable rather than linked to nonexistent pages.
- Home-delivery choices and pickup-store listings currently show Karnataka with Bangalore and Mysore only. Saved Bengaluru/Mysuru addresses are normalized; other saved delivery locations prompt a supported address or store pickup.
- Payment choices include UPI, cards, net banking, EMI and wallets through Razorpay (availability/eligibility confirmed by the gateway), COD and existing employee/OTP-verified in-store purchase.
- Direct payment validates contact details, address/pincode serviceability, cart limits and stock first. Store pickup retains store selection and charges no delivery fee, checked consistently when quoting payment and creating the order.
- Floating cart and compare shortcuts are hidden only on checkout so they do not cover the address form or payment total.
- Reference-style address cards, numbered progress tracker, compact payment rows and order summary; pickup-store cards are visible without an extra screen and selecting one switches to pickup. Express delivery is clearly marked unavailable; no unsupported delivery dates, distances or store-stock promises are shown.
- Coupon code application/validation
- Separate GST for software vs hardware
- In-store purchase component
- Guest checkout, account autofill, coupons, rewards, software/GST breakdown and item removal remain available on the same page.

### Order Tracking (`/track`)
- Public order tracking with animated visual canvas
- Multi-step status: Ordered → Processing → Shipped → In Transit → Out for Delivery → Delivered
- Event timeline

### User Account
- `/account` — hub with links to profile, orders, wishlist, settings
- `/dashboard` — alternative account area with orders, wishlist, settings, cart, offers, in-store purchases
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- Rate limiting, reCAPTCHA, honeypot spam protection on auth forms

### Store Locator (`/store-locator`)
- Map-based store finder with StoreJsonLd structured data
- Admin-managed store locations with bulk Excel import
- Reference-style showroom hero, full-width search/city/type/brand/location controls, compact five-store preview and expandable list beside a live Leaflet map.
- Filters and counts use active database stores. Brand filtering only includes brands explicitly named in a store, rather than assuming every branch carries every brand.
- Opt-in geolocation and pincode lookup support radius filtering and nearest-first sorting; clearing or changing a pincode cancels stale lookups. Store-loading and location errors have visible retry/reset controls.
- Map/list switching, branch selection, map reset/zoom, phone, WhatsApp and stored Google Maps links remain functional. Distances require an actual search location; shared fallback photos are illustrative, not branch-specific.
- Submit an office/place name and city with Enter or the search button to look it up using OpenStreetMap, then select the correct match. The first match shows nearby stores immediately; Google Maps directions include the searched place as the origin.
- If no store is within the selected radius, the nearest mapped store is shown with an explicit notice. If the filters exclude every mapped store, the nearest store across the network is shown instead. Distances are straight-line estimates, not Google driving distances.

---

## 2. Campaigns, Marketing & Sales

### Email Campaign System (`/admin/customer-centric`)
- **4-step wizard:**
  1. **Pick Template** — from 5 pre-built promo templates or DB-saved templates
  2. **Edit Content** — rich text editor, subject line, HTML body, image attachment, raw HTML toggle
  3. **Choose Recipients** — segments (all/active/high-spenders/dormant), user search, select all/individual, Excel import
  4. **Preview & Send** — campaign preview, batch sending with real-time progress
- **Batch sending:** 50 recipients per batch, 30-second delay between batches to avoid spam filters
- **Streaming progress:** real-time progress bar, delivered/failed counters, batch indicator
- **Campaign history:** log of all sent campaigns with stats
- **Email templates:** CRUD management at `/admin/customer-centric/templates`

### Pre-built Email Templates (`lib/promoTemplates.ts`)
| Template | Purpose |
|----------|---------|
| Promo Code | Discount code distribution |
| New Products | New arrival announcements |
| Bumper Offer | Major sale events |
| Festival Sales | Festival/seasonal promotions |
| Custom | Freeform campaign |

### Spin-the-Wheel Gamification (`/spin`)
- Interactive spinning wheel with customizable segments
- Canvas-based rendering with sound effects and confetti
- OTP verification (email + WhatsApp)
- Prize management with configurable win probabilities
- Coupon code generation on win
- **Campaign system:** per-campaign isolated collections, clone/activate/deactivate
- **Store tracking:** QR codes per store for in-store participation
- **Traffic analytics:** charts (Recharts), export CSV/Excel
- **Admin dashboard:** campaign stats, prize inventory, coupon management

### Campaign Landing Pages (`/campaign/[slug]`)
- Custom slug-based landing pages with banners and product selection
- Full CRUD from `/admin/campaign-pages`

### Homepage Merchandising
- The active homepage is `components/home/SaraLanding.tsx`, styled with a homepage-scoped CSS module
- `/admin/listing-banners` controls all homepage posters: `home-hero` for carousel slides, `home-duo` for the first two side offers, and `home-card`, `home-strip` and `home-statement` for the first three below-deals promotions, ordered by their Order field
- Create/upload, edit, delete with confirmation, filter by placement, and turn each banner on/off directly in the list. New banners default to off.
- Only enabled database records are rendered. Turning all records off hides the corresponding area; no hardcoded banners replace disabled/deleted records.
- The storefront refreshes banner data every 30 seconds; reloading fetches it immediately.
- `npm run seed:home-banners` inserts 13 disabled presets (8 main posters, 2 sub banners, 3 below-deals banners). Reruns do not overwrite edits or change existing visibility.
- Category artwork, brand logos/landing-page links and storefront photography are read from the existing catalogue and branding settings
- The homepage section order follows the reference; legacy home-component/reordering tools do not change this layout

### Epic Sale Page (`/epic-sale`)
- Promotional sale landing page with animated sections, promo badges, store locations, offers

### Lucky Draw (`/lucky-draw`)
- Campaign page with grand prizes, daily prizes, participation rules
- SMS format lead form

---

## 3. Product Management

### Full CRUD
- Create/edit/delete products with ~40 fields (Item No., Tax Category, Group Name, Manufacturer, Color, Capacity, EAN, SKU, etc.)
- 5 image slots per product
- Active/trusted status toggles
- Category and sub-category assignment

### Bulk Operations
- **Excel/CSV Upload:** bulk product import via `ExcelUpload` component
- **Clear Database:** wipe products, categories, specs
- **Activate All Products:** bulk status toggle
- **Bulk MRP Update:** mass price updates

### Amazon Scraper (`/admin/amazon-scraper`)
- Single URL scrape: paste Amazon URL to extract all product data
- **Data extracted:** title, price, MRP, images, specifications, features, ratings, reviews, technical details, manufacturer info, warranty, return policy
- **Bulk import:** Excel with item number + Amazon URL pairs
- Edit before save, 6 rotating User-Agents, CAPTCHA detection with retry

### Product Specifications (`/admin/product-specifications`)
- Excel upload (SKU + Amazon link mapping)
- Auto-fetch specs from Amazon links
- Lock/unlock specs to prevent deletion
- Sync specs to product collection
- Manual creation form

### Canonical Product Schema
- `lib/product-schema.ts` defines target schema
- Migration scripts: `npm run migrate:schema`

---

## 4. Order Management

### Order List (`/admin/orders`)
- Search by order ID, customer name
- Status filter: pending/processing/shipped/delivered/cancelled
- Source filter: direct/partner
- Date range filter
- Export to Excel via SheetJS
- Pagination (10/page)

### Order Detail (`/admin/orders/[id]`)
- Customer info, address, items with images
- Order total breakdown (subtotal, tax, shipping)
- Payment details and Razorpay verification
- Status timeline with update capability
- Tracking number management
- License keys display for software orders
- Send delivery/completion emails

### Bulk Update (`/admin/orders/bulk-update`)
- Excel upload with Order ID + Status + Tracking Number
- Row-by-row approval before submit
- Template download

### External Orders (`/admin/external-orders`)
- Third-party provider orders
- Retry failed, cancel queued

---

## 5. Payment System

### Razorpay Integration
- Online payment via Razorpay checkout.js
- COD (Cash on Delivery) option
- Per-partner Razorpay credentials (encrypted storage)
- Server-side HMAC-SHA256 signature verification
- Server-side amount verification (does not trust client)
- Bank offers from Razorpay API with fallback (HDFC, ICICI, Axis, SBI, Kotak, Paytm)

### Payment Routes
- `POST /api/payment/create-order` — create Razorpay order
- `POST /api/payment/verify` — verify payment, create order, assign licenses, send emails
- Partner-specific: `/api/v1/partner/orders/razorpay/create` and `/verify`

### Invoice Generation
- PDF invoices via jsPDF with order items, tax (18% GST), company details

---

## 6. Customer & User Management

### Customer Dashboard (`/dashboard`)
- Every dashboard page uses the same account sidebar, profile photo, navigation and responsive account menu.
- My Orders shows the customer's complete history by default (All Orders / All Time); date, status and search filters remain available.
- My Cart stays at `/dashboard/cart` and shares the storefront cart's quantity, removal, wishlist, live-price and checkout controls.
- My Addresses manages the saved checkout address book. Profile Settings saves name, phone and a photo; login email is read-only. New accounts receive a local default avatar, with 20 selectable avatars and JPEG/PNG/WebP uploads (2 MB maximum, processed into a 256px WebP).
- Help & Support accepts authenticated enquiries inside `/dashboard/support`, stores them in the existing contact-inquiry queue and displays the customer's own enquiry history.
- My Membership shows Sara Coins, earning progress and activity. Cumulative delivered/completed spending earns 1 coin per ₹1,000, including past eligible orders; smaller orders carry their remainder forward. Cancelled/returned/refunded orders are excluded. Historic earn amounts are recalculated from authoritative orders, while redemptions and refunds remain in the ledger.
- `/rewards` explains the same rules: coins retain the existing ₹0.25 redemption value, 100-coin redemption lots, 20% order cap and 365-day expiry. There is no tier earning multiplier.
- Removed My Reviews, Saved Cards, Notifications, notification-summary statistics and simulated notification/password settings from dashboard navigation and settings.

### Customer List (`/admin/customers`)
- Search by name, email, phone
- Sort by name, email, total spent
- Stats: order count, total spending per customer
- Pagination (20/page)

### Customer Detail (`/admin/customers/[id]`)
- Full profile with order history and lifetime value

### Employee Management (`/admin/employees`)
- CRUD with role-based access control
- Per-page permission system (20+ admin pages)
- Dashboard access toggle
- Bulk upload via Excel
- Sales tracking per employee

---

## 7. Coupon & Discount Engine

### Coupon Types
| Type | Description |
|------|-------------|
| `fixed` | Flat discount amount |
| `percentage` | Percentage discount with max cap |
| `buy_get` | Buy X get Y (configurable quantities) |

### Scope Options
- All products
- Specific products (multi-select)
- Specific SKUs
- Specific brands

### Features
- Usage limit (total) + per-customer limit
- Start/end date range (or no end date)
- Max discount cap for percentage coupons
- Product search and multi-select for targeting
- Usage logs with order references

### API Routes
- `GET /api/coupons` — list coupons
- `POST /api/coupons/validate` — validate coupon code
- `POST /api/coupons/redeem` — apply coupon at checkout

---

## 8. Partner & Vendor System

### Partner Tiers
| Tier | Commission | Rate Limit (RPM) | Orders/Day |
|------|-----------|-------------------|------------|
| Starter | 15% | 60 | 50 |
| Growth | 12% | 300 | 500 |
| Professional | 10% | 1,000 | 2,000 |
| Enterprise | 8% | 5,000 | 10,000 |

### Partner Features
- Full CRUD with business details (GSTIN, PAN, business type)
- API key management (AES-256-CBC encrypted keys)
- Wallet system (credit/debit/hold/release transactions)
- Order lifecycle management
- Per-partner Razorpay integration
- Product catalog management
- Payout processing (approve/reject/complete)

### Partner API (`/api/v1/partner/*`)
- 17 API endpoints for third-party integration
- Bearer token authentication
- Tier-based rate limiting
- CORS with origin whitelisting
- Documentation at `/partner-api-docs`
- Test UI at `/partner-api-test`

### Admin Partner Management
- Partner list with tier/status filters
- Commission tracking per partner
- Payout processing with bank account details
- Partner-specific product catalogs

---

## 9. Software & Digital Products

### Software Products (`/admin/software`)
- CRUD with: name, description, category, image, features, system requirements
- Pack size selection (1-5 devices)
- Validity periods (1-5 years)
- Pricing tiers per pack/validity
- Real-time polling (5s intervals)

### License Key Management
- Bulk import license keys
- Auto-assignment on payment
- Manual assignment
- Revocation on refund
- Alert when license pool is low

### Automatic Flow
1. Customer purchases software product
2. Razorpay payment verified
3. License key auto-assigned from pool
4. Activation email sent with key + instructions
5. Admin alerted if no licenses available

---

## 10. Spin the Wheel & Gamification

### Campaign System
- Create/clone/activate/deactivate campaigns
- Per-campaign isolated MongoDB collections
- Configurable wheel segments with emojis
- Win probability and weight multipliers
- Prize inventory management with date ranges and time slots

### User Flow
1. Register with phone number
2. OTP sent via email + WhatsApp
3. Verify OTP
4. Spin the wheel
5. Win prize with coupon code
6. Coupon emailed + WhatsApp notification

### Default Prizes
TV, Speaker, Rs.500 Voucher, Home Theatre, Car, iPhone, Samsung Phone, Soundbar, Better Luck Next Time

### Analytics
- Traffic analytics with charts (Recharts)
- Store tracking via QR codes
- Coupon usage stats
- CSV/Excel data export

---

## 11. Lead Generation & Support

### Lead Forms (`/admin/leads`)
- Configurable fields (name, phone, pincode, email, category)
- Category management
- WhatsApp integration for follow-up
- Status tracking: new → contacted → interested → converted → closed
- Export to Excel
- Used on brand pages and campaign pages

### Complaint System (`/complaints`)
- Structured complaint types (breakage, return, defective, etc.)
- Image upload
- Order number reference
- Status tracking with admin notes
- Email notification on status change

### Contact Form (`/contact`)
- Reference-style business enquiry hero, six selectable business categories, direct support, business benefits and partnership banner; customer-support categories remain available in the form.
- Validated name, company, email, mobile, enquiry type, city, full message (up to 5,000 characters) and terms/privacy acceptance are saved to MongoDB `contact_inquiries`; no placeholder pincode or truncated lead source.
- `/admin/contact-inquiries` shows company, city, enquiry type and expandable full messages, with search, status management (new/contacted/resolved/archived) and deletion.
- The existing three-field mobile enquiry submission remains supported. Public submissions are rate-limited; the admin inbox and its actions require administrator authorization.

### FAQ Page (`/faq`)
- Categorized FAQ sections (9 categories)
- Search within FAQ
- Collapsible accordion

---

## 12. SEO & AI Discoverability

### Technical SEO
- Dynamic sitemap (hourly regeneration) with product/category/brand URLs
- Robots.txt with Googlebot-specific rules
- Canonical URLs with `en-IN`/`x-default` alternates
- PWA manifest with shortcuts (Today's Deals, Spin & Win, My Orders)

### Structured Data (JSON-LD)
| Schema | Pages |
|--------|-------|
| Organization + WebSite | Every page (root layout) |
| Product + Offers + Reviews | Product detail pages |
| BreadcrumbList | Product, category, brand pages |
| FAQPage | Homepage |
| ItemList | Category pages |
| Brand | Dynamic brand pages |
| StoreJsonLd | Store locator |

### AI/LLM Discoverability
- `/llms.txt` — machine-readable store index for ChatGPT, Claude, Perplexity, Google AI Overviews
- `/llm.txt` — shorter variant
- Categories, products (with prices), brand pages, policies, contact info

### RSS Feed
- `/feed.xml` — latest 50 active products in RSS 2.0 format

### Performance
- Web Vitals reporting (INP, CLS, LCP) to `/api/vitals`
- Vercel Speed Insights + Vercel Analytics
- AVIF/WebP image formats
- Immutable cache for `/images` and `/fonts` (1 year)
- DNS prefetch/preconnect for external services
- Multi-tier caching: in-memory LRU (500 items, 50MB, 5min TTL) + HTTP cache headers

---

## 13. Security & Infrastructure

### Authentication
- Custom HMAC-SHA256 signed session tokens (Edge + Node compatible)
- 24h token expiry, httpOnly cookies
- Roles: admin, superadmin, vendor, user
- Granular admin permissions (dashboardAccess + allowedPages)

### Rate Limiting
- In-memory sliding window algorithm
- 9 pre-configured limiters: API (100/min), AUTH (5/15min), PASSWORD_RESET (3/hour), ORDERS (10/min), SEARCH (30/min), CONTACT (5/hour), REVIEWS (10/day), OTP (1/min), STRICT (3/15min)
- Rate limit headers on responses

### Bot Detection
- 5-layer detection: IP rate limiting, honeypot field, form timing, User-Agent filtering, Google reCAPTCHA v3

### Security Headers
- Content Security Policy (CSP) with Razorpay, Firebase, Google allowlists
- HSTS (2 years, includeSubDomains, preload)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (camera, microphone, geolocation, payment)
- Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy

### Middleware Authorization
- Path+method-based authorization for all API routes
- Admin API gate for `/api/admin/*`
- Partner API excluded (own CORS + auth)

### Encryption
- AES-256-GCM for partner API keys and Razorpay credentials
- 12-byte random IV with separate auth tag

### Email System
- Nodemailer SMTP transport
- 12+ email templates (order lifecycle, software licenses, cart abandonment, registration, vendor notification)
- 5 promotional templates
- Batch sending with anti-spam delays

### Cron Jobs
- Abandoned cart recovery: first email at 20min, follow-up at 1hr
- Currently disabled by default (uncomment in `instrumentation.ts` to enable)

---

## 14. Analytics & Reporting

### Admin Dashboard
- 6 stat cards: Total Sales, Total Orders, Online Payments, In-store Payments, Customers, Products
- Recent orders (top 5)
- Top products (top 5 by stock)
- MongoDB connection health

### Payment Analytics (`/admin/payments`)
- All Razorpay transactions
- Online vs In-store separation
- Summary stats (total, completed, pending)

### Spin Wheel Analytics
- Campaign overview stats
- Traffic charts (Recharts)
- Store-level tracking via QR codes
- CSV/Excel export

### Campaign History
- All sent email campaigns with sent/failed counts, timestamps

---

## 15. Admin Panel Features

### Navigation (27 sidebar items)
Dashboard, Products, Orders, Customers, Employees, Promotions, Email Campaigns, Campaign Pages, Spin Wheel, Leads, Advertisements, Product Ads, Hero Slides, Home Components, Features, Categories, Sub-Categories, Brands, Software, Payments, Partners, Partner Payouts, Complaints, Contact Inquiries, Blocked Pincodes, Store Locations, Settings

### Content Management
- Homepage sections: hero slides, split cards, animated banners, advertisements, deal of the day, popular/featured products, testimonials, categories
- Drag-and-drop reordering
- Image upload
- Schedule promotions
- Toggle visibility

### Database Management
- Clear products/categories/specs
- Schema migration tools
- localStorage-to-MongoDB migration

---

## 16. Launch Checklist

### Pre-Launch
- [ ] Set up MongoDB database and configure `MONGODB_URI`
- [ ] Configure `SESSION_SECRET` (≥16 chars) for production
- [ ] Set up Razorpay account and configure `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- [ ] Configure SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- [ ] Set `NEXT_PUBLIC_SITE_URL` to production domain
- [ ] Seed admin user: `npm run seed:admin`
- [ ] Load default email templates: use "Load Defaults" in `/admin/customer-centric/templates`
- [ ] Configure store settings at `/admin/settings` (name, logo, currency, tax, shipping)
- [ ] Add categories and sub-categories at `/admin/categories` and `/admin/sub-categories`
- [ ] Add brands at `/admin/brands` with landing pages
- [ ] Import products via Excel or Amazon scraper
- [ ] Set up product specifications
- [ ] Configure delivery pincodes at `/admin/blocked-pincodes`
- [ ] Add store locations at `/admin/store-locations`
- [ ] Configure homepage sections at `/admin/home`

### Campaign Setup
- [ ] Create email campaign templates
- [ ] Configure spin wheel campaigns with prizes
- [ ] Set up coupon codes for promotions
- [ ] Create campaign landing pages
- [ ] Configure lead forms with WhatsApp integration
- [ ] Set up hero slides and advertisements

### Partner Setup (if applicable)
- [ ] Create partner accounts
- [ ] Issue API keys
- [ ] Configure per-partner Razorpay credentials
- [ ] Set up wallet and payout system

### Go-Live
- [ ] Run `npm run build` and verify no errors
- [ ] Enable abandoned cart cron (uncomment in `instrumentation.ts`)
- [ ] Verify email delivery in production
- [ ] Test Razorpay payment flow end-to-end
- [ ] Verify SEO: sitemap, robots.txt, structured data
- [ ] Check `llms.txt` and `llm.txt` are accessible
- [ ] Test PWA manifest
- [ ] Monitor Web Vitals via `/api/vitals`

### Post-Launch
- [ ] Monitor campaign delivery rates
- [ ] Track spin wheel engagement
- [ ] Review partner payouts
- [ ] Analyze conversion funnel
- [ ] Update product catalog regularly
- [ ] Run flash sales and festival campaigns
- [ ] Monitor abandoned cart recovery rates

---

*Generated from codebase analysis. Platform: Next.js 15 App Router, React 19, MongoDB, Razorpay, Nodemailer.*
