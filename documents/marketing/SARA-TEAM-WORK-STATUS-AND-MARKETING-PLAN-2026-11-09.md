# Sara Stores: work completed, pending actions and marketing launch plan

**Prepared:** 9 November 2026  
**Audience:** Sara management, inventory, store operations, marketing and development teams  
**Delivery partner referenced in the existing project plan:** Bytewise Consulting  
**Purpose:** One handoff document showing the work available in the repository, its business value, what still needs verification, and the steps required to launch measurable marketing.

**Development follow-up, 9 November:** bounded product/offer pagination, server filtering/cache, safe PWA lifecycle/cache, narrow header search, Meta commerce mapping/deduplication and journey event cleanup are now implemented locally. The main regression suite passes 1,004 tests. Build/lint were not run. See [completed fixes and the owner action checklist](SARA-OWNER-PENDING-ACTIONS-2026-11-09.md) for remaining Google authorization, tag publishing, catalogue facts, production settings, release and physical-mobile sign-off.

## 1. Management summary

Website and marketing development is present in the repository. It includes Customer Flow, Page Flow, catalogue-quality review, prefilled Excel downloads and missing-data uploads, Google Merchant integration, public SEO improvements, and product-specific offer/gift presentation. Existing marketing controls also support banners, posters, landing pages, leads, email/WhatsApp campaign preparation and store attribution.

However, completed development, deployment, Google account authorization, Google listing approval and an active advertising campaign are separate milestones. This report does not describe all five as completed.

The most important current gaps are:

1. **GA4 collection is not active through the published GTM configuration checked today.** The public container still contains empty tags and rules. The website loads the GTM initializer, but that alone does not collect Analytics data.
2. **Page Flow's local reporting token is not working.** The latest Google token exchange returns `invalid_grant`. Earlier checks found an email-only token without `analytics.readonly`. A fresh reporting authorization is required.
3. **Merchant launch needs verified catalogue facts and account approval.** A dated supplier audit found missing manufacturer identifiers across all 196 selected in-stock candidates. The Excel workflow now provides a way to fill verified missing facts; it does not invent them.
4. **Mobile performance needs improvement and repeated live verification.** The dated mobile audit found a particularly large and slow product-listing page. Physical cellular performance and field Core Web Vitals are not certified.
5. **Recent features need a hosted release/demo check.** Repository commits prove delivery of code; they do not prove that every feature is deployed and working in the currently hosted release.
6. **Paid campaigns require launch SKUs, margins, geography, budget, approved creatives, reliable conversions and operational sign-off.** There is no verified campaign-spend or campaign-revenue result to report yet.

Content preparation, supplier verification, store-profile review and creative planning can proceed now. Paid acquisition should begin with a controlled pilot after the measurement, catalogue and checkout gates below pass.

## 2. How to read the status

| Status | Meaning |
|---|---|
| Implemented in repository | Source code or tooling exists and can be reviewed or demonstrated. |
| Locally verified | A documented source, TypeScript, isolated-test or local-browser check passed. This does not establish hosted/provider behavior. |
| Live observation | A dated public website/configuration read or an authorized provider response was checked. Scope is stated. |
| Pending | Work, business input, authorization or verification is still required. |
| Existing foundation | A capability already present in the platform; listed for marketing use without claiming it was newly created during the latest flow work. |

No customer records, raw customer exports, passwords, client secrets, refresh tokens or access tokens are included in this document. Catalogue counts and performance numbers below are dated observations, not today's automatically refreshed totals.

## 3. Recorded development delivery

The following recent commits are visible in the repository:

| Date | Commit | Recorded title | Review value |
|---|---|---|---|
| 9 November 2026 | `55d368b` | customer flow | Contains Customer Flow, Page Flow, tracking changes, tests and operational documentation; 37 changed files recorded in that commit. |
| 8 November 2026 | `9e3e557` | seo | Contains catalogue/SEO/Merchant-related changes and regressions; 47 changed files recorded in that commit. |
| 6 November 2026 | `bc4cc9d` | promotion | Contains promotion/product-presentation/marketing work and tests; 39 changed files recorded in that commit. |

File counts are commit evidence, not a measure of customer impact. Some files can occur in more than one commit. Do not infer production deployment or campaign activation from a commit title.

### Delivered work and its business purpose

