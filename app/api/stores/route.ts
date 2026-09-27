import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"

export async function GET() {
    try {
        const collection = await getCollection("store_locations")
        const stores = await collection.find({ isActive: true }).sort({ shopName: 1 }).toArray()

        // Normalize and map to the format expected by the frontend
        const normalizedStores = stores.map(store => {
            const address = store.locationDescription || "";
            // Coordinates are backfilled by scripts/backfill-store-coordinates.js;
            // fall back to parsing the map link for stores added since.
            const fallbackCoords = extractLatLng(store.googleMapLocation)
            const latitude = typeof store.latitude === "number" ? store.latitude : fallbackCoords.latitude
            const longitude = typeof store.longitude === "number" ? store.longitude : fallbackCoords.longitude

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
                ...(typeof latitude === "number" ? { latitude } : {}),
                ...(typeof longitude === "number" ? { longitude } : {}),
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

function derivePincode(address: string) {
    const m = (address || "").match(/\b(\d{6})\b/)
    return m ? m[1] : ""
}

/** Last-resort city guess for stores that have not been geocoded yet. */
function deriveCity(address: string) {
    if (!address.includes(",")) return ""
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean)
    const candidate = parts[parts.length - 2] || parts[parts.length - 1] || ""
    const match = candidate.replace(/\d|-/g, "").trim()
    return match.length > 2 ? match : ""
}

function extractLatLng(url: string) {
    if (!url) return {}
    try {
        // Try to extract from ?q=lat,lng or @lat,lng
        const qMatch = url.match(/[?&]q=([-0-9.]+),([-0-9.]+)/)
        if (qMatch) {
            return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) }
        }
        const atMatch = url.match(/@([-0-9.]+),([-0-9.]+)/)
        if (atMatch) {
            return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) }
        }
    } catch (e) {
        // ignore
    }
    return {}
}
