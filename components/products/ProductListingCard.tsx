"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Check, Heart, Star } from "lucide-react"
import { toast } from "react-hot-toast"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { formatProductCardName, toastProductName } from "@/utils/cleanProductName"
import CompareProductButton from "@/components/CompareProductButton"
import type { CatalogProduct } from "@/utils/catalog"
import { isProductUnavailable } from "@/lib/product-availability"
import {
  calculateDiscount,
  emiPerMonth,
  getEffectiveMRP,
  getRatingInfo,
  getCatalogMRP,
  getCatalogRatingInfo,
  productBadge,
  productBenefits,
  type ProductDisplayInput,
} from "@/lib/product-display"

const BADGE_TONE = {
  sale: "bg-[#E11D2E] text-white",
  new: "bg-[#0F8A3C] text-white",
  best: "bg-[#0F8A3C] text-white",
} as const

function getKeyFeatures(product: Record<string, unknown>): string[] {
  const candidates = [product.features, product.highlights, product.characteristics]
  const features = candidates.flatMap(value =>
    Array.isArray(value)
      ? value.filter(item => typeof item === "string" || typeof item === "number")
      : typeof value === "string" ? value.split(/\r?\n|\s*[•|]\s*/) : [],
  )

  if (features.length === 0 && product.technical_details && typeof product.technical_details === "object") {
    features.push(...Object.values(product.technical_details as Record<string, unknown>)
      .filter(value => typeof value === "string" || typeof value === "number"))
  }

  return [...new Set(features.map(value => String(value).trim()).filter(value => value.length > 2))].slice(0, 5)
}

