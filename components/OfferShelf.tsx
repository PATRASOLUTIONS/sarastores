"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Clock, Store } from "lucide-react"
import { analytics } from "@/lib/analytics"
import { formatPrice } from "@/utils/formatPrice"
import {
  OFFER_SECTION_BLURBS,
  OFFER_SECTION_LABELS,
  isOfferLive,
  type OfferSection,
} from "@/lib/offer-sections"

interface Offer {
  id: string
  name: string
  description?: string
  image?: string
  badge?: string
  originalPrice?: number
  offerPrice?: number
  discount?: number
  stock?: number
  active?: boolean
  section?: string
  storeIds?: string[]
  endsAt?: string | null
}

function timeLeft(endsAt: string): string | null {
  const remaining = new Date(endsAt).getTime() - Date.now()
  if (!Number.isFinite(remaining) || remaining <= 0) return null

  const days = Math.floor(remaining / 86_400_000)
  if (days >= 1) return `${days} day${days > 1 ? "s" : ""} left`

  const hours = Math.floor(remaining / 3_600_000)
  if (hours >= 1) return `${hours} hour${hours > 1 ? "s" : ""} left`

  return "Ending soon"
}

/**
 * One merchandising shelf of the offers hub. Hides itself when the section has
 * no live offers, so an empty clearance shelf never ships.
 */
export default function OfferShelf({ section }: { section: OfferSection }) {
  const [offers, setOffers] = useState<Offer[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/offers?section=${encodeURIComponent(section)}&live=true`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.offers)) setOffers(data.offers)
      })
      .catch(() => {
        /* shelf hides itself when empty */
      })
    return () => {
      cancelled = true
    }
  }, [section])

  const live = useMemo(() => offers.filter((offer) => isOfferLive(offer)), [offers])

  if (live.length === 0) return null

  const isStoreExclusive = section === "store-exclusive"

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{OFFER_SECTION_LABELS[section]}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{OFFER_SECTION_BLURBS[section]}</p>
        </div>
        {isStoreExclusive && (
          <Link
            href="/stores"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline"
          >
            <Store className="h-4 w-4" />
            Find a store
          </Link>
        )}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((offer) => {
          const remaining = offer.endsAt ? timeLeft(offer.endsAt) : null
          const hasPrice = !!offer.offerPrice && offer.offerPrice > 0

          return (
            <article
              key={offer.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              onClick={() =>
                analytics.viewOffer({ offerId: offer.id, offerName: offer.name, type: section })
              }
            >
              {offer.image && (
                <div className="relative h-40 w-full bg-gray-50">
                  <Image
                    src={offer.image}
                    alt={offer.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-contain p-3"
                  />
                  {offer.badge && (
                    <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      {offer.badge}
                    </span>
                  )}
                </div>
              )}

              <div className="p-5">
                <h3 className="font-bold text-gray-900">{offer.name}</h3>
                {offer.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{offer.description}</p>
                )}

                {hasPrice && (
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-extrabold text-gray-900">
                      {formatPrice(offer.offerPrice!)}
                    </span>
                    {!!offer.originalPrice && offer.originalPrice > offer.offerPrice! && (
                      <span className="text-sm text-gray-500 line-through">
                        {formatPrice(offer.originalPrice)}
                      </span>
                    )}
                    {!!offer.discount && offer.discount > 0 && (
                      <span className="text-sm font-semibold text-green-600">
                        {offer.discount}% off
                      </span>
                    )}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {remaining && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      {remaining}
                    </span>
                  )}
                  {section === "clearance" && !!offer.stock && offer.stock > 0 && (
                    <span className="font-medium text-gray-600">Only {offer.stock} left</span>
                  )}
                  {isStoreExclusive && (offer.storeIds?.length ?? 0) > 0 && (
                    <span className="font-medium text-gray-600">
                      In {offer.storeIds!.length} store{offer.storeIds!.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
