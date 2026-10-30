import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { CreateStoreLocationSchema } from "@/lib/validation"
import type { StoredStoreLocation } from "@/lib/store-locations"

const COLLECTION = "store_locations"

// GET - Fetch all store locations
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const collection = await getCollection<StoredStoreLocation>(COLLECTION)
    const stores = await collection.find({}).sort({ createdAt: -1 }).toArray()
    
    // Normalize _id to id for frontend
    const normalizedStores = stores.map(store => ({
      id: store._id.toString(),
      shopName: store.shopName || "",
      storeCode: store.storeCode || "",
      locationType: store.locationType || "store",
      locationDescription: store.locationDescription || "",
      googleMapLocation: store.googleMapLocation || "",
      googlePlaceId: store.googlePlaceId || "",
      mobileNo: store.mobileNo || "",
      shopTiming: store.shopTiming || "9:00 AM - 9:00 PM",
      shopImage: store.shopImage || "",
      emailId: store.emailId || "",
      isActive: store.isActive === true,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    }))

    return NextResponse.json({ 
      success: true, 
      stores: normalizedStores 
    })
  } catch (error) {
    console.error("Error fetching store locations:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch store locations" 
    }, { status: 500 })
  }
}

// POST - Add a new store location
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = CreateStoreLocationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const storeData = { ...parsed.data, locationType: parsed.data.locationType || ("store" as const), createdAt: new Date(), updatedAt: new Date() }
    const collection = await getCollection<StoredStoreLocation>(COLLECTION)
    if (storeData.storeCode && await collection.findOne({ storeCode: storeData.storeCode }, { projection: { _id: 1 } })) {
      return NextResponse.json({ success: false, message: `Store code ${storeData.storeCode} is already used by another store` }, { status: 409 })
    }
    const result = await collection.insertOne(storeData)

    return NextResponse.json({ 
      success: true, 
      message: "Store added successfully",
      id: result.insertedId.toString()
    })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    console.error("Error adding store location:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to add store location" 
    }, { status: 500 })
  }
}
