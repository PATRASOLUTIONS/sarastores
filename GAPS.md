# Sara Electronics — Gap Analysis: What's Missing to Compete with Amazon

> Audit of 30 standard e-commerce features + code quality issues.  
> Organized by priority for launch readiness.

---

## Critical Gaps (Must Fix Before Launch)

### 1. Security Vulnerabilities — DEBUG ROUTES EXPOSED

These routes have **no authentication** and are accessible in production:

| Route | Risk | File |
|-------|------|------|
| `PUT /api/direct-update/[id]` | Anyone can modify any product | `app/api/direct-update/[id]/route.ts` |
| `POST /api/clear_database` | Anyone can wipe all products/categories | `app/api/clear_database/route.ts` |
| `GET /api/debug/cookie` | Leaks raw session tokens | `app/api/debug/cookie/route.ts` |
| `GET /api/debug` | Leaks environment info | `app/api/debug/route.ts` |
| `GET /api/debug/carts` | Exposes user cart data | `app/api/debug/carts/route.ts` |
| `POST /api/debug/trigger-abandoned-cart` | Anyone can mass-send emails | `app/api/debug/trigger-abandoned-cart/route.ts` |
| `GET /api/debug-product/[id]` | Dumps all product IDs | `app/api/debug-product/[id]/route.ts` |

**Fix:** Delete all debug/direct-update routes, or add `NODE_ENV === 'development'` guards + auth checks.

### 2. Customer-Facing Order Cancellation

- Admin can cancel orders, but **customers cannot cancel their own orders**
- No cancel button on `/dashboard/orders/[id]`
- The order type supports `cancellation` metadata but customers can't trigger it
- No automated Razorpay refund integration

### 3. Return/Refund System

- No customer-facing return request form
- No return status tracking
- `refundStatus` field exists on orders but is manually set by admin — no actual payment refund API
- Customers have no way to initiate a return

### 4. Social Login (Google/Facebook)

- `lib/auth.ts` has `providers: []` — empty
- No Google, Facebook, or Apple OAuth configured
- Only email+password login available
- **This is a major conversion killer** — Amazon, Flipkart, Meesho all offer social login

### 5. EMI / Installment Payments

- No EMI option at checkout
- No integration with Bajaj Finserv, HDFC, or other EMI providers
- For electronics (your core category), EMI is essential — most TV/appliance purchases use EMI

### 6. Error Pages Branded as Microsoft Azure

- `app/error.tsx` and `app/error/page.tsx` are both styled as **Azure error pages** with Azure logos, portal links, and "© Microsoft Corporation"
- These show when any component crashes — customers see Azure branding instead of your store

---

## High Priority Gaps (Fix Within First Month)

### 7. Customer Wallet / Store Credit

- No customer wallet for refunds, gift credits, or cashback
- Partner wallet exists (B2B) but not for customers
- Refunds currently have no destination — they can't go to a wallet

### 8. Loyalty / Rewards Program

- No points system, no tiered membership
- No reward earning on purchases
- No redemption at checkout
- Amazon Prime / Flipkart Plus are major competitive moats

### 9. Back-in-Stock / Notify Me

- No subscription form for out-of-stock products
- No cron job to notify when items restock
- For electronics with supply constraints, this is critical

### 10. Flash Sale System (Admin-Configurable)

- `DealsOfTheDay` component exists but is cosmetic only
- Countdown is a midnight timer, not tied to a real sale event
- No admin panel to create/manage flash sales with start/end times, stock limits, or scheduling

### 11. Multiple Address Management

- Checkout has a single address form
- No address book, no saved addresses
- FAQ claims "up to 5 delivery addresses" but the feature doesn't exist
- Users must re-enter their address every order

### 12. Delivery Slot Selection

- Pincode-based delivery estimation exists
- No time slot selection (morning/afternoon/evening)
- Amazon offers 2-hour delivery windows — this is a competitive gap

### 13. Gift Cards / Gift Vouchers

- Mentioned in policy text but no functional implementation
- No creation, purchase, redemption, or balance checking
- Gift cards drive significant revenue during festivals

### 14. Email Verification

- `emailVerified: false` is written on signup but never verified
- No verification email sent, no verification endpoint
- Unverified emails can be used for all features

### 15. Phone OTP Login

- OTP exists for Spin Wheel and in-store purchase only
- No phone number login for regular accounts
- In India, phone OTP login is the primary auth method for many users

### 16. Affiliate / Referral Program

- No referral links, no commission-on-referral
- No affiliate tracking
- Meesho, Amazon, Flipkart all have strong referral programs

### 17. Price Drop Alerts

- No price tracking or alert subscriptions
- No notification when a product's price decreases
- Amazon's "Price Alert" is a key engagement feature

### 18. Abandoned Cart Recovery (Guest Users)

- Current cron only works for logged-in users (explicitly skips guest carts)
- Guest carts are the majority of abandoned carts
- The cron is also **disabled by default** (commented out in `instrumentation.ts`)

---

## Medium Priority Gaps (Fix Within First Quarter)

