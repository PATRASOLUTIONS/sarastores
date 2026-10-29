# Sara Care implementation plan

Status: implementation added to the application on 2026-10-28 after the user's instruction to execute. No live catalogue or configuration changes were made. Builds, lint and tests remain off at the user's request; verification was limited to source review.

Implemented defaults: 1-, 2-, and 3-year upfront packages; default duration 1 year, configurable per rule; selling-price or MRP basis per rule; each duration's percentage is the total package rate, applied once. Prices use the application's 18% GST-inclusive treatment. The feature is disabled until configured.

Activation: open `/admin/sara-care` as a full administrator, enter coverage terms and when coverage begins, add product/group rules and duration percentages, preview actual products, then enable and save. Saving creates the three stable service products without replacing existing catalogue data. These products remain hidden from ordinary listings and are quoted only with a covered device.

Implemented scope covers selling the plans, linked cart choices, authoritative pricing, saved purchase terms, success/admin item display and existing WhatsApp item lists. Claims, serial-number activation, expiry automation and automatic linked refunds are future operational work; this implementation does not claim to provide those services.

## Customer experience

Sara Care is a paid service product linked to a purchased device. For every eligible device added to the cart, add the configured default Care duration as a visible separate product row immediately below that device. Show its price, covered device, duration, and Remove action. The cart subtotal includes it immediately; make the added charge clear in the add-to-cart confirmation as well.

Example rows, with illustrative amounts only:

| Product | Quantity | Unit price |
| --- | ---: | ---: |
| Samsung TV | 1 | ₹40,000 |
| Sara Care — 1 Year — Samsung TV | 1 | ₹2,000 |

The customer can select another available duration, remove Care, or add it back. Removing Care does not remove the device. Removing the device removes its linked Care. Refresh, navigation, login, cart merge, price refresh and checkout must preserve an explicit removal. Automatically add again only after the customer adds that device as a new purchase after removing it, or explicitly selects Add Sara Care.

Recommended quantity behavior: protect all units in that device cart line. Two phones produce Care quantity two. A duration change replaces the linked Care row rather than adding duplicate plans. Different devices or variants retain separate linked Care rows even if they use the same service SKU. Partial unit coverage can be a later option if required.

## Admin configuration

Create `/admin/sara-care` with the existing server layout, permission system and authenticated API pattern. Full admins can configure rules; any delegated access must be explicitly mapped to this page.

Each rule contains a name, active state, target, price basis, available duration/rate pairs, default duration, and coverage terms reference. Targets are an individual product or a division, category, or segment. Use the catalogue's canonical `division`, `categoryGroupName`, and `segment` fields and their existing legacy mappings; do not create a second taxonomy.

Resolve rules in this order: product → segment → category → division. Scope segment/category selections to their parent hierarchy so identical labels in different divisions do not collide. Only one rule applies; never stack rates. Prevent duplicate active rules for an identical target. A more-specific inactive/exclusion rule can explicitly disable Care for its target instead of accidentally falling back to a broad rule. Products with no applicable rule receive no Care.

Admin controls per duration: enabled, percentage, and product SKU. Start with 1, 2, and 3 years; use a duration list rather than hardcoding three choices throughout the app. The default must be one of the enabled durations. Add a preview that selects an actual product and shows the matched rule, price basis, each duration's price, and default selection before saving.

No guessed production rates. Keep the feature inactive until an administrator saves eligible rules, rates, and coverage terms.

## Pricing decisions

Recommended interpretation: each duration has its own total package percentage. For example, a ₹40,000 price basis with illustrative rates of 5%, 8%, and 11% gives ₹2,000 for one year, ₹3,200 for two years, and ₹4,400 for three years. Do not multiply the two-year percentage by two or charge annually unless the business chooses annual cumulative rates instead.

Formula: `Care unit price = round to paise(server catalogue basis × selected percentage / 100)`. Line total is that unit price times covered quantity. Selling-price basis uses the current device price before order-level coupons. MRP basis uses the stored, valid MRP; if it is absent or invalid, make Care unavailable for that rule rather than silently substituting a different basis.

Every quote and final order recalculates eligibility, basis, rate, duration and quantity on the server. Client amounts are display hints. Include the parent linkage, duration, rule version and calculated Care price in checkout fingerprints so a changed selection or rate invalidates an earlier payment quote. Once payment is initiated, follow the existing quote/expiry behavior; never silently change a paid order's amounts.

Recommended initial offer treatment: Care does not earn product gifts, qualify for buy/get offers, or receive ordinary device coupons. Determine shipping, store availability and physical fulfilment from physical items only. Configure and display Care tax treatment explicitly; the current pricing service assumes 18% GST-inclusive catalogue amounts, so this must be confirmed or extended before publishing a different Care tax treatment.

