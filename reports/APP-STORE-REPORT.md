# App Store Readiness Report — Sara Electronics

**Bundle ID:** `in.sarastores.app`
**Version:** 1.0.0
**Date:** 2026-09-25
**Reproduce:** `node scripts/audit-store-readiness.mjs <url>`

## Verdict

**Not submittable today.** Four blockers are Apple account credentials; one is artwork. Two genuine technical rejections were found and **fixed** during this review.

Automated checks: **28 of 35 pass.**

> Apple is the stricter of the two stores, and this app hits several guidelines that e-commerce apps commonly fail. Those are covered in §3.

---

## 1. Rejections found and fixed

### ITMS-90717 — Invalid App Store Icon *(would have been auto-rejected)*

`assets/icon.png` had an **alpha channel** (PNG colorType 6). Apple's build pipeline rejects this automatically — before a human ever opens the app. You would have uploaded, waited for processing, and been bounced by a robot with a terse email.

**Fixed:** generated `assets/icon-ios.png` flattened onto `#0F2557` (colorType 2) and wired it to `ios.icon`.

The Android adaptive-icon foreground **keeps** its alpha — it needs transparency for the layered icon. Flattening both would have fixed iOS and broken Android.

### Missing app privacy manifest

Required since 2024. Dependencies ship their own `PrivacyInfo.xcprivacy` inside `node_modules`, but the app itself had none.

**Fixed:** added `ios.privacyManifests` declaring `NSPrivacyTracking: false`, the four required-reason API codes every React Native app needs, and eight collected data types.

| API category | Reason code | Why |
|---|---|---|
| UserDefaults | `CA92.1` | AsyncStorage |
| File timestamp | `C617.1` | Bundle/asset access |
| Disk space | `E174.1` | Image caching |
| System boot time | `35F9.1` | Elapsed-time measurement |

---

## 2. Passing — guideline compliance

| Guideline | Requirement | Status |
|---|---|---|
| **5.1.1(v)** | Account deletion initiable in-app | Account → Delete my account → `DELETE /api/v1/account` |
| **5.1.1(i)** | Privacy policy reachable in-app | Menu → Legal |
| **5.1.1** | No forced account creation to browse | Full catalogue browsable anonymously |
| **5.1.2** | Usage strings for every permission | Location, camera, photo library — all descriptive |
| **4.2** | Minimum functionality | 27 native screens |
| **3.1.1** | No digital goods outside IAP | Software licences excluded from the app |
| **3.2.2(vi)** | Contests need official rules | No promotions shipped |
| **2.1** | Working account for review | Test credentials available |
| **2.5.1** | No private APIs | Managed Expo, no custom native code |
| — | Export compliance | `ITSAppUsesNonExemptEncryption: false` |
| — | Universal Links | `associatedDomains` configured |

**Account deletion deserves note.** This is the single most common e-commerce rejection, and yours is correctly built: it anonymises the user, purges seven personal collections, anonymises reviews and revokes all tokens — while **retaining order and payment records** for the GST 72-month requirement. That retention is lawful and Apple permits it, but you must state it plainly at the deletion point. It currently is.

---

## 3. Guidelines that commonly catch e-commerce apps

Reviewed specifically, since these are where apps like this fail:

| Guideline | Risk here | Assessment |
|---|---|---|
| **3.1.1 — IAP** | `/software` sells licence keys on the website | **Excluded from the app.** If ever added to iOS, Apple will require IAP and take 30%. Physical electronics via Razorpay is explicitly permitted. |
| **3.1.3(e)** | Goods & services outside the app | Physical appliances — qualifies for the exemption |
| **3.2.2(vi)** | Spin wheel / lucky draw | **Not shipped.** Would need sponsor identity, eligibility, odds, and geo-restriction. |
| **4.2.2** | "Repackaged website" | 27 native screens, native cart, native checkout, push. Clears it. Note the Menu opens legal text in an in-app browser — acceptable, but keep native screens dominant. |
| **5.1.5** | Location | Only used for the store locator, with a clear usage string |
| **1.2** | User-generated content | Reviews exist on the website; **no review-writing flow ships in the app**, so no moderation requirement in v1. Adding it later brings reporting + blocking obligations. |

---

## 4. Blockers

### A-01 · Apple credentials missing — **Blocker**
```
appleId     REPLACE_WITH_APPLE_ID
ascAppId    REPLACE_WITH_APP_STORE_CONNECT_APP_ID
appleTeamId REPLACE_WITH_TEAM_ID
```
Create the app record in App Store Connect, then fill these in `eas.json`.

### A-02 · EAS `projectId` is a placeholder — **Blocker**
Blocks builds **and push notifications** — Expo keys push tokens to the project ID. Fix: `eas init`.

### A-03 · Universal Links return 404 — **Blocker for link handling**
`/.well-known/apple-app-site-association` → 404.

