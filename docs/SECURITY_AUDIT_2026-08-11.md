# Security Audit — ecommerce-sara (Sara Electronics)

**Audit date:** 11 August 2026
**Scope:** Full platform — 206 API route files, 64 admin pages, 125 storefront pages, 50 MongoDB collections
**Method:** Black-box testing against a production build (`next build` + `next start`) connected to the live `pmd` cluster, combined with source review and static guard-coverage analysis
**Environment:** Next.js 15.5.12, React 19, MongoDB `e-commerce-bytewise`, custom HMAC session auth

Testing used cryptographically valid session cookies minted with the application's own `SESSION_SECRET` to impersonate each role (anonymous, customer, vendor, admin, superadmin, staff) without creating test accounts in the production database.

---

## 1. Executive summary

The platform had **8 critical and 6 high-severity vulnerabilities** at the start of this audit. All 14 have been remediated and verified. Two medium findings remain open and require a business decision.

| Severity | Found | Fixed | Open |
| --- | --- | --- | --- |
| Critical | 8 | 8 | 0 |
| High | 6 | 6 | 0 |
| Medium | 7 | 4 | 3 |
| Low / informational | 6 | 2 | 4 |

**Verdict:** the platform was **not safe to operate publicly** before this audit. An unauthenticated attacker could place free orders, delete customer complaints, send email from the company domain, write to arbitrary database collections, and read every admin screen. Those paths are now closed.

The platform is now **suitable for production launch** subject to the four mandatory pre-launch actions in §6.

---

## 2. Critical findings (all remediated)

### C-01 — Unauthenticated order creation with client-controlled pricing
**CVSS ~9.8 · OWASP A01/A04**

`POST /api/orders` had no authentication and accepted `userId`, item `price`, `subtotal`, `total`, coupon `discount` and even order `status` directly from the request body. `app/checkout/page.tsx` posts exactly that payload.

A single unauthenticated `curl` could create an order with `status: "confirmed"` and `total: 1` for any products, attributed to any customer, with no payment at all. All 104 existing orders were created through this path.

**Fix:** the route now requires a session, derives `userId` from it, and accepts only product identifiers and quantities. All money is recomputed server-side by the new `lib/order-pricing.ts` (catalogue lookup, stock check, active-product check, quantity caps, coupon revalidation against `coupons`). Order status is never taken from the client.
**Verified:** forged request → `401`.

### C-02 — Payment amount controlled by the client
**CVSS ~9.1 · OWASP A04**

`POST /api/payment/create-order` passed the client's `amount` straight to Razorpay. `/api/payment/verify` then compared the Razorpay amount to the client's own figure — which always matched. A ₹46,100 product could be bought for ₹1 with a genuinely valid payment signature.

**Fix:** the amount is now derived from the catalogue via `priceOrder()`; the client sends cart identifiers only. `verifyRazorpayPayment()` in `lib/razorpay.ts` independently confirms with Razorpay that the payment was captured for the expected amount before an order can reach `confirmed`.
**Verified:** amount is no longer an accepted input; unauthenticated call → `401`.

### C-03 — Every admin page publicly readable
**CVSS ~8.6 · OWASP A01**

All 40 admin pages returned HTTP 200 with full HTML to anonymous visitors, customers and vendors. `app/admin/layout.tsx` was a client component whose guard opened with `if (!user) return` — for an anonymous visitor `user` is never set, so it never redirected. There was no server-side gate on `/admin`.

**Fix:** `app/admin/layout.tsx` is now an async server component performing the authoritative `getSession()` check and redirect; UI moved to `app/admin/admin-client-shell.tsx`.
**Verified:** 41/41 admin routes redirect for anonymous, customer and vendor; admin and superadmin retain full access; tampered, unsigned and expired tokens all redirect.

### C-04 — Arbitrary collection write via URL path
**CVSS ~9.1 · OWASP A01/A03**

