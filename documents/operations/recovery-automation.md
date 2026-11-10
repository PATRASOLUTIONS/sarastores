# Sales Recovery plan and operation

Allowlisted Razorpay payment notes provide display fallbacks for item names, customer name, email, phone and address. When payment notes omit item names, up to 25 distinct gateway orders per page are queried for notes in batches of five with three-second request timeouts. Missing order notes do not hide failures. Payment contact fields take priority; note contacts never establish account identity, messaging consent or order matching. `order_items_count` displays as “Items in checkout” and never substitutes for each product's quantity. Gateway amount remains authoritative; arbitrary notes, IDs, tokens and card details are excluded from the admin response.

Both queue Product columns show catalogue item names, item numbers and quantities. Cart quantities come from the same account's cart or its saved cart snapshot. Payment quantities prefer the exact failed checkout/order items; new server-priced checkout intents retain safe item names and quantities. Historical payment snapshots must precede the failed attempt. Repeated product lines are combined, saved names remain available for removed catalogue products, and missing or invalid quantities display as “Not recorded” rather than an assumed unit count. Gateway-only failures can show item names from allowlisted notes; per-product quantities still require linked item records.

The payment queue reads authenticated Razorpay payments. Optional `RAZORPAY_RECOVERY_KEY_ID` and `RAZORPAY_RECOVERY_KEY_SECRET` select a dedicated reporting account; when both are absent, reporting uses the existing checkout `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. A partially configured reporting pair fails closed. This allows live recovery reporting while local checkout stays in test mode. All failed INR payments in the selected account can be displayed even without a matching local checkout. Automatic reminders still require a matching server-created checkout intent, amount/currency, and explicit consent. Provider notes never establish customer identity. Contact, reference, amount and bank failure reason come from the gateway; new checkout intents atomically retain server-priced product IDs. Successful/pending sibling payments and verified/consumed checkouts are excluded. The page identifies live/test mode, fetched payment/failure counts, and connection errors. Before dispatch, the exact payment and its sibling payments are fetched again; an unavailable gateway pauses sending. Unverified or unlinked failures cannot trigger a reminder.

A newly created order matching either the failure's email or mobile removes the failure from the queue and stops reminders, including purchases on another device and COD/pending orders. Email comparisons ignore casing/surrounding spaces, and Indian mobile comparisons handle `+91`, spaces, separators and numeric records. Checks run again immediately before dispatch. Gateway/database history is retained; this removes the actionable queue entry without deleting financial records. Each admin page scans up to 100 Razorpay payments of all statuses alongside 25 saved records per source; Previous/Next buttons cover older records. The scheduler uses smaller 25-payment pages to keep each execution bounded.

The payment-failure queue reads current failures directly from MongoDB `orders`, `payments` and `checkout_intents`, alongside stored browser failure events. It joins payment records to their orders for customer and product details, deduplicates identities/contacts and excludes completed/verified payments. It displays the failure time, database source, gateway, reference and stored attempt amount. A guest record without a tracking cookie can still be displayed; stored contact details alone do not grant reminder permission. Payment products can be looked up from failed checkout items even when no active cart remains. Failure status is rechecked before dispatch. The 14-day preview loads up to 25 records per source and the worker rotates pages.

Full administrators use `/admin/recovery-automation`, linked under Customers. The page has two sections: **Cart abandonment** and **Payment failure**. Both flows start paused; review the content, approve templates, choose channels and save an enabled flow to activate it. No customer messages or live database tests were performed during development.

Queue display data is independent of reminder eligibility. Cart customer details are read by account ID from `users`, with contact/profile snapshots as fallbacks; a missing phone can come from that account's saved delivery address or order shipping details. Blank fields are skipped. Product names and item numbers are read directly from `products` and `software_products`, including on blocked rows without an active cart or approved delivery channel. Catalogue SKU/item-number aliases use the same normalization as the product admin page. Displaying these details does not grant messaging consent or redirect a reminder to a different contact.

## Message sequence

Saved-address phone fallback accepts `phone` or `mobile`, string or MongoDB ObjectId ownership, and the canonical account ID behind a legacy customer ID. Legacy addresses embedded in an account are also checked. Only contact-number fields are read for this fallback; address contents are not returned to the queue and these numbers do not grant permission to send reminders.

| Touch | Cart abandonment | Payment failure |
| --- | --- | --- |
| 1 | 1 hour: “You added [product] to your cart. Would you like to complete your purchase?” Show current price and product link. | 2 minutes: “Your checkout for [product] did not complete. If you still want it, review your order and choose an available payment method.” |
| 2 | 24 hours: “Still considering [product]? Here is the current price and the offers you can review today.” Include verified offers and actual deadlines. | 24 hours: “We would be happy to help you finish purchasing [product]. Review the current price and any eligible offers before you continue.” |
| 3 | 48 hours: “This is our last reminder about [product]. Take a look at the latest price.” Mention an ending offer only when a confirmed deadline is within 48 hours. | 48 hours: “This is our final reminder to complete your [product] purchase, if you still want it.” Include only verified offer urgency. |

Each message includes a signed opt-out link. Payment messages warn: **If money was deducted or payment is pending, check your order status or contact Sara before trying again.** Pricing is the current authoritative catalogue unit price, not a guaranteed total including shipping. No coupon or deadline is fabricated. If no confirmed offer/deadline exists, the message explicitly says so. Links return to the public product page for normal checkout; they contain no customer data or private payment credentials.

Timing is measured from the latest cart activity or failure. The first payment reminder is fixed at two minutes, including previously saved settings; flow enablement, template approvals and later delays are preserved. Both cart and payment flows recheck matching orders after payment-status and settings lookups, immediately before provider handoff. Default sending hours are 09:00–20:00 IST; a minimum 20-hour gap prevents catch-up messages. A one-minute scheduler means times are earliest eligibility, not guaranteed delivery. Pending or verified payment intents pause recovery to prevent duplicate payments.

## Permission and suppression

Checkout offers separate unchecked email/WhatsApp choices, explaining up to three purchase reminders. Consent is versioned and bound to the contact details submitted with it. A phone or address alone does not grant permission. Existing account-profile channel opt-in is supported; newer withdrawals override older checkout permission. Current journey recording also requires analytics consent. Guest-only cart visitors without contact details and reminder opt-in cannot be contacted. Guest recovery requires a current, nonempty cart snapshot; account recovery uses the saved cart.

Before every message, including the first, check orders, payment status, consent, opt-out, cart contents, stock and product visibility. Any newly created order stops the episode, including COD/pending orders; a recent order containing the target product also stops it. Prices and storefront promotion eligibility are refreshed for dispatch. A failure after the latest cart activity takes priority over cart recovery. Both flows share a maximum of three attempts per contact in 14 days, with one channel per reminder.

Order suppression checks account/browser identity and the consented contact email or phone, so a purchase completed on another device also stops reminders.

WhatsApp is preferred only with permission, provider configuration and an explicitly approved matching template. Email is the fallback **before** sending. Do not fall back after a timeout or unclear acknowledgement. The durable MongoDB reservation and contact lock prevent concurrent duplicate sends. `sent` means provider acceptance, not read/delivered. `sending`, `unknown` and `failed` records pause automatic retries until reviewed outside this automation or aged out of the 14-day window. There is no blind retry action. External delivery and order creation cannot be one transaction; a final check immediately before the provider call minimizes that race.

Opt-out links expire after 90 days. GET shows a confirmation; the verified form submission stops both recovery flows. Link scanners cannot opt a customer out simply by fetching a URL. A hashed contact preference survives future cart activity.

Marketing tags are excluded on private admin/account routes and recovery pages. Recovery and customer-flow admin content is masked for Clarity when an already-loaded recording spans a client navigation. The opt-out page uses no-referrer metadata to avoid sharing its signed URL on onward navigation.

## WhatsApp approval package

The copy-ready package is [Askeva recovery templates](../integrations/askeva-recovery/README.md), with an interactive design preview, six individual creation definitions, approval examples and send payload examples. Its final bodies supersede the suggested drafts below and preserve the same six-variable contract. It is offline preparation; no provider submission or approval is implied.

Submit six English **marketing** templates to Meta through AskEva. Defaults are `sara_cart_recovery_1`, `_2`, `_3` and `sara_payment_recovery_1`, `_2`, `_3`. Enter exact names and verify approval on the admin page. Checking approval does not create provider approval. Templates must have a body with six text parameters and no header or button components.

| Parameter | Value |
| --- | --- |
| `{{1}}` | Customer first name |
| `{{2}}` | Current product name |
| `{{3}}` | Current INR unit price |
| `{{4}}` | First touch: contextual reminder; later: verified offers or no-offer wording |
| `{{5}}` | First touch: safety/availability note; later: verified deadline or no-deadline wording |
| `{{6}}` | Product link followed by signed opt-out link |

Suggested template bodies:

**Cart 1:** Hi {{1}}, ready to make {{2}} yours? Current price: {{3}} per item. {{4}} Details: {{5}} Review your purchase: {{6}} Need help choosing? Contact Sara Stores.

**Cart 2:** Hi {{1}}, still considering {{2}}? Today’s price is {{3}} per item. {{4}} Details: {{5}} Review the product and eligible offers: {{6}} Need help? Contact Sara Stores.

**Cart 3:** Hi {{1}}, this is our final reminder about {{2}}. Latest price: {{3}} per item. {{4}} Details: {{5}} Take another look if you still want it: {{6}} Need help? Contact Sara Stores.

**Payment 1:** Hi {{1}}, need help finishing your {{2}} purchase? Current price: {{3}} per item. {{4}} Details: {{5}} Review your checkout: {{6}} If you already ordered, you do not need to purchase again. Contact Sara Stores for help.

**Payment 2:** Hi {{1}}, your {{2}} purchase options are still here. Current price: {{3}} per item. {{4}} Details: {{5}} Review before continuing: {{6}} If money was deducted or payment is pending, check your order status or contact Sara before trying again.

**Payment 3:** Hi {{1}}, this is our final reminder to review your {{2}} purchase, if you still want it. Latest price: {{3}} per item. {{4}} Details: {{5}} Review the product: {{6}} If money was deducted or payment is pending, check your order status or contact Sara before trying again.

Do not insert unconditional “offer ends today” claims into provider templates. Actual WhatsApp wording is controlled by the approved template; email content and WhatsApp parameters are generated locally. Admin previews show generated content, not a fetched provider template rendering.

## Activation and configuration

Reuse existing runtime configuration. Website/signing: `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`, `SESSION_SECRET` or `NEXTAUTH_SECRET`. Email: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, existing SMTP TLS/port settings. WhatsApp: `WHATSAPP_CAMPAIGNS_ENABLED=true`, `ASKEVA_API_KEY`, `ASKEVA_API_URL`, existing sender settings. Readiness checks show configuration presence, never credential values.

Deploy the cron entry in `vercel.json`: `/api/cron/recovery-automation`, `* * * * *`. Configure `CRON_SECRET` (16+ characters) and a hosting plan supporting this frequency. The endpoint verifies cron authorization. The previous cart cron and daily outreach share this new engine/ledger. The live worker rotates bounded pages of 25 leads per flow; the dashboard labels its first-page sample. A time-limited run continues the same page next time if incomplete.

“Preview due reminders” makes no database writes or provider calls. “Run due reminders” sends real eligible messages only after the page’s explicit confirmation. Save flow/settings changes before previewing or sending.

Collections are `recovery_settings`, `recovery_deliveries`, `recovery_locks` and `recovery_suppressions`. Standard unique `_id` enforcement protects reservations/locks without a new migration. History stores minimal name, product ID, subject and delivery status, not address or full message. The existing retention maintenance applies a 90-day delivery-history rule. Minimal opt-out hashes persist to honour the preference.

Saving settings creates supporting delivery-history indexes; previews never create indexes. Registered delivery records are included in the account data export and purged on account deletion. The cap matches both the recorded customer identity and contact, so changing checkout contact details does not restart the sequence.
