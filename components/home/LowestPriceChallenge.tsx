"use client"

import Link from "next/link"
import { ShieldCheck, Search, IndianRupee, Gift, ArrowRight } from "lucide-react"

const steps = [
  { icon: Search, title: "Spot a lower price", text: "Any authorised seller, in-store or online, on an identical in-stock model." },
  { icon: IndianRupee, title: "We beat it", text: "Show us within 7 days of buying and we match the lower price straight away." },
  { icon: Gift, title: "Get 3× the gap in Coins", text: "We also credit 3× the difference as Sara Coins for your next purchase." },
]

export default function LowestPriceChallenge() {
  return (
    <section
      id="lowest-price"
      aria-labelledby="lowest-price-heading"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white"
    >
      <div className="grid gap-6 p-6 md:grid-cols-[0.85fr_1.15fr] md:items-center md:p-9">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Lowest Price Challenge
          </span>
          <h2 id="lowest-price-heading" className="mt-3 text-2xl font-extrabold leading-tight text-gray-900 md:text-3xl">
            Found it cheaper? <br className="hidden md:block" />
            <span className="text-emerald-600">We beat it — and pay you 3× the difference.</span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-gray-600">
            Shop with total confidence. You will never overpay at Sara, and if you ever spot a better deal,
            you walk away with more than you lost — as Sara Coins to spend again.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-transform hover:scale-[1.03]"
          >
            Claim a price match <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
            >
              <span className="absolute right-3 top-3 text-4xl font-black text-emerald-100">{i + 1}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <step.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-gray-900">{step.title}</p>
              <p className="mt-1 text-xs leading-snug text-gray-500">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