| Workstream | What is present | Why Sara needs it | Status and remaining action |
|---|---|---|---|
| Customer Flow | `/admin/customer-flow`: circular journey graph, unique tracked identities, customer table and timeline | See where identifiable customers progress, fail or stop | Implemented; documented local verification. Hosted demo and continuing event coverage still needed. |
| Page Flow | `/admin/page-flow`: GA4 page-user graph, page list, device/source details and exports | See which public pages receive visitors, including aggregate anonymous traffic | Implemented; local tests pass. Live reporting authorization is pending. |
| Catalogue-quality review | `/admin/catalogue-quality`: audit findings, filters, readiness summaries and supplier export | Identify missing facts before advertising or Google submission | Implemented. Sara must supply verified corrections and run a fresh review. |
| Prefilled Excel template | Download current product IDs, item numbers, names and available supported values | Inventory staff can correct real existing products instead of starting with a blank sheet | Implemented. Verify the hosted download and use corrected batches. |
| Missing-data Excel upload | Preview, row errors, approval and transactional updates to existing products | Fill gaps safely while preserving populated facts | Implemented with isolated regression coverage. Business facts and approved saves remain operator actions. |
| Google Merchant tooling | Shared feed/API validation and a reviewed five-product submission workflow | Prepare accurate free listings and Shopping product inputs | Implemented. Account setup, verified products, submission and Google diagnostics are pending. |
| SEO foundation | Public server-loaded content, canonical alignment, metadata, headings, schema and sitemap handling | Improve crawlability and quality of product/category/store landing pages | Locally tested and documented. Recheck the hosted release and Google indexing. |
| Product offers and gifts | Product-specific benefit section, gift terms, timed celebration and coupon alternatives | Show relevant benefits close to purchase actions | Implemented. Sara must approve actual offer dates, eligibility, gift availability and fulfilment. |
| Marketing administration | `/admin/marketing` and connected content/creative/campaign tools | Let the team manage approved copy and placements without a code change for every campaign | Existing and expanded foundation. Configure approved content and verify hosted behavior. |
| Analytics event wiring | Consented page, product, cart, checkout, login and payment milestones in the event pipeline | Support conversion measurement and first-party journey analysis | Implemented in source. GTM delivery and live event deduplication remain to be verified. |
| Reliability and privacy controls | Independent route guards, server-authoritative money, consent gating and restricted exports | Protect customer data and trustworthy order reporting | Source controls and prior audit evidence exist. Hosted/provider checks and release review remain necessary. |

## 4. Customer Flow: what development added

**Page:** `/admin/customer-flow` — full administrators only.

- Thirty small, 44px circular nodes show customer counts above the icons and percentages below the stage labels.
- The journey covers visitors, guest/registered paths, products, cart, authentication, checkout, address, payment, order creation and delivery states.
- Failure/abandonment branches include browsing/product/cart/checkout abandonment, login/payment failure, retry, cancellation, failed delivery, return and refund where supporting records exist.
- Clicking a node opens its matching customer table. Columns cover identity/contact information, customer type, activity, stage, products, cart/order amounts, payment/order status, device, source and first visit where known.
- Search, filters, sorting, pagination and CSV export operate on the selected cohort. Clicking a customer opens the recorded chronological timeline.
- Controls include zoom, fit, minimap, fullscreen, refresh, layout save/reset and PNG/SVG graph exports.
- Real aggregations read existing customer, event, cart, checkout-intent and order data. Bounded queries, server-side pagination and supporting lookup/date indexes help these reads. No production demo statistics are inserted.
- Customer access is guarded server-side. Optional tracking respects analytics consent; layout storage contains positions/viewport rather than customer records.

**Important interpretation:** Counts represent distinct account IDs and consented browser identities, not guaranteed distinct physical people across all devices. Missing historical visitor identity is not reconstructed. Abandonment can be inferred from at least 24 hours of recorded inactivity; it is not proof that someone deliberately abandoned a purchase. Later order status does not fabricate every earlier milestone.

**Why a visitor node can show zero:** No qualifying identifiable first-party records may exist for that range. This does not establish zero website traffic. Anonymous GA4 page users belong in Page Flow, rather than being converted into fictional named customer rows.

**Documented checks:** 23 flow/cart/access regressions and 43 auth/consent regressions passed in the implementation record. Local browser checks covered circles, the customer drawer, timelines, dragging, controls and exports. Warm read-only graph queries were approximately 0.75–0.9 seconds and tables approximately 0.3–0.5 seconds in that check; those numbers do not certify production cold starts or cellular latency. Two payment price-change fixture failures were documented as reproducing against the unchanged baseline; the 9 November follow-up corrected their outdated cart-key fixtures and both now pass, with the full main regression suite passing as well.

## 5. Page Flow: what development added and why it is pending

**Page:** `/admin/page-flow` — linked beside Customer Flow and restricted to full administrators.

- Small circular page nodes show GA4 users above each circle, with page views and percentages below.
- Today, Yesterday, 7/30/90-day and custom dates, device, page search and exact traffic-source/medium filtering are supported.
- A page click opens anonymous aggregate totals and device/source details. The full page list supports remote pagination, sorting, search and CSV export.
- The canvas includes zoom, fit, minimap, fullscreen, refresh, local layout save/reset and PNG/SVG exports.
- GA4 metadata and dimension/metric compatibility are checked before reports. Requests are bounded, cached briefly and scoped to the public storefront hostname.
- Whole-site unique users come from a separate aggregate report. Per-page users overlap and must not be summed into a website customer total.
- Missing access, invalid credentials, quota failures and unsupported fields show an unavailable/authorization message rather than invented zero statistics.

