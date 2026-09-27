# Admin & Frontend Documentation

This document explains the key frontend pages, admin flows, server APIs, data shapes, environment variables, and testing steps for the ecommerce project (software license flows, cart/checkout, admin order/license management).

## Table of contents

- Overview
- Pages
  - Software (Admin)
  - License Keys (Admin)
  - Orders (Admin order detail)
  - Cart (Customer)
  - Checkout (Customer)
  - Product / Software product page
- API Endpoints
  - Orders: GET /api/orders/:id
  - Orders: POST /api/orders/:id/assign-license
  - Orders: PUT /api/orders/:id
  - Software license keys: GET /api/software/license-keys
  - Software license keys: PATCH /api/software/license-keys
  - Notifications/email: POST /api/notifications/email
- Data models
  - Order
  - OrderItem
  - LicenseKey
  - SoftwareProduct (summary)
- Flows (step by step)
  - Manual license assignment (admin)
  - Auto-deliver when license present
  - Revoke license (admin)
  - Customer purchase -> license delivery
- Environment and secrets
- How to run & quick tests
- Troubleshooting & common errors
- Next steps & recommendations


## Overview

This repository contains a Next.js app (App Router) with an admin UI and client shopping flow. A key feature is management of software license keys which are stored in the `license_keys` MongoDB collection and can be assigned to orders by admins. The admin has pages that list software products and keys, and an order detail page where licenses can be assigned manually.

Files to look at (examples):
- `app/admin/software/page.tsx` — admin list of software items, polls for realtime key counts
- `app/admin/software/[id]/keys/page.tsx` — keys management (masking, reveal, copy, revoke)
- `app/admin/orders/[id]/page.tsx` — admin order detail page (manual license assignment, license info card, auto-deliver)
- `app/checkout/page.tsx`, `app/cart/page.tsx` — customer checkout/cart behavior
- `app/product/[id]/page.tsx` — product gallery, images, spec images
- `app/api/orders/[id]/assign-license/route.ts` — server API for assigning a license to an order
- `app/api/software/license-keys/route.ts` — keys listing, enrichment, and revoke
- `lib/software-service.ts`, `lib/db-service.ts` — central DB interactions


## Pages

### Admin - Software (overview)
Purpose: show software products and realtime key counts (available/assigned)
Key behaviors:
- Polls backend every 5s by default to refresh counts.
- Shows stat cards (Total Keys Available, Total Keys Assigned) aggregated across software items when backend enrichment is available.
Files: `app/admin/software/page.tsx`

Recommended checks:
- Confirm polling interval and consider a server-side aggregated endpoint for performance if many products exist.


### Admin - License Keys page
Purpose: view/manage license keys for a given software product.
Key behaviors:
- Keys are masked by default; UI supports reveal per-row (eye toggle) and Copy.
- Revoke flow opens a modal and requires a password (sent to backend) — the server compares against `REVOKE_PASSWORD` env var.
- Export CSV includes assignedTo, order details, expiresAt where available.
Files: `app/admin/software/[id]/keys/page.tsx`, `app/api/software/license-keys/route.ts`

Security note: ensure `REVOKE_PASSWORD` is set on the deployment environment and is strong. The front-end will send the password in the revoke PATCH body; this should be protected by HTTPS in production.


### Admin - Orders (order detail)
Purpose: view order metadata, items, timeline, manual license assignment, and license info.
Key behaviors:
- Loads order via `GET /api/orders/:id`.
- Manual License Assignment modal auto-populates from first software item in `order.items` and calls `POST /api/orders/:id/assign-license`.
- On successful assignment, UI is optimistic-updated with `licenseKey` and `licenseAssignedAt`. The page also attempts to refresh the order.
- If `order.licenseKey` is present, a License Information card is shown (copy button). The UI hides this card after the first user click — configurable.
- Manual License Assignment section is hidden when `order.status === 'delivered'`.
- There is a background effect that, if a license is present and `order.status !== 'delivered'`, issues a `PUT /api/orders/:id` to set status to `delivered` (guarded by a ref so it only runs once per session for that order id).
Files: `app/admin/orders/[id]/page.tsx`, `app/api/orders/[id]/assign-license/route.ts`

