# Customer journey and responsive UI audit

**Audit initiated:** 12 October 2026. **Local customer-journey verdict: PASS within the scope below. Launch verdict: NOT YET APPROVED.**

This supplements [the production-readiness audit](production-readiness-audit.md). It adds browser-driven registration, login, shopping, checkout and customer-support coverage, rather than treating API tests or read-only screenshots as a complete customer journey. The measured defects were corrected and their affected surfaces retested. Passing isolated local flows is not a production launch certification.

**Illustrated walkthrough:** open [Customer journey in screenshots](customer-journey.html) in a browser for a step-by-step explanation with eleven original mobile/desktop captures. It works offline; keep its `customer-journey-assets` folder alongside the HTML when sharing. The walkthrough distinguishes the authenticated online-payment test, guest COD purchase and later account-layout recheck rather than presenting them as one continuous recording.

## Scope and safety

The actual Next.js production build, route handlers, signed sessions and MongoDB writes were exercised locally. All account, product, order, address and support records were synthetic and confined to a guarded `ecom_sara_audit_*` database. No production customer records, live payments, real emails, WhatsApp messages or external fulfillment were used.

Chrome was controlled through its DevTools protocol at **360 x 800, 390 x 844, 768 x 1024, 1024 x 768 and 1440 x 1000**. The broad route sweep includes full-page scrolling, horizontal-overflow measurement, JavaScript exceptions, failed HTTP responses, broken-image checks, local layout/performance measurements and automated axe WCAG A/AA checks. Screenshots capture individual viewports, not a manual certification of every pixel.

| Surface | Coverage |
|---|---|
| Public pages | 56 route cases at five viewport sizes: home, catalogue, product, category, brand, search, cart, checkout, wishlist, compare, auth, offers/software, stores, support, policies, informational and campaign pages; expected missing-page and invalid-link states included |
| Authenticated pages | 15 account/dashboard routes at five sizes, including profile, orders, preferences/privacy, addresses, cart/wishlist, membership, offers, support, settings and notifications |
| Registration and session | Missing required fields and consent, completed registration, captured verification link, wrong-password rejection, valid login, stale local auth hints, persisted profile edits, logout and protected-route denial |
| Shopping | Mobile search, wishlist add/remove persistence, two-product comparison/clear, product add-to-cart and quantity increment/decrement |
| Authenticated checkout | Missing-address rejection, saved address, server-priced payment creation, payment cancellation, invalid proof rejection, simulated captured payment, confirmation, order history and empty cart |
| Account recovery | Captured recovery email, reset link and login with the new password |
| Guest checkout | Desktop guest delivery details, cash-on-delivery order, private order link, anonymous access denial without its capability and cart cleanup |
| Support | Contact enquiry with consent, complaint requiring an image, upload preview, stored complaint reference and newsletter acknowledgement |
| Dynamic accessibility | Validation errors, password strengths, filled registration/reset forms, populated cart, saved-address checkout, payment rejection, paid/guest confirmation and support success/upload states |

The complete authenticated online-payment journey used the 390-pixel mobile viewport; guest COD used the 1440-pixel desktop viewport. Support submissions used 360-pixel mobile and 1440-pixel desktop views. An additional authenticated COD purchase populated the account-layout rechecks. This does not mean every purchase variation was completed at every size. Route-case counts include expected redirects, missing-page and invalid-link states, not 71 distinct successful page templates or every page in the repository.

## Real application behavior versus provider fixtures

| Component | What was actually tested | Not established by this test |
|---|---|---|
| Sessions and catalogue | Real local application code and isolated database | Hosted cookie/proxy/domain behavior and representative production catalogue data |
| Payment | Real Razorpay SDK transport redirected to a local provider; actual application pricing, HMAC verification and order persistence; synthetic browser widget supplies cancel, invalid-proof and captured-success events | Razorpay hosted widget, genuine sandbox capture, webhooks, settlements, refunds, reconciliation and bank/UPI behavior |
| Bot protection | Explicit fixture widget/token and local validation response | Working Google credentials, scoring and real network failures |
| Email | Real application template/send paths to an in-memory local SMTP sink; verification/reset links used in the browser | SMTP authentication with the real provider, inbox delivery, spam filtering and bounce handling |
| Public assets | Public image/font/map GETs permitted; unrelated external requests blocked | Third-party service availability in every region or CSP behavior on the deployed domain |

## Issues identified and corrected

