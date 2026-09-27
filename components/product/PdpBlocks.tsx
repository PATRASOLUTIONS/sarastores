"use client"

import Link from "next/link"
import { ArrowRight, Check, Star } from "lucide-react"
import { bannerGradient, type SiteBanner } from "@/hooks/useBanners"

/** Bank / accessory / EMI offer cards under the hero — all admin managed. */
export function OfferCards({ offers }: { offers: SiteBanner[] }) {
  if (offers.length === 0) return null

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Offers on this product">
      {offers.slice(0, 5).map((offer) => (
        <article key={offer.id} className="rounded-lg border border-gray-200 bg-white p-3.5">
          <div className="flex h-7 items-center">
            {offer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.image} alt="" aria-hidden className="h-6 w-auto max-w-[96px] object-contain" />
            ) : (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white"
                style={{ backgroundColor: offer.accent || "#1560BD" }}
              >
                {offer.script || "Offer"}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] font-bold leading-tight text-gray-900">{offer.title}</p>
          {offer.subtitle && <p className="mt-0.5 text-[11px] leading-tight text-gray-500">{offer.subtitle}</p>}
          {offer.ctaText && (
            <Link
              href={offer.ctaLink || "/offers"}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1560BD] hover:underline"
            >
              {offer.ctaText}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </article>
      ))}
    </section>
  )
}

/** Brand / service cards in the right rail of the overview section. */
export function RailCards({ cards }: { cards: SiteBanner[] }) {
  if (cards.length === 0) return null

  return (
    <div className="space-y-4">
      {cards.slice(0, 3).map((card) => {
        const light = !card.dark
        return (
          <article
            key={card.id}
            className="overflow-hidden rounded-xl p-5"
            style={bannerGradient(card)}
          >
            {card.script && (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  light ? "bg-white/20 text-white" : "bg-white text-slate-900"
                }`}
              >
                {card.script}
              </span>
            )}
            <h3 className={`mt-3 font-heading text-base font-bold ${light ? "text-white" : "text-slate-900"}`}>
              {card.title}
            </h3>
            {card.subtitle && (
              <p className={`mt-1.5 text-[12px] leading-relaxed ${light ? "text-white/80" : "text-slate-600"}`}>
                {card.subtitle}
              </p>
            )}
            {card.ctaText && (
              <Link
                href={card.ctaLink || "/stores"}
                className={`mt-4 inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-semibold ${
                  light ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                }`}
              >
                {card.ctaText}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </article>
        )
      })}
    </div>
  )
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center" aria-label={`Rated ${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-gray-300" size={size} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-amber-400 text-amber-400" size={size} />
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** Rating summary with the 5→1 star distribution bars. */
export function ReviewSummary({
  average,
  count,
  distribution,
}: {
  average: number
  count: number
  distribution: number[]
}) {
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
      <div className="text-center md:text-left">
        <p className="font-heading text-4xl font-bold text-[#0F8A3C]">{average.toFixed(1)}</p>
        <p className="mt-1 text-[13px] text-gray-500">out of 5</p>
        <div className="mt-2 flex justify-center md:justify-start">
          <Stars rating={average} size={16} />
        </div>
        <p className="mt-2 text-[12px] text-gray-500">Based on {count.toLocaleString("en-IN")} reviews</p>
        <Link
          href="/contact"
          className="mt-4 inline-flex rounded-md bg-[#1560BD] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0D4C99]"
        >
          Write a Review
        </Link>
      </div>

      <ul className="space-y-2 self-center">
        {distribution.map((pct, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="w-8 flex-shrink-0 text-[12px] text-gray-600">{5 - i}★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
            </span>
            <span className="w-10 flex-shrink-0 text-right text-[12px] text-gray-500">{pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FeatureTiles({ items }: { items: { title: string; detail: string }[] }) {
  if (items.length === 0) return null

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.slice(0, 5).map(({ title, detail }) => (
        <li key={title} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-[#1560BD]">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <p className="mt-3 text-[12px] font-bold leading-tight text-gray-900">{title}</p>
          <p className="mt-1 text-[11px] leading-tight text-gray-500">{detail}</p>
        </li>
      ))}
    </ul>
  )
}
