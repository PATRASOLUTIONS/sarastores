# Manual clone and catalogue quality runbook

## Approved scope

An administrator-operated clone of `e-commerce-bytewise` into a new `sara_clone` on the approved destination cluster. No scheduled job, paid workflow dependency, automatic retention/deletion, production restore, connection switch, or product correction is included. Existing Vercel cron entries remain unchanged.

Pages:

- `/admin/database-clone`: status, read-only preview, explicit approval, bounded copying, manual pause/resume, and verification.
- `/admin/catalogue-quality`: on-demand read-only audit of a verified clone, issue filters, reasons, suggested actions, and CSV export.

Both pages have server-side full-administrator gates and noindex metadata. Every API independently requires a full administrator. Staff page access is insufficient.

## Configuration before any real database operation

Configure these server-only Vercel environment variables. Do not replace the app's production `MONGODB_URI`, publish credentials, or put connections in browser code.

| Variable | Purpose |
| --- | --- |
| `DATABASE_CLONE_SOURCE_URI` | Dedicated source connection; only the built-in `read` role on `e-commerce-bytewise` |
| `DATABASE_CLONE_TARGET_URI` | Dedicated destination connection; only the built-in `readWrite` role on `sara_clone` |
| `DATABASE_CLONE_APPROVAL_SECRET` | Independently generated random signing secret, at least 32 characters |
| `DATABASE_CLONE_WRITES_ENABLED` | Defaults to disabled; set to `true` only after reviewing the read-only preview |

The approved hosts are fixed in the server policy: the production `ottplay` cluster and destination `attandance` cluster identified by the user. The application validates exact hosts/database names, SRV/TLS configuration, and authenticated database roles. Administrator, readWriteAnyDatabase, readAnyDatabase, custom, and broader role assignments are refused rather than trusted as read-only. Rotate the credentials disclosed in the conversation and create dedicated accounts before activation; account/permission changes require operator approval.

Missing configuration returns a setup state without opening MongoDB connections. Credentials are never accepted in HTTP bodies or returned to the browser. Neither connection falls back to the application's generic database service.

## Preview and approval

1. An administrator clicks **Preview clone**. This reads source collections/options/indexes/counts/dbStats and checks that the destination contains no collections. No collection, manifest, or product is written.
2. Review collection support, counts, source/destination, estimated data/index storage, and 30% estimated storage headroom. Confirm capacity and billing allowances in Atlas and Vercel. The estimate cannot establish the destination cluster's free capacity or guarantee a free operation.
3. If acceptable, enable the write flag through the deployment environment and obtain a fresh preview.
4. Accept the logical-copy limitations, confirm capacity/usage allowances, and type `CLONE e-commerce-bytewise TO sara_clone`.
5. Start requires a signed five-minute preview token bound to the authenticated administrator and the fixed cluster/database fingerprint. The server repeats the inventory preview and refuses changed metadata/counts or an occupied destination.

Only the approved start action creates destination data. Exclusive creation of `__sara_manual_clone` prevents concurrent starts from claiming the same empty target. This reserved control collection holds ownership, original collection/index definitions, approval actor, checkpoints, digests and verification state. It is not copied from production; a collision in the source blocks the operation.

## Copy and verification behavior

