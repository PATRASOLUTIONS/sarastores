"use client"

import Link from "next/link"
import { formatPrice } from "@/utils/formatPrice"
import { ArrowRight, Truck, ShieldCheck, BadgeIndianRupee } from "lucide-react"

/**
 * Product spotlight placed between rails, mirroring the promo banners that break
 * up long listing pages on larger storefronts.
 */
export default function SpotlightBanner({ product }: { product: any }) {
  if (!product) return null

  const price = Number(product.price) || 0
  const mrp = Number(product.mrp) || 0
  const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0
  const href = product.slug ? `/product/${product.slug}` : `/product/${product.id}`

  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-brand-primary/80 text-white">
      <div className="flex flex-col items-center gap-6 p-5 sm:flex-row md:p-8">
        <div className="relative flex-shrink-0">
          <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-white p-3 md:h-44 md:w-44">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-contain"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = "/placeholder.svg"
              }}
            />
          </div>
          {off > 0 && (
            <span className="absolute -right-2 -top-2 grid h-14 w-14 place-items-center rounded-full bg-brand-accent text-center text-xs font-extrabold leading-tight shadow-lg">
              {off}%
              <br />
              OFF
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-accent">
            Deal spotlight
          </p>
          <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-snug md:text-2xl">
            {product.name}
          </h3>

          <div className="mt-2 flex items-baseline justify-center gap-3 sm:justify-start">
            <span className="text-2xl font-extrabold">{formatPrice(price)}</span>
            {mrp > price && (
              <span className="text-sm text-white/60 line-through">{formatPrice(mrp)}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-white/80 sm:justify-start">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Free delivery
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Brand warranty
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeIndianRupee className="h-3.5 w-3.5" /> Best price
            </span>
          </div>
        </div>

        <Link
          href={href}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-brand-accent px-6 py-3 text-sm font-bold shadow-lg transition-transform hover:scale-105"
        >
          Grab this deal <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
