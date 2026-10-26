import { getAllStoreLocations, buildStoreJsonLd } from "@/lib/store-locations"
import { getOriginFromHeaders } from "@/lib/seo-metadata"
import { safeJsonLd } from "@/lib/jsonld-safe"

/** Structured map data follows the same admin-controlled retail-store list. */
export async function StoreJsonLd() {
  const [stores, origin] = await Promise.all([getAllStoreLocations(), getOriginFromHeaders()])
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Sara Electronics Store Locations",
    numberOfItems: stores.length,
    itemListElement: stores.map((store, index) => ({
      "@type": "ListItem", position: index + 1, item: buildStoreJsonLd(store, origin),
    })),
  }) }} />
}
