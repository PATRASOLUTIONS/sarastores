# Google API setup for Sara Stores

Prepared 2026-11-02. No credentials were read, OAuth consent initiated, private
account accessed or Google resource modified. Access is **unverified** for all
services until an authorized principal successfully reads the intended resource.

The SEO fixes are implemented locally. Completing account verification still
requires the owner's existing GSC property, numeric GA4 property ID, Merchant
account/data-source IDs, and GBP account/location IDs plus reporting access.
No passwords, keys or tokens should be sent in chat. A credential-free mobile
PageSpeed request returned HTTP 429; `.seo-local/performance/summary.json` keeps
field and lab results explicitly unverified. Use an available approved quota
or an owner-provided PSI/CrUX export to finish measurement; do not infer a CWV
pass from source code, the build or blocked-resource browser checks.

## Shared authorization procedure

1. The owner identifies the Cloud project and exact GSC/GA4/Merchant/GBP resource
   IDs, grants reporting access and chooses a credential mechanism.
2. Enable only needed APIs and verify project quota/approval. Cloud IAM access
   alone does not grant Search Console, GA4, Merchant or GBP resource access.
3. Prefer OAuth for the owner-controlled principal or a dedicated service account
   where supported. Obtain short-lived access tokens through official tooling;
   never paste refresh tokens/private keys into an agent conversation.
4. Store credentials outside the OneDrive/project tree with per-user ACLs. Use
   server-side environment references or a reviewed credential provider; never
   `NEXT_PUBLIC_*`. Do not reuse Sara's customer Google-login credentials without
   reviewing consent/client type and scopes.
5. Run configuration-only preflight, then prepare a small read request. A successful
   request establishes that principal's access to that resource, not universal
   integration success. Record status, collection time and permission scope.
6. For 401 refresh/re-authorize through the chosen mechanism; for 403 check API
   enablement, scope, project approval and resource roles. For 429 respect Retry-After
   and bounded exponential backoff. Stop after repeated failure; do not expand scope
   or provision resources automatically. Missing data is never treated as zero.

`python scripts/seo/google-preflight.py` reads only optional configuration in
`.seo-local/google/config.json`. It does not load tokens, connect to APIs or prove
access. Even complete configuration reports authenticated access UNVERIFIED.
Prepared nonexecuting read requests are in `scripts/seo/google-requests.json`.

Example local configuration, with no secrets:

```json
{
  "gsc": { "property": "sc-domain:sarastores.com", "api_enabled": false, "resource_access_confirmed": false, "scopes": [] },
  "ga4": { "property_id": "REPLACE_LOCALLY", "api_enabled": false, "resource_access_confirmed": false, "scopes": [] },
  "merchant": { "account_id": "REPLACE_LOCALLY", "data_source_id": "REPLACE_LOCALLY", "api_enabled": false, "resource_access_confirmed": false, "scopes": [] },
  "gbp": { "account": "accounts/REPLACE_LOCALLY", "project_approved": false, "api_enabled": false, "resource_access_confirmed": false, "scopes": [] },
  "psi": { "url": "https://sarastores.com", "api_enabled": false }
}
```

## Search Console API

- Enable `searchconsole.googleapis.com`; use scope
  `https://www.googleapis.com/auth/webmasters.readonly`.
- Verify `sc-domain:sarastores.com` or use the exact existing URL-prefix property.
  The property type is not inferred from the website URL. Add the intended
  principal to that property with permission sufficient for the requested read.
- Read submitted sitemaps, then a short Search Analytics range and a small URL
  Inspection sample. Encode the entire property identifier in REST path segments.
- Fetch dimensionless totals separately from page/query rows; anonymized queries
  and row limits affect completeness. Inspect the indexed version, not a live crawl.
- Check current quotas in the API project/docs before batch inspection. No sitemap
  submission/deletion or Indexing API calls are prepared. Products are not eligible
  for the Indexing API's JobPosting/BroadcastEvent-specific notification workflow.

Official authorization reference, fetched during review:
https://developers.google.com/webmaster-tools/v1/how-tos/authorizing

## GA4 Data API

