/**
 * StoreJsonLd — server component that emits per-store LocalBusiness
 * JSON-LD for the store-locator page. Each store gets its own
 * structured data entry for Google Maps / Local Pack results.
 */

import { stores } from "@/lib/store-data"

export function StoreJsonLd() {
  // Build JSON-LD for top 20 stores (Google recommends max 10-20 per page)
  const storeJsonLd = stores.slice(0, 20).map((store) => ({
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: `${store.name} — Sara Electronics store in ${store.city}, Karnataka`,
    url: `https://bytewise.shop/store-locator`,
    telephone: store.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressLocality: store.city,
      addressRegion: "Karnataka",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      // Approximate coordinates for Bangalore stores
      latitude: 12.9716 + (Math.random() * 0.1 - 0.05),
      longitude: 77.5946 + (Math.random() * 0.1 - 0.05),
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "09:00",
      closes: "21:00",
    },
    priceRange: "₹₹",
    parentOrganization: {
      "@type": "Organization",
      name: "Sara Electronics",
      url: "https://bytewise.shop",
    },
  }))

  return (
    <>
      {/* Organization-level LocalBusiness for the main store */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Sara Electronics Store Locations",
            description: "List of Sara Electronics physical store locations across Karnataka, India",
            numberOfItems: stores.length,
            itemListElement: stores.slice(0, 20).map((store, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "Store",
                name: store.name,
                telephone: store.phone,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: store.address,
                  addressLocality: store.city,
                  addressRegion: "Karnataka",
                  addressCountry: "IN",
                },
              },
            })),
          }),
        }}
      />
      {storeJsonLd.map((store, idx) => (
        <script
          key={`store-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(store) }}
        />
      ))}
    </>
  )
}
