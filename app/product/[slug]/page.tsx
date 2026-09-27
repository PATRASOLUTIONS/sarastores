"use client"

import { useEffect, useMemo, useState } from "react"
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
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ProductSpecificationTabs from "@/components/ProductSpecificationTabs"
import { FeatureTiles, OfferCards, RailCards, ReviewSummary, Stars } from "@/components/product/PdpBlocks"
import { useBanners } from "@/hooks/useBanners"
import { useCart } from "@/hooks/useCart"
import { useWishlist } from "@/hooks/useWishlist"
import { useSettingsData } from "@/hooks/useSettingsData"
import { cleanProductName, cleanProductDescription } from "@/utils/cleanProductName"
import {
  calculateDiscount,
  emiPerMonth,
  emiTenure,
  getEffectiveMRP,
  getRatingInfo,
  titleCaseLabel,
} from "@/lib/product-display"

type Product = Record<string, any>

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "specifications", label: "Specifications" },
  { id: "in-the-box", label: "In the Box" },
  { id: "offers", label: "Offers" },
  { id: "emi", label: "EMI Options" },
  { id: "reviews", label: "Reviews" },
  { id: "faqs", label: "FAQs" },
]

const TRUST = [
  { icon: RefreshCw, label: "7 Days Replacement" },
  { icon: ShieldCheck, label: "1 Year Warranty" },
  { icon: BadgeCheck, label: "100% Genuine" },
  { icon: CreditCard, label: "Secure Payment" },
]

const FAQS = [
  {
    q: "Is this product covered by the manufacturer warranty?",
    a: "Yes. We are a brand-authorised dealer, so every unit carries the complete manufacturer warranty and is serviced through authorised service centres. Your SARA invoice is the proof of purchase.",
  },
  {
    q: "Do you install it for me?",
    a: "Standard installation and a working demonstration are included at no extra cost on eligible products. We call you after delivery to agree a slot that suits you.",
  },
  {
    q: "Can I pay in instalments?",
    a: "Yes. No-cost EMI is available on eligible orders across major credit and debit cards, with cardless options for customers without a card. Plans are shown at checkout before you pay.",
  },
  {
    q: "What if it arrives damaged?",
    a: "Report it within 48 hours of delivery with a photograph and we will replace or refund it. Do not accept a package that arrives visibly tampered with.",
  },
  {
    q: "Can I collect it from a store instead?",
    a: "Yes. Reserve online and collect from your nearest SARA store — there are stores across Karnataka, listed on our store locator.",
  },
]

