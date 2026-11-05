"use client"

import { catalogueBrand } from "@/lib/product-metadata-sheet"
import { uniquePublicProductNames } from "@/lib/public-product-names"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SWRConfig } from "swr"
import dynamic from "next/dynamic"
import type { HomepageContent } from "@/lib/homepage-data"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { fetchWithCache, getCached, setCached } from "@/utils/cache"
import { useBanners } from "@/hooks/useBanners"
import LandingHero from "@/components/home/landing/LandingHero"
import {
  HomepageBrands,
  HomepageDeals, HomepageProductRail, HomepagePromotions, HomepageStores, type HomeProduct,
} from "@/components/home/landing/HomepageSections"
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed"
import styles from "@/components/home/landing/homepage.module.css"
import { MarketingSection, MarketingSections } from "@/components/marketing/MarketingSections"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { catalogProductListResponseSchema } from "@/utils/catalog"
import { homeStoreListResponseSchema } from "@/lib/catalog-list-response"
import type { HandshakeLaunch } from "@/lib/handshake"
const EcommerceLaunch = dynamic(() => import("@/components/home/EcommerceLaunch"), { ssr: false })

const TTL = 5 * 60 * 1000
const HOME_PRODUCTS_CACHE_KEY = "home-products-in-stock"
const normalize = (value: unknown) => String(value || "").trim().toLowerCase()
const TIMEOUT = 25000
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const text = (value: unknown) => typeof value === "string" ? value : undefined
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

type LandingProps = { launch?: HandshakeLaunch | null; initialProducts?: HomeProduct[]; initialContent?: HomepageContent; initialNow?: number }

export default function SaraLanding(props: LandingProps) {
  const fallback = useMemo(() => props.initialContent ? { "/api/marketing-content": props.initialContent.marketing } : {}, [props.initialContent])
  return <SWRConfig value={{ fallback }}><LandingContent {...props} /></SWRConfig>
}

