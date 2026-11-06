# Bytewise Consulting × Sara Stores: marketing and growth plan

Prepared 6 November 2026. Bytewise Consulting is Sara's development and growth implementation partner; Sara Stores is the retailer, seller and owner of product, stock, campaign and customer facts. This plan covers setup, listings, SEO, generative engine optimization (GEO), answer engine optimization (AEO), measurement, paid acquisition and conversion.

## Objective and commercial controls

Build a repeatable path from discovery to a paid, fulfilled order or attributed store visit. Prioritize active, stocked, serviceable products with acceptable contribution margin. Do not spend on products with unresolved identifiers, wrong variants, retailer-directed copy, unverifiable gifts or broken checkout.

Traffic, conversion and revenue baselines are not available in this engagement. “No customer traction” is the owner's assessment, not a measured zero. Use the first 14 days of authorized GA4, Search Console, Merchant and order reporting to establish baselines. Advertising budget is awaiting confirmation; the channel allocation below is a proposal, not authorization to spend.

For every advertised SKU, Sara supplies: net selling price and GST treatment; actual stock and replenishment; manufacturer GTIN/MPN; exact variant; image rights; serviceable geography; margin after payment fees, delivery, gift cost, returns and discounts. Maximum acquisition cost is derived from that contribution margin. Bytewise must not use a made-up ROAS benchmark or revenue forecast.

## Ownership

| Workstream | Bytewise Consulting | Sara Stores |
|---|---|---|
| Website and campaign experience | Implement, test, monitor and prepare releases | Approve business behavior and release |
| Catalogue and Merchant | Validate mappings, preview submissions, investigate errors | Confirm manufacturer facts, margin, stock and account ownership |
| Offers and gifts | Read existing rules; build presentation and expiry handling | Approve dates, scopes, stacking, inventory and fulfilment promises |
| SEO / GEO / AEO | Architecture, templates, internal links, editorial briefs, technical checks | Product expertise, original demonstrations and factual review |
| Paid acquisition | Draft audience, creative, feed and campaign structures | Approve budget, credentials, creative and spend |
| Analytics | Implement consent-aware events; configure reports when authorized | Own accounts, define business conversions and grant scoped access |
| Customer operations | Attribution and website support tooling | Payment verification, delivery, gift approval, reviews and service |

Google account access, production deployment, data changes, advertising spend and messages to customers remain concrete operator actions. Installing code or possessing credentials does not complete those steps.

## Phase 0 — setup and release gates, days 1–7

| Setup | Existing foundation | Required verification / action |
|---|---|---|
| Business identity | Site/store/contact/policy pages | Sara verifies legal/trading identity, contacts, service locations and seller details. Bytewise appears as partner in internal delivery materials; do not replace Sara's seller entity in product markup. |
| Catalogue | `/admin/products`, metadata uploads and `/admin/catalogue-quality` | Select 20–50 launch SKUs. Verify identifiers, exact variants, approved images, final prices, stock and delivery. Fix findings through reviewed imports; preserve offer IDs and existing URLs. |
| Google Merchant Center | XML feed and manual Merchant API preview panel | Verify/claim the website; review India/English source, shipping and returns; choose one source owner per offer. Review and submit a small batch, then inspect Google's processing and diagnostics. Configuration guide: `documents/integrations/google-merchant-api.md`. |
| Search Console | Sitemap/robots/canonical implementation | Owner confirms existing property and access. Inspect representative product, category and store URLs and sitemap status. Do not use the Indexing API for ordinary products. |
| GA4 / GTM | `MarketingTags`, existing ecommerce events and consent controls | Choose GTM or direct GA4, avoiding duplicate delivery. Verify property timezone/currency, cross-page navigation, key events, consent denial/acceptance and purchase deduplication. Tag/account IDs must be supplied and verified, never guessed. |
| Google Ads / Meta | Optional tag gates | Account access, billing, product approval and budget approval before campaigns. Verify conversion mapping and landing pages before activation. Remarketing requires the relevant consent. |
| Business Profile | Existing store location/Profile tooling | Verify profiles, categories, NAP, opening hours, actual services and store ownership. Add campaign links with store-specific UTMs only after review. |
| Promotions | Existing Diwali config, SKU/division gifts, bank offers and marketing controls | Verify dates, active switches, usage limits, gift catalogue and terms. No new campaign records are needed for the website presentation. |
| Performance / accessibility | Deferred home sections, reduced-motion support | Check real mobile LCP/INP/CLS, usable checkout and readable offer cards. Target field p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; unavailable field data stays unverified. |

The 6 November public audit found 1,459 exported offers, only 196 marked in stock, no exported GTINs, SKU substituted for MPN, and 827 descriptions mentioning competing retailers. These are a dated feed snapshot, not current account diagnostics. Resolve the launch selection first; do not mass-upload the full catalogue.

## Phase 1 — organic and listing launch, weeks 2–4

