import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection, normalizeId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { z } from "zod"

type ApplyScope = "all" | "products" | "categories" | "brands"
type CouponType = "fixed" | "percentage" | "buy_get"

// Inline schema matching the existing manual validation
const createCouponSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').max(50).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric'),
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(["fixed", "percentage", "buy_get"]),
  value: z.number().positive('Value must be positive'),
  maxDiscount: z.number().positive().optional(),
  applyScope: z.enum(["all", "products", "categories", "brands"]),
  productIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
  brands: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  noEndDate: z.boolean().default(false),
  usageLimit: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  buyQty: z.number().int().positive().optional(),
  getQty: z.number().int().positive().optional(),
  active: z.boolean().default(true),
})

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const col = await getCollection(COLLECTIONS.COUPONS)
    const coupons = await col.find({}).sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ success: true, coupons: normalizeId(coupons) })
  } catch (e) {
    console.error("[coupons][GET] error:", e)
    return NextResponse.json({ success: true, coupons: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = createCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const {
      code,
      name,
      type,
      value,
      maxDiscount,
      applyScope,
      productIds,
      categoryIds,
      brands,
      startDate,
      endDate,
      noEndDate,
      usageLimit,
      perCustomerLimit,
      buyQty,
      getQty,
      active,
    } = parsed.data

    const col = await getCollection(COLLECTIONS.COUPONS)
    const exists = await col.findOne({ code: code.toUpperCase().trim() })
    if (exists) {
      return NextResponse.json({ success: false, error: "Coupon code already exists" }, { status: 409 })
    }

    const now = new Date()
    const doc = {
      code: code.toUpperCase().trim(),
      name: name.trim(),
      type,
      value,
      maxDiscount: maxDiscount ?? null,
      applyScope,
      productIds,
      categoryIds,
      brands,
      startDate: startDate ? new Date(startDate) : null,
      endDate: noEndDate ? null : endDate ? new Date(endDate) : null,
      noEndDate: !!noEndDate,
      usageLimit: typeof usageLimit === 'number' ? usageLimit : 0,
      perCustomerLimit: typeof perCustomerLimit === 'number' ? perCustomerLimit : 0,
      buyQty: buyQty ?? null,
      getQty: getQty ?? null,
      active: !!active,
      usageCount: 0,
      usageByUser: [] as { userId: string; count: number }[],
      createdAt: now,
      updatedAt: now,
    }

    const res = await col.insertOne(doc)
    const inserted = await col.findOne({ _id: res.insertedId })
    return NextResponse.json({ success: true, coupon: normalizeId(inserted) })
  } catch (e) {
    console.error("[coupons][POST] error:", e)
    return NextResponse.json({ success: false, error: "Failed to create coupon" }, { status: 500 })
  }
}
