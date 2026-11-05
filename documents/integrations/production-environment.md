# Environment configuration

Keep only `.env` and `.env.local` at the project root. `.env` is preserved unchanged. Add or update settings in `.env.local`; do not create production/development/test `.env.*` files or environment backups. The owner-approved `.env.production.local` is a names-only inventory: retain its original 56 available names and append missing names without credential values. Hosted Vercel Production settings are separate and must be updated in the Vercel dashboard before deploying.

The 2026-11-04 consolidation preserved all 56 existing `.env.local` assignments and imported missing app/development/IndexNow settings. `MONGODB_URI` was copied from the preserved `.env`; the legacy `MONGODB` name is not the driver's expected variable. Isolated QA credentials were retained under dedicated `DIWALI_TEST_MONGODB_URI` and `DIWALI_TEST_DATABASE` names, without changing the app database selection. Original local values take priority; missing provider credentials remain blank rather than invented.

## Audit

Run `node scripts/check-env-completeness.mjs --report`. It reports names, assignment counts, empty settings, and production configuration issues; it never contacts MongoDB/providers or prints credential values. The sanitized report is `documents/integrations/environment-audit.json`. Unconfigured optional integrations, fallback aliases and platform-provided variables are not all required.

The former `.env.production.local` contained zero active assignments. The local 56-variable list cannot certify the 56 variables hosted in Vercel; compare the required names below with Vercel Production settings without exporting values into chat or Git.

## Current production gaps

- Add the new `INDEXNOW_KEY` and `INDEXNOW_ENABLED` from `.env.local` to Vercel Production. Preserve the verification key; use `/<INDEXNOW_KEY>.txt` and `/admin/indexnow` after deployment.
- Set `MONGODB_URI` in Vercel. `MONGODB` is not its replacement. The original `.env` value is now also present in `.env.local`.
- Supply valid `SMTP_USER` and `SMTP_PASS`, and correct `EMAIL_FROM` to a valid production sender address. Confirm `SMTP_HOST` and `SMTP_PORT` against that account; nonempty defaults were preserved from development settings.
- The local Razorpay identifier is test-mode. Use the production live-mode `RAZORPAY_KEY_ID` and corresponding `RAZORPAY_KEY_SECRET` in Vercel when Razorpay is enabled. Existing local values were not replaced.
- Pine Labs is enabled locally but lacks `PINELABS_CALLBACK_SECRET` and uses a non-production environment. Obtain the callback signing key from onboarding and set `PINELABS_ENVIRONMENT=production`, or explicitly disable that gateway. Do not invent provider keys.
- `PARTNER_ALLOWED_ORIGINS` includes localhost origins locally. Production must use the actual permitted HTTPS partner origins.
- Diwali registration needs `DIWALI_MESSAGING_ENABLED=true`, `DIWALI_OTP_TEMPLATE`, `DIWALI_APPROVED_TEMPLATE_EN`, `DIWALI_APPROVED_TEMPLATE_KN`, `DIWALI_DISPATCH_TEMPLATE_EN`, and `DIWALI_DISPATCH_TEMPLATE_KN`, plus the existing Askeva settings. The template names must be approved by your provider. Blank slots were added in `.env.local`; messaging remains disabled until configured.
- Paytm is disabled locally, so its empty merchant fields are not current requirements. Provide them only when enabling Paytm.

## Gateway reference

These are reference placeholders, not credentials or a command to overwrite local settings. Choose enabled gateways to match your actual merchant accounts:

```dotenv
RAZORPAY_ENABLED=true
PINELABS_ENABLED=true
PAYTM_ENABLED=false
PAYMENT_DEFAULT_PROVIDER=pinelabs
PINELABS_ENVIRONMENT=production
PAYTM_ENVIRONMENT=production
PINELABS_MERCHANT_ID="<merchant-id-from-onboarding>"
PINELABS_CLIENT_ID="<client-id-from-onboarding>"
PINELABS_CLIENT_SECRET="<client-secret-from-onboarding>"
PINELABS_CALLBACK_SECRET="<hex-signing-key-from-onboarding>"
PAYTM_MERCHANT_ID=
PAYTM_MERCHANT_KEY=
```

## Isolated tests

`npm run test:diwali:database` and `npm run test:diwali:browser` load `.env.local` and use only `DIWALI_TEST_MONGODB_URI` for their synthetic databases. They refuse/skip when the dedicated test configuration is unavailable. The browser QA server receives that dedicated URI explicitly. These commands require an operator-authorized isolated test cluster; they do not fall back to the app URI. Do not copy `DIWALI_TEST_*` settings into Vercel Production.

`npm run setup:indexnow` now adds missing IndexNow settings directly to `.env.local` and preserves existing settings. It never creates another environment file.

### Diwali registration and approval confirmations

Customer registration and approval WhatsApp messages send during the request after the claim transaction commits. They do not enter the background queue. Provider failures and uncertain outcomes remain in the message report; reconcile uncertain acceptance before an explicit retry. Dispatch messages retain the existing worker.

Configure `DIWALI_REGISTERED_TEMPLATE_EN` and `DIWALI_REGISTERED_TEMPLATE_KN` in `.env.local` and in the hosted runtime with approved template names. Registration templates take three body parameters in this order: customer name, registration reference, invoice number. Suggested English wording: "Hello {{1}}, SARA has received your Diwali gift registration {{2}} for invoice {{3}}. Your invoice is pending verification. We will notify you after review." Public-form customers must opt in to WhatsApp updates. These template slots are blank until approved names are provided.

Approval uses the existing `DIWALI_APPROVED_TEMPLATE_EN` / `DIWALI_APPROVED_TEMPLATE_KN` settings and parameter order. Report exports include the approving employee name, account ID and approval timestamp. A fulfilment rejection releases packed gift reservations; it does not return dispatched gifts to available stock. Delivered gifts cannot be rejected through this action.


Online eligible orders now create an English registered event in the order transaction and attempt it immediately after commit, using `DIWALI_REGISTERED_TEMPLATE_EN` and the same three registration body parameters. The phone is taken from checkout and normalized to an Indian WhatsApp number. Registration is pending payment confirmation and SARA verification; this message does not confirm gift approval. Missing configuration, provider failure or uncertain acceptance leaves a visible message status for manual review, with no automatic worker retry. Public-form registrations continue to use the customer language and WhatsApp opt-in.

Diwali staff assignments support `full_access`. This grants all campaign operations, exports and all stores, including settings, notifications, blocklist and registration deletion. The account still needs dashboard access and the `/admin/diwali` page grant. It does not change the account role or grant access to other admin modules.
