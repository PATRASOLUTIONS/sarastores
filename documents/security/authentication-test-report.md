# Authentication test report

Tested 2026-10-25 against the current source checkout.

The results in this report precede the later live name-validation and automatic web sign-in changes. Those changes were not tested or built at the user's request. `/register` now requests a signed cookie session during signup and navigates directly to its return destination; the earlier account-creation-only registration results below are historical.

Command: `npm run test:auth`

The initial run executed 170 tests and exposed two defects through three failed assertions: malformed signup emails and copied web-session tokens remaining valid after logout. Both defects are now fixed. Mobile logout was also corrected to retire the presented access token; logout everywhere now invalidates already-issued access sessions as well as refresh sessions.

The original logout/authentication change passed 649 tests, including 64 new authentication cases, and both web/mobile TypeScript checks. Following the [registration validation update](registration-validation.md) and the review fixes below, the full suite now passes **766 tests, zero failures**. Authentication audit coverage is included in both `npm test` and `npm run test:auth`.

The production build also passed, including its built-in lint/type gates and all 215 static pages. It used an isolated read-only empty MongoDB fixture, a temporary output directory and a synthetic session secret; it did not contact the customer database. The restricted first attempt could not download Google Fonts. A later successful build exposed a Promise-probe issue in the temporary fixture; that fixture was corrected, and the final complete build passed without fixture errors. Existing nonblocking lint, partner-origin configuration and Edge/static-generation warnings remain. The original tsconfig.json and next-env.d.ts were restored after verification. These build artifacts are for verification, not deployment.

## Corrected defects

### Follow-up review

- Return destinations now reject embedded control characters and resolve browser URL dot segments before checking auth pages and privileged destinations. This prevents tab/newline-based external redirects and destinations that disguise `/login` or `/admin` behind `..`. Regression checks use the browser URL parser as a control.
- Login preserves passwords exactly as typed, including whitespace and markup characters, matching registration. A form-handler regression confirms the unchanged value reaches the login service.
- The browser logout UI reports failure when the server returns an error or the request fails, while still clearing local authentication state. Tests cover a 503 response and a network failure; neither reports successful server invalidation.
- The name-validation documentation now describes the implemented placeholder, repetition and keyboard-sequence heuristics, including their false-positive limits.
- Validation: `npm test` passed all 766 tests; web and mobile TypeScript checks passed. The production build completed successfully, including lint/type gates and all 215 static pages, against an isolated read-only database fixture. Its restricted first attempt failed only on Google Fonts downloads; the network-enabled retry passed. Existing nonblocking warnings remain.

### 1. Logout invalidation

- Reproduction: log in successfully using valid synthetic credentials; confirm the resulting token authenticates; call POST `/api/auth/logout`; replay the saved token through either the session cookie or `Authorization: Bearer`.
- Expected: server authentication rejects both replay attempts.
- Fixed: both replay attempts are rejected. Other devices remain signed in, and a new login receives a distinct token.
- Evidence: [regression tests](../../tests/auth-security-audit.test.mjs), [web logout handler](../../app/api/auth/logout/route.ts), [server session validation](../../lib/auth.ts), [token revocation storage](../../lib/session-revocation.ts).
- Each new signed token includes a random session ID. Logout stores only its SHA-256 digest in `revoked_sessions` until the signed expiry; every server session lookup checks that revocation. Existing tokens without a session ID can also be revoked. Middleware stays Edge-safe; authoritative server authorization performs the database check.
- Revocation storage failure returns 503 with Retry-After while still expiring browser cookies. Lookup failures remain server errors rather than a false anonymous session.
- [Mobile logout](../../app/api/v1/auth/logout/route.ts) revokes the presented access token and requests refresh-token revocation. `allDevices` atomically increments the live user's sessionVersion before refresh cleanup, retiring all old access tokens and making refresh rotation reject old versions even if cleanup is interrupted.
- The [mobile API caller](../../mobile/src/api/auth.ts) attaches its current bearer token on logout. Its [HTTP client](../../mobile/src/api/client.ts) skips both proactive refresh and unauthorized-response refresh for that call, so logout retires the existing token pair without creating replacements. Ordinary protected requests retain automatic refresh; all three logout cases and a normal-refresh control are tested.
- [Core index definitions](../../scripts/create-core-indexes.mjs) now include an expiresAt TTL index for digest cleanup. No production index command was executed; lookup remains correct using MongoDB's default `_id` index before the optional retention index is applied.

### 2. Registration email validation

- Reproduction: POST `/api/auth/signup` with otherwise valid registration input and email `not-an-email`.
- Expected: reject invalid email input before account creation.
- Fixed: returns 400 before account creation.
- Evidence: [regression test](../../tests/auth-security-audit.test.mjs), [RegisterSchema](../../lib/validation.ts), [signup handler](../../app/api/auth/signup/route.ts).
- Registration now reuses the shared email validator after trimming. Existing email normalization and duplicate handling remain covered.
- The follow-up `/register` work adds shared Unicode name rules, dedicated email syntax validation, recognized public-suffix checks and a case-insensitive database uniqueness index. Concurrent insert collisions return 409. See [registration-validation.md](registration-validation.md) for the current rules and deployment considerations.

