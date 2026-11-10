# Sara Stores recovery templates for Askeva

Open [the interactive design preview](design-preview.html) to switch between cart and payment messages, view filled examples or positional variables, and copy each template body. All six designs match the app's existing body-only, six-parameter sender. WhatsApp renders the message itself; the preview's chat colours and spacing are illustrative and cannot be uploaded as a template design.

## Submission files

- [All six template definitions](template-definitions.json): standard Meta-style creation definitions with names, category, language, body and approval examples. This array is a reference bundle, not a verified Askeva bulk-import request.
- One `<template_name>.json` file per template: use its `name`, `language`, `category`, `components[0].text` and `components[0].example.body_text[0]` when creating that template in Askeva. If your Askeva dashboard has no JSON import, copy these fields into its template form.
- [Askeva send examples](askeva-send-examples.json): six individual send payload examples matching this repository's actual Askeva client. These are delivery examples, not template creation requests.
- [Data map and schedule](data-map.json): variable order, source descriptions and delays.

Use **Marketing**, **English (`en`)**, a **Body** component and six **positional** variables. Do not add an image/video header, URL buttons or quick replies to these templates: the current recovery sender supplies body components only. Product and unsubscribe links are included in the sixth text variable. Submit sample text for all six variables; the package includes fictional customer data and reserved `example.com` links. Replace example links with a reviewed storefront product URL and a safe sample unsubscribe URL when your provider requires a real-domain example. Never put live customer addresses, phone numbers, tokens or provider secrets in approval examples.

| Template name | Trigger | Earliest delay | Purpose |
| --- | --- | --- | --- |
| `sara_cart_recovery_1` | Cart activity | 1 hour | Gentle reminder with current unit price |
| `sara_cart_recovery_2` | Same cart activity | 24 hours | Current price and verified offer information |
| `sara_cart_recovery_3` | Same cart activity | 48 hours | Final reminder and any confirmed offer deadline |
| `sara_payment_recovery_1` | Failed payment | 2 minutes | Checkout assistance; avoid duplicate payment |
| `sara_payment_recovery_2` | Same failed payment | 24 hours | Current checkout options and verified offers |
| `sara_payment_recovery_3` | Same failed payment | 48 hours | Final reminder with current price |

Quiet hours (09:00–20:00 IST) and the minimum 20-hour gap between contacts can defer these times. The combined cart/payment contact cap is three reminders in a rolling 14 days. A new matching order stops reminders; payment status is rechecked before sending.

## Variable values supplied by the app

| Variable | First reminder | Second and third reminders |
| --- | --- | --- |
| `{{1}}` | Customer first name | Customer first name |
| `{{2}}` | Current catalogue product name | Current catalogue product name |
| `{{3}}` | Server-quoted INR price **per item** | Refreshed server-quoted INR price **per item** |
| `{{4}}` | Cart/checkout contextual reminder | Verified offers, or explicit no-confirmed-offer wording |
| `{{5}}` | Availability or payment-safety note | Verified deadline, or explicit no-confirmed-deadline wording |
| `{{6}}` | Tracked product URL + `Stop reminders:` + signed unsubscribe URL | Same link structure with refreshed data |

The approval sample uses a TECNO phone and ₹16,499 as an illustration. It is not a live price verification. Runtime prices and offers must come from the app's catalogue, never from Razorpay `order_amount` notes. Multi-product checkout notes and `order_items_count` are queue display data; this sender currently promotes one eligible catalogue product at its unit price. It does not insert the customer's address or a fabricated per-product quantity into the reminder.

The final messages deliberately avoid unconditional “offer ends today” wording. A deadline appears only in `{{5}}` when a real offer has a verified expiry. Otherwise the message still works as a final reminder without inventing scarcity.

## After approval

1. In Askeva, confirm each template's exact name, English language code and **Approved** status. This package has not been submitted and cannot guarantee provider approval.
2. In `/admin/recovery-automation`, enter the approved names for the corresponding steps and mark approval only after checking Askeva.
3. Check server-side `ASKEVA_API_URL`, `ASKEVA_API_KEY`, `ASKEVA_SENDER_NUMBER` and `WHATSAPP_CAMPAIGNS_ENABLED=true`. Configure secrets in server settings, not in these JSON files.
4. Review a consented, eligible preview with a current catalogue product. Notes-only/unlinked failures remain blocked; a name or phone number in notes does not establish messaging consent.
5. Enable the desired flow and WhatsApp channel only when ready. Use the app's existing order checks, consent checks, contact limits and delivery ledger for sends. Do not upload the example JSON as a bulk campaign or replay it directly: that would bypass those checks.

For reference, the sender posts **one** send payload to the configured `ASKEVA_API_URL` with `Content-Type: application/json` and `Authorization: Bearer <ASKEVA_API_KEY>`. The `to` field is `91` plus the eligible customer's ten-digit Indian mobile. Replace placeholder sender/recipient and all sample values with the app-generated payload; never send the example unsubscribe token. No template creation endpoint is assumed here because the repository only establishes the send endpoint contract.

Regenerate the offline package with `node scripts/prepare-recovery-askeva.mjs`. It verifies that every body uses variables 1–6 exactly once, template bodies fit the 1,024-character limit and sample parameter text fits the current sender's constraints. It reads no environment files and makes no network requests.
