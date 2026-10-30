import { calculateDistance, coordinates } from "@/lib/geo-client"
import { googleMapReference } from "@/lib/store-google-maps"
import type { StoredStoreLocation } from "@/lib/store-locations"
import { z } from "zod"

const searchResult = z.object({ places: z.array(z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), googleMapsUri: z.string().optional(),
  displayName: z.object({ text: z.string() }).optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
})).optional() })

/** Accept a search result only when it agrees with the saved Google listing. */
export async function findGoogleStorePlaceId(store: StoredStoreLocation, reference: ReturnType<typeof googleMapReference>, key: string, refresh = false) {
  if (store.googlePlaceId) return store.googlePlaceId
  if (reference.placeId) return reference.placeId
  const point = reference.coords || coordinates(store.latitude, store.longitude)
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.googleMapsUri,places.displayName,places.location" },
    body: JSON.stringify({ textQuery: `${reference.name || store.shopName}, ${store.locationDescription || ""}`, regionCode: "IN", languageCode: "en",
      ...(point ? { locationBias: { circle: { center: { latitude: point.lat, longitude: point.lng }, radius: 500 } } } : {}) }),
    signal: AbortSignal.timeout(6000), ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 3600 } }),
  })
  if (!response.ok) throw new Error("Google listing lookup failed")
  const data = searchResult.parse(await response.json())
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const expected = normalize(reference.name || store.shopName || "")
  const tokens = expected.split(" ").filter(token => token.length > 2 && !["store", "road", "mobile", "mobiles", "electronics", "electronic"].includes(token))
  for (const place of data.places || []) {
    if (reference.cid) {
      if (googleMapReference(place.googleMapsUri || "").cid === reference.cid) return place.id
      continue
    }
    const candidate = normalize(place.displayName?.text || "")
    const candidatePoint = place.location ? coordinates(place.location.latitude, place.location.longitude) : null
    if (point && candidatePoint && calculateDistance(point, candidatePoint) <= 0.25 &&
      ((reference.name && candidate === expected) || (tokens.length >= 2 && tokens.every(token => candidate.split(" ").includes(token))))) return place.id
  }
  return ""
}