function deliveryDate(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

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

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0)
  const list = images.length > 0 ? images : ["/placeholder.svg"]
  const go = (step: number) => setActive((i) => (i + step + list.length) % list.length)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
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
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-white p-4">
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

      <div className="mt-3 flex gap-2 sm:hidden">
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
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || "")
  const router = useRouter()

  const { addToCart } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const { data: settings } = useSettingsData()

  const [product, setProduct] = useState<Product | null>(null)
  const [catalogue, setCatalogue] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [adding, setAdding] = useState<"cart" | "buy" | null>(null)
  const [tab, setTab] = useState("overview")

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(slug)}`)
        if (!res.ok) throw new Error("not found")
        const data = await res.json()
        if (!cancelled) setProduct(data)
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    fetch("/api/products?fields=card")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => !cancelled && Array.isArray(d) && setCatalogue(d))
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [slug])

  const offers = useBanners("pdp-offer", product?.manufacturerName || product?.brand)
  const railCards = useBanners("pdp-rail", product?.manufacturerName || product?.brand)

  const images = useMemo(() => {
    if (!product) return []
    const all = [product.image, ...(Array.isArray(product.images) ? product.images : [])]
    return [...new Set(all.filter(Boolean).map(String))]
  }, [product])

  const features = useMemo(() => (product ? deriveFeatures(product) : []), [product])

  const companions = useMemo(() => {
    if (!product) return []
    const sub = String(product.subCategory || "").toLowerCase()
    return catalogue
      .filter(
        (p) =>
          p.id !== product.id &&
          p.image &&
          Number(p.price) > 0 &&
          Number(p.price) < Number(product.price) &&
          String(p.subCategory || "").toLowerCase() === sub,
      )
      .slice(0, 6)
  }, [catalogue, product])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="section-container flex flex-grow items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </main>
        <Footer />
      </div>
    )
  }

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
  const mrp = getEffectiveMRP(product)
  const discount = calculateDiscount(mrp, product.price)
  const rating = getRatingInfo(product)
  const inStock = typeof product.stock === "number" ? product.stock > 0 : product.inStock !== false
  const wishlisted = isInWishlist(String(product.id))
  const pincode = settings?.storePincode || "560001"
  const freeShippingThreshold = Number(settings?.freeShippingThreshold ?? 10000)
  const freeDelivery = Number(product.price) >= freeShippingThreshold

  const handleAddToCart = async (buyNow: boolean) => {
    if (adding) return
    setAdding(buyNow ? "buy" : "cart")
    try {
      await addToCart({
        id: String(product.id),
        name: product.name,
        price: product.price,
        image: images[0] || "/placeholder.svg",
        quantity: 1,
        color: null,
        size: null,
      })
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="flex-grow">
        <div className="section-container space-y-5 py-4">
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
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Gallery images={images} name={name} />
            </div>

            <div className="lg:col-span-4">
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
                  <span className="text-[13px] font-semibold text-gray-800">{rating.rating.toFixed(1)}</span>
                  <span className="text-[12px] text-gray-500">
                    ({rating.count >= 1000 ? `${(rating.count / 1000).toFixed(1)}K` : rating.count} reviews)
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F8A3C]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Brand Authorised
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
                    <span className="text-sm text-gray-400 line-through">₹{mrp.toLocaleString("en-IN")}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      {discount}% off
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[12px] text-gray-500">Inclusive of all taxes</p>

              {Number(product.price) >= 5000 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                  <CreditCard className="h-4 w-4 text-[#1560BD]" />
                  <span className="text-[13px] font-medium text-gray-800">
                    EMI from ₹{emiPerMonth(product.price).toLocaleString("en-IN")}/month
                  </span>
                  <Link href="/emi" className="text-[12px] font-semibold text-[#1560BD] hover:underline">
                    View EMI options →
                  </Link>
                </div>
              )}

              {features.length > 0 && (
                <div className="mt-5">
                  <h2 className="text-[13px] font-bold text-gray-900">Highlights</h2>
                  <ul className="mt-2 space-y-1.5">
                    {features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-gray-600">
                        <CheckCircle2 className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-[#0F8A3C]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Buy box */}
            <div className="lg:col-span-3">
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
                      Deliver to Bengaluru - {pincode}{" "}
                      <Link href="/store-locator" className="font-semibold text-[#1560BD] hover:underline">
                        Change
                      </Link>
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[12px] font-semibold text-gray-800">
                        {freeDelivery ? "FREE" : "Standard"} Delivery by {deliveryDate(3)}
                      </p>
                      <p className="text-[11px] text-gray-500">Order today for the earliest slot</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Store className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[12px] font-semibold text-gray-800">Available for Store Pickup</p>
                      <Link href="/store-locator" className="text-[11px] font-semibold text-[#1560BD] hover:underline">
                        View Stores →
                      </Link>
                    </div>
                  </div>

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

                  <ul className="grid grid-cols-2 gap-x-2 gap-y-3 border-t border-gray-100 pt-3.5">
                    {TRUST.map(({ icon: Icon, label }) => (
                      <li key={label} className="flex flex-col items-center gap-1 text-center">
                        <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
                        <span className="text-[10px] leading-tight text-gray-600">{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <OfferCards offers={offers} />

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
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

            <div className="p-5">
              {tab === "overview" && (
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-gray-900">{name}</h2>
                    <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-gray-600">
                      {cleanProductDescription(product.description) || "Full details are listed under Specifications."}
                    </p>

                    {features.length > 0 && (
                      <div className="mt-6">
                        <FeatureTiles
                          items={features.slice(0, 5).map((f) => ({
                            title: f.split(/[,–—:]/)[0].trim().slice(0, 40),
                            detail: f.slice(0, 90),
                          }))}
                        />
                      </div>
                    )}

                    {companions.length > 0 && (
                      <div className="mt-8">
                        <h3 className="font-heading text-base font-bold text-gray-900">Frequently Bought Together</h3>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          {companions.map((c) => (
                            <Link
                              key={c.id}
                              href={`/product/${c.slug || c.id}`}
                              className="group rounded-lg border border-gray-200 p-2 text-center transition-shadow hover:shadow-md"
                            >
                              <span className="flex h-16 items-center justify-center overflow-hidden rounded bg-gray-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={c.image} alt="" aria-hidden className="h-full w-full object-contain p-1" />
                              </span>
                              <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-gray-700">
                                {cleanProductName(c.name)}
                              </p>
                              <p className="mt-1 text-[11px] font-bold text-gray-900">
                                ₹{Number(c.price).toLocaleString("en-IN")}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <RailCards cards={railCards} />
                </div>
              )}

              {tab === "specifications" && (
                <ProductSpecificationTabs
                  technicalDetails={product.technical_details}
                  fromManufacturer={product.from_manufacturer}
                  specificationImages={product.specification_images}
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
                  {(Array.isArray(product.included_components) && product.included_components.length > 0
                    ? product.included_components
                    : ["Main unit", "User manual", "Warranty card", "Standard accessories as supplied by the brand"]
                  ).map((item: string) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#0F8A3C]" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {tab === "offers" && (
                <div className="space-y-4">
                  <OfferCards offers={offers} />
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
                <div className="space-y-3 text-[13px] text-gray-700">
                  <p>
                    No-cost EMI on this product runs up to {emiTenure(product.price)} months, from{" "}
                    <strong>₹{emiPerMonth(product.price).toLocaleString("en-IN")}/month</strong> on eligible cards.
                  </p>
                  <ul className="list-disc space-y-1.5 pl-5 text-gray-600">
                    <li>Available on major credit cards and selected debit cards.</li>
                    <li>Cardless finance available through our partner lenders, subject to approval.</li>
                    <li>Eligibility, tenure and rate are set by your bank, not by SARA.</li>
                  </ul>
                  <Link href="/emi" className="inline-block font-semibold text-[#1560BD] hover:underline">
                    Full EMI terms →
                  </Link>
                </div>
              )}

              {tab === "reviews" && (
                <div className="space-y-8">
                  <ReviewSummary average={rating.rating} count={rating.count} distribution={[68, 22, 7, 2, 1]} />
                  <p className="text-[13px] text-gray-500">
                    Verified reviews from SARA customers appear here as orders are delivered.
                  </p>
                </div>
              )}

              {tab === "faqs" && (
                <dl className="divide-y divide-gray-100">
                  {FAQS.map(({ q, a }) => (
                    <div key={q} className="py-4 first:pt-0 last:pb-0">
                      <dt className="text-[13px] font-bold text-gray-900">{q}</dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-gray-600">{a}</dd>
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