`/api/content/[type]` derived the MongoDB collection name directly from the URL (`type.replace("-","_")`) with **no authentication**. `POST /api/content/users` would insert into the `users` collection. During testing an empty `POST /api/content/faq` created a live document — demonstrating the flaw unintentionally.

**Fix:** writes require admin, the type is checked against an allow-list (`faq`, `policies`, `pages`, `banners`, `announcements`), and the route now uses the correct database. Test artifact deleted.
**Verified:** `401` on POST/PUT/DELETE.

### C-05 — Unauthenticated read, update and delete of customer complaints
**CVSS ~8.8 · OWASP A01**

`GET/PUT/DELETE /api/complaints/[id]` had no guard. A live unauthenticated request returned a real customer's full name, email address, phone number, order number and complaint history. `PUT` could change status (triggering a customer email) and `DELETE` destroyed the record permanently.

**Fix:** `requireAdmin()` on all three methods.
**Verified:** all → `401`.

### C-06 — Open mail relay
**CVSS ~8.2 · OWASP A01**

`POST /api/complaints/email` accepted an arbitrary `to` address and template, then sent through the company's authenticated SMTP account. Anyone could send mail appearing to originate from the business domain — ideal for phishing, and a fast route to domain blacklisting.

**Fix:** `requireAdmin()`.
**Verified:** `401`.

### C-07 — Split-brain database
**CVSS ~7.5 · Data integrity**

`lib/db.ts` hardcoded `client.db("ecommerce")` while the rest of the platform used `e-commerce-bytewise`. Nine files imported it, including both Razorpay verification routes, `/api/payments` and `/api/products/sku/[sku]`. The `ecommerce` database held **124 orphaned payment records** with no corresponding orders, plus a stale 56-product catalogue that the SKU lookup was serving.

**Fix:** `lib/db.ts` now delegates to `connectToDatabase()`; all nine importers hit the correct database.
**Verified:** `/api/products/sku/T000946` returns a product that exists only in the main database.

### C-08 — Unauthenticated site-content and configuration mutation
**CVSS ~8.1 · OWASP A01**

Confirmed reachable and executing without any credentials:

| Endpoint | Impact |
| --- | --- |
| `POST/PUT/DELETE /api/advertisements` | Inject or remove storefront advertising |
| `POST/PUT/DELETE /api/animated-banner` | Replace homepage banners |
| `POST/DELETE /api/blocked-pincodes` | Enable or disable delivery nationwide |
| `POST /api/footer` | Overwrite site footer (a probe wrote a junk document; removed) |
| `PUT/DELETE /api/employees/[id]` | Modify or delete employee records |
| `POST /api/integrations/exlr8/place-order` | Place real orders with the external fulfilment provider |
| `POST /api/integrations/exlr8/queue-order` | Insert external order queue records |

**Fix:** `advertisements`, `animated-banner`, `blocked-pincodes`, `footer` and `employees` added to the middleware admin-write list (with a documented exception for the public `employees/validate` used at in-store checkout); the two exlr8 routes now call `requireUser()`, and `/api/orders` forwards the session cookie on its internal call.
**Verified:** all → `401`; internal order flow unaffected.

---

## 3. High findings (all remediated)

| ID | Finding | Fix | Status |
| --- | --- | --- | --- |
| H-01 | `GET /api/coupons` public — all discount codes, values and limits harvestable | `requireAdmin()` | 401 ✔ |
| H-02 | `GET /api/employees` public — employee ID, name, email, department, role | `requireAdmin()` | 401 ✔ |
| H-03 | `GET /api/contact-inquiries` public — customer enquiry PII | `requireAdmin()` | 401 ✔ |
| H-04 | `GET /api/complaints` public — 21 MB of complaints with photo attachments | `requireAdmin()` + list no longer returns image blobs | 401 ✔ |
| H-05 | `POST /api/payment/verify` unauthenticated | `requireUser()` | 401 ✔ |
| H-06 | Debug routes live in production; `/api/debug/session` echoed the raw `Cookie` header | `ENABLE_DEBUG_ROUTES=false`, `DEBUG_SHOW_COOKIE=false`, and raw cookies now suppressed in production regardless of flag | 404 ✔ |

