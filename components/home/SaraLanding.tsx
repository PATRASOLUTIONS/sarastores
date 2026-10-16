"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { fetchWithCache, setCached } from "@/utils/cache"
import { useBanners } from "@/hooks/useBanners"
import LandingHero from "@/components/home/landing/LandingHero"
import {
  HOME_BRANDS, HOME_CATEGORIES, HomepageBenefits, HomepageBrands, HomepageCategories,
  HomepageDeals, HomepagePromotions, HomepageStores, type HomeBrand, type HomeProduct,
} from "@/components/home/landing/HomepageSections"
import styles from "@/components/home/landing/homepage.module.css"
import { MarketingSection, MarketingSections } from "@/components/marketing/MarketingSections"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { catalogProductListResponseSchema } from "@/utils/catalog"
import { homeSubCategoryListResponseSchema, homeBrandListResponseSchema, homeStoreListResponseSchema } from "@/lib/catalog-list-response"
import type { HandshakeLaunch } from "@/lib/handshake"
import EcommerceLaunch from "@/components/home/EcommerceLaunch"

const TTL = 5 * 60 * 1000
const TIMEOUT = 25000
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const text = (value: unknown) => typeof value === "string" ? value : undefined
const imageUrl = (value: unknown) => typeof value === "string" && /^(https?:\/\/|\/)/.test(value) ? value : undefined
const number = (value: unknown) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined

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
  const [subCategories, setSubCategories] = useState<Record<string, unknown>[]>([])
  const [brandDocs, setBrandDocs] = useState<Record<string, unknown>[]>([])
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
    fetchWithCache("sub-categories", () => fetchJson("/api/sub-categories"), homeSubCategoryListResponseSchema, TTL)
      .then((data) => {
        setSubCategories(data)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load categories:", error))
    fetchWithCache("brands", () => fetchJson("/api/brands"), homeBrandListResponseSchema, TTL)
      .then((data) => {
        setBrandDocs(data)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load brands:", error))
    fetchWithCache("stores", () => fetchJson("/api/stores"), homeStoreListResponseSchema, TTL)
      .then((data) => {
        if (data.length) setStoreCount(data.length)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load stores:", error))
  }, [loadProducts])

  const categories = useMemo(() => HOME_CATEGORIES.map((fallback) => {
    const category = subCategories.find((item) => fallback.match.test(String(item.name || "")))
    return category ? {
      ...fallback,
      image: imageUrl(category.image) || fallback.image,
      href: `/products?subCategory=${encodeURIComponent(String(category.name))}`,
    } : fallback
  }), [subCategories])

  const brands = useMemo<HomeBrand[]>(() => {
    return HOME_BRANDS.map((fallback) => {
      const brand = brandDocs.find((item) => String(item.name).toLowerCase() === fallback.name.toLowerCase())
      if (brand?.enabled === false || brand?.active === false) return null
      if (!brand) return fallback
      return {
        ...fallback,
        logo: imageUrl(brand.logo) || fallback.logo,
        href: text(brand.slug) ? `/brands/${brand.slug}` : fallback.href,
      }
    }).filter((brand): brand is HomeBrand => brand !== null)
  }, [brandDocs])

  const deals = useMemo(() => {
    const available = products.filter((product) => product.stock > 0)
    const discounted = available.filter((product) => product.mrp && product.mrp > product.price)
      .sort((a, b) => ((b.mrp || b.price) - b.price) / (b.mrp || b.price) - ((a.mrp || a.price) - a.price) / (a.mrp || a.price))
    const candidates = discounted.length ? discounted : available
    const selected: HomeProduct[] = []
    for (const category of HOME_CATEGORIES) {
      const product = candidates.find((item) => !selected.includes(item) && category.match.test(`${item.subCategory || ""} ${item.category || ""} ${item.name}`))
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
          <MarketingSection page="home" section="benefits"><HomepageBenefits storeCount={storeCount} /></MarketingSection>
          <MarketingSection page="home" section="categories"><HomepageCategories categories={categories.map((category, index) => ({
            ...category, label: marketing.text("categories", `item${index + 1}Title`, category.label),
            image: marketing.image("categories", `item${index + 1}Image`, category.image),
            href: marketing.text("categories", `item${index + 1}Href`) || category.href,
          }))} /></MarketingSection>
          <MarketingSection page="home" section="deals"><HomepageDeals products={deals} loading={loading} error={catalogueError} retry={() => void loadProducts(true)} /></MarketingSection>
          <MarketingSection page="home" section="promotions"><HomepagePromotions banners={[...cardBanners, ...stripBanners, ...statementBanners].sort((a, b) => (a.order || 0) - (b.order || 0))} /></MarketingSection>
          <MarketingSection page="home" section="brands"><HomepageBrands brands={brands.map(brand => {
            const index = HOME_BRANDS.findIndex(item => item.name === brand.name)
            return { ...brand, name: marketing.text("brands", `item${index + 1}Title`, brand.name),
              logo: marketing.image("brands", `item${index + 1}Image`, brand.logo || ""),
              href: marketing.text("brands", `item${index + 1}Href`) || brand.href }
          })} /></MarketingSection>
          <MarketingSection page="home" section="stores"><HomepageStores storeCount={storeCount} /></MarketingSection>
        </MarketingSections>
      </main>
      <Footer />
    </div>
  )
}
