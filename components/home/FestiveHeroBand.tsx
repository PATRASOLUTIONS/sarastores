"use client"

import Link from "next/link"
import { ArrowRight, BadgeCheck, CreditCard, MapPin, RefreshCw, Truck } from "lucide-react"

/**
 * Commercial band beneath the hero slideshow.
 *
 * The slideshow carries artwork; this carries the actual proposition — why buy
 * here rather than from a marketplace. Every colour resolves from the active
 * theme, so it repaints for Diwali, Holi or a mega sale without a code change.
 */

const PROPOSITIONS = [
  { icon: CreditCard, title: "No-cost EMI", detail: "On cards, debit cards & cardless" },
  { icon: RefreshCw, title: "Free installation", detail: "By our own certified engineers" },
  { icon: MapPin, title: "Pick up in store", detail: "85+ stores across Karnataka" },
  { icon: Truck, title: "Free delivery", detail: "With installation by our engineers" },
  { icon: BadgeCheck, title: "100% genuine", detail: "Brand-authorised, full warranty" },
]

const QUICK_LINKS = [
  { label: "Televisions", href: "/products?q=television" },
  { label: "Refrigerators", href: "/products?q=refrigerator" },
  { label: "Washing Machines", href: "/products?q=washing%20machine" },
  { label: "Air Conditioners", href: "/products?q=air%20conditioner" },
  { label: "Mobiles", href: "/products?q=mobile" },
  { label: "Laptops", href: "/products?q=laptop" },
]

export default function FestiveHeroBand() {
  return (
    <section className="relative overflow-hidden themed-hero themed-glow themed-pattern">
      <span aria-hidden="true" className="themed-toran" />
      <div className="section-container relative z-10 themed-band">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-sm">
              Sara Electronics
            </span>

            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight md:text-5xl">
              Electronics you can{" "}
              <span className="themed-text-gradient">see, touch and take home</span> today
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
              Buy online at competitive prices, or collect from the store down the road. Brand
              warranty, no-cost EMI and installation — handled by our own people, not a
              marketplace seller.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] hover:bg-brand-accent-hover"
              >
                Shop all products
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Today&apos;s offers
              </Link>
              <Link
                href="/stores"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <MapPin className="h-4 w-4" />
                Find a store
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap gap-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-block rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-white/50 hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {PROPOSITIONS.map(({ icon: Icon, title, detail }) => (
              <li
                key={title}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                <Icon className="h-5 w-5 text-white" />
                <p className="mt-2.5 text-sm font-bold text-white">{title}</p>
                <p className="mt-0.5 text-xs leading-snug text-white/70">{detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
