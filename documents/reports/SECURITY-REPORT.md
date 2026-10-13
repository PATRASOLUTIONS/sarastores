# Security Report — Sara Electronics

**Date:** 2026-09-25
**Scope:** Next.js web platform (`/`) + Expo mobile app (`mobile/`)
**Method:** Live anonymous probing, static guard analysis, dependency audit, code review
**Reproduce:** `node scripts/probe-auth-bypass.mjs <url>` · `node scripts/audit-route-guards.mjs` · `node scripts/verify-jsonld-escaping.mjs <url>`

---

## 1. Executive summary

| Area | Verdict |
|---|---|
| Authorization enforcement | **Strong** — anonymous probe of 26 sensitive endpoints exposed **zero** admin records |
| Money integrity | **Strong** — all pricing recomputed server-side |
| Session handling | **Strong** — HMAC tokens, rotation with reuse detection |
| Dependency hygiene | **Weak** — 57 web advisories, 4 critical |
| Rate limiting | **Weak** — in-memory, resets every cold start |
| Data-at-rest hygiene | **Weak** — customer PII sitting in a repo-root JSON file |

**Overall: the application logic is defensively written; the supply chain and operational hygiene are not.**

The single most serious issue is not a coding flaw — it is that the installed Next.js has a **published middleware-bypass advisory**, and this application places meaningful authorization load on middleware.

---

## 2. What I tested, and what actually happened

I probed 26 sensitive endpoints with no cookie and no bearer token — the view from the open internet.

```
GET  /api/admin/partners          BLOCKED    (partner PII + API keys)
GET  /api/admin/customers         BLOCKED    (customer PII)
GET  /api/users                   BLOCKED    (user PII)
GET  /api/leads/export            BLOCKED    (lead PII)
GET  /api/software/license-keys   BLOCKED    (sellable licence keys)
POST /api/products/bulk-price-update  BLOCKED   (repricing the catalogue)
POST /api/coupons                 BLOCKED    (minting discounts)
POST /api/employees               BLOCKED    (creating staff)
...
anonymous reads returning 200 on protected data : 0
writes reachable without auth                   : 0
```

**No admin data leaked and no write handler was reachable.** Defence in depth is working.

### The caveat that matters

Static analysis shows **120 of 244 route files have no in-handler guard**, 76 of which expose a write method:

```
guarded in-handler : 124
NOT guarded        : 120
  ...with a write method : 76
  ...under an admin path : 0
```

Those 120 routes are safe **only because `middleware.ts` is stopping the request first**. That is a single point of failure, and see §3 for why that specific point of failure currently has a CVE against it.

---

## 3. Highest-risk finding: middleware bypass advisory

| | |
|---|---|
| **Component** | `next@15.5.12` |
| **Advisory** | *Middleware / Proxy bypass in App Router applications via segment-prefetch routes* |
| **Affected** | `>=15.2.0 <15.5.18` — **you are inside this range** |
| **Severity here** | **High**, and higher for this app than for most |

Most applications treat middleware as a convenience. This one treats it as an authorization layer for roughly half the API surface. A middleware bypass in this architecture is not a partial failure — it exposes every one of those 120 unguarded routes at once.

**Fix:** upgrade to `next@>=15.5.24` (also clears the Windows RCE in §4). Then add in-handler guards so middleware is defence in depth rather than the only defence.

---

## 4. Other notable dependency findings

| Severity | Package | Issue | Real-world exposure here |
|---|---|---|---|
| Critical | `next` | Unauthenticated RCE on **Windows-hosted** servers | Low in production (Vercel is Linux). **Relevant to your Windows dev machine.** |
| Critical | `@auth/core` / `next-auth` | Homoglyph `@` bypass in email normaliser | **None** — `next-auth` is installed but unused at runtime |
| Critical | `jspdf` | HTML injection via new-window paths | Low — used for admin invoices/pamphlets |
| High | `axios` | Prototype-pollution → MITM / credential theft | Moderate — depends where axios is used server-side |
| High | `lodash` | Code injection via `_.template` | Low — transitive, template feature not used |

Full list: `npm audit`. Mobile is cleaner: 19 advisories, 0 critical, and the two "high" items (`postcss`, `image-size`) are build-time only and never reach the shipped bundle.

---

## 5. Vulnerability found and fixed during this review

### Stored XSS via JSON-LD structured data — **fixed**

Every structured-data block was serialised with bare `JSON.stringify` inside `dangerouslySetInnerHTML`. `JSON.stringify` does **not** escape `<`, `>` or `&`:

```js
JSON.stringify({ name: 'TV</script><script>alert(document.cookie)</script>' })
// → {"name":"TV</script><script>alert(document.cookie)</script>"}
//                ^ closes the tag — everything after runs as HTML
```

This matters because product names are **not** trusted input. They arrive from Excel bulk upload and the Amazon scraper. One poisoned product title would have executed script on every visitor to that product page — and, via `SiteJsonLd`, potentially site-wide.

I verified no current product exploits it (956 scanned, 0 containing `<` or `>`), so this was latent rather than active.

**Fixed** by adding [lib/jsonld-safe.ts](lib/jsonld-safe.ts) and routing all 37 JSON-LD blocks through it. Escaping to `\uXXXX` keeps the JSON semantically identical for search engines while making tag breakout impossible.

```
37 JSON-LD blocks checked
blocks with raw < or > : 0
blocks that no longer parse as JSON : 0
```

Regression guard: `node scripts/verify-jsonld-escaping.mjs <url>`

