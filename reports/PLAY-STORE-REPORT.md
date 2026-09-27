# Google Play Readiness Report — Sara Electronics

**Package:** `in.sarastores.app`
**Version:** 1.0.0
**Date:** 2026-09-25
**Reproduce:** `node scripts/audit-store-readiness.mjs <url>`

## Verdict

**Not submittable today — but every blocker is an account credential, not a code defect.**

Automated checks: **28 of 35 pass.** All five Play-specific *technical* checks pass. The two Play blockers are a missing service-account key and unconfigured deep-link env vars.

---

## Passing — technical compliance

| Check | Result |
|---|---|
| Package name set | `in.sarastores.app` |
| Version semver | `1.0.0` |
| Adaptive icon ≥432px | 1024×1024 |
| targetSdkVersion | Expo default (API 35+) |
| App Links `autoVerify` | Present in generated manifest |
| Cleartext traffic | No `usesCleartextTraffic` flag |
| Hardcoded secrets | None found |
| expo-doctor | 18/18 |
| Android bundle | Builds clean (3.63 MB Hermes) |

### Permissions — audited against the generated manifest

Verified by running `expo prebuild` and reading the real `AndroidManifest.xml`:

```
SHIPPED                          REMOVED (tools:node="remove")
  ACCESS_FINE_LOCATION             READ_EXTERNAL_STORAGE
  ACCESS_COARSE_LOCATION           WRITE_EXTERNAL_STORAGE
  CAMERA                           SYSTEM_ALERT_WINDOW
  INTERNET
  POST_NOTIFICATIONS
  VIBRATE
```

The three removed permissions were pulled in transitively by `expo-file-system` / `expo-image`. `READ`/`WRITE_EXTERNAL_STORAGE` arrived **unscoped** — no `maxSdkVersion` — so they would have applied on Android 13+ and appeared in your Play listing. Storage permissions on a shopping app invite a "Permissions declaration" review. Blocked via `android.blockedPermissions`.

### Policy compliance

| Policy | Status |
|---|---|
| Account deletion in-app (also a Play requirement) | Implemented |
| Privacy policy reachable in-app | In Menu → Legal |
| Terms reachable in-app | In Menu → Legal |
| Support contact in-app | Native `/contact` screen |
| Browsable without an account | Yes |
| Contests / sweepstakes | **None shipped** — see §Deferred |

---

## Blockers

### P-01 · Play service-account key missing — **Blocker**
`eas.json` points at `./play-service-account.json`, which does not exist. Required for `eas submit`.
Play Console → Setup → API access → create service account → grant *Release manager* → download JSON.
**Do not commit this file.**

### P-02 · EAS `projectId` is a placeholder — **Blocker**
`app.json` still reads `REPLACE_WITH_EAS_PROJECT_ID`. Blocks builds **and silently breaks push notifications** — Expo's push service keys tokens to the project ID.
Fix: `eas init`.

### P-03 · App Links return 404 — **Blocker for link handling**
`/.well-known/assetlinks.json` → 404.

Diagnosed: the Next.js rewrite works correctly and the handler returns its own JSON error `{"error":"ANDROID_PACKAGE_NAME and ANDROID_SHA256_FINGERPRINTS are not configured"}`. Only env vars are missing.

Set on the web host:
```
ANDROID_PACKAGE_NAME=in.sarastores.app
ANDROID_SHA256_FINGERPRINTS=<upload-key-SHA256>,<play-app-signing-SHA256>
```

**Both fingerprints are required.** Play App Signing re-signs your upload, so the store build's fingerprint differs from your local one. List only the upload key and links work in testing then break in production — a failure mode that looks like a regression weeks after launch. Get the Play fingerprint from Play Console → Setup → App integrity.

Note `autoVerify="true"` is already in the manifest, so Android *will* attempt verification and fail until this is served.

### P-04 · Placeholder artwork — **Blocker**
Icon and splash are generated placeholders (47 KB). Needs real brand artwork.

