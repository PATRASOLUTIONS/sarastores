# Live product offers and gifts: implementation plan

Plan approved by the owner's request to implement. Read-only product/campaign discovery; no new collections, index changes or campaign records. Existing campaigns remain configured by Sara through `/admin/diwali`, `/admin/promotions`, `/admin/gifts` and marketing controls.

## Behavior

1. A shared public endpoint reads authoritative product prices/stock, the active Diwali window, customer restrictions and applicable gift/coupon rules. It accepts product identity, never caller-supplied money or customer identity.
2. On a public shopping entry page, discover a small bounded selection of active, stocked products with benefits. Show a compact animated invitation with product links. Do not open on admin, account, cart, checkout, authentication, order or gift-status flows.
3. On `/product/[slug]` (the current product route), show compact gift visuals below Buy Now, with the actual deadline beneath each gift and a `Gift Terms*` link. Longer conditions live at `/gift-terms?productId=…`, which links the approved Diwali terms where applicable. On each eligible product-page visit, show a centred product/gift celebration over a cream background with decorative falling silver/gold coins. It closes after five seconds, with a close button and Escape available. The labelled tier determines the actual gift; decorative gold coins do not change silver eligibility. Gift names/photos come from the configured gift catalogue.
4. Coupon choices are separate from additive gifts. Show code, current preview discount and conditions; the existing checkout supports one applied discount coupon. Do not add all coupon savings together.
5. Hide future, inactive, expired, usage-exhausted or invalid promotions and unavailable products. Revalidate when focused and periodically while open; remove expired benefits using their real India-time end instants. If the quote cannot be verified, hide stale eligibility rather than promise an uncertain gift.
6. The general shopping invitation remains session-scoped and compact. The product-page celebration is the owner's requested five-second modal; it runs once per product-page visit and does not restart when quotes refresh. Give privacy choices and other dialogs priority, respect reduced motion, support Escape, contain focus and restore it on close. Keep the compact product-page benefit section usable after dismissal.
7. Hide `No reviews yet`, zero-review counts and empty Offers, EMI Options and Reviews tabs. Observe live review statistics even while the Reviews tab is hidden; show it when genuine reviews exist. If the selected tab becomes empty, render Overview instead of leaving a blank panel.
8. Send `view_promotion` / `select_promotion` through the existing consent-aware measurement emitter and allowlisted local sink. Do not add new tracking IDs or publish GTM configuration without owner-supplied account setup.

## Truthful wording

“Eligible gift with this purchase”, “Preview at the current price” and “Final eligibility follows discounts, payment and Sara verification.” Automatic gifts and gifts requiring selection must be distinguished. A successful preview is not a gift stock reservation, approved claim or fulfilled order.

Diwali remains based on the existing whole-rupee net merchandise slabs and both purchase/registration windows. No rule or gold threshold is changed. General gifts retain SKU/product/division scope, quantity requirements, usage caps and customer limits. No unrelated TV gift is added to a phone purchase merely because both campaigns are active.

## Verification and rollout

Isolated tests must cover tier boundaries, disabled/future/ended campaigns, expired open-page benefits, blocked customers, out-of-stock products, SKU/division mismatches, multiple gifts, automatic/manual gift distinctions, coupon alternatives, server-authoritative price, public-route scope and no analytics without consent. Run TypeScript checks. Build and lint are skipped at the owner's request.

Deployment, live campaign verification, Merchant submissions and paid campaign activation are separate steps. The first production review should test one qualifying phone, one below-threshold product, a phone with a configured box gift, one eligible TV, an ended campaign and a restricted customer. Check actual checkout results against the preview, including a discount that moves the invoice into a lower gift tier.