function LandingContent({ launch = null, initialProducts, initialContent, initialNow }: LandingProps) {
  const initialBanners = useMemo(() => Object.fromEntries(
    ["home-hero", "home-strip", "home-duo", "home-card", "home-statement"].map(placement =>
      [placement, initialContent?.banners.filter(banner => banner.placement === placement)]),
  ), [initialContent])
  const marketing = useMarketingContent("home")
  const [products, setProducts] = useState<HomeProduct[]>(initialProducts || [])
  const [storeCount, setStoreCount] = useState<number | undefined>(initialContent?.storeCount)
  const [loading, setLoading] = useState(!initialProducts)
  const [catalogueError, setCatalogueError] = useState<string>()
  const stripBanners = useBanners("home-strip", undefined, initialBanners["home-strip"], initialNow)
  const duoBanners = useBanners("home-duo", undefined, initialBanners["home-duo"], initialNow)
  const cardBanners = useBanners("home-card", undefined, initialBanners["home-card"], initialNow)
  const statementBanners = useBanners("home-statement", undefined, initialBanners["home-statement"], initialNow)

  const loadProducts = useCallback(async (refresh = false) => {
    setLoading(true)
    setCatalogueError(undefined)
    try {
      // A cached list can name products that have since sold out, so it only
      // fills the page while the live in-stock list loads, then is replaced.
      const live = fetchJson("/api/products?fields=card&inStock=true&limit=60")
        .then((data) => setCached(HOME_PRODUCTS_CACHE_KEY, data, catalogProductListResponseSchema))
      const cached = refresh ? null : getCached(HOME_PRODUCTS_CACHE_KEY, catalogProductListResponseSchema, Number.POSITIVE_INFINITY)
      if (cached) {
        setProducts(uniquePublicProductNames(parseProducts(cached)).slice(0, 6))
        setLoading(false)
      }
      setProducts(uniquePublicProductNames(parseProducts(await live)).slice(0, 6))
    } catch (error) {
      console.error("[Homepage] Could not load deals:", error)
      setCatalogueError("We couldn't load today's deals. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialProducts) void loadProducts()
    if (initialContent) return
    fetchWithCache("stores", () => fetchJson("/api/stores"), homeStoreListResponseSchema, TTL)
      .then((data) => {
        if (data.length) setStoreCount(data.length)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load stores:", error))
  }, [initialProducts, initialContent, loadProducts])

  const { products: viewed } = useRecentlyViewed()
  const recentlyViewed = useMemo<HomeProduct[]>(() => viewed.slice(0, 6).map((item) => ({
    id: item.id,
    name: item.name,
    image: item.image,
    price: item.price,
    mrp: item.mrp,
    stock: item.stock ?? 0,
    slug: item.slug,
    category: item.category,
    subCategory: item.subCategory ?? undefined,
    brand: catalogueBrand(item) || undefined,
  })), [viewed])

  const [recommendations, setRecommendations] = useState<HomeProduct[]>([])
  const recommendationCategories = JSON.stringify([...new Set(recentlyViewed.slice(0, 4).flatMap(product => product.category ? [product.category] : []))])
  useEffect(() => {
    const categories: string[] = JSON.parse(recommendationCategories)
    if (!categories.length) { setRecommendations([]); return }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void Promise.allSettled(categories.map(category =>
        fetchJson("/api/products?" + new URLSearchParams({ fields: "card", inStock: "true", category, limit: "30" })).then(parseProducts),
      )).then(results => {
        if (!cancelled) setRecommendations(uniquePublicProductNames(results.flatMap(result => result.status === "fulfilled" ? result.value : [])))
      })
    }, 1000)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [recommendationCategories])

  const similarToViewed = useMemo(() => {
    const taken = new Set(recentlyViewed.map((item) => item.id))
    const picked: HomeProduct[] = []
    for (const seed of recentlyViewed.slice(0, 4)) {
      const subCategory = normalize(seed.subCategory)
      const category = normalize(seed.category)
      const brand = normalize(seed.brand)
      const matches = recommendations
        .filter((item) => !taken.has(item.id) && item.stock > 0 &&
          (subCategory ? normalize(item.subCategory) === subCategory : Boolean(category) && normalize(item.category) === category) &&
          item.price >= seed.price * 0.6 && item.price <= seed.price * 1.6)
        .sort((a, b) =>
          (normalize(a.brand) === brand ? 0 : 1) - (normalize(b.brand) === brand ? 0 : 1) ||
          Math.abs(a.price - seed.price) - Math.abs(b.price - seed.price))
        .slice(0, 3)
      for (const item of matches) { taken.add(item.id); picked.push(item) }
    }
    return picked.slice(0, 6)
  }, [recommendations, recentlyViewed])

  return (
    <div className="flex min-h-screen flex-col bg-brand-surface-raised">
      <Header staticContent />
      <main id="main-content" className={styles.homepage}>
        {!marketing.enabled("hero") && <h1 className="sr-only">SARA Electronics</h1>}
        {launch ? <EcommerceLaunch launch={launch} /> : null}
        <MarketingSection page="home" section="hero"><LandingHero products={[...(initialContent?.heroProducts || []), ...products]} sideBanners={duoBanners} initialBanners={initialBanners["home-hero"]} initialNow={initialNow} /></MarketingSection>
        <HomepageBrands />
        <MarketingSection page="home" section="deals"><HomepageDeals products={products} loading={loading} error={catalogueError} retry={() => void loadProducts(true)} /></MarketingSection>
        <HomepageProductRail label="Recently viewed" title="Recently Viewed" href="/products" ctaText="Shop All" products={recentlyViewed} />
        <HomepageProductRail label="Similar products" title="Similar to What You Viewed" href="/products?availability=in" products={similarToViewed} />
        <MarketingSections page="home">
          <MarketingSection page="home" section="promotions"><HomepagePromotions banners={[...cardBanners, ...stripBanners, ...statementBanners].sort((a, b) => (a.order || 0) - (b.order || 0))} /></MarketingSection>
          <MarketingSection page="home" section="stores"><HomepageStores storeCount={storeCount} /></MarketingSection>
        </MarketingSections>
      </main>
      <Footer staticContent />
    </div>
  )
}
