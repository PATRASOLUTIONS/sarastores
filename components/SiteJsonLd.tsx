/**
 * SiteJsonLd — server component that emits Organization, WebSite
 * (sitelinks search box), and LocalBusiness JSON-LD once per page.
 *
 * Mounted in app/layout.tsx. Reads settings + origin from the same
 * helpers used by metadata so canonical, OG, and structured data all
 * agree on the brand entity.
 */

import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildLocalBusinessJsonLd,
  getStoreSettings,
} from "@/lib/jsonld-store"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

export async function SiteJsonLd() {
  const [origin, settings] = await Promise.all([
    getOriginFromHeaders(),
    getStoreSettings(),
  ])

  const org = buildOrganizationJsonLd({ settings, origin })
  const site = buildWebSiteJsonLd({ origin })
  const business = buildLocalBusinessJsonLd({ settings, origin })

  // The brand graph: Organization @id, WebSite publisher links back,
  // Store parentOrganization links back. This is the shape Google
  // expects for Knowledge Panel + sitelinks search box.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(site) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(business) }}
      />
    </>
  )
}
