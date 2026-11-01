# Sara Electronics: catalogue quality and database protection plan

Status: historical proposal. The user's later approved scope is manual cloning only, without a scheduler, paid workflow service, retention deletion, or automatic catalogue corrections. See [the manual clone runbook](manual-database-clone.md) for the implementation and current approval boundaries. No live database changes have been performed.
Prepared: 2026-11-01.

## 1. Objective and order of work

Protect the existing production database, establish a verified independent clone, provide manual and daily backups, and then deliver a catalogue quality dashboard for the 1,000+ products. The catalogue audit reports problems and suggestions; it does not correct product documents.

Implementation order:

1. Confirm exact source database, destination namespaces, worker hosting, permissions, and capacity.
2. Build and test the backup service and admin controls against synthetic databases.
3. Present the exact initial-clone plan for approval; execute only after approval.
4. Verify the clone and demonstrate a restore in isolation.
5. Obtain approval to activate manual backups, the daily schedule, and scoped retention cleanup.
6. Build the catalogue audit against the verified clone; enable production reads only after its limits and results are verified.
7. Present proposed catalogue corrections separately. No correction is applied without a subsequent approval.

## 2. Evidence from the repository

- The application resolves its database name from `MONGODB_DB`, th1. een `DB_NAME`, otherwise `e-commerce-bytewise`. The supplied cluster URIs do not identify the database to copy.
- The admin area has a server session gate. Sensitive backup APIs must additionally use a full-administrator guard; general staff page access is insufficient.
- `vercel.json` currently has two daily cron entries. There is no full-database backup service in the repository. Hosting plan and job-duration limits must be confirmed before adding another job.
- The product metadata spreadsheet updates item number matching, name, division, category, segment, and brand. Complete commerce enrichment requires additional fields and a separate correction workflow.
- Product SEO, sitemap generation, commerce attribute readers, and a Google Merchant feed already exist. Their presence does not establish that live products are complete or that external accounts are connected.

## 3. Proposed database boundaries

These names are proposals pending confirmation:

| Purpose | Location | Proposed name | Permitted operations |
| --- | --- | --- | --- |
| Production application | Existing production cluster | Confirm actual name; default is `e-commerce-bytewise` | Backup/audit account reads only |
| Independent working clone | Destination cluster | `sara_clone` | Initial creation after approval; never part of backup retention |
| Retained backup copies | Destination cluster | `sara_backup_<UTC timestamp>_<run id>` | Create, verify, then retain three successful copies |
| Backup control records | Destination cluster | `sara_backup_control` | Job state, manifests, locks, verification, operational audit trail |
| Restore verification | Destination or separate isolated test environment | `sara_restore_verify_<run id>` | Temporary creation and cleanup of this job's exact namespace only |
| Existing destination applications | Destination cluster | All existing databases | No reads, writes, or deletion needed |

Never replace the website's `MONGODB_URI` with the destination URI merely to perform a backup. Use dedicated server-only backup configuration and separate clients. No URI, password, document export, or dump is placed in source control, public files, browser payloads, or operational logs.

The credentials shared in the conversation must be rotated before activation. Use a dedicated source user with read-only access to the approved application database and a separate destination identity. Source credentials must have no insert, update, remove, drop, or administrative write privileges. Destination privileges should be restricted to approved Sara namespaces as far as the provider permits. A cleanup process must never possess source write credentials.

## 4. Backup execution and consistency

The admin page queues a job; a durable worker performs it. Do not perform a full backup inside a browser request, a request-triggered unawaited promise, or an in-process Next.js timer.

Recommended hosting is an always-on worker or managed scheduled container/job with durable execution, MongoDB Database Tools, secret storage, network access to both clusters, and sufficient temporary disk space. A Windows scheduled task is an alternative only when the machine is running at the scheduled time. Vercel-only execution requires an explicit duration/capacity assessment and an external durable execution service if the database cannot fit its limits.

Proposed job sequence:

1. Validate configuration, approved source name, source/destination host fingerprints, different cluster identity, allowed target prefix, and run ownership. Refuse ambiguous configuration; never fall back to the default application database for backup writes.
2. Acquire an atomic destination-side lock with expiry and renewal so concurrent manual/scheduled jobs cannot overlap. Record the triggering administrator or scheduler, timestamps, and run ID in the destination control database.
3. Check destination headroom and inspect source collection types, indexes, validators, and database size. Unsupported collection types or restoration options fail preflight rather than being silently skipped.
4. Export BSON using MongoDB Database Tools or the provider's supported snapshot/restore process; do not serialize the database through ordinary JSON. Preserve document IDs, BSON values, indexes, and supported collection options. Never request a drop or overwrite of a source collection.
5. Import only into the newly allocated, empty destination namespace. Never restore over an existing database. Record excluded objects and any restoration limitations explicitly.
6. Verify the imported copy using the exported artifact as the reference: per-collection counts, deterministic content checks/digests, BSON round trips, indexes, and supported collection options. Source counts taken at different times are not a sufficient comparison on a changing production database.
7. Mark a backup successful only after verification; expose failure details without credentials or customer data.
8. Run retention only after success. Release the lock and publish a sanitized completion report.