Security assertions remain active in the normal regression suite.

## Requested coverage

| Requested case | Outcome and evidence |
| --- | --- |
| Valid login credentials | Pass: real bcrypt comparison, actual login route, signed production cookie and live-user session lookup |
| Wrong password | Pass: 401, generic credential error, no session cookie |
| Nonexistent user | Pass: same generic 401 response, no session cookie |
| Registration | Implemented and tested: account creation, cost-12 bcrypt hash, default user role, verification email, consent recording, no automatic login |
| Duplicate account | Pass: case-normalized existing email yields 409 EMAIL_EXISTS with no second account or email |
| Invalid registration input | Pass: agreement, mismatched-password and malformed-email checks |
| Logout browser behavior | Pass: both cookies expire and an ordinary browser session becomes logged out |
| Logout server invalidation | Pass: copied cookie and bearer tokens are rejected; other device and fresh-login sessions remain valid |
| Native logout | Pass: presented access token is revoked, refresh revocation is requested, and logout everywhere rejects all old access sessions |
| Logout outages and compatibility | Pass: repeated logout, preexisting signed tokens, revocation storage errors and interrupted logout-everywhere cleanup |
| Session expiry | Pass: already-expired and exact-boundary signed tokens are rejected, including by a protected API |
| Invalid/tampered tokens | Pass: missing, malformed and signature-modified tokens fail closed |
| Password recovery | Pass: known and unknown emails have identical public responses; token is random and stored as a SHA-256 hash |
| Password reset | Pass: valid token changes the password, consumes the capability, increments sessionVersion, requests refresh-session revocation, rejects replay and retires the old password |
| Invalid reset capability | Pass: wrong/expired tokens do not alter credentials |
| Email verification | Pass: valid, wrong, expired and malformed-expiry cases; successful token consumption; repeat link handled as already verified |
| Verification resend | Pass: protected by authentication |
| Protected pages | Pass: account, dashboard, admin and vendor server layouts redirect anonymous requests to login |
| Checkout without login | Accessible by design: guest checkout is supported. The test records this intended behavior; checkout is not an account-only page |
| Protected API endpoints | Pass: anonymous account-address, user-profile and admin-dashboard calls return 401 before data reads; existing route-guard tests inspect all mutating route files |
| Roles and permissions | Pass: customer/vendor denied admin APIs; admin/superadmin accepted; restricted staff allowed only mapped permissions; role changes and inactive accounts take effect through live-user lookup |
| Session fixation | Pass for the tested case: login ignores a planted incoming session and submitted role/permission fields, deriving the issued identity from verified credentials |
| Production cookie settings | Pass: HttpOnly, Secure, SameSite=Lax, path=/, 24-hour lifetime, explicit domain normalization |
| Token/credential leakage | Pass for inspected responses/logs: login JSON/logs omit password, hash, session token and signing secret; reset capability is hashed at rest |
| Login rate limiting | Pass: five failed attempts allowed, sixth rejected with 429 even with CAPTCHA disabled; rotating untrusted forwarding prefixes does not change the trusted-proxy bucket |
| Successful-attempt reset | Pass: successful login resets its attempt bucket |
| Protection backend failure | Pass: login fails closed with 503 before credential lookup |
| CAPTCHA | Pass: enabled CAPTCHA rejects missing proof; existing CAPTCHA tests cover configuration and provider-response behavior |

The registration bullet in the request described registration/duplicate handling as unsupported. Current source and tests show both are implemented; this report records that observed behavior.

## Test implementation and limits

[tests/auth-security-audit.test.mjs](../../tests/auth-security-audit.test.mjs) executes actual TypeScript handlers and authentication services through the repository's source-loader harness. The new tests use synthetic in-memory user records, real bcrypt comparisons, actual HMAC signing, injected request-cookie/header state, an isolated rate-limit counter and captured mail/consent calls. The fixture simulates MongoDB-deserialized Date values so valid-session controls exercise the real Zod record validator correctly.

Tests isolate database connectivity, rate-limit storage infrastructure, SMTP, Google and payment-provider boundaries. No live customer data or provider calls are involved. Revocation storage is an in-memory MongoDB fixture; refresh revocation is captured at the service boundary. These tests verify code behavior, not browser/proxy cookie handling, real SMTP delivery, deployed secret configuration, production database indexes, or latency/timing side channels. Single-device native logout revokes the presented access token; logout everywhere uses the account version to retire all prior access sessions. The fixation and leakage results cover the stated cases rather than claiming every possible attack surface is safe.

The existing files executed by the command are:

- [auth-client-session.test.mjs](../../tests/auth-client-session.test.mjs)
- [recaptcha.test.mjs](../../tests/recaptcha.test.mjs)
- [return-path.test.mjs](../../tests/return-path.test.mjs)
- [route-guards.test.mjs](../../tests/route-guards.test.mjs)
- [security-hardening.test.mjs](../../tests/security-hardening.test.mjs)
- [audit.test.mjs](../../tests/audit.test.mjs)

Both commands are registered in [package.json](../../package.json).
