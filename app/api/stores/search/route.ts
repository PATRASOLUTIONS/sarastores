import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { withRateLimit } from "@/lib/rate-limit"
import { getCollection } from "@/lib/db-service"
import { ACTIVE_RETAIL_STORE_FILTER, type StoredStoreLocation } from "@/lib/store-locations"
import { storeCoordinates } from "@/lib/store-address"
import { coordinates } from "@/lib/geo-client"
import { handleApiError } from "@/lib/api-error"

const resultsSchema = z.object({ places: z.array(z.object({ displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(), location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
})).optional() })

export const GET = withRateLimit(async function GET(request: NextRequest) {
  try {
    const parsed = z.string().trim().min(3).max(200).safeParse(request.nextUrl.searchParams.get("query"))
    if (!parsed.success) return NextResponse.json({ error: "Enter a place, city or pincode" }, { status: 400 })
    const query = parsed.data
    const key = process.env.GOOGLE_PLACES_API_KEY
    if (key) {
      try {
        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location" },
          body: JSON.stringify({ textQuery: `${query}, India`, regionCode: "IN", languageCode: "en", pageSize: 5 }),
          signal: AbortSignal.timeout(8000), next: { revalidate: 3600 },
        })
        if (response.ok) {
          const data = resultsSchema.parse(await response.json())
          const places = (data.places || []).flatMap(place => {
            const point = place.location ? coordinates(place.location.latitude, place.location.longitude) : null
            return point ? [{ ...point, label: [place.displayName?.text, place.formattedAddress].filter(Boolean).join(", ") }] : []
          })
          if (places.length) return NextResponse.json({ success: true, places })
        }
      } catch { /* Search saved stores when Google is unavailable. */ }
    }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const docs = await (await getCollection<StoredStoreLocation>("store_locations")).find({ $and: [ACTIVE_RETAIL_STORE_FILTER,
      { $or: ["shopName", "locationDescription", "city", "pincode"].map(field => ({ [field]: { $regex: escaped, $options: "i" } })) }],
    }, { projection: { shopName: 1, locationDescription: 1, latitude: 1, longitude: 1, googleMapLocation: 1 } }).limit(20).toArray()
    const places = docs.flatMap(store => {
      const location = storeCoordinates(store)
      const point = coordinates(location.latitude, location.longitude)
      return point ? [{ ...point, label: `${store.shopName}, ${store.locationDescription}` }] : []
    }).slice(0, 5)
    if (!places.length) return NextResponse.json({ error: "No location found. Try a store name or city, or use your current location." }, { status: 404 })
    return NextResponse.json({ success: true, places })
  } catch (error) { return handleApiError(error, "Unable to search locations") }
}, { windowMs: 60000, maxRequests: 30 })