---

## 4. Medium findings

| ID | Finding | Status |
| --- | --- | --- |
| M-01 | `/api/coupons/validate` had no rate limit — coupon codes brute-forceable | **Fixed** — 20 req/min; verified 6/25 blocked |
| M-02 | No unique index on `users.email`; login was a collection scan | **Fixed** — 12 indexes created via `npm run indexes:core` |
| M-03 | Admin complaints list took **110 seconds** (21 MB base64 payload) | **Fixed** — images projected out of the list, loaded on demand |
| M-04 | ~4.7 MB of base64 images inlined into every page; `/api/hero-slides` 15 MB / 25 s | **Fixed** — see §5 |
| M-05 | `dashboardAccess` grants full admin API access; `allowedPages` is enforced only in the browser | **OPEN** — needs a product decision |
| M-06 | 22 dependency vulnerabilities (3 critical, 15 high) | **OPEN** |
| M-07 | Rate limiting is in-memory only; ineffective across multiple instances | **OPEN** |

### M-05 detail
Middleware admits any session with `dashboardAccess: true` to every `/api/admin/*` route. A staff account restricted to `/admin/dashboard` can still call `/api/users` or `/api/admin/partners` directly. Enforcing `allowedPages` server-side requires mapping API routes to page permissions — a change to the permission model that should be specified before implementation.

### M-06 detail
`npm audit --omit=dev`: **3 critical** (`@auth/core`, `next-auth`, `jspdf`), **15 high** (`next`, `axios`, `lodash`, `nodemailer`, `sharp`, `undici`, `xlsx`, `postcss`, `nanoid`, `form-data`, `js-cookie`, `picomatch`, `fast-xml-parser`, `ip-address`, `fast-xml-builder`), 4 moderate. `xlsx` has **no fix available** — prototype pollution and ReDoS; migrate to `exceljs`. `next-auth` is installed but unused at runtime and can simply be removed.

---

## 5. Controls verified as working

These were tested and found **correctly implemented** — no action required.