function Stars({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rated ${rating} out of 5`}>
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, rating - i))
          return (
            <span key={i} className="relative inline-block h-3 w-3">
              <Star className="absolute inset-0 h-3 w-3 text-gray-300" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </span>
            </span>
          )
        })}
      </div>
      <span className="text-[11px] font-semibold text-gray-700">{rating.toFixed(1)}</span>
      {count > 0 && (
        <span className="text-[11px] text-gray-400">
          ({count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count})
        </span>
      )}
    </div>
  )
}

export default function ProductListingCard({ product, offersMode = false, offerLabels = [], layout = "grid" }: {
  product: CatalogProduct & ProductDisplayInput
  offersMode?: boolean
  offerLabels?: string[]
  layout?: "grid" | "list"
}) {
  const router = useRouter()
  const { addToCart } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const [adding, setAdding] = useState(false)

  const id = String(product.id)
  const href = `/product/${product.slug || product.id}`
  const image =
    (product.image && String(product.image)) ||
    (Array.isArray(product.images) && product.images[0]) ||
    "/placeholder.svg"

  const mrp = offersMode ? getCatalogMRP(product) : getEffectiveMRP(product)
  const unavailable = isProductUnavailable(product) || !(Number(product.stock) > 0)
  const discount = unavailable ? 0 : calculateDiscount(mrp, product.price)
  const badge = unavailable ? null : offersMode ? (discount > 0 ? { label: `${discount}% OFF`, tone: "sale" as const } : null) : productBadge(product)
  const rating = offersMode ? getCatalogRatingInfo(product) : getRatingInfo(product)
  const benefits = offersMode ? offerLabels.slice(0, 2) : productBenefits(product)
  const stock = typeof product.stock === "number" && Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0
  const stockLabel = unavailable ? "Currently unavailable" : `${stock.toLocaleString("en-IN")} in stock`
  const wishlisted = isInWishlist(id)
  const displayName = formatProductCardName(product.name)
  const keyFeatures = getKeyFeatures(product)

  const handleAddToCart = async () => {
    if (adding || unavailable) return
    setAdding(true)
    try {
      const added = await addToCart({
        id,
        name: product.name,
        price: product.price,
        image,
        quantity: 1,
        stock,
        color: null,
        size: null,
      })
      if (added) toast.success(`${toastProductName(product.name)} added to cart`)
    } finally {
      setTimeout(() => setAdding(false), 400)
    }
  }

  if (layout === "list") {
    return (
      <article
        role="link"
        tabIndex={0}
        onClick={event => {
          if ((event.target as HTMLElement).closest("a, button, input")) return
          router.push(href)
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            router.push(href)
          }
        }}
        className="group grid cursor-pointer grid-cols-[130px_minmax(0,1fr)] gap-5 border-b border-gray-200 bg-white px-3 py-5 transition-shadow hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:grid-cols-[180px_minmax(0,1fr)_170px]"
      >
        <div>
          <Link href={href} className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-white">
            {badge && (
              <span className={`absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-bold ${BADGE_TONE[badge.tone]}`}>
                {badge.label}
              </span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={displayName} loading="lazy" className="h-full w-full scale-[1.08] object-contain" onError={(e) => { e.currentTarget.src = "/placeholder.svg" }} />
          </Link>
          <div className="mt-2">
            <CompareProductButton productId={id} name={displayName} variant="checkbox" />
          </div>
        </div>
        <div className="min-w-0 py-0.5">
          <div className="flex items-start gap-2">
            <Link href={href} className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug text-[#1560BD] group-hover:underline">{displayName}</h3>
            </Link>
            <button
              type="button"
              onClick={() => (wishlisted ? removeFromWishlist(id) : addToWishlist(id))}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className="shrink-0 p-1 text-gray-300 hover:text-[#E11D2E]"
            >
              <Heart className={`h-4 w-4 ${wishlisted ? "fill-[#E11D2E] text-[#E11D2E]" : ""}`} />
            </button>
          </div>
          {(!offersMode || rating.count > 0) && (
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-sm bg-[#388e3c] px-1.5 py-0.5 font-semibold text-white">
                {rating.rating.toFixed(1)}
                <Star className="h-2.5 w-2.5 fill-white text-white" />
              </span>
              {rating.count > 0 && (
                <span className="font-medium text-gray-500">{rating.count.toLocaleString("en-IN")} Ratings &amp; Reviews</span>
              )}
            </div>
          )}
          {keyFeatures.length > 0 && (
            <ul className="mt-3 space-y-1">
              {keyFeatures.map(feature => (
                <li key={feature} className="flex min-w-0 items-start gap-2 text-[13px] leading-5 text-gray-700">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                  <span className="min-w-0 truncate" title={feature}>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-span-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-gray-100 pt-3 sm:col-span-1 sm:block sm:border-0 sm:pt-0.5">
          {!unavailable && <span className="text-xl font-bold text-gray-900">₹{Number(product.price).toLocaleString("en-IN")}</span>}
          {discount > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500 line-through">₹{mrp.toLocaleString("en-IN")}</span>
              <span className="font-semibold text-green-700">{discount}% off</span>
            </div>
          )}
          {offerLabels.length > 0 && <p className="mt-2 text-xs font-semibold text-green-700">Bank Offer</p>}
          <p className={`mt-2 text-xs font-semibold ${stock > 0 ? "text-green-700" : "text-red-700"}`}>{stockLabel}</p>
        </div>
      </article>
    )
  }

  return (
    <article className="group flex h-full flex-col rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative">
        {badge && (
          <span
            className={`absolute left-2 top-2 z-10 rounded px-2 py-0.5 text-[11px] font-bold ${BADGE_TONE[badge.tone]}`}
          >
            {badge.label}
          </span>
        )}

        <button
          type="button"
          onClick={() => (wishlisted ? removeFromWishlist(id) : addToWishlist(id))}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-400 shadow-sm transition-colors hover:text-[#E11D2E]"
        >
          <Heart className={`h-4 w-4 ${wishlisted ? "fill-[#E11D2E] text-[#E11D2E]" : ""}`} />
        </button>

        <Link href={href} className="block">
          <div className={`flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-lg p-2 ${offersMode ? "bg-white" : "bg-gray-50"}`}>
            {/* Catalogue images are hotlinked from many CDNs, so a plain img avoids loader failures. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={displayName}
              loading="lazy"
              className="h-full w-full scale-[1.05] object-contain transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
          </div>
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <Link href={href}>
          <h3 className="line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-[1.35] text-gray-900 transition-colors group-hover:text-[#1560BD]">
            {displayName}
          </h3>
        </Link>

        {(!offersMode || rating.count > 0) && <div className="mt-1.5">
          <Stars rating={rating.rating} count={rating.count} />
        </div>}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          {!unavailable && <span className="text-base font-bold text-gray-900">₹{Number(product.price).toLocaleString("en-IN")}</span>}
          {discount > 0 && (
            <span className="text-xs text-gray-600 line-through">₹{mrp.toLocaleString("en-IN")}</span>
          )}
        </div>

        {offersMode && discount > 0 && (
          <p className="mt-1"><span className="inline-block rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">Save ₹{(mrp - Number(product.price)).toLocaleString("en-IN")}</span></p>
        )}

        {!unavailable && !offersMode && product.price >= 5000 && (
          <p className="mt-1 text-[11px] text-gray-500">
            EMI from ₹{emiPerMonth(product.price).toLocaleString("en-IN")}/month
          </p>
        )}

        <p className={`mt-2 text-xs font-semibold ${stock > 0 ? "text-green-700" : "text-red-700"}`}>{stockLabel}</p>
        <ul className={`mt-2 space-y-1 ${offersMode ? "flex-1" : ""}`}>
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-1.5 text-[11px] leading-tight text-gray-600">
              <Check className="mt-[1px] h-3 w-3 flex-shrink-0 rounded-full bg-[#0F8A3C] p-[1px] text-white" />
              {benefit}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={adding || unavailable}
          className="mt-3 h-9 w-full rounded-md border border-[#1560BD] text-[13px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white disabled:opacity-60"
        >
          {unavailable ? "Unavailable" : adding ? "Adding…" : "Add to Cart"}
        </button>
        <CompareProductButton productId={id} name={displayName} />
      </div>
    </article>
  )
}
