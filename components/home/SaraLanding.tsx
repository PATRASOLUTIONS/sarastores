"use client"

import { useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { fetchWithCache } from "@/utils/cache"
import { useSettingsData } from "@/hooks/useSettingsData"
import { useBanners } from "@/hooks/useBanners"
import { titleCaseLabel } from "@/lib/product-display"
import LandingHero from "@/components/home/landing/LandingHero"
import { CategoryRail, PromoDuo, PromoStrip, StatementBand } from "@/components/home/landing/LandingSections"
import {
  BrandLogos,
  FeaturedCategories,
  MemberRow,
  ProductShelf,
  StoresBand,
  WhyShop,
} from "@/components/home/landing/LandingBlocks"

const TTL = 5 * 60 * 1000
// Generous because a cold catalogue query is slow; the page renders without it anyway.
const TIMEOUT = 25000

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`Request failed: ${url}`)
  return res.json()
}

const isTestCategory = (name: string) => /^test\d*$/i.test(name.trim())

export default function SaraLanding() {
  const { data: settings } = useSettingsData()
  const [products, setProducts] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [brandDocs, setBrandDocs] = useState<any[]>([])
  const [storeCount, setStoreCount] = useState(85)

  const stripBanners = useBanners("home-strip")
  const duoBanners = useBanners("home-duo")
  const cardBanners = useBanners("home-card")
  const statementBanners = useBanners("home-statement")

  useEffect(() => {
    // Each source is independent: a slow one must not hold up the rest of the page.
    fetchWithCache("products-card", () => fetchJson("/api/products?fields=card"), TTL)
      .then((data) => Array.isArray(data) && setProducts(data))
      .catch(() => {})

    fetchWithCache("sub-categories", () => fetchJson("/api/sub-categories"), TTL)
      .then((data) => Array.isArray(data) && setSubCategories(data))
      .catch(() => {})

    fetchWithCache("brands", () => fetchJson("/api/brands"), TTL)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.brands
        if (Array.isArray(list)) setBrandDocs(list)
      })
      .catch(() => {})

    fetchWithCache("stores", () => fetchJson("/api/stores"), TTL)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.stores
        if (Array.isArray(list) && list.length > 0) setStoreCount(list.length)
      })
      .catch(() => {})
  }, [])

  const subCategoryImages = useMemo(
    () =>
      Object.fromEntries(
        subCategories.filter((s: any) => s?.name).map((s: any) => [String(s.name).toLowerCase(), s.image || ""]),
      ),
    [subCategories],
  )

  /** Browsable sub-category labels ordered by how much stock sits behind them. */
  const rankedSubCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const raw = String(p?.subCategory || "").trim()
      if (!raw || isTestCategory(raw)) continue
      const label = /^tv\b/i.test(raw) ? "TV" : raw
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => ({
        label: titleCaseLabel(label),
        raw: label,
        image: subCategoryImages[label.toLowerCase()] || undefined,
      }))
  }, [products, subCategoryImages])

  const categoryTiles = useMemo(
    () =>
      rankedSubCategories.slice(0, 11).map(({ label, raw, image }) => ({
        label,
        image,
        href: `/products?subCategory=${encodeURIComponent(raw)}`,
      })),
    [rankedSubCategories],
  )

  const featuredCategories = useMemo(
    () =>
      rankedSubCategories.slice(0, 6).map(({ label, raw, image }) => ({
        label,
        image,
        href: `/products?subCategory=${encodeURIComponent(raw)}`,
      })),
    [rankedSubCategories],
  )

  /** Curated brands (they have landing pages) first, then whatever else the catalogue carries. */
  const brands = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const brand = String(p?.manufacturerName || p?.brand || "").trim()
      if (brand) counts.set(brand.toLowerCase(), (counts.get(brand.toLowerCase()) || 0) + 1)
    }

    const curated = brandDocs
      .filter((b: any) => b?.name && b?.slug)
      .map((b: any) => ({
        name: b.name,
        logo: b.logo || undefined,
        href: `/brands/${b.slug}`,
        count: counts.get(String(b.name).toLowerCase()) || 0,
      }))

    const curatedNames = new Set(curated.map((b) => b.name.toLowerCase()))

    const fromCatalogue = [...counts.entries()]
      .filter(([key]) => !curatedNames.has(key))
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => {
        const label = products.find(
          (p) => String(p?.manufacturerName || p?.brand || "").trim().toLowerCase() === key,
        )
        return {
          name: titleCaseLabel(String(label?.manufacturerName || label?.brand || key)),
          logo: undefined,
          href: `/products?brand=${encodeURIComponent(String(label?.manufacturerName || label?.brand || key))}`,
          count,
        }
      })

    return [...curated.sort((a, b) => b.count - a.count), ...fromCatalogue].slice(0, 12)
  }, [products, brandDocs])

  const newArrivals = useMemo(
    () =>
      [...products]
        .filter((p) => p?.image && Number(p?.price) > 0)
        .sort(
          (a, b) =>
            (new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() || 0) -
            (new Date(a.createdAt ?? a.updatedAt ?? 0).getTime() || 0),
        )
        .slice(0, 12),
    [products],
  )

  const bestSellers = useMemo(
    () =>
      [...products]
        .filter((p) => p?.image && Number(p?.price) > 0 && Number(p?.mrp) > Number(p?.price))
        .sort((a, b) => Number(b.mrp) - Number(b.price) - (Number(a.mrp) - Number(a.price)))
        .slice(0, 12),
    [products],
  )

  const phone = settings?.storePhone || "1800 123 7272"

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F7FB]">
      <Header />

      <main className="flex-grow">
        <LandingHero />

        <div className="space-y-6 pb-10 pt-2">
          <CategoryRail tiles={categoryTiles} />
          {stripBanners[0] && <PromoStrip banner={stripBanners[0]} />}
          <PromoDuo banners={duoBanners} />
          <BrandLogos brands={brands} />
          <ProductShelf title="New Arrivals" href="/products" products={newArrivals} />
          <FeaturedCategories items={featuredCategories} />
          <StoresBand storeCount={storeCount} />
          <MemberRow cards={cardBanners} />
          <ProductShelf title="Best Value Today" href="/offers" products={bestSellers} />
          <WhyShop phone={phone} />
          {statementBanners[0] && <StatementBand banner={statementBanners[0]} />}
        </div>
      </main>

      <Footer />
    </div>
  )
}