| Issue | Correction |
|---|---|
| A stale localStorage auth hint could repeatedly redirect login/registration without a valid cookie | Server session is authoritative; invalid hints are cleared without a redirect loop or loss of checkout intent; focus/storage revalidation and logout-race regressions added |
| Tablet wishlist icon had no accessible name because its visible text was hidden | Explicit accessible label |
| Carousel indicators were only 8 pixels high | At least 24-pixel transparent hit areas while preserving small visual dots |
| Category price-range thumbs overlapped and obscured one another for closely priced products | Separate labelled minimum/maximum slider rows with 24-pixel targets, retaining the numeric inputs and existing price-gap constraints |
| Product-card discount/cart colors and several small-text badges failed contrast | Darker compliant foreground/background variants, including hover states |
| Registration consent errors, password strength/requirements and reset requirements failed contrast | Darker text colors without altering validation rules |
| Invalid-login feedback and populated cart/checkout savings failed contrast | Darker error, previous-price and savings text on their existing tinted backgrounds |
| Reset password visibility controls were unnamed | State-dependent show/hide accessible labels |
| Complaint inputs/select/upload and software filters/price fields were unnamed | Explicit label associations and named controls; filter expansion state exposed |
| Dashboard definition-list markup and secondary text failed accessibility checks | Valid definition-list structure and readable colors |
| Order-journey status spans used prohibited accessible-name attributes | Explicit image roles for the named completed/pending indicators |
| Privacy tables and brand-guideline code samples could not be keyboard-scrolled | Named/focusable scroll regions; labelled example fields |
| FAQ count and campaign CTA/pills/prices failed contrast | Targeted text/background corrections |
| A mobile campaign entrance animation briefly extended four pixels beyond the viewport | Vertical entrance animation and shrinkable flex text instead of horizontal overflow clipping |
| Category loading replaced an almost-empty main area with the hero and product grid, moving the footer | Matching header/hero/filter/grid skeleton shared by the route fallback and client loading state |
| Account sidebar appeared only after client authentication, moving content into a different grid column and displacing the footer | Keep the server-verified sidebar during hydration and reserve the account content area; authorization remains server-enforced, and the fallback is not used after logout |
| Account landing redirected while authentication was still loading | Wait for hydration before redirecting; show a matching account-card skeleton; regression covers loading, authenticated and anonymous states |

These are targeted fixes, not a storefront redesign. Initial failures caused solely by the audit blocking public image/map hosts are not counted as application defects.

## Final verification

| Check | Actual result |
|---|---|
| Responsive coverage | 280 public route/viewport cases plus 75 authenticated cases: 56 public and 15 authenticated requested routes, each at all five sizes |
| Dynamic states | 22 additional validation, filled-form, checkout, confirmation, support, guest-denial and price-filter assessments |
| Final effective accessibility/UI set | **377 assessments; zero automated axe violations, horizontal overflow, broken images or uncaught JavaScript exceptions** |
| Browser step checks | 30 successful scripted checks, including focused capability/filter checks and recheck fixture setup |
| Actual database outcomes | **12 assertions passed:** nine verified account/address/purchase/payment/cart/guest outcomes and three stored support/newsletter outcomes |
| Local initial-load performance | LCP **64-2,384 ms**; maximum initial and post-scroll CLS **0.0856**, below 0.1 across all 355 final route/viewport readings |
| Loading-shift fixes | Category CLS fell from approximately 0.796 to **0 at all five sizes**; authenticated-layout maximum was approximately 0.800 before correction; final account landing was at most 0.0562 |
| Regression tests | **333 Node.js tests passed**, zero failures/skips; three additional audit-isolation tests passed. Five authentication/hydration regressions are already included in the 333 |
| Types and lint | Web and mobile TypeScript passed; recommended ESLint: **zero errors, 699 warnings**, without rule downgrades |
| Strict production build | TypeScript and recommended lint enforced; compilation passed and **212 static pages generated**; final artifact served successfully on loopback |

The effective result is **not a claim that every original run was green**. Initial sweeps found defects. After correction, 35 targeted public viewport rechecks, a 75-view authenticated-layout recheck and five final account-landing rechecks replaced only matching route/size readings in the final summary. Unaffected observations remain from the broad sweep. Raw earlier failures are retained alongside the latest evidence.

Five `/spin` console diagnostics explicitly report that the synthetic database has no active prizes. These are expected fixture/configuration states, not uncaught exceptions; active campaign participation was not certified. No unexpected console errors or server 5xx failures remained in the effective set. Up to two incomplete axe checks per assessment require manual review: zero automated violations does not certify full WCAG 2.2 AA compliance.

The original guest-denial check removed the query token but retained the legitimately cached private capability. The corrected focused check first confirmed cached-link refresh, then removed the exact stored capability and verified access denial and an empty cart. There was no public order-access defect. Other harness corrections allowed public image/map GETs, redirected the fetch-based bank-offer call to the local provider and waited for asynchronous address/route completion; those tooling failures were not counted as application defects.

**Evidence retained:** session artifacts under `files\ui-final`, including `summary.json`, `effective-assessments.json`, the nine source JSON reports listed in the summary, `journey-db.json`, `forms-release-db.json`, strict build logs and viewport PNGs. Representative mobile checkout, desktop guest confirmation and dashboard-order screenshots were visually reviewed. Full-page scrolling was automated; screenshots themselves are viewport captures.

**Cleanup:** the owned application/provider processes and dedicated browser were stopped; synthetic audit records, the audit build directory and browser profile were removed. The standard Next.js type references were restored. Evidence files remain; empty audit database collections may remain because this cleanup removed records rather than dropping databases.

## Production decision and remaining gates

Passing this local customer journey is necessary but does **not** establish production readiness. No authorized staging project, deployment URL or isolated hosted credentials were supplied. The owner will deploy; this audit did not deploy or provision infrastructure.

Before launch, verify the deployed release with real sandbox payment/captcha/OAuth providers, transactional email and guest/authenticated checkout; confirm secrets, HTTPS/cookies, payment webhook/reconciliation behavior, required indexes, scheduled work, monitoring, backups/restore and rollback. Existing unresolved high-severity build-tool advisories still require an explicit release decision; the earlier production-only dependency audit was clean, which is not the same as a clean full dependency tree.

Physical devices, Safari/Firefox, native assistive technology, exhaustive admin/vendor/partner UI, in-store OTP delivery, live campaigns/draws, representative product/stock variants, software-license fulfillment and external integrations are not certified by this bounded browser audit. Legal/policy accuracy and operational ownership still need sign-off. Local synthetic performance is not deployed Core Web Vitals or a slow-network/load test.
