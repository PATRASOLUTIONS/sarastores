import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"

const COLLECTION = "store_locations"

// GET - Fetch all store locations
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const collection = await getCollection(COLLECTION)
    const stores = await collection.find({}).sort({ createdAt: -1 }).toArray()
    
    // Normalize _id to id for frontend
    const normalizedStores = stores.map(store => ({
      id: store._id.toString(),
      shopName: store.shopName || "",
      locationDescription: store.locationDescription || "",
      googleMapLocation: store.googleMapLocation || "",
      mobileNo: store.mobileNo || "",
      shopTiming: store.shopTiming || "9:00 AM - 9:00 PM",
      shopImage: store.shopImage || "",
      emailId: store.emailId || "",
      isActive: store.isActive !== false,
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
    const body = await request.json()
    
    const { 
      shopName, 
      locationDescription, 
      googleMapLocation, 
      mobileNo, 
      shopTiming, 
      shopImage, 
      emailId,
      isActive = true 
    } = body

    if (!shopName || !shopName.trim()) {
      return NextResponse.json({ 
        success: false, 
        message: "Shop name is required" 
      }, { status: 400 })
    }

    const storeData = {
      shopName: shopName.trim(),
      locationDescription: locationDescription?.trim() || "",
      googleMapLocation: googleMapLocation?.trim() || "",
      mobileNo: mobileNo?.trim() || "",
      shopTiming: shopTiming?.trim() || "9:00 AM - 9:00 PM",
      shopImage: shopImage?.trim() || "",
      emailId: emailId?.trim() || "",
      isActive: Boolean(isActive),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const collection = await getCollection(COLLECTION)
    const result = await collection.insertOne(storeData)

    return NextResponse.json({ 
      success: true, 
      message: "Store added successfully",
      id: result.insertedId.toString()
    })
  } catch (error) {
    console.error("Error adding store location:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to add store location" 
    }, { status: 500 })
  }
}
