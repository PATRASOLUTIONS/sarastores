"use client"

import { useState, useEffect } from "react"
import { fetchWithCache, revalidateCache } from "@/utils/cache"
import { cleanProductName, cleanProductDescription } from "@/utils/cleanProductName"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductHeroSlider from "@/components/ProductHeroSlider"
import dynamic from "next/dynamic"

// Lazy load non-critical sections
const TestimonialSection = dynamic(() => import("@/components/TestimonialSection"), { ssr: false, loading: () => null })
const AnimatedBanner = dynamic(() => import("@/components/AnimatedBanner"), { ssr: false, loading: () => null })
const StaticProductAdvertisements = dynamic(() => import("@/components/StaticProductAdvertisements"), { ssr: false, loading: () => null })
const BankOffersMarquee = dynamic(() => import("@/components/BankOffersMarquee"), { ssr: false, loading: () => null })
const Banner = dynamic(() => import("@/components/Banner"), { ssr: false, loading: () => null })
// Avoid per-card spec-image fetches to reduce network overhead
import { Search, ShoppingCart, SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown, Eye, Heart, Shield, Star, ArrowUp, ArrowUpDown } from "lucide-react"
import AddToCartButton from "@/components/AddToCartButton"
import { useCart } from "@/hooks/useCart"
import { useCompare } from "@/hooks/useCompare"
import { useWishlist } from "@/hooks/useWishlist"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import * as Slider from '@radix-ui/react-slider';
import HeroSection from "@/components/HeroSection"
import { normalizeProductForSchema } from "@/lib/product-schema"
import {
  buildFacets,
  countActiveFacets,
  matchesFacets,
  toggleFacetValue,
  type FacetSelection,
} from "@/lib/product-facets"
import SpecFacets from "@/components/SpecFacets"

interface Product {
  id: string
  slug?: string
  name: string
  description: string
  price: number
  image: string
  stock: number
  category?: string
  manufacturer?: string
  manufacturerName?: string
  color?: string
  capacity?: string
  images?: string[]
  sku?: string
  type?: string // ✅ add this for raw.PROD DESC
  trusted?: boolean
  mrp?: number // ✅ MRP from database
}

interface Category {
  id: string
  name: string
  icon?: string
}

// Add this helper function near the top of the file, after the interfaces
const capitalizeFirstLetter = (string: string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const getCanonicalMeta = (product: any) => normalizeProductForSchema(product)
const getProductSubCategory = (product: any) => String(product?.subCategory || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductType = (product: any) => String(product?.type || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductBrand = (product: any) => String(getCanonicalMeta(product).manufacturerName || "")
const getProductCharDesc = (product: any) => String(getCanonicalMeta(product).charDesc || "")
// After migration products use groupName (e.g. "HOME APPLIANCES") instead of a category id in product.category
const getProductCategoryGroupName = (product: any): string =>
  String(product?.groupName || product?.category || getCanonicalMeta(product).categoryGroupName || "")

// Calculate MRP (5-15% higher than actual price)
const calculateMRP = (price: number) => {
  const randomPercentage = Math.floor(Math.random() * 11) + 5; // Random between 5-15
  const mrp = price * (1 + randomPercentage / 100);
  return Math.round(mrp);
}

// Calculate discount percentage
const calculateDiscount = (mrp: number, price: number) => {
  return Math.round(((mrp - price) / mrp) * 100);
}

// Resolve an effective MRP from DB fields (mirrors per-card logic) for sorting/discount
const getEffectiveMRP = (product: any): number => {
  if (typeof product?.mrp === 'number' && product.mrp > 0) return Math.round(product.mrp)
  try {
    const rawAny = product?.raw
    for (const cand of [rawAny?.MRP, rawAny?.mrp]) {
      if (cand === undefined || cand === null) continue
      const num = Number(String(cand).replace(/[^0-9.\-]/g, ""))
      if (!Number.isNaN(num) && num > 0) return Math.round(num)
    }
  } catch { /* ignore */ }
  if (typeof product?.originalPrice === 'number' && product.originalPrice > 0) return product.originalPrice
  return calculateMRP(product?.price || 0)
}

// Deterministic pseudo-rating derived from a stable key so the value never changes
// between renders. Real `rating`/`reviews` data is preferred when present.
const getRatingInfo = (product: any): { rating: number; count: number } => {
  const realRating = Number(product?.rating ?? product?.reviews?.average)
  const realCountRaw = product?.reviewsCount ?? product?.reviews?.count ?? (typeof product?.reviews === 'number' ? product.reviews : undefined)
  const realCount = Number(realCountRaw)
  if (!Number.isNaN(realRating) && realRating > 0) {
    return { rating: Math.min(5, Math.round(realRating * 10) / 10), count: !Number.isNaN(realCount) && realCount > 0 ? realCount : 0 }
  }
  const key = String(product?.id ?? product?.sku ?? product?.name ?? '')
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const rating = 3.8 + (h % 13) / 10 // 3.8 – 5.0
  const count = 12 + (h % 488) // 12 – 499
  return { rating: Math.round(rating * 10) / 10, count }
}

function StarRating({ rating, count, className = "" }: { rating: number; count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label={`Rated ${rating} out of 5`}>
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, rating - i))
          return (
            <span key={i} className="relative inline-block h-3.5 w-3.5">
              <Star className="absolute inset-0 h-3.5 w-3.5 text-gray-300" />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              </span>
            </span>
          )
        })}
      </div>
      <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="text-xs text-gray-400">({count.toLocaleString('en-IN')})</span>
      )}
    </div>
  )
}

