import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { deriveCity, derivePincode, storeCoordinates } from "@/lib/store-address"

export async function GET() {
    try {
        const collection = await getCollection("store_locations")
        const stores = await collection.find({ isActive: true }).sort({ shopName: 1 }).toArray()

        // Normalize and map to the format expected by the frontend
        const normalizedStores = stores.map(store => {
            const address = store.locationDescription || "";

            return {
                id: store._id.toString(),
                name: store.shopName || "",
                address: address,
                city: store.city || deriveCity(address),
                state: store.state || "",
                pincode: store.pincode || derivePincode(address),
                region: store.shopName.toLowerCase().includes("mobile") ? "Mobile Store" : "Electronic Store",
                phone: store.mobileNo || "",
                email: store.emailId || "",
                hours: store.shopTiming || "9:00 AM - 9:00 PM",
                isOpen: store.isActive !== false,
                image: store.shopImage || "",
                mapUrl: store.googleMapLocation || "",
                // Coordinates are backfilled by scripts/backfill-store-coordinates.mjs;
                // stores added since fall back to parsing the map link.
                ...storeCoordinates(store),
            }
        })

        return NextResponse.json(
            { success: true, stores: normalizedStores },
            { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
        )
    } catch (error) {
        console.error("Error fetching stores:", error)
        return NextResponse.json({
            success: false,
            message: "Failed to fetch stores"
        }, { status: 500 })
    }
}