Diagnosed: the rewrite works; the handler returns its own `{"error":"IOS_APP_ID is not configured"}`, not a Next HTML 404. Set on the web host:
```
IOS_APP_ID=<TEAMID>.in.sarastores.app
```
Apple caches the AASA via its CDN — publish it **before** submitting so the reviewer's device can verify it.

### A-04 · Placeholder artwork — **Blocker**
47 KB generated icon and splash. Needs real brand artwork.

### A-05 · iOS native config never validated — **Risk**
`expo prebuild --platform ios` **cannot run on Windows**. The Android config was validated by generating and inspecting the real manifest; the iOS equivalent has never been generated.

The privacy manifest, associated domains and usage strings are all syntactically correct but **unproven**. The first EAS build on macOS infrastructure is the first real test.

---

## 5. App Privacy questionnaire — prepared answers

Consistent with the privacy manifest, derived from actual code paths.

**Data Used to Track You:** *None.* No ad SDK, no cross-app tracking, `NSPrivacyTracking: false`. Do not claim otherwise — Apple validates against the binary.

**Data Linked to You:**

| Type | Purpose |
|---|---|
| Name, Email, Phone, Physical Address | App Functionality |
| Purchase History | App Functionality |
| Precise Location | App Functionality (store locator) |
| Device ID (push token) | App Functionality |
| Photos | App Functionality (complaint attachments) |

**Data Not Linked to You:** Product Interaction → Analytics

**Data Not Collected:** Contacts, Health, Financial Info (card data never touches your servers — Razorpay handles it), Browsing History, Sensitive Info.

The Razorpay point is worth stating explicitly in review notes: **you never store card data**, so "Payment Info" is correctly declared as not collected.

---

## 6. Review notes — draft

Reviewers reject for missing context more often than for defects. Include:

```
Sara Electronics is the app for a 54-store electronics retailer in
Karnataka, India, selling physical goods (televisions, refrigerators,
washing machines, air conditioners).

TEST ACCOUNT
  Email:    <reviewer account>
  Password: <reviewer password>

NOTES FOR REVIEW

1. PAYMENTS (3.1.3(e)) — All items are physical goods delivered to a
   street address or collected in store. Payment uses Razorpay, India's
   standard gateway. No digital content is sold in the app.

2. ACCOUNT DELETION (5.1.1(v)) — Account tab -> "Delete my account".
   Personal data is erased immediately. Order and payment records are
   retained in anonymised form to satisfy India's GST record-keeping
   requirement (72 months); they are no longer linked to the account.

3. LOCATION (5.1.5) — Optional, used only by the store locator to sort
   the 54 stores by distance. The app is fully usable if declined.

4. GUEST BROWSING — The full catalogue, search and product pages work
   without an account. Sign-in is required only for checkout and order
   history.

5. TEST PAYMENT — Razorpay test mode is enabled for the review build.
   Use card 4111 1111 1111 1111, any future expiry, any CVV.
```

---

## 7. Assets required

| Asset | Spec | Status |
|---|---|---|
| App icon | 1024×1024, no alpha | Format fixed; **artwork still placeholder** |
| 6.7" screenshots | 1290×2796, 3–10 | Not produced |
| 6.5" screenshots | 1242×2688 | Not produced |
| 5.5" screenshots | 1242×2208 | Not produced |
| 12.9" iPad | 2048×2732 | **Required** — `supportsTablet: true` |
| Privacy policy URL | Public | `https://sarastores.com/privacy-policy` |
| Support URL | Public | `https://sarastores.com/contact` |

If you do not want to produce iPad screenshots, set `supportsTablet: false`. Declaring tablet support without tablet screenshots is a guaranteed rejection.

**Age rating:** 4+. No objectionable content. E-commerce alone does not raise the rating.

---

## 8. Unverified — the honest gap

Static analysis and bundling cannot prove these. They need a real device build:

- **Razorpay native SDK has never executed.** The web checkout is verified against the live API, but `react-native-razorpay` has not processed a single transaction.
- **Push notifications have never been delivered.** Blocked on `projectId`.
- **iOS native config has never been generated.**
- **Universal Links have never been resolved.**

Everything above is code-complete and type-clean, but "compiles" is not "works". Budget a TestFlight cycle specifically to exercise payment and push on hardware before you submit.

---

## 9. Path to submission

1. `eas init` *(A-02)*
2. Create the App Store Connect record → fill `eas.json` *(A-01)*
3. Set `IOS_APP_ID` and deploy so AASA serves *(A-03)*
4. Commission icon + splash *(A-04)*
5. `eas build --platform ios --profile production` — **first real iOS config validation** *(A-05)*
6. TestFlight: exercise Razorpay and push on a physical device
7. Capture screenshots at all four sizes
8. Complete App Privacy using §5
9. Submit with the review notes from §6

Steps 1–4 are configuration and artwork. Step 6 is the one that cannot be shortcut.
