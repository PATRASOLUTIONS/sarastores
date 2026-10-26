import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { storePaymentEnabled } from "@/lib/payment-config"
import { firstMobile, getStorePaymentWhatsAppSettings } from "@/lib/store-payment"
import { deriveCity, derivePincode, storeCoordinates } from "@/lib/store-address"
import { ACTIVE_RETAIL_STORE_FILTER } from "@/lib/store-locations"

export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "no-store" }
const EMAIL = /^\S+@\S+\.\S+$/

/**
 * Every active store from /admin/store-locations, read live so a store added or
 * edited there is offered for pay at store immediately. A store needs a phone
 * (or a manager WhatsApp override) or an email to receive the order, so the rest
 * are listed but marked as not accepting payments yet.
 */
export async function GET() {
  if (!storePaymentEnabled()) return NextResponse.json({ success: true, stores: [] }, { headers })
  try {
    const [stores, settings] = await Promise.all([
      (await getCollection("store_locations")).find(ACTIVE_RETAIL_STORE_FILTER).sort({ shopName: 1 }).toArray(),
      getStorePaymentWhatsAppSettings(),
    ])
    return NextResponse.json({
      success: true,
      stores: stores.map(store => {
        const id = store._id.toString()
        const address = String(store.locationDescription || "")
        const phone = settings.storeManagers[id] || firstMobile(store.mobileNo)
        const email = typeof store.emailId === "string" && EMAIL.test(store.emailId.trim())
        return {
          id,
          name: String(store.shopName || "SARA store"),
          address,
          city: String(store.city || deriveCity(address)),
          state: String(store.state || ""),
          pincode: String(store.pincode || derivePincode(address)),
          phone: String(store.mobileNo || ""),
          hours: String(store.shopTiming || ""),
          image: String(store.shopImage || ""),
          ...storeCoordinates(store),
          acceptsPayAtStore: Boolean(phone || email),
        }
      }),
    }, { headers })
  } catch (error) {
    console.error("[Pay at store stores]", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: "Stores could not be loaded" }, { status: 500, headers })
  }
}
