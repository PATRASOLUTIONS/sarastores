# Bug Report — Sara Electronics

**Date:** 2026-09-25
**Scope:** Bugs found and verified during the mobile build-out and security review.
Each entry states how it was proven, not merely suspected.

---

## Fixed during this engagement

### BUG-01 · Payment taken, order rejected — **Critical**
**Where:** `mobile/src/api/checkout.ts`
`/api/orders` reads `paymentDetails.paymentId`. The app was sending only `razorpay_payment_id`, so the server returned `400 Payment reference missing` — **after Razorpay had already charged the customer.** Money out, no order created.
**Proof:** POSTing the original payload returned `400 Payment reference missing`. Now sends both keys; `create-order` verified live at `amount=3580000`.
**Status:** Fixed, covered by `scripts/test-mobile-auth.mjs`.

---

### BUG-02 · `/api/products` exceeded Vercel's response limit — **Critical**
**Where:** `app/api/products/route.ts`
At 10,000 products the endpoint returned **17.93 MB** (full) and **6.10 MB** (`fields=card`). Vercel's serverless response ceiling is **4.5 MB** — both are a hard 500 in production. The catalogue would have failed on launch day while working perfectly in local dev.
**Fix:** `DEFAULT_LIMIT=500`, `MAX_LIMIT=1000`, skip-based pagination, `X-Total-Count` headers.
**Result:** 17.93 MB → **0.94 MB**; 6.10 MB → **0.28 MB**.

---

### BUG-03 · Search returned nothing when combined with a limit — **High**
**Where:** `app/api/products/route.ts`
`?search=x&limit=6` returned zero results. The limit was applied in MongoDB *before* the search filter ran in Node, so the filter operated on an arbitrary 6-document slice.
**Fix:** search pushed into MongoDB as an escaped case-insensitive regex on name + description.
**Result:** correct results, and **2584 ms → 22 ms** at 10k products.

---

### BUG-04 · Order history did a full collection scan — **High**
**Where:** `orders` collection
`orders.find({}).sort({createdAt:-1})` had no supporting index — a COLLSCAN examining every document to return 50.
**Fix:** added the `orders.recent` index.
**Result:** 15,000 documents examined → **50**.

---

### BUG-05 · Stored XSS via JSON-LD — **High**
**Where:** 37 JSON-LD blocks across the site
`JSON.stringify` does not escape `<`, `>` or `&`, so a product name containing `</script>` would break out of the tag. Product names come from Excel upload and the Amazon scraper — untrusted sources.
**Proof:** `JSON.stringify({name:'TV</script><script>alert(1)</script>'})` emits the closing tag verbatim. 956 live products scanned — 0 currently exploit it, so this was latent.
**Fix:** `lib/jsonld-safe.ts` applied everywhere. Verified 0/37 blocks contain raw angle brackets and all still parse.

---

### BUG-06 · Signed-out users saw a blank screen — **High (UX)**
**Where:** `mobile/app/orders.tsx`, `mobile/app/wishlist.tsx`
Tapping "My Orders" while signed out rendered an empty body — no message, no prompt. Indistinguishable from a crash.
**Fix:** `SignInRequired` state component.

---

### BUG-07 · Three undeclared Android permissions — **High (store risk)**
**Where:** generated `AndroidManifest.xml`
`expo-file-system` / `expo-image` pulled in `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` **unscoped** (no `maxSdkVersion`, so they apply on Android 13+ and appear in the Play listing), plus `SYSTEM_ALERT_WINDOW`.
**Fix:** `android.blockedPermissions`. Verified they now render as `tools:node="remove"`.
**Shipped set:** LOCATION ×2, CAMERA, INTERNET, POST_NOTIFICATIONS, VIBRATE.

---

### BUG-08 · iOS app icon had an alpha channel — **High (auto-rejection)**
**Where:** `mobile/assets/icon.png` (colorType 6)
Apple rejects icons with alpha via **ITMS-90717** before human review. The upload would have bounced.
**Fix:** flattened `icon-ios.png` (colorType 2) wired to `ios.icon`. Android's adaptive foreground deliberately keeps its alpha.

---

### BUG-09 · Missing iOS privacy manifest — **High (store risk)**
Dependencies ship their own manifests in `node_modules`, but the app had none of its own.
**Fix:** `ios.privacyManifests` with the four required-reason API codes and eight declared data types.

---

