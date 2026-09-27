"use client"

import Link from "next/link"
import { ShieldCheck, CreditCard, Coins, Wrench, RefreshCw } from "lucide-react"

/**
 * The "Sara Advantage" — the five reasons a shopper comes back instead of buying
 * from a marketplace. Retention perks, not generic trust badges: each one is a
 * promise that only pays off on a repeat relationship.
 */
const perks = [
  {
    icon: ShieldCheck,
    title: "100% Genuine",
    subtitle: "Authorised dealer & warranty",
    href: "/products",
  },
  {
    icon: Coins,
    title: "Rewards Club",
    subtitle: "Launching soon — join early",
    href: "/rewards",
  },
  {
    icon: CreditCard,
    title: "No-Cost EMI",
    subtitle: "0% interest on major cards",
    href: "/offers",
  },
  {
    icon: RefreshCw,
    title: "100% Genuine",
    subtitle: "Sourced direct from brands",
    href: "/about",
  },
  {
    icon: Wrench,
    title: "Free Installation",
    subtitle: "Certified engineers, at home",
    href: "/contact",
  },
]

export default function SaraAdvantageBar() {
  return (
    <section aria-label="The Sara Advantage" className="border-y border-brand-border bg-white">
      <div className="section-container py-3 md:py-4">
        <div className="scrollbar-hide -mx-1 flex gap-2.5 overflow-x-auto px-1 md:grid md:grid-cols-5 md:gap-3 md:overflow-visible">
          {perks.map((perk) => (
            <Link
              key={perk.title}
              href={perk.href}
              className="group flex min-w-[220px] flex-shrink-0 items-center gap-3 rounded-xl border border-brand-border bg-brand-surface px-3.5 py-2.5 transition-all hover:border-brand-primary/40 hover:bg-brand-primary-subtle hover:shadow-sm md:min-w-0"
            >
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-brand-primary-light text-brand-primary transition-transform group-hover:scale-110">
                <perk.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-brand-text-primary">
                  {perk.title}
                </span>
                <span className="block truncate text-[11px] leading-tight text-brand-text-tertiary">
                  {perk.subtitle}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
