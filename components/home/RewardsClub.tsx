"use client"

import Link from "next/link"
import { Coins, Sparkles, ArrowRight, Check } from "lucide-react"

/**
 * Sara Rewards Club — announced, not yet live.
 *
 * The Coins engine is scheduled for a later delivery phase, so every claim here is
 * written in future tense and badged "launching soon". Do not switch this to present
 * tense until earning and redemption actually work end to end.
 */
const tiers = [
  {
    name: "Silver",
    badge: "/rewards/tier-silver.svg",
    qualify: "Free to join",
    rate: "2%",
    ring: "ring-slate-200",
    glow: "from-slate-100 to-white",
    perks: ["2% back as Sara Coins", "Birthday bonus Coins", "Early access to sales"],
  },
  {
    name: "Gold",
    badge: "/rewards/tier-gold.svg",
    qualify: "Spend ₹25,000 / year",
    rate: "4%",
    ring: "ring-amber-300",
    glow: "from-amber-50 to-white",
    featured: true,
    perks: ["4% back as Sara Coins", "Free installation & delivery", "Priority support line", "Extended 15-day returns"],
  },
  {
    name: "Platinum",
    badge: "/rewards/tier-platinum.svg",
    qualify: "Spend ₹1,00,000 / year",
    rate: "6%",
    ring: "ring-blue-300",
    glow: "from-blue-50 to-white",
    perks: ["6% back as Sara Coins", "Dedicated relationship manager", "Free extended warranty", "Invites to launch events"],
  },
]

export default function RewardsClub() {
  return (
    <section
      aria-labelledby="rewards-club-heading"
      className="relative overflow-hidden rounded-3xl bg-brand-primary-hover text-white"
    >
      {/* Ambient gold glow + repeating grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ backgroundImage: "url('/patterns/reward-grid.svg')", backgroundSize: "48px 48px" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl"
      />

      <div className="relative grid gap-8 p-6 md:grid-cols-[0.9fr_1.1fr] md:p-9 lg:p-10">
        {/* Pitch */}
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" /> Launching soon
          </span>
          <h2 id="rewards-club-heading" className="mt-3 text-2xl font-extrabold leading-tight md:text-4xl">
            Introducing the <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">Sara Rewards Club</span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/70 md:text-base">
            Our upcoming loyalty programme. You&apos;ll earn <strong className="text-white">Sara Coins</strong>{" "}
            on everything you buy and redeem them against future orders — the more you shop, the higher
            your tier. Planned benefits are shown below.
          </p>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <img src="/rewards/sara-coin.svg" alt="" width={44} height={44} className="h-11 w-11 flex-shrink-0" />
            <p className="text-sm text-white/80">
              Create your account now and you&apos;ll be among the first to join when the programme opens.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-3 text-sm font-bold text-[#3a2606] shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.03]"
            >
              Create a free account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/rewards"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              How it works
            </Link>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl bg-gradient-to-b ${tier.glow} p-4 text-gray-900 ring-1 ${tier.ring} ${
                tier.featured ? "sm:-translate-y-2 shadow-2xl" : "shadow-lg"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                  Most popular
                </span>
              )}
              <img src={tier.badge} alt={`${tier.name} tier`} width={44} height={49} className="mx-auto h-12 w-auto" />
              <p className="mt-2 text-center text-base font-extrabold">{tier.name}</p>
              <p className="text-center text-[11px] font-medium text-gray-500">{tier.qualify}</p>
              <p className="mt-1 text-center text-2xl font-black text-brand-primary">
                {tier.rate}<span className="text-xs font-bold text-gray-500"> back*</span>
              </p>
              <ul className="mt-3 space-y-1.5 border-t border-gray-200/70 pt-3">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-600">
                    <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-brand-success" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex items-center justify-center gap-2 border-t border-white/10 bg-black/20 py-2.5 text-center text-xs text-white/60">
        <Coins className="h-3.5 w-3.5 text-amber-300" />
        *Planned benefits. The Sara Rewards Club is not live yet — tiers, earn rates and final terms
        will be confirmed at launch.
      </div>
    </section>
  )
}
