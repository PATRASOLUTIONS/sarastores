# IndexNow setup

IndexNow is implemented for Sara public sitemap URLs. It notifies supporting search engines such as Bing when URLs are new, changed or removed; Google does not use it. A successful response acknowledges a notification, not guaranteed indexing.

## Activate in production

1. The setup has generated `.env.indexnow.local` in the project root. Open it locally and copy `INDEXNOW_KEY` and `INDEXNOW_ENABLED=true` to **Vercel → Project → Settings → Environment Variables → Production**. The file is ignored by Git and is not loaded automatically by Next.js. Keep the same key across redeployments. Run `npm run setup:indexnow` if the file is missing; an existing file is preserved.
2. Set `NEXT_PUBLIC_SITE_URL=https://www.sarastores.com`. Keep the existing `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` consistent. `INDEXNOW_SITE_URL` is optional and must resolve to the same canonical public sitemap origin. Development, preview, localhost/IP and Vercel preview hostnames cannot submit.
3. Ensure the existing `CRON_SECRET` is configured in Production. It authenticates the existing daily maintenance cron; do not replace a working secret with the IndexNow verification key. If absent, generate a separate random secret of at least 32 characters and add it to Production. Vercel supplies it to scheduled requests as a bearer token.
4. Deploy the changes. Open `https://www.sarastores.com/indexnow-key.txt`; it must return HTTP 200 and exactly the generated IndexNow key as plain text, without a login, HTML or redirect. The key is intentionally public domain verification, not an account credential.
5. Sign in as a full administrator and open `/admin/indexnow`, also available in the admin sidebar. Use **Preview pending URLs**, then **Sync now**. The first sync submits the public sitemap. Repeat Sync now until **Remaining** is zero for large catalogues. A 202 response means verification is still pending; retry later. HTTP 200 means the notification was accepted.
6. Confirm the daily maintenance invocation in Vercel Cron/Logs. IndexNow runs first in the existing `/api/cron/daily/maintenance` group at **01:00 UTC / 06:30 IST**. No third cron entry or paid scheduler is added. The job scans for changes once a day; Sync now handles changes immediately when requested.

If generating a new cron secret, PowerShell can run this locally and you can copy its output into Vercel:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No live database writes, deployment, or IndexNow submissions were performed during implementation. Production activation creates the derived `indexnow_state` collection through normal application writes; there is no backfill, custom index, or product/customer mutation required.

## Behavior and limits

- `/indexnow-key.txt` serves the environment key through a public uncached route. It does not depend on database access.
- Full-administrator-only `/api/admin/indexnow` provides status and a same-origin POST for sync. `?dryRun=1` reads the manifest without writes, leases or outbound calls. A cron-secret-only `/api/cron/indexnow` also allows manually triggering the worker through an external scheduler if needed; it is not an additional Vercel schedule.
- Sitemap generation is reused rather than trusting caller-supplied URL lists. Private areas, cart, checkout, account/order URLs, QR referrals, queries, fragments and foreign domains cannot be submitted. Source failures abort before comparing deletions; an empty/partial failed catalogue is not treated as a deleted website.
- Public URL fingerprints use sitemap modification times and image references, the deployment commit revision, and the site settings modification time. Static/index pages also incorporate the published catalogue manifest. Store/city sitemap entries include their stored modification dates. New URLs, slug changes, unpublished/deleted URLs and timestamped edits are detected. Code deployments on Vercel notify pages when the commit revision changes. Content writes must keep their existing `updatedAt` timestamps accurate; this is not a crawl of every page's rendered HTML.
- Only successful HTTP 200 batches update confirmed fingerprints. Verification-pending 202, rate limits, provider failures and timeouts retain unconfirmed work for the next run. The public key file is checked before each nonempty sync. A MongoDB lease prevents overlapping jobs. `indexnow_state` stores public URL hashes/fingerprints, submission times, aggregate reports and the lease, not customer or visitor data.
- Batches contain at most 1,000 URLs. Manual sync runs up to five batches with a 45-second budget. Scheduled maintenance runs one batch with a 20-second budget so existing customer maintenance jobs retain execution time. Incomplete work resumes from confirmed fingerprints on the next sync.
- An origin/key change must be followed by a deployment and verification. Disabling `INDEXNOW_ENABLED` stops outbound submissions. Preserve the key file while notifications may still be verified.

## Validation

Run `npm run test:indexnow` for isolated fixtures covering domain/key guards, public verification, privacy exclusions, changed/deleted URLs, provider retries, batching/leases, route authorization and the existing cron integration. TypeScript is checked with `npx tsc --noEmit`. These checks never contact IndexNow or the configured database. Build and lint were not run at the owner's request.

The technical SEO workflow used is `.agents/skills/claude-seo-technical/SKILL.md`, adapted from AgriciDaniel/claude-seo under its existing repository integration contract. No upstream tool or provider was automatically enabled.