**Data limitation:** GA4 aggregates cannot provide customer names, emails, phone numbers or individual customer histories. Graph edges represent reported internal referring pages, not proven exact chronological next-page paths. Customer Flow is the separate first-party customer-record tool.

**Current blocker:** All required local setting names were present in the latest connection check, but Google returned `invalid_grant`. Previously, the supplied token granted only `userinfo.email`. Obtain a fresh dedicated OAuth grant including `https://www.googleapis.com/auth/analytics.readonly`, save the new refresh token privately, and verify metadata and actual reports for property `530847951`.

**Fix already added:** Refresh requests no longer attempt to add a new permission to an existing token. Expired/revoked grants, invalid clients and missing Analytics scope have distinct, sanitized errors and setup guidance. TypeScript and all 20 focused reporting/route-guard tests passed in the latest verification. Fixture browser checks previously verified the page graph, page details, filters, pagination and exports; authenticated live GA4 report success remains pending.

## 6. Catalogue Excel and Merchant work

### Inventory team's Excel workflow

1. Open `/admin/catalogue-quality` and choose **Download Excel template**. The current catalogue includes itemno, name, product ID and existing supported values; genuine gaps are blank. A scan also allows a filtered catalogue download.
2. Supply verified missing facts. Retain product ID and itemno when available; format GTIN/itemno/HSN as text to preserve leading zeroes.
3. Upload and choose **Preview upload**. Review proposed changes, preserved fields and row errors.
4. Correct errors, approve the preview, save the missing data, and rescan.

Supported facts include classification, brand, description, manufacturer, model, GTIN, MPN, HSN/GST, warranty, images, SEO fields and missing price/MRP/stock. Uploads update existing products and do not create new products. Populated values and valid zero values are preserved; ordinary changes to existing price/stock use the separate product workflow. Formula cells, ambiguous identities and conflicting matches are rejected. Uploads are limited to 3 MB/500 rows; the approved save is transactional and rechecks current data.

### Merchant readiness evidence

| Dated observation, 6 November | Finding | Required response |
|---|---|---|
| Catalogue audit | 2,446 products and 2,442 specification records; 1,471 public representatives selected | Refresh this audit after corrections; these are dated counts. |
| Initial launch candidates | 196 active, in-stock products selected | Choose a manageable verified launch subset, rather than blindly uploading the whole catalogue. |
| Manufacturer identifiers | All 196 candidates lacked recorded GTIN or MPN in the inspected records | Sara/suppliers must verify exact manufacturer identifiers for each variant. |
| Competitor-directed copy | 149 candidate description flags resolved in generated Merchant content by the second audit | Preserve factual product content; inspect remaining public pages. Original database descriptions were not rewritten by that cleanup. |
| Saved public feed | 1,459 offers, 196 in stock; old mapping used SKU as MPN and treated absent identifiers as nonexistent | Verify release of the corrected mapping; do not assume a retailer SKU is a manufacturer MPN. |

The earlier public-feed marketing audit also reported 827 competing-retailer descriptions across the larger feed. That broader count and the 149 selected-candidate flags describe different scopes; the candidate output cleanup does not prove that all catalogue copy is corrected everywhere.

### Merchant development already present

- XML feed and Merchant API share title, description, brand, image, identifier and INR selling-price validation.
- SKU/internal IDs remain stable offer IDs rather than fabricated manufacturer MPNs. Missing identifiers are not automatically declared nonexistent.
- Invalid price, above-MRP conflict, unsupported condition, unsuitable image and duplicate identity can block export/submission.
- `/admin/catalogue-quality` exposes a full audit and a separate, explicitly reviewed batch of up to five products for Merchant API submission.
- Signed previews bind the admin, account, source, product selection and exact payload; current facts are rechecked before submission.
- Submission is manual. It does not automatically claim domains, create sources, change shipping/returns, delete Google products or keep later out-of-stock items synchronized.
- An entirely invalid corrected feed fails explicitly instead of publishing a successful empty catalogue. Resolve verified records before enabling Google fetches of that corrected feed.

**Pending:** Supplier facts, fresh audit, Merchant account access, website claim, data-source ownership, policies, reviewed first batch, Google processing/approval and an approved ongoing stock/price lifecycle. An accepted API input is not an approved Google listing.

## 7. SEO and website presentation work

The public SEO implementation record covers 44 indexable templates: product, category, brand, campaign, article, store and other public pages. Recorded changes include server-loaded primary content, visible headings without JavaScript, aligned `www` canonicals, metadata, safer article HTML, genuine product/policy markup, validated store facts, noindex utility/private surfaces and explicit sitemap-source failures.

The 2 November local audit recorded 44/44 template checks passing for initial HTML, desktop/mobile hydration and JavaScript-disabled content, plus 56 Node SEO regressions and 15 offline Python checks. These are template/fixture results, not approval of every real product or live indexing.

