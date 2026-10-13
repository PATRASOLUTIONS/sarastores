import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import {
  MAX_REDEMPTION_RATIO,
  POINT_VALUE_INR,
  REDEMPTION_STEP,
  getLoyaltySnapshot,
  SPEND_PER_COIN_INR,
  POINT_LIFETIME_DAYS,
  maxRedeemablePoints,
} from "@/lib/loyalty"

/** Balance, history and the redemption ceiling for an optional order total. */
export async function GET(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    const balance = await getLoyaltySnapshot(guard.user.id)

    const orderTotal = Number(request.nextUrl.searchParams.get("orderTotal"))
    const redeemable =
      Number.isFinite(orderTotal) && orderTotal > 0
        ? maxRedeemablePoints(balance.balance, orderTotal)
        : 0

    return NextResponse.json({
      success: true,
      ...balance,
      history: balance.history.slice(0, 50),
      redeemable,
      rules: {
        spendPerCoinInr: SPEND_PER_COIN_INR,
        pointLifetimeDays: POINT_LIFETIME_DAYS,
        pointValueInr: POINT_VALUE_INR,
        redemptionStep: REDEMPTION_STEP,
        maxRedemptionRatio: MAX_REDEMPTION_RATIO,
      },
    })
  } catch (error) {
    return handleApiError(error, "Failed to load rewards")
  }
}