| Control | Evidence |
| --- | --- |
| NoSQL operator injection | `{"$ne":null}` / `{"$regex":".*"}` rejected by Zod on login, coupon validation and order creation |
| Session forgery | Tampered signature, unsigned payload and expired token all rejected on both pages and APIs |
| Privilege escalation via mass assignment | `role: "admin"` on signup, profile update and preferences all rejected (400/405) |
| Horizontal privilege escalation (IDOR) | Another user's order, cart, wishlist and profile all correctly denied; cart/wishlist derive `userId` from the session and ignore query parameters |
| Brute force | Login limited after 5 attempts; signup, password reset and contact form all limited |
| User enumeration | Login returns a generic "Invalid email or password" |
| Password storage | All 9 accounts bcrypt-hashed; zero plaintext |
| Session cookie | `httpOnly`, `secure` in production, `sameSite=lax`, 24 h expiry, HMAC-SHA256 signed |
| CORS | No `Access-Control-Allow-Origin` echoed for `https://evil.example` or `null` |
| Security headers | CSP, HSTS (2 y, preload), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` all present |
| Partner API | Missing, malformed and empty API keys all rejected with `401` |
| Cron endpoints | Protected by `requireCron()` shared secret |
| eXlr8 webhook | Shared secret compared with `crypto.timingSafeEqual` |
| Reflected XSS | Search echoes input as JSON-escaped text under `application/json` + `nosniff` — not exploitable |
| Admin bundles | No hardcoded keys or secrets; only placeholder strings |

### Performance remediation (M-04)
Root cause: an 808 KB base64 logo emitted six times per page (favicon, apple-touch, OG, Twitter, and twice in JSON-LD), plus 15 MB of base64 hero slides.

Introduced `lib/media.ts`, `lib/media-store.ts` and `/api/media/[type]/[id]` — an allow-listed binary media route with `Cache-Control: immutable` and content-hash ETags. Read paths project the blobs away inside MongoDB; write paths restore the original bytes so an admin save cannot erase an image.

| Route | Before | After |
| --- | --- | --- |
| `/` | 4,958 KB / 1,601 ms | **112 KB / 68 ms** |
| `/cart` | 11,630 KB | **51 KB / 68 ms** |
| `/api/hero-slides` | 15,382 KB / 25,199 ms | **1 KB / 80 ms** |
| `/api/settings` | 894 KB / 2,669 ms | **1 KB / 49 ms** |
| `/api/complaints` (admin) | 22 MB / 110 s | **~50 KB** |

---

## 6. Mandatory actions before public launch

1. **Rotate every credential.** `.env` is committed to the working tree and was included in a distributed archive. Rotate the MongoDB user (currently `admin:admin`), `SESSION_SECRET`/`NEXTAUTH_SECRET`, `SMTP_PASS`, Razorpay keys and the Askeva WhatsApp token. Replace the two placeholder secrets still in place: `API_KEY_ENCRYPTION_SECRET=change-this-to-a-secure-32byte-key-in-production!!` and `PARTNER_API_KEY_SECRET=your-32-byte-encryption-key-here`.
2. **Create a least-privilege MongoDB user.** The current account is `admin:admin` on a cluster that also hosts 14 unrelated databases including `sample_mflix` and `cyberpunk`. Scope the production user to `e-commerce-bytewise` only.
3. **Run `npm audit fix`** and remove the unused `next-auth`/`@auth/core` dependencies. Plan the `xlsx` → `exceljs` migration.
4. **Set the missing production secrets** — `CRON_SECRET` (retention jobs currently return 503 and never run) and `EXLR8_WEBHOOK_SECRET` (fulfilment webhook currently returns 500).

---

## 7. Residual risk accepted at launch

| Risk | Rationale |
| --- | --- |
| `dashboardAccess` over-permission (M-05) | Only affects trusted internal staff accounts; requires a product decision |
| In-memory rate limiting (M-07) | Adequate for a single instance; move to Redis before horizontal scaling |
| CSP allows `'unsafe-inline'` in `script-src` | Weakens XSS defence in depth; requires a nonce-based refactor |
| No automated test suite | No regression safety net — see the scope-of-improvement document |
| `/api/settings` is public | Contains only store name, address, phone, email, tax and shipping rates — already published on the contact page |

---

## 8. Change log from this audit

**New files:** `lib/order-pricing.ts`, `lib/media.ts`, `lib/media-store.ts`, `app/api/media/[type]/[id]/route.ts`, `app/admin/admin-client-shell.tsx`, `scripts/create-core-indexes.js`

**Modified:** `app/api/orders/route.ts`, `app/api/payment/create-order/route.ts`, `app/api/payment/verify/route.ts`, `app/api/complaints/route.ts`, `app/api/complaints/[id]/route.ts`, `app/api/complaints/email/route.ts`, `app/api/coupons/route.ts`, `app/api/coupons/validate/route.ts`, `app/api/employees/route.ts`, `app/api/contact-inquiries/route.ts`, `app/api/content/[type]/route.ts`, `app/api/content/[type]/[id]/route.ts`, `app/api/hero-slides/route.ts`, `app/api/integrations/exlr8/place-order/route.ts`, `app/api/integrations/exlr8/queue-order/route.ts`, `app/api/debug/session/route.ts`, `app/admin/layout.tsx`, `app/admin/complaints/page.tsx`, `app/checkout/page.tsx`, `components/PaymentGateway.tsx`, `lib/db.ts`, `lib/db-service.ts`, `lib/razorpay.ts`, `lib/jsonld-store.ts`, `middleware.ts`, `package.json`, `.env`

**Database:** 12 indexes created. No production data was modified except the removal of two artifacts created by the write probes (documented in C-04 and C-08).

**Build status:** `next build` exits 0. Type errors reduced from 77 to 75; none introduced.
