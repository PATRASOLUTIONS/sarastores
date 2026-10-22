"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Heart,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductLoading from "@/components/product/ProductLoading"
import ProductSpecificationTabs from "@/components/ProductSpecificationTabs"
import { RailCards, Stars } from "@/components/product/PdpBlocks"
import ProductReviewsSection from "@/components/ProductReviewsSection"
import RazorpayOffers from "@/components/product/RazorpayOffers"
import { useRazorpayOffers } from "@/hooks/useRazorpayOffers"
import { applicableOffers, isEmiOffer } from "@/lib/razorpay-offers"
import { useBanners } from "@/hooks/useBanners"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { useSettingsData } from "@/hooks/useSettingsData"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingStatus } from "@/components/marketing/MarketingSections"
import { cleanProductName, cleanProductDescription, toastProductName } from "@/utils/cleanProductName"
import { productSuggestions, similarProducts, catalogProductResponseSchema, type CatalogProduct } from "@/utils/catalog"
import { useAuth } from "@/contexts/AuthContext"
import { recordRecentlyViewed } from "@/lib/recently-viewed-client"
import { productSpecificationResponseSchema } from "@/lib/product-specification-response"
import { productDetailResponseSchema, type ProductDetailResponse } from "@/lib/product-card-response"
import { z } from "zod"
import {
  calculateDiscount,
  getEffectiveMRP,
  titleCaseLabel,
} from "@/lib/product-display"

type Product = ProductDetailResponse

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "specifications", label: "Specifications" },
  { id: "product-images", label: "Product Images" },
  { id: "in-the-box", label: "In the Box" },
  { id: "offers", label: "Offers" },
  { id: "emi", label: "EMI Options" },
  { id: "reviews", label: "Reviews" },
  { id: "faqs", label: "FAQs" },
]

const TRUST = [
  { icon: RefreshCw, label: "Returns Policy" },
  { icon: ShieldCheck, label: "Brand Warranty" },
  { icon: BadgeCheck, label: "100% Genuine" },
  { icon: CreditCard, label: "Secure Payment" },
]

const FAQS = [
  {
    q: "Is this product covered by the manufacturer warranty?",
    a: "Warranty coverage and duration depend on the product and manufacturer. Check the Specifications tab and retain your SARA invoice. Contact us if warranty details have not been supplied.",
  },
  {
    q: "Do you install it for me?",
    a: "Installation availability, charges and scheduling depend on the product and manufacturer. Contact SARA before ordering if you need installation assistance.",
  },
  {
    q: "Can I pay in instalments?",
    a: "Available EMI offers are supplied by Razorpay. Your bank confirms eligible cards, tenure, interest and processing fees at checkout before you pay.",
  },
  {
    q: "What if it arrives damaged?",
    a: "Contact SARA promptly with your order number and photographs. Returns and replacements follow our cancellation and returns policy. Do not accept a package that arrives visibly tampered with.",
  },
  {
    q: "Can I collect it from a store instead?",
    a: "Yes. Reserve online and collect from your nearest SARA store — there are stores across Karnataka, listed on our store locator.",
  },
]

/** Bullet-style feature lines rescued from whatever copy the catalogue actually has. */
function deriveFeatures(product: Product): string[] {
  const explicit = Array.isArray(product?.features) ? product.features.filter(Boolean) : []
  if (explicit.length > 0) return explicit.map(String)

  const chars = Array.isArray(product?.characteristics) ? product.characteristics.filter(Boolean) : []
  if (chars.length > 0) return chars.map(String)

  return cleanProductDescription(product?.description || "")
    .split(/(?:\.\s+|\n|•|\u2022)/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 24 && s.length < 160)
    .slice(0, 6)
}

const STORAGE_VARIANT = /(?:\(\s*)?\d+(?:\.\d+)?\s*(?:MB|GB|TB)(?:\s*\+\s*\d+(?:\.\d+)?\s*(?:MB|GB|TB))?(?:\s*\))?/i

