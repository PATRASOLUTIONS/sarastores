import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { ACTIVE_RETAIL_STORE_FILTER, type StoredStoreLocation } from "@/lib/store-locations"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"
import { getGoogleStoreBusiness } from "@/lib/store-google-business"

export const maxDuration = 45

// Public branch details; the Place ID is loaded from our catalogue, never supplied by the visitor.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return withRateLimit(async function businessDetails() {
    try {
      if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid store" }, { status: 400 })
      const store = await (await getCollection<StoredStoreLocation>("store_locations")).findOne({
        ...ACTIVE_RETAIL_STORE_FILTER, _id: new ObjectId(id),
      }, { projection: { shopName: 1, locationDescription: 1, mobileNo: 1, shopTiming: 1, googleMapLocation: 1, googlePlaceId: 1, latitude: 1, longitude: 1 } })
      if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 })
      const business = await getGoogleStoreBusiness(store)
      return NextResponse.json({ success: true, business }, { headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return handleApiError(error, "Unable to load store details") }
  }, { windowMs: 60000, maxRequests: 30 })(request)
}
