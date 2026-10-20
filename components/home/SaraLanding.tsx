"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { fetchWithCache, setCached } from "@/utils/cache"
import { useBanners } from "@/hooks/useBanners"
import LandingHero from "@/components/home/landing/LandingHero"
import {
  HOME_BRANDS, HOME_CATEGORIES, HomepageBenefits, HomepageBrands, HomepageCategories,
  HomepageDeals, HomepagePromotions, HomepageStores, type HomeBrand, type HomeCategory, type HomeProduct,
} from "@/components/home/landing/HomepageSections"
import { type TaxonomyDivision } from "@/lib/product-taxonomy"
import { fetchTaxonomy } from "@/lib/taxonomy-client"
import { titleCaseLabel } from "@/lib/product-display"
import { taxonomyImage } from "@/lib/taxonomy-images"
import styles from "@/components/home/landing/homepage.module.css"
import { MarketingSection, MarketingSections } from "@/components/marketing/MarketingSections"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { catalogProductListResponseSchema } from "@/utils/catalog"
import { homeSubCategoryListResponseSchema, homeBrandListResponseSchema, homeStoreListResponseSchema } from "@/lib/catalog-list-response"
import type { HandshakeLaunch } from "@/lib/handshake"
import EcommerceLaunch from "@/components/home/EcommerceLaunch"

const TTL = 5 * 60 * 1000
const TIMEOUT = 25000
/** Tiles in the category rail. The grid that lays it out is ten columns wide. */
const RAIL_SIZE = 10
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
  const [taxonomy, setTaxonomy] = useState<TaxonomyDivision[]>([])
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
    fetchWithCache("stores", () => fetchJson("/api/stores"), homeStoreListResponseSchema, TTL)
      .then((data) => {
        if (data.length) setStoreCount(data.length)
      })
      .catch((error: unknown) => console.error("[Homepage] Could not load stores:", error))
  }, [loadProducts])

  /*
   * The rail is the catalogue's own sub-categories, busiest first.
   *
   * It used to be ten fixed aisles — Laptops, Audio, Wearables — that a shopper
   * could click through to an empty page, because this catalogue does not sell
   * them. Reading the live sub-categories means every tile leads to stock, and
   * its count is the number the /products filter will actually show.
   *
   * Spellings are deduplicated on letters and digits alone, less a trailing
   * plural, so `TV 55"`/`TV 55` and `Refrigerator`/`Refrigerators` do not each
   * take two of the ten slots. The busier spelling wins, and the quieter one
   * is still reachable from the header menu. This hides the duplication rather
   * than fixing it — the catalogue still needs those labels reconciled.
   */
  const categories = useMemo<HomeCategory[]>(() => {
    const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "")
    const best = new Map<string, { name: string; count: number }>()
    for (const division of taxonomy) {
      for (const subCategory of division.subCategories) {
        const id = key(subCategory.name)
        if (!id) continue
        const held = best.get(id)
        if (!held || subCategory.count > held.count) best.set(id, { name: subCategory.name, count: subCategory.count })
      }
    }

    const tiles = [...best.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, RAIL_SIZE)
      .map(({ name, count }) => {
        const reference = HOME_CATEGORIES.find((item) => item.match?.test(name))
        const stored = subCategories.find((item) => key(String(item.name || "")) === key(name))
        return {
          label: titleCaseLabel(name),
          // The downloaded photo first, then whatever an administrator uploaded
          // for this sub-category, then the reference illustration.
          image: taxonomyImage(name) || imageUrl(stored?.image) || reference?.image || "",
          fallbackImage: reference?.image,
          href: `/products?subCategory=${encodeURIComponent(name)}&availability=in`,
          count,
        }
      })

    // Before the taxonomy arrives, show the reference aisles rather than a gap
    // that would shift the whole page down when it does.
    return tiles.length > 0 ? tiles : HOME_CATEGORIES
  }, [taxonomy, subCategories])

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
          <MarketingSection page="home" section="benefits"><HomepageBenefits storeCount={storeCount} /></MarketingSection>
          <MarketingSection page="home" section="categories"><HomepageCategories categories={categories.map((category, index) => ({
            ...category, label: marketing.text("categories", `item${index + 1}Title`, category.label),
            image: marketing.image("categories", `item${index + 1}Image`, category.image),
            href: marketing.text("categories", `item${index + 1}Href`) || category.href,
          }))} /></MarketingSection>
          <MarketingSection page="home" section="deals"><HomepageDeals products={deals} loading={loading} error={catalogueError} retry={() => void loadProducts(true)} /></MarketingSection>
          <MarketingSection page="home" section="promotions"><HomepagePromotions banners={[...cardBanners, ...stripBanners, ...statementBanners].sort((a, b) => (a.order || 0) - (b.order || 0))} /></MarketingSection>
          <MarketingSection page="home" section="brands"><HomepageBrands brands={brands} /></MarketingSection>
          <MarketingSection page="home" section="stores"><HomepageStores storeCount={storeCount} /></MarketingSection>
        </MarketingSections>
      </main>
      <Footer />
    </div>
  )
}