- Each browser-requested batch is sequential and bounded by document count, data size and read time. Vercel routes declare a 60-second maximum. A 120-second destination lease prevents concurrent or resumed requests from overlapping an invocation that was killed at the function limit.
- The browser must remain open to advance the job. Pause stops after the current request. Closing the page launches no further work; refresh status and resume manually later. A timed-out request can leave a lease until it expires.
- MongoDB BSON values, `_id`, original document fields, supported collection settings and ordinary indexes are preserved. Content is verified using a chained SHA-256 digest of the BSON documents actually read/copied, plus counts, collection settings and index definitions. Verification compares the target with that recorded logical-copy stream, not with a later changing source count.
- Batches use idempotent destination upserts and persisted cursors. Transient failures preserve the checkpoint for manual resume. Structural/content verification failures mark the clone failed and prevent auditing.
- Destination document validation is enforced. A source record that is incompatible with the copied validator stops the clone; the service never bypasses validation or requests broader privileges. Such legacy data needs a separately reviewed restore plan.
- There are no database/collection deletion methods in the implementation. An occupied unrelated destination is refused. An owned failed clone is not overwritten or automatically cleaned up; recovery requires a separately reviewed operator plan.
- TTL index expiry is deliberately disabled on copied indexes so the clone cannot expire its own copied records. The exact original definitions, including expiry, are retained in the control manifest. This deviation is disclosed in the preview and status.
- Views, time-series, capped, encrypted, clustered collections, text-index internal specifications, index transitions and unknown collection options are blocked. These require a separate supported dump/snapshot/restore procedure rather than silently omitting data.
- Atlas users, access controls, cluster configuration, provider snapshots, triggers and search indexes are not cloned. No website or cron connection is pointed at the clone; do not connect messaging/payment/fulfilment jobs to cloned customer data.
- Read-only access cannot update or delete production. Reads still consume production I/O, connections and bandwidth; zero performance impact cannot be guaranteed.
- This is a live logical copy, not a globally consistent point-in-time backup. Concurrent updates across collections can produce different observation times. Source additions/deletions that alter copied counts can stop verification. Recovery-grade transactional snapshots/PITR need a separate provider-supported plan.

## Catalogue report

The report opens only the destination connection and requires an owned verified manifest. It never connects to the source, writes corrections, persists a scan, checks arbitrary image URLs, or calls external providers. It reflects the clone at scan time, not later production updates.

Checks include missing/duplicate item numbers and slugs, weak/duplicate titles, missing hierarchy/brand, label variations, brand/SEO/feed conflicts, missing model/manufacturer identifiers, GTIN checksum errors, legacy identifiers excluded by the feed projection, descriptions, images, actual MRP versus selling price, invalid stock, warranty/tax review, basic specifications, and invalid shipping weight.

Results distinguish blocking issues, improvements, and human verification. Automated readiness does not prove manufacturer facts, photos, tax classification, warranty, category-specific completeness, Google approval, or delivery-policy correctness. No AI-generated facts or corrections are applied.

The API limits product/specification counts and report size; oversized/changing scans fail explicitly rather than returning a partial success. Repeated rule text is sent once to fit Vercel response budgets. The UI filters by search, division, brand, severity, rule and active/inactive visibility; CSV export includes current values, reasons and suggested actions with spreadsheet formula protection.

### Review workflow

The catalogue dashboard adds a review queue sorted by priority: active blocked products, inactive blocked products, active products needing improvement/review, inactive products needing improvement/review, and products passing automated checks. Priority is an operator triage order, not a sales prediction, certification or percentage quality score.

Full-scan summaries show product identity, classification, content, image, commercial and warranty/tax gaps. Area totals overlap because one product can have issues in several areas. Division summaries count unique products, highlight active blocking issues and link to the affected division; missing divisions have a separate review entry. Highest-priority rules show both total and active affected products.

The queue filters also support readiness and review area, and can sort by priority, matching issue count or product name. Severity, area and rule must match the same issue. Clearing filters restores the full queue. Exports contain every matching issue across all pages, not only the visible 25 products.

**Review worksheet** downloads a CSV with blank proposed-value, evidence/source, reviewer and approval-decision columns. Fill those offline with verified values and submit the completed document for approval. The dashboard neither uploads/imports this worksheet nor applies its entries; an approved database correction needs a separate change preview and implementation. Formula-like current values are neutralized in exported cells.

## Cost and approval limits

No extra paid service or scheduled execution is introduced. Manual clones still use Vercel function execution, network traffic and MongoDB destination storage/indexes. Current included allowances and cluster capacity must be checked before each real clone. This implementation does not guarantee zero additional charges or automatically purchase a larger tier.

Development verification uses synthetic fixtures and isolated build configuration. No real clone has been initiated, no production metadata has been corrected, and no credentials have been configured by this implementation. Real connection inspection, destination writes, deployment and configuration activation remain operator actions subject to the preview/approval process above.