Caveats:
- The one-click-to-dismiss behavior currently listens to clicks on `document` and will hide the card even if the user clicks inside it (e.g., clicking the Copy button). If you want to avoid that, change the logic to dismiss only on clicks outside the card or use an explicit "Dismiss" button.


### Cart (customer)
Purpose: show items, fix subtotal/tax semantics.
Key behaviors:
- Subtotal is treated as tax-exclusive: subtotal = grossTotal / 1.18 (if gross includes GST). Tax = subtotal * 0.18.
- UI shows coupon, shipping, tax breakdown and total.
Files: `app/cart/page.tsx`.

Notes:
- Ensure consistent usage of subtotal/tax across checkout flow and API-level order records.


### Checkout (customer)
Purpose: collect shipping/payment, show correct tax breakdown and coupon application.
Key behaviors:
- Shows Subtotal (tax-exclusive), Tax (GST), Shipping, Coupon discount and Final Total.
- Splits GST between software/hardware when needed.
- In-store checkout shows a loader state when processing orders.
Files: `app/checkout/page.tsx`.


### Product / Software product page
Purpose: display product gallery, specs images and product details.
Key behaviors:
- Gallery merges `product.images` with `specification_images`, filters undesired images, auto-advances every 5s, provides prev/next, vertical thumbnail pagination (5 per page), and starts at the 7th spec image.
Files: `app/product/[id]/page.tsx`.


## API Endpoints (summary)

> Note: Confirm exact implementations if you have custom middleware or authentication.

### GET /api/orders/:id
- Purpose: fetch order details shown in admin order page.
- Response: Order object (see Data models).

### POST /api/orders/:id/assign-license
- Purpose: assign an available license key from `license_keys` collection to an order and email the customer activation (if configured).
- Request body example:
  { softwareId: string, validity: number, maxDevices: number, orderId?: string }
- Response: { data: { licenseKey: string, assignedAt: string, customerEmail?: string }, warning?: string }
- Behavior: server attempts to select an available license matching softwareId and constraints. It updates `license_keys` and `orders` with assignment info and attempts to send activation email to customer.

Implementation notes:
- The route uses shared DB helpers. It attempts robust order lookup: using ObjectId, string _id, `id` property, and `_id.$oid` shapes (imported JSON). If you store orders with different id shapes, confirm the lookup logic.
- If a license is not found, the route returns a 404 or an informative error.

### PUT /api/orders/:id
- Purpose: update order fields such as `status`, `trackingNumber`, `cancellation` etc.
- Request body: patch-like object, e.g. { status: 'delivered' }

### GET /api/software/license-keys
- Purpose: list keys by softwareId and optionally status.
- Query params: softwareId, status=available|assigned|revoked etc.
- Response: array of license key docs enriched with order/customer info and computed `expiresAt` where possible.

### PATCH /api/software/license-keys
- Purpose: revoke a license key (or apply other partial updates). Revoke requires the correct password in the request body to match server `REVOKE_PASSWORD`.
- Request body example: { keyId: '<id>', action: 'revoke', password: 'xxxx' }
- Response: success/failure and details.

### POST /api/notifications/email
- Purpose: used to send order/email notifications (order status, license assigned email). This route is implemented as part of the project — verify template IDs in `lib/emailTemplates`.


## Data models (important fields)

### Order (simplified)
- id: string
- userId: string
- items: OrderItem[]
- customer: { name, email, address?, phone? }
- total: number
- subtotal: number
- tax: number
- shipping: number
- status: 'pending'|'processing'|'shipped'|'delivered'|'cancelled'
- licenseKey?: string (assigned license key string or id, depending on implementation)
- licenseAssignedAt?: string (ISO date)
- timeline?: Array<{ date: string; status: string; description?: string }>
- coupon?: { code, name, discount }