### BUG-10 · Two missing native peer dependencies — **High**
`expo-font` and `react-native-worklets` were absent. The app ran in Expo Go but would **crash in a standalone build** — the exact build you submit.
**Proof:** `npx expo-doctor` (now 18/18).

---

### BUG-11 · Checkout form blank after sign-in — **Medium**
`useState` initialiser captured `user` while it was still `null`; later hydration never propagated. Fixed with `useEffect`.

---

### BUG-12 · Advertised EMI differed from the website — **Medium**
App showed **₹2,182**, website **₹2,550** for the same product — app used `display.emi.lowestPerMonth`, site uses `perMonth` (price ÷ tenure). Two different advertised prices for one product is a consumer-protection problem, not just a display bug.
**Fix:** headline uses `perMonth`; `lowestPerMonth` retained for the EMI detail panel.

---

### BUG-13 · Product badge washed out — **Low**
Stock overlay rendered after the discount badge. Fixed by reordering.

---

### BUG-14 · Duplicate search bars — **Low**
Products screen rendered its own input plus `StoreHeader`'s. `StoreHeader` now accepts controlled `searchValue`/`onSearchChange`.

---

### BUG-15 · Hero CTA ignored its own destination — **Low**
`router.push(slide.href === "/offers" ? "/(tabs)/search" : "/(tabs)/search")` — both branches identical, so "See All Offers" went to search. Fixed once `/offers` existed.

---

## Open — not fixed

### BUG-16 · Scheduled jobs silently did nothing — **FIXED**
**Where:** `instrumentation.ts`, `vercel.json`

`instrumentation.ts` logged **`✅ Cron jobs initialized successfully`** while the import beneath
it was commented out. The platform reported healthy scheduling while nothing ran.

`vercel.json` did have a `crons` block — `CLAUDE.md` was wrong about that — but it scheduled
**only 1 of the 5** retention jobs.

| Job | Before | Now (UTC) | IST |
|---|---|---|---|
| `rebuild-profiles` | not scheduled | `0 1 * * *` | 06:30 |
| `segment-customers` | not scheduled | `30 1 * * *` | 07:00 |
| `cart-recovery` | `0 3 * * *` | unchanged | 08:30 |
| `wishlist-alerts` | not scheduled | `30 4 * * *` | 10:00 |
| `lifecycle-reminders` | not scheduled | `30 5 * * *` | 11:00 |

Ordered by dependency — profiles rebuild first, then segmentation, then the three messaging
jobs, which read that data. Sends land mid-morning IST rather than overnight.

The misleading log block was removed and replaced with a comment explaining why node-cron
cannot work on serverless (each invocation is a fresh short-lived process with no timer).

**Verified** with `scripts/verify-cron-jobs.mjs` — 14/14: every job registered in `vercel.json`,
all reject anonymous callers with 401, a wrong secret is rejected, and each messaging job
executes end-to-end via `?dryRun=1`. Vercel Cron issues **GET**, and all five routes accept it.

---

### BUG-23 · Retention pipeline has no opt-in path — **OPEN, blocks BUG-16 from delivering value**

Scheduling the jobs was necessary but is not sufficient. Measured against the live database:

```
customer_profiles      : 4
  consent.email   true : 0
  consent.whatsapp true: 0
  consent.sms     true : 0
```

`DEFAULT_CONSENT` in `lib/customer-profile.ts` is `{ email: false, whatsapp: false, sms: false }`,
which is **correct** under India's DPDP Act — marketing consent must be explicit opt-in.

The problem is there is no way to opt in during the flows customers actually use. Neither
`/api/auth/signup`, `/register` nor `/checkout` collects consent; the only surface is
`/account/preferences`, which a customer has to seek out.

Observed live: `cart-recovery` found **2 candidates and skipped both for consent**. The pipeline
works perfectly and will send nothing.

**Recommended:** add an unticked marketing opt-in checkbox to registration and checkout, with
clear wording, writing through `setConsent()`. Deliberately not implemented here — wording and
placement of a consent control is a legal decision, not a code change.

---

### BUG-17 · Production build ignores all errors — **High**
`next.config.mjs` sets `ignoreBuildErrors` and `ignoreDuringBuilds`. A build with 48 type errors ships successfully. `npm run lint` is also broken — no ESLint config or dependency is installed.

`npx tsc --noEmit` is the only real gate, and nothing enforces it.

---

