"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import CategoryGlyph from "@/components/CategoryGlyph"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Headphones,
  Loader2,
  MapPin,
  ParkingCircle,
  RefreshCw,
  Truck,
  Wrench,
} from "lucide-react"
import { bannerGradient, type SiteBanner } from "@/hooks/useBanners"
import { useBrandImages } from "@/hooks/useBrandImages"
import { cleanProductName } from "@/utils/cleanProductName"

const isUrl = (value?: string) => !!value && /^(https?:)?\/\/|^\//.test(value)

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-heading text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#1560BD] hover:underline">
          View All
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

/** Horizontally scrolling product shelf with arrow controls. */
export function ProductShelf({
  title,
  href,
  products,
}: {
  title: string
  href?: string
  products: any[]
}) {
  const scroller = useRef<HTMLDivElement>(null)
  if (products.length === 0) return null

  const scroll = (step: number) => scroller.current?.scrollBy({ left: step * 260, behavior: "smooth" })

  return (
    <section className="section-container" aria-label={title}>
      <SectionHeader title={title} href={href} />
      <div className="relative">
        <div
          ref={scroller}
          className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug || product.id}`}
              className="group flex w-[168px] flex-shrink-0 flex-col rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
            >
              <div className="flex h-[132px] items-center justify-center rounded-t-lg bg-gray-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={cleanProductName(product.name)}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg"
                  }}
                />
              </div>
              <div className="flex flex-1 flex-col items-center px-3 py-2.5 text-center">
                <p className="line-clamp-2 text-[12px] font-medium leading-tight text-gray-800">
                  {cleanProductName(product.name)}
                </p>
                <p className="mt-1 text-[12px] font-bold text-gray-900">
                  From ₹{Number(product.price).toLocaleString("en-IN")}
                </p>
                <span className="mt-2 w-full border-t border-gray-100 pt-2 text-[12px] font-medium text-[#1560BD]">
                  View Details
                </span>
              </div>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
          className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 lg:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
          className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 lg:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}

export function FeaturedCategories({
  items,
}: {
  items: { label: string; image?: string; href: string }[]
}) {
  if (items.length === 0) return null

  return (
    <section className="section-container" aria-label="Featured categories">
      <SectionHeader title="Featured Categories" href="/products" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.slice(0, 6).map(({ label, image, href }) => (
          <Link
            key={label}
            href={href}
            className="group flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
              <span className="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-gray-50 text-black">
              {isUrl(image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" aria-hidden className="h-full w-full object-contain p-2" />
              ) : (
                <CategoryGlyph label={label} className="h-9 w-9" />
              )}
            </span>
            <span className="mt-3 line-clamp-1 text-[13px] font-semibold text-gray-800">{label}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#1560BD]">
              Explore
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function BrandLogos({
  brands,
}: {
  brands: { name: string; logo?: string; href?: string; count?: number }[]
}) {
  if (brands.length === 0) return null

  return (
    <section className="section-container" aria-label="Shop by top brands">
      <SectionHeader title="Shop by Top Brands" href="/brands" />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {brands.map(({ name, logo, href, count }) => (
          <li key={name}>
            <Link
              href={href || `/products?brand=${encodeURIComponent(name)}`}
              title={`Shop ${name}`}
              className="group flex h-[88px] flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 transition-all hover:border-[#1560BD] hover:shadow-md"
            >
              {isUrl(logo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={name} className="max-h-9 w-auto object-contain" />
              ) : (
                <span className="text-center font-heading text-[15px] font-extrabold uppercase leading-tight tracking-tight text-[#0F2557] group-hover:text-[#1560BD]">
                  {name}
                </span>
              )}
              {!!count && (
                <span className="text-[10px] text-gray-400">
                  {count} {count === 1 ? "product" : "products"}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const STORE_POINTS = [
  { icon: MapPin, label: "Easy Store Locator" },
  { icon: ParkingCircle, label: "Ample Parking Space" },
  { icon: Wrench, label: "Expert Product Guidance" },
  { icon: Headphones, label: "After-Sales Support" },
]

export function StoresBand({ storeCount }: { storeCount: number }) {
  const { storefront } = useBrandImages()

  return (
    <section className="section-container" aria-label="Our stores">
      <div className="grid overflow-hidden rounded-xl border border-gray-200 bg-[#EAF2FC] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.7fr)]">
        <div className="flex items-center justify-center bg-[#0D2B54]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={storefront} alt="" aria-hidden className="h-full max-h-[300px] w-full object-cover" />
        </div>

        <div className="px-6 py-8">
          <h2 className="font-heading text-2xl font-bold leading-tight text-[#0F2557] sm:text-[30px]">
            {storeCount}+ Stores
            <br />
            Across Karnataka
          </h2>
          <p className="mt-2 text-sm text-slate-600">Bringing the latest technology closer to you.</p>

          <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-4">
            {STORE_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex w-[104px] flex-col items-center gap-1.5 text-center">
                <Icon className="h-5 w-5 text-[#1560BD]" strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-tight text-slate-700">{label}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/store-locator"
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#1560BD] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Find a Store Near You
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative hidden items-center justify-center p-4 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banners/store-map.svg" alt="" aria-hidden className="h-[230px] w-full object-contain" />
          <p className="absolute right-3 top-6 font-script text-xl leading-tight text-[#0F2557]">
            Happier Homes
            <br />
            Brighter Lives
            <svg viewBox="0 0 120 12" className="mt-1 h-2 w-24" fill="none" aria-hidden>
              <path d="M2 9C26 3 62 2 90 4c10 .8 20 2.6 28 5" stroke="#E11D2E" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </p>
        </div>
      </div>
    </section>
  )
}

/** Admin-managed promo card beside the membership sign-up. */
export function MemberRow({ cards }: { cards: SiteBanner[] }) {
  const [phone, setPhone] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const lock = useSubmitLock()

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(clean)) return toast.error("Enter a valid 10-digit mobile number")
    if (!lock.acquire()) return

    setStatus("loading")
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "SARA Member",
          phone: clean,
          pincode: "560001",
          category: "Membership",
          source: "Home — Be a SARA Member",
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Something went wrong")
      setStatus("done")
      setPhone("")
      toast.success("Welcome to the SARA family!")
    } catch (err: any) {
      setStatus("idle")
      toast.error(err.message || "Could not sign you up right now")
    } finally {
      lock.release()
    }
  }

  return (
    <section id="download-app" className="section-container grid gap-4 md:grid-cols-2" aria-label="Membership and offers">
      {cards.slice(0, 1).map((card) => (
        <div
          key={card.id}
          className="relative flex min-h-[150px] items-center overflow-hidden rounded-xl px-5 py-5"
          style={bannerGradient(card)}
        >
          <div className={`relative z-10 ${card.dark ? "text-[#0F2557]" : "text-white"}`}>
            <h3 className="font-heading text-xl font-extrabold uppercase leading-tight">{card.title}</h3>
            {card.subtitle && <p className="mt-1.5 text-sm">{card.subtitle}</p>}
            {card.ctaText && (
              <Link
                href={card.ctaLink || "/offers"}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-semibold text-[#0F2557] shadow-sm transition-transform hover:scale-[1.03]"
              >
                {card.ctaText}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          {card.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt=""
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-0 h-[130px] w-[40%] object-contain object-right-bottom"
            />
          )}
        </div>
      ))}

      <div className="flex min-h-[150px] flex-col justify-center rounded-xl border border-gray-200 bg-[#EAF2FC] px-5 py-5">
        <h3 className="font-heading text-lg font-bold text-[#0F2557]">Be a SARA Member</h3>
        <p className="mt-1 text-sm text-slate-600">Get exclusive offers, early access &amp; more!</p>

        {status === "done" ? (
          <p className="mt-4 text-sm font-semibold text-emerald-700">You're on the list — see you soon.</p>
        ) : (
          <form onSubmit={join} className="mt-4 flex max-w-sm gap-2">
            <label htmlFor="member-phone" className="sr-only">
              Mobile number
            </label>
            <input
              id="member-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              placeholder="Enter your mobile number"
              className="h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-[#1560BD] focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#1560BD] px-4 text-sm font-semibold text-white hover:bg-[#0D4C99] disabled:opacity-60"
            >
              {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
              Join Now
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

export function WhyShop({ phone }: { phone: string }) {
  const items = [
    { icon: Truck, title: "Free & Fast Delivery", subtitle: "Across Karnataka" },
    { icon: BadgeCheck, title: "100% Genuine Products", subtitle: "Direct from Brands" },
    { icon: CreditCard, title: "Easy EMI Options", subtitle: "All Major Banks" },
    { icon: RefreshCw, title: "Free Installation", subtitle: "Certified Engineers" },
    { icon: Headphones, title: "Expert Support", subtitle: phone },
  ]

  return (
    <section className="section-container" aria-label="Why shop at SARA">
      <h2 className="mb-4 font-heading text-lg font-bold text-gray-900 sm:text-xl">Why Shop at SARA?</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ icon: Icon, title, subtitle }) => (
          <li key={title} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#1560BD]">
              <Icon className="h-4.5 w-4.5" size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold leading-tight text-gray-900">{title}</p>
              <p className="text-[11px] leading-tight text-gray-500">{subtitle}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