The dated live crawl checked 1,315 sitemap URLs, including 1,128 product pages. It found canonical-host disagreements, many missing initial-HTML headings, a failing blog index and a timed-out campaign. Source fixes were documented locally. Recheck the actual hosted release before describing those live findings as resolved. The same audit recorded a basic product schema pass, which is not Merchant approval or a Google Rich Results certification.

Product/campaign presentation now supports applicable gift images and terms near Buy Now, a dismissible product-specific celebration, real expiry handling, coupon alternatives and hiding empty review/offer sections. Eligible benefits come from current product/campaign rules and server prices. No unrelated gift, fabricated review, guaranteed EMI approval or unsupported delivery promise should be used in marketing copy.

## 8. Marketing tools available to the team

These are usable platform foundations or reviewed additions; existence does not establish that a campaign is configured, approved, sent or profitable.

| Admin route/tool | Marketing use | What the team must still do |
|---|---|---|
| `/admin/marketing` | Homepage, product/listing, cart, brand, about, header and footer content controls | Approve copy, images, links and placements; verify mobile output. |
| `/admin/listing-banners` | Banner/promotion artwork and ordering | Supply approved, compressed images and matching live destinations. |
| `/admin/posters` | Poster/creative preparation | Approve prices, rights, offer terms and expiry. |
| `/admin/campaign-pages` | Campaign landing pages | Create useful, campaign-specific copy linked to eligible stocked products. |
| `/admin/promotions`, `/admin/gifts`, `/admin/diwali` | Coupons, product gifts and festival rules | Confirm scope, dates, caps, gift inventory, stacking and fulfilment. |
| `/admin/customer-centric` and templates | Audience/campaign and email/WhatsApp preparation | Verify channel opt-in, provider access, template approval and opt-out; review before sending. |
| `/admin/leads` | Lead and newsletter review | Assign ownership, respond promptly and respect consent. |
| `/admin/store-qr` and analytics | Store-specific links and attribution | Use verified store destinations; distinguish QR clicks from actual purchases/visits. |
| Store locations and Google profile pages | Local discovery and store facts | Verify ownership, addresses, hours, services and current profiles. |
| Customer Flow / Page Flow | Journey and page reporting | Establish reliable tracking and explain cohort definitions. |
| Spin/prize and advertising-placement tools | Optional approved promotions | Review rules, availability, customer terms and relevant approvals before activation. |

### Retention scheduling: correction to older documents

Older plans described abandoned-cart scheduling as disabled. Current source includes guarded Vercel cron routes, a cart-recovery replacement, wishlist/lifecycle jobs and maintenance/outreach groups. `vercel.json` currently contains three schedule entries: product-email automation, daily maintenance and daily outreach. Outreach includes cart recovery, wishlist alerts and lifecycle reminders. Recovery code checks email consent and supports dry-run/caps.

**Status is configured in code, production execution unverified.** Verify hosting-plan schedule support, secrets, provider setup, job duration, skip/failure reports, suppression and delivery logs. Do not claim automated recovery revenue or invoke sending/deletion jobs merely to demonstrate the feature. Any activation/review must use the approved operator process.

## 9. Latest integration status

Public configuration was rechecked on **9 November 2026 at approximately 13:40 IST**. No production records, customer messages, Google settings or tags were changed during preparation of this report.

| Integration | Latest evidence | Status / next action |
|---|---|---|
| Public storefront | Homepage returned HTTP 200; GTM initializer present | Site responds; this is not a full purchase-flow certification. |
| GTM `GTM-T3ZWGR7L` | Published public resource returned HTTP 200 with empty tags/rules | Create/review Google and event tags, Preview, then Submit/Publish. |
| GA4 `G-WPZC537DQY` | Measurement ID absent from that published container | Verify stream belongs to the intended property and publish a single coherent measurement setup. |
| GA4 property `530847951` / Page Flow | Local setting names present; token exchange returned `invalid_grant` | New dedicated analytics.readonly grant; verify metadata, permissions and reports. |
| Clarity `z8bi556xww` | Script/runtime observed in the 8 November public audit | Client integration present then; dashboard receipt and current release still need verification. Avoid duplicate GTM installation. |
| Meta Pixel `1420583090240084` | PageView integration observed in the 8 November audit | Test actual event receipt, consent, commerce mappings and deduplication before optimization campaigns. |
| Merchant Center | Tooling and feed work exist; no authenticated account approval verified here | Claim website, verify facts/policies/source, submit reviewed products and inspect Diagnostics. |
| Search Console | Technical foundations and reporting guides exist | Verify property/access, sitemap processing, indexing and representative URL inspection. |
| Business Profile | Store/profile tooling exists | Verify actual store ownership, NAP, categories, hours and serviceable areas. |
| Google Ads / Meta Ads | Proposed campaign plan, no verified active spend/results in this handoff | Account/billing/access, conversion mapping, approved budget and launch gates. |
| Email/WhatsApp and cron | UI/jobs exist in source | Provider, consent, approved templates, scheduler execution, opt-out and monitored delivery. |

