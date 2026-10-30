import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { ACTIVE_RETAIL_STORE_FILTER, type StoredStoreLocation } from "@/lib/store-locations"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"
import { StoreBusinessSchema, type StoreBusiness } from "@/lib/store-business-types"

const placeSchema = z.object({
  displayName: z.object({ text: z.string() }).optional(), formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(), googleMapsUri: z.string().optional(),
  googleMapsLinks: z.object({ reviewsUri: z.string().optional(), writeAReviewUri: z.string().optional() }).optional(),
  rating: z.number().min(0).max(5).optional(), userRatingCount: z.number().int().nonnegative().optional(),
  regularOpeningHours: z.object({ weekdayDescriptions: z.array(z.string()).optional() }).optional(),
  reviews: z.array(z.object({
    authorAttribution: z.object({ displayName: z.string(), uri: z.string().optional() }),
    rating: z.number().min(0).max(5), text: z.object({ text: z.string() }).optional(),
    relativePublishTimeDescription: z.string().optional(),
  })).optional(),
})

// Public branch details; the Place ID is loaded from our catalogue, never supplied by the visitor.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return withRateLimit(async function businessDetails() {
    try {
      if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid store" }, { status: 400 })
      const store = await (await getCollection<StoredStoreLocation>("store_locations")).findOne({
        ...ACTIVE_RETAIL_STORE_FILTER, _id: new ObjectId(id),
      }, { projection: { shopName: 1, locationDescription: 1, mobileNo: 1, shopTiming: 1, googleMapLocation: 1, googlePlaceId: 1 } })
      if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 })
      let placeId = store.googlePlaceId || ""
      if (!placeId && store.googleMapLocation) {
        try {
          const url = new URL(store.googleMapLocation)
          if (url.hostname === "google.com" || url.hostname.endsWith(".google.com")) {
            placeId = url.searchParams.get("query_place_id") || url.searchParams.get("place_id") || ""
          }
        } catch { /* A saved share link may not include a Place ID. */ }
      }
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(placeId)) placeId = ""
      const query = encodeURIComponent(`${store.shopName || "Sara Electronics"}, ${store.locationDescription || ""}`)
      const mapsUrl = placeId ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}` : `https://www.google.com/maps/search/?api=1&query=${query}`
      const business: StoreBusiness = {
        status: "not_configured", name: store.shopName || "", address: store.locationDescription || "",
        phone: String(store.mobileNo || ""), hours: store.shopTiming ? [store.shopTiming] : [],
        mapsUrl, reviewsUrl: mapsUrl,
        writeReviewUrl: placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : null,
        rating: null, reviewCount: null, reviews: [],
      }
      const key = process.env.GOOGLE_PLACES_API_KEY
      if (key && placeId) {
        try {
          const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
            headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "displayName,formattedAddress,nationalPhoneNumber,googleMapsUri,googleMapsLinks,rating,userRatingCount,regularOpeningHours.weekdayDescriptions,reviews" },
            signal: AbortSignal.timeout(8000), next: { revalidate: 600 },
          })
          if (!response.ok) throw new Error("Google details unavailable")
          const place = placeSchema.parse(await response.json())
          business.status = "connected"
          business.name = place.displayName?.text || business.name
          business.address = place.formattedAddress || business.address
          business.phone = place.nationalPhoneNumber || business.phone
          business.hours = place.regularOpeningHours?.weekdayDescriptions || business.hours
          business.mapsUrl = place.googleMapsUri || business.mapsUrl
          business.reviewsUrl = place.googleMapsLinks?.reviewsUri || business.mapsUrl
          business.writeReviewUrl = place.googleMapsLinks?.writeAReviewUri || business.writeReviewUrl
          business.rating = place.rating ?? null
          business.reviewCount = place.userRatingCount ?? null
          business.reviews = (place.reviews || []).map(review => ({
            author: review.authorAttribution.displayName, authorUrl: review.authorAttribution.uri || null,
            rating: review.rating, text: review.text?.text || "", date: review.relativePublishTimeDescription || "",
          }))
          const checked = StoreBusinessSchema.safeParse(business)
          if (!checked.success) throw new Error("Invalid Google details")
        } catch {
          business.status = "unavailable"
          business.mapsUrl = mapsUrl
          business.reviewsUrl = mapsUrl
          business.writeReviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`
          business.reviews = []
          business.rating = null
          business.reviewCount = null
        }
      }
      return NextResponse.json({ success: true, business }, { headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return handleApiError(error, "Unable to load store details") }
  }, { windowMs: 60000, maxRequests: 30 })(request)
}
