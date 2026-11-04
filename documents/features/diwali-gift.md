# Diwali gift registration and management

The campaign runs in the existing Next.js application. Customers use `/diwali-gift`; staff use `/admin/diwali`. This implementation uses MongoDB, matching the operator's implementation instruction. It does not change the existing commerce database configuration.

## Configuration and launch

Registration defaults to closed. A full administrator must supply the controlled store master, English/Kannada terms and privacy notices, claim dates, confirmed eligibility policy and confirmed working-day calendar through `/admin/diwali/settings`. Staff assignments reference existing account IDs; non-administrator staff also need dashboard access and an `/admin/diwali` page grant in account administration. Re-login after changing dashboard access if the old session lacks that claim.

Settings use a holiday date picker with removable dates, a searchable editable campaign store table, and existing-account selectors for staff roles, export permission and store restrictions. **Add all active directory stores** imports valid store codes/names from `store_locations`; save settings to apply the import. Missing codes/names must be corrected in the store directory. Empty staff store restrictions allow all stores. Account access links open existing account administration. Saving checks that assigned accounts exist; opening additionally checks active status and dashboard/Diwali page permissions. Errors identify the settings section to review. Page grants are enforced by the campaign service as well as the general admin policy.

## Store registration links and QR codes

The dashboard and settings link to `/admin/diwali/diwali-store`. This page automatically lists a stable registration link for every retail store in the directory, plus campaign stores added manually. Warehouses are excluded. Physical store links use the record ID, so changing a store name does not invalidate printed codes. Inactive stores remain identifiable; add active stores to campaign settings to make them available in the registration selector.

Each store supports copying its link, viewing/downloading its QR PNG, and inspecting QR/link opens, last-opened time in IST and attributed registration counts. **Print all store QR codes** prepares printable cards for every permitted store, independent of search/pagination. **Export all links & counts** exports the permitted store list as CSV. Counts refresh every minute and on demand; staff see only their permitted stores and claim scope.

`/diwali-gift/store/[id]` records an atomic aggregate open and redirects to `/diwali-gift?store=CODE`. A configured store is selected in the customer form; the customer can change it to the actual invoice store. Direct registration-page visits, HEAD requests, recognized bots and prefetches do not increment opens. Opens include repeated QR scans and ordinary visits to the same link; they are not unique-customer counts. Aggregate daily counts use India dates in `diwali_store_opens`, without IP/device browsing histories.

A signed, HttpOnly, SameSite store-source cookie lasts seven days. Registration validates its signature and resolves the store again before saving referral fields with the claim. Body-supplied attribution is rejected. The most recent store link supplies referral attribution independently of invoice store. Retries retain the original claim source. Admin claim lists/details and CSV reports show the QR/link source. Tracking failures still redirect customers to registration.

All four terms/privacy fields use Markdown editors with formatting buttons and Write/Preview modes. Save campaign settings to publish the content to `/diwali-gift/terms` and `/diwali-gift/privacy`; the language switch selects the saved English or Kannada notice. The preview and public pages share the same renderer for headings, emphasis, lists, links and tables. Existing plain text remains supported; raw HTML is not rendered.

Money currently accepts whole-rupee amounts only. Fractional values are rejected until Finance approves a paise policy. Invoice uniqueness is scoped to store code and normalized invoice number. Administrators can correct pending invoice identity with an audit note; identity and allocation are locked after review. Distinct invoices from the same verified mobile are permitted. Confirm that policy and the invoice namespace before opening registration.

Approval uses the verified invoice value, eligible purchase date and manual cancellation/refund declarations. Approval day is excluded from the seven-working-day calculation; the deadline is the end of the seventh configured working day in Asia/Kolkata. Each approval retains its calendar snapshot and due date. Packing reserves confirmed stock; dispatch consumes the reservation; delivery requires a proof/reference.

## Online checkout registration

While both configured purchase and registration windows are open, the cart shows the campaign poster and the estimated Silver/Gold gift. Checkout applies eligibility automatically. The server uses the discounted order value including GST, after rewards and excluding delivery charges; existing whole-rupee slab rules apply. `/api/cart/validate` confirms this value before payment. The gift is separate from coupon discounts and catalogue free-gift promotions.

