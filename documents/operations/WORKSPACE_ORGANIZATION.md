# Workspace organisation and public access

**Updated:** 13 October 2026. Scope: internal documents, loose root tools, file-path dependencies and unauthenticated local HTTP access. This is not a new exhaustive security audit or hosted-deployment certification.

## What is public?

Next.js serves declared application routes and files under `public\`. An arbitrary HTML, Markdown, script or image elsewhere in the project root does not automatically become a route. A filename ending in `.html` is not enough to make it public.

Before reorganisation, unauthenticated GET requests to the existing local application produced:

| Path | Result | Interpretation |
|---|---:|---|
| `/docs/marketing-poster-guide.html` | 404 | Internal guide was not served |
| `/docs/marketing-campaign-guide.html` | 404 | Internal guide was not served |
| `/proposal/sara-mobiles-proposal.html` | 404 | Proposal was not served |
| `/audit-ids.mjs` | 404 | Root inspection script was not served |
| `/admin/documentation` | 307 to `/login?redirect=/admin` | Server-gated admin page, not anonymous documentation |
| `/data/realistic-laptop-master-data.json` | 200 | Development seed fixture was publicly downloadable |

The development seed fixture was moved from `public\data\` to `lib\seed-data\`; the development-only, admin-guarded seed handler now reads that private path. Its validation, dry-run default and transaction behaviour were preserved. No seed operation was executed.

No HTML, Markdown, source maps, source TypeScript or environment/key artifacts were found in `public\` during the scoped inventory. `public\sw.js` is an intentional service-worker asset and remains there. Public storefront pages, API documentation, machine-readable feeds and crawler files were not removed or reclassified as private.

`documents\` and local diagnostic/artifact folders are explicitly excluded by `.vercelignore`. This is deployment hygiene, not a replacement for route authorization. `/admin/documentation` remains protected by the admin server layout.

### Initial reorganisation verification

- **58 unauthenticated internal-path checks passed:** all ended in 404, including the old public seed URL, the new private fixture path, old/new tool paths and every retained document/proposal HTML file. `/documents/` first normalises with a 308 redirect to `/documents`, which returns 404.
- **Admin documentation:** still 307 to `/login?redirect=/admin` without a session.
- **File preservation:** all 202 moves were hash-verified before reference edits; 175 files with no intended content edits remain byte-identical, including screenshots, PDFs and the seed fixture.
- **Document integrity:** 617 local references and 63 local image references checked; no new broken references. Historical documents still contain 56 pre-existing missing references in the validator's final scan; these are not new regressions or claims that the historical documentation is current.
- **Complete catalogue:** `documents\index.html` lists 175 supporting files in 22 groups. With the index itself, the directory contains 176 files.
- **Code validation:** web/mobile TypeScript and changed-source ESLint passed; three targeted privacy/upload-exclusion/seed-transaction regressions passed. Twenty-six moved/generated JavaScript tools passed syntax checks without being executed.
- **Server asset dependency:** the private JSON is included when tracing the compiled seed-handler source with Next's file tracer. This is not a new hosted deployment/build certification.
- **Offline UI:** the catalogue passed Chrome/axe checks at 360, 390, 768, 1024 and 1440 pixels with no automated accessibility violations, page overflow, uncaught JavaScript exceptions or external requests.

### Archive consolidation verification

The follow-up moved **40 additional files**, all verified byte-for-byte using SHA-256: 12 UI/branding archive files, 20 historical browser artifacts, seven scraper PDFs/backup files and one obsolete zero-byte marker. The former root artifact directories were removed only after they were empty; no retained file was deleted.

The current catalogue lists **187 supporting files in 24 groups**, or 188 document files including the index. All 193 local catalogue links resolve. Private browser logs, scraper probes and other `scripts\archive\` output are not included in the catalogue.

**80 unauthenticated checks of the old and new artifact URLs returned 404** on the local application. Web TypeScript, four targeted privacy/archive/seed-transaction regressions, changed-source ESLint, five JavaScript syntax checks and the PowerShell archive-helper parser check passed. Database-writing helpers were not executed. The updated catalogue passed the same five Chrome viewport checks with no automated accessibility violations, horizontal overflow, JavaScript exceptions or external requests; the temporary browser profile was cleaned up.

**Hosted limitation:** the local development server was checked, not the live Vercel domain, CDN caches or another static host. If previously published copies exist in an old deployment or CDN cache, moving a local file cannot erase them. Deploy the updated application and repeat the unauthenticated URL checks on the actual domain before release.

### Final historical-artifact consolidation and production check

After the owner clarified that only old/unused artifacts should move, **73 additional files** were preserved under `documents\archive\tools\` and `documents\private-artifacts\`. All hashes match. The 46 private logs/dumps/probe files are excluded from the catalogue, Git and deployment. The catalogue now lists **214 supporting files in 27 groups**, with all 220 local links resolving; the complete document tree contains 261 files including the private files and index.

The current source passes web/mobile types, 335 regression tests, full lint with zero errors and a strict production build generating 210 static pages. The built production artifact passed 25 bounded GET-only smoke checks and **146 old/new artifact URLs returning 404**, against an empty isolated database with writes/providers refused. All 422 runtime traces were inspected: no internal document/private artifact was included. The catalogue again passed five Chrome/axe viewport checks. Active source projects, tests, maintenance/runtime scripts and required configuration were retained.

The local production preflight passes, but the full dependency audit still reports seven high build-tool package entries (runtime audit: zero). These local checks do not certify the hosted release, database operations, real providers or business/legal readiness. See [the latest production-readiness check](../production-readiness-audit.md#13-october-2026--production-build-and-file-layout-check).

## New locations

| Previous location | New location |
|---|---|
| `docs\` | `documents\` |
| `reports\` | `documents\reports\` |
| `proposal\` | `documents\proposals\` |
| `App layout\` | `documents\design\app-layout\` |
| `how to platform should be\` | `documents\design\platform-reference\` |
| `home-page.png` | `documents\design\home-page.png` |
| `FEATURES.md`, `GAPS.md`, `PLATFORM_COMPARISON.md` | Same filenames under `documents\` |
| `CLAUDE.legacy.md` | `documents\legacy\CLAUDE.legacy.md` |
| `pdf-gen\Sara-Electronics-Wireframes.pdf` | `documents\design\wireframes\Sara-Electronics-Wireframes.pdf` |
| Other `pdf-gen\` files | `documents\archive\tools\pdf-gen\` |
| Root inspection/audit `.mjs` tools and `tmp-phase2-check.ts` | `documents\archive\tools\diagnostics\` |
| Root `extract-docx.mjs` | `documents\archive\tools\extract-docx.mjs` |
| `public\data\realistic-laptop-master-data.json` | `lib\seed-data\realistic-laptop-master-data.json` |
| `archive\` | `documents\archive\` |
| `.playwright-mcp\` | `documents\private-artifacts\archive\playwright-mcp\` |
| `.scrape-probe\` | `documents\private-artifacts\archive\scrape-probe\` |
| `.next_clean_marker` | `documents\private-artifacts\archive\local-artifacts\.next_clean_marker` |
| `scripts\audit\` | `documents\private-artifacts\audit\` |

The document guides and their screenshots were moved together. Local Markdown/HTML references were adjusted for their new parent directories. File hashes were checked before reference edits to verify that all 202 moved files survived unchanged. Historical broken references discovered before the move were recorded separately rather than silently represented as newly fixed.

## What stays at the root?

Application/framework entry points and required configuration: `package.json`, lockfile, `next.config.mjs`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `next-env.d.ts`, `middleware.ts`, `instrumentation.ts`, `vercel.json`, `components.json` and the existing build entry script.

`AGENTS.md` / `CLAUDE.md` stay at the root for automatic discovery; `README.md` now provides the directory map. `.env*` files stay local and excluded from deployment/version control. Generated `.next\`, dependencies and build caches are not documents.

The former root `archive\` is now inside `documents\archive\`. It retains old UI source and branding, is excluded from the TypeScript application build and Vercel uploads, and is listed in the offline catalogue. Branding backup helpers use this new location.

Historical browser output, scraper PDFs/adapter backup and the obsolete zero-byte build marker are preserved under `documents\private-artifacts\archive\`, rather than left at the root. This private tree is excluded from the catalogue, version control, Vercel uploads and the source-archive helper. PDF probe helpers use the relocated PDF directory. No database-writing, PDF-generation or credential-containing archive command was executed for this reorganisation.

The owner clarified that **only old/unused artifacts** should move. The separate mobile app, regression tests, active maintenance/audit tools, editor configuration and required build/runtime files remain in their conventional locations. In particular, `scripts\assign-missing-licenses.ts` is imported by an admin API; moving or excluding all of `scripts\` would break production. A development workspace need not contain only website runtime files to produce a clean deployment.

## Tools and sensitive outputs

Run scripts from the repository root unless their own instructions say otherwise:

```powershell
node documents\archive\tools\diagnostics\audit-ids.mjs
node documents\archive\tools\extract-docx.mjs
```

These examples describe invocation only. Inspection tools may read a database, require authenticated APIs or depend on local input; they were syntax-checked, not executed against customer data.

The historical order inspection tool now writes to `documents\private-artifacts\audit\order_debug_dump.json`, not the project root. **Existing order dumps/logs may contain customer PII.** Keep `documents\private-artifacts\` private; do not move it into `public\`, share it as documentation or commit it.

The historical PDF generators retain their existing machine-specific browser dependencies. Their relative source-file reads remain together; their PDF output destination was updated to `documents\design\wireframes\`. Moving them is not a claim that their old external tooling has been installed or run.

## Browse the organised files

Open [the offline document catalogue](../index.html), or [the root project map](../../README.md). The catalogue lists document files by folder, including guides, reports, proposals and design assets. It is a local file, not a new public application route.