---

## Data Safety form — prepared answers

Derived from actual code paths, not assumption.

**Does your app collect or share user data?** Yes.

| Data type | Collected | Shared | Required | Purpose | Where in code |
|---|---|---|---|---|---|
| Name | Yes | No | Required | Account, order fulfilment | `/api/auth/signup`, `/api/orders` |
| Email address | Yes | No | Required | Account, order confirmation | `lib/auth-credentials.ts` |
| Phone number | Yes | No | Required | Delivery coordination | `/api/orders` |
| Physical address | Yes | No | Required | Order delivery | `shippingAddress` |
| Purchase history | Yes | No | Required | Order history, retention | `orders`, `customer_profiles` |
| Approximate location | Yes | No | Optional | Store locator | `ACCESS_COARSE_LOCATION` |
| Precise location | Yes | No | Optional | Nearest-store distance | `ACCESS_FINE_LOCATION` |
| Photos | Yes | No | Optional | Review / complaint attachments | Complaint flow |
| Device ID | Yes | Yes* | Optional | Push notifications | `device_tokens`, `lib/push.ts` |
| App interactions | Yes | No | Optional | Analytics | `/api/events`, `/api/vitals` |
| Crash logs | No | No | — | Not implemented | — |

\* Push tokens are transmitted to Expo's push service, which fronts FCM. Declare as shared with a service provider.

**Security practices to declare:**
- Encrypted in transit — **Yes** (HTTPS only; no cleartext permitted)
- Users can request deletion — **Yes** (`DELETE /api/v1/account`, reachable in Account)
- Follows Families policy — **No** (not a children's app)
- Independent security review — **No**

**Deletion disclosure.** Be precise, because your implementation is nuanced: personal data is anonymised and seven collections are purged, but **order and payment records are retained** for the GST 72-month statutory requirement. Say this explicitly in your deletion URL — Play rejects vague deletion claims, and "we delete everything" would be inaccurate.

---

## Content rating & listing

- **Rating:** complete the IARC questionnaire. E-commerce with no user-generated public content, no gambling, no violence → expect **Everyone / PEGI 3**.
- **Category:** Shopping
- **Ads:** declare **No** (no ad SDK present)
- **In-app purchases:** declare **No** — physical goods via Razorpay are not IAP
- **Target audience:** 18+ (financial transactions)

**Screenshots required:** minimum 2 phone (16:9 or 9:16, ≥320px), plus 7-inch and 10-inch tablet sets — `supportsTablet` is true, and Play will flag a tablet-declared app with no tablet screenshots.

---

## Deferred features and why

Not shipped in v1, deliberately:

| Feature | Play policy risk |
|---|---|
| Spin wheel, Lucky draw | Contests/sweepstakes require official rules, sponsor identity, eligibility and geo-restriction. Shipping without them risks removal. |
| Software licence sales | Not a Play issue (Play Billing applies to in-app digital content, and these are externally-fulfilled licence keys) — excluded for App Store parity. |

If you want these in v1, the wheel needs a rules screen with sponsor, eligibility, odds and a Karnataka geo-restriction.

---

## Pre-launch report

Play runs automated device testing on upload. Two things now protect you there:
- `app/+not-found.tsx` — a bad deep link no longer white-screens
- `ErrorBoundary` in `app/_layout.tsx` — render crashes show a recovery screen

Both were added during this review; the crawler tests exactly these paths.

---

## Path to submission

1. `eas init` → real `projectId` *(P-02)*
2. Create Play service account → `play-service-account.json` *(P-01)*
3. Set `ANDROID_PACKAGE_NAME` + both SHA-256 fingerprints *(P-03)*
4. Commission real icon and splash artwork *(P-04)*
5. `eas build --platform android --profile production`
6. `eas submit --platform android` → internal testing
7. Complete Data Safety + IARC using the tables above
8. Internal → closed → production staged rollout

Steps 1–3 are configuration. Step 4 is the only one needing external work.
