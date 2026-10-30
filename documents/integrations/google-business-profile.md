# Google Business Profile account connection

Open `/admin/store-locations` and select **View all Google data**. This opens `/admin/store-locations/business-profile`, where an administrator can connect one or more Google identities and view the accounts, business groups and locations those identities can access.

This uses Google Business Profile OAuth, separately from the Places API key used by the public store locator. It does not automatically import locations into the platform or modify listings on Google.

## Google Cloud setup

1. Request [Google Business Profile API access](https://developers.google.com/my-business/content/prereqs) for the Cloud project. A project with zero Business Profile quota generally needs access approval; billing or a Places API key alone does not provide this access.
2. Enable **My Business Account Management API**, **My Business Business Information API**, and **Google My Business API** (the v4 API used for photos and reviews) in the approved project.
3. Configure the OAuth consent screen and create an **OAuth client ID / Web application** in [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
4. Include `https://www.googleapis.com/auth/business.manage` in the consent configuration. Google requires this scope even though this integration only reads listing data. The connection also requests OpenID identity, email and profile scopes to identify the connected account.
5. Register the exact callback used by this deployment:

   `https://YOUR-DOMAIN/api/admin/store-locations/business-profile/callback`

   Use the same canonical origin where administrators sign in. The new callback can be added to an existing Google OAuth client without removing its customer sign-in callbacks. For local development, register `http://localhost:3000/api/admin/store-locations/business-profile/callback` separately.
6. If the consent app is in **Testing**, add each connecting Google identity as a test user. Google may require OAuth verification before production use. Refresh tokens for external apps in Testing can expire after seven days; reconnect when required.

## Server configuration

Set these values in the deployment's server environment and restart or redeploy:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_BUSINESS_CLIENT_ID` | Google OAuth web client ID; falls back to `GOOGLE_CLIENT_ID`. |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | Client secret; falls back to `GOOGLE_CLIENT_SECRET`. |
| `GOOGLE_BUSINESS_REDIRECT_URI` | Exact registered callback. If omitted, derived from `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, or `NEXTAUTH_URL`. |
| `GOOGLE_BUSINESS_TOKEN_SECRET` | At least 32 random characters, used to encrypt stored tokens. Falls back to `API_KEY_ENCRYPTION_SECRET`. |

Keep the encryption secret stable and store it securely. Rotating it without migrating stored tokens requires reconnecting the Google accounts. These credentials and tokens must never use `NEXT_PUBLIC_` variables. The page reports missing variable names without displaying their values.

## Connect and fetch

Select **Connect Google Business Profile**, choose the Google identity with owner/manager access, and grant Business Profile permission. Repeat **Connect another Google account** for other identities. Connections belong to the signed-in platform administrator and are not shared with other staff logins.

The overview follows every account/location page and discovers nested organization/user groups. Locations returned through multiple accounts are shown once, with their access sources listed. Select an identity/group or search to filter the results. Google determines which resources are accessible; the Business Information API lists only directly owned locations for personal accounts and accessible locations for other account types.

Each listing displays its fetched name, address/service area, phone, website, categories, opening hours, description, Maps/review links and Google photos. Structured fields also include available labels, additional hours, service items and relationship data. Expand **All fetched profile fields** to inspect the structured location data. Photos include business and customer contributions. Reviews include ratings and available business replies. Initial requests fetch up to 100 media items per source and 50 reviews; **Load more** follows additional pages. Reviews require verified locations, and media availability depends on Google permissions and the listing.

Errors distinguish missing setup, disabled APIs, insufficient scope, revoked authorization, inaccessible resources and quota limits. A failure for one group or media resource does not hide successfully fetched locations. Where multiple connected accounts can access a location, the page tries another access source if Google denies the first.

## Connection security and removal

OAuth uses a ten-minute, single-use, session-owner-bound state, a browser HttpOnly state cookie, and PKCE. Tokens and PKCE verifiers are encrypted with AES-256-GCM and bound to their owner/record. Refresh tokens stay on the server. API handlers independently authenticate the administrator and enforce connection ownership; staff require store-location page access.

**Disconnect** removes this application's locally stored connection and tokens. To revoke the authorization at Google as well, remove the app under [Google account connections](https://myaccount.google.com/connections). Reconnecting restores access with a fresh grant.

Live access is not established until the project's APIs/OAuth configuration are complete and a user finishes Google's consent flow.

## API references

- [Accounts and business groups](https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list)
- [Business locations](https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list)
- [Reviews](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list)
- [Business media](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.media/list)
- [Customer media](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.media.customers/list)
