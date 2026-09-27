"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { ProductJsonLd } from "./structured-data"
import { BreadcrumbJsonLd } from "@/lib/seo"
import { analytics, toAnalyticsItem } from "@/lib/analytics"
import { cleanProductName, ensureProductDescription } from "@/utils/cleanProductName"
import {
  ArrowLeft,
  Star,
  Truck,
  ShieldCheck,
  ShoppingCart,
  Package,
  BadgeCheck,
  TrendingUp,
  Share2,
  Heart,
  ZoomIn,
  X,
  RotateCcw,
  Lock,
  Check,
  Zap,
  MapPin,
  CreditCard,
  Wallet,
  Banknote,
  Calendar,
  Sparkles,
  Box,
  Layers,
  ListChecks,
  Info,
  ChevronRight,
  Building2,
  Repeat2,
  Tag,
  Award,
  Clock3,
  Headphones,
  Boxes,
  Shield,
  Verified,
  Plus,
  Minus,
  ThumbsUp,
  CheckCircle2,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import Link from "next/link"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/contexts/AuthContext"
import { useCartUI } from "@/contexts/CartUIContext"
import { useSettingsData } from "@/hooks/useSettingsData"
import { toast } from "react-hot-toast"
import ProductReviewsSection from "@/components/ProductReviewsSection"
import CustomerQASection from "@/components/CustomerQASection"
import ProductSpecificationTabs from "@/components/ProductSpecificationTabs"
import CategoryProductCard from "@/components/CategoryProductCard"
import DeliveryEstimator from "@/components/DeliveryEstimator"
import EmiCalculator from "@/components/EmiCalculator"
import FrequentlyBoughtTogether from "@/components/FrequentlyBoughtTogether"
import SiteFeatures from "@/components/SiteFeatures"
import { normalizeProductForSchema } from "@/lib/product-schema"

const RecentlyViewed = dynamic(() => import("@/components/RecentlyViewed"), { ssr: false })

interface Product {
  id: string
  slug?: string
  name: string
  description: string
  price: number
  image: string
  stock: number
  category?: string
  brand?: string
  sku?: string
  technical_details?: Record<string, unknown>
  from_manufacturer?: string
  specification_images?: string[]
  images?: string[]
  mrp?: number
  originalPrice?: number
  trusted?: boolean
  overview?: string
  included_components?: string[]
  features?: string[]
  emi_available?: boolean
  cod_available?: boolean
  free_delivery?: boolean
  reviews?: {
    average?: number
    count?: number
    top?: Array<{
      title: string
      rating: number
      body: string
      author?: string
      date?: string
    }>
  } | Array<{
    title?: string
    rating?: number
    body?: string
    [key: string]: unknown
  }>
  qa?: Array<{ id: string; question: string; answer?: string }>
}

interface Category {
  id: string
  name: string
}

const calculateDiscount = (mrp: number, price: number) =>
  Math.round(((mrp - price) / mrp) * 100)

const productCache = new Map<string, Product>()
let categoriesCache: Category[] | null = null
const CACHE_DURATION = 30 * 60 * 1000

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

function formatDeliveryDate(daysToAdd: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysToAdd)
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const unwrappedParams = React.use(params)
  const slug = unwrappedParams.slug

  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showFullName, setShowFullName] = useState(false)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [showMetaPreview, setShowMetaPreview] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishLoading, setWishLoading] = useState(false)
  const [adding, setAdding] = useState<"cart" | "buy" | null>(null)
  const router = useRouter()
  const { cart, addToCart } = useCart()
  const { user } = useAuth()
  const { openCart, setLastAddedId } = useCartUI()
  const { data: settingsData } = useSettingsData()

  useEffect(() => {
    if (settingsData) {
      if (settingsData.companyName) setCompanyName(settingsData.companyName)
      else if (settingsData.siteName) setCompanyName(settingsData.siteName)
    }
  }, [settingsData])

  useEffect(() => {
    let cancelled = false
    const fetchMinimal = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (!slug) return

        let cachedData = productCache.get(slug)
        if (!cachedData) {
          try {
            const stored = localStorage.getItem(`product_cache_${slug}`)
            if (stored) {
              const { data, timestamp } = JSON.parse(stored)
              if (Date.now() - timestamp < CACHE_DURATION) {
                cachedData = data
                productCache.set(slug, data)
              }
            }
          } catch {
            // ignore
          }
        }

        if (cachedData) {
          if (!cancelled) {
            setProduct(cachedData)
            setIsLoading(false)
          }
          if (categoriesCache) {
            if (!cancelled) setCategories(categoriesCache)
          } else {
            const categoriesResponse = await fetch("/api/categories")
            if (categoriesResponse.ok) {
              const categoriesData = await categoriesResponse.json()
              categoriesCache = categoriesData
              if (!cancelled) setCategories(categoriesData)
            }
          }
        }

        if (!cachedData) {
          const minimalFields = [
            "id", "name", "price", "image", "images", "stock", "category", "sku",
            "mrp", "originalPrice", "reviews", "description", "brand", "trusted",
            "specification_images", "features", "overview", "included_components",
            "from_manufacturer", "technical_details", "qa",
          ]
          const minRes = await fetch(`/api/products/${encodeURIComponent(slug)}?fields=${minimalFields.join(",")}`)
          if (!minRes.ok) {
            if (minRes.status === 404) throw new Error("Product not found")
            throw new Error("Failed to fetch product")
          }
          const minData = await minRes.json()
          if (!cancelled) setProduct(minData)
          setIsLoading(false)
        }

        const fullRes = await fetch(`/api/products/${encodeURIComponent(slug)}`)
        if (fullRes.ok) {
          const fullData = await fullRes.json()
          const originalMRP = fullData.mrp

          if (fullData.sku) {
            try {
              const specsResponse = await fetch(`/api/products/specifications/${fullData.sku}`)
              if (specsResponse.ok) {
                const specsData = await specsResponse.json()
                fullData.technical_details = specsData.technical_details || fullData.technical_details
                fullData.from_manufacturer = specsData.from_manufacturer || fullData.from_manufacturer
                fullData.specification_images = specsData.specification_images || fullData.specification_images
                fullData.mrp = originalMRP || specsData.mrp
                fullData.reviews = specsData.reviews
                fullData.overview = specsData.overview || fullData.overview || fullData.description
                fullData.included_components = specsData.included_components || fullData.included_components
                fullData.features = specsData.features || fullData.features
              }
            } catch {
              console.error("[product] spec fetch error for", slug)
            }
          }
          if (!cancelled) {
            setProduct(fullData)
            productCache.set(slug, fullData)
            try {
              localStorage.setItem(
                `product_cache_${slug}`,
                JSON.stringify({ data: fullData, timestamp: Date.now() }),
              )
            } catch {
              console.error("[product] cache save error")
            }
          }
        }

        if (categoriesCache) {
          if (!cancelled) setCategories(categoriesCache)
        } else {
          const categoriesResponse = await fetch("/api/categories")
          if (categoriesResponse.ok) {
            const categoriesData = await categoriesResponse.json()
            categoriesCache = categoriesData
            if (!cancelled) setCategories(categoriesData)
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "An unknown error occurred"
          if (msg !== "Product not found") console.error("Error fetching data:", err)
          setError(msg)
          setIsLoading(false)
        }
      }
    }
    fetchMinimal()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    const fetchRelated = async () => {
      if (!product) return
      setRelatedLoading(true)
      try {
        const charDesc = normalizeProductForSchema(product).charDesc
        const seen = new Set<string>([product.id])
        const pool: Product[] = []
        const add = (candidates: Product[]) => {
          for (const c of candidates) {
            if (!c?.id || seen.has(c.id)) continue
            seen.add(c.id)
            pool.push(c)
          }
        }
        const load = async (query: string): Promise<Product[]> => {
          const res = await fetch(`/api/products?${query}`)
          if (!res.ok) return []
          const body = await res.json()
          return Array.isArray(body) ? body : (body?.products ?? [])
        }

        // CHAR DESC is the closest match but a narrow key — most values cover only
        // a handful of products, so widen to the sub-category and then the
        // category rather than showing an empty rail.
        if (charDesc) add(await load(`limit=25&char_desc=${encodeURIComponent(charDesc)}`))

        if (pool.length < 20 && product.category) {
          const sameCategory = await load(
            `limit=60&fields=card&category=${encodeURIComponent(product.category)}`,
          )
          const sub = String((product as any).subCategory ?? "").toLowerCase()
          if (sub) add(sameCategory.filter((p) => String((p as any).subCategory ?? "").toLowerCase() === sub))
          add(sameCategory)
        }

        setRelatedProducts(pool.slice(0, 20))
      } catch (err) {
        console.error("Failed to load related products", err)
        setRelatedProducts([])
      } finally {
        setRelatedLoading(false)
      }
    }
    fetchRelated()
  }, [product])

  useEffect(() => {
    if (!product?.id) return
    analytics.viewItem(toAnalyticsItem(product, 1))
  }, [product?.id])

  useEffect(() => {
    if (!slug) return
    const recordView = async () => {
      try {
        if (user) {
          await fetch("/api/user/recently-viewed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: (user as unknown as Record<string, unknown>)._id || user.id,
              productId: slug,
            }),
          })
        } else {
          const recentIds = JSON.parse(localStorage.getItem("recently_viewed_ids") || "[]")
          const newIds = [slug, ...recentIds.filter((pid: string) => pid !== slug)].slice(0, 20)
          localStorage.setItem("recently_viewed_ids", JSON.stringify(newIds))
        }
      } catch (err) {
        console.error("Failed to record view", err)
      }
    }
    recordView()
  }, [slug, user])

  useEffect(() => {
    if (!user || !product) return
    let cancelled = false
    fetch(`/api/wishlist?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const items: Array<{ id?: string; _id?: string; [key: string]: unknown }> = d.items || []
        setIsWishlisted(items.some((p) => String(p.id || p._id) === String(product.id)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, product])

  const toggleWishlist = async () => {
    if (!user) {
      toast.error("Please login to save items")
      router.push(`/login?redirect=/product/${encodeURIComponent(slug)}`)
      return
    }
    if (!product) return
    setWishLoading(true)
    try {
      if (!isWishlisted) {
        const res = await fetch(`/api/wishlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, productId: product.id }),
        })
        if (res.status === 401) {
          // Global handler will toast + clear stale state
          return
        }
        const j = await res.json().catch(() => ({}))
        if (res.ok && j.added) {
          setIsWishlisted(true)
          toast.success("Added to wishlist")
        } else toast.error(j.message || "Failed to add to wishlist")
      } else {
        const res = await fetch(
          `/api/wishlist?userId=${encodeURIComponent(user.id)}&productId=${encodeURIComponent(product.id)}`,
          { method: "DELETE" },
        )
        if (res.status === 401) {
          // Global handler will toast + clear stale state
          return
        }
        const j = await res.json().catch(() => ({}))
        if (res.ok && j.removed) {
          setIsWishlisted(false)
          toast.success("Removed from wishlist")
        } else toast.error(j.message || "Failed to remove from wishlist")
      }
    } finally {
      setWishLoading(false)
    }
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value)
    if (value > 0 && product && value <= product.stock) setQuantity(value)
  }

  const handleAddToCart = async (redirectToCheckout = false) => {
    if (!product) return
    setAdding(redirectToCheckout ? "buy" : "cart")
    try {
      const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity,
        color: null as string | null,
        size: null as string | null,
      }
      await addToCart(cartItem)
      if (redirectToCheckout) {
        toast.success("Proceeding to checkout…")
        router.push("/checkout")
      } else {
        // Surface the side cart so the user can review the line item
        // (with the new "Just added" highlight), adjust qty, or proceed
        // to buy. This mirrors the Amazon post-add UX.
        setLastAddedId(product.id)
        openCart()
      }
    } finally {
      setAdding(null)
    }
  }

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const title = cleanProductName(product?.name) || "Product"
    // Use the same fall-back-aware description the page renders, capped
    // to 160 chars for share previews.
    const description = product ? ensureProductDescription(product).slice(0, 160) : ""
    const shareText = `${title}${companyName ? ` - ${companyName}` : ""}\n${description}`

    if (typeof navigator !== "undefined" && "canShare" in navigator && "share" in navigator) {
      try {
        let imageUrl = product?.image || (Array.isArray(product?.images) && product.images[0]) || ""
        if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
          imageUrl = window.location.origin + (imageUrl.startsWith("/") ? "" : "/") + imageUrl
        }
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const file = new File([blob], `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.jpg`, { type: blob.type })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText, title })
          toast.success("Shared successfully")
          return
        }
      } catch {
        // fallthrough
      }
    }

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${title} - ${companyName || ""}`.trim(), text: `${shareText}\n${url}` })
        toast.success("Shared successfully")
        return
      } catch {
        // fallthrough
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setShowMetaPreview(true)
      toast.success("Product link copied to clipboard")
      setTimeout(() => setShowMetaPreview(false), 4000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleWhatsAppShare = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    let imageUrl = product?.image || (Array.isArray(product?.images) && product.images[0]) || ""
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `${origin}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
    }
    const message = `*${cleanProductName(product?.name || "")}*\n\nPrice: ${formatINR(product?.price || 0)}\n\n${url}`
    const text = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${text}`, "_blank")
    toast.success("Opening WhatsApp…")
  }

  const getCategoryName = (categoryId: string | undefined) => {
    if (!categoryId) return null
    const formatLabel = (raw?: string | null) => {
      if (!raw) return raw
      return raw
        .toString()
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    }
    const category = categories.find((c) => c.id === categoryId)
    return category ? formatLabel(category.name) : formatLabel(categoryId)
  }

  const priceData = useMemo(() => {
    if (!product) return { dbMRP: null, disc: 0, saveAmt: 0 }
    const rawObj = (product as unknown as { raw?: { MRP?: unknown; mrp?: unknown } }).raw
    let rawMRP =
      product.mrp ??
      product.originalPrice ??
      rawObj?.MRP ??
      rawObj?.mrp
    let dbMRP = rawMRP ? Number(rawMRP) : null
    if (!dbMRP || isNaN(dbMRP) || dbMRP <= 0) dbMRP = null
    const salePriceForDiscount = product.price > 0 ? product.price : Math.abs(product.price) || 1
    if (dbMRP && dbMRP <= salePriceForDiscount) dbMRP = null
    const disc = dbMRP ? calculateDiscount(dbMRP, salePriceForDiscount) : 0
    const saveAmt = dbMRP ? Math.max(0, dbMRP - salePriceForDiscount) : 0
    return { dbMRP, disc, saveAmt }
  }, [product])

  // ──────────── Loading state ────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="flex flex-col justify-center items-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600" />
            <p className="text-gray-500 animate-pulse">Loading product…</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ──────────── Error state ────────────
  if (error || !product) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow flex items-center justify-center px-4 py-12">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
            <p className="text-gray-500 mb-8">
              The product you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/products">
                <button className="bg-brand-primary hover:bg-brand-primary-hover text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-brand-primary/20">
                  <ArrowLeft className="h-4 w-4" />
                  Browse All Products
                </button>
              </Link>
              <Link href="/">
                <button className="border border-gray-300 text-gray-700 hover:bg-gray-100 px-6 py-3 rounded-xl flex items-center gap-2 transition-colors">
                  Go to Home
                </button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const categoryName = getCategoryName(product.category)
  const safeName = cleanProductName(product.name)
  // Always show a meaningful Product Description block — fall back to a
  // generated description when the DB has nothing useful.
  const cleanDescription = ensureProductDescription(product)

  const galleryImages = Array.from(
    new Set(
      [
        ...(Array.isArray(product.specification_images) ? product.specification_images : []),
        ...(Array.isArray(product.images) ? product.images : []),
        product.image,
      ].filter(Boolean),
    ),
  ).filter(
    (img) =>
      typeof img === "string" &&
      !img.includes("transparent-pixel..jpg") &&
      !img.includes("placeholder.svg") &&
      !img.includes("modern-laptop-workspace.png"),
  )

  const featuresList = (Array.isArray(product.features) ? product.features : [])
    .filter((f) => typeof f === "string" && f.trim())

  const includedList = (Array.isArray(product.included_components) ? product.included_components : [])
    .filter((f) => typeof f === "string" && f.trim())

  // `reviews` arrives either as a bare array or wrapped as `{ top, average, count }`.
  // Only the array form was reaching the reviews section before, so products with
  // scraped reviews rendered "No reviews yet".
  const reviewTop = Array.isArray(product.reviews)
    ? product.reviews
    : Array.isArray(product.reviews?.top)
      ? product.reviews.top
      : null
  const wrapped = product.reviews && !Array.isArray(product.reviews) ? product.reviews : null
  const seedRatings = (reviewTop ?? [])
    .map((r: any) => (typeof r?.rating === "number" ? r.rating : parseFloat(String(r?.rating ?? "").match(/\d+\.?\d*/)?.[0] ?? "")))
    .filter((n: number) => Number.isFinite(n) && n > 0)
  const reviewAverage =
    wrapped?.average ??
    (seedRatings.length ? Math.round((seedRatings.reduce((a: number, b: number) => a + b, 0) / seedRatings.length) * 10) / 10 : 0)
  const reviewCount = wrapped?.count ?? (reviewTop?.length ?? 0)

  const pageUrl = `/product/${product.slug || product.id}`
  const imageUrl = product.image && product.image.startsWith("http") ? product.image : `/og-image.jpg`

  const inStock = product.stock > 0
  const lowStock = inStock && product.stock <= 5
  const isTrusted = !!product.trusted
  const freeDelivery = product.free_delivery ?? product.price >= 499
  // Checkout offers online and in-store only, so COD must be opt-in per product.
  const codAvailable = product.cod_available ?? false

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F8FA]">
      <Header />

      <ProductJsonLd product={product} companyName={companyName || ""} pageUrl={pageUrl} imageUrl={imageUrl} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Products", url: "/products" },
          ...(categoryName ? [{ name: categoryName, url: `/products?category=${product.category}` }] : []),
          { name: safeName, url: pageUrl },
        ]}
      />

      <motion.main
        className="flex-grow"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 max-w-[1400px]">
          {/* ──────────── BREADCRUMB ──────────── */}
          <nav aria-label="Breadcrumb" className="flex items-center text-[12px] sm:text-[13px] text-gray-500 mb-4 md:mb-6 flex-wrap gap-y-1">
            <Link href="/" className="hover:text-brand-primary transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3 mx-1 text-gray-300" />
            <Link href="/products" className="hover:text-brand-primary transition-colors">Products</Link>
            {categoryName && (
              <>
                <ChevronRight className="h-3 w-3 mx-1 text-gray-300" />
                <Link href={`/products?category=${product.category}`} className="hover:text-brand-primary transition-colors">
                  {categoryName}
                </Link>
              </>
            )}
            <ChevronRight className="h-3 w-3 mx-1 text-gray-300" />
            <span className="text-gray-700 truncate max-w-[60ch] font-medium">{safeName}</span>
          </nav>

          {/* ──────────── TOP HERO: Gallery + Info + Buy Box ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
            {/* LEFT — Gallery */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-20">
                <Gallery
                  images={galleryImages}
                  name={safeName}
                  trusted={isTrusted}
                  discount={priceData.disc}
                />

                {/* Compact share row (under gallery, desktop only) */}
                <div className="hidden lg:flex items-center gap-2 mt-4 text-[13px] text-gray-500">
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 hover:text-brand-primary transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  <button
                    onClick={handleWhatsAppShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors"
                  >
                    <FaWhatsapp className="h-3.5 w-3.5" /> WhatsApp
                  </button>
                  <Link
                    href={`/products?category=${product.category}`}
                    className="ml-auto inline-flex items-center gap-1 text-brand-primary hover:text-brand-primary-hover font-medium"
                  >
                    More from {categoryName || "this category"} <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* MIDDLE — Product info */}
            <div className="lg:col-span-4 space-y-4 lg:space-y-5">
              {/* Brand + title + badges */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
                {categoryName && (
                  <Link
                    href={`/products?category=${product.category}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary bg-brand-primary-subtle hover:bg-brand-primary-light px-2.5 py-1 rounded-full uppercase tracking-wider mb-2.5 transition-colors ring-1 ring-brand-primary/20"
                  >
                    <Package className="h-3 w-3" />
                    {categoryName}
                  </Link>
                )}

                {product.brand && (
                  <Link
                    href={`/products?brand=${encodeURIComponent(product.brand)}`}
                    className="text-[13px] font-semibold text-brand-primary hover:underline uppercase tracking-wide mb-1 inline-block"
                  >
                    {product.brand}
                  </Link>
                )}

                <h1 className="text-[19px] md:text-[22px] font-bold text-gray-900 leading-snug tracking-tight">
                  {showFullName || safeName.length <= 120 ? safeName : `${safeName.slice(0, 120)}…`}
                </h1>
                {safeName.length > 120 && (
                  <button
                    onClick={() => setShowFullName(!showFullName)}
                    className="mt-1 text-brand-primary hover:text-brand-primary-hover text-[12px] font-semibold inline-flex items-center gap-1"
                  >
                    {showFullName ? "Show less" : "Read more"}
                    <ChevronRight className={`h-3 w-3 transition-transform ${showFullName ? "rotate-[-90deg]" : "rotate-90"}`} />
                  </button>
                )}

                {/* Rating · Reviews · Badges */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {reviewAverage >= 1 && (
                    <button
                      onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-sm shadow-amber-200/50 hover:from-amber-500 hover:to-orange-500 transition-colors"
                      aria-label="See all reviews"
                    >
                      <span>{reviewAverage.toFixed(1)}</span>
                      <Star className="h-3 w-3 fill-white" />
                      {reviewCount > 0 && (
                        <span className="text-white/90 font-medium">{(reviewCount).toLocaleString("en-IN")}</span>
                      )}
                    </button>
                  )}
                  {inStock && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      In stock
                    </span>
                  )}
                  {priceData.disc >= 20 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-gradient-to-r from-rose-50 to-pink-50 text-rose-600 ring-1 ring-rose-200/60 uppercase tracking-wide">
                      <TrendingUp className="h-3 w-3" />
                      Bestseller
                    </span>
                  )}
                  {isTrusted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 uppercase tracking-wide">
                      <Award className="h-3 w-3" />
                      Trusted
                    </span>
                  )}
                </div>

                {lowStock && (
                  <motion.p
                    animate={{ opacity: [1, 0.55, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-orange-600 font-bold"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Hurry — only {product.stock} left in stock!
                  </motion.p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                  {product.sku && (
                    <span>
                      SKU: <span className="font-semibold text-gray-700">{product.sku}</span>
                    </span>
                  )}
                  {categoryName && (
                    <span>
                      Category:{" "}
                      <Link
                        href={`/products?category=${product.category}`}
                        className="font-semibold text-gray-700 hover:text-brand-primary"
                      >
                        {categoryName}
                      </Link>
                    </span>
                  )}
                </div>
              </div>

              {/* Price block (compact for middle column) */}
              {/* <PriceBlock
                price={product.price}
                dbMRP={priceData.dbMRP}
                disc={priceData.disc}
                saveAmt={priceData.saveAmt}
                variant="info"
              /> */}

              {/* Delivery highlight */}
              <DeliveryHighlight inStock={inStock} freeDelivery={freeDelivery} />

              {/* EMI & bank offers. Rates are local until Pine Labs is wired up. */}
              {product.emi_available !== false && (
                <EmiCalculator price={product.price} productName={safeName} productId={product.id} />
              )}

              {/* Highlights / About this item */}
              {featuresList.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
                  <h2 className="text-[15px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-brand-primary" />
                    About this item
                  </h2>
                  <ul className="space-y-2.5">
                    {featuresList.slice(0, 6).map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[13.5px] text-gray-700 leading-relaxed"
                      >
                        <Check className="h-4 w-4 text-brand-primary mt-0.5 flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Product description (collapsed, Amazon-style) */}
              {/* {cleanDescription && (
                <ProductDescriptionBlock
                  description={cleanDescription}
                  overview={product.overview}
                />
              )} */}

              {/* Site features (delivery benefits) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
                <SiteFeatures />
              </div>
            </div>

            {/* RIGHT — Buy box (sticky) */}
            <div className="lg:col-span-3">
              <div className="lg:sticky lg:top-20 space-y-4">
                <BuyBox
                  product={product}
                  price={product.price}
                  dbMRP={priceData.dbMRP}
                  disc={priceData.disc}
                  saveAmt={priceData.saveAmt}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  handleQuantityChange={handleQuantityChange}
                  onAddToCart={() => handleAddToCart(false)}
                  onBuyNow={() => handleAddToCart(true)}
                  isWishlisted={isWishlisted}
                  wishLoading={wishLoading}
                  toggleWishlist={toggleWishlist}
                  onShare={handleShare}
                  onWhatsAppShare={handleWhatsAppShare}
                  adding={adding}
                  freeDelivery={freeDelivery}
                  codAvailable={codAvailable}
                />
              </div>
            </div>
          </div>

          {/* ──────────── BELOW THE FOLD ──────────── */}
          <div className="mt-8 md:mt-12 pt-8 md:pt-10 border-t border-gray-200/60 space-y-6 md:space-y-8">
            {relatedProducts.length > 0 && (
              <FrequentlyBoughtTogether
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image: product.image,
                  slug: product.slug,
                }}
                candidates={relatedProducts.map((rp) => ({
                  id: rp.id,
                  name: rp.name,
                  price: rp.price,
                  image: rp.image,
                  slug: rp.slug,
                  stock: rp.stock,
                }))}
              />
            )}

            {/* Compare with similar items (3-up grid) */}
            {(relatedLoading || relatedProducts.length >= 3) && (
              <CompareWithSimilar
                products={relatedProducts.slice(0, 3)}
                loading={relatedLoading}
              />
            )}

            {/* Full About this item */}
            {featuresList.length > 6 && (
              <Section id="about" icon={<ListChecks className="h-5 w-5 text-brand-primary" />} title="About this item" subtitle="Key features and highlights">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {featuresList.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[14px] text-gray-700 leading-relaxed">
                      <Check className="h-4 w-4 text-emerald-600 mt-1 flex-shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* From the manufacturer (image gallery) */}
            {/* {Array.isArray(product.specification_images) && product.specification_images.length > 0 && (
              <Section id="from-manufacturer" icon={<Building2 className="h-5 w-5 text-brand-primary" />} title="From the manufacturer" subtitle="Brand-supplied imagery and feature walkthrough">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {product.specification_images.slice(0, 6).map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-gray-100 hover:border-brand-primary/40 hover:shadow-lg transition-all bg-white"
                    >
                      <img
                        src={img}
                        alt={`Manufacturer image ${idx + 1}`}
                        className="w-full h-auto object-contain"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
                {product.from_manufacturer && typeof product.from_manufacturer === "string" && (
                  <details className="mt-4 group">
                    <summary className="cursor-pointer text-sm font-semibold text-brand-primary hover:text-brand-primary-hover flex items-center gap-1.5 list-none">
                      <span>Read full manufacturer description</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-3 p-4 rounded-xl bg-gray-50 border border-gray-100 text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-line max-h-80 overflow-y-auto">
                      {product.from_manufacturer}
                    </div>
                  </details>
                )}
              </Section>
            )} */}

            {/* Technical Specifications (table) */}
            {/* {product.technical_details && Object.keys(product.technical_details).length > 0 && (
              <Section id="specs" icon={<Layers className="h-5 w-5 text-brand-primary" />} title="Technical Details" subtitle="Detailed specifications and product data">
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="min-w-full divide-y divide-gray-100 text-[13.5px]">
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(product.technical_details as Record<string, unknown>)
                        .filter(([k]) => {
                          const n = k.replace(/[\s_]/g, "").toLowerCase()
                          return !["url", "source", "sourceurl", "asin", "customerreviews", "bestsellersrank", "datefirstavailable", "includedcomponents", "specialfeature", "specialfeatures"].includes(n)
                        })
                        .map(([key, value], idx) => (
                          <tr key={key} className={idx % 2 === 0 ? "bg-gray-50/60" : "bg-white"}>
                            <td className="px-4 py-3 font-semibold text-gray-800 w-1/3 align-top">
                              {String(key).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </td>
                            <td className="px-4 py-3 text-gray-700 align-top break-words">
                              {typeof value === "object" && value !== null
                                ? JSON.stringify(value)
                                : String(value)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )} */}

            {/* What's in the box */}
            {/* {includedList.length > 0 && (
              <Section id="included" icon={<Box className="h-5 w-5 text-brand-primary" />} title="What's in the box" subtitle="Items included with this product">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {includedList.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50/60 border border-gray-100 text-[13.5px] text-gray-700">
                      <Boxes className="h-4 w-4 text-brand-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )} */}

            {/* Important information (sourcing & disclaimers) */}
            {/* <Section id="info" icon={<Info className="h-5 w-5 text-brand-primary" />} title="Important information" subtitle="Warranty, safety & legal information">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px] text-gray-700">
                <div className="p-4 rounded-xl bg-gray-50/60 border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-brand-primary" /> Warranty
                  </h4>
                  <p>Backed by the manufacturer&apos;s warranty. Contact our support team for claims and replacements.</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50/60 border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Repeat2 className="h-4 w-4 text-brand-primary" /> 7-Day Replacement
                  </h4>
                  <p>If you receive a defective or damaged unit, request a free replacement within 7 days of delivery.</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50/60 border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-brand-primary" /> Secure Payments
                  </h4>
                  <p>All transactions are encrypted via Razorpay. Pay safely with UPI, cards, Net Banking, or COD.</p>
                </div>
              </div>
            </Section> */}

            {/* Suggested products sit above reviews: a shopper who isn't sold on
                this item should meet alternatives before a wall of reviews. */}
            {(relatedLoading || relatedProducts.length > 0) && (
              <Section
                id="also-viewed"
                icon={<Repeat2 className="h-5 w-5 text-brand-primary" />}
                title="Customers who viewed this also viewed"
                subtitle={`Based on the ${categoryName || "category"} you&apos;re browsing`}
              >
                {relatedLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2 py-2 scrollbar-hide">
                    <div className="flex gap-4 px-2">
                      {relatedProducts.slice(0, 8).map((rp) => (
                        <div key={rp.id} className="w-52 sm:w-60 flex-shrink-0">
                          <CategoryProductCard product={rp as any} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Related products marquee */}
            {(relatedLoading || relatedProducts.length > 8) && (
              <Section
                id="related"
                icon={<Tag className="h-5 w-5 text-brand-primary" />}
                title="Products related to this item"
                subtitle="More choices to explore in the same category"
              >
                {relatedLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2 py-2 scrollbar-hide">
                    <div className="flex gap-4 px-2">
                      {relatedProducts.slice(8, 20).map((rp) => (
                        <div key={rp.id} className="w-60 flex-shrink-0">
                          <CategoryProductCard product={rp as any} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Reviews now live in the REVIEWS tab of the specification section below. */}

            {/* Q&A */}
            <CustomerQASection
              productId={product.id}
              productName={safeName}
              seedItems={Array.isArray(product.qa) ? product.qa : null}
            />

            {/* Recently Viewed */}
            <div>
              <RecentlyViewed excludeId={product.id} />
            </div>
          </div>

          {/* Legacy admin tab (hidden unless admin) — kept for compatibility */}
          <div className="mt-6">
            <ProductSpecificationTabs
              technicalDetails={product.technical_details}
              fromManufacturer={product.from_manufacturer}
              specificationImages={product.specification_images}
              productDescription={product.description}
              sku={product.sku}
              reviews={reviewTop}
              productId={product.id}
              productName={safeName}
              productImage={product.image}
              reviewAverage={reviewAverage}
              reviewCount={reviewCount}
              overview={product.overview}
              includedComponents={product.included_components}
              features={product.features}
              mrp={product.mrp}
            />
          </div>
        </div>

        {/* Sticky mobile buy bar */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-3 py-2.5 flex items-center gap-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col leading-tight pr-1">
            <span className="text-base font-extrabold text-gray-900">{formatINR(product.price)}</span>
            {priceData.dbMRP && priceData.disc > 0 && (
              <span className="text-[11px] text-emerald-600 font-semibold">{priceData.disc}% off</span>
            )}
          </div>
          <button
            onClick={() => handleAddToCart(false)}
            disabled={adding !== null}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-brand-accent hover:bg-brand-accent-hover text-white flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
          >
            <ShoppingCart className="h-4 w-4" />
            Add
          </button>
          <button
            onClick={() => handleAddToCart(true)}
            disabled={adding !== null}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
          >
            <Zap className="h-4 w-4" />
            Buy Now
          </button>
        </div>
        <div className="lg:hidden h-20" />
      </motion.main>
      <Footer />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function PriceBlock({
  price,
  dbMRP,
  disc,
  saveAmt,
  variant = "info",
}: {
  price: number
  dbMRP: number | null
  disc: number
  saveAmt: number
  variant?: "info" | "buybox"
}) {
  const compact = variant === "buybox"
  return (
    <div
      className={`rounded-2xl border border-gray-100 shadow-sm ${
        compact ? "bg-white p-4" : "bg-gradient-to-br from-slate-50 via-brand-primary-subtle to-brand-primary-light/40 border-brand-primary/15 p-5"
      }`}
    >
      <div className="space-y-2">
        {dbMRP && disc > 0 && (
          <div className="inline-flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-white bg-gradient-to-r from-red-500 to-rose-500 px-2 py-0.5 rounded-md shadow-sm shadow-red-200/50">
              {disc}% OFF
            </span>
            {disc >= 30 && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-wide ring-1 ring-red-100">
                Limited Deal
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2.5">
          <span className={`font-extrabold text-gray-900 tracking-tight leading-none tabular-nums ${compact ? "text-2xl" : "text-3xl md:text-4xl"}`}>
            {formatINR(price)}
          </span>
          {dbMRP && (
            <span className="text-sm text-gray-400 line-through font-medium pb-0.5">{formatINR(dbMRP)}</span>
          )}
        </div>

        {dbMRP && saveAmt > 0 && (
          <p className="inline-flex items-center gap-1 text-[12px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded ring-1 ring-emerald-200/60">
            <BadgeCheck className="h-3 w-3" />
            You save {formatINR(saveAmt)}
          </p>
        )}

        <p className="text-[10px] text-gray-400">Inclusive of all taxes</p>
      </div>
    </div>
  )
}

function DeliveryHighlight({ inStock, freeDelivery }: { inStock: boolean; freeDelivery: boolean }) {
  if (!inStock) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
        <div className="bg-rose-50 text-rose-600 p-2 rounded-lg">
          <X className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Currently unavailable</p>
          <p className="text-xs text-gray-500">We don&apos;t know when or if this item will be back in stock.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg flex-shrink-0">
          <Truck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-gray-900">
            {freeDelivery ? "FREE delivery" : "Standard delivery"} —{" "}
            <span className="text-emerald-700">Get it by {formatDeliveryDate(2)} – {formatDeliveryDate(5)}</span>
          </p>
          <p className="text-[11px] text-gray-500">Fastest delivery to your pincode. Order within 4 hrs 12 mins.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
          <ShieldCheck className="h-4 w-4 text-brand-primary flex-shrink-0" />
          <span className="text-[11px] text-gray-700">7-day replacement</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
          <Lock className="h-4 w-4 text-brand-primary flex-shrink-0" />
          <span className="text-[11px] text-gray-700">Secure transaction</span>
        </div>
      </div>
    </div>
  )
}

function ProductDescriptionBlock({
  description,
  overview,
}: {
  description: string
  overview?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const text = (overview && overview !== description) ? `${overview}\n\n${description}` : description
  const truncated = text.length > 400
  const visible = expanded || !truncated ? text : `${text.slice(0, 400)}…`
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <h2 className="text-[15px] font-bold text-gray-900 mb-2 flex items-center gap-2">
        <Info className="h-4 w-4 text-brand-primary" />
        Product Description
      </h2>
      <p className="text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-line">{visible}</p>
      {truncated && (
        <button
          onClick={() => setExpanded((s) => !s)}
          className="mt-2 text-brand-primary hover:text-brand-primary-hover text-[13px] font-semibold inline-flex items-center gap-1"
        >
          {expanded ? "Read less" : "Read full description"}
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-[-90deg]" : "rotate-90"}`} />
        </button>
      )}
    </div>
  )
}

function BuyBox({
  product,
  price,
  dbMRP,
  disc,
  saveAmt,
  quantity,
  setQuantity,
  handleQuantityChange,
  onAddToCart,
  onBuyNow,
  isWishlisted,
  wishLoading,
  toggleWishlist,
  onShare,
  onWhatsAppShare,
  adding,
  freeDelivery,
  codAvailable,
}: {
  product: Product
  price: number
  dbMRP: number | null
  disc: number
  saveAmt: number
  quantity: number
  setQuantity: (n: number) => void
  handleQuantityChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAddToCart: () => void
  onBuyNow: () => void
  isWishlisted: boolean
  wishLoading: boolean
  toggleWishlist: () => void
  onShare: () => void
  onWhatsAppShare: () => void
  adding: "cart" | "buy" | null
  freeDelivery: boolean
  codAvailable: boolean
}) {
  const inStock = product.stock > 0
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-brand-primary via-blue-400 to-brand-accent" />
      <div className="p-5 space-y-4">
        {/* Price (compact) */}
        <PriceBlock
          price={price}
          dbMRP={dbMRP}
          disc={disc}
          saveAmt={saveAmt}
          variant="buybox"
        />

        {/* Delivery date */}
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 flex items-start gap-2.5">
          <Calendar className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="text-[12.5px]">
            <p className="font-semibold text-gray-900">
              {freeDelivery ? "FREE Delivery" : "Standard Delivery"} by{" "}
              <span className="text-emerald-700">{formatDeliveryDate(3)}</span>
            </p>
            <p className="text-gray-600 text-[11px]">Order in the next 4 hrs to ship today</p>
          </div>
        </div>

        {/* Stock status */}
        {inStock ? (
          <p className="text-[12px] text-emerald-700 font-semibold inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> In Stock
          </p>
        ) : (
          <p className="text-[12px] text-rose-600 font-semibold">Currently unavailable</p>
        )}

        {/* Quantity selector */}
        {inStock && (
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-gray-500 font-medium">Quantity:</span>
            <div className="inline-flex items-center bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                value={quantity}
                onChange={handleQuantityChange}
                className="w-10 h-9 text-center text-sm font-bold text-gray-900 bg-white border-x border-gray-200 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none"
                aria-label="Quantity"
              />
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {product.stock <= 10 && (
              <span className="text-[11px] text-orange-600 font-semibold">
                Only {product.stock} left
              </span>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <div className="space-y-2.5">
          <motion.button
            onClick={onAddToCart}
            disabled={!inStock || adding !== null}
            whileHover={{ scale: inStock ? 1.01 : 1, y: inStock ? -1 : 0 }}
            whileTap={{ scale: inStock ? 0.98 : 1 }}
            className="w-full py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white shadow-md shadow-brand-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {adding === "cart" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </>
            )}
          </motion.button>
          <motion.button
            onClick={onBuyNow}
            disabled={!inStock || adding !== null}
            whileHover={{ scale: inStock ? 1.01 : 1, y: inStock ? -1 : 0 }}
            whileTap={{ scale: inStock ? 0.98 : 1 }}
            className="w-full py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white shadow-md shadow-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {adding === "buy" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Buy Now
              </>
            )}
          </motion.button>
        </div>

        {/* Wishlist + Share row */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={toggleWishlist}
            disabled={wishLoading}
            className={`py-2 rounded-lg text-[12px] font-semibold border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${
              isWishlisted
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : "bg-white border-gray-200 text-gray-700 hover:border-brand-primary/40 hover:text-brand-primary"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isWishlisted ? "fill-rose-500" : ""}`} />
            {isWishlisted ? "Saved" : "Wishlist"}
          </button>
          <button
            onClick={onShare}
            className="py-2 rounded-lg text-[12px] font-semibold border bg-white border-gray-200 text-gray-700 hover:border-brand-primary/40 hover:text-brand-primary flex items-center justify-center gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={onWhatsAppShare}
            className="py-2 rounded-lg text-[12px] font-semibold border bg-white border-gray-200 text-gray-700 hover:border-green-500 hover:text-green-600 flex items-center justify-center gap-1.5"
          >
            <FaWhatsapp className="h-3.5 w-3.5" />
            WhatsApp
          </button>
        </div>

        {/* Secure transaction */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 pt-1">
          <Lock className="h-3 w-3" />
          <span>Secure transaction · SSL encrypted</span>
        </div>
      </div>

      {/* Ships from / Sold by / Returns */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60">
        <div className="p-3 text-center">
          <Building2 className="h-4 w-4 text-gray-500 mx-auto mb-1" />
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Ships from</p>
          <p className="text-[11.5px] font-semibold text-gray-800 mt-0.5">Sara Electronics</p>
        </div>
        <div className="p-3 text-center">
          <Verified className="h-4 w-4 text-gray-500 mx-auto mb-1" />
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Sold by</p>
          <p className="text-[11.5px] font-semibold text-gray-800 mt-0.5">Sara Electronics</p>
        </div>
        <div className="p-3 text-center">
          <Repeat2 className="h-4 w-4 text-gray-500 mx-auto mb-1" />
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Returns</p>
          <p className="text-[11.5px] font-semibold text-gray-800 mt-0.5">7-day policy</p>
        </div>
      </div>

      {/* Payment methods */}
      <div className="p-4 border-t border-gray-100">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" /> Payment options
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { icon: <Wallet className="h-3.5 w-3.5" />, label: "UPI" },
            { icon: <CreditCard className="h-3.5 w-3.5" />, label: "Cards" },
            { icon: <Banknote className="h-3.5 w-3.5" />, label: "Net Banking" },
            ...(codAvailable ? [{ icon: <Banknote className="h-3.5 w-3.5" />, label: "COD" }] : []),
          ].map((m) => (
            <span
              key={m.label}
              className="inline-flex items-center gap-1 text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-1"
            >
              {m.icon}
              {m.label}
            </span>
          ))}
        </div>
        {freeDelivery && (
          <p className="mt-2 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <Truck className="h-3 w-3" /> FREE delivery on this order
          </p>
        )}
      </div>
    </div>
  )
}

function Section({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  id?: string
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-7"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-brand-primary-subtle text-brand-primary flex items-center justify-center ring-1 ring-brand-primary/15">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base md:text-lg font-bold text-gray-900 tracking-tight leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[12.5px] text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function CompareWithSimilar({
  products,
  loading,
}: {
  products: Product[]
  loading: boolean
}) {
  if (loading) {
    return (
      <Section
        icon={<Repeat2 className="h-5 w-5 text-brand-primary" />}
        title="Compare with similar items"
        subtitle="Side-by-side alternatives our customers considered"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-72 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </Section>
    )
  }
  if (products.length === 0) return null
  return (
    <Section
      id="compare"
      icon={<Repeat2 className="h-5 w-5 text-brand-primary" />}
      title="Compare with similar items"
      subtitle="Side-by-side alternatives our customers considered"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <CategoryProductCard key={p.id} product={p as any} />
        ))}
      </div>
    </Section>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Gallery (Amazon-style vertical thumbnails + main + lightbox)
// ──────────────────────────────────────────────────────────────────────────────

function Gallery({
  images,
  name,
  trusted,
  discount,
}: {
  images: string[]
  name: string
  trusted?: boolean
  discount?: number
}) {
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")
  const safeImages = images.filter(Boolean)
  const current = safeImages[active] || "/placeholder.svg?height=600&width=600"
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleZoomMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigin(`${x}% ${y}%`)
  }

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false)
      if (e.key === "ArrowRight") setActive((p) => (p + 1) % safeImages.length)
      if (e.key === "ArrowLeft") setActive((p) => (p - 1 + safeImages.length) % safeImages.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightboxOpen, safeImages.length])

  // Auto-advance until the shopper takes over. Without this guard the carousel
  // swaps the image out from under a hover-zoom or an open lightbox.
  useEffect(() => {
    if (safeImages.length <= 1 || interacted || zoom || lightboxOpen) return
    timeoutRef.current && clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % safeImages.length)
    }, 5000)
    return () => {
      timeoutRef.current && clearTimeout(timeoutRef.current)
    }
  }, [active, safeImages.length, interacted, zoom, lightboxOpen])

  const select = (index: number) => {
    setInteracted(true)
    setActive(index)
  }

  const handlePrev = () => select((active - 1 + safeImages.length) % safeImages.length)
  const handleNext = () => select((active + 1) % safeImages.length)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-brand-primary via-blue-400 to-brand-accent" />
      <div className="p-3 md:p-4 flex gap-3 md:gap-4 relative">
        {/* Thumbnails (vertical) — desktop only */}
        {safeImages.length > 1 && (
          <div className="hidden md:flex flex-col gap-2 w-16 lg:w-20 items-center max-h-[500px] overflow-y-auto scrollbar-hide">
            {safeImages.map((src, i) => (
              <button
                key={i}
                onClick={() => select(i)}
                aria-label={`Show image ${i + 1}`}
                className={`border-2 rounded-md p-0.5 focus:outline-none transition-colors ${
                  i === active ? "border-brand-primary" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <img
                  src={src}
                  alt={`thumbnail ${i + 1}`}
                  loading="lazy"
                  width={64}
                  height={64}
                  className="h-14 w-14 lg:h-16 lg:w-16 object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=64&width=64"
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div className="flex-1 flex items-center justify-center relative">
          {trusted && (
            <div className="absolute left-3 top-3 z-20 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">Trusted</span>
            </div>
          )}
          {typeof discount === "number" && discount >= 20 && (
            <div className="absolute left-3 top-12 md:top-3 md:left-auto md:right-3 z-20 bg-gradient-to-r from-red-500 to-rose-500 text-white px-2.5 py-1.5 rounded-lg shadow-md text-xs font-bold">
              {discount}% OFF
            </div>
          )}

          <button
            onClick={() => setLightboxOpen(true)}
            aria-label="View fullscreen"
            className="absolute right-3 bottom-3 z-20 bg-white/90 hover:bg-white text-gray-600 hover:text-brand-primary rounded-full shadow p-2 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            onClick={handlePrev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow p-2 z-10"
            style={{ display: safeImages.length > 1 ? "block" : "none" }}
          >
            <svg width="20" height="20" fill="none" stroke="#2A7FFF" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div
            className="w-full flex items-center justify-center overflow-hidden cursor-zoom-in"
            style={{ maxHeight: "520px" }}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleZoomMove}
            onClick={() => setLightboxOpen(true)}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={current}
                src={current}
                alt={name}
                initial={{ opacity: 0, scale: 0.95 }}
                // Zoom has to ride on motion's own transform; a `scale()` set
                // through `style` is overwritten by the animation every frame.
                animate={{ opacity: 1, scale: zoom ? 1.8 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                width={600}
                height={520}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full h-auto object-contain"
                style={{
                  maxHeight: "520px",
                  transformOrigin: origin,
                }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=600&width=600"
                }}
              />
            </AnimatePresence>
          </div>

          <button
            onClick={handleNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow p-2 z-10"
            style={{ display: safeImages.length > 1 ? "block" : "none" }}
          >
            <svg width="20" height="20" fill="none" stroke="#2A7FFF" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile-only horizontal thumbnails */}
      {safeImages.length > 1 && (
        <div className="md:hidden mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {safeImages.map((src, i) => (
            <button
              key={i}
              onClick={() => select(i)}
              aria-label={`Show image ${i + 1}`}
              className={`flex-shrink-0 border-2 rounded-md p-0.5 transition-colors ${
                i === active ? "border-brand-primary" : "border-gray-200"
              }`}
            >
              <img
                src={src}
                alt={`thumbnail ${i + 1}`}
                loading="lazy"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=56&width=56"
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Image lightbox"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setLightboxOpen(false)
              }}
              aria-label="Close"
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-7 w-7" />
            </button>
            {safeImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrev()
                }}
                aria-label="Previous image"
                className="absolute left-4 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <img
              src={current}
              alt={name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[90vw] object-contain select-none"
            />
            {safeImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                aria-label="Next image"
                className="absolute right-4 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {safeImages.length > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
                {active + 1} / {safeImages.length}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
