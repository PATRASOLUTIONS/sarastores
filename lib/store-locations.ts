import { getCollection } from "@/lib/db-service"

/**
 * Server-side access to `store_locations` for the local-SEO store pages.
 *
 * The BRD asks for indexable `/stores/<city>` and `/stores/<city>/<store>`
 * pages ("LOCAL SEO + E-COMMERCE") rather than only the interactive map at
 * /store-locator. Slugs are derived from the stored names because the
 * collection has no slug column.
 */

export interface StoreLocation {
  id: string
  name: string
  slug: string
  address: string
  city: string
  citySlug: string
  state: string
  pincode: string
  phone: string
  email: string
  hours: string
  image: string
  mapUrl: string
  latitude?: number
  longitude?: number
}

export function slugify(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** Last comma-separated segment usually holds "City - PIN". */
function deriveCity(address: string): string {
  const match = String(address || "").match(/([A-Za-z\s]+)\s*-\s*\d{6}/)
  if (match) return match[1].trim()
  const parts = String(address || "").split(",")
  return parts.length > 1 ? parts[parts.length - 2].trim() : ""
}

function derivePincode(address: string): string {
  const match = String(address || "").match(/\b(\d{6})\b/)
  return match ? match[1] : ""
}

function toStoreLocation(doc: any): StoreLocation | null {
  const name = String(doc?.shopName || "").trim()
  if (!name) return null

  const address = String(doc?.locationDescription || "").trim()
  const city = String(doc?.city || deriveCity(address) || "").trim()

  return {
    id: doc._id?.toString?.() || String(doc.id || ""),
    name,
    slug: slugify(name),
    address,
    city,
    citySlug: slugify(city),
    state: String(doc?.state || "").trim(),
    pincode: String(doc?.pincode || derivePincode(address)),
    phone: String(doc?.mobileNo || "").trim(),
    email: String(doc?.emailId || "").trim(),
    hours: String(doc?.shopTiming || "9:00 AM - 9:00 PM").trim(),
    image: String(doc?.shopImage || "").trim(),
    mapUrl: String(doc?.googleMapLocation || "").trim(),
    ...(typeof doc?.latitude === "number" ? { latitude: doc.latitude } : {}),
    ...(typeof doc?.longitude === "number" ? { longitude: doc.longitude } : {}),
  }
}

export async function getAllStoreLocations(): Promise<StoreLocation[]> {
  try {
    const collection = await getCollection("store_locations")
    const docs = await collection.find({ isActive: true }).sort({ shopName: 1 }).toArray()
    return docs
      .map(toStoreLocation)
      .filter((store): store is StoreLocation => store !== null && store.citySlug.length > 0)
  } catch {
    // Store pages must not 500 the whole route when Mongo is unreachable.
    return []
  }
}

export interface StoreCity {
  city: string
  citySlug: string
  storeCount: number
}

export async function getStoreCities(): Promise<StoreCity[]> {
  const stores = await getAllStoreLocations()
  const byCity = new Map<string, StoreCity>()

  for (const store of stores) {
    const existing = byCity.get(store.citySlug)
    if (existing) existing.storeCount += 1
    else byCity.set(store.citySlug, { city: store.city, citySlug: store.citySlug, storeCount: 1 })
  }

  return Array.from(byCity.values()).sort((a, b) => a.city.localeCompare(b.city))
}

export async function getStoresByCity(citySlug: string): Promise<StoreLocation[]> {
  const stores = await getAllStoreLocations()
  return stores.filter((store) => store.citySlug === citySlug)
}

export async function getStore(citySlug: string, storeSlug: string): Promise<StoreLocation | null> {
  const stores = await getStoresByCity(citySlug)
  return stores.find((store) => store.slug === storeSlug) ?? null
}

/** schema.org LocalBusiness / ElectronicsStore node for a single store. */
export function buildStoreJsonLd(store: StoreLocation, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ElectronicsStore",
    "@id": `${origin}/stores/${store.citySlug}/${store.slug}`,
    name: `Sara Electronics — ${store.name}`,
    url: `${origin}/stores/${store.citySlug}/${store.slug}`,
    ...(store.image ? { image: store.image } : {}),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressLocality: store.city,
      ...(store.state ? { addressRegion: store.state } : {}),
      ...(store.pincode ? { postalCode: store.pincode } : {}),
      addressCountry: "IN",
    },
    ...(typeof store.latitude === "number" && typeof store.longitude === "number"
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: store.latitude,
            longitude: store.longitude,
          },
        }
      : {}),
    ...(store.mapUrl ? { hasMap: store.mapUrl } : {}),
    openingHours: store.hours,
    priceRange: "₹₹",
  }
}