Consistency must be chosen before the first real clone. A simple live `mongodump --db` is a logical copy and is not guaranteed to be a single point-in-time view across collections during concurrent writes. For recovery-grade point-in-time consistency, prefer supported Atlas snapshots/PITR and a compatible isolated restore workflow if the cluster tier permits it. An oplog-based alternative needs a supported full replica-set backup procedure, appropriate read privileges, and a scoped restore design; it must not be assumed to work with an ordinary database-scoped dump.

If the source tier only supports a logical live copy, label the copy's consistency limitation clearly and obtain approval for that mode. Do not describe it as a verified point-in-time financial backup. Do not pause production writes, alter replication, or change cluster configuration without separate authorization.

Read-only backups still consume CPU, disk I/O, connections, and network bandwidth. Protect website performance through a small connection pool, one active job, bounded batches, suitable read preference where supported, and monitored abort thresholds. Zero performance impact cannot be promised.

## 5. Manual backups, daily schedule, and retention

- Manual action: `Create backup` on `/admin/database-backups`, available only to full administrators. The response returns a job ID; progress is polled. Repeated clicks and duplicate requests must not start duplicate jobs.
- Daily time: 04:00 AM Asia/Kolkata. Its UTC equivalent is 22:30 on the previous calendar day; a UTC scheduler uses `30 22 * * *`. An IANA-timezone scheduler should use Asia/Kolkata directly.
- Record scheduled time, actual start, completion, last success, and next intended execution. Do not promise exact-to-the-second starts where the hosting scheduler does not guarantee them.
- Retain the newest three **successfully verified** backup copies across both manual and scheduled runs. The independent clone and control database do not count toward these three.
- Keep the prior three until a new copy passes verification. Failures do not trigger deletion of a healthy backup.
- Only delete an exact database recorded as owned by this backup service, on the validated destination cluster, with an approved prefix and matching run manifest. Do not clean up arbitrary databases by substring, age, or prefix alone.
- Refuse cleanup if ownership, destination identity, successful-copy count, or verification status is uncertain. Protect the source database, working clone, control database, and all pre-existing destination databases explicitly.
- Temporary incomplete copies are shown as failures; cleanup is limited to the exact owned namespace and follows a documented recovery policy. A partial copy never counts as a healthy backup.
- Capacity planning must include the clone, three backups, a fourth in-progress backup, indexes, temporary verification restore space, and headroom for existing destination applications. Destination copies consume ordinary database storage; dump compression does not shrink restored database/index storage.
- If a daily run is missed or fails, show a prominent stale-backup warning. Notification delivery can be configured after the recipient/channel is explicitly approved.

The three-copy rule is a rolling window, not long-term history or immutable ransomware protection. Native provider snapshots/PITR are a complementary protection where available. Restore testing is required before declaring the system recovery-ready.

## 6. Backup admin page

Show:

- Environment labels, approved database names, and masked cluster identifiers.
- Overall health, most recent verified backup, next scheduled run, and configured IST schedule.
- Manual backup button, progress, current phase, and safe failure/retry information.
- History: trigger, administrator, start/end, duration, collection/document totals, size, consistency mode, verification status, and retention state.
- Retained-copy list and a record of each retention deletion with exact destination namespace.
- Configuration/permission/capacity warnings and missed-run warnings.

Do not expose raw customer records, credentials, browser downloads of the entire database, or a one-click production restore. Restoration is a separate, reviewed runbook with exact source/destination identification and explicit approval.

## 7. Catalogue quality dashboard

Proposed page: `/admin/catalogue-quality`.

Audit products and related specifications/taxonomy from the verified clone first. Show the audited environment and scan time prominently. A later production scan uses a dedicated read-only client, projections, pagination, small batches, and concurrency limits. Reports can be exported as an authorized download; storing scan history, if approved, goes to the destination control database, not production.

Each issue row contains SKU, product name/link, field, current value, rule, reason, severity, evidence/source, suggested action, and confidence. Suggestions are not database updates.

