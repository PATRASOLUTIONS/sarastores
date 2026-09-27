import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { ObjectId } from "mongodb"
import { COLLECTIONS, getCollection, normalizeId } from "@/lib/db-service"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const body = await request.json()
    const {
      code,
      name,
      type,
      value,
      maxDiscount,
      applyScope,
      productIds = [],
      categoryIds = [],
      brands = [],
      startDate,
      endDate,
      noEndDate = false,
      usageLimit,
      perCustomerLimit,
      buyQty,
      getQty,
      active = true,
    } = body

    const col = await getCollection(COLLECTIONS.COUPONS)

    const updateDoc = {
      ...(code ? { code: String(code).toUpperCase().trim() } : {}),
      ...(name ? { name: String(name).trim() } : {}),
      ...(type ? { type } : {}),
      ...(value !== undefined ? { value: Number(value) } : {}),
      ...(maxDiscount !== undefined ? { maxDiscount: maxDiscount ?? null } : {}),
      ...(applyScope ? { applyScope } : {}),
      ...(productIds ? { productIds } : {}),
      ...(categoryIds ? { categoryIds } : {}),
      ...(brands ? { brands } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: noEndDate ? null : endDate ? new Date(endDate) : null } : {}),
      ...(noEndDate !== undefined ? { noEndDate: !!noEndDate } : {}),
      ...(usageLimit !== undefined ? { usageLimit: typeof usageLimit === 'number' ? usageLimit : 0 } : {}),
      ...(perCustomerLimit !== undefined ? { perCustomerLimit: typeof perCustomerLimit === 'number' ? perCustomerLimit : 0 } : {}),
      ...(buyQty !== undefined ? { buyQty: buyQty ?? null } : {}),
      ...(getQty !== undefined ? { getQty: getQty ?? null } : {}),
      ...(active !== undefined ? { active: !!active } : {}),
      updatedAt: new Date(),
    }

    const res = await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc })
    if (res.matchedCount === 0) {
      return NextResponse.json({ success: false, error: "Coupon not found" }, { status: 404 })
    }
    const updated = await col.findOne({ _id: new ObjectId(id) })
    return NextResponse.json({ success: true, coupon: normalizeId(updated) })
  } catch (e) {
    console.error("[coupons][PUT] error:", e)
    return NextResponse.json({ success: false, error: "Failed to update coupon" }, { status: 500 })
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