**Tracking setup rule:** Use one page-view method. For the initial automatic-Google setup, allow the Google tag's default page views and exclude `page_view` from the custom-event regex. Only switch to custom platform page views after that emitter is deployed/verified, and then disable the corresponding automatic page views. Do not run both delivery methods for the same visit.

Current GTM loading is gated by both analytics and advertising consent. Declined tracking is expected to reduce measured coverage. GA4 collection and Page Flow's OAuth reporting authorization need separate verification. New tags cannot recover visits that were never recorded.

## 10. Checklist before paid marketing

The owner and completion evidence should be agreed for every row. “Pending verification” does not mean the code is absent.

| Gate | Required action | Primary owner | Completion evidence | Current status |
|---|---|---|---|---|
| Launch products | Select 20–50 genuinely stocked, serviceable SKUs with acceptable margins | Sara inventory/commercial | Signed launch list, stock, variants, prices and margin sheet | Pending business confirmation |
| Product facts | Confirm GTIN/MPN, brand/model/variant, original descriptions, warranty and image rights | Sara/suppliers; development supports import | Verified sources, approved corrections and fresh audit | Pending verified facts |
| Landing pages | Match creative to the exact variant, price, stock and eligible offer | Marketing + development | Desktop/mobile review of each advertised URL | Pending hosted review |
| Business identity | Confirm legal/trading details, support contacts and seller identity | Sara management | Approved visible business/contact pages | Pending confirmation |
| Shipping/returns | Match published policies, serviceable pincodes, fees, delivery estimates and returns workflow | Sara operations | Policy/checkout comparison approved by operations | Pending live confirmation |
| Checkout/payments | Test successful, failed, pending/retried payments, stock/price changes, order creation and duplicate protection | Development + Sara operations | Approved isolated/sandbox journeys and monitored hosted sign-off | Pending provider/live release verification |
| Offers/gifts | Confirm dates, thresholds, stock, caps, restrictions, coupon behavior and claim/fulfilment process | Sara commercial/operations | Approved offer sheet matching checkout and creative | Pending current campaign approval |
| Mobile usability | Verify product/cart/checkout, offer dismissal, touch targets, errors and consent on physical phones | Development + marketing QA | Device/network evidence with no purchase blocker | Pending physical-device/network checks |
| Performance | Reduce heavy listing payload; measure landing pages and checkout repeatedly | Development | Before/after evidence; field/lab limitations recorded | Source improvement implemented; hosted/mobile verification pending |
| GTM/GA4 collection | Publish reviewed tags, validate consent and count each intended event once | Analytics/Google account owner | Tag Assistant, DebugView and Realtime proof | Blocked by empty published container |
| Page Flow access | Replace invalid token and verify read-only access | Google account owner + development | Successful metadata/compatibility/report reads | Blocked by invalid grant |
| Purchase conversion | Use actual paid transaction IDs; reconcile failed orders, refunds and duplicates | Analytics + finance/operations | GA4/Ads conversion compared with verified orders | Pending |
| Merchant account | Verify/claim domain; confirm business, India/English source and shipping/returns | Merchant account owner | Account checks and source ownership confirmed | Unverified |
| Merchant products | Submit a reviewed ready batch and resolve Google issues | Inventory + Merchant owner | Diagnostics show intended products eligible for the intended surface | Pending |
| Merchant lifecycle | Keep stock/price current and stop ads for unavailable offers | Inventory + development/marketing | Defined update cadence, ownership and failure alert | Manual initial workflow; ongoing lifecycle pending |
| Search Console | Verify property, sitemap, canonical/indexing and key landing pages | SEO/account owner | Authorized reports and URL inspection | Unverified |
| Business Profile | Verify store addresses, hours, categories, photos and genuine services | Store managers/account owner | Profile review and website consistency | Unverified |
| Ads accounts | Access, billing, policy eligibility, linked measurement/Merchant assets | Account owner | Account-ready checklist | Pending |
| Budget | Approve monthly media ceiling, pilot budget and stop rules | Sara management/finance | Written approval and margin-based acquisition limits | Pending |
| Creative/content | Approve truthful copy, image/video rights, terms and expiry | Sara + marketing | Approved creative library and matched URLs | Preparation can proceed; approvals needed |
| Attribution | Agree UTMs, channel names, store links and reporting definitions | Marketing + analytics | Tested links and reporting sample | Plan prepared; verification pending |
| Customer messaging | Verify opt-in/opt-out, sender identity, approved provider templates and suppression | Sara CRM/operations | Approved dry-run, consent review and controlled delivery proof | Pending activation verification |
| Email deliverability | Confirm provider/sender setup and SPF/DKIM/DMARC as applicable | Domain/provider owner | DNS/provider evidence and controlled inbox check | Unverified |
| Retention scheduling | Review configured jobs, hosting limits, caps and failure/skip logs | Development + operations | Approved dry-run and observed scheduled execution | Source configuration exists; hosted execution unverified |
| Privacy/security | Restrict PII exports, review consent/retention and deployed access controls | Sara owner + development | Release/privacy review; no PII in analytics or public material | Source safeguards exist; operational verification pending |
| Backup/recovery | Confirm usable backup and an isolated restore; agree rollback | Hosting/database owner + development | Restore evidence and release rollback instructions | Do not assume a plan or clone UI is a verified recovery backup |
| Campaign go/no-go | Review the above, approve launch selection and name daily monitors | Sara management + delivery leads | Written pilot sign-off | Pending |

