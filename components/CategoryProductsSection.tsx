"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import CategoryProductCard from "./CategoryProductCard"
import { Reveal } from '@/components/motion/AnimationComponents'
import { fetchWithCache, revalidateCache, getCached } from '@/utils/cache'

interface Product {
  id: string
  slug?: string
  name: string
  description?: string
  price: number
  image: string
  stock?: number
  category?: string
  rating?: number
  reviews?: number
  discount?: number
  originalPrice?: number
}

interface CategoryProductsSectionProps {
  categoryId: string
  categoryName: string
  subtitle?: string
  limit?: number
  products?: Product[]
  /** Pre-fetched products from parent — avoids duplicate network call */
  prefetchedProducts?: Product[]
}

const PRODUCTS_TTL = 5 * 60 * 1000

/** Category names are admin-entered and often arrive as "WASHING MACHINE" or "AIR COnditioner". */
const ACRONYMS = new Set(["TV", "AC", "LED", "OLED", "QLED", "UHD", "HD", "USB", "PC"])

function toTitleCase(value: string) {
  if (!value) return value
  return value.toLowerCase().replace(/\b[a-z]+\b/g, (word) => {
    const upper = word.toUpperCase()
    return ACRONYMS.has(upper) ? upper : word.charAt(0).toUpperCase() + word.slice(1)
  })
}

export default function CategoryProductsSection({
  categoryId,
  categoryName,
  subtitle = "Get Up To 12.5% Instant Bank Discount*",
  limit = 10,
  products: productsProp,
  prefetchedProducts,
}: CategoryProductsSectionProps) {
  const [products, setProducts] = useState<Product[]>(() => {
    // Initialize from prefetched data or in-memory cache for instant render
    if (prefetchedProducts && prefetchedProducts.length > 0) return prefetchedProducts
    if (productsProp && Array.isArray(productsProp) && productsProp.length > 0) return productsProp
    // Check in-memory cache synchronously for instant render
    if (categoryId) {
      const cached = getCached<Product[]>(`cat-products-${categoryId}`, PRODUCTS_TTL)
      if (cached && cached.length > 0) return cached
    }
    return []
  })
  const [isLoading, setIsLoading] = useState(() => {
    // If we have data already, skip loading state entirely
    if (prefetchedProducts && prefetchedProducts.length > 0) return false
    if (productsProp && Array.isArray(productsProp) && productsProp.length > 0) return false
    if (categoryId) {
      const cached = getCached<Product[]>(`cat-products-${categoryId}`, PRODUCTS_TTL)
      if (cached && cached.length > 0) return false
    }
    return true
  })
  const [error, setError] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // If parent provided products, use them directly
    if (productsProp && Array.isArray(productsProp)) {
      if (productsProp.length > 0) {
        setProducts(productsProp)
        setIsLoading(false)
      }
      return
    }

    if (prefetchedProducts && prefetchedProducts.length > 0) {
      setProducts(prefetchedProducts)
      setIsLoading(false)
      return
    }

    if (!categoryId) return

    // Fetch with cache (will use IndexedDB/stale data if available)
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, productsProp, prefetchedProducts])

  const fetchProducts = async () => {
    const cacheKey = `cat-products-${categoryId}`

    try {
      const data = await fetchWithCache<Product[]>(
        cacheKey,
        async () => {
          const response = await fetch(`/api/products?category=${categoryId}&limit=${limit}`)
          if (!response.ok) throw new Error("Failed to fetch products")
          return response.json()
        },
        PRODUCTS_TTL
      )
      setProducts(data)
      setIsLoading(false)

      // Background revalidate for freshness
      revalidateCache(cacheKey, async () => {
        const response = await fetch(`/api/products?category=${categoryId}&limit=${limit}`)
        if (!response.ok) throw new Error("Failed to fetch products")
        return response.json()
      }, PRODUCTS_TTL)
    } catch (err) {
      console.error("Error fetching products:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setIsLoading(false)
    }
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320 // Width of one card plus gap
      const newScrollPosition =
        scrollContainerRef.current.scrollLeft + (direction === "left" ? -scrollAmount : scrollAmount)
      scrollContainerRef.current.scrollTo({
        left: newScrollPosition,
        behavior: "smooth",
      })
    }
  }

  // Build a safe slug for category links. Fallback to categoryId when categoryName is not present.
  const categorySlug = encodeURIComponent(
    (typeof categoryName === "string" && categoryName.trim().length > 0)
      ? categoryName.replace(/\s+/g, "-").toLowerCase()
      : categoryId
  )

  if (isLoading) {
    return (
      <section className="py-3 bg-gradient-to-br from-brand-primary-subtle to-white rounded-2xl" style={{ minHeight: '420px' }}>
        <div className="section-container">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="h-8 bg-gray-300 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
            </div>
            <div className="h-10 bg-gray-300 rounded w-24 animate-pulse"></div>
          </div>

          {/* Products Skeleton — matches actual card dimensions */}
          <div className="flex gap-6 overflow-hidden pb-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex-shrink-0 w-[260px] sm:w-[280px] lg:w-[300px]">
                <div className="bg-white rounded-lg shadow-md p-4 animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (error || products.length === 0) {
    return null // Don't show section if no products
  }

  return (
    <section className="relative py-6 bg-gradient-to-br from-brand-primary-subtle to-white rounded-2xl overflow-hidden">
      {/* subtle decorative shapes */}
      <div className="hidden sm:block absolute -right-16 -top-10 w-72 h-72 bg-gradient-to-br from-blue-100 to-brand-primary-light opacity-40 blur-3xl pointer-events-none"></div>
      <div className="hidden sm:block absolute -left-16 -bottom-10 w-56 h-56 bg-gradient-to-br from-blue-50 to-brand-primary-subtle opacity-30 blur-3xl pointer-events-none"></div>

      <div className="section-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-brand-primary-light shadow-sm text-sm font-semibold text-brand-primary">Featured</div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-gray-900 md:text-xl">Best in {toTitleCase(categoryName)}</h2>
              <p className="mt-0.5 max-w-xl text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/category/${categorySlug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-brand-border rounded-lg shadow-sm hover:shadow-md text-sm font-semibold text-brand-text-primary hover:text-brand-primary transition"
            >
              View All
              <ArrowRight className="h-4 w-4 text-gray-700" />
            </Link>
            {/* small hint */}
            <span className="text-xs text-gray-500 hidden sm:inline">Swipe to browse</span>
          </div>
        </div>

        {/* Products Carousel */}
        <div className="relative">
          {/* Scroll Left Button */}
          {products.length > 4 && (
            <button
              onClick={() => scroll("left")}
              className="hidden sm:block absolute left-2 top-[42%] -translate-y-1/2 z-20 bg-white/80 backdrop-blur-sm shadow-lg rounded-full p-2 hover:bg-white transition-colors border"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            </button>
          )}

          {/* Products Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {products.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-[260px] sm:w-[280px] lg:w-[300px] snap-start">
                <CategoryProductCard product={product} />
              </div>
            ))}
          </div>

          {/* Scroll Right Button */}
          {products.length > 4 && (
            <button
              onClick={() => scroll("right")}
              className="hidden sm:block absolute right-2 top-[42%] -translate-y-1/2 z-20 bg-white/80 backdrop-blur-sm shadow-lg rounded-full p-2 hover:bg-white transition-colors border"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-6 w-6 text-gray-700" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
