import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import type { StoredStoreLocation } from "@/lib/store-locations"
import { getGoogleStoreBusiness } from "@/lib/store-google-business"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"

export const maxDuration = 45

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const { id } = await context.params
  return withRateLimit(async function googleDetails() {
    try {
      if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid store ID" }, { status: 400 })
      const store = await (await getCollection<StoredStoreLocation>("store_locations")).findOne({ _id: new ObjectId(id) }, {
        projection: { shopName: 1, storeCode: 1, locationType: 1, locationDescription: 1, mobileNo: 1, shopTiming: 1,
          shopImage: 1, googleMapLocation: 1, googlePlaceId: 1, latitude: 1, longitude: 1, isActive: 1 },
      })
      if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 })
      const business = await getGoogleStoreBusiness(store, request.nextUrl.searchParams.get("refresh") === "1")
      return NextResponse.json({ success: true, business, checkedAt: new Date().toISOString(), store: {
        id: String(store._id), name: store.shopName || "", code: store.storeCode || "", address: store.locationDescription || "",
        phone: String(store.mobileNo || ""), hours: store.shopTiming || "", image: store.shopImage || "", mapUrl: store.googleMapLocation || "",
        placeId: store.googlePlaceId || "", active: store.isActive === true, locationType: store.locationType || "store",
      } }, { headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return handleApiError(error, "Unable to fetch Google store details") }
  }, { windowMs: 60000, maxRequests: 15 })(request)
}