## 11. Website development still needed

### Highest priority: measurement and conversion foundations

- Publish and verify GA4/GTM events: product view, add/remove cart, cart view, checkout, payment information and genuine purchase. Promotion views/clicks should be included when the matching campaign is active.
- Finish Page Flow authorization and verify the hosted graph/table with actual GA4 reports.
- Verify Customer Flow event continuity after deployment; demonstrate real tables without filling missing history with guesses.
- Complete approved catalogue facts and re-audit the advertised selection before Merchant submission.
- Validate price, stock, delivery, coupons and gifts against checkout; resolve release-suite failures with meaningful tests.
- Set up operational error visibility for payments, orders, feeds, report access and scheduled jobs.

### Mobile and performance work

The 8 November mobile audit measured homepage LCP around 5–6 seconds, one product around 5.48 seconds and the product listing around 21.24 seconds in its slow-4G scenario. Listing HTML was approximately 3.57 MiB before compression. These were single-run browser-lab observations, not physical-cellular or field percentiles.

The 9 November follow-up replaced the full-catalogue listing payload with 24 server-rendered cards, server filters/counts and paginated reads with crawlable URLs. The private normalized index is shared for 60 seconds. A 1,200-product synthetic comparison reduced raw JSON from 4,316,671 to 14,722 bytes; this is a fixture payload result, not a measured production LCP improvement. Continue measuring image sizes, JavaScript, public cacheability and database/function placement after release.

The follow-up also stopped unregistering workers/deleting caches on every full load and replaced the worker with Sara-owned, bounded public caches and explicit expiry/privacy/network-failure behavior. Navigations, private/customer APIs and payments bypass caching. Hosted worker upgrade, physical-device behavior and field speed still require verification; PWA installation alone is not proof of faster mobile shopping.

Use field p75 targets of LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 when field data becomes available. Preserve an explicit “unverified” status where data is missing; do not manufacture a PageSpeed score or cellular-speed pass.

### Ongoing improvement after the pilot gates

- Refresh priority category/brand/product descriptions and FAQs using verified facts and original demonstrations.
- Review low-converting landing pages using actual Page Flow, Customer Flow and order evidence.
- Verify the newly implemented consent-gated Meta browser commerce mapping and purchase deduplication in the hosted Pixel Test Events before selecting Meta purchase campaigns; any optional server Conversions API integration remains separate work.
- Establish approved Merchant stock/price lifecycle, alerts and expiry handling.
- Review consented retention segments, suppression, send caps and real recovery outcomes.
- Improve accessibility, reduced-motion behavior, keyboard use and clear error recovery.
- Recheck policy/store/contact consistency and genuinely earned reviews.

## 12. Marketing plan

### Business objective and boundaries

Create a measurable path from discovery to a paid, fulfilled order or an attributed store enquiry. Promote profitable, stocked and serviceable products. No revenue forecast, ROAS promise, keyword-volume claim or customer-growth result is invented here. Existing work prepares the machinery; marketing results require an approved campaign and reliable data.

| Phase | Activity | Required outputs |
|---|---|---|
| Foundation: first 7–14 working days after owner inputs | Tracking, catalogue launch set, website/checkout verification, Google account review and approved creatives | Completed critical gates, working reporting, ready products and pilot approval |
| Discovery/listings: following 2–4 weeks | Merchant free listings, priority SEO pages, original product/store content, verified local profiles | Eligible listings, indexed priority pages, useful content and measured baseline |
| Controlled paid pilot: after gates pass | High-intent Search, verified Shopping products and a small approved local/social test | Spend-capped campaigns, accurate conversions and weekly SKU/channel review |
| Optimization: following 30–90 days | Improve landing pages/creatives, negatives and geography; expand only profitable stock; approved retention | Margin-aware acquisition, better conversion and documented customer/order outcomes |

These are planning windows, not promises of Google approval dates. Account authorization, supplier facts, business approvals and release verification determine the start.

### Channel and campaign structure

