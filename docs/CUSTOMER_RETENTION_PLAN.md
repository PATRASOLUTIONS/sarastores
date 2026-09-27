# Customer Retention Plan — Sara Electronics

**Prepared:** 11 August 2026
**Basis:** Full source audit of the `ecommerce-sara` platform (206 API routes, 65 admin modules, 50 collections), plus live testing against the production database.

---

## 1. The single most important finding

**You have already paid for a complete retention engine. It is switched off.**

Nine lifecycle campaign types are written, styled, consent-gated and scheduled. Five cron jobs are declared correctly in [vercel.json](../vercel.json). RFM segmentation, customer profiles, tiering, unsubscribe tokens and a preference centre all exist and work.

Not one message has ever been sent, for two reasons:

1. **`CRON_SECRET` is not set.** Every cron route calls `requireCron()` from [lib/cron-auth.ts](../lib/cron-auth.ts), which fails closed with **503** when the secret is missing or shorter than 16 characters. All five jobs are inert.
2. **SMTP is commented out** in `.env`. Even if the jobs ran, every send would fail — and this also silently breaks order confirmation emails and admin broadcasts.

Turning these two things on is a configuration change, not a development project. It is the highest-return action available to the business.

---

## 2. What already exists (verified in code)

### Lifecycle campaigns — built, never sent
All nine live in [lib/retention/messages.ts](../lib/retention/messages.ts) with a branded shell and a working unsubscribe link:

| Campaign | Trigger | Commercial purpose |
| --- | --- | --- |
| `warranty_expiry` | Warranty window closing | Extended warranty / AMC attach |
| `service_due` | Time since delivery | Service revenue, re-engagement |
| `replenishment` | Consumable category cadence | Predictable repeat orders |
| `accessory` | Post-delivery window | Basket extension |
| `winback` | Lapsed RFM segment | Reactivation |
| `review_request` | After `deliveredAt` | Social proof (you currently have none) |
| `abandoned_cart` | 4h then 48h, capped at 2 | Highest-ROI recovery channel |
| `back_in_stock` | Wishlist stock transition | Converts stored intent |
| `price_drop` | Wishlist price transition | Converts stored intent |

### Customer data model — genuinely well designed
`customer_profiles` ([lib/customer-profile.ts](../lib/customer-profile.ts)) carries `lifetimeSpend`, `orderCount`, `averageOrderValue`, `firstOrderAt`, `lastOrderAt`, `spendLast365`, `categoriesBought[]`, `tier` (silver/gold/platinum), `consent.{email,whatsapp,sms}`, `unsubscribeTokenHash`, and RFM `segment` (champion / loyal / promising / at_risk / lapsed / lost).

Profiles are **recomputed from orders, never incremented**, so they are idempotent and safe to rebuild.

### Other assets in place
- Preference centre at `/account/preferences` with real consent capture
- One-click unsubscribe, token-hashed, no address probing
- Admin broadcast campaigns with batching and campaign history
- WhatsApp channel (Askeva) — currently limited to two approved spin-wheel templates
- Spin wheel, lucky draw, coupons with per-customer usage limits

---

## 3. The blockers, in priority order

| # | Blocker | Impact | Fix |
| --- | --- | --- | --- |
| 1 | `CRON_SECRET` not set | All 9 campaigns inert | Set a ≥16-char secret in the deployment environment |
| 2 | SMTP commented out in `.env` | Every send fails, including order confirmations | Restore the five `SMTP_*` / `EMAIL_FROM` variables |
| 3 | Consent defaults to `false`, captured in one obscure page | Addressable audience is near zero | Add consent capture at signup and checkout |
| 4 | Broadcasts bypass consent and omit unsubscribe | Compliance and deliverability risk | Route through `getContactableProfiles()` — it exists with **zero call sites** |
| 5 | `npm run indexes:retention` points at `.env.local`, which has 0 active variables | 14 retention indexes never created | Change to `--env-file=.env` and run once |
| 6 | Guest carts are never persisted | Majority of cart abandonment is unrecoverable | Persist guest carts server-side against an anonymous cookie |
| 7 | Retention dashboard API has no UI | Business cannot see segments or consent reach | Build a page against the existing `/api/admin/retention/overview` |
| 8 | `review_request` never passes `actionUrl` | Every review invite lands on the generic catalogue | One-line fix in [lib/retention/lifecycle.ts](../lib/retention/lifecycle.ts) |

---

## 4. Addressable audience — the real constraint

Retention cannot outperform the size of the list you are legally allowed to contact. Today that list is approximately **zero**, because consent defaults to false and the only place to grant it is a preference page most customers never visit.

You are, however, sitting on several **uncontactable but high-intent pools**:

| Pool | Collection | Has consent? |
| --- | --- | --- |
| Spin wheel participants (OTP-verified phone) | `spin_<slug>_participants` | No |
| Lucky draw participants | `lucky_draw_participants` | No |
| Leads from the lead form | `leads` | No |
| Contact enquiries | `contact_inquiries` | No |
| Customers with orders | `orders` → `customer` | No |