1. Launch verified Merchant free listings and monitor item/account issues daily during the first week. Keep source ownership and stable IDs. Establish a stock/price maintenance process before expanding the manual integration.
2. Improve the highest-value category and brand pages, then launch-SKU pages: accurate names, human product descriptions, exact specs, genuine warranty, returns/shipping links, useful FAQs, helpful comparisons and internal links.
3. Use existing clean product, category, brand, article and store routes. Block filter combinations from indexing; create a dedicated curated landing page only when it has unique products, content and a clear search purpose. Avoid duplicate city/template pages and SEO keyword stuffing.
4. Maintain initial-HTML Product/Offer and BreadcrumbList markup. Use genuine manufacturer identifiers and only published, legitimate review aggregates. Shipping and return details must match the published policy and checkout. Do not invent expiry, ratings, stock, delivery times or certifications.
5. Review product discovery and campaign popups against mobile usability. A compact, dismissible offer invitation supports purchase decisions; the underlying page must remain accessible and crawlable.

## SEO, GEO and AEO execution

SEO focuses on search intent, useful pages, technical accessibility and local evidence. GEO focuses on accurate, attributable product/business passages that AI systems can cite. AEO focuses on concise answers to real purchase questions. They share a factual source; none requires a secret tag or guarantees ranking/citation.

- Every priority product page identifies brand, model, variant, memory/capacity, price, availability, warranty and applicable offer terms in readable content. Keep the final checkout authoritative for delivery, discounts and gift approval.
- Write concise answers to “Who is this for?”, “What is included?”, “Does it qualify for the active gift campaign?”, “What happens after payment?” and “Can I collect it locally?”. Explain exclusions and time limits next to claims.
- Produce original store demonstrations, side-by-side comparisons and product photographs with an identified Sara reviewer. Date fact checks, link official manufacturer sources where helpful and separate measured experience from supplied specifications.
- Publish verified store facts and consistent brand/entity names across the website, Merchant, Business Profile and genuine citations. Resolve inconsistencies rather than generate mass directories or paid spam backlinks.
- Keep important answers in initial readable page content, with appropriate schema. `llms.txt` is an optional discovery aid, not an indexing or citation guarantee. Do not promise FAQ rich-result placement from FAQ markup.
- Review bot access deliberately. Preserve private-route blocks; do not expose orders, customer exports, admin data or capability-token URLs to crawlers. Retrieval-bot access and model-training policies are separate decisions.
- Once authorized, compare Search Console queries with actual customer questions and test a fixed set of product/local prompts monthly in available answer engines. Record dated citations and errors; label unmeasured visibility as unverified.

Detailed keyword clusters, page mapping and an eight-week editorial calendar are in `KEYWORDS-CONTENT-CALENDAR.md`. Search volumes and difficulty are not measured; validate them using authorized Search Console and Keyword Planner access.

## Phase 2 — paid campaigns and conversion, weeks 3–8

Launch paid media only after product approval, measurement and checkout gates pass. Proposed media allocation: 40% high-intent Search, 35% Shopping/product campaigns, 20% local/Meta discovery, 5% controlled creative experiments. Adjust by actual contribution margin and performance; content production and agency fees are separate from media spend.

| Campaign | Structure | Landing / guardrails |
|---|---|---|
| Brand Search | Sara name plus actual locations; separate from nonbrand | Brand/store pages; report existing brand demand separately |
| Nonbrand Search | Brand + model + purchase terms; category/geographic intent | Exact product or useful category page; add exclusions for jobs, support/manual-only searches and irrelevant geography |
| Shopping | Verified stocked launch SKUs, grouped by margin/category | Exact variants and current price/stock; pause or update unavailable offers through approved lifecycle controls |
| Local campaigns | Only serviceable store areas and verified profiles | Actual store location/call/directions; UTMs by location |
| Social discovery | Demonstration, product benefits, factual eligible gift creative | Fast matching product/offer page; separate phone, TV and appliance audiences |
| Remarketing | Consenting product/cart visitors; fulfilled buyers excluded where authorized | Campaign remains valid; suppress ended gifts and unavailable products |

Use negative keywords, geographic exclusions and spend ceilings. Review search terms and SKU-level margin weekly. Evaluate creative on qualified visits, add-to-cart and paid orders, not just cheap clicks. Avoid immediately scaling automation on a tiny or incorrectly tagged conversion sample.

## Campaign creative and website journey

For the current Diwali window, first verify the live approved dates and stock. Use a short launch checklist for existing approved creatives and a small verified SKU selection; do not compress account, tracking or checkout checks to meet a festival deadline. Retire Diwali ads/landing claims when the real offer ends, then use evergreen product, store and buying-advice campaigns. The eight-week calendar must follow whichever offers are actually active at publication time.

The website combines only benefits applicable to the selected product. Example: **Buy this phone + its configured box gift + its eligible Diwali silver tier**. If the same product has a qualifying TV gift, it may be shown; an unrelated TV campaign is not added to the bundle. “30 box” is awaiting clarification and must use the actual configured gift name and photo.

