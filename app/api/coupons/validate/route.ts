import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { withRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { z } from "zod"

type CartItem = { id: string; quantity: number; price: number }
type ApplyScope = "all" | "products" | "categories" | "brands" | "skus"

function inScope(
  product: any,
  scope: ApplyScope,
  productIds: string[],
  categoryIds: string[],
  brands: string[],
  skus: string[],
): boolean {
  if (scope === "all") return true
  if (scope === "products") return productIds.includes(product?.id || product?._id?.toString?.())
  if (scope === "categories") return categoryIds.includes(product?.category || product?.categoryId)
  if (scope === "brands") {
    // Try both brand and brandId, case-insensitive
    const prodBrand = (product?.brand || product?.brandId || "").toString().toLowerCase()
    return brands.map((b) => b.toLowerCase()).includes(prodBrand)
  }
  if (scope === "skus") {
    const prodSku = (product?.sku || "").toString().toLowerCase()
    return skus.map((s) => s.toLowerCase()).includes(prodSku)
  }
  return false
}

const ApplyCouponSchema = z.object({
  code: z.string().min(1).max(50),
  cart: z.array(z.object({
    id: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })).min(1),
  userId: z.string().optional(),
})

// Rate limited so coupon codes cannot be brute-forced by enumeration.
export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ApplyCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })
    }
    const { code, cart, userId } = parsed.data

    const couponsCol = await getCollection(COLLECTIONS.COUPONS)
    const coupon = await couponsCol.findOne({ code: code.toUpperCase().trim(), active: true })
    if (!coupon) return NextResponse.json({ success: false, error: "Coupon not found or inactive" }, { status: 404 })



    // Validity window
    const now = new Date()
    if (coupon.startDate && now < coupon.startDate) {
      return NextResponse.json({ success: false, error: "Coupon not yet valid" }, { status: 400 })
    }
    if (!coupon.noEndDate && coupon.endDate && now > coupon.endDate) {
      return NextResponse.json({ success: false, error: "Coupon expired" }, { status: 400 })
    }

    // Usage limits - Check total usage limit
    const currentUsageCount = Number(coupon.usageCount) || 0
    const usageLimit = Number(coupon.usageLimit) || 0
    
    // Only check if usageLimit is set and greater than 0 (0 means unlimited)
    if (usageLimit > 0 && currentUsageCount >= usageLimit) {
      return NextResponse.json({ 
        success: false, 
        error: `Coupon usage limit reached (${currentUsageCount}/${usageLimit} used)` 
      }, { status: 400 })
    }
    // Check per-customer usage limit
    const perCustomerLimit = Number(coupon.perCustomerLimit) || 0
    
    if (userId && perCustomerLimit > 0) {
      const usageByUser = coupon.usageByUser || []
      const userRecord = usageByUser.find((u: { userId: string; count: number }) => u.userId === userId)
      const userUsageCount = Number(userRecord?.count) || 0
      
      if (userUsageCount >= perCustomerLimit) {
        return NextResponse.json({ 
          success: false, 
          error: `You have reached the per-customer limit for this coupon (${userUsageCount}/${perCustomerLimit} used)` 
        }, { status: 400 })
      }
    }

    // Load product docs to evaluate scope (brand/category)
    const productsCol = await getCollection(COLLECTIONS.PRODUCTS)
    const productDocs = await productsCol
      .find({ _id: { $in: cart.map((i) => require("mongodb").ObjectId.createFromHexString(i.id)) } })
      .toArray()
      .catch(async () => {
        // fallback if id is not ObjectId: match string id field with limit
        const cartIds = new Set(cart.map((i) => i.id))
        const all = await productsCol.find({}).limit(500).toArray()
        return all.filter((p: { id?: string; _id?: { toString(): string } }) =>
          cartIds.has(p.id || p._id?.toString?.() || "")
        )
      })

    const docById = new Map<string, Record<string, unknown>>()
    for (const p of productDocs) {
      const key = (p.id || p._id?.toString?.()) as string
      docById.set(key, p)
    }

    const scope: ApplyScope = coupon.applyScope
    const eligibleItems = cart.filter((i) => {
      const doc = docById.get(i.id)
      return inScope(
        doc,
        scope,
        coupon.productIds || [],
        coupon.categoryIds || [],
        coupon.brands || [],
        coupon.skus || []
      )
    })

    if (eligibleItems.length === 0) {
      return NextResponse.json({ success: false, error: "Coupon does not apply to these items" }, { status: 400 })
    }

    const eligibleSubtotal = eligibleItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    let discount = 0
    let details: any = {}

    if (coupon.type === "fixed") {
      discount = Math.min(coupon.value, eligibleSubtotal)
      details = { type: "fixed", value: coupon.value }
    } else if (coupon.type === "percentage") {
      const raw = (eligibleSubtotal * coupon.value) / 100
      discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw
      details = { type: "percentage", value: coupon.value, maxDiscount: coupon.maxDiscount ?? null }
    } else if (coupon.type === "buy_get") {
      const buyQty = coupon.buyQty || 0
      const getQty = coupon.getQty || 0
      let freeUnits = 0
      eligibleItems.forEach((i) => {
        const group = buyQty + getQty
        if (group > 0) {
          // number of full groups customer qualifies for
          const groups = Math.floor(i.quantity / group)
          freeUnits += groups * getQty
        }
      })
      // discount equals sum of cheapest eligible items equivalent to freeUnits
      // We approximate by using average price weighted; for per-item equal pricing, exact.
      const unitPrices: number[] = []
      eligibleItems.forEach((i) => {
        for (let k = 0; k < i.quantity; k++) unitPrices.push(i.price)
      })
      unitPrices.sort((a, b) => a - b) // free the cheapest units
      discount = unitPrices.slice(0, freeUnits).reduce((s, p) => s + p, 0)
      details = { type: "buy_get", buyQty, getQty, freeUnits }
    }

    // Guard
    if (!Number.isFinite(discount) || discount <= 0) {
      return NextResponse.json({ success: false, error: "No discount from this coupon" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      code: coupon.code,
      name: coupon.name,
      discount: Math.round(discount),
      details,
    })
  } catch (e) {
    console.error("[coupons][validate][POST] error:", e)
    return NextResponse.json({ success: false, error: "Validation failed" }, { status: 500 })
  }
} as any, { windowMs: 60 * 1000, maxRequests: 20, message: "Too many coupon attempts, please try again shortly." })