**Action:** add an explicit, unticked consent checkbox to
1. signup,
2. checkout step 1,
3. the lead form, and
4. spin wheel / lucky draw entry,

each calling `setConsent(userId, {...}, source)`. Then run a one-time **re-permission campaign** to the existing pools. This is the gate on everything else in this plan.

---

## 5. Programme design

### Phase 1 — Switch on what exists (Week 1)
1. Set `CRON_SECRET` and the SMTP variables.
2. Fix and run `npm run indexes:retention`.
3. Run each cron once with `?dryRun=1` and review the counts before letting the schedule take over.
4. Run `rebuild-profiles` to backfill `customer_profiles` from the 104 existing orders — nothing has ever populated it at scale.
5. Fix the `review_request` deep link.

**Expected outcome:** abandoned-cart recovery and post-purchase review requests begin operating. These two alone typically account for the majority of early retention revenue.

### Phase 2 — Build the list (Weeks 2–3)
6. Consent capture at the four points above.
7. Re-permission campaign to spin wheel, lucky draw and lead pools.
8. Route admin broadcasts through `getContactableProfiles()` and inject the unsubscribe footer.

### Phase 3 — Close the measurement gap (Weeks 3–4)
9. There is currently **no email engagement tracking at all** — no opens, no clicks, no bounces. `campaign_history` records only sent/failed counts. Add click wrapping and a bounce/complaint webhook, plus a suppression list. Without this, deliverability will degrade and nothing can be optimised.
10. Build the admin retention dashboard on the existing API.

### Phase 4 — Add the economic hook (Weeks 5–8)
11. `/rewards` currently promises "Sara Coins" that **do not exist anywhere in code**. Either build a points ledger or remove the promise — advertising a loyalty currency you cannot honour is a liability.
12. Cheaper interim step with most of the benefit: **issue unique, single-use coupon codes per customer** from the winback and review-request flows. This makes retention revenue attributable, which shared broadcast codes never can be.
13. Tiers are computed but confer no benefit anywhere. Attach something real — early sale access, free installation, extended returns.

### Phase 5 — Extend channels (Weeks 9–12)
14. WhatsApp is the strongest channel for Indian electronics retail and you already have the integration. Get more templates approved beyond the two spin-wheel ones; `consent.whatsapp` is already collected and indexed but no code reads it.
15. Browse abandonment: `users.recentlyViewed` (last 20 products) is written but **no job reads it**.
16. "Notify me" for out-of-stock products. Note [app/faq/page.tsx](../app/faq/page.tsx) already tells customers this button exists — it does not.

---

## 6. Measurement framework

Track these from day one; none are currently measurable.

| Metric | Definition | Starting target |
| --- | --- | --- |
| Consent rate | % of new customers granting email consent | > 45% |
| Repeat purchase rate | % of customers with ≥2 orders in 12 months | Establish baseline, then +5pp |
| Cart recovery rate | Recovered orders ÷ abandoned carts emailed | 5–10% |
| Review request conversion | Reviews submitted ÷ requests sent | > 8% |
| Winback rate | Reactivated ÷ lapsed contacted | 2–4% |
| Email deliverability | Delivered ÷ sent | > 98% |
| Unsubscribe rate | Per campaign | < 0.5% |
| Revenue per recipient | Attributed revenue ÷ recipients | Track by campaign |

**Prerequisite:** the platform currently emits **no e-commerce analytics events at all** — no `view_item`, `add_to_cart`, `begin_checkout` or `purchase`, and no GA4/GTM/Meta Pixel. `/api/vitals` receives web-vitals data and `console.log`s it without persisting. Retention performance cannot be attributed until this is fixed.

---

## 7. Compliance

- **Consent must be explicit and unticked by default** — the current `DEFAULT_CONSENT` of all-false is correct; do not pre-tick the new checkboxes.
- **Every marketing send needs an unsubscribe link.** The lifecycle templates have one; the five promo templates in [lib/promoTemplates.ts](../lib/promoTemplates.ts) and the admin broadcast path do not.
- **Honour unsubscribes across all channels**, including WhatsApp.
- **Keep the audit trail** — `consentUpdatedAt` and `customer_events` already record consent changes.
- **Suppress hard bounces and complaints.** No suppression list exists today; repeated sends to dead addresses will damage domain reputation and eventually affect order confirmation delivery.
- **Do not fabricate social proof.** The product pages currently render three invented customer Q&A personas with invented "helpful" counts, and randomised helpful numbers on reviews. Remove these before running review-request campaigns.

---

## 8. Sequenced summary

| Week | Focus | Outcome |
| --- | --- | --- |
| 1 | Configuration: `CRON_SECRET`, SMTP, indexes, profile backfill | Nine campaigns live |
| 2–3 | Consent capture + re-permission campaign | A legally addressable list |
| 3–4 | Engagement tracking, suppression, retention dashboard | Measurable programme |
| 5–8 | Unique coupons, tier benefits, loyalty decision | Attributable retention revenue |
| 9–12 | WhatsApp expansion, browse abandonment, notify-me | Full channel coverage |

**Start with Week 1.** It is configuration only, requires no new code, and activates work that has already been paid for.
