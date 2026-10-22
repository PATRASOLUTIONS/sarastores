"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { fetchWithCache, setCached } from "@/utils/cache"
import { useBanners } from "@/hooks/useBanners"
import LandingHero from "@/components/home/landing/LandingHero"
import {
  HOME_BRANDS, HOME_CATEGORIES, HomepageBenefits, HomepageBrandPedestals, HomepageBrands,
  HomepageDeals, HomepagePromotions, HomepageStores, type HomeBrand, type HomeProduct,
} from "@/components/home/landing/HomepageSections"
import { type TaxonomyDivision } from "@/lib/product-taxonomy"
import { fetchTaxonomy } from "@/lib/taxonomy-client"
import styles from "@/components/home/landing/homepage.module.css"
import { MarketingSection, MarketingSections } from "@/components/marketing/MarketingSections"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { catalogProductListResponseSchema } from "@/utils/catalog"
import { homeBrandImageListResponseSchema, homeBrandListResponseSchema, homeStoreListResponseSchema } from "@/lib/catalog-list-response"
import type { HandshakeLaunch } from "@/lib/handshake"
import EcommerceLaunch from "@/components/home/EcommerceLaunch"

const TTL = 5 * 60 * 1000
const TIMEOUT = 25000
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const text = (value: unknown) => typeof value === "string" ? value : undefined
const imageUrl = (value: unknown) => typeof value === "string" && /^(https?:\/\/|\/)/.test(value) ? value : undefined
const number = (value: unknown) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined
const MOBILE_BRANDS = [
  "Apple", "Benco", "Cellcor", "Giva", "Google", "Infinix", "Itel", "Karbonn",
  "OnePlus", "OPPO", "POCO", "realme", "Redmi", "Samsung", "Tecno", "Villaon", "Vivo",
]

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!response.ok) throw new Error(`Request failed: ${url} (${response.status})`)
  return response.json()
}

function parseProducts(data: unknown): HomeProduct[] {
  if (!Array.isArray(data)) throw new Error("Invalid catalogue response")
  return data.flatMap((item: unknown) => {
    if (!isRecord(item)) return []
    const id = text(item.id)
    const name = text(item.name)
    const image = text(item.image)
    const price = number(item.price)
    if (!id || !name || !image || price === undefined || price <= 0) return []
    const reviews = isRecord(item.reviews) ? item.reviews : undefined
    return [{
      id, name, image, price,
      mrp: number(item.mrp),
      stock: number(item.stock) ?? 0,
      slug: text(item.slug),
      category: text(item.category),
      subCategory: text(item.subCategory),
      brand: text(item.manufacturerName) || text(item.brand),
      rating: number(item.rating) || number(reviews?.average),
      reviewsCount: number(item.reviewsCount) || number(reviews?.count) || number(item.reviews),
    }]
  })
}