### BUG-18 · 120 route files have no in-handler guard — **High**
76 of them expose a write method. They are safe only while middleware holds. See the security report.

---

### BUG-19 · `/vendor` is client-gated only — **Medium**
`app/vendor/layout.tsx` is `"use client"` and redirects in `useEffect`. Anonymous visitors receive the HTML shell before the redirect fires. Follow the `app/account/layout.tsx` server-gate pattern.

---

### BUG-20 · Deep links resolve to nothing — **Medium**
`/.well-known/apple-app-site-association` and `/assetlinks.json` both return 404.
**Diagnosed:** the rewrite works correctly — the handler returns its own JSON `{"error":"IOS_APP_ID is not configured"}`, not a Next HTML 404. Only the env vars are missing.

Android needs **both** the upload-key and Play App Signing fingerprints, or links work in testing and break in production.

---

### BUG-21 · Customer PII in a repo-root file — **High**
`order_debug_dump.json` holds a real order with name, email, phone, address. Not gitignored; no git repo exists yet, so the first commit would capture it permanently.

---

### BUG-22 · Placeholder app artwork — **Medium (blocks submission)**
Icon and splash are generated placeholders (47 KB). Both stores reject placeholder art.

---

## Incident: data changed by a verification script

**Date:** 2026-09-25 18:03 UTC · **Cause:** my own test tooling, not application code.

A script written to prove the new route guards let admins through sent **authenticated
empty-body POSTs**. An empty body is valid input for several handlers, so they executed.

| Endpoint | Effect | Resolution |
|---|---|---|
| `POST /api/products/activate-all` | Set `active: true` on all 960 products | **4 products identified — see below** |
| `POST /api/product-slides` | Created one empty slide | Deleted via `scripts/cleanup-empty-slides.mjs` |
| `POST /api/settings` | None — `$set` upsert merges, 16 keys intact | No action |
| `POST /api/footer` | None — collection is not read by `components/Footer.tsx` | No action |

### The four re-activated products

The catalogue went from **956 to 960 visible** (`/api/products` filters `active: true`).
Recovered by diffing an IndexedDB cache snapshot taken at **15:42 UTC — before the incident** —
against the live catalogue. Exactly 4 appeared and exactly 4 were pushed off the 500-row window,
which is arithmetically consistent with 4 insertions.

| ID | SKU | Name |
|---|---|---|
| `6911afc7d1b32f695925a960` | T008224 | LG 1.5 Ton 3 Star DUAL Inverter Split AC |
| `6911afc7d1b32f695925a96c` | T008225 | "Key Features Dual Inverter Compressor…" — **name is a description fragment** |
| `6911afc7d1b32f695925a971` | T008367 | LG 1 Ton 3 Star DUAL Inverter Split AC |
| `699bdeae87e9d4fdd155d330` | T006491 | Livpure GoodAir Window 52L Air Cooler |

Three are LG air conditioners from the same import batch (`createdAt` within 0.5 s of each other),
and one has a malformed name — consistent with a deliberate group deactivation of bad import rows.

**Not yet reverted.** Restoring them is a judgement call on data I cannot verify with certainty:

```
node scripts/inspect-reactivated-products.mjs --hide
```

### Rule adopted

Never send an authenticated write to prove a guard works. Test the anonymous side over HTTP
(rejected before the handler runs) and assert the authorised side **statically** from source.
`scripts/verify-route-guards-safe.mjs` does this — 44/44.

---

## Corrections to existing documentation

`CLAUDE.md` lists two defects that are **no longer real** — verified today:

| Documented claim | Reality |
|---|---|
| "Post-order cart never cleared — `getCollection("cart")` singular" | Line 691 now reads `getCollection("carts")`. **Fixed.** |
| "Debug routes `/api/debug/session`, `/api/test-db`, `/api/test-connection` are unguarded" | All 9 debug/test/seed routes gate on `NODE_ENV !== "development"`. Open in dev only. |

I initially reported the debug routes as a production exposure myself; that was a false positive from a grep that only matched `NODE_ENV === "production"`. Re-verified before publishing.

---

## Summary

| Severity | Fixed | Open |
|---|---|---|
| Critical | 2 | 0 |
| High | 7 | 6 |
| Medium | 3 | 3 |
| Low | 3 | 0 |
| **Total** | **15** | **9** |

The most consequential open item is **BUG-16** — not because it is hard, but because the system reports success while doing nothing, so it will not be noticed until someone asks why retention email volume is zero.