### OrderItem
- productId: string
- name: string
- price: number
- quantity: number
- type?: 'product'|'software'
- licenseKey?: string (per item license if stored here)
- validityYears?: number
- maxDevices?: number

### LicenseKey
- _id: ObjectId
- key: string
- softwareId: string (reference to product)
- status: 'available'|'assigned'|'revoked' etc.
- assignedTo?: { orderId?: string, customerEmail?: string, customerName?: string }
- assignedAt?: ISO date
- expiresAt?: ISO date
- validityYears?: number
- maxDevices?: number
- usedDevices?: number

### SoftwareProduct (summary)
- _id: ObjectId
- name: string
- pricing, description, images
- totalKeysAvailable/totalKeysAssigned (computed)


## Flows

### Manual license assignment (admin)
1. Admin opens `app/admin/orders/[id]/page.tsx`.
2. Opens "Assign License" modal; modal auto-populates softwareId/validity/maxDevices from first software item.
3. Admin clicks "Assign License" -> frontend POSTs to `/api/orders/:id/assign-license` with softwareId, validity, maxDevices.
4. Server picks a license (from `license_keys`), marks it assigned (updates `assignedTo`, `assignedAt`, `status`), updates the `orders` document with `licenseKey` and `licenseAssignedAt`, and attempts to send an email to the customer.
5. The frontend performs optimistic update (sets `order.licenseKey`) and then refreshes the order.
6. The page shows the License Information card; the user can dismiss it by clicking once (current behavior) or by copying the key.

Important checks:
- Confirm there are available license documents in `license_keys` for the requested softwareId with right status.
- Confirm `REVOKE_PASSWORD` and email config exist if you want to revoke/send emails.


### Auto-deliver when license present
When the order being viewed has a `licenseKey` and `status !== 'delivered'`, the admin order page triggers a `PUT /api/orders/:id` to set `status: 'delivered'`. This is guarded by an in-memory ref so it runs once for the page session. If you'd prefer to avoid automatic emails or timeline entries on server when auto-delivering, add a `silent: true` flag to the PUT body and handle it server-side to suppress notifications.


### Revoke license (admin)
1. Admin opens software keys page.
2. Clicks Revoke on a key row → modal requests admin password.
3. Frontend sends PATCH `/api/software/license-keys` with the password.
4. Server validates `REVOKE_PASSWORD` and marks the key revoked.

Security: Prefer storing `REVOKE_PASSWORD` as a strong secret in the deployment environment and don't share in plaintext.


### Customer purchase -> license delivery (typical)
1. Customer completes checkout; server creates an `orders` document.
2. If the product is a software product and you have an automated flow to assign a license on purchase, either:
   - Call assignment internally after order creation (server-side); or
   - Keep manual assignment for admin and show customer 'processing' until key is assigned.
3. For fully automated flows, ensure endpoints correctly pick a license and email activation.


## Environment variables

- `REVOKE_PASSWORD` — required for admin revocation of keys (backend checks this). Must be set in deployment environment.
- Email provider credentials — check `app/api/notifications/email` and `lib/emailTemplates` for the exact env vars required (SMTP, SendGrid key, etc.).

## eXlr8 (KGen) Integration — Support & Best Practices

This project includes a server-side proxy for the eXlr8 (KGen) partner API and an admin UI to inspect products. The eXlr8 support docs provide helpful troubleshooting and expectations; follow these points when integrating:

