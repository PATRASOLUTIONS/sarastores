import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { SavedDeliveryAddressSchema } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const guard = await requireUser()
    if (!guard.ok) return guard.response
    const collection = await getCollection("user_addresses")
    const addresses = await collection.find({ userId: guard.user.id })
      .project({ userId: 0, createdAt: 0, updatedAt: 0 }).sort({ updatedAt: -1, _id: -1 }).toArray()
    return NextResponse.json({ addresses: normalizeId(addresses) })
  } catch (error) {
    return handleApiError(error, "Saved addresses could not be loaded")
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser()
    if (!guard.ok) return guard.response
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const result = SavedDeliveryAddressSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }
    const collection = await getCollection("user_addresses")
    const now = new Date()
    const inserted = await collection.insertOne({ ...result.data, userId: guard.user.id, createdAt: now, updatedAt: now })
    return NextResponse.json({ address: normalizeId({ ...result.data, _id: inserted.insertedId }) }, { status: 201 })
  } catch (error) {
    return handleApiError(error, "Address could not be saved")
  }
}
