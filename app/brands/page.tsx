"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, BadgeCheck, Layers, Search, Tag } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { bannerGradient, useBanners } from "@/hooks/useBanners"
import { titleCaseLabel } from "@/lib/product-display"

type Brand = {
  name: string
  slug?: string
  logo?: string
  categories: string[]
  count: number
}

const LETTERS = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"]

const HERO_POINTS = [
  { icon: BadgeCheck, title: "100% Genuine", detail: "Products" },
  { icon: Tag, title: "Exclusive", detail: "Brand Offers" },
  { icon: Layers, title: "Wide Range", detail: "Across Categories" },
]

const isUrl = (value?: string) => !!value && /^(https?:)?\/\/|^\//.test(value)

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/**
 * Logo sources in priority order: the admin-set URL, then drop-in artwork in
 * public/brands/. A wordmark shows only when neither exists.
 */
function BrandLogo({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    // No artwork available, so the wordmark *is* the brand label — don't repeat it.
    return (
      <span className="flex h-12 w-full items-center justify-center">
        <span className="line-clamp-2 font-heading text-[15px] font-extrabold uppercase leading-tight tracking-tight text-[#0F2557]">
          {name}
        </span>
      </span>
    )
  }

  return (
    <span className="flex h-12 w-full items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        className="max-h-12 w-auto max-w-full object-contain"
      />
    </span>
  )
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [logoManifest, setLogoManifest] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [letter, setLetter] = useState("All")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)

  const heroBanners = useBanners("brands-hero")
  const hero = heroBanners[0]

  useEffect(() => {
    const load = async () => {
      try {
        // Admin-managed brands supply the logo and slug; the catalogue supplies
        // which categories each brand actually sells and how many products.
        const [adminRes, productRes, logoRes] = await Promise.all([
          fetch("/api/brands").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/products?fields=card").then((r) => (r.ok ? r.json() : [])).catch(() => []),
          fetch("/api/brand-logos").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])

        setLogoManifest(logoRes?.logos || {})

        const adminBrands: any[] = Array.isArray(adminRes?.brands)
          ? adminRes.brands
          : Array.isArray(adminRes)
            ? adminRes
            : []

        const meta = new Map<string, { slug?: string; logo?: string }>()
        for (const b of adminBrands) {
          if (!b?.name) continue
          if (b.enabled === false || b.active === false || b.isEnabled === false) continue
          meta.set(String(b.name).toLowerCase(), { slug: b.slug, logo: b.logo })
        }

        const stats = new Map<string, { name: string; categories: Set<string>; count: number }>()
        for (const p of Array.isArray(productRes) ? productRes : []) {
          const name = String(p?.manufacturerName || p?.brand || "").trim()
          if (!name) continue
          const key = name.toLowerCase()
          if (!stats.has(key)) stats.set(key, { name, categories: new Set(), count: 0 })
          const entry = stats.get(key)!
          entry.count += 1
          const sub = String(p?.subCategory || "").trim()
          if (sub && !/^test\d*$/i.test(sub)) entry.categories.add(titleCaseLabel(/^tv\b/i.test(sub) ? "TV" : sub))
        }

        // Admin brands with no stock still deserve a tile.
        for (const [key, m] of meta) {
          if (!stats.has(key)) {
            const original = adminBrands.find((b) => String(b.name).toLowerCase() === key)
            stats.set(key, { name: String(original?.name || key), categories: new Set(), count: 0 })
          }
        }

        const list: Brand[] = [...stats.entries()]
          .map(([key, entry]) => ({
            name: entry.name,
            slug: meta.get(key)?.slug,
            logo: meta.get(key)?.logo,
            categories: [...entry.categories].slice(0, 3),
            count: entry.count,
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

        setBrands(list)
        setCategories([...new Set(list.flatMap((b) => b.categories))].sort())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const visible = useMemo(
    () =>
      brands.filter((b) => {
        if (query && !b.name.toLowerCase().includes(query.trim().toLowerCase())) return false
        if (category && !b.categories.includes(category)) return false
        if (letter === "All") return true
        const first = b.name[0]?.toUpperCase() || ""
        return letter === "#" ? !/[A-Z]/.test(first) : first === letter
      }),
    [brands, query, category, letter],
  )

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <main className="flex-grow">
        <div className="section-container space-y-6 py-4">
          <nav className="flex items-center gap-2 text-[12px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-700">Brands</span>
          </nav>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <section
            className="relative grid items-center gap-6 overflow-hidden rounded-2xl px-6 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:px-10"
            style={hero ? bannerGradient(hero) : { backgroundImage: "linear-gradient(115deg, #E9F1FB, #F7FBFF)" }}
            aria-labelledby="brands-hero-heading"
          >
            <div className={hero && !hero.dark ? "text-white" : "text-[#0F2557]"}>
              <h1
                id="brands-hero-heading"
                className="font-heading text-[30px] font-extrabold leading-[1.1] md:text-[42px]"
              >
                {hero?.title || (
                  <>
                    The Best Brands.
                    <br />
                    All in One Place.
                  </>
                )}
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                {hero?.subtitle || "Top brands. Genuine products. Best deals. Only at SARA."}
              </p>

              <ul className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
                {HERO_POINTS.map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="flex items-center gap-2.5">
                    <Icon className="h-5 w-5 flex-shrink-0 text-[#0F2557]" strokeWidth={1.5} />
                    <span>
                      <span className="block text-[12px] font-bold leading-tight text-[#0F2557]">{title}</span>
                      <span className="block text-[11px] leading-tight text-slate-500">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative hidden lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero?.image || "/banners/mixed-lineup.svg"}
                alt=""
                aria-hidden
                className="h-[220px] w-full object-contain"
              />
              <p className="absolute right-2 top-2 font-script text-xl leading-tight text-[#0F2557]">
                Trusted Brands
                <br />
                <span className="ml-3">Brighter Lives</span>
                <svg viewBox="0 0 120 12" className="mt-1 h-2.5 w-24" fill="none" aria-hidden>
                  <path
                    d="M2 9C26 3 62 2 90 4c10 .8 20 2.6 28 5"
                    stroke={hero?.accent || "#E11D2E"}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </p>
            </div>
          </section>

          {/* ── Filters ──────────────────────────────────────────── */}
          <section aria-labelledby="shop-by-brand">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 id="shop-by-brand" className="font-heading text-xl font-bold text-gray-900">
                Shop by Brand
              </h2>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                  <label htmlFor="brand-search" className="sr-only">
                    Search for a brand
                  </label>
                  <input
                    id="brand-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for a brand (e.g. Samsung, LG…)"
                    className="h-10 w-full rounded-md border border-gray-300 px-3.5 pr-10 text-[13px] focus:border-[#1560BD] focus:outline-none focus:ring-1 focus:ring-[#1560BD]"
                  />
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>

                <label className="sr-only" htmlFor="brand-category">
                  Filter by category
                </label>
                <select
                  id="brand-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 text-[13px] text-gray-700 focus:border-[#1560BD] focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {LETTERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLetter(l)}
                  aria-pressed={letter === l}
                  className={`h-8 min-w-[32px] rounded px-2 text-[12px] font-semibold transition-colors ${
                    letter === l
                      ? "bg-[#1560BD] text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:border-[#1560BD] hover:text-[#1560BD]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </section>

          {/* ── Brand grid ───────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-[150px] animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="rounded-lg border border-gray-200 bg-white py-16 text-center text-sm text-gray-500">
              No brands match that search.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {visible.map((brand) => (
                <li key={brand.name}>
                  <Link
                    href={
                      brand.slug
                        ? `/brands/${brand.slug}`
                        : `/products?brand=${encodeURIComponent(brand.name)}`
                    }
                    className="flex h-full flex-col items-center rounded-lg border border-gray-200 bg-white p-4 text-center transition-shadow hover:shadow-md"
                  >
                    <BrandLogo
                      name={brand.name}
                      src={isUrl(brand.logo) ? brand.logo : logoManifest[brand.slug || slugify(brand.name)]}
                    />
                    <span className="mt-3 line-clamp-2 text-[11px] leading-tight text-gray-500">
                      {brand.categories.length > 0
                        ? brand.categories.join(" | ")
                        : `${brand.count} product${brand.count === 1 ? "" : "s"}`}
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[12px] font-semibold text-[#1560BD]">
                      {brand.slug ? "Explore Brand" : "View Products"}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* ── Trust strip ──────────────────────────────────────── */}
          <section className="rounded-xl bg-[#EAF2FC]" aria-label="Why shop at SARA">
            <ul className="grid grid-cols-2 gap-4 px-5 py-5 lg:grid-cols-4">
              {[
                { icon: BadgeCheck, title: "100% Genuine Products", detail: "Direct from Brands" },
                { icon: Tag, title: "Easy EMI Options", detail: "All Major Banks" },
                { icon: Layers, title: "Wide Range", detail: "Across Categories" },
                { icon: ArrowRight, title: "Free & Fast Delivery", detail: "Across Karnataka" },
              ].map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[#1560BD]">
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-tight text-[#0F2557]">{title}</p>
                    <p className="text-[11px] leading-tight text-slate-500">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