- Base (UAT) URL: `https://stage-platform-exlr8.exlr8now.com/v1`
- Auth headers: include `x-client-id` and `x-client-secret` on every request. The integration in this repo reads `EXLR8_CLIENT_ID`, `EXLR8_CLIENT_SECRET`, and `EXLR8_DP_ID` from environment variables.
- Pagination: upstream uses cursor-based pagination and returns `paginationInfo` with `nextCursor` and `hasMore` — forward `cursor` and `limit` query params from the admin UI to the proxy.
- Rate limits: respect upstream rate limits. If you receive HTTP 429, check the `Retry-After` header and back off. Consider caching product lists (this repo uses a short 30s in-memory cache) and adding server-side caching (Redis) for production.
- Timeouts & performance: the proxy enforces a 10s upstream timeout; for long-running operations use background jobs and webhooks where supported.
- Troubleshooting checklist (from eXlr8 Support):
  1. If you get `UNAUTHORIZED` or 401/403: verify `clientId`/`clientSecret`, header names, base URL (UAT vs Production), and whether your IP must be whitelisted.
  2. For order processing failures: provide orderID, externalRef, product/variant IDs, timestamps, and sample request/response to support.
  3. For performance issues: include request frequency, average response times and any specific endpoint names.

Support request template (copy into your mail to eXlr8 support):

Subject: [API Issue] short description

Environment: UAT / Production

Client ID: <your-client-id> (do not include client secret)

Issue Type: Authentication / Orders / Products / Wallet / Other

Description: (what you expected vs actual)

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Sample Request (redact secrets):
```
curl -X GET "https://stage-platform-exlr8.exlr8now.com/v1/products/delivery-partners/<dpId>" \
  -H "x-client-id: <CLIENT_ID>" \
  -H "x-client-secret: <REDACTED>" \
  -H "Content-Type: application/json"
```

Error Response:
```
{ "error": "UNAUTHORIZED", "errCode": "AUTH_FAILED" }
```

Attach logs, timestamps and the upstream response body where possible. eXlr8 support aims to respond within 24 hours for technical issues; for production emergencies mark the message as URGENT and include impact assessment.


## How to run & quick tests (local)

1. Install dependencies (pnpm recommended if repo uses pnpm):

```powershell
pnpm install
pnpm dev
```

2. Open browser to `http://localhost:3000/admin/orders/<orderId>` to test an order page.
3. Test manual license assignment:
   - Ensure some license keys exist in `license_keys` for the product (use Mongo GUI or script).
   - Open the admin order page, click "Assign License", confirm UI changes, and watch server logs for assignment messages.
4. Test revoke flow:
   - Open `http://localhost:3000/admin/software/<softwareId>/keys`.
   - Click Revoke on a key and enter the `REVOKE_PASSWORD` you set.


## Troubleshooting & common errors

- 404 when calling `POST /api/orders/:id/assign-license`:
  - The route tries robust order lookups. Ensure the order exists in the same DB that the route is connected to. Confirm `lib/db-service.ts` uses the same connection code as other routes.
  - Check logs for which lookup filters were attempted.

- MongoServerError: unknown operator `$oid` or similar:
  - Avoid including `$oid` in Mongo queries. The code supports `_id.$oid` shapes by reading the field, not using `$oid` operator.

- Revoke fails with 500 or 401:
  - Ensure `REVOKE_PASSWORD` env var is set and matches the password you enter in the modal.

- License not assigned because no available keys:
  - Confirm `license_keys` documents exist with `status: 'available'` (or matching status used by your implementation). Add keys via `lib/software-service.ts` or a manual script.


## Next steps & recommended improvements

- Add server-side aggregation endpoint that returns per-software available/assigned counts in one request — reduces polling overhead and N+1 fetches.
- Make license info dismissal safer:
  - Dismiss on outside-click only (ignore clicks inside the card), or
  - Add an explicit "Got it" or "Hide" button.
- Add a `silent` flag to `PUT /api/orders/:id` so auto-delivered updates don't trigger email notifications or timeline entries.
- Add unit/integration tests for `assign-license` and `license-keys` APIs.
- Backfill `license_keys.assignedTo` for existing assigned keys to normalize data.


---

If you want, I can also:
- Add a short `docs/QUICK_ADMIN_TASKS.md` with step-by-step commands to create keys, backfill assignments, and run a local test flow.
- Change the License Information dismissal to only hide on outside-click or provide a "Dismiss" button.

Tell me which of these you'd like next and I will update the docs or code accordingly.