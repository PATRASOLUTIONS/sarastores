import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { ObjectId } from "mongodb"
import { COLLECTIONS, getCollection, normalizeId } from "@/lib/db-service"
import { CouponPatchSchema, StoredCouponFieldsSchema } from "@/lib/coupon-validation"
import { handleApiError } from "@/lib/api-error"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid coupon ID" }, { status: 400 })
    }
    const col = await getCollection(COLLECTIONS.COUPONS)
    const doc = await col.findOne({ _id: new ObjectId(id) })
    if (!doc) return NextResponse.json({ success: false, error: "Coupon not found" }, { status: 404 })
    return NextResponse.json({ success: true, coupon: normalizeId(doc) })
  } catch (e) {
    console.error("[coupons][GET one] error:", e)
    return NextResponse.json({ success: false, error: "Failed to fetch coupon" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid coupon ID" }, { status: 400 })
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
    }
    const patch = CouponPatchSchema.safeParse(body)
    if (!patch.success) {
      return NextResponse.json({ success: false, error: "Invalid input", details: patch.error.flatten().fieldErrors }, { status: 400 })
    }
    const col = await getCollection(COLLECTIONS.COUPONS)
    const existing = await col.findOne({ _id: new ObjectId(id) })
    if (!existing) return NextResponse.json({ success: false, error: "Coupon not found" }, { status: 404 })
    const parsed = StoredCouponFieldsSchema.safeParse({ ...existing, ...patch.data })
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid coupon", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const duplicate = await col.findOne({ code: parsed.data.code, _id: { $ne: existing._id } })
    if (duplicate) return NextResponse.json({ success: false, error: "Coupon code already exists" }, { status: 409 })
    // Guard against overwriting a concurrent admin edit; usage counters are untouched.
    const previousTime = existing.updatedAt instanceof Date ? existing.updatedAt.getTime() : 0
    const updated = await col.findOneAndUpdate(
      { _id: existing._id, updatedAt: existing.updatedAt === undefined ? { $exists: false } : existing.updatedAt },
      { $set: {
        ...parsed.data, endDate: parsed.data.noEndDate ? null : parsed.data.endDate,
        updatedAt: new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)),
      } },
      { returnDocument: "after" },
    )
    if (!updated) {
      return NextResponse.json({ success: false, error: "Coupon changed or was removed. Reload before saving." }, { status: 409 })
    }
    return NextResponse.json({ success: true, coupon: normalizeId(updated) })
  } catch (error) {
    return handleApiError(error, "Failed to update coupon")
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid coupon ID" }, { status: 400 })
    }
    const col = await getCollection(COLLECTIONS.COUPONS)
    const res = await col.deleteOne({ _id: new ObjectId(id) })
    if (res.deletedCount === 0) {
      return NextResponse.json({ success: false, error: "Coupon not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[coupons][DELETE] error:", e)
    return NextResponse.json({ success: false, error: "Failed to delete coupon" }, { status: 500 })
  }
}