| Rule group | Examples of reported problems |
| --- | --- |
| Identity | Missing/duplicate item numbers, model numbers, duplicate/conflicting URLs, GTIN format/checksum failures, internal SKU incorrectly presented as manufacturer MPN |
| Taxonomy | Missing division/category/segment, conflicting raw-versus-normalized values, inconsistent labels, brand/category confusion |
| Titles and content | Empty/generic titles, repeated titles across distinct products, poor descriptions, missing key features, unresolved variant identity |
| Specifications | Missing category-specific attributes, incompatible units, contradictory capacity/model/colour values, missing box contents |
| Images | Missing/placeholder images, malformed URLs, duplicate image sets needing review, image/variant mismatch requiring human inspection |
| Commerce | Invalid or nonpositive price, inconsistent MRP, negative/non-numeric stock, missing warranty, unverified GST/HSN |
| Fulfilment | Missing weight/dimensions where required, unsupported delivery/installation promises, incomplete delivery eligibility |
| Search/feed consistency | Missing stable URLs/metadata, differences between product page and feed, missing identifiers, feed exclusions, incorrect availability |

Tax/HSN correctness, manufacturer facts, image identity, and warranty accuracy cannot be established by field presence alone. Automated checks distinguish `missing`, `invalid`, `conflicting`, and `needs human verification`; no score claims that unverified facts are correct.

Summary views:

- Ready, needs improvement, and blocked totals; active and inactive products separately.
- Issues by severity, division, category, brand, and rule.
- Search and filters for actionable batches.
- Separate product, feed, and fulfilment readiness indicators.
- CSV/XLSX correction report with explicit reasons and proposed next actions.

The dashboard has no automatic fix button in its initial release. All product audit endpoints are read-only. Link to the existing product editor only as a separately operated workflow.

## 8. Approval boundaries

| Action | Approval required |
| --- | --- |
| Write this plan and develop/test code with synthetic fixtures | Covered by the requested planning/development scope |
| Inspect real cluster metadata and collection counts | Confirm exact scope first; read-only |
| Create the initial clone and destination control records | Explicit approval of exact namespaces and consistency mode |
| Activate the daily/manual service and retention deletion | Explicit approval once of the configured schedule, three-copy policy, and deletion boundary; no repeated daily approval |
| Change production credentials, permissions, cluster settings, or app connection | Separate approval/operator action |
| Apply any product corrections | Separate preview and explicit approval; never inferred from running an audit |
| Restore or overwrite production | Separate restore plan and explicit approval; excluded from initial implementation |

## 9. Verification and release gates

Use synthetic isolated fixtures, never customer data for routine tests.

- Source account cannot mutate/drop; an attempted source write is rejected by MongoDB permissions.
- Same-cluster, same-database, missing configuration, target-prefix spoofing, and unowned-target cleanup attempts fail closed.
- BSON values and indexes/options survive the copy, including ObjectId, dates, decimal/binary values, and supported collection types.
- Manual/scheduled concurrency, lock renewal, interrupted jobs, capacity failures, expired locks, retries, and partial copies are tested.
- Three successes plus one failed backup retains all three successes. A fourth success removes only the oldest verified owned backup. Clone and unrelated destination databases survive every scenario.
- Unauthorized users cannot start jobs, access reports, or view backup history.
- Schedule conversion and duplicate scheduled-run protection are tested.
- A selected backup restores into an isolated test database and passes verification.
- Catalogue rules use representative products, legacy taxonomy, variants, invalid identifiers, and feed mismatches. Auditing performs no product writes.
- Run TypeScript, ESLint, meaningful regression tests, and a production build with isolated database configuration. Deploy/schedule activation happens only after approval.

## 10. Ecommerce improvement roadmap after protection

1. Audit the complete catalogue and establish a measured baseline.
2. Agree category-specific required fields and authoritative manufacturer sources.
3. Prepare a correction preview for the top 100 in-stock, high-demand/high-margin products.
4. Apply only approved batches and re-audit them.
5. Validate Google Merchant diagnostics, structured data, mobile checkout, shipping eligibility, warranty/returns information, and consent-aware measurement.
6. Connect verified products to Search Console, Merchant Center, local store profiles, and social catalogues with separately authorized account setup.
7. Expand by division and measure readiness, indexing, approved feed products, conversion, margin, and information-related returns/cancellations.

## 11. Decisions needed before real execution

1. Exact production database name and whether the scope is one application database or multiple databases. Do not copy Atlas/system databases by default.
2. Approved destination names and confirmation that existing destination applications must remain untouched.
3. Source/destination cluster tiers, backup/restore support, available capacity, network access, and dedicated credentials.
4. Durable worker hosting. The available Vercel plan and execution limits are currently unverified.
5. Approval of consistency mode, initial clone, operational destination writes, and later daily retention activation.

No real cloning, backup scheduling, retention deletion, or catalogue correction begins until its approval boundary is satisfied.
