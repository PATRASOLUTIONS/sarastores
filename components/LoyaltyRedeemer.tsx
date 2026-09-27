"use client"

import { useEffect, useState } from "react"
import { Gift, Loader2 } from "lucide-react"

interface LoyaltyState {
  balance: number
  redeemable: number
  tier: string
  rules: { pointValueInr: number; redemptionStep: number; maxRedemptionRatio: number }
}

/**
 * Rewards redemption at checkout.
 *
 * The slider only proposes an amount — the discount is recomputed and the
 * points debited by the server when the order is created, so a tampered value
 * here changes nothing.
 */
export default function LoyaltyRedeemer({
  orderTotal,
  points,
  onChange,
}: {
  orderTotal: number
  points: number
  onChange: (points: number, discount: number) => void
}) {
  const [state, setState] = useState<LoyaltyState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!(orderTotal > 0)) return

    let cancelled = false
    setLoading(true)
    fetch(`/api/loyalty?orderTotal=${encodeURIComponent(orderTotal)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return
        setState({
          balance: data.balance,
          redeemable: data.redeemable,
          tier: data.tier,
          rules: data.rules,
        })
      })
      .catch(() => {
        /* signed-out or unavailable — section hides */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [orderTotal])

  if (loading) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your rewards…
      </p>
    )
  }

  if (!state || state.balance <= 0) return null

  const { redeemable, rules } = state
  const discount = Math.floor(points * rules.pointValueInr)

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Sara Rewards — {state.balance.toLocaleString("en-IN")} points available
          </p>

          {redeemable <= 0 ? (
            <p className="mt-1 text-xs text-gray-600">
              You need at least {rules.redemptionStep} points to redeem, and rewards can cover up to{" "}
              {Math.round(rules.maxRedemptionRatio * 100)}% of an order.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-gray-600">
                Redeem up to {redeemable.toLocaleString("en-IN")} points on this order —{" "}
                {Math.round(rules.maxRedemptionRatio * 100)}% maximum, in steps of{" "}
                {rules.redemptionStep}.
              </p>

              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={redeemable}
                  step={rules.redemptionStep}
                  value={Math.min(points, redeemable)}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    onChange(next, Math.floor(next * rules.pointValueInr))
                  }}
                  aria-label="Points to redeem"
                  className="flex-1 accent-amber-600"
                />
                <span className="w-28 shrink-0 text-right text-sm font-semibold text-gray-900">
                  {points > 0 ? `−₹${discount.toLocaleString("en-IN")}` : "₹0"}
                </span>
              </div>

              {points > 0 && (
                <button
                  type="button"
                  onClick={() => onChange(0, 0)}
                  className="mt-2 text-xs font-medium text-amber-700 hover:underline"
                >
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