### 19. Product Q&A

- No Q&A section on product pages
- Customers can't ask questions, sellers can't answer
- Amazon's Q&A section drives purchase decisions

### 20. Product Bundles / Combo Deals

- No bundle creation system
- No "Frequently Bought Together" section
- No BOGO logic
- Bundle pricing is standard in electronics retail

### 21. Push Notifications

- No Web Push API integration
- No Firebase Cloud Messaging
- No admin broadcast feature
- Push notifications have 5-10x higher engagement than email

### 22. Live Chat / Chatbot

- FAQ mentions "live chat during business hours" but no chat widget exists
- No Intercom, Crisp, Tawk, or Zendesk integration
- No custom chat component

### 23. Product Video Support

- No video field in product schema
- No video embed on product pages
- Product videos increase conversion by 80%+ for electronics

### 24. Multi-Currency / i18n

- Hardcoded to English + INR
- No language switching, no currency conversion
- Blocks international expansion

### 25. Bulk Order / B2B Pricing

- No volume discount tiers on storefront
- Partner API has B2B flow but it's for API partners, not storefront customers
- No wholesale portal

### 26. Guest Abandoned Cart Recovery

- Cron explicitly skips carts without `userId`
- No email collection for guest carts
- Need to collect email early in cart flow for guest recovery

### 27. Size Guide / Product Guide

- No size guide modal
- No product guide downloads
- Relevant for accessories (cases, cables, mounts)

---

## Low Priority Gaps (Nice to Have)

| # | Feature | Notes |
|---|---------|-------|
| 28 | Wishlist Sharing | No shareable wishlist URL |
| 29 | Share Cart | No cart sharing functionality |
| 30 | AR / 3D Product Views | No `<model-viewer>` or Three.js integration |

---

## Code Quality Issues (Fix Before Launch)

### P0 — Security

| Issue | Impact | Location |
|-------|--------|----------|
| 7 debug API routes with no auth | Data leak, DB wipe, mass email | `app/api/debug/`, `app/api/direct-update/`, `app/api/clear_database/` |
| Azure-branded error pages | Unprofessional, confusing | `app/error.tsx`, `app/error/page.tsx` |

### P1 — Reliability

| Issue | Impact | Location |
|-------|--------|----------|
| 907 console.log statements in production | Performance, info leak | `hooks/useCart.ts`, `app/admin/orders/`, `app/api/orders/` |
| 15+ unbounded MongoDB queries (no `.limit()`) | Server crash at scale | `/api/coupons/validate` (fetches ALL products), `/api/admin/send-campaign`, etc. |
| 919 TypeScript `any` types | No compile-time safety | `app/admin/orders/[id]/page.tsx` (60+), `app/product/[slug]/page.tsx` (15) |
| 66+ empty catch blocks | Silent failures | Throughout codebase |
| Zero test files | No regression safety | Nowhere |
| N+1 query in order tracking | 15 sequential DB queries | `app/api/orders/[id]/track/route.ts` |

### P2 — Quality 

| Issue | Impact | Location |
|-------|--------|----------|
| Zod schemas exist but aren't used | No input validation | `lib/validation.ts` (20+ schemas, 0 imports) |
| 24 raw `<img>` without error handling | Broken images | `app/products/page.tsx`, `app/admin/`, etc. |
| 85+ routes missing `loading.tsx` | No streaming/suspense boundaries | Most admin, dashboard, product pages |
| Dead code (React state in API routes) | Confusing, potential bugs | `app/api/clear_database/route.ts` |
| Hardcoded DB name "ecommerce" | Wrong database in production | `app/api/debug-product/[id]/route.ts` |

---

## Priority Roadmap

### Week 1 — Security & Critical Fixes
1. Delete or lock down all debug/direct-update/clear_database routes
2. Replace Azure error pages with branded error pages
3. Add customer order cancellation flow
4. Add return/refund request form

### Week 2 — Conversion Essentials
5. Add Google OAuth login
6. Add phone OTP login
7. Add EMI payment option at checkout
8. Add email verification on signup
9. Fix abandoned cart cron (uncomment, add guest cart support)

### Week 3 — Customer Retention
10. Add multiple address management
11. Add customer wallet / store credit
12. Add back-in-stock notifications
13. Add price drop alerts
14. Add delivery slot selection

### Week 4 — Growth Features
15. Add flash sale system (admin-configurable)
16. Add gift card system
17. Add affiliate/referral program
18. Add loyalty/rewards points

### Month 2 — Engagement
19. Add product Q&A
20. Add product video support
21. Add push notifications
22. Add live chat widget
23. Add product bundles / combo deals

### Month 3 — Code Quality
24. Wire up Zod validation on all forms
25. Add loading.tsx to all routes
26. Remove console.log statements
27. Add basic test infrastructure (Vitest + Playwright)
28. Fix unbounded queries (add pagination/limits)
29. Reduce `any` types in critical paths

---

*Generated from codebase audit. 23 of 30 standard e-commerce features are missing or incomplete.*
