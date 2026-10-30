import { z } from "zod"
import type { StoredStoreLocation } from "@/lib/store-locations"
import { StoreBusinessSchema, type StoreBusiness } from "@/lib/store-business-types"
import { googleMapReference, googleStoreEmbed, resolveGoogleStoreLink } from "@/lib/store-google-maps"
import { findGoogleStorePlaceId } from "@/lib/google-store-place"

const placeSchema = z.object({
  displayName: z.object({ text: z.string() }).optional(), formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(), googleMapsUri: z.string().optional(),
  googleMapsLinks: z.object({ reviewsUri: z.string().optional(), writeAReviewUri: z.string().optional() }).optional(),
  rating: z.number().min(0).max(5).optional(), userRatingCount: z.number().int().nonnegative().optional(),
  regularOpeningHours: z.object({ weekdayDescriptions: z.array(z.string()).optional() }).optional(),
  photos: z.array(z.object({ name: z.string(), authorAttributions: z.array(z.object({ displayName: z.string(), uri: z.string().optional() })).optional() })).optional(),
  reviews: z.array(z.object({
    authorAttribution: z.object({ displayName: z.string(), uri: z.string().optional() }),
    rating: z.number().min(0).max(5), text: z.object({ text: z.string() }).optional(),
    relativePublishTimeDescription: z.string().optional(),
  })).optional(),
})

export async function getGoogleStoreBusiness(store: StoredStoreLocation, refresh = false): Promise<StoreBusiness> {
  let reference = googleMapReference(store.googleMapLocation || "")
  try { reference = await resolveGoogleStoreLink(store.googleMapLocation || "", refresh) } catch { /* Saved store details remain available. */ }
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
  let placeId = store.googlePlaceId || reference.placeId
  let lookupFailed = false
  if (key && !placeId) {
    try { placeId = await findGoogleStorePlaceId(store, reference, key, refresh) } catch { lookupFailed = true }
  }
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(placeId)) placeId = ""
  const query = encodeURIComponent(`${store.shopName || "Sara Electronics"}, ${store.locationDescription || ""}`)
  const mapsUrl = placeId ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}` : reference.cid ? `https://www.google.com/maps?cid=${reference.cid}` : `https://www.google.com/maps/search/?api=1&query=${query}`
  const business: StoreBusiness = {
    status: "not_configured", name: store.shopName || "", address: store.locationDescription || "",
    placeId,
    statusMessage: !key ? "GOOGLE_PLACES_API_KEY is missing from the running server environment. Add the key and redeploy or restart the server." :
      lookupFailed ? "Google listing lookup failed. Check that Places API (New), billing and the key restrictions are configured correctly." :
      !placeId ? "The saved Google Maps link could not identify a matching listing. Add this branch's Google Place ID in Edit store." : "Google details have not loaded yet.",
    phone: String(store.mobileNo || ""), hours: store.shopTiming ? [store.shopTiming] : [],
    mapsUrl, reviewsUrl: mapsUrl,
    writeReviewUrl: placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : null,
    rating: null, reviewCount: null, reviews: [],
    embedUrl: googleStoreEmbed(reference.url?.toString() || store.googleMapLocation || "", store.shopName || "", store.locationDescription || "", placeId),
    photoUrl: null, photoCredits: [], photoMessage: "No Google photo has been fetched.",
  }
  if (key && placeId) {
    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "displayName,formattedAddress,nationalPhoneNumber,googleMapsUri,googleMapsLinks,rating,userRatingCount,regularOpeningHours.weekdayDescriptions,reviews,photos" },
        signal: AbortSignal.timeout(8000), ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
      })
      if (!response.ok) throw new Error(`Google Places returned HTTP ${response.status}. Check Places API (New), billing, API key restrictions and the saved Place ID.`)
      const place = placeSchema.parse(await response.json())
      business.status = "connected"
      business.statusMessage = "Google details loaded successfully. Photos and a limited selection of reviews appear when Google provides them."
      business.googleFields = { name: place.displayName?.text, address: place.formattedAddress,
        phone: place.nationalPhoneNumber, hours: place.regularOpeningHours?.weekdayDescriptions }
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
      const photo = place.photos?.[0]
      business.photoMessage = photo ? "Google photo could not be loaded. Try refreshing the data." : "Google did not provide a photo for this listing."
      if (photo?.name.startsWith(`places/${placeId}/photos/`)) {
        try {
          const media = await fetch(`https://places.googleapis.com/v1/${photo.name.split("/").map(encodeURIComponent).join("/")}/media?maxWidthPx=800&skipHttpRedirect=true`, {
            headers: { "X-Goog-Api-Key": key }, signal: AbortSignal.timeout(5000), ...(refresh ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
          })
          if (media.ok) {
            const data = z.object({ photoUri: z.string() }).parse(await media.json())
            const withPhoto = StoreBusinessSchema.safeParse({ ...business, photoUrl: data.photoUri,
              photoCredits: (photo.authorAttributions || []).map(author => ({ name: author.displayName, ...(author.uri ? { url: author.uri } : {}) })) })
            if (withPhoto.success) { business.photoUrl = withPhoto.data.photoUrl; business.photoCredits = withPhoto.data.photoCredits; business.photoMessage = "Google listing photo loaded." }
          } else business.photoMessage = `Google photo request returned HTTP ${media.status}. Check Places API (New), billing and key restrictions.`
        } catch { /* A missing photo must not hide the store details. */ }
      }
    } catch (error) {
      business.status = "unavailable"
      business.statusMessage = error instanceof Error && /^Google Places returned HTTP \d{3}\./.test(error.message) ? error.message : "Google details could not be loaded. Check the Place ID and Google API configuration, then try Refresh Google data."
      business.mapsUrl = mapsUrl
      business.reviewsUrl = mapsUrl
      business.writeReviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`
      business.reviews = []
      business.rating = null
      business.reviewCount = null
      business.googleFields = undefined
    }
  }
  return business
}
