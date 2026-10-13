"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Heart, Star } from "lucide-react"
import { toast } from "react-hot-toast"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { cleanProductName } from "@/utils/cleanProductName"
import CompareProductButton from "@/components/CompareProductButton"
import type { CatalogProduct } from "@/utils/catalog"
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

export default function ProductListingCard({ product, offersMode = false, offerLabels = [] }: {
  product: CatalogProduct & ProductDisplayInput; offersMode?: boolean; offerLabels?: string[]
}) {
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
  const discount = calculateDiscount(mrp, product.price)
  const badge = offersMode ? (discount > 0 ? { label: `${discount}% OFF`, tone: "sale" as const } : null) : productBadge(product)
  const rating = offersMode ? getCatalogRatingInfo(product) : getRatingInfo(product)
  const benefits = offersMode ? offerLabels.slice(0, 2) : productBenefits(product)
  const unavailable = offersMode && (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0 ||
    (typeof product.stock === "number" && product.stock <= 0))
  const wishlisted = isInWishlist(id)

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
        ...(offersMode ? { stock: product.stock } : {}),
        color: null,
        size: null,
      })
      if (added) toast.success(`${cleanProductName(product.name)} added to cart`)
    } finally {
      setTimeout(() => setAdding(false), 400)
    }
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
          <div className={`flex items-center justify-center overflow-hidden rounded-t-lg p-3 ${offersMode ? "aspect-[4/3] bg-white" : "aspect-[4/3] bg-gray-50"}`}>
            {/* Catalogue images are hotlinked from many CDNs, so a plain img avoids loader failures. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={cleanProductName(product.name)}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
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
            {cleanProductName(product.name)}
          </h3>
        </Link>

        {(!offersMode || rating.count > 0) && <div className="mt-1.5">
          <Stars rating={rating.rating} count={rating.count} />
        </div>}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-gray-900">₹{Number(product.price).toLocaleString("en-IN")}</span>
          {discount > 0 && (
            <span className="text-xs text-gray-600 line-through">₹{mrp.toLocaleString("en-IN")}</span>
          )}
        </div>

        {offersMode && discount > 0 && (
          <p className="mt-1"><span className="inline-block rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">Save ₹{(mrp - Number(product.price)).toLocaleString("en-IN")}</span></p>
        )}

        {!offersMode && product.price >= 5000 && (
          <p className="mt-1 text-[11px] text-gray-500">
            EMI from ₹{emiPerMonth(product.price).toLocaleString("en-IN")}/month
          </p>
        )}

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
        <CompareProductButton productId={id} name={cleanProductName(product.name)} />
      </div>
    </article>
  )
}
