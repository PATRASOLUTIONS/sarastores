# Customer-data security code review — 2026-10-28

Follow-up implementation: findings 2 and 4 have been addressed in the working tree. Export now requires the live account's email to be verified and directs unverified customers to verification. Tracking requires login on the page and API, checks order ownership or existing administrator/store scope, and returns private, non-cacheable shipment responses. The changes were reviewed in source only; no build, lint, tests, or live requests were run. Other findings remain open.

Read-only source review: inventoried 279 API route files and inspected authentication, customer-data routes, exports, order ownership, partner authentication, public tracking, and credential exposure. No build, lint, tests, application requests, provider calls, or database connections were run. No application code was changed. Findings describe the checked-out source, not verified production behavior.

## 1. Critical risk: committed database credentials

`.env.development.local.bak` is tracked by Git. Its HEAD version contains a MongoDB SRV connection string with embedded username and password for a remote, non-placeholder host. Verification printed only boolean classifications, never the URI, host, username, or password. The ignore rules cover `.env.*.local`, but not this backup suffix.

Someone who obtains the repository or this file can attempt direct database access. Reading all customer data depends on whether the credential remains active, its database permissions, and the server's network allowlist. These conditions were not checked. A private repository does not remove exposure to collaborators, leaked clones, or compromised integrations.

Priority action: rotate/revoke the exposed database credential through the database provider, restrict network access and database permissions, remove the backup from tracking, ignore environment backups, and arrange repository-history cleanup. Removing the current file alone does not revoke a leaked credential. Do not paste the credential into tickets or reports.

## 2. High: email-based enquiry export without email ownership verification

Evidence: `app/api/account/export/route.ts:77` requires a session; line 92 reads the account email; lines 104–107 export `leads` and `contact_inquiries` by email without checking `emailVerified`. Password signup creates an unverified user and can immediately issue a session when `startSession` is requested. Login also does not require email verification.

A caller can register a victim's email if that email has no existing account, then export earlier enquiries associated with it. No access to the victim's inbox is required. Exposure is limited to matching enquiry records; this does not bypass the user-ID ownership filters on the other exported collections. Actual exposed fields depend on the stored records.

Fix: export email-keyed records only after the current database account has `emailVerified === true`. Keep account-ID-based records accessible under their existing ownership rules.

## 3. High exposure: Payments access returns orders across stores

Evidence: `app/api/payments/route.ts:8` uses `checkAdminAuthorization`. The aggregation at lines 17–30 joins entire order documents and has no store-scope filter. Line 64 returns those documents. `lib/admin-access.ts` admits staff with `/admin/payments` permission. In contrast, `lib/order-access.ts` and the Orders API enforce selected-store restrictions.

A staff account with Payments permission can receive platform-wide payment/order data, including customer fields present in joined orders, even when its Orders access is restricted to selected stores or absent. This is a confirmed access difference; whether global access is intended for Payments staff is a business-policy question. A compromised such account could expose customers across stores without becoming a full administrator.

Fix: define Payments scope explicitly; if staff are store-restricted, apply the corresponding order/store filter before returning records and project only the payment/customer fields needed by the screen. Avoid returning full order documents, including internal fields.

## 4. Medium: public shipment enumeration

Evidence: `app/api/orders/track/route.ts:117` accepts sequential `SARAECOM-<number>` IDs without a session or guest capability. Lines 191–198 return tracking number, carrier, destination city, and shipment timeline. A shared limit of 15 requests/minute/client exists at line 92.

Sequential guessing can reveal shipment progress and destination cities. Rate limiting slows requests but does not establish ownership, and distributed clients can enumerate more records. This route does not return full names, email addresses, phones, or street addresses in its current response.

Fix: require an authenticated owner or the guest-order capability already used by the order detail route. Return only the shipment fields required by the customer.

## Additional authentication issues outside bulk customer-data access

- `app/api/spin-wheel/register/route.ts:55` puts an untyped, caller-supplied `verificationToken` directly into a MongoDB query. An object containing a query operator can match a verified OTP record for the supplied phone without knowing its token. The record must already be verified; registration also omits an expiry predicate. Require a bounded string token, validate the full body, and atomically consume an unexpired challenge.
- `app/api/spin-wheel/spin/route.ts:100` checks the token only when the stored participant has one. Legacy tokenless records can be accessed by participant ID to read their prize/coupon or consume their spin. Require ownership for legacy records rather than bypassing authentication.

## Protections observed and limits

The full user list requires `requireFullAdmin`; individual profiles check ownership/full-admin role and profile writes restrict fields. Sessions verify signatures, re-read live account roles/status, and check revocation/session version. Password reset tokens are hashed and resetting a password invalidates prior sessions. Order detail access checks ownership, staff store scope, or a guest capability. Guest-order linking requires verified email. Customer address routes filter by session user ID. Dynamic content collection names are allowlisted. Production debug routes are disabled or redact cookies. Partner API keys are validated against stored hashes.

No anonymous route returning the entire customer database was established in the reviewed paths. The committed database credential is the clearest potential route to broader access. This review cannot establish whether credentials are active, the repository has been accessed, the deployed version matches this source, database permissions/network rules are correct, or a breach has occurred. Production access logs and provider configuration would be needed for those conclusions.