Each eligible website order stores its `diwaliGift` snapshot and creates one pending claim in the same order transaction. The order supplies customer/contact details, its trusted delivery address or pickup-store address, and its invoice identity. Guest purchases are included; the mobile is not labelled OTP-verified and WhatsApp campaign consent defaults to false. In-store employee purchases use the existing separate registration workflow. Retries cannot create a second claim. Failed hosted payments remain visible as blocked/pending records.

Admin registrations and reports include the `ONLINE` channel; details link to the order and show its current payment/order status. Value, date and invoice identity are locked to the order. Approval, packing and dispatch check confirmed payment, cancellation/refund/review status and unchanged order value. COD can qualify for approval after the order is delivered. Existing manual approval, stock reservation and gift-delivery workflow remain in place. Scoped staff need `ONLINE` in their permitted store master/assignment to access this channel; full admins see it automatically. The `ONLINE` invoice namespace is reserved for automatic orders and cannot be used for a manual claim.

Focused checks: `node --test tests/diwali-online.test.mjs tests/diwali.test.mjs tests/cart-coupon.test.mjs`. These use synthetic fixtures and mocked provider/database boundaries.

## Environment and official messaging

Configure secrets in the hosting environment, never in public code:

- `MONGODB_URI` and `MONGODB_DB`: existing platform connection and database.
- `SESSION_SECRET`: strong existing authentication/OTP hashing secret.
- `DIWALI_MESSAGING_ENABLED=true`: explicitly enables campaign OTP and worker sends.
- `ASKEVA_API_KEY`, `ASKEVA_API_URL`, `ASKEVA_SENDER_NUMBER`: official provider configuration.
- `DIWALI_OTP_TEMPLATE`: approved authentication template with OTP body parameter and OTP button parameter. Confirm provider-supported English/Kannada language variants.
- `DIWALI_APPROVED_TEMPLATE_EN`, `DIWALI_APPROVED_TEMPLATE_KN`: approved templates with ordered body parameters: name, gift, invoice number, verified rupee value, due date.
- `DIWALI_DISPATCH_TEMPLATE_EN`, `DIWALI_DISPATCH_TEMPLATE_KN`: approved templates with ordered body parameters: name, reference, courier, AWB, tracking URL.
- `DIWALI_WEBHOOK_SECRET`: provider's HMAC signing secret. Callback uses `X-Hub-Signature-256` over the raw body and Meta-compatible entry/changes/statuses payloads. Confirm AskEva's callback contract; adapt the signed provider transport if its format differs.
- `DIWALI_WEBHOOK_VERIFY_TOKEN`: private subscription challenge token.
- `DIWALI_OTP_LANGUAGE`: optional `en` or `kn` override for an authentication template approved in only one language. When absent, OTPs use the customer's chosen language. Approval and dispatch messages always keep the customer's chosen language. The approved generic `spin_win_auth` template can be used with `DIWALI_OTP_LANGUAGE=en` until the Diwali OTP template has bilingual approval.
- `CRON_SECRET`: existing service authentication secret.

Configure a managed scheduler to call `GET /api/cron/diwali` with `Authorization: Bearer CRON_SECRET`, typically every minute. This endpoint is not automatically scheduled by the existing daily cron jobs. Each run processes at most 15 messages; assess throughput and provider limits against expected campaign volume. Production registration opening checks configured required template names but provider approval must be independently evidenced.

Approval and dispatch create durable notification events atomically with the claim. Known rate-limit rejections retry with backoff. Timeout, malformed success, server error and interrupted worker leases become `unknown`; operators must reconcile provider acceptance before resending. Accepted/delivered events cannot be manually resent. Callback receipts handle early and out-of-order events. Message statuses distinguish provider acceptance, sent, delivered and read.

## Data and APIs

Collections: `diwali_config`, `diwali_claims`, `diwali_audit`, `diwali_otp`, `diwali_sessions`, `diwali_messages`, `diwali_message_receipts`, `diwali_stock`. Claims have unique invoice/request/reference indexes. Expiring OTPs, customer sessions and callback receipts have TTL indexes; application code independently checks OTP/session expiry.