Diwali uses existing approved rules: ₹15,000–₹25,999 → 5g silver; ₹26,000–₹50,000 → 10g silver; ₹50,001–₹80,000 → 15g silver; ₹80,001–₹1,00,000 → 20g silver; ₹1,00,001+ → 1g gold. Whole-rupee eligibility remains enforced. Merchandise value after discounts, including GST and excluding delivery, determines the final tier. ₹15,000 qualifies for silver, not automatically gold.

On entry, show a compact animated invitation with at most three real eligible products. On a product page, show the product plus active gifts, the relevant terms and optional coupon choices directly below Buy Now. Show coupon discounts as alternatives unless the checkout engine explicitly supports stacking. A preview is eligibility guidance, not a gift allocation: payment verification and Sara approval remain required.

Campaign expiry is based on its real dates, not a resetting daily countdown. Inactive, future, expired or usage-exhausted promotions disappear. Open displays are revalidated and expired benefits removed. Do not block mobile browsing or consent choices. Respect reduced motion and keyboard dismissal. Existing checkout/fulfilment rules remain authoritative.

## Measurement and reporting

Use `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `view_promotion` and `select_promotion`; add gift/promotion dimensions without personal data. Distinguish product-page eligibility from approved gift fulfilment. Promotion visibility and clicks are measured only after analytics consent. A local event record is not proof that a GA4/Ads account received the event.

UTM convention: lowercase `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`; campaign example `diwali_2026_mobile`, content example `silver5_phone_variant_a`. Keep customer information and order tokens out of URLs. Track store referral links through existing store-link tooling, and distinguish click intent from verified visits.

| Reporting layer | Cadence | Metrics |
|---|---|---|
| Operational | Daily at launch | Merchant errors, active/stocked offers, feed staleness, campaign expiry, checkout/payment errors |
| Acquisition | Weekly | Qualified sessions, impressions/clicks, query intent, CTR, listing status, channel spend and attributed store actions |
| Conversion | Weekly | Product-to-cart and cart-to-purchase rates, promotion CTR, paid orders, CAC, AOV, refunds/cancellations |
| Financial | Weekly / monthly | Contribution margin after media and gifts; fulfilled revenue; category/SKU profitability |
| Search / answer engines | Monthly | Indexed priority pages, query visibility, field performance, dated AI citations and incorrect answers |

Purchase reports must be reconciled with paid/fulfilled orders and refunds. Do not equate registration, failed payment or popup dismissal with a sale. The plan does not authorize exporting customer data into public reports.

## Retention, reputation and additional listings

Transactional order/payment/delivery messages support the purchased service. Promotional email, WhatsApp and SMS require the customer's corresponding opt-in and an easy opt-out. Prepare separate welcome, back-in-stock, relevant accessory and repeat-purchase briefs; suppress unavailable products, ended offers and unsuitable audiences. The repository's abandoned-cart cron is currently disabled: design and review a recovery flow before claiming it is automated or enabling it. Do not send messages as part of this implementation.

Ask fulfilled customers for honest reviews through an approved consent/communications flow. Do not buy reviews, fabricate ratings or require a positive rating for a benefit. Sara handles product questions and complaints; Bytewise prepares review-response guidance and evidence reporting. Referral/loyalty experiments need explicit commercial rules, fraud controls and contribution-margin review before development or launch.

After Merchant readiness, assess additional marketplace and social catalogues individually: seller eligibility, fees, shipping/returns, inventory maintenance, identifier requirements, approved image rights and SKU margin. Prepare channel mappings rather than copying competing retailer content or opening accounts automatically. Use genuine local associations, supplier collaborations and store events for relevant mentions; any customer outreach, paid placement or commercial partnership needs its own concrete approval.

## Weeks 9–12 and subsequent scale

Expand verified listings and profitable query groups; publish comparisons and local proof; improve losing funnel steps through controlled experiments. Use stock and margin labels when a reviewed catalogue process supplies them. Test popup against a no-popup cohort using consent-aware measurement, with one change at a time. Track incremental conversion and distraction, including mobile exits and close rate.

By day 30: launch-SKU facts verified, measurement tested, first Merchant diagnostic review complete, four useful editorial pieces published, baseline dashboard established where access exists. By day 60: eight pieces, approved listing expansion, two completed conversion experiments and channel-level margin reporting. By day 90: sixteen useful pieces/pages, a documented product-data maintenance process, SKU/category acquisition decisions based on real margin, and monthly SEO/GEO evidence review. These are delivery targets, not forecasts of sales.

Months 4–6: deepen profitable categories, improve original product demonstrations and legitimate local citations. Months 7–12: build Sara's authoritative buying advice, genuine reviews, community/store events and reviewed partnerships. Paid placements and customer messaging require separate concrete approvals.

## External setup still needed

Confirm budget, priority categories/locations, “30 box” definition, verified gift facts, Merchant account/data source, GA4 property and chosen GTM/GA4 tag, Search Console property, Ads/Meta account access and Business Profile ownership. Credentials must use protected authorized mechanisms; do not send passwords or tokens in chat. Code, plans and configuration references can be prepared now. Account configuration, live submissions, spending and deployment are not claimed complete without verification.
