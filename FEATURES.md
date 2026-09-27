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

### Homepage
- Hero carousel with configurable slides, CTA buttons, and scheduling
- Category circles with navigation
- Deal of the Day section (time-limited offers)
- Top brands marquee
- Category-based product sections (configurable from admin)
- Bank offers marquee
- Animated banners and split cards
- Recently viewed products
- Site features / trust badges
- Testimonials section
- Fully configurable from admin (`/admin/home`)

### Product Catalog (`/products`)
- Grid/list view with product cards
- **10 filter types:** Categories, Sub-categories, Product Types, Brands, Price Range (dual-slider 0-2L), Character Description, Customer Rating, Availability, Text Search, Description Search
- **Cross-faceted filtering:** each filter updates options based on other active filters
- **6 sort options:** Relevance, Price Low-High, Price High-Low, Discount, Rating, Name A-Z
- Pagination (20/50/100 per page)
- Compare toggle (max 6 products), Wishlist toggle, Add to Cart
- "X% OFF" badges, Trusted badges

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
- **Step 1:** Customer details (name, email, phone, address, city, state, pincode, country, employee ID)
- **Step 2:** Payment (Online via Razorpay or COD)
- Coupon code application/validation
- Separate GST for software vs hardware
- In-store purchase component
- India states/cities integration

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
- Hero slide uploads and ordering from `/admin/posters`
- Offers and promotions from `/admin/promotions`
- Category rails and curated product sections from `/admin/home-components`
- Publish, hide, duplicate, and reorder homepage sections

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
- Contact form submissions stored in DB
- Status management (new/contacted/resolved/archived)

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