| Channel | Plan | Conditions |
|---|---|---|
| Google Merchant free listings | Start with verified launch SKUs; monitor item/account issues closely | Product/account eligibility and current stock/price |
| Google Search | Separate Sara brand demand from nonbrand model/category purchase intent | Matching landing pages, negative keywords, serviceable geography and spend ceiling |
| Shopping/product campaigns | Organize eligible products by category and margin | Merchant eligibility, reliable purchase conversions and lifecycle ownership |
| Local discovery/Business Profile | Verified store photos, useful updates, directions/contact links and local pages | Genuine store facts; report clicks/enquiries separately from actual visits |
| Meta/Instagram | Original phone/TV/appliance demonstrations and truthful current benefits | Approved creative, appropriate consent and verified measurement |
| Remarketing | Relevant consenting product/cart audiences; suppress unsuitable buyers/offers | Adequate eligible audience, current stock/terms and authorized suppression |
| Email/WhatsApp retention | Approved welcome, relevant product/accessory, back-in-stock and recovery messages | Channel opt-in, opt-out, provider approvals and monitored send caps |
| SEO, GEO and AEO | Useful product/category/store answers with verifiable facts and original evidence | No guarantee of search rankings or AI citations; measure dated visibility |

The existing plan proposes a **40% high-intent Search / 35% Shopping / 20% local-Meta discovery / 5% creative experiments** media allocation. This is a starting proposal, not approved spend. Sara must approve an actual rupee budget; allocate only to eligible channels and adjust using contribution margin and real performance. Content production and service fees are separate from media spend.

### Content and creative calendar

Prepare approximately two useful assets per week, subject to verified facts and team capacity. Replace seasonal subjects if the actual offer is no longer active.

| Week | Main content | Companion asset / destination |
|---|---|---|
| 1 | Correct priority product/variant descriptions and current offer terms | Short exact-product creative linking to ready SKUs |
| 2 | Phone buying guide for an actually stocked price range | Verified store spotlight with real photos, hours and directions |
| 3 | Camera/battery/storage comparison using sourced facts and original demonstration | TV-size decision guide linked to current stock |
| 4 | Current gifts/coupons and a truthful checkout walkthrough | Warranty, shipping and returns questions answered from approved policies |
| 5 | Refrigerator capacity/features guide | Store-pickup explanation approved by operations |
| 6 | Washing-machine comparison | EMI costs/eligibility explanation using current bank terms |
| 7 | Original demonstrations for two priority profitable categories | Current-deals page; retire ended festival claims |
| 8 | Improve buying guides using real search/customer questions | Genuine customer/store story with publication permission |

Avoid invented reviews, copied competitor buying language, unverified delivery promises, guaranteed finance approval and gifts unrelated to the advertised SKU. A decorative gold coin in creative does not change the actual eligible gift tier.

### Attribution and reporting

Use lowercase `utm_source`, `utm_medium`, `utm_campaign` and `utm_content`. Example: `utm_source=instagram&utm_medium=paid_social&utm_campaign=sara_mobile_launch&utm_content=verified_model_video_a`. Do not include a customer's email, phone, order token or other private identifier in URLs. Use store-specific links for location attribution.

| Cadence | What to report | Interpretation |
|---|---|---|
| Daily during launch | Spend, Merchant issues, stock/price, tag failures, checkout/payment failures and offer expiry | Operational health before increasing traffic |
| Weekly acquisition | Impressions, qualified clicks/visits, search terms, eligible listings, geography and store enquiries | Separate brand demand, paid/organic and intent from completed sales |
| Weekly conversion | Product-to-cart, cart-to-paid-order, checkout/payment outcomes and promotion interaction | Compare actual recorded cohorts; counts across stages/pages overlap |
| Weekly financial | Paid/fulfilled order value, refunds, media cost, AOV, CAC and contribution margin | Reconcile with authoritative orders; purchase events alone are not settled profit |
| Monthly search/content | Priority-page indexing, query visibility, content performance and dated AI citations | No keyword-volume or ranking claim without evidence |

Definitions: AOV = chosen paid-order revenue basis ÷ paid orders; attributed ROAS = attributed revenue ÷ media spend; acquisition cost must use an agreed, deduplicated new-customer definition. Set maximum acquisition cost from contribution margin after cost of goods, payment fees, delivery, gifts, discounts and expected returns. Agree revenue/refund windows and attribution before comparing channels.

Build an initial 14-day measurement baseline once tracking works. Historical unrecorded traffic cannot be recreated. Do not label absence of reporting access as absence of customers.

## 13. Ownership and immediate action sequence

| Team | Owns |
|---|---|
| Sara management/finance | Budget, release/pilot sign-off, commercial limits and seller/business facts |
| Sara inventory/suppliers | Stock, exact variants, GTIN/MPN, cost/margin, warranty and approved correction sources |
| Sara stores/operations | Service locations, delivery/returns, gift fulfilment, support and verified order outcomes |
| Google/domain/account owner | GA4/Merchant/GSC/GBP/Ads access, authorization, website claim, billing and provider settings |
| Development / Bytewise | Source delivery, safe imports/previews, technical integration, deployment preparation, performance and meaningful verification |
| Marketing / Bytewise with Sara approval | Content, creatives, UTMs, campaign drafts, channel review and truthful reporting |
| Hosting/database/provider owner | Production configuration, release, backups/restore, monitoring and approved schedule/provider activation |

### Next working-week sequence