---

## 6. Controls that are genuinely well built

These deserve credit — they are the reason the anonymous probe came back clean.

- **Server-side price authority.** `computeOrderPricing()` re-reads products, software and coupons from MongoDB before any Razorpay order. Client-supplied `price`/`total`/`discount` are display hints and cannot influence the charge.
- **Refresh-token rotation with family revocation.** Replaying a rotated token revokes the entire family. The mobile client does single-flight refresh specifically so parallel requests cannot trigger a false-positive revocation.
- **Identity from session, never from request body.** `userId` / `vendorId` / `partnerId` come from the verified session.
- **Mass-assignment protection.** `PATCH /api/users/[id]` explicitly strips `email`, `password`, `role`, `dashboardAccess`, `allowedPages` — self privilege-escalation to admin is blocked.
- **Blog HTML sanitised on write** with DOMPurify in `lib/articles.ts`, not on render. Correct place to do it.
- **Account enumeration resisted.** `/api/auth/forgot-password` returns 200 for unknown addresses.
- **No `eval`, `new Function`, `$where` or `child_process`** anywhere in the API surface.
- **Edge-safe session verification** with Web Crypto, no Node built-ins.

---

## 7. Weaknesses to address

### 7.1 Rate limiting is effectively absent in production — **High**

`lib/rate-limit.ts` uses `new Map()`. On Vercel every cold start gets a fresh process, so the counter resets constantly. Login brute-force protection is therefore nominal.

`lib/rate-limit-store.ts` already supports Upstash — it is simply unconfigured. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, then migrate `lib/rate-limit.ts` and `lib/partner/rate-limit.ts` onto it.

### 7.2 Customer PII in a repo-root file — **High**

`order_debug_dump.json` contains a real order including nested `name`, `email`, `phone`, `address` plus payment metadata. It is **not** covered by `.gitignore`, and there is currently no git repo — so the first `git init && git add .` commits customer data permanently.

Delete it, `order_dump.json`, and the other root-level debug leftovers before initialising version control.

### 7.3 Debug endpoints — **Informational, not a production risk**

My first pass flagged these as live in production. **That was a false positive** caused by a grep that only matched `NODE_ENV === "production"`. On re-verification, all nine debug/test/seed routes are correctly gated with `NODE_ENV !== "development"`:

```
app/api/debug/route.ts                  prodGated=True
app/api/test-connection/route.ts        prodGated=True
app/api/migrate/route.ts                prodGated=True
... (9/9 gated)
```

In development they do expose the full 63-collection schema, which is fine locally. Worth deleting anyway to remove the possibility of a future gate regression.

### 7.4 Validation coverage — **Medium**

Only a handful of routes use the Zod schemas in `lib/validation.ts`. Most write routes accept unvalidated JSON and rely on MongoDB to reject malformed data. Not currently exploitable for injection (the driver parameterises), but it invites type-confusion bugs.

### 7.5 Image `remotePatterns` catch-all — **Low**

`next.config.mjs` ends its allowlist with `hostname: "**"`, which defeats the allowlist. Lets an attacker who can set a product image URL proxy arbitrary remote content through your image optimiser.

---

## 8. OWASP Top 10 (2021) mapping

| | Category | Status |
|---|---|---|
| A01 | Broken Access Control | **Partial** — enforcement verified working, but 120 routes depend on middleware alone, and that layer has an open advisory |
| A02 | Cryptographic Failures | **Pass** — HMAC-SHA256 sessions, bcrypt passwords, SHA-256 refresh-token storage, AES-256-GCM for partner secrets |
| A03 | Injection | **Pass (after fix)** — JSON-LD XSS closed; no NoSQL operator injection; no `eval` |
| A04 | Insecure Design | **Partial** — rate limiting is per-instance by design |
| A05 | Security Misconfiguration | **Partial** — `ignoreBuildErrors`, image catch-all, debug routes present |
| A06 | Vulnerable Components | **Fail** — 4 critical / 16 high advisories, including one in the authorization path |
| A07 | Identification & Auth Failures | **Pass** — rotation, reuse detection, timing-safe cron auth, no enumeration |
| A08 | Software & Data Integrity | **Partial** — no lockfile-integrity CI, builds ignore type errors |
| A09 | Logging & Monitoring | **Partial** — structured session-reject logging exists; no crash reporting in the app |
| A10 | SSRF | **Partial** — the Amazon scraper fetches attacker-influenceable URLs; `ip-address` advisory is SSRF-adjacent |

---

## 9. Prioritised remediation

| # | Action | Severity | Effort |
|---|---|---|---|
| 1 | `npm i next@latest` — clears middleware bypass **and** Windows RCE | Critical | Low |
| 2 | Delete `order_debug_dump.json` / `order_dump.json` before `git init` | High | Trivial |
| 3 | Configure Upstash so rate limiting survives cold starts | High | Low |
| 4 | `npm audit fix` for axios / jspdf / lodash / nanoid / form-data | High | Low |
| 5 | Add `requireAdmin()` to the 76 unguarded write routes | High | Medium |
| 6 | Remove the 9 debug/seed/test routes entirely | Medium | Low |
| 7 | Adopt `lib/validation.ts` Zod schemas on write routes | Medium | Medium |
| 8 | Remove `hostname: "**"` from `remotePatterns` | Low | Trivial |
| 9 | Turn off `ignoreBuildErrors` and fix the 48 baseline type errors | Low | Medium |

Items 1–4 are roughly a day's work and remove the majority of the real risk.
