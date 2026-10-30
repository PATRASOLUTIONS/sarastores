import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import type { StoredStoreLocation } from "@/lib/store-locations"
import { handleApiError } from "@/lib/api-error"

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const stores = await (await getCollection<StoredStoreLocation>("store_locations")).find({}, {
      projection: { shopName: 1, storeCode: 1, locationDescription: 1, isActive: 1, locationType: 1 },
    }).sort({ shopName: 1, _id: 1 }).toArray()
    return NextResponse.json({ success: true, stores: stores.map(store => ({
      id: String(store._id), name: store.shopName || "", code: store.storeCode || "", address: store.locationDescription || "",
      active: store.isActive === true, locationType: store.locationType || "store",
    })) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return handleApiError(error, "Unable to load stores for the Google overview") }
}
