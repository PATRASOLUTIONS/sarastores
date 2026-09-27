"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Coins, History, TrendingUp } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

interface LedgerEntry {
  id: string
  type: string
  points: number
  reason: string
  createdAt: string
}

interface Balance {
  balance: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  tier: string
  earnRate: number
  expiringSoon: number
  history: LedgerEntry[]
  rules: { pointValueInr: number }
}

const TIER_LABEL: Record<string, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
}

/** Live points balance and ledger for a signed-in customer. */
export default function RewardsBalance() {
  const { user, isLoading } = useAuth()
  const [data, setData] = useState<Balance | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    fetch("/api/loyalty", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setData(json)
      })
      .catch(() => {
        /* panel hides on failure */
      })

    return () => {
      cancelled = true
    }
  }, [user])

  if (isLoading) return null

  if (!user) {
    return (
      <section className="section-container py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <Coins className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-gray-900">Sign in to see your Sara Coins</h2>
          <p className="mt-1 text-sm text-gray-600">
            Points are earned automatically once your order is delivered.
          </p>
          <Link
            href="/login?redirect=/rewards"
            className="mt-4 inline-block rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </section>
    )
  }

  if (!data) return null

  const worth = Math.floor(data.balance * data.rules.pointValueInr)

  return (
    <section className="section-container py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Your balance</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-gray-900">
                {data.balance.toLocaleString("en-IN")}
              </span>
              <span className="text-sm font-semibold text-gray-600">Sara Coins</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Worth ₹{worth.toLocaleString("en-IN")} off your next order
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="font-semibold text-amber-800">{TIER_LABEL[data.tier] || data.tier}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                <TrendingUp className="h-3.5 w-3.5" />
                {data.earnRate} points per ₹100
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="font-semibold text-gray-900">
                {data.lifetimeEarned.toLocaleString("en-IN")}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">Earned all time</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="font-semibold text-gray-900">
                {data.lifetimeRedeemed.toLocaleString("en-IN")}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">Redeemed</p>
            </div>
          </div>
        </div>

        {data.expiringSoon > 0 && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {data.expiringSoon.toLocaleString("en-IN")} points expire within 30 days — use them on
            your next order.
          </p>
        )}

        {data.history.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <History className="h-4 w-4" />
              Recent activity
            </h3>
            <ul className="mt-3 divide-y divide-gray-100">
              {data.history.slice(0, 8).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800">{entry.reason}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      entry.points >= 0 ? "text-green-600" : "text-gray-700"
                    }`}
                  >
                    {entry.points >= 0 ? "+" : ""}
                    {entry.points.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