## Product and order data

Use actual catalogue service products with stable IDs and SKUs, such as `SARA-CARE-1Y`, `SARA-CARE-2Y`, and `SARA-CARE-3Y`. Their price is derived from the covered device and rule, not a single fixed catalogue price. Introduce a server-recognised service kind; do not disguise Care as hardware or licensed software. Mark it as linked-purchase-only and exclude it from ordinary device listings, stock imports, supplier orders and standalone checkout.

Cart line identity must include the covered parent line and duration. Extend existing cart serialization, guest storage, database storage and checkout merging to retain the linkage and the customer's removed/selected state. Share one reconciliation function across cart surfaces; do not independently auto-add Care in multiple components.

Store Care in the existing `order.items` array with normal item fields (`id`, `name`, `sku`, `quantity`, `price`, `image`) plus a server-generated Care snapshot: parent product/SKU and order-line reference, duration, price basis and amount, percentage, rule/version, covered quantity, and coverage terms/version. Name the line `Sara Care — 2 Years — <covered product>` so the existing item text communicates the relationship everywhere.

Order snapshots are immutable purchase evidence: editing current rules must not reprice past Care purchases. Do not accept a caller's parent link, rate or coverage snapshot without server validation. Reject orphan Care, duplicate coverage, disabled durations, inconsistent quantities and attempts to buy Care for another Care product.

## All required surfaces

| Surface | Behavior |
| --- | --- |
| Product/add-to-cart | Clear Care addition notice and eligible duration information |
| Cart page, sidebar and quick cart | Device plus separate linked Care row; duration selector and removal; accurate total |
| Guest and signed-in cart | Preserve choice/removal through reload, sign-in and cart merge |
| Checkout | Same separate product row and amount; server quote includes Care |
| Order success and customer order detail | Purchased Care item, covered product and duration from the saved order |
| `/admin/orders` and invoice | Same product row; saved pricing and linkage; operational coverage status |
| Customer/store/admin WhatsApp | Existing item list includes Care; template names, variable counts and message format remain unchanged |
| Payment providers | Payable amount includes Care; idempotent order creation preserves the item exactly once |
| Stock/supplier fulfilment | Operates on physical products; Care is not dispatched or sent to an external supplier |

Current customer WhatsApp confirmation already reads `order.items`; store messages already render item name, quantity and price. Keep the existing formatting and parameter limits. Use concise Care product names so extra rows do not unnecessarily consume the existing message length budget.

## Coverage lifecycle

Before activation, decide what the plan covers, when coverage begins, how it relates to the manufacturer's warranty, exclusions, cancellation/refund rules, and whether all units must have the same duration. Do not invent these as software defaults or describe the product as insurance without defined terms.

Recommended records: purchased/pending activation → active → expired, with cancelled/refunded states when applicable. Capture IMEI/serial number per covered unit at fulfilment or activation if required; the checkout need not ask for a serial that a customer has not received. If coverage begins at delivery, record dates from actual delivery, not the order creation timestamp. Never activate protection for unpaid, cancelled or refunded orders. Device cancellation must identify its linked Care for the agreed refund handling.

Claims management, recurring annual billing, renewal campaigns, and retroactive Care purchases are separate scope unless requested. This first implementation sells upfront duration-based packages with saved purchase evidence.

## Implementation sequence

1. Settle duration default, price basis/package-rate interpretation and coverage/tax settings; save these decisions here.
2. Add shared Care schemas, stable product kind, rule resolution and server quote calculation; admin configuration and preview; no automatic live seed/replacement.
3. Extend cart identities/persistence and implement linked add/remove/switch/quantity reconciliation with explicit opt-out preservation.
4. Integrate pricing, payment fingerprints, inventory/store filtering, coupon eligibility and final order snapshots.
5. Update all cart/checkout/success/admin/invoice renderers; preserve WhatsApp formats and supplier boundaries.
6. Review the changed code against the scenarios below. Do not run builds, lint, tests or live transactions under the current instruction. Report this verification limit clearly when delivering implementation.

Scenarios for review: eligible/ineligible devices; every duration; product-specific overrides; duplicate category labels; missing MRP; two units; two different devices sharing a Care SKU; removal and re-addition; device removal; guest-to-account merge; old cart with no Care fields; rule/price changes during payment; tampered Care prices; orphan Care; supplier products; pickup availability; coupons/gifts; retry callbacks; cancelled orders; unchanged WhatsApp parameter count; correct saved Care rows on every requested surface.