export default function SaraLanding({ launch = null }: { launch?: HandshakeLaunch | null }) {
  const marketing = useMarketingContent("home")
  const [products, setProducts] = useState<HomeProduct[]>([])
  const [taxonomy, setTaxonomy] = useState<TaxonomyDivision[]>([])
  const [brandDocs, setBrandDocs] = useState<Record<string, unknown>[]>([])
  const [brandImages, setBrandImages] = useState<Record<string, string>>({})
  const [storeCount, setStoreCount] = useState<number>()
  const [loading, setLoading] = useState(true)
  const [catalogueError, setCatalogueError] = useState<string>()
  const stripBanners = useBanners("home-strip")
  const duoBanners = useBanners("home-duo")
  const cardBanners = useBanners("home-card")
  const statementBanners = useBanners("home-statement")

  const loadProducts = useCallback(async (refresh = false) => {
    setLoading(true)
    setCatalogueError(undefined)
    try {
      const fetcher = () => fetchJson("/api/products?fields=card")
      const data = refresh
        ? setCached("products-card", await fetcher(), catalogProductListResponseSchema)
        : await fetchWithCache("products-card", fetcher, catalogProductListResponseSchema, TTL)
      setProducts(parseProducts(data))
    } catch (error) {
      console.error("[Homepage] Could not load deals:", error)
      setCatalogueError("We couldn't load today's deals. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
    // Shares a cache entry with the header menu, which needs the same tree on
    // every route; see lib/taxonomy-client.ts for why that matters.
    fetchTaxonomy()
      .then(setTaxonomy)
      .catch((error: unknown) => console.error("[Homepage] Could not load the catalogue taxonomy:", error))
    fetchWithCache("brands", () => fetchJson("/api/brands"), homeBrandListResponseSchema, TTL)
      .then((data) => {
        setBrandDocs(data)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load brands:", error))
    fetchWithCache("mobile-brand-images-v2", () => fetchJson("/api/products/mobile-brand-images"), homeBrandImageListResponseSchema, TTL)
      .then(data => {
        setBrandImages(Object.fromEntries(data.brands.flatMap(brand =>
          brand.image ? [[brand.name.toLowerCase(), brand.image]] : [],
        )))
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load mobile brand images:", error))
    fetchWithCache("stores", () => fetchJson("/api/stores"), homeStoreListResponseSchema, TTL)
      .then((data) => {
        if (data.length) setStoreCount(data.length)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load stores:", error))
  }, [loadProducts])

  const brands = useMemo<HomeBrand[]>(() => {
    const counts = new Map<string, { name: string; count: number }>()
    for (const division of taxonomy) {
      for (const brand of division.brands) {
        const key = brand.name.trim().toLowerCase()
        if (!key) continue
        const held = counts.get(key)
        if (held) held.count += brand.count
        else counts.set(key, { name: brand.name.trim(), count: brand.count })
      }
    }

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .flatMap(({ name }) => {
        const document = brandDocs.find(item => String(item.name || "").trim().toLowerCase() === name.toLowerCase())
        if (document?.enabled === false || document?.active === false) return []
        const fallback = HOME_BRANDS.find(item => item.name.toLowerCase() === name.toLowerCase())
        return [{
          name,
          logo: imageUrl(document?.logo) || fallback?.logo,
          href: `/products?${new URLSearchParams({ brand: name, availability: "in" }).toString()}`,
        }]
      })
      .slice(0, HOME_BRANDS.length)
  }, [brandDocs, taxonomy])

  const shopBrands = useMemo<HomeBrand[]>(() => {
    return MOBILE_BRANDS.flatMap(name => {
      const key = name.toLowerCase()
      const image = brandImages[key]
      if (!image) return []
      return [{
        name,
        logo: image,
        href: `/products?${new URLSearchParams({ brand: name, availability: "in" }).toString()}`,
      }]
    })
  }, [brandImages])
  void shopBrands
  void HomepageBenefits
  void HomepageBrandPedestals

  const deals = useMemo(() => {
    const available = products.filter((product) => product.stock > 0)
    const discounted = available.filter((product) => product.mrp && product.mrp > product.price)
      .sort((a, b) => ((b.mrp || b.price) - b.price) / (b.mrp || b.price) - ((a.mrp || a.price) - a.price) / (a.mrp || a.price))
    const candidates = discounted.length ? discounted : available
    const selected: HomeProduct[] = []
    for (const category of HOME_CATEGORIES) {
      const product = candidates.find((item) => !selected.includes(item) && category.match?.test(`${item.subCategory || ""} ${item.category || ""} ${item.name}`))
      if (product) selected.push(product)
      if (selected.length === 6) break
    }
    return [...selected, ...candidates.filter((item) => !selected.includes(item))].slice(0, 6)
  }, [products])

  return (
    <div className="flex min-h-screen flex-col bg-brand-surface-raised">
      <Header />
      <main id="main-content" className={styles.homepage}>
        {!marketing.enabled("hero") && <h1 className="sr-only">SARA Electronics</h1>}
        {launch ? <EcommerceLaunch launch={launch} /> : null}
        <MarketingSections page="home">
          <MarketingSection page="home" section="hero"><LandingHero products={products} sideBanners={duoBanners} /></MarketingSection>
          {/* <MarketingSection page="home" section="benefits"><HomepageBenefits storeCount={storeCount} /></MarketingSection> */}
          {/* <MarketingSection page="home" section="categories"><HomepageBrandPedestals brands={shopBrands} /></MarketingSection> */}
          <MarketingSection page="home" section="brands"><HomepageBrands brands={brands} /></MarketingSection>
          <MarketingSection page="home" section="deals"><HomepageDeals products={deals} loading={loading} error={catalogueError} retry={() => void loadProducts(true)} /></MarketingSection>
          <MarketingSection page="home" section="promotions"><HomepagePromotions banners={[...cardBanners, ...stripBanners, ...statementBanners].sort((a, b) => (a.order || 0) - (b.order || 0))} /></MarketingSection>
          <MarketingSection page="home" section="stores"><HomepageStores storeCount={storeCount} /></MarketingSection>
        </MarketingSections>
      </main>
      <Footer />
    </div>
  )
}
