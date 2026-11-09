# Sara Google tag connection — 9 November 2026

The supplied `gtag.js` snippet is correct for measurement ID **G-WPZC537DQY**. Do not paste an additional copy into individual pages: the application installs it globally through the root layout.

## What was found

Read-only public HTTP checks returned 200 for `https://www.sarastores.com` and the published `GTM-T3ZWGR7L` script. The storefront HTML referenced GTM rather than the direct GA4 measurement ID. The published container script had empty tags and rules and did not contain the GA4 measurement ID. This explains the missing connection; a loaded empty GTM container does not install a Google tag.

## What changed locally

- Direct GA4 is selected when a valid GA4 ID is configured. An explicit `NEXT_PUBLIC_GOOGLE_TAG_MODE=gtm` selects GTM instead. Only one Google installation mounts.
- A single global `gtag.js` script and once-only configuration are installed after analytics consent. Advertising consent is independent; denied advertising storage remains denied.
- Genuine ecommerce events queue before Google script readiness. Internal manual `page_view` events are not forwarded to Google alongside automatic page views.
- Consent withdrawal disables Google Analytics collection and updates Google consent settings. Regrant restores the same installation without a second configuration.
- Local settings select direct mode. No credentials are included in this document.

These changes are local. Production has not been deployed from this workspace. The Google tag was not verified receiving live events after the change.

## Required production release

Set these public values in the hosting Production environment before deploying the updated application:

```text
NEXT_PUBLIC_GOOGLE_TAG_MODE=direct
NEXT_PUBLIC_GA_ID=G-WPZC537DQY
```

The GTM ID can remain stored, but its loader is inactive in direct mode. Remove any separately installed duplicate Google snippet or GA4 container installation. Next.js public settings are included in the client release; editing environment settings alone does not update an existing deployed bundle.

No linked Vercel project, Vercel CLI, or deployment credentials were configured here, so production deployment remains an owner action. No build or lint was run, following the owner's instruction.

## Live acceptance checklist

1. Open the deployed site in an unblocked browser and accept analytics cookies. Advertising consent may remain refused. Confirm only one `gtag/js?id=G-WPZC537DQY` installation and Google collection requests for that ID. Check the console for blocked-script or CSP errors.
2. Run Google Tag Assistant against the live storefront. Verify GA4 Realtime receives the visit; standard reports can take time to process. A fresh automated detector without accepted analytics consent may still report no tag because this site uses consent-gated loading.
3. In the GA4 web stream, verify enhanced measurement for page views and browser-history changes is enabled. Check one initial page view and one per client navigation; do not create a second custom `page_view` tag.
4. Verify real product/cart/checkout activity and genuine successful-order `purchase` events, including items, currency, value and transaction ID. Compare purchases with paid orders and check duplicates. Do not send invented production purchases to test this setup.
5. Refuse analytics consent and verify no new Google loading/manual analytics events; withdraw consent after acceptance and verify collection is disabled. Reaccept and verify collection resumes without duplicate setup.

The browser tag and the server GA4 Data API are separate connections. Fixing browser measurement does not repair Page Flow's reporting OAuth grant. That still needs correctly scoped `analytics.readonly` authorization, matching reporting credentials, Viewer access to property **530847951**, and the Analytics Data API enabled. See [Page Flow operations](../operations/page-flow.md).

If GTM is chosen later, publish and validate its Google tag and GA4 ecommerce event tags before changing the mode to `gtm`; the current configurable GTM loader requires both analytics and advertising consent.

## Local verification

`npx tsc --noEmit --incremental false` passed. The Google tag, consent, Meta commerce, journey tracker, promotion, audit and readiness regression selection passed all 376 tests. The earlier focused selection passed all 34 tests; these selections overlap. The configuration checker selects direct mode without exposing values. Browser receipt and production deployment remain unverified; isolated tests do not contact Google or use customer data.
