"use client"

import React from "react"
import useSWR from "swr"
import { cleanProductName } from "@/utils/cleanProductName"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Heart, Star, Shield } from "lucide-react"
import CompareProductButton from "@/components/CompareProductButton"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/hooks/useCart"
import { toast } from "react-hot-toast"
import { formatPrice } from "@/utils/formatPrice"
import { getCatalogMRP } from "@/lib/product-display"
import { productImageUrls } from "@/lib/product-images"
import type { ProductCardResponse } from "@/lib/product-card-response"
import { z } from "zod"
import { EmiFromBadge } from "@/components/EmiCalculator"
import { motion } from 'framer-motion'

function extractUrlsFromTechnicalDetailsObj(technicalDetails?: Record<string, unknown> | null): string[] {
  if (!technicalDetails) return []
  const keys = ["URL", "Url", "url", "From Manufacturer URL", "Manufacturer URL"]
  for (const key of keys) {
    const v = technicalDetails[key]
    if (Array.isArray(v)) {
      const urls = v.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      if (urls.length) return urls
    }
    if (typeof v === "string" && v.includes("http")) {
      const urls = (v.match(/https?:\/\/[^\s",]+/g) || []).filter((s) => s.startsWith("http"))
      if (urls.length) return urls
    }
  }
  for (const [, value] of Object.entries(technicalDetails)) {
    if (typeof value === "string" && value.includes("http")) {
      const urls = (value.match(/https?:\/\/[^\s",]+/g) || []).filter((s) => s.startsWith("http"))
      if (urls.length) return urls
    }
  }
  return []
}

function extractSpecTitle(input?: unknown): string | undefined {
  if (!input) return undefined
  if (typeof input === "string" && input.trim()) return input.trim()
  if (Array.isArray(input)) {
    const first = input.find((s) => typeof s === "string" && s.trim())
    if (first) return String(first).trim()
  }
  return undefined
}

interface CategoryProductCardProps {
  product: ProductCardResponse
}

const wishlistResponseSchema = z.object({ items: z.array(z.object({ id: z.string() })) })

export default function CategoryProductCard({ product }: CategoryProductCardProps) {
  const productId = product.id
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isWishlistLoading, setIsWishlistLoading] = useState(false)
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { addToCart } = useCart()

  const handleAddToCart = async () => {
    if (!product) return

    setIsAdding(true)

    const cartItem = {
      id: productId || product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      color: null,
      size: null,
    }

    const added = await addToCart(cartItem)
    if (added) toast.success(`${product.name} added to cart!`)

    // reset adding state after small delay for UX
    setTimeout(() => setIsAdding(false), 800)
  }

  // Deduplicated wishlist check — SWR shares the request across all card instances
  const wishlistFetcher = async (url: string) => {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error("Wishlist could not be loaded")
    return wishlistResponseSchema.parse(await response.json())
  }
  const { data: wishlistData, error: wishlistError } = useSWR(
    user ? "/api/wishlist" : null,
    wishlistFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )
  React.useEffect(() => {
    if (!wishlistData) return
    const found = wishlistData.items.some((p) => p.id === productId)
    setIsWishlisted(found)
  }, [wishlistData, productId, product.id])
  React.useEffect(() => {
    if (wishlistError) console.error("Wishlist could not be loaded", wishlistError)
  }, [wishlistError])

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast.error("Please login to add items to wishlist")
      router.push(`/login?redirect=/product/${product.slug || productId || product.id}`)
      return
    }

    // If already wishlisted, remove; otherwise add
    setIsWishlistLoading(true)
    try {
      if (!isWishlisted) {
        const res = await fetch(`/api/wishlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, productId: productId || product.id }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.added) {
          setIsWishlisted(true)
          toast.success('Added to wishlist')
        } else if (json.message) {
          toast.error(json.message)
        } else {
          toast.error('Failed to add to wishlist')
        }
      } else {
        const url = `/api/wishlist?userId=${encodeURIComponent(user.id)}&productId=${encodeURIComponent(productId || product.id)}`
        const res = await fetch(url, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.removed) {
          setIsWishlisted(false)
          toast.success('Removed from wishlist')
        } else if (json.message) {
          toast.error(json.message)
        } else {
          toast.error('Failed to remove from wishlist')
        }
      }
    } catch (err) {
      console.error('Wishlist error', err)
      toast.error('Wishlist request failed')
    } finally {
      setIsWishlistLoading(false)
    }
  }

  const effectiveOriginalPrice = getCatalogMRP(product)

  // Derived from the resolved MRP so the badge can never contradict the prices shown.
  const discount =
    effectiveOriginalPrice > product.price
      ? Math.round(((effectiveOriginalPrice - product.price) / effectiveOriginalPrice) * 100)
      : 0

  // Use product.technical_details directly — no per-card API fetch needed
  let firstSpecImage: string | undefined
  let specImages: string[] = []

  const technicalDetails = product.technical_details

  const displayTitle = cleanProductName(
    extractSpecTitle(technicalDetails?.Title) ||
    product.name
  )

  const urlsFromTD = extractUrlsFromTechnicalDetailsObj(technicalDetails)
  if (urlsFromTD.length > 0) {
    firstSpecImage = urlsFromTD[0]
    specImages = urlsFromTD.slice(0, 5)
  } else {
    const firstImageFromTD =
      typeof technicalDetails?.["First Image"] === "string" ? technicalDetails["First Image"] : null
    if (firstImageFromTD) {
      firstSpecImage = firstImageFromTD
      specImages = [firstImageFromTD]
    } else {
      const specImgs = productImageUrls(product.specification_images)
      if (specImgs.length > 0) {
        firstSpecImage = specImgs[0]
        specImages = specImgs.slice(0, 5)
      }
    }
  }

  const displayImage = firstSpecImage || product.image || "/modern-tech-product.png"

  return (
    <Link href={`/product/${product.slug || productId || product.id}`} className="group">
      <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] relative border border-transparent hover:border-gray-100">
        {/* Show up to 5 specification images as a gallery if available */}
        {/* {specImages.length > 0 && (
          <div className="flex gap-2 px-2 pt-2 pb-1 overflow-x-auto">
            {specImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={displayTitle + " spec image " + (idx + 1)}
                className="h-14 w-14 object-contain rounded border bg-white"
                loading="lazy"
              />
            ))}
          </div>
        )} */}

        {/* Image */}
        <div className="relative h-40 sm:h-44 md:h-52 overflow-hidden bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
          <div className="absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5">
            {discount > 0 && (
              <span className="bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                {discount}% OFF
              </span>
            )}
            {product.trusted && (
              <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span className="text-xs font-bold">Trusted</span>
              </span>
            )}
          </div>

          <div className="absolute inset-2 sm:inset-3 md:inset-4 rounded-xl bg-white overflow-hidden shadow-inner flex items-center justify-center">
            <img
              src={displayImage || "/placeholder.svg"}
              alt={displayTitle}
              className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
              onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
            />
          </div>

          {/* Quick Add to cart (prevents link navigation) */}
          {/* <button
            onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // call handleAddToCart below
                handleAddToCart()
              }}
            className="absolute right-3 bottom-3 bg-white/95 hover:bg-white text-gray-800 rounded-lg p-2 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Add to cart"
          >
            {isAdding ? (
              <svg className="animate-spin h-4 w-4 text-gray-700" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button> */}
        </div>

        <div className="p-4">
          <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug">{displayTitle}</h3>



          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-lg sm:text-xl font-extrabold text-gray-900">{formatPrice(product.price)}</span>
                {discount > 0 && <span className="text-sm text-gray-600 line-through">{formatPrice(effectiveOriginalPrice)}</span>}
              </div>
              {discount > 0 && <span className="text-sm text-green-700 font-semibold">Save {formatPrice(effectiveOriginalPrice - product.price)}</span>}
              <div className="mt-0.5">
                <EmiFromBadge price={product.price} />
              </div>
            </div>
            <div className="ml-3 flex items-center">
              {/* <div className="bg-yellow-100 text-yellow-800 text-sm font-semibold px-2 py-1 rounded">{discount}%</div> */}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <CompareProductButton productId={productId} name={displayTitle} />
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAddToCart()
              }}
              className="w-full border border-brand-accent bg-white text-orange-700 py-2.5 rounded-xl font-semibold hover:bg-orange-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200"
              aria-label="Add to cart"
            >
              {isAdding ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span>Add to cart</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  router.push(`/product/${product.slug || productId || product.id}`)
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-brand-primary-subtle hover:border-brand-primary/40 hover:text-brand-primary hover:shadow-sm active:scale-95 transition-all duration-200 ease-in-out font-medium text-sm"
                aria-label="View details"
              >
                View
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleWishlist(e)
                }}
                className={`w-12 h-11 rounded-xl flex items-center justify-center
    hover:shadow-md active:scale-90 transition-all duration-200
    disabled:opacity-60 disabled:cursor-not-allowed
    ${isWishlisted
                    ? 'bg-red-500 hover:bg-red-600 border border-red-500'
                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                disabled={isWishlistLoading}
              >
                {isWishlistLoading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <Heart
                    className={`h-5 w-5 transition-all duration-200 ${isWishlisted
                      ? 'text-white fill-white scale-110'
                      : 'text-gray-700 hover:text-red-500'
                      }`}
                  />
                )}
              </button>

            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