/** Stable family prefix used to find colour/storage variants without mixing models. */
function variantFamilyName(value: string): string {
  const name = cleanProductName(value).replace(/\s+/g, " ").trim()
  const match = STORAGE_VARIANT.exec(name)
  if (!match || match.index < 4) return ""
  return name.slice(0, match.index).replace(/[\s(,/-]+$/, "").trim().toLowerCase()
}

function variantOptionParts(value: string): { storage: string; color: string } {
  const name = cleanProductName(value)
  const match = STORAGE_VARIANT.exec(name)
  if (!match) return { storage: "", color: "" }
  const storage = match[0].replace(/[()]/g, "").replace(/\s+/g, "")
  const color = name.slice(match.index + match[0].length).replace(/^[\s,/-]+/, "").trim()
  return { storage: storage.toUpperCase(), color }
}

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0)
  const [zooming, setZooming] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 })
  const list = images.length > 0 ? images : ["/placeholder.svg"]
  const go = (step: number) => setActive((i) => (i + step + list.length) % list.length)

  return (
    <div className="bg-white">
      <div className="flex gap-3">
        <div className="hidden w-[58px] flex-shrink-0 flex-col gap-2 sm:flex">
          {list.slice(0, 6).map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`flex h-[58px] items-center justify-center overflow-hidden rounded border bg-gray-50 p-1 ${
                active === i ? "border-[#1560BD] ring-1 ring-[#1560BD]" : "border-gray-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" aria-hidden className="h-full w-full object-contain" />
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <div
            className="flex aspect-square cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-[#dce6f4] bg-white p-4"
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={event => {
              const bounds = event.currentTarget.getBoundingClientRect()
              setZoomPosition({
                x: ((event.clientX - bounds.left) / bounds.width) * 100,
                y: ((event.clientY - bounds.top) / bounds.height) * 100,
              })
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={list[active]}
              alt={name}
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.svg"
              }}
            />
          </div>

          {zooming && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[calc(100%+12px)] top-0 z-50 hidden aspect-square w-[min(52vw,720px)] border border-gray-300 bg-white bg-no-repeat shadow-xl lg:block"
              style={{
                backgroundImage: `url(${JSON.stringify(list[active])})`,
                backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                backgroundSize: "220%",
              }}
            />
          )}

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto sm:hidden">
        {list.slice(0, 6).map((src, i) => (
          <button
            key={`m-${src}-${i}`}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded border bg-gray-50 p-1 ${
              active === i ? "border-[#1560BD]" : "border-gray-200"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" aria-hidden className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const marketing = useMarketingContent("product")
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || "")
  const router = useRouter()

  const { addToCart } = useCart()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const { data: settings } = useSettingsData()

  const [product, setProduct] = useState<Product | null>(null)
  const [catalogue, setCatalogue] = useState<CatalogProduct[]>([])
  const [variants, setVariants] = useState<CatalogProduct[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [suggestionsError, setSuggestionsError] = useState("")
  const [suggestionsAttempt, setSuggestionsAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [specsError, setSpecsError] = useState("")
  const [adding, setAdding] = useState<"cart" | "buy" | null>(null)
  const [tab, setTab] = useState("overview")
  const [reviewStats, setReviewStats] = useState<{ rating: number; count: number } | null>(null)
  const updateReviewStats = useCallback((next: { rating: number; count: number }) => {
    setReviewStats(previous => previous?.rating === next.rating && previous.count === next.count ? previous : next)
  }, [])
  const bankOffers = useRazorpayOffers()
  const liveOffers = applicableOffers(bankOffers.offers, Number(product?.price) || 0)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setNotFound(false)
      setLoadError("")
      setSpecsError("")
      setTab("overview")
      setReviewStats(null)
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(slug)}`)
        if (res.status === 404) { if (!cancelled) setNotFound(true); return }
        if (!res.ok) throw new Error("Product could not be loaded")
        const data = catalogProductResponseSchema.parse(await res.json())
        if (data.sku) {
          const specResponse = await fetch(`/api/products/specifications/${encodeURIComponent(data.sku)}`)
          if (specResponse.ok) {
            const specs = productSpecificationResponseSchema.parse(await specResponse.json())
            for (const key of ["technical_details", "from_manufacturer", "specification_images", "reviews", "overview", "included_components", "features"]) {
              if (specs[key] != null && (!Array.isArray(specs[key]) || specs[key].length)) data[key] = specs[key]
            }
            if (!data.mrp && specs.mrp) data.mrp = Number(specs.mrp)
          } else if (specResponse.status !== 404 && !cancelled) {
            console.error("[Product] Specifications failed:", specResponse.status)
            setSpecsError("Some product details could not be loaded.")
          }
        }
        if (!cancelled) setProduct(productDetailResponseSchema.parse(data))
      } catch (error) {
        console.error("[Product] Loading failed:", error)
        if (!cancelled) setLoadError("Product information could not be loaded. Please retry.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug, attempt])

  /*
   * Six related products need a candidate pool, not the whole shop.
   *
   * This used to page through the entire catalogue — 500 at a time until a
   * short page — on every single product view, and it started before the
   * product itself had loaded, so the two competed. Production runs a pool of
   * three connections per instance (lib/mongodb.ts), so opening a handful of
   * product pages at once was enough for those crawls to hold every
   * connection while the detail fetch above timed out and reported "Product
   * information could not be loaded".
   *
   * Nothing could render the suggestions before the product resolved anyway —
   * the whole page is <ProductLoading /> until then — so waiting costs nothing.
   *
   * The shopper-facing category is derived in the browser (categoryOf maps
   * warehouse labels like "PANEL" onto "Televisions"), so the raw category is
   * the only filter the API can apply. Products that share a derived category
   * share the raw one, which is exactly what that mapping exists to do.
   */
  const suggestionId = product?.id ? String(product.id) : ""
  const suggestionCategory = product?.category ? String(product.category) : ""

  useEffect(() => {
    if (suggestionId && !authLoading) recordRecentlyViewed(suggestionId, isAuthenticated)
  }, [suggestionId, authLoading, isAuthenticated])
  const variantFamily = product ? variantFamilyName(product.name) : ""

  useEffect(() => {
    if (!product || !variantFamily) {
      setVariants([])
      return
    }

    const controller = new AbortController()
    const loadVariants = async () => {
      try {
        const query = new URLSearchParams({ fields: "card", limit: "60", search: variantFamily })
        const response = await fetch(`/api/products?${query.toString()}`, { signal: controller.signal })
        if (!response.ok) return
        const candidates = z.array(catalogProductResponseSchema).parse(await response.json())
        const familyVariants = candidates.filter(candidate =>
          variantFamilyName(candidate.name) === variantFamily &&
          candidate.active !== false &&
          Number(candidate.price) > 0,
        )
        if (!controller.signal.aborted) setVariants(familyVariants)
      } catch (error) {
        if (!controller.signal.aborted) console.error("[Product] Variants failed:", error)
      }
    }
    void loadVariants()
    return () => controller.abort()
  }, [product, variantFamily])

  useEffect(() => {
    if (!suggestionId) return
    const controller = new AbortController()
    const loadSuggestions = async () => {
      setSuggestionsLoading(true)
      setSuggestionsError("")
      setCatalogue([])
      try {
        // 120 leaves plenty of headroom: productSuggestions needs six survivors
        // after dropping items with no image, no price, or no stock.
        const query = new URLSearchParams({ fields: "card", limit: "120", inStock: "true" })
        if (suggestionCategory) query.set("category", suggestionCategory)
        const response = await fetch(`/api/products?${query.toString()}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Product suggestions could not be loaded")
        const page = z.array(catalogProductResponseSchema).parse(await response.json())
        if (!controller.signal.aborted) setCatalogue(page)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[Product] Suggestions failed:", error)
          setSuggestionsError("Product suggestions could not be loaded.")
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false)
      }
    }
    void loadSuggestions()
    return () => controller.abort()
  }, [suggestionId, suggestionCategory, suggestionsAttempt])

  const configuredRailCards = useBanners("pdp-rail", product?.manufacturerName || product?.brand || undefined)
  const railCards = marketing.enabled("rail") ? configuredRailCards : []

  const images = useMemo(() => {
    if (!product) return []
    const all = [product.image, ...(Array.isArray(product.images) ? product.images : [])]
    return [...new Set(all.filter(Boolean).map(String))]
  }, [product])

  const features = useMemo(() => (product ? deriveFeatures(product) : []), [product])

  const similar = useMemo(() => product ? similarProducts(product, catalogue, 6) : [], [catalogue, product])
  const companions = useMemo(() => {
    if (!product) return []
    const shown = new Set(similar.map(item => String(item.id)))
    return productSuggestions(product, catalogue, 18).filter(item => !shown.has(String(item.id))).slice(0, 6)
  }, [catalogue, product, similar])

  if (loading) {
    return <ProductLoading />
  }

  if (loadError) return <div className="flex min-h-screen flex-col"><Header /><main className="section-container flex-grow py-16">
    <p role="alert">{loadError} <button type="button" className="text-[#1560bd] underline" onClick={() => setAttempt(value => value + 1)}>Retry product</button></p>
  </main><Footer /></div>
  if (notFound || !product) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="section-container flex flex-grow flex-col items-center justify-center py-24 text-center">
          <h1 className="heading-2">We couldn&apos;t find that product</h1>
          <p className="mt-2 text-brand-text-secondary">It may have sold out or been renamed.</p>
          <Link
            href="/products"
            className="mt-6 rounded-md bg-[#1560BD] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0D4C99]"
          >
            Browse all products
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const name = cleanProductName(product.name)
  const brand = String(product.manufacturerName || product.brand || "")
  const renderSuggestion = (c: CatalogProduct) => (
    <article
      key={c.id}
      className="group rounded-lg border border-gray-200 p-2 text-center transition-shadow hover:shadow-md"
    >
      <Link href={`/product/${c.slug || c.id}`}>
        <span className="flex h-16 items-center justify-center overflow-hidden rounded bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.image} alt={cleanProductName(c.name)} className="h-full w-full object-contain p-1" loading="lazy" />
        </span>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-gray-700">
          {cleanProductName(c.name)}
        </p>
        <p className="mt-1 text-[11px] font-bold text-gray-900">
          ₹{Number(c.price).toLocaleString("en-IN")}
        </p>
      </Link>
      <button type="button" className="mt-2 w-full rounded border border-[#1560bd] py-1.5 text-xs font-semibold text-[#1560bd]" onClick={async () => {
        const added = await addToCart({ id: String(c.id), name: c.name, price: c.price, image: c.image, quantity: 1, color: null, size: null, stock: c.stock })
        if (added) toast.success(`${toastProductName(c.name)} added to cart`)
      }}>Add</button>
    </article>
  )
  const hasMrp = Number(product.mrp || product.originalPrice || product.raw?.MRP || product.raw?.mrp) > 0
  const mrp = hasMrp ? getEffectiveMRP(product) : Number(product.price)
  const discount = calculateDiscount(mrp, product.price)
  const recordedReviews = Array.isArray(product.reviews) ? product.reviews : []
  const reviewSummary = product.reviews && typeof product.reviews === "object" && !Array.isArray(product.reviews) ? product.reviews : undefined
  const reviewRating = recordedReviews.map((review) => Number.parseFloat(String(review.rating))).filter((value) => value >= 1 && value <= 5)
  const recordedRating = { rating: Number(product.rating || reviewSummary?.average) || (reviewRating.length ? reviewRating.reduce((sum: number, value: number) => sum + value, 0) / reviewRating.length : 0),
    count: Number(product.reviewsCount || reviewSummary?.count) || recordedReviews.length }
  const rating = reviewStats || recordedRating
  const inStock = typeof product.stock === "number" ? product.stock > 0 : product.inStock !== false
  const wishlisted = isInWishlist(String(product.id))
  const freeShippingThreshold = Number(settings?.freeShippingThreshold ?? 10000)
  const freeDelivery = Number(product.price) >= freeShippingThreshold
  const currentVariant = variantOptionParts(product.name)
  const variantChoices = variants.map(variant => ({ product: variant, ...variantOptionParts(variant.name) }))
    .filter(option => option.storage)
  const colorOptions = [...new Set(variantChoices.map(option => option.color).filter(Boolean))]
  const storageOptions = [...new Set(variantChoices.map(option => option.storage).filter(Boolean))]
  const hasVariantSelectors = variantChoices.length > 1 && (colorOptions.length > 1 || storageOptions.length > 1)
  const variantAvailable = (variant: CatalogProduct | undefined) =>
    Boolean(variant && variant.active !== false && Number(variant.price) > 0 &&
      (typeof variant.stock !== "number" || variant.stock > 0))

  const handleAddToCart = async (buyNow: boolean) => {
    if (adding) return
    setAdding(buyNow ? "buy" : "cart")
    try {
      const added = await addToCart({
        id: String(product.id),
        name: product.name,
        price: product.price,
        image: images[0] || "/placeholder.svg",
        quantity: 1,
        stock: product.stock,
        color: null,
        size: null,
      })
      if (!added) return
      if (buyNow) {
        router.push("/checkout")
      } else {
        toast.success(`${name} added to cart`)
      }
    } finally {
      setTimeout(() => setAdding(null), 400)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white" data-product-detail>
      <Header />

      <main className="flex-grow">
        <div className="section-container space-y-5 py-4">
          <MarketingStatus page="product" />
          <nav className="flex flex-wrap items-center gap-1.5 text-[12px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            {product.groupName && (
              <>
                <span className="text-gray-300">/</span>
                <Link
                  href={`/products?category=${encodeURIComponent(product.groupName)}`}
                  className="hover:text-[#1560BD]"
                >
                  {titleCaseLabel(String(product.groupName))}
                </Link>
              </>
            )}
            {brand && (
              <>
                <span className="text-gray-300">/</span>
                <Link href={`/products?brand=${encodeURIComponent(brand)}`} className="hover:text-[#1560BD]">
                  {titleCaseLabel(brand)}
                </Link>
              </>
            )}
            {product.subCategory && (
              <>
                <span className="text-gray-300">/</span>
                <Link
                  href={`/products?subCategory=${encodeURIComponent(product.subCategory)}`}
                  className="hover:text-[#1560BD]"
                >
                  {titleCaseLabel(String(product.subCategory))}
                </Link>
              </>
            )}
            <span className="text-gray-300">/</span>
            <span className="line-clamp-1 font-medium text-gray-700">{name}</span>
          </nav>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,.85fr)_minmax(0,.9fr)]">
            <div className="min-w-0">
              <Gallery key={slug} images={images} name={name} />
            </div>

            <div className="min-w-0">
              {brand && (
                <Link
                  href={`/products?brand=${encodeURIComponent(brand)}`}
                  className="text-[13px] font-semibold text-[#1560BD] hover:underline"
                >
                  {titleCaseLabel(brand)}
                </Link>
              )}
              <h1
                title={name}
                className="mt-1 line-clamp-3 font-heading text-lg font-bold leading-snug text-gray-900 sm:text-xl"
              >
                {name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <Stars rating={rating.rating} />
                  <span className="text-[13px] font-semibold text-gray-800">{rating.count > 0 ? rating.rating.toFixed(1) : "No reviews yet"}</span>
                  <span className="text-[12px] text-gray-500">
                    ({rating.count >= 1000 ? `${(rating.count / 1000).toFixed(1)}K` : rating.count} reviews)
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#007a38]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Genuine Product
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {discount >= 10 && (
                  <span className="rounded bg-[#E11D2E] px-2 py-0.5 text-[11px] font-bold text-white">
                    {discount}% OFF
                  </span>
                )}
                {product.subCategory && (
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#1560BD]">
                    {titleCaseLabel(String(product.subCategory))}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-heading text-2xl font-bold text-gray-900">
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-sm text-gray-600 line-through">₹{mrp.toLocaleString("en-IN")}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      {discount}% off
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[12px] text-gray-500">Inclusive of all taxes</p>

              {hasVariantSelectors && (
                <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
                  {colorOptions.length > 1 && (
                    <div>
                      <h2 className="text-[13px] font-bold text-gray-900">
                        Color: <span className="font-medium text-gray-600">{currentVariant.color}</span>
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {colorOptions.map(color => {
                          const exact = variantChoices.find(option =>
                            option.color === color && option.storage === currentVariant.storage)?.product
                          const representative = exact || variantChoices.find(option => option.color === color)?.product
                          const available = variantAvailable(exact)
                          const selected = color === currentVariant.color
                          const content = <>
                            <span className="flex h-9 w-9 items-center justify-center overflow-hidden bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={representative?.image || "/placeholder.svg"} alt="" className="h-full w-full object-contain" />
                            </span>
                            <span className="max-w-24 truncate">{color}</span>
                          </>
                          return available && exact ? (
                            <Link
                              key={color}
                              href={`/product/${exact.slug || exact.id}`}
                              aria-current={selected ? "page" : undefined}
                              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold ${
                                selected ? "border-[#1560BD] bg-blue-50 ring-1 ring-[#1560BD]" : "border-gray-300 hover:border-[#1560BD]"
                              }`}
                            >
                              {content}
                            </Link>
                          ) : (
                            <span key={color} title={`${color} is unavailable in ${currentVariant.storage}`} className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 text-[11px] font-semibold text-gray-400 opacity-60">
                              {content}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {storageOptions.length > 1 && (
                    <div>
                      <h2 className="text-[13px] font-bold text-gray-900">Storage</h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {storageOptions.map(storage => {
                          const exact = variantChoices.find(option =>
                            option.storage === storage && option.color === currentVariant.color)?.product
                          const available = variantAvailable(exact)
                          const selected = storage === currentVariant.storage
                          return available && exact ? (
                            <Link
                              key={storage}
                              href={`/product/${exact.slug || exact.id}`}
                              aria-current={selected ? "page" : undefined}
                              className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${
                                selected ? "border-[#1560BD] bg-blue-50 text-[#1560BD] ring-1 ring-[#1560BD]" : "border-gray-300 text-gray-700 hover:border-[#1560BD]"
                              }`}
                            >
                              {storage}
                            </Link>
                          ) : (
                            <span key={storage} title={`${storage} is unavailable in ${currentVariant.color}`} className="cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-[12px] font-semibold text-gray-400 line-through opacity-60">
                              {storage}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!hasVariantSelectors && features.length > 0 && (
                <div className="mt-5">
                  <h2 className="text-[13px] font-bold text-gray-900">Highlights</h2>
                  <ul className="mt-2 space-y-1.5">
                    {features.slice(0, 5).map(feature => (
                      <li key={feature} className="flex items-start gap-2 text-[12px] leading-snug text-gray-600">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F8A3C]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {liveOffers.some(isEmiOffer) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#1560BD]" />
                  <span className="text-[13px] font-medium text-gray-800">
                    EMI offers available
                  </span>
                  <button type="button" onClick={() => { setTab("emi"); document.getElementById("product-details-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }) }} className="text-[12px] font-semibold text-[#1560BD] hover:underline">
                    View EMI options →
                  </button>
                </div>
              )}

            </div>

            {/* Buy box */}
            <div className="min-w-0">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white lg:sticky lg:top-24">
                <div
                  className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold ${
                    inStock ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {inStock ? "In stock for delivery" : "Currently unavailable"}
                </div>

                <div className="space-y-3.5 p-4">
                  <div className="flex items-start gap-2 text-[12px]">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <span className="text-gray-600">
                      Choose your delivery address at checkout
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[12px] font-semibold text-gray-800">
                        {freeDelivery ? "FREE" : "Standard"} Delivery
                      </p>
                      <p className="text-[11px] text-gray-500">Delivery date and address confirmed at checkout</p>
                    </div>
                  </div>

                  {marketing.enabled("pickup") && <div className="flex items-start gap-2">
                    <Store className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[12px] font-semibold text-gray-800">{marketing.text("pickup", "title")}</p>
                      <Link href={marketing.text("pickup", "ctaLink")} className="text-[11px] font-semibold text-[#1560BD] hover:underline">
                        {marketing.text("pickup", "ctaText")} →
                      </Link>
                    </div>
                  </div>}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(false)}
                      disabled={!inStock || adding !== null}
                      className="h-10 flex-1 rounded-md border border-[#1560BD] text-[13px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white disabled:opacity-50"
                    >
                      {adding === "cart" ? "Adding…" : "Add to Cart"}
                    </button>
                    <button
                      type="button"
                      onClick={() => (wishlisted ? removeFromWishlist(String(product.id)) : addToWishlist(String(product.id)))}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:text-[#E11D2E]"
                    >
                      <Heart className={`h-4 w-4 ${wishlisted ? "fill-[#E11D2E] text-[#E11D2E]" : ""}`} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(true)}
                    disabled={!inStock || adding !== null}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1560BD] text-[13px] font-semibold text-white transition-colors hover:bg-[#0D4C99] disabled:opacity-50"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {adding === "buy" ? "Taking you to checkout…" : "Buy Now"}
                  </button>

                  {marketing.enabled("trust") && <ul className="grid grid-cols-4 gap-x-2 gap-y-3 border-t border-gray-100 pt-3.5">
                    {TRUST.map(({ icon: Icon, label }, index) => (
                      <li key={label} className="flex flex-col items-center gap-1 text-center">
                        <Icon className="h-4 w-4 text-[#1560BD]" strokeWidth={1.75} />
                        <span className="text-[10px] leading-tight text-[#1560BD]">{marketing.text("trust", `item${index + 1}Title`, label)}</span>
                      </li>
                    ))}
                  </ul>}
                </div>
              </div>
            </div>
          </div>

          <RazorpayOffers offers={liveOffers} loading={bankOffers.isLoading} error={bankOffers.error} retry={bankOffers.retry} mode="rail" onSelect={id => { setTab(id); document.getElementById("product-details-tabs")?.scrollIntoView({ behavior: "smooth" }) }} />

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <div id="product-details-tabs" className="min-w-0 scroll-mt-4 bg-white">
            <div className="flex overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Product details">
              {TABS.filter(item => item.id !== "faqs" || marketing.enabled("faqs")).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  role="tab" aria-selected={tab === id} aria-controls={`product-panel-${id}`} id={`product-tab-${id}`}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${
                    tab === id
                      ? "border-[#1560BD] text-[#1560BD]"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {label}
                  {id === "reviews" && rating.count > 0 && ` (${rating.count.toLocaleString("en-IN")})`}
                </button>
              ))}
            </div>

            <div className="py-5" role="tabpanel" id={`product-panel-${tab}`} aria-labelledby={`product-tab-${tab}`}>
              {specsError && <p role="alert" className="mb-4 text-sm text-amber-800">{specsError} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Retry product details</button></p>}
              {tab === "overview" && (
                <div className={`grid gap-5 ${railCards.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]" : ""}`}>
                  <div>
                    <h2 className="font-heading text-lg font-bold text-gray-900">{name}</h2>
                    {hasVariantSelectors && features.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-bold text-gray-900">Highlights</h3>
                        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                          {features.slice(0, 6).map(feature => (
                            <li key={feature} className="flex items-start gap-2 text-[13px] leading-snug text-gray-600">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F8A3C]" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-gray-600">
                      {cleanProductDescription(product.description) || "Full details are listed under Specifications."}
                    </p>

                      {similar.length > 0 && <section className="mt-8" aria-label="Similar products">
                        <h3 className="font-heading text-base font-bold text-gray-900">Similar Products</h3>
                        <p className="mt-1 text-xs text-gray-500">Same kind of product in a similar price range.</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          {similar.map(renderSuggestion)}
                        </div>
                      </section>}

                      {marketing.enabled("suggestions") && <section className="mt-8" aria-label="Product suggestions">
                        <h3 className="font-heading text-base font-bold text-gray-900">{marketing.text("suggestions", "title")}</h3>
                        <p className="mt-1 text-xs text-gray-500">{marketing.text("suggestions", "description")}</p>
                        {marketing.text("suggestions", "description") !== "Suggested products from our catalog, not based on purchase history." &&
                          <p className="mt-1 text-xs text-gray-500">Suggested products from our catalog, not based on purchase history.</p>}
                        {suggestionsLoading ? <p role="status" className="mt-4 text-sm text-gray-500">Loading product suggestions...</p> :
                          suggestionsError ? <p role="alert" className="mt-4 text-sm text-amber-800">{suggestionsError} <button type="button" className="text-[#1560BD] underline" onClick={() => setSuggestionsAttempt(value => value + 1)}>Retry suggestions</button></p> :
                          !companions.length ? <p className="mt-4 text-sm text-gray-500">No related products are currently available.</p> : (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          {companions.map(renderSuggestion)}
                        </div>
                        )}
                      </section>}
                  </div>

                  <RailCards cards={railCards} />
                </div>
              )}

              {(tab === "specifications" || tab === "product-images") && (
                <ProductSpecificationTabs
                  key={`${product.id}-${tab}`}
                  section={tab === "specifications" ? "specs" : "manufacturer"}
                  technicalDetails={product.technical_details}
                  fromManufacturer={product.from_manufacturer}
                  specificationImages={product.specification_images}
                  fallbackImages={images}
                  productDescription={product.description}
                  sku={product.sku}
                  productId={product.id}
                  productName={name}
                  productImage={images[0]}
                  overview={product.overview}
                  includedComponents={product.included_components}
                  features={product.features}
                  mrp={product.mrp}
                />
              )}

              {tab === "in-the-box" && (
                <ul className="space-y-2 text-[13px] text-gray-700">
                  {(Array.isArray(product.included_components) ? product.included_components :
                    String(product.technical_details?.["Included Components"] || "").split(",").filter(Boolean)).map((item: string) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#0F8A3C]" />
                      {item}
                    </li>
                  ))}
                  {!product.included_components?.length && !product.technical_details?.["Included Components"] && <li>Box contents have not been provided by the manufacturer.</li>}
                </ul>
              )}

              {tab === "offers" && (
                <div className="space-y-4">
                  <RazorpayOffers offers={liveOffers} loading={bankOffers.isLoading} error={bankOffers.error} retry={bankOffers.retry} />
                  <p className="text-[13px] text-gray-600">
                    The exact discount that applies to your order is shown at checkout before payment. See all{" "}
                    <Link href="/offers" className="font-semibold text-[#1560BD] hover:underline">
                      current offers
                    </Link>
                    .
                  </p>
                </div>
              )}

              {tab === "emi" && (
                <RazorpayOffers offers={liveOffers} loading={bankOffers.isLoading} error={bankOffers.error} retry={bankOffers.retry} mode="emi" />
              )}

              {tab === "reviews" && (
                <ProductReviewsSection embedded productId={String(product.id)} productName={name} productImage={images[0]} seedReviews={recordedReviews} average={recordedRating.count ? recordedRating.rating : undefined} count={recordedRating.count} onStatsChange={updateReviewStats} />
              )}

              {tab === "faqs" && marketing.enabled("faqs") && (
                <dl className="divide-y divide-gray-100">
                  {FAQS.map(({ q, a }, index) => (
                    <div key={q} className="py-4 first:pt-0 last:pb-0">
                      <dt className="text-[13px] font-bold text-gray-900">{marketing.text("faqs", `item${index + 1}Title`, q)}</dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-gray-600">{marketing.text("faqs", `item${index + 1}Detail`, a)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky mobile buy bar */}
      <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">₹{Number(product.price).toLocaleString("en-IN")}</p>
          {discount > 0 && <p className="text-[11px] text-emerald-700">{discount}% off</p>}
        </div>
        <button
          type="button"
          onClick={() => handleAddToCart(false)}
          disabled={!inStock}
          className="h-10 rounded-md border border-[#1560BD] px-4 text-[13px] font-semibold text-[#1560BD] disabled:opacity-50"
        >
          Add to Cart
        </button>
        <button
          type="button"
          onClick={() => handleAddToCart(true)}
          disabled={!inStock}
          className="h-10 rounded-md bg-[#1560BD] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          Buy Now
        </button>
      </div>

      <Footer />
    </div>
  )
}
