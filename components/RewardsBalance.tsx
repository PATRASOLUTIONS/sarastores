"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Coins, History } from "lucide-react"
import { z } from "zod"
import { useAuth } from "@/contexts/AuthContext"
import { apiFetch } from "@/lib/api-client"

const balanceSchema = z.object({
  success: z.literal(true), balance: z.number().nonnegative(), lifetimeEarned: z.number().nonnegative(),
  lifetimeRedeemed: z.number().nonnegative(), eligibleSpend: z.number().nonnegative(), spendToNextCoin: z.number().positive(),
  expiringSoon: z.number().nonnegative(), history: z.array(z.object({ id: z.string(), points: z.number(), reason: z.string(), createdAt: z.string() })),
  rules: z.object({ pointValueInr: z.number(), spendPerCoinInr: z.number(), redemptionStep: z.number(), maxRedemptionRatio: z.number(), pointLifetimeDays: z.number() }),
})
type Balance = z.infer<typeof balanceSchema>

export default function RewardsBalance({ embedded = false }: { embedded?: boolean }) {
  const { user, isLoading } = useAuth()
  const [data, setData] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setData(null)
    setError("")
    if (!user?.id) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    const load = async () => {
      try {
        const response = await apiFetch("/api/loyalty", { signal: controller.signal })
        if (!response.ok) throw new Error("Your coins could not be loaded")
        const parsed = balanceSchema.parse(await response.json())
        if (!controller.signal.aborted) setData(parsed)
      } catch (failure) {
        if (controller.signal.aborted) return
        console.error("[Rewards] Could not load coins:", failure)
        setError("Your Sara Coins could not be loaded. Please retry.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [user?.id, attempt])

  const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
  return <section className={embedded ? "" : "section-container py-10"} aria-label="Your Sara Coins">
    <div className="rounded-xl border border-[#dce6f4] bg-white p-5 sm:p-6">
      {isLoading || loading ? <p role="status">Loading your Sara Coins...</p> : !user ? <div className="text-center">
        <Coins className="mx-auto h-8 w-8 text-amber-500" /><h2 className="mt-3 text-lg font-bold">Sign in to see your Sara Coins</h2>
        <Link href="/login?redirect=/rewards" className="mt-4 inline-block rounded-lg bg-[#1560bd] px-6 py-2 text-white">Sign in</Link>
      </div> : error ? <p role="alert">{error} <button type="button" className="text-[#1560bd] underline" onClick={() => setAttempt(value => value + 1)}>Retry coins</button></p> : data && <>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><p className="text-sm text-slate-600">Available balance</p><p className="mt-1 flex items-center gap-3"><Coins className="h-9 w-9 text-amber-500" /><strong className="text-4xl text-[#0f2557]">{data.balance.toLocaleString("en-IN")}</strong><span>Sara Coins</span></p></div>
          <Link href={embedded ? "/rewards#how-heading" : "/dashboard/membership"} className="rounded-lg border border-[#1560bd] px-4 py-2 text-sm font-semibold text-[#1560bd]">{embedded ? "How Sara Coins Work" : "My Membership"}</Link>
        </div>
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Earn <strong>1 coin for every {money(data.rules.spendPerCoinInr)}</strong> in cumulative delivered/completed purchases.
          Small purchases add up: {money(600)} + {money(600)} earns 1 coin, with {money(200)} carried towards the next.
          Cancelled, returned and refunded orders do not count.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-600">Coins earned</p><strong className="text-xl">{data.lifetimeEarned}</strong></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-600">Coins redeemed</p><strong className="text-xl">{data.lifetimeRedeemed}</strong></div>
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-600">Spend towards your next coin</p><strong className="text-xl">{money(data.spendToNextCoin)}</strong></div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-600">1 coin is worth {money(data.rules.pointValueInr)}. Redeem in lots of {data.rules.redemptionStep} coins at checkout, up to {Math.round(data.rules.maxRedemptionRatio * 100)}% of your order. Earned coins expire after {data.rules.pointLifetimeDays} days.</p>
        {data.expiringSoon > 0 && <p className="mt-3 text-sm text-amber-800">{data.expiringSoon} coins expire within 30 days.</p>}
        <div className="mt-6 border-t pt-4"><h2 className="flex items-center gap-2 font-bold text-[#0f2557]"><History size={18} />Coin Activity</h2>
          {data.history.length ? <ul className="mt-3 divide-y">{data.history.slice(0, 10).map(entry => <li key={entry.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <div className="min-w-0"><p className="break-words">{entry.reason}</p><p className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleDateString("en-IN")}</p></div><strong className={entry.points >= 0 ? "text-green-700" : "text-slate-700"}>{entry.points > 0 ? "+" : ""}{entry.points}</strong></li>)}</ul> :
            <p className="mt-3 text-sm text-slate-600">Your coin activity will appear here after eligible purchases. <Link href="/products" className="text-[#1560bd] underline">Start shopping</Link></p>}
        </div>
      </>}
    </div>
  </section>
}
