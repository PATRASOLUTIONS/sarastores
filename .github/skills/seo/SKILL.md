---
name: seo
description: Technical SEO rules and conventions for the ecommerce-sara storefront. Use when adding a page or route, changing metadata, canonicals, robots, sitemap or structured data, adding filters/facets/pagination to a listing, or auditing search visibility. Covers the client-component metadata trap, faceted-navigation crawl budget, and the schema.org shapes this site uses.
---

# SEO for ecommerce-sara

Verified against the code on 2026-09-05.

## The rule that breaks most often

**A `"use client"` page cannot export `metadata`.** Next.js silently falls back to the root
layout, so the page ships with the homepage's title, description and canonical. Several pages
competing for the same title is a real ranking problem and it is invisible in the browser.

Most storefront pages here are client components. When you add one:

```tsx
// app/<route>/layout.tsx
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/<route>",
  title: (brand) => `Page Title | ${brand}`,
  description: "150–160 characters, written for a human, containing the primary term.",
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

`pageMetadata` resolves the origin from request headers, reads the company name from the
`settings` collection, and sets canonical, Open Graph, Twitter and robots. Pass `noIndex: true`
for anything transactional, private or per-visitor.

For a dynamic route, write `generateMetadata` by hand and use `buildPageMetadata` from
[lib/seo-metadata.ts](../../lib/seo-metadata.ts) — see
[app/campaign/[slug]/layout.tsx](../../app/campaign/%5Bslug%5D/layout.tsx).

## What must be noindex

Transactional, personal, or infinitely variable: `/cart`, `/checkout`, `/order/*`, `/thank-you`,
`/track`, `/compare`, `/login`, `/register`, `/forgot-password`, `/reset-password`,
`/verify-email`, `/account/*`, `/dashboard/*`, `/admin/*`, `/vendor/*`, internal demos.

Guest order pages are reachable by capability token — they must never be indexed.

## Faceted navigation

Filters multiply URLs combinatorially. Two defences, both already in place:

1. **Canonical stays clean.** `/products/layout.tsx` canonicalises to `/products` with no
   params, so no filtered view competes with it.
2. **robots.txt blocks the params.** `FACET_PARAMS` in [app/robots.ts](../../app/robots.ts)
   disallows `q`, `sort`, `minPrice`, `maxPrice`, `size`, `star`, `capacity`, `feature`, `page`.

If a facet combination deserves to rank ("55 inch TVs under ₹50,000"), do **not** unblock the
param — build a real static route for it and put that in the sitemap. Parameter URLs are for
users; paths are for search engines.

## Structured data

| Schema | Where |
| --- | --- |
| Organization, WebSite (+ SearchAction), Store | [components/SiteJsonLd.tsx](../../components/SiteJsonLd.tsx), root layout |
| Product + BreadcrumbList | [app/product/[slug]/ProductJsonLdServer.tsx](../../app/product/%5Bslug%5D/ProductJsonLdServer.tsx) |
| ItemList + BreadcrumbList | `CategoryJsonLdServer.tsx`, `BrandJsonLdServer.tsx` |
| ElectronicsStore | `buildStoreJsonLd()` in [lib/store-locations.ts](../../lib/store-locations.ts) |
| Article | `buildArticleJsonLd()` in [lib/articles.ts](../../lib/articles.ts) |
| FAQPage | `buildFaqJsonLd()` in [lib/faq-data.ts](../../lib/faq-data.ts) |

**Product offers must carry `shippingDetails` and `hasMerchantReturnPolicy`.** Without them the
listing is still eligible but renders without shipping/returns annotations, which costs CTR
against competitors who declare them.

**Never duplicate copy into schema.** The FAQ schema reads the same `lib/faq-data.ts` the page
renders. Two sources of truth drift, and mismatched schema is a manual-action risk.

## Sitemap

[app/sitemap.ts](../../app/sitemap.ts) covers static pages, products (with image entries),
categories, sub-categories, brands, stores, campaigns and articles. `lastModified` comes from
real `updatedAt` — never fake it, Google learns to distrust it.

Only `https://` absolute URLs are valid in image sitemap entries; data URIs and relative paths
are dropped.

If the catalogue passes ~40,000 URLs, split into a sitemap index before the 50,000 limit.

## Images

`remotePatterns` in [next.config.mjs](../../next.config.mjs) is an allowlist. It previously
ended with `hostname: "**"`, which made the Next image optimizer an open proxy. Add real hosts;
never restore the wildcard.

Alt text should describe the product, not the file. `components/CategoryProductCard.tsx` is the
reference.

## Checklist for a new page

- [ ] Metadata via `pageMetadata` or `buildPageMetadata` (a layout if the page is client-side)
- [ ] Canonical points at the clean, param-free URL
- [ ] `noIndex` if transactional, private or per-visitor
- [ ] Exactly one `<h1>`, containing the primary term
- [ ] Breadcrumb trail plus `BreadcrumbList` schema if it sits below the top level
- [ ] Added to `app/sitemap.ts` if indexable
- [ ] Linked from the footer or a hub page — an orphan page does not get crawled