function ProductGridCard({ product, getCategoryName, router, products }: { product: Product, getCategoryName: (id: string) => string, router: any, products: Product[] }) {
  // Prefer product-provided images (cheap, already in product payload).
  // Avoid calling `useProductSpecImages` for every card (it issues a network request per SKU).
  const mainSpecImage = (product.image && String(product.image)) || (Array.isArray(product.images) && product.images[0]) || "/modern-laptop-workspace.png"
  const { addToCart } = useCart()
  const { addToCompare, removeFromCompare, isInCompare } = useCompare()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [quantity, setQuantity] = useState(1)

  // Prioritize MRP: 1) Database mrp field, 2) raw.MRP/raw.mrp, 3) originalPrice, 4) calculated fallback
  const mrp = (() => {
    // First check database mrp field
    if (typeof product.mrp === 'number' && !Number.isNaN(product.mrp) && product.mrp > 0) {
      return Math.round(product.mrp)
    }

    // Then check raw.MRP or raw.mrp
    try {
      const rawAny = (product as any).raw
      const rawCandidates = [rawAny?.MRP, rawAny?.mrp]
      for (const cand of rawCandidates) {
        if (cand === undefined || cand === null) continue
        const num = Number(String(cand).replace(/[^0-9.\-]/g, ""))
        if (!Number.isNaN(num) && num > 0) return Math.round(num)
      }
    } catch (e) {
      // ignore
    }

    // Then check originalPrice
    if (typeof (product as any).originalPrice === 'number' && !Number.isNaN((product as any).originalPrice) && (product as any).originalPrice > 0) {
      return (product as any).originalPrice
    }

    // Finally, calculate random MRP as fallback
    return calculateMRP(product.price)
  })()
  const discountPercent = calculateDiscount(mrp, product.price)

  const handleAddToCart = () => {
    if (!product) return

    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image || mainSpecImage,
      quantity: quantity,
      color: undefined,
      size: undefined,
    }

    addToCart(cartItem)
    toast.success(`${product.name} added to cart!`)
  }

  // Better UX: show a brief adding state to prevent double clicks
  const handleAddToCartWithState = async () => {
    if (adding) return
    setAdding(true)
    try {
      handleAddToCart()
    } finally {
      // small timeout so user sees the state change
      setTimeout(() => setAdding(false), 400)
    }
  }

  return (
    <div className="product-card group flex h-full flex-col">
      <div className="cursor-pointer flex flex-1 flex-col" onClick={() => router.push(`/product/${product.slug || product.id}`)}>
        <div className="relative aspect-[4/3] bg-gradient-to-b from-gray-50 to-white flex items-center justify-center overflow-hidden">
          {/* Trusted Badge */}
          {(product as any).trusted && (
            <div className="badge-trusted absolute left-2 top-2 z-30 sm:left-3 sm:top-3">
              <Shield className="h-3 w-3" />
              <span className="text-xs font-bold">Trusted</span>
            </div>
          )}
          {discountPercent > 0 && (
            <div className="badge-sale absolute right-2 top-2 z-20 sm:right-3 sm:top-3">{discountPercent}% OFF</div>
          )}
          <div className="absolute inset-3 rounded-xl bg-white flex items-center justify-center overflow-hidden sm:inset-4">
            <img src={mainSpecImage} alt={cleanProductName(product.name)} loading="lazy" className="product-image w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.src = '/placeholder.svg' }} />
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors">{cleanProductName(product.name)}</h3>
          {(() => { const r = getRatingInfo(product); return <StarRating rating={r.rating} count={r.count} className="mb-2" /> })()}
          <p className="hidden sm:line-clamp-2 text-gray-500 mb-3 text-sm">{cleanProductDescription(product.description)}</p>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg sm:text-xl font-bold text-gray-900">₹{product.price.toLocaleString("en-IN")}</span>
                <span className="text-xs sm:text-sm text-gray-400 line-through">₹{mrp.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-green-600">Save ₹{(mrp - product.price).toLocaleString("en-IN")}</div>
            </div>
            {product.category && getCategoryName(product.category) !== "Unknown Category" && getCategoryName(product.category) !== "Uncategorized" && (
              <span className="hidden md:inline-block bg-brand-primary-subtle text-brand-primary text-xs px-2.5 py-1 rounded-full font-medium">
                {getCategoryName(product.category)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAddToCartWithState}
            className={`btn-gradient relative w-full overflow-hidden rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition sm:gap-2 ${adding ? 'opacity-80 cursor-wait' : ''}`}
            aria-label="Add to cart"
          >
            <ShoppingCart className={`h-4 w-4 shrink-0 ${adding ? 'animate-spin' : ''}`} />
            <span>{adding ? 'Adding...' : 'Add to Cart'}</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href={`/product/${product.slug || product.id}`} className="min-w-0 flex-1">
              <button className="w-full bg-white border border-gray-200 text-gray-700 py-2 rounded-xl hover:shadow-sm transition flex items-center justify-center gap-1.5 text-xs sm:text-sm" aria-label={`View ${product.name}`}>
                <Eye className="h-4 w-4 shrink-0 text-gray-700" />
                <span>View</span>
              </button>
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation()
                try {
                  if (isInWishlist(String(product.id))) {
                    removeFromWishlist(String(product.id))
                  } else {
                    addToWishlist(String(product.id))
                  }
                } catch (err) {
                  console.error('Wishlist action failed', err)
                }
              }}
              title={isInWishlist(String(product.id)) ? "Remove from wishlist" : "Add to wishlist"}
              className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition hover:shadow-sm sm:h-10 sm:w-10 ${isInWishlist(String(product.id)) ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-700'}`}
              aria-label={`Wishlist ${product.name}`}
            >
              <Heart className="h-4 w-4" />
            </button>

            <button
                onClick={(e) => {
                  e.stopPropagation()
                  try {
                    if (isInCompare(String(product.id))) {
                      removeFromCompare(String(product.id))
                      toast.success('Removed from compare')
                    } else {
                      // Enforce max 6 products in compare
                      const compareList = JSON.parse(localStorage.getItem('compareIds') || '[]')
                      if (compareList.length >= 6) {
                        // List product names in toast
                        const compareNames = compareList.map((id: string) => {
                          const prod = products.find((p: Product) => String(p.id) === String(id))
                          return prod ? prod.name : id
                        }).join(', ')
                        toast.error(`You can compare a maximum of 6 products.\nCurrently compared: ${compareNames}`)
                        return
                      }
                      addToCompare(String(product.id))
                      toast.success('Added to compare')
                    }
                  } catch (err) {
                    console.error('Compare action failed', err)
                  }
                }}
                title="Compare"
                className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition hover:shadow-sm sm:h-10 sm:w-10 ${isInCompare(String(product.id)) ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-brand-primary/40 hover:text-brand-primary'}`}
                aria-label={`Compare ${product.name}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]) // ✅ new filter state for types
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([]) // ✅ store all unique PROD DESC (types)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [descriptionFilter, setDescriptionFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20) // Lower default to reduce initial payload
  const [selectedCharDesc, setSelectedCharDesc] = useState<string[]>([])
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({})
  const [charDescs, setCharDescs] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<string>("relevance")
  const [minRating, setMinRating] = useState<number>(0)
  const [inStockOnly, setInStockOnly] = useState<boolean>(false)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const [openFilters, setOpenFilters] = useState({
    categories: true,
    subCategories: true,
    types: true,
    brands: true,
    price: true,
    charDesc: true
  })

  const router = useRouter()
  const searchParams = useSearchParams()
  const { cart } = useCart()
  const cartItemsCount = cart?.reduce((total, item) => total + (item.quantity || 0), 0) || 0

  useEffect(() => {
    const categoryFromUrl = searchParams.get("category")
    const searchFromUrl = searchParams.get("search")
    const brandFromUrl = searchParams.get("brand") || searchParams.get("brands")
    const subCategoryFromUrl = searchParams.get("subCategory")
    const subCategoriesFromUrl = searchParams.get("subCategories")

    if (categoryFromUrl) setSelectedCategories([categoryFromUrl])
    if (searchFromUrl) setSearchTerm(searchFromUrl)
    if (brandFromUrl) setSelectedBrands([brandFromUrl])

    // Search suggestions deep-link structured intent here, so "55 inch tv under
    // 60000" arrives as real filters rather than a raw string.
    const qFromUrl = searchParams.get("q")
    if (qFromUrl && !searchFromUrl) setSearchTerm(qFromUrl)

    const minPrice = Number(searchParams.get("minPrice"))
    const maxPrice = Number(searchParams.get("maxPrice"))
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      setPriceRange([
        Number.isFinite(minPrice) ? minPrice : 0,
        Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : 200000,
      ])
    }

    const urlFacets: FacetSelection = {}
    const size = searchParams.get("size")
    if (size) urlFacets.screenSize = [`${size}"`]
    const star = searchParams.get("star")
    if (star) urlFacets.energyRating = [`${star} Star`]
    const features = searchParams.getAll("feature")
    if (features.length > 0) {
      urlFacets.smartFeatures = features.map((f) => f.replace(/\b\w/g, (c) => c.toUpperCase()))
    }
    if (Object.keys(urlFacets).length > 0) setFacetSelection(urlFacets)

    // Combine single and multiple subcategory params into the selectedSubCategories filter
    const selections: string[] = []
    if (subCategoryFromUrl) selections.push(subCategoryFromUrl)
    if (subCategoriesFromUrl) {
      const parts = subCategoriesFromUrl.split(",").map(s => s.trim()).filter(Boolean)
      selections.push(...parts)
    }
    if (selections.length > 0) setSelectedSubCategories(selections)

    // Fetch products and categories with cache for instant render
    const fetchDataCached = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [productsData, categoriesData] = await Promise.all([
          fetchWithCache("products", async () => {
            const r = await fetch("/api/products")
            if (!r.ok) throw new Error("Failed to fetch products")
            return r.json()
          }, 5 * 60 * 1000),
          fetchWithCache("categories", async () => {
            const r = await fetch("/api/categories")
            if (!r.ok) throw new Error("Failed to fetch categories")
            return r.json()
          }, 5 * 60 * 1000)
        ])
        try {
          localStorage.setItem("products", JSON.stringify(productsData))
          localStorage.setItem("categories", JSON.stringify(categoriesData))
        } catch (e) {
          console.warn("Failed to save to localStorage", e)
        }
        setProducts(productsData)
        setCategories(categoriesData)

        // Extract subcategories and group TV variants
        const rawSubCategories = Array.from(
          new Set(productsData.map((p: any) => getProductSubCategory(p)).filter(Boolean))
        ) as string[]
        const groupedSubCategories = Array.from(new Set(rawSubCategories.map(sub => {
          if (sub.toLowerCase().startsWith("tv ") || sub.toLowerCase() === "tv") return "TV"
          return sub
        })))
        setSubCategories(groupedSubCategories as string[])

        // ✅ Extract unique types from raw.PROD DESC or product.type
        const uniqueTypes = Array.from(
          new Set(productsData.map((p: any) => getProductType(p)).filter(Boolean))
        )
        setTypes(uniqueTypes as string[])

        // Add this in the fetchData function after setting types
        const uniqueCharDescs = Array.from(
          new Set(productsData.map((p: any) => getProductCharDesc(p)).filter(Boolean))
        )
        setCharDescs(uniqueCharDescs as string[])

        // Set price range
        if (productsData.length > 0) {
          const prices = productsData.map((p: Product) => p.price).filter((price: number) => !isNaN(price) && price > 0);
          if (prices.length > 0) {
            const minPrice = Math.floor(Math.min(...prices) / 100) * 100; // Round down to nearest 100
            const maxPrice = Math.ceil(Math.max(...prices) / 100) * 100; // Round up to nearest 100
            setPriceRange([minPrice, maxPrice]);
          } else {
            setPriceRange([0, 10000]);
          }
        } else {
          setPriceRange([0, 10000]);
        }

        // Revalidate in background and update localStorage
        revalidateCache("products", async () => {
          const r = await fetch("/api/products")
          if (!r.ok) throw new Error("Failed to fetch products")
          const fresh = await r.json()
          try {
            localStorage.setItem("products", JSON.stringify(fresh))
          } catch (e) {
            console.warn("Failed to update products in localStorage", e)
          }
          return fresh
        }, 5 * 60 * 1000)
        revalidateCache("categories", async () => {
          const r = await fetch("/api/categories")
          if (!r.ok) throw new Error("Failed to fetch categories")
          const fresh = await r.json()
          try {
            localStorage.setItem("categories", JSON.stringify(fresh))
          } catch (e) {
            console.warn("Failed to update categories in localStorage", e)
          }
          return fresh
        }, 5 * 60 * 1000)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setIsLoading(false)
      }
    }
    fetchDataCached()
  }, [searchParams])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
      ])

      if (!productsResponse.ok) throw new Error("Failed to fetch products")
      if (!categoriesResponse.ok) throw new Error("Failed to fetch categories")

      const productsData: Product[] = await productsResponse.json()
      const categoriesData: Category[] = await categoriesResponse.json()

      setProducts(productsData)
      setCategories(categoriesData)

      // Extract subcategories and group TV variants
      const rawSubCategories = Array.from(
        new Set(productsData.map((p: any) => getProductSubCategory(p)).filter(Boolean))
      ) as string[]
      const groupedSubCategories = Array.from(new Set(rawSubCategories.map(sub => {
        if (sub.toLowerCase().startsWith("tv ") || sub.toLowerCase() === "tv") return "TV"
        return sub
      })))
      setSubCategories(groupedSubCategories)

      // ✅ Extract unique types from raw.PROD DESC or product.type
      const uniqueTypes = Array.from(
        new Set(productsData.map((p: any) => getProductType(p)).filter(Boolean))
      )
      setTypes(uniqueTypes)

      // Add this in the fetchData function after setting types
      const uniqueCharDescs = Array.from(
        new Set(productsData.map((p: any) => getProductCharDesc(p)).filter(Boolean))
      )
      setCharDescs(uniqueCharDescs)

      // Set price range
      if (productsData.length > 0) {
        const prices = productsData.map((p) => p.price).filter(price => !isNaN(price) && price > 0);
        if (prices.length > 0) {
          const minPrice = Math.floor(Math.min(...prices) / 100) * 100; // Round down to nearest 100
          const maxPrice = Math.ceil(Math.max(...prices) / 100) * 100; // Round up to nearest 100
          setPriceRange([minPrice, maxPrice]);
        } else {
          // Default price range if no valid prices found
          setPriceRange([0, 10000]);
        }
      } else {
        // Default price range if no products
        setPriceRange([0, 10000]);
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const brands = Array.from(
    new Set(products.map((p) => getProductBrand(p)).filter(Boolean))
  ) as string[]

  // ✅ toggle for types
  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  // Add this with other toggle functions
  const toggleCharDesc = (charDesc: string) => {
    setSelectedCharDesc((prev) =>
      prev.includes(charDesc) ? prev.filter((c) => c !== charDesc) : [...prev, charDesc]
    )
  }

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId]
    )
  }

  const toggleSubCategory = (sub: string) => {
    setSelectedSubCategories((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    )
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedBrands([])
    setSelectedSubCategories([])
    setSelectedTypes([]) // ✅ clear type filter
    setPriceRange([0, 200000])
    setSearchTerm("")
    setDescriptionFilter("")
    setSelectedCharDesc([]) // Add this line
    setFacetSelection({})
    setMinRating(0)
    setInStockOnly(false)
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : "Unknown Category"
  }

  // ✅ include type in filtering
  const filteredProducts = products.filter((product: any) => {    const matchesSearch =
      (product.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description || "").toLowerCase().includes(searchTerm.toLowerCase())

    // Match category: after migration products store category in groupName, not product.category
    const productCategoryRaw = getProductCategoryGroupName(product)
    const matchingCategory = categories.find(c =>
      c.id === productCategoryRaw ||
      c.name.toLowerCase() === productCategoryRaw.toLowerCase()
    )
    const matchesCategory =
      selectedCategories.length === 0 ||
      (matchingCategory !== undefined && selectedCategories.includes(matchingCategory.id)) ||
      selectedCategories.includes(productCategoryRaw)

    const matchesSubCategory =
      selectedSubCategories.length === 0 || selectedSubCategories.some(sel => {
        const prodSub = getProductSubCategory(product).toLowerCase()
        if (sel === "TV") {
          return prodSub.startsWith("tv ") || prodSub === "tv"
        }
        return prodSub === sel.toLowerCase()
      })

    const matchesType =
      selectedTypes.length === 0 ||
      selectedTypes.includes(getProductType(product))

    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1]

    const matchesBrand =
      selectedBrands.length === 0 ||
      selectedBrands.map(b => b.toLowerCase()).includes(getProductBrand(product).toLowerCase())

    const matchesDescription =
      descriptionFilter === "" ||
      (product.description || "").toLowerCase().includes(descriptionFilter.toLowerCase())

    const matchesCharDesc =
      selectedCharDesc.length === 0 ||
      selectedCharDesc.includes(getProductCharDesc(product))

    const matchesRating =
      minRating === 0 || getRatingInfo(product).rating >= minRating

    const matchesStock =
      !inStockOnly || (typeof product.stock === 'number' ? product.stock > 0 : true)

    return (
      matchesSearch &&
      matchesCategory &&
      matchesSubCategory &&
      matchesType &&
      matchesCharDesc && // Add this line
      matchesPrice &&
      matchesBrand &&
      matchesDescription &&
      matchesRating &&
      matchesStock
    )
  })

  // Facets come from the pre-facet result set so choosing one value doesn't
  // erase the sibling options from the sidebar.
  const facets = buildFacets(filteredProducts)
  const facetedProducts = filteredProducts.filter((product: any) =>
    matchesFacets(product, facetSelection),
  )

  const toggleFacet = (key: string, value: string) => {
    setFacetSelection((prev) => toggleFacetValue(prev, key, value))
  }

  // Apply sorting (kept separate from filtering so "relevance" preserves source order)
  const sortedProducts = (() => {
    const list = [...facetedProducts]
    switch (sortBy) {
      case "price-asc":
        return list.sort((a, b) => a.price - b.price)
      case "price-desc":
        return list.sort((a, b) => b.price - a.price)
      case "discount":
        return list.sort((a, b) => calculateDiscount(getEffectiveMRP(b), b.price) - calculateDiscount(getEffectiveMRP(a), a.price))
      case "rating":
        return list.sort((a, b) => getRatingInfo(b).rating - getRatingInfo(a).rating)
      case "newest":
        return list.sort((a, b) => {
          const at = new Date((a as any).createdAt ?? (a as any).updatedAt ?? 0).getTime() || 0
          const bt = new Date((b as any).createdAt ?? (b as any).updatedAt ?? 0).getTime() || 0
          return bt - at
        })
      case "name-asc":
        return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      default:
        return list
    }
  })()

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategories, selectedBrands, selectedSubCategories, priceRange, descriptionFilter, minRating, inStockOnly, sortBy, facetSelection])

  // Back-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentProducts = sortedProducts.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  // Compute available options dynamically: each filter's available options
  // are derived from products that match ALL OTHER currently selected filters.
  type OptionKey = 'categories' | 'subCategories' | 'types' | 'brands' | 'charDesc'

  const getProductsApplyingOtherFilters = (exclude?: OptionKey) => {
    return products.filter((product) => {
      // categories - match by groupName (post-migration) or category id
      if (exclude !== 'categories' && selectedCategories.length > 0) {
        const productCategoryRaw = getProductCategoryGroupName(product)
        const matchingCategory = categories.find(c =>
          c.id === productCategoryRaw ||
          c.name.toLowerCase() === productCategoryRaw.toLowerCase()
        )
        if (!selectedCategories.includes(productCategoryRaw) && !(matchingCategory && selectedCategories.includes(matchingCategory.id))) {
          return false
        }
      }

      // sub-categories (use subCategory field, not description)
      if (exclude !== 'subCategories' && selectedSubCategories.length > 0) {
        const productSubCategory = getProductSubCategory(product).toLowerCase()
        const isMatch = selectedSubCategories.some(sel => {
          if (sel === "TV") {
            return productSubCategory.startsWith("tv ") || productSubCategory === "tv"
          }
          return productSubCategory === sel.toLowerCase()
        })
        if (!isMatch) return false
      }

      // types
      if (exclude !== 'types' && selectedTypes.length > 0) {
        const prodType = getProductType(product)
        if (!selectedTypes.includes(prodType)) return false
      }

      // brands
      if (exclude !== 'brands' && selectedBrands.length > 0) {
        const brand = getProductBrand(product)
        if (!selectedBrands.includes(brand)) return false
      }

      // character descriptions
      if (exclude !== 'charDesc' && selectedCharDesc.length > 0) {
        const c = getProductCharDesc(product)
        if (!selectedCharDesc.includes(c)) return false
      }

      // price range
      if (product.price < priceRange[0] || product.price > priceRange[1]) return false

      // description filter
      if (descriptionFilter && !(product.description || "").toLowerCase().includes(descriptionFilter.toLowerCase())) return false

      // search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        if (!((product.name || "").toLowerCase().includes(term)) && !((product.description || "").toLowerCase().includes(term))) return false
      }

      return true
    })
  }

  const availableSubCategories = Array.from(
    new Set(getProductsApplyingOtherFilters('subCategories').map((p: any) => {
      const sub = getProductSubCategory(p)
      if (sub.toLowerCase().startsWith("tv ") || sub.toLowerCase() === "tv") return "TV"
      return sub
    }).filter(Boolean)),
  )

  const availableTypes = Array.from(
    new Set(
      getProductsApplyingOtherFilters('types').map((p: any) => getProductType(p)).filter(Boolean),
    ),
  )

  const availableBrands = Array.from(
    new Set(getProductsApplyingOtherFilters('brands').map((p) => getProductBrand(p)).filter(Boolean)),
  )

  const availableCharDescs = Array.from(
    new Set(getProductsApplyingOtherFilters('charDesc').map((p: any) => getProductCharDesc(p)).filter(Boolean)),
  )

  type FilterKeys = 'categories' | 'subCategories' | 'types' | 'brands' | 'price' | 'charDesc';

  const toggleFilter = (filterName: FilterKeys) => {
    setOpenFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  // Determine if any filter/search is currently active. If true, we hide the HeroSection.
  const isPriceDefault = priceRange[0] === 0 && priceRange[1] === 200000;
  const isAnyFilterActive = (
    searchTerm.trim() !== "" ||
    descriptionFilter.trim() !== "" ||
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedSubCategories.length > 0 ||
    selectedTypes.length > 0 ||
    selectedCharDesc.length > 0 ||
    minRating > 0 ||
    inStockOnly ||
    !isPriceDefault
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow">
        {/* <ProductHeroSlider /> */}
        {!isAnyFilterActive && <HeroSection />}

        {/* Themed catalogue banner — repaints with the active festival theme */}
        {!isAnyFilterActive && (
          <section className="relative overflow-hidden themed-hero themed-glow">
            <div className="container relative z-10 mx-auto px-4 py-8 md:px-6 md:py-11 lg:px-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                Full catalogue
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white md:text-4xl">
                Every product, one place
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80 md:text-base">
                Filter by brand, budget, screen size, capacity and energy rating to narrow{" "}
                {products.length > 0 ? products.length.toLocaleString("en-IN") : "our full range"}{" "}
                {products.length > 0 ? "products" : ""} down to the right one.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-white/90">
                {["No-cost EMI", "Free delivery", "Brand warranty", "Store pickup", "Exchange offers"].map(
                  (chip) => (
                    <li
                      key={chip}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm"
                    >
                      {chip}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </section>
        )}

        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-500 mb-5" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-brand-primary transition-colors">Home</Link>
            <span className="mx-2 text-gray-300">/</span>
            <span className="font-medium text-gray-700">All Products</span>
          </nav>

          <div className="flex gap-6 lg:gap-8 relative">
            {/* Mobile filter backdrop */}
            {showFilters && (
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                onClick={() => setShowFilters(false)}
              />
            )}
            <aside
              className={`${showFilters ? "fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] bg-white shadow-2xl" : "hidden"} lg:relative lg:block lg:w-72 lg:z-auto lg:shadow-none flex-shrink-0 transition-transform duration-300`}
            >
              <div className="bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-100 p-5 md:p-6 lg:sticky lg:top-24 h-full lg:h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-brand-primary" />
                    Filters
                  </h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Scrollable Filters */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  {/* Search */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Price Range</h3>
                      <button
                        onClick={() => toggleFilter('price')}
                        className="p-1 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${openFilters.price ? 'rotate-180' : ''
                            }`}
                        />
                      </button>
                    </div>
                    {openFilters.price && (
                      <div className="px-2">
                        <Slider.Root
                          className="relative flex items-center select-none touch-none h-5 mb-4"
                          value={priceRange}
                          max={200000}
                          step={1000}
                          minStepsBetweenThumbs={1}
                          onValueChange={(value) => setPriceRange(value as [number, number])}
                        >
                          <Slider.Track className="bg-gray-200 relative grow rounded-full h-[3px]">
                            <Slider.Range className="absolute bg-brand-primary rounded-full h-full" />
                          </Slider.Track>
                          <Slider.Thumb
                            className="block w-5 h-5 bg-white border-2 border-brand-primary rounded-full hover:bg-brand-primary-subtle focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            aria-label="Min price ₹"
                          />
                          <Slider.Thumb
                            className="block w-5 h-5 bg-white border-2 border-brand-primary rounded-full hover:bg-brand-primary-subtle focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            aria-label="Max price ₹"
                          />
                        </Slider.Root>

                        <div className="flex justify-between items-center gap-4 mt-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Min Price ₹</label>
                            <input
                              type="number"
                              value={priceRange[0]}
                              onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                              min={0}
                              max={priceRange[1]}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Max Price ₹</label>
                            <input
                              type="number"
                              value={priceRange[1]}
                              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                              min={priceRange[0]}
                              max={200000}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Rating */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Customer Rating</h3>
                    <div className="space-y-1.5">
                      {[4, 3, 2].map((r) => (
                        <button
                          key={r}
                          onClick={() => setMinRating(minRating === r ? 0 : r)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${minRating === r ? 'bg-brand-primary-subtle text-brand-primary font-semibold ring-1 ring-brand-primary/30' : 'hover:bg-gray-50 text-gray-700'}`}
                        >
                          <span className="flex items-center">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < r ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                            ))}
                          </span>
                          <span>&amp; Up</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Availability</h3>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-sm text-gray-700">In stock only</span>
                    </label>
                  </div>

                  {/* Categories */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Categories</h3>
                      <button
                        onClick={() => toggleFilter('categories')}
                        className="p-1 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.categories ? '' : '-rotate-90'}`} />
                      </button>
                    </div>
                    {openFilters.categories && (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {categories.map((category) => {
                          const count = products.filter((p) => {
                            const g = getProductCategoryGroupName(p)
                            return g.toLowerCase() === category.name.toLowerCase() || (p as any).category === category.id
                          }).length
                          return (
                            <label
                              key={category.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategories.includes(category.id)}
                                onChange={() => toggleCategory(category.id)}
                                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                              />
                              <span className="text-sm text-gray-700 flex-1">
                                {capitalizeFirstLetter(category.name)}
                              </span>
                              <span className="text-xs text-gray-500">({count})</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Sub Categories */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-sm text-gray-700">Sub Categories</h3>
                      <button
                        onClick={() => toggleFilter('subCategories')}
                        className="p-1 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.subCategories ? '' : '-rotate-90'}`} />
                      </button>
                    </div>
                    {openFilters.subCategories && (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                        {subCategories.filter(sub => availableSubCategories.includes(sub)).map((sub) => (
                          <label key={sub} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedSubCategories.includes(sub)}
                              onChange={() => toggleSubCategory(sub)}
                              className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-gray-700">{capitalizeFirstLetter(sub)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Character Description */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Character Description</h3>
                      <button
                        onClick={() => toggleFilter('charDesc')}
                        className="p-1 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.charDesc ? '' : '-rotate-90'}`} />
                      </button>
                    </div>
                    {openFilters.charDesc && (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                        {charDescs.filter(charDesc => availableCharDescs.includes(charDesc)).map((charDesc) => (
                          <label key={charDesc} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedCharDesc.includes(charDesc)}
                              onChange={() => toggleCharDesc(charDesc)}
                              className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-gray-700">{capitalizeFirstLetter(charDesc)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Brands */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Brands</h3>
                      <button
                        onClick={() => toggleFilter('brands')}
                        className="p-1 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.brands ? '' : '-rotate-90'}`} />
                      </button>
                    </div>
                    {openFilters.brands && (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {brands.filter(brand => availableBrands.includes(brand)).map((brand) => (
                          <label key={brand} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={selectedBrands.includes(brand)}
                              onChange={() => toggleBrand(brand)}
                              className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-gray-700">{capitalizeFirstLetter(brand)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Spec facets, derived from the products in this result set */}
                  <SpecFacets facets={facets} selection={facetSelection} onToggle={toggleFacet} />

                  {/* Types (PROD DESC) */}
                  {/* <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Product Types</h3>
                      <button
                        onClick={() => toggleFilter('types')}
                        className="p-1 hover:bg-gray-100 rounded-md"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${openFilters.types ? '' : '-rotate-90'}`} />
                      </button>
                    </div>
                    {openFilters.types && (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                        {types.filter(type => availableTypes.includes(type)).map((type) => (
                          <label key={type} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedTypes.includes(type)}
                              onChange={() => toggleType(type)}
                              className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-gray-700">{capitalizeFirstLetter(type)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div> */}

                  {/* Product Description */}
                  {/* <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Description
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filter by description..."
                        value={descriptionFilter}
                        onChange={(e) => setDescriptionFilter(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div> */}
                </div>

                {/* Clear Filters Button */}
                <button
                  onClick={clearFilters}
                  className="mt-4 w-full py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear All Filters
                </button>
              </div>
            </aside>


            <div className="flex-1 min-w-0">
              {/* Mobile Filter Toggle */}
              <div className="lg:hidden mb-6 flex justify-between items-center">
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center gap-2 px-5 py-3 min-h-[44px] bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm touch-manipulation"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="font-medium">Filters</span>
                </button>
                {/* <Link href="/cart">
                  <button className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover transition-colors">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    <span>Cart ({cartItemsCount})</span>
                  </button>
                </Link> */}
              </div>

              {/* Results Header */}
              <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">All Products</h1>
                  <p className="text-sm text-gray-500 mt-1.5">
                    Showing <span className="font-semibold text-gray-700">{facetedProducts.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedProducts.length)}</span> of{" "}
                    <span className="font-semibold text-gray-700">{sortedProducts.length}</span> products
                  </p>
                </div>
                {/* Sort control */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <label htmlFor="sort-by" className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap">
                    <ArrowUpDown className="h-4 w-4" />
                    Sort by
                  </label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 sm:flex-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer hover:border-gray-400 transition-colors"
                  >
                    <option value="relevance">Featured</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="discount">Discount: High to Low</option>
                    <option value="newest">Newest First</option>
                    <option value="rating">Customer Rating</option>
                    <option value="name-asc">Name: A to Z</option>
                  </select>
                </div>
              </div>

              {/* Active Filters */}
              {(selectedCategories.length > 0 || selectedBrands.length > 0 || selectedSubCategories.length > 0 || selectedCharDesc.length > 0 || selectedTypes.length > 0 || countActiveFacets(facetSelection) > 0 || !(priceRange[0] === 0 && priceRange[1] === 200000)) && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {selectedCategories.map((catId) => (
                    <span
                      key={catId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary-subtle text-brand-primary rounded-full text-sm font-medium border border-brand-primary/15 shadow-sm hover:bg-brand-primary-light transition-colors"
                    >
                      {capitalizeFirstLetter(getCategoryName(catId))}
                      <button onClick={() => toggleCategory(catId)} className="hover:text-brand-primary-hover hover:bg-brand-primary-light rounded-full p-0.5 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {selectedBrands.map((brand) => (
                    <span
                      key={brand}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100 shadow-sm hover:bg-green-100 transition-colors"
                    >
                      {capitalizeFirstLetter(brand)}
                      <button onClick={() => toggleBrand(brand)} className="hover:text-green-900 hover:bg-green-200 rounded-full p-0.5 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {selectedSubCategories.map((sub) => (
                    <span
                      key={`sub-${sub}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100 shadow-sm hover:bg-amber-100 transition-colors"
                    >
                      {capitalizeFirstLetter(sub)}
                      <button onClick={() => toggleSubCategory(sub)} className="hover:text-amber-900 hover:bg-amber-200 rounded-full p-0.5 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {selectedCharDesc.map((c) => (
                    <span
                      key={`char-${c}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-100 shadow-sm hover:bg-purple-100 transition-colors"
                    >
                      {capitalizeFirstLetter(c)}
                      <button onClick={() => toggleCharDesc(c)} className="hover:text-purple-900 hover:bg-purple-200 rounded-full p-0.5 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {selectedTypes.map((t) => (
                    <span key={`type-${t}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors">
                      {capitalizeFirstLetter(t)}
                      <button onClick={() => toggleType(t)} className="hover:text-indigo-900 hover:bg-indigo-200 rounded-full p-0.5 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {Object.entries(facetSelection).flatMap(([key, values]) =>
                    values.map((value) => (
                      <span key={`facet-${key}-${value}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100 shadow-sm hover:bg-amber-100 transition-colors">
                        {value}
                        <button onClick={() => toggleFacet(key, value)} className="hover:text-amber-900 hover:bg-amber-200 rounded-full p-0.5 transition-colors" aria-label={`Remove ${value} filter`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )),
                  )}

                  {/* Price Range pill (shows when not default) */}
                  {!(priceRange[0] === 0 && priceRange[1] === 200000) && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-full text-sm font-medium border border-gray-200 shadow-sm hover:bg-gray-100 transition-colors">
                      ₹{priceRange[0].toLocaleString('en-IN')} - ₹{priceRange[1].toLocaleString('en-IN')}
                      <button onClick={() => setPriceRange([0, 200000])} className="hover:text-gray-900 hover:bg-gray-200 rounded-full p-0.5 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                      <div className="aspect-[4/3] bg-gray-100" />
                      <div className="p-3 sm:p-4 space-y-3">
                        <div className="h-4 bg-gray-100 rounded w-5/6" />
                        <div className="h-4 bg-gray-100 rounded w-2/3" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="h-6 bg-gray-100 rounded w-1/3 mt-2" />
                        <div className="h-10 bg-gray-100 rounded-xl mt-3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <X className="h-5 w-5 text-red-500" />
                  </div>
                  <p className="font-medium">{error}</p>
                </div>
              ) : (
                <>
                  {/* Products Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                    {currentProducts.map((product) => (
                      <ProductGridCard key={product.id} product={product} getCategoryName={getCategoryName} router={router} products={products} />
                    ))}
                  </div>

                  {/* Product count display */}
                  <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      Showing <span className="font-semibold text-gray-900">{indexOfFirstItem + 1}</span> to{' '}
                      <span className="font-semibold text-gray-900">{Math.min(indexOfLastItem, facetedProducts.length)}</span> of{' '}
                      <span className="font-semibold text-gray-900">{facetedProducts.length}</span> products
                      {products.length !== facetedProducts.length && (
                        <span className="text-gray-500"> (filtered from {products.length} total)</span>
                      )}
                    </p>
                  </div>

                  {facetedProducts.length > 0 && (
                    <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                      {/* Items per page selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Show:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                          <option value={1000}>1000</option>
                          <option value={9999}>All</option>
                        </select>
                        <span className="text-sm text-gray-600">per page</span>
                      </div>

                      {/* Pagination buttons */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`p-2.5 rounded-xl transition-all duration-200 ${currentPage === 1
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white text-gray-700 hover:bg-brand-primary-subtle hover:text-brand-primary border border-gray-200 shadow-sm"
                              }`}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>

                          {/* Page numbers */}
                          <div className="flex gap-1">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                              let pageNumber
                              if (totalPages <= 5) {
                                pageNumber = i + 1
                              } else if (currentPage <= 3) {
                                pageNumber = i + 1
                              } else if (currentPage >= totalPages - 2) {
                                pageNumber = totalPages - 4 + i
                              } else {
                                pageNumber = currentPage - 2 + i
                              }

                              return (
                                <button
                                  key={pageNumber}
                                  onClick={() => handlePageChange(pageNumber)}
                                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${currentPage === pageNumber
                                    ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                                    : "bg-white text-gray-700 hover:bg-brand-primary-subtle hover:text-brand-primary border border-gray-200"
                                    }`}
                                >
                                  {pageNumber}
                                </button>
                              )
                            })}
                          </div>

                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`p-2.5 rounded-xl transition-all duration-200 ${currentPage === totalPages
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white text-gray-700 hover:bg-brand-primary-subtle hover:text-brand-primary border border-gray-200 shadow-sm"
                              }`}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>
                      )}

                      {/* Page info */}
                      <div className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </div>
                    </div>
                  )}

                  {facetedProducts.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
                      <button
                        onClick={clearFilters}
                        className="mt-4 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary-hover transition-colors"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Back to top */}
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Back to top"
            className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand-primary text-white shadow-lg shadow-brand-primary/30 flex items-center justify-center hover:bg-brand-primary-hover transition-all hover:scale-110"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </main>
      <Footer />
    </div>
  )
}
