import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"
import { UpdateStoreLocationSchema } from "@/lib/validation"
import type { StoredStoreLocation } from "@/lib/store-locations"

const COLLECTION = "store_locations"

// GET - Fetch a single store location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid store ID" 
      }, { status: 400 })
    }

    const collection = await getCollection<StoredStoreLocation>(COLLECTION)
    const store = await collection.findOne({ _id: new ObjectId(id) })

    if (!store) {
      return NextResponse.json({ 
        success: false, 
        message: "Store not found" 
      }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      store: {
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
      }
    })
  } catch (error) {
    console.error("Error fetching store:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch store" 
    }, { status: 500 })
  }
}

// PUT - Update a store location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const parsed = UpdateStoreLocationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid store ID" 
      }, { status: 400 })
    }

    const collection = await getCollection<StoredStoreLocation>(COLLECTION)
    const existingStore = await collection.findOne({ _id: new ObjectId(id) })

    if (!existingStore) {
      return NextResponse.json({ 
        success: false, 
        message: "Store not found" 
      }, { status: 404 })
    }

    const updateData = { ...parsed.data, updatedAt: new Date() }
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    if (!result.matchedCount) return NextResponse.json({ success: false, message: "Store was removed during update" }, { status: 409 })

    return NextResponse.json({ 
      success: true, 
      message: "Store updated successfully" 
    })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 })
    console.error("Error updating store:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to update store" 
    }, { status: 500 })
  }
}

// DELETE - Delete a store location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid store ID" 
      }, { status: 400 })
    }

    const collection = await getCollection(COLLECTION)
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "Store not found" 
      }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Store deleted successfully" 
    })
  } catch (error) {
    console.error("Error deleting store:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to delete store" 
    }, { status: 500 })
  }
}
