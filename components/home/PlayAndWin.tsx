"use client"

import Link from "next/link"
import { Gift, Ticket, ArrowRight, Sparkles, Trophy } from "lucide-react"

/**
 * Gamified re-engagement. Both surfaces already exist (/spin, /lucky-draw) — this
 * block turns them into a daily reason to return and a recurring reason to keep
 * buying, which is exactly what a loyalty loop needs.
 */
export default function PlayAndWin() {
  return (
    <section aria-labelledby="play-win-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="play-win-heading" className="text-lg font-bold leading-tight text-brand-text-primary md:text-xl">
            Play &amp; win every day
          </h2>
          <p className="mt-0.5 text-xs text-brand-text-tertiary">Little wins that keep shopping fun</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Spin & Win */}
        <Link
          href="/spin"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary to-indigo-600 p-5 text-white shadow-lg transition-transform hover:-translate-y-0.5 md:p-6"
        >
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 transition-transform group-hover:rotate-12">
              <Gift className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
                <Sparkles className="h-3 w-3" /> Daily spin
              </p>
              <h3 className="mt-0.5 text-lg font-extrabold leading-tight">Spin the Sara Wheel</h3>
              <p className="mt-1 text-sm text-white/80">
                One free spin a day for instant Coins, coupons &amp; surprise freebies.
              </p>
            </div>
          </div>
          <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-bold">
            Spin now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* Monthly Draw */}
        <Link
          href="/lucky-draw"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-accent to-rose-500 p-5 text-white shadow-lg transition-transform hover:-translate-y-0.5 md:p-6"
        >
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 transition-transform group-hover:scale-110">
              <Trophy className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
                <Ticket className="h-3 w-3" /> Every order = 1 entry
              </p>
              <h3 className="mt-0.5 text-lg font-extrabold leading-tight">Monthly Mega Draw</h3>
              <p className="mt-1 text-sm text-white/80">
                Shop this month for a shot at a flagship prize. Winner announced every 1st.
              </p>
            </div>
          </div>
          <span className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-bold">
            See this month&apos;s prize <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </section>
  )
}
