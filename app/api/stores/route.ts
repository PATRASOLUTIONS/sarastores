import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { deriveCity, derivePincode, storeCoordinates } from "@/lib/store-address"
import { ACTIVE_RETAIL_STORE_FILTER } from "@/lib/store-locations"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const collection = await getCollection("store_locations")
        const stores = await collection.find(ACTIVE_RETAIL_STORE_FILTER).sort({ shopName: 1 }).toArray()

        // Normalize and map to the format expected by the frontend
        const normalizedStores = stores.map(store => {
            const address = store.locationDescription || "";

            return {
                id: store._id.toString(),
                name: store.shopName || "",
                address: address,
                city: store.city || deriveCity(address),
                state: store.state || "",
                pincode: String(store.pincode || derivePincode(address)),
                region: String(store.shopName || "").toLowerCase().includes("mobile") ? "Mobile Store" : "Electronic Store",
                phone: String(store.mobileNo || ""),
                storeCode: String(store.storeCode || ""),
                email: store.emailId || "",
                hours: store.shopTiming || "9:00 AM - 9:00 PM",
                isOpen: store.isActive !== false,
                image: store.shopImage || "",
                mapUrl: store.googleMapLocation || "",
                googlePlaceId: store.googlePlaceId || "",
                // Coordinates are backfilled by scripts/backfill-store-coordinates.mjs;
                // stores added since fall back to parsing the map link.
                ...storeCoordinates(store),
            }
        })

        return NextResponse.json(
            { success: true, stores: normalizedStores },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        console.error("Error fetching stores:", error)
        return NextResponse.json({
            success: false,
            message: "Failed to fetch stores"
        }, { status: 500 })
    }
}
