# Website payment gateways

The website supports Razorpay, Pine Labs Online (Plural hosted checkout), and
Paytm hosted checkout. Mobile checkout and partner Razorpay APIs are unchanged.
Pine Labs and Paytm are disabled by default. No merchant credentials are bundled
in the application, documentation, or browser configuration response.

## Select gateways from environment variables

Set these **server-side** variables in `.env.local` or the deployment environment:

```dotenv
RAZORPAY_ENABLED=true
PINELABS_ENABLED=true
PAYTM_ENABLED=false
PAYMENT_DEFAULT_PROVIDER=pinelabs
```

Only enabled gateways appear in the website selector. Enable one to show only
that gateway, or enable multiple to let the shopper choose. Boolean values must
be exactly `true` or `false`; the default provider must be enabled. If the default
is unset, the first enabled gateway is selected (Razorpay, Pine Labs, Paytm).
All three can be disabled to keep only COD/in-store purchases available.
Restart the local server or redeploy after changing environment variables.
Flags stop **new** payment attempts; verification of already-started payments
continues. Keep the old credentials/environment until outstanding payments settle.
Partner Razorpay APIs are unaffected. The existing mobile client shares
`/api/payment/create-order`, so disabling Razorpay also stops new payments through
that endpoint; mobile Pine Labs/Paytm selection is not implemented yet.

Razorpay continues to use `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

## Pine Labs

Configure `PINELABS_ENVIRONMENT=uat`, `PINELABS_MERCHANT_ID`,
`PINELABS_CLIENT_ID`, `PINELABS_CLIENT_SECRET`, and `PINELABS_CALLBACK_SECRET`.
The callback secret is the **separate hexadecimal signing key** issued by Pine
Labs onboarding, **not** the OAuth client secret. Request it from support if it
was not supplied. Never paste credentials into this document.

The API base is `https://pluraluat.v2.pinepg.in` in UAT and
`https://api.pluralpay.in` when `PINELABS_ENVIRONMENT=production`.
The merchant ID is checked against fetched orders before payment is accepted.
Share these URLs with Pine Labs for whitelisting, replacing the origin with
the public HTTPS `NEXT_PUBLIC_SITE_URL`:

| Purpose | URL |
| --- | --- |
| Success/failure return | `https://YOUR-SITE/api/payment/pinelabs/return` |
| Webhook | `https://YOUR-SITE/api/payment/pinelabs/webhook` |

Subscribe to `ORDER_PROCESSED`, `ORDER_FAILED`, and `PAYMENT_FAILED`. The
integration uses `pre_auth=false`: `AUTHORIZED` is **not** a paid order.
The signed return is verified using sorted callback fields and HMAC-SHA256.
Pine's documented webhooks do not specify a signing scheme: their contents are
treated only as a hint to fetch the order with server OAuth credentials. No
payload-supplied status, amount, merchant, or payment ID is trusted. Apply the
current provider IP allowlist at your trusted network/firewall boundary, not
using an arbitrary caller-supplied forwarded-IP header.

## Paytm

Configure `PAYTM_ENVIRONMENT=uat`, `PAYTM_MERCHANT_ID`, and
`PAYTM_MERCHANT_KEY` (the 16-byte merchant key from Paytm). Optional
`PAYTM_WEBSITE_NAME` defaults to `WEBSTAGING` for UAT, `DEFAULT` for production.
Paytm credentials are separate from Pine Labs and Razorpay credentials.

| Purpose | URL |
| --- | --- |
| Return | `https://YOUR-SITE/api/payment/paytm/return` |
| Webhook/payment-status notification | `https://YOUR-SITE/api/payment/paytm/webhook` |

Register these in the Paytm merchant dashboard/support workflow. The endpoints
accept Paytm's signed key/value payment notifications. Requests and responses
use the official `paytmchecksum` package. The server independently queries
`/v3/order/status`, checks the response signature, merchant/order IDs and exact
amount, and accepts only `TXN_SUCCESS`. Hosted checkout posts the transaction
token to `showPaymentPage`; card details never pass through SARA.

## Order lifecycle and recovery

`POST /api/orders` validates and prices the cart from the database, then persists
a pending order and a bound checkout intent **before** launching hosted checkout.
Callbacks, webhooks, and capability-protected `POST /api/payment/status` converge
on the same reconciliation path. A MongoDB replica set supporting transactions
is required, as for existing checkout.

Successful payments atomically claim the intent, insert a provider-labelled
payment record, consume coupon/rewards, and confirm the order. Replayed and
concurrent notifications cannot create a second order/payment or redeem twice.
Pending/failed/timeout responses never trigger paid fulfillment. Gateway status
is authoritative even if a notification falsely claims success.

If a discount or order status changes after payment, the captured payment is
recorded and the order is marked `payment_review`; administrator reconciliation
is required before fulfillment. Do not instruct the shopper to pay again.
Paid orders trigger software/external fulfillment and customer/admin email
notifications; downstream errors are logged for operator attention, as with
existing checkout. An outage of a downstream email/fulfillment service does not
reverse a verified payment.

Full admins can configure an additional confirmed-order recipient at **Admin
> Sales > Order Notifications** (`/admin/order-notifications`). The address is
kept in a private collection, not public site settings. Customer emails continue;
staff copies respect live store scope. Admin summaries contain only the order
number and total. An atomic per-order claim prevents duplicate admin confirmations
on callbacks, retries and status reversals. SMTP outcomes are persisted; failed
or ambiguous `sending` claims require operator inspection, not automatic resend.
Saving the address does not prove delivery. See the
[order/payment security verification](../security/order-payment-security.html)
for scope, tests and delivery limitations.

The browser keeps the return capability in session storage and guest order
access in local storage before redirecting. It resumes checkout on return,
polls for up to one minute, and exposes a retry button for unresolved payments.
Only a confirmed payment clears the cart. Failed attempts retain the cart.
Missing storage/session references explicitly require support rather than
silently creating another payment. Webhooks can confirm payments even when the
browser has closed; guest access tokens remain private.

Payment records are visible in `/admin/payments`, including provider payment
IDs, order references, amount and method. This integration does **not** introduce
automatic refunds, recurring billing, partner-wallet payments or mobile checkout.

## Validation and go-live

Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Regression tests use
synthetic provider responses and never create real/UAT charges. Production
configuration preflight validates enabled gateways only and rejects UAT mode
for production deployment. Keep UAT credentials in a separate testing deployment.

Before release, test card success/decline, SBI net banking and UPI QR with Pine's
supplied UAT simulator scenarios; confirm paise-versus-rupee thresholds with
support. Test pending/failure/error/timeout, callback/webhook replay, browser
closure, expired intents with delayed payment, and discount reconciliation.
Perform equivalent Paytm staging tests. Configure/whitelist both return and
webhook URLs, then switch to production credentials/environment and conduct an
operator-approved small payment/refund test. Local mocks are not provider
certification. Rotate credentials shared in chat/email before production use.

References:

- [Pine hosted integration](https://www.pinelabs.com/docs/online-payments/hosted-checkout/integration-steps)
- [Pine order lookup](https://www.pinelabs.com/docs/online-payments/api/orders/get-order-by-id)
- [Pine webhook events](https://www.pinelabs.com/docs/online-payments/developer-tools/webhooks/available-events)
- [Paytm initiate transaction](https://www.paytmpayments.com/docs/api/initiate-transaction-api/)
- [Paytm hosted payment page](https://www.paytmpayments.com/docs/show-payment-page/)
- [Paytm status lookup](https://www.paytmpayments.com/docs/api/v3/transaction-status-api/)
