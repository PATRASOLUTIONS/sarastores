import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

const COLLECTION = "store_locations"

interface StorePayload {
  shopName: string
  locationDescription: string
  googleMapLocation: string
  mobileNo: string
  shopTiming: string
  shopImage: string
  emailId: string
  isActive: boolean
}

// POST - Bulk upload store locations
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { stores } = body as { stores: StorePayload[] }

    if (!stores || !Array.isArray(stores) || stores.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No stores provided" 
      }, { status: 400 })
    }

    const collection = await getCollection(COLLECTION)
    
    let inserted = 0
    let updated = 0
    const errors: string[] = []

    for (const store of stores) {
      try {
        if (!store.shopName || !store.shopName.trim()) {
          errors.push(`Skipped store with empty name`)
          continue
        }

        // Check if store with same name already exists
        const existingStore = await collection.findOne({ 
          shopName: store.shopName.trim() 
        })

        const storeData = {
          shopName: store.shopName.trim(),
          locationDescription: store.locationDescription?.trim() || "",
          googleMapLocation: store.googleMapLocation?.trim() || "",
          mobileNo: store.mobileNo?.trim() || "",
          shopTiming: store.shopTiming?.trim() || "9:00 AM - 9:00 PM",
          shopImage: store.shopImage?.trim() || "",
          emailId: store.emailId?.trim() || "",
          isActive: store.isActive !== false,
          updatedAt: new Date()
        }

        if (existingStore) {
          // Update existing store
          await collection.updateOne(
            { _id: existingStore._id },
            { $set: storeData }
          )
          updated++
        } else {
          // Insert new store
          await collection.insertOne({
            ...storeData,
            createdAt: new Date()
          })
          inserted++
        }
      } catch (storeError) {
        errors.push(`Failed to process store: ${store.shopName}`)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Bulk upload completed`,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error("Error in bulk upload:", error)
    return NextResponse.json({ 
      success: false, 
      message: "Failed to process bulk upload" 
    }, { status: 500 })
  }
}
