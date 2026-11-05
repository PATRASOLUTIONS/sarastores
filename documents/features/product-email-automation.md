# Daily product price and stock email

In `/admin/products`, open **Daily Email**, enter recipient email addresses (one per line, up to 10), enable daily emails, and save. Each recipient receives a separate email. **Send today's email now** uses the saved recipients and can be used before the scheduled time or while automation is disabled.

The scheduled reminder runs daily at **11:30 AM India time (Asia/Kolkata)**. `vercel.json` calls `/api/cron/product-email-automation` at `0 6 * * *` (06:00 UTC). It requires deployment and a working provider scheduler. Exact minute scheduling depends on the hosting plan: Vercel Hobby may invoke daily jobs within the scheduled hour. For precise timing, use a supported Vercel plan or an external scheduler invoking the same endpoint at 06:00 UTC with `Authorization: Bearer <CRON_SECRET>`. Check the hosting plan's current cron limits before deployment; the existing maintenance and outreach schedules are preserved.

The email contains two attachments:

- `active-products-price-mrp.xlsx`: the same active-only product selection and `itemno`, `mrp`, `price` columns used by **Download active products Excel**. Missing or duplicate item numbers prevent sending, as they do with the manual export. Keep item numbers unchanged and upload edited prices through **Update Prices**.
- `store_stock_template.xlsx`: the same `CODE`, `WhsCode`, `Total` example rows as **Download Template Excel** in Stock Check. This is an upload template, not a current inventory export. Replace the examples with real stock data before uploading in `/admin/stock-check`.

No prices or stock are changed by the email automation. Recipients must log in with the appropriate admin permissions to upload changes.

## Configuration and delivery

The feature reuses `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_SECURE`, and `EMAIL_FROM`. Scheduled requests require `CRON_SECRET` (at least 16 characters). Configure these in the deployment environment; local settings belong only in `.env.local`. No new environment variable is introduced, and recipients are stored in MongoDB rather than environment files.

Settings are stored in `product_email_automation` under the `daily` key, recording the authenticated actor and update date. `product_email_deliveries` stores one unique date-plus-recipient key per India calendar day. MongoDB's existing unique `_id` index prevents overlapping cron runs or a manual send from duplicating the day's email. No extra index migration is required.

Each recipient is attempted once per day. Statuses are `sending`, `accepted`, `failed`, or `unknown`. Accepted means SMTP acceptance, not confirmed inbox delivery. Rejected emails are failed; interrupted or uncertain sends are unknown and never replayed automatically. An explicit manual send also consumes that day's attempt. The next day is independent. The admin dialog shows the latest 30 attempts.

The cron supports `?dryRun=1`, which reports recipients and scheduling eligibility without product reads, writes or SMTP calls. Both the cron secret guard and the admin session/page-permission guard run before service access. Settings changes and manual sends use `apiFetch` and no shared cache. The cron and manual routes report HTTP 207 if any completed attempt failed or has an uncertain outcome.

## Validation

Isolated tests cover India date boundaries, recipient validation, real XLSX attachment round trips, active-only selection, item numbers with leading zeros, MRP fallback, overlapping invocations, disabled and dry-run jobs, provider failures and endpoint authorization. No live recipients or production database are used. Run `node --test tests/product-email-automation.test.mjs` and `npx tsc --noEmit`; respect the owner's no-build/no-lint instruction.
