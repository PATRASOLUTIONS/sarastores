import { NextResponse } from "next/server"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { requireUser } from "@/lib/auth"

/**
 * Redeem a coupon after successful order placement
 * This increments usage counters and tracks per-user usage
 */
export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const { code }: { code: string } = await request.json()
    // Identity comes from the session so per-customer limits cannot be spoofed.
    const userId = guard.user.id
    
    if (!code) {
      return NextResponse.json({ success: false, error: "Coupon code required" }, { status: 400 })
    }

    const couponsCol = await getCollection(COLLECTIONS.COUPONS)
    const coupon = await couponsCol.findOne({ code: code.toUpperCase().trim() })
    
    if (!coupon) {
      return NextResponse.json({ success: false, error: "Coupon not found" }, { status: 404 })
    }

    console.log("[Coupon Redeem] Redeeming coupon:", {
      code: coupon.code,
      currentUsageCount: coupon.usageCount || 0,
      usageLimit: coupon.usageLimit,
      userId,
      perCustomerLimit: coupon.perCustomerLimit
    })

    // Increment total usage count
    const updateData: any = {
      $inc: { usageCount: 1 }
    }

    // Track per-user usage if userId provided (regardless of perCustomerLimit)
    // This allows us to track usage history even if limit is not set
    if (userId) {
      const usageByUser = coupon.usageByUser || []
      const userRecord = usageByUser.find((u: any) => u.userId === userId)
      
      if (userRecord) {
        // User has used this coupon before - increment their count
        updateData.$inc = {
          ...updateData.$inc,
          "usageByUser.$[user].count": 1
        }
        updateData.$set = {
          "usageByUser.$[user].lastUsed": new Date()
        }
        updateData.arrayFilters = [{ "user.userId": userId }]
      } else {
        // First time user is using this coupon - add new record
        updateData.$push = {
          usageByUser: {
            userId,
            count: 1,
            lastUsed: new Date()
          }
        }
      }
    }

    // Update the coupon
    const result = await couponsCol.updateOne(
      { _id: coupon._id },
      updateData,
      { arrayFilters: updateData.arrayFilters }
    )

    if (result.modifiedCount === 0) {
      console.warn("[Coupon Redeem] ⚠️ WARNING: No document modified")
    } else {
      console.log("[Coupon Redeem] ✅ SUCCESS: Coupon usage incremented to", (coupon.usageCount || 0) + 1)
    }

    // Fetch updated coupon to verify
    const updatedCoupon = await couponsCol.findOne({ _id: coupon._id })
    console.log("[Coupon Redeem] Updated usage count:", updatedCoupon?.usageCount)

    return NextResponse.json({ 
      success: true, 
      message: "Coupon redeemed successfully",
      usageCount: (coupon.usageCount || 0) + 1
    })
  } catch (e) {
    console.error("[coupons][redeem][POST] error:", e)
    return NextResponse.json({ success: false, error: "Redemption failed" }, { status: 500 })
  }
}
