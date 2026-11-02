---
name: sara-seo-dashboard
description: Consolidate Sara SEO audit evidence and authorized Google exports into local reports with prioritized gaps and explicit missing-data status.
---

# Sara local SEO dashboard

Read `../../../documents/seo/CLAUDE-SEO-INTEGRATION.md`. This skill creates a local report,
not a deployed admin page. Consume `.seo-local/` audit JSON and owner-authorized,
sanitized GSC/GA4/Merchant/GBP/PSI exports; preserve source and collection timestamps.

Group findings by product, technical, local store, Merchant and measurement.
Show observed failures separately from access blockers and opportunities.
For every recommended action include impact, evidence URL/source, dependency,
proposed change, responsible role and a reproducible verification.
Do not invent a complete SEO score when coverage is partial. Do not average
GSC positions or CTR without their correct denominator, and do not join traffic
and revenue as if different timezones or URL conventions were equivalent.

Distinguish URL-level vs origin-level field CWV from device-specific lab runs.
Report missing credentials/CrUX data as unverified, never green or zero.
Use `python scripts/seo/audit.py --fixtures` for the local validator summary.
Keep raw data private in `.seo-local/`; create sanitized Markdown in `documents/seo/`.
Do not add database collections, dashboards, cron jobs, routes, tracking scripts
or Google writes. Tell the user about any database proposal and obtain separate
approval first. No deployment under this integration authorization.
