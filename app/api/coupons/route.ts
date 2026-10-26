import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection, normalizeId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CreateCouponSchema } from "@/lib/coupon-validation"

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const col = await getCollection(COLLECTIONS.COUPONS)
    const coupons = await col.find({}).sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ success: true, coupons: normalizeId(coupons) })
  } catch (error) {
    return handleApiError(error, "Failed to load coupons")
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 })
    }
    const parsed = CreateCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    if (parsed.data.type === "buy_get_product" && parsed.data.active && !await (await getCollection<{ _id: string; active: boolean }>("gift_items")).findOne({ _id: parsed.data.giftId!, active: true })) {
      return NextResponse.json({ error: "Select an active gift from Gift Listing" }, { status: 400 })
    }
    const col = await getCollection(COLLECTIONS.COUPONS)
    if (await col.findOne({ code: parsed.data.code })) {
      return NextResponse.json({ success: false, error: "Coupon code already exists" }, { status: 409 })
    }
    const now = new Date()
    const doc = {
      ...parsed.data,
      endDate: parsed.data.noEndDate ? null : parsed.data.endDate,
      usageCount: 0,
      usageByUser: [],
      createdAt: now,
      updatedAt: now,
    }
    const result = await col.insertOne(doc)
    return NextResponse.json({ success: true, coupon: normalizeId({ ...doc, _id: result.insertedId }) })
  } catch (error) {
    return handleApiError(error, "Failed to create coupon")
  }
}
