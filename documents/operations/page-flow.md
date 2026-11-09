# Page Flow — Google Analytics 4

`/admin/page-flow` is a separate circular-node canvas for GA4 public-page traffic. It is linked from Customers → Page Flow and the Customer Flow header. It does not replace the first-party customer journey.

Counts above each circle are **GA4 total users per page**, under that property's reporting identity. Views, sessions, date ranges, device and exact source/medium filters come from authenticated GA4 Data API reports. Clicking a circle opens anonymous per-page totals and device/source breakdowns. The page list supports search, sorting, remote pagination and CSV export. Canvas controls include zoom, fit, minimap, fullscreen, refresh, saved positions/viewport, reset and PNG/SVG export.

## Why Website Visitor can be zero

Customer Flow counts identified first-party records, not GA4 visitors. Historical anonymous events without stable identity are excluded. Its zero means no qualifying tracked first-party visitor identities, not that nobody visited the website. GA4 cannot reconstruct those customer records, and its anonymous aggregate users must not be inserted into Customer Flow's customer table counts.

Missing GA4 credentials, denied access, incompatible fields, quota errors and provider failures show an unavailable/setup state, never zero traffic. Valid empty GA4 reports show “No page data returned.” Reporting access does not install a Google tag or repair an unpublished/empty GTM container. Existing GA4 tracking and analytics consent still determine what the property has recorded.

## Connect reporting

Supply the numeric property ID from **Google Analytics → Admin → Property details**. A `G-...` Measurement ID is a browser tracking identifier, not a reporting property ID.

Required server-side setting:

- `GOOGLE_GA4_PROPERTY_ID`

Choose one dedicated readonly credential mechanism:

- Service account: `GOOGLE_GA4_CREDENTIALS_FILE`, referencing a valid service-account JSON file outside the project and OneDrive. Grant that service account Viewer access to the property and enable the Google Analytics Data API in its Cloud project. JWTs request only `https://www.googleapis.com/auth/analytics.readonly`.
- OAuth: `GOOGLE_GA4_CLIENT_ID`, `GOOGLE_GA4_CLIENT_SECRET`, `GOOGLE_GA4_REFRESH_TOKEN`. Use a dedicated reporting client/principal already authorized with `analytics.readonly`; the storefront Google-login OAuth client is not reused.

For local/preview applications, configure `GOOGLE_GA4_HOSTNAME` to the actual public website hostname. Otherwise the configured storefront origin supplies the hostname filter. Localhost is rejected rather than silently querying nonexistent production traffic. `sarastores.com` and `www.sarastores.com` are grouped as the same configured storefront.

Keep runtime settings in `.env.local` or private hosting settings. `.env` is untouched. The names-only `.env.production.local` inventory lists the new names without credential assignments. Never paste keys or tokens into chat or this admin interface. Restart/redeploy the server after changing its runtime credentials, then refresh Page Flow.

The connection status endpoint checks configuration presence only. Successful metadata, compatibility and report reads establish access. The GA4 API supplies property timezone/currency context; relative date presets are evaluated by Google in the property's timezone. No new tags, consent changes, custom dimensions, Google property writes or database writes are part of this reporting integration.

## OAuth permission failures

Google refresh tokens preserve the permissions granted during the original consent flow. The refresh request does not send a new scope parameter; the returned grant is checked for `https://www.googleapis.com/auth/analytics.readonly` before any metadata/report request. A token granted only `userinfo.email` is a login/email token and cannot access GA4, even if the property and client IDs are valid. `invalid_grant`, `invalid_client` and missing Analytics permissions have distinct, sanitized remediation messages. Google response bodies and tokens are never returned to the browser.

To replace a login-only grant, open [Google OAuth Playground](https://developers.google.com/oauthplayground/). In Settings select **Use your own OAuth credentials** and enter the dedicated reporting client credentials privately. Authorize `https://www.googleapis.com/auth/analytics.readonly` using an account with Viewer access to the intended property, then exchange the authorization code. Save the resulting refresh token in `.env.local` or private hosting settings as `GOOGLE_GA4_REFRESH_TOKEN`, restart/reload the server, and refresh Page Flow. The client must already permit the Playground redirect URI `https://developers.google.com/oauthplayground`; the owner controls any Cloud configuration changes. Do not paste the new token into chat. Changing an environment scope value or repeatedly refreshing the old token cannot grant this permission.

## What connections mean

GA4 Data API page/referrer aggregates do **not** expose exact chronological individual navigation histories. Edges show reported internal referring page → viewed page for visible page nodes. Browser referrer values can persist during single-page-app navigation. Use GA4 Explore, or a separately authorized BigQuery export workflow, for true path analysis.

Referrer query strings/fragments are removed before display. When several raw referrer variants collapse to the same safe page pair, page views can be added, but distinct users cannot: that edge's user count becomes unavailable. Page user counts also overlap and must never be summed into a website user total; the website total comes from a separate dimensionless GA4 report.

The canvas displays the selected top 30/60/100 reported pages. All reported public pages remain accessible through search and the paginated page list. Connections inspect up to the top 1,000 referrer rows; coverage and GA4 thresholding, sampling/high-cardinality loss and hourly quota are shown. Private admin/account/order/user paths are excluded; raw URLs with query parameters are not exposed. Exports fail rather than silently issuing a partial file if unsafe URLs or changed totals prevent a complete export.

## Verification

`npm run test:page-flow` runs isolated GA4 request/response fixtures with no Google or database calls. Tests cover numeric property IDs, independent readonly credentials, current metadata validation, compatibility, filters, pagination, page details, correct distinct-user semantics, referrer sanitization, provider failures, caching, date ranges and full-admin guards. `npx tsc --noEmit --incremental false` checks TypeScript. Build and lint are deliberately skipped at the owner's request.

Live GA4 access remains unverified until the configured reporting principal grants analytics.readonly and successfully reads the intended property. Test statistics are confined to test fixtures/browser-intercepted local QA and never used by the production page.

Local browser QA verified the actual missing-configuration state and isolated, intercepted aggregate fixtures on desktop/mobile. Counts appear above each circle; node details, remote pagination controls, search/device filters, layout controls and CSV/PNG/SVG downloads passed with no browser errors. The fixture run blocks external requests and all mutating app API calls. These checks do not establish live GA4 access or mobile-network latency.
