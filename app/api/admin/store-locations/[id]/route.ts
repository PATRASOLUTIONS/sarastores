import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"

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

    const collection = await getCollection(COLLECTION)
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
    const body = await request.json()
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid store ID" 
      }, { status: 400 })
    }

    const { 
      shopName, 
      locationDescription, 
      googleMapLocation, 
      mobileNo, 
      shopTiming, 
      shopImage, 
      emailId,
      isActive 
    } = body

    const collection = await getCollection(COLLECTION)
    const existingStore = await collection.findOne({ _id: new ObjectId(id) })

    if (!existingStore) {
      return NextResponse.json({ 
        success: false, 
        message: "Store not found" 
      }, { status: 404 })
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date()
    }

    if (shopName !== undefined) updateData.shopName = shopName.trim()
    if (locationDescription !== undefined) updateData.locationDescription = locationDescription.trim()
    if (googleMapLocation !== undefined) updateData.googleMapLocation = googleMapLocation.trim()
    if (mobileNo !== undefined) updateData.mobileNo = mobileNo.trim()
    if (shopTiming !== undefined) updateData.shopTiming = shopTiming.trim()
    if (shopImage !== undefined) updateData.shopImage = shopImage.trim()
    if (emailId !== undefined) updateData.emailId = emailId.trim()
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    return NextResponse.json({ 
      success: true, 
      message: "Store updated successfully" 
    })
  } catch (error) {
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