- Enable `analyticsdata.googleapis.com`; use
  `https://www.googleapis.com/auth/analytics.readonly`.
- Supply the numeric property ID, not its `G-...` Measurement ID. Grant the
  intended user/service-account principal property reporting access, typically
  Viewer for these aggregate reads.
- Start with `runReport` for Organic Search landing pages/sessions/active users.
  Validate metric/dimension compatibility through the current metadata API.
  Include property quota information, timezone/currency and data-quality notes.
- Analyze ecommerce only if existing measurement supplies valid item/transaction
  IDs and revenue. No tag installation, Measurement Protocol event submission,
  consent change or property configuration write occurs here.

Official quickstart, fetched during review:
https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart

## Google Merchant API

- Use Merchant API, distinct from legacy Content API and DataForSEO marketplace
  intelligence. Verify current supported API discovery/version before executing
  the prepared `products/v1` request template.
- Required scope is `https://www.googleapis.com/auth/content`; this scope can
  permit writes, so the operational workflow restricts itself to read methods.
- Supply account ID, authorized account user/principal, verified/claimed website,
  data-source ID/type, feed label, language/country and stable item-ID convention.
  Confirm any developer registration requirement in the current official setup.
- Read processed products/status and reconcile by SKU with Sara's public
  `/feed/google-merchant.xml`. A valid feed does not prove Merchant acceptance.
- ProductInput insert/update/delete, data-source changes, website claims and
  shipping/returns configuration require a separate reviewed preview and approval.

Official entry point: https://developers.google.com/merchant/api
The initially requested authorization guide URL was unavailable during review;
current authorization/version details must be rechecked before live execution.
The endpoint templates are preparation, not a successful API connection.

## Google Business Profile APIs

- Apply for API project access as required. Verify approval and nonzero quotas;
  enabling APIs does not by itself grant usable access.
- Enable Account Management and Business Information APIs for the initial
  accounts/locations reads. Additional APIs require separate use-case review.
- Use user OAuth `https://www.googleapis.com/auth/business.manage`; the principal
  must own/manage the relevant account/locations. Do not assume an arbitrary
  service account automatically has Business Profile access.
- Read accounts, then locations with a bounded page size and explicit readMask.
  Match verified locations to Sara store pages. A public Places/Maps result is
  not private Business Profile API authorization.
- Broad scope does not permit this workflow to post, reply to reviews, edit hours,
  verify listings or create locations. Do not build deprecated Q&A API workflows.

Official prerequisites, fetched during review:
https://developers.google.com/my-business/content/prereqs

## PageSpeed Insights API and Core Web Vitals

- Enable `pagespeedonline.googleapis.com` for automated use; obtain and restrict
  an API key to the intended API/client environment. No OAuth property membership
  is required for public PSI analysis, but access/quota can still fail.
- Official docs permit anonymous trial requests. This does not prove that an
  anonymous request from this environment will succeed. No credential is assumed.
- Collect mobile/desktop Lighthouse separately. Report actual Lighthouse version,
  URL, time and emulation. Lab LCP/CLS/TBT do not constitute real-user INP.
- For field CWV use available CrUX URL-level/origin-level evidence, recording
  aggregation window/device and fallback scope. At p75: LCP ≤2.5 s, INP ≤200 ms,
  CLS ≤0.1. Insufficient CrUX traffic is unverified, not a failure or a pass.
- Do not infer CWV from the presence of `ReportWebVitals` or an empty fixture.

Official PSI guide, fetched during review:
https://developers.google.com/speed/docs/insights/v5/get-started

## Evidence and write approval

Keep raw Google exports under `.seo-local/` only after reviewing sync/privacy
implications; prefer a protected nonsynced location for sensitive results.
Sanitize queries/URLs that may contain PII before adding findings to `documents/seo/`.
Never print keys, Authorization headers, token files or provider error bodies.

Any future write proposal must identify resource IDs, changed fields/items,
request count, effects, preview, rollback and the owner's explicit authorization.
If it also needs a database change, tell the owner first and obtain separate
database approval. This integration creates no Google resources or scheduled jobs.