1. **Agree the status and demonstrate delivered work.** Choose the actual hosted or controlled-preview release; record which routes are live and which require release. Assign one accountable owner per pending gate.
2. **Fix Google measurement/access.** Publish the reviewed GTM setup; verify events and consent. Obtain a new reporting token privately, then demonstrate real Page Flow reports. Confirm GA4 web-stream/property mapping.
3. **Prepare the launch catalogue.** Sara selects products and supplier facts; download the prefilled sheet, preview corrections and apply only approved changes. Re-audit the selected SKUs.
4. **Review Merchant and operations.** Confirm domain/source/policies and exact product ownership. Prepare the reviewed ready batch and verify actual Google processing. Complete payment/fulfilment and rollback review.
5. **Fix and measure priority mobile pages.** Work first on the heavy listing and advertised product/checkout paths; document before/after evidence and PWA safety.
6. **Prepare campaign assets in parallel.** Approve launch copy, rights, actual prices/gifts, serviceable areas, UTMs and a small budget. Organic content preparation need not wait for paid activation.
7. **Hold the go/no-go review.** Launch a spend-capped pilot only when the relevant gates pass. Monitor daily and review actual SKU/channel economics weekly.

### Demo checklist for the Sara team

- Show Customer Flow's circular nodes, selected-stage customer table, timeline, date filters and exports in an authorized private demo. Redact contact details in shared screenshots.
- Show Page Flow's page list and details using authorized GA4 data once connected. Until then, show its explicit authorization state and the remaining Google action; do not present test statistics as real traffic.
- Download catalogue Excel and verify real itemno/name/current values; preview a small verified correction without saving unapproved changes.
- Show Merchant audit findings and exact reviewed payloads. A blocked unverified product is a useful safeguard, not a listing approval.
- Show marketing controls and a genuine eligible product offer; compare it with actual approved checkout terms.
- Attach release/version, test evidence, owner and completion evidence to each accepted deliverable. No customer messages or commerce/Google writes are needed merely to demonstrate source delivery.

## 14. Evidence and limits

This handoff consolidates repository source, recent commit records, existing audit/runbooks and fresh public/token checks. It is not a new full-site crawl, full regression run, campaign performance report, physical-device study or Google-account compliance audit. No build or lint was run for this Markdown task, in accordance with the owner's instruction. Earlier documents may contain older successful isolated builds or dated failing suites; those results are not reclassified as a current full-release pass.

Key supporting references, retained under `documents/`:

- [Customer Flow implementation and verification](../operations/customer-flow-canvas.md)
- [Page Flow setup, semantics and verification](../operations/page-flow.md)
- [Prefilled catalogue Excel and missing-data upload](../operations/catalogue-missing-data-excel.md)
- [Merchant API workflow and account prerequisites](../integrations/google-merchant-api.md)
- [Dated Merchant catalogue readiness audit](../seo/merchant-catalogue-readiness-2026-11-06.md)
- [Public SEO audit and source fixes](../seo/FULL-PUBLIC-SEO-AUDIT.md)
- [SEO gaps and outstanding verification](../seo/SARA-SEO-GAPS.md)
- [Mobile, analytics and PWA audit](../seo/mobile-analytics-platform-audit-2026-11-08.md)
- [Existing Bytewise–Sara growth plan](BYTEWISE-SARA-GROWTH-PLAN.md)
- [Keyword/page map and editorial calendar](KEYWORDS-CONTENT-CALENDAR.md)
- [Promotion setup verification](SETUP-STATUS-2026-11-06.md)
- [Product offer/gift implementation](OFFER-EXPERIENCE-IMPLEMENTATION.md)
- [Broader dated production-readiness audit](../production-readiness-audit.md)
- [Existing business feature catalogue](../FEATURES.md)

Current source takes precedence where older notes are stale: recovery scheduling is configured through guarded Vercel jobs now, while actual hosted execution remains unverified; GA4 setting names are now present locally, while the grant is invalid; catalogue uploads now support verified missing identifiers, while the dated supplier gaps still require a fresh rescan. The live GTM resource remained empty at today's check.



## November 9 Google-tag follow-up

The supplied GA4 snippet is correct for `G-WPZC537DQY`. Public inspection found the deployed storefront referencing GTM while the published container still had empty tags/rules. The application now defaults to direct GA4 when a valid measurement ID is configured, with an explicit `NEXT_PUBLIC_GOOGLE_TAG_MODE` switch selecting either direct GA4 or GTM. The direct script is mounted once globally after analytics consent; early ecommerce events queue before script readiness, advertising choices remain independent, and automatic Google page views are not manually duplicated. `.env.local` selects direct mode. This supersedes earlier instructions that the application always prefers GTM when both IDs are configured.

Production deployment and actual Google receipt remain pending: the workspace had no linked Vercel project, CLI or deployment credentials. A fresh test without analytics consent can still report an undetected tag. The reporting OAuth grant for Page Flow remains a separate owner action. See [Google tag connection](../integrations/google-tag-connection.md) and the updated owner checklist for release settings and acceptance steps. No build or lint was run, as requested.