Public APIs: config, OTP send/verify, register and owned status under `/api/diwali`. Mobile identity comes from the server-issued opaque verified-mobile cookie. Customer references do not authorize access. Admin APIs under `/api/admin/diwali` require a live session and campaign capability; mutations also enforce same-origin requests. Registration retries reuse their request UUID.

Roles: full administrator, verifier, fulfilment, management. Store restrictions apply independently of request filters. Management lists omit PII; exports require explicit permission and are audited. CSV/XLSX reports protect formula-leading values. Retention/backup policies require operator confirmation before live deployment; customer claims/audits are not automatically deleted.

## Testing and operational acceptance

Run `node --test tests/diwali.test.mjs tests/route-guards.test.mjs` for isolated regressions. Run `node --env-file=.env.local --test tests/diwali-database.test.mjs` for opt-in transactional tests. The single ignored .env.local supplies the dedicated operator-authorized DIWALI_TEST_MONGODB_URI and `DIWALI_TEST_DATABASE=sara_diwali_isolated_test_2026`; each run creates and removes only a new synthetic database. All provider calls are mocked.

Run `node --env-file=.env.local scripts/diwali-smoke.mjs` for browser QA against its own database and isolated Next.js dev server. Add `--admin-only` to test the administrative journey with a seeded pending fixture. Windows uses installed Chrome by default; `DIWALI_BROWSER_CHANNEL` can select another supported channel. It uses synthetic accounts, mocks OTP delivery, exercises real verification/registration/admin APIs, and leaves screenshots/logs only under ignored private artifacts. Do not publish those artifacts.

The operator requested no build or lint run. TypeScript checking and focused regression/browser testing are permitted. Production acceptance still requires real approved English/Kannada messages, provider callback verification, staff UAT, purchase/refund policy, procurement specification, MFA where supported, backups/restore evidence, monitoring/escalation and deployment access. No production release or live messaging is performed by these tests.

Optional registration/rejection/delivered templates, live POS integration, automated refund monitoring and courier booking/webhooks are not connected. Dispatch and proof-of-delivery are entered manually. Legal notices and gift procurement facts must be supplied by SARA, not inferred from the demonstration.

## Store posters and registration celebration

Store QR previews, PNG downloads and bulk printing use the supplied Deepavali celebration artwork with each store's tracked QR and store name in its white centre. The public registration success screen shows a one-time gold/silver coin animation and bilingual congratulations, retaining the pending invoice-verification wording and reference. Reduced-motion preferences disable the falling coins. An isolated browser fixture can be checked with `node --test scripts/diwali-celebration-smoke.mjs` (installed Chrome required); it uses synthetic data and never calls the application, database or messaging provider.

## Customer blocklist

Public form registration is limited to one claim per mobile number or email address for the 2026 campaign, irrespective of claim status or selected invoice/store. Existing claims, including online claims, are checked before a registration OTP and before saving. New form registrations reserve hashed identifier keys in `diwali_registration_identities` in the claim/audit transaction, preventing simultaneous duplicate submissions without changing historical records. Retries of the same successful request return its original reference. Gift status OTPs remain available. This limit applies to the public registration form; online order allocation retains its existing per-order behavior.

Full administrators can manage `/admin/diwali/blocklist` from the Diwali navigation. Enter an email, an Indian mobile number, or both, with an internal reason. Email matching ignores case and mobile matching accepts the +91 prefix. Either matching identifier blocks participation; entries can be unblocked and reactivated with an audit trail. Other active entries matching the same customer continue to apply.

New store registrations collect a required email address and check the verified mobile and supplied email before saving, including a recheck in the transaction. Registration OTP requests check the submitted email/mobile before contacting the provider. Status access remains available for existing records. Online gift eligibility checks billing contacts plus session-derived account contacts; blocked customers can still place ordinary orders without the Diwali gift. A block added after eligibility calculation is rechecked in the order transaction. Existing claims are preserved, but approval, packing and dispatch check the current blocklist.

Entries are stored in `diwali_blocklist`, with indexes created by the first administrator save. Block/unblock audit events use `diwali_audit`. The API independently requires full administrator access and same-origin writes; the public API never exposes identifiers or internal reasons. Existing store claims without email can still be matched by mobile. No existing claims are deleted or automatically rejected.
