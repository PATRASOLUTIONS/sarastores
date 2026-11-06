# Sara marketing setup status — 6 November 2026

Bytewise's plan and website implementation are prepared locally. Production deployment, account ownership, paid media activation and Merchant acceptance are not verified or completed.

## Local configuration check

Ran `node --env-file=.env.local scripts/check-marketing-setup.mjs`. It checks presence/syntax without contacting accounts, databases or providers and without displaying values.

| Integration | Status |
|---|---|
| Canonical site/app/auth URL origins | Consistent HTTPS configuration; production behavior unverified |
| GA4 / GTM | Missing: choose `NEXT_PUBLIC_GTM_ID` or `NEXT_PUBLIC_GA_ID` |
| Merchant API | Missing the five account/OAuth names below |
| Meta Pixel | Optional; missing `NEXT_PUBLIC_META_PIXEL_ID` |
| Clarity | Optional; missing `NEXT_PUBLIC_CLARITY_ID` |
| Search Console, Merchant claim/policies, Business Profile, Ads | Authorized account and live verification required |

Merchant configuration names: `GOOGLE_MERCHANT_ACCOUNT_ID`, `GOOGLE_MERCHANT_DATA_SOURCE_ID`, `GOOGLE_MERCHANT_CLIENT_ID`, `GOOGLE_MERCHANT_CLIENT_SECRET`, `GOOGLE_MERCHANT_REFRESH_TOKEN`. Runtime configuration belongs in `.env.local` locally and protected hosted settings in production. Existing environment files were not changed by this task.

## Implemented website behavior

- Public shopping entry pages show a compact, dismissible animated invitation with up to three eligible stocked products. The former generic home deal popup is replaced.
- `/product/[slug]` shows applicable gifts and coupon options directly below Buy Now, plus a product-specific animated preview. Existing bank offers remain available.
- Quotes use authoritative catalogue prices and checkout gift/coupon rules. Optional gifts require cart selection. Diwali uses the actual approved silver/gold tiers; coupon examples show any resulting tier reduction.
- Status is refreshed every 30 seconds and on focus. Actual deadlines remove expired benefits on the next one-second display tick. A failed quote hides eligibility; snapshots older than 45 seconds are hidden. Inactivation is detected on revalidation rather than through an instant server push.
- Visitor/session identity comes from authentication. Tracking uses the existing consent-aware emitter and supports `view_promotion` and `select_promotion` in the local event sink.
- No campaign records, catalogue records, gift allocations or Google products were changed. The API does not reserve gifts or approve claims.

## Release review

Confirm what “30 box” means and configure its approved gift name/photo/scope in the existing promotion controls. The implementation uses configured gift names; it does not create a box or TV gift automatically. Confirm launch SKUs, monthly media budget and serviceable locations against the growth plan.

Before production activation, verify a qualifying phone, a below-threshold product, a scoped box gift, a TV gift, an ended offer and a restricted customer against real checkout results. Review mobile popup layout, reduced motion, Escape, privacy-banner priority and tag delivery. Live browser/account review remains outstanding.

Verification: TypeScript passed. All 31 focused promotion, cart-coupon and homepage-performance tests passed, including 15 new promotion/setup tests. The broader Diwali, gift-rule, public-promotion and route-guard run passed apart from one existing cart-copy regression: it expects “Cannot be removed” while the unchanged cart component renders “Included automatically”. Neither that component nor its old assertion was changed. No build or lint was run at the owner's request.

Repeat commands: `npx tsc --noEmit`, `npm run test:promotions`. The latter deliberately retains the existing cart-copy assertion, so that known failure is visible rather than filtered out.
