# Diwali gift registration and management

The campaign runs in the existing Next.js application. Customers use `/diwali-gift`; staff use `/admin/diwali`. This implementation uses MongoDB, matching the operator's implementation instruction. It does not change the existing commerce database configuration.

## Configuration and launch

Registration defaults to closed. A full administrator must supply the controlled store master, English/Kannada terms and privacy notices, claim dates, confirmed eligibility policy and confirmed working-day calendar through `/admin/diwali/settings`. Staff assignments reference existing account IDs; non-administrator staff also need dashboard access and an `/admin/diwali` page grant in account administration. Re-login after changing dashboard access if the old session lacks that claim.

Money currently accepts whole-rupee amounts only. Fractional values are rejected until Finance approves a paise policy. Invoice uniqueness is scoped to store code and normalized invoice number. Administrators can correct pending invoice identity with an audit note; identity and allocation are locked after review. Distinct invoices from the same verified mobile are permitted. Confirm that policy and the invoice namespace before opening registration.

Approval uses the verified invoice value, eligible purchase date and manual cancellation/refund declarations. Approval day is excluded from the seven-working-day calculation; the deadline is the end of the seventh configured working day in Asia/Kolkata. Each approval retains its calendar snapshot and due date. Packing reserves confirmed stock; dispatch consumes the reservation; delivery requires a proof/reference.

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
- `CRON_SECRET`: existing service authentication secret.

Configure a managed scheduler to call `GET /api/cron/diwali` with `Authorization: Bearer CRON_SECRET`, typically every minute. This endpoint is not automatically scheduled by the existing daily cron jobs. Each run processes at most 15 messages; assess throughput and provider limits against expected campaign volume. Production registration opening checks configured required template names but provider approval must be independently evidenced.

Approval and dispatch create durable notification events atomically with the claim. Known rate-limit rejections retry with backoff. Timeout, malformed success, server error and interrupted worker leases become `unknown`; operators must reconcile provider acceptance before resending. Accepted/delivered events cannot be manually resent. Callback receipts handle early and out-of-order events. Message statuses distinguish provider acceptance, sent, delivered and read.

## Data and APIs

Collections: `diwali_config`, `diwali_claims`, `diwali_audit`, `diwali_otp`, `diwali_sessions`, `diwali_messages`, `diwali_message_receipts`, `diwali_stock`. Claims have unique invoice/request/reference indexes. Expiring OTPs, customer sessions and callback receipts have TTL indexes; application code independently checks OTP/session expiry.

Public APIs: config, OTP send/verify, register and owned status under `/api/diwali`. Mobile identity comes from the server-issued opaque verified-mobile cookie. Customer references do not authorize access. Admin APIs under `/api/admin/diwali` require a live session and campaign capability; mutations also enforce same-origin requests. Registration retries reuse their request UUID.

Roles: full administrator, verifier, fulfilment, management. Store restrictions apply independently of request filters. Management lists omit PII; exports require explicit permission and are audited. CSV/XLSX reports protect formula-leading values. Retention/backup policies require operator confirmation before live deployment; customer claims/audits are not automatically deleted.

## Testing and operational acceptance

Run `node --test tests/diwali.test.mjs tests/route-guards.test.mjs` for isolated regressions. Run `node --env-file=.env.diwali-test.local --test tests/diwali-database.test.mjs` for opt-in transactional tests. The ignored test environment supplies the operator-authorized URI and `DIWALI_TEST_DATABASE=sara_diwali_isolated_test_2026`; each run creates and removes only a new synthetic database. All provider calls are mocked.

Run `node --env-file=.env.diwali-test.local scripts/diwali-smoke.mjs` for browser QA against its own database and isolated Next.js dev server. Add `--admin-only` to test the administrative journey with a seeded pending fixture. Windows uses installed Chrome by default; `DIWALI_BROWSER_CHANNEL` can select another supported channel. It uses synthetic accounts, mocks OTP delivery, exercises real verification/registration/admin APIs, and leaves screenshots/logs only under ignored private artifacts. Do not publish those artifacts.

The operator requested no build or lint run. TypeScript checking and focused regression/browser testing are permitted. Production acceptance still requires real approved English/Kannada messages, provider callback verification, staff UAT, purchase/refund policy, procurement specification, MFA where supported, backups/restore evidence, monitoring/escalation and deployment access. No production release or live messaging is performed by these tests.

Optional registration/rejection/delivered templates, live POS integration, automated refund monitoring and courier booking/webhooks are not connected. Dispatch and proof-of-delivery are entered manually. Legal notices and gift procurement facts must be supplied by SARA, not inferred from the demonstration.
