import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { SavedDeliveryAddressSchema } from "@/lib/validation"

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: Context) {
  try {
    const guard = await requireUser()
    if (!guard.ok) return guard.response
    const { id } = await context.params
    if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid address ID" }, { status: 400 })
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const result = SavedDeliveryAddressSchema.safeParse(body)
    if (!result.success) return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    const collection = await getCollection("user_addresses")
    const _id = new ObjectId(id)
    const updated = await collection.updateOne(
      { _id, userId: guard.user.id }, { $set: { ...result.data, updatedAt: new Date() } },
    )
    if (!updated.matchedCount) return NextResponse.json({ error: "Address not found" }, { status: 404 })
    return NextResponse.json({ address: normalizeId({ ...result.data, _id }) })
  } catch (error) {
    return handleApiError(error, "Address could not be updated")
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const guard = await requireUser()
    if (!guard.ok) return guard.response
    const { id } = await context.params
    if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid address ID" }, { status: 400 })
    const collection = await getCollection("user_addresses")
    const deleted = await collection.deleteOne({ _id: new ObjectId(id), userId: guard.user.id })
    if (!deleted.deletedCount) return NextResponse.json({ error: "Address not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Address could not be removed")
  }
}
