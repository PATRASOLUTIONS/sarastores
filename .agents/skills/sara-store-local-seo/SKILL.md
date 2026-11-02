---
name: sara-store-local-seo
description: Audit Sara city and store pages, local business markup and authorized Business Profile consistency using verified store facts.
---

# Sara local store SEO

Read `../../../documents/seo/CLAUDE-SEO-INTEGRATION.md`,
`../../../documents/seo/GOOGLE-API-SETUP.md` and the original
`../../../.seo-tools/skills/seo-local/SKILL.md`.

Trace `lib/store-locations.ts`, `/stores/[city]/[slug]`, store sitemap entries and
ElectronicsStore markup. Compare public name/address/phone, coordinates, store URL,
opening hours, holiday hours, visible directions and actual location identity.
Validate unique city/store metadata, canonical URL, breadcrumbs and useful local
content. Do not manufacture locations, cities, opening hours or coordinates.

Business Profile access needs project approval, applicable APIs enabled, quota,
OAuth business.manage scope and an authorized account with access to each location.
This broad scope does not authorize writes; begin with accounts/locations reads.
Public Maps data is not proof of Business Profile API access. Avoid deprecated
Q&A API workflows and verify current method/version availability before use.

Match locations by verified identity/place ID; list uncertain matches for review.
Report mismatches and proposed edits without updating listings, answering reviews,
publishing posts, verifying locations or changing the website/database. Tell the
user about any proposed database change and obtain separate approval first.
Do not add self-serving aggregate ratings to store/organization markup to chase
review stars. Paid geo-grid intelligence stays optional and requires authorization.
