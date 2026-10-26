"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronRight, CreditCard, Search, ShieldCheck, Star, Tag, Truck, Wrench } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { bannerGradient, bannerIsPhotoOnly, useBanners } from "@/hooks/useBanners"
import { titleCaseLabel } from "@/lib/product-display"
import { brandOf, categoryOf } from "@/utils/catalog"
import styles from "./brands.module.css"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingSection, MarketingSections } from "@/components/marketing/MarketingSections"

type Brand = {
  name: string
  slug?: string
  logo?: string
  categories: string[]
  count: number
}

type CatalogRecord = Record<string, unknown>

const LETTERS = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"]
const HERO_POINTS = [
  { icon: ShieldCheck, title: "Genuine", detail: "Products" },
  { icon: Tag, title: "Explore", detail: "Brand Offers" },
  { icon: Star, title: "Wide Range", detail: "Across Categories" },
]
const BENEFITS = [
  { icon: ShieldCheck, title: "Genuine Products", detail: "From Trusted Brands", href: "/warranty" },
  { icon: CreditCard, title: "Easy EMI Options", detail: "Available at Checkout", href: "/emi" },
  { icon: Wrench, title: "Expert Assistance", detail: "In-Store & Online", href: "/contact" },
  { icon: Truck, title: "Delivery Options", detail: "See Our Shipping Policy", href: "/shipping-policy" },
]
const REFERENCE_LOGOS: Record<string, string> = {
  "/brands/samsung.png": "/brand-page/samsung.webp",
  "/brands/lg.png": "/brand-page/lg.webp",
  "/brands/sony.svg": "/brand-page/sony.webp",
  "/brands/godrej.svg": "/brand-page/godrej.webp",
  "/brands/haier.svg": "/brand-page/haier.webp",
  "/brands/whirlpool.svg": "/brand-page/whirlpool.webp",
  "/brands/bosch.svg": "/brand-page/bosch.webp",
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : ""
const isRecord = (value: unknown): value is CatalogRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const isImageUrl = (value?: string) => !!value && /^(https?:\/\/|\/(?!\/)|data:image\/)/i.test(value)
const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Could not load brand information (${response.status}).`)
  return response.json()
}

async function fetchCatalog(signal: AbortSignal): Promise<CatalogRecord[]> {
  const products: CatalogRecord[] = []
  // The products endpoint caps each response; read every page before deriving categories.
  while (true) {
    const response = await fetch(`/api/products?fields=card&limit=1000&skip=${products.length}`, { signal })
    if (!response.ok) throw new Error(`Could not load the brand catalog (${response.status}).`)
    const page: unknown = await response.json()
    if (!Array.isArray(page) || !page.every(isRecord)) throw new Error("Invalid brand catalog response.")
    products.push(...page)
    const more = response.headers.get("X-Has-More")
    if (more === "false" || (more === null && page.length < 1000)) return products
    if (page.length === 0) throw new Error("The brand catalog could not be loaded completely.")
  }
}

function buildBrands(adminBrands: CatalogRecord[], products: CatalogRecord[]): Brand[] {
  const metadata = new Map<string, CatalogRecord>()
  const disabled = new Set<string>()
  for (const brand of adminBrands) {
    const name = text(brand.name)
    if (!name) continue
    const key = name.toLowerCase()
    if (brand.enabled === false || brand.active === false || brand.isEnabled === false) disabled.add(key)
    else metadata.set(key, brand)
  }
  const knownNames = adminBrands.map((brand) => text(brand.name)).filter(Boolean).sort((a, b) => b.length - a.length)
  const nameMatchers = knownNames.map((name) => ({
    name,
    pattern: new RegExp(`(?:^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i"),
  }))
  const stats = new Map<string, Brand>()
  for (const product of products) {
    const manufacturer = text(product.manufacturerName) || text(product.manufacturer_name) || text(product.brand)
    const name = brandOf({ manufacturerName: manufacturer })
      ? manufacturer
      : nameMatchers.find(({ pattern }) => pattern.test(text(product.name)))?.name
    if (!name || disabled.has(name.toLowerCase())) continue
    const key = name.toLowerCase()
    if (!stats.has(key)) stats.set(key, { name, categories: [], count: 0 })
    const brand = stats.get(key)!
    brand.count += 1
    const rawCategory = text(product.subCategory)
    const category = categoryOf(product) || (/^test\d*$/i.test(rawCategory) ? "" : titleCaseLabel(rawCategory))
    if (category && !brand.categories.includes(category)) brand.categories.push(category)
  }
  for (const [key, meta] of metadata) {
    const brand = stats.get(key) || { name: text(meta.name), categories: [], count: 0 }
    brand.name = text(meta.name)
    // Only configured, enabled landing pages should receive directory traffic.
    brand.slug = meta.landingPageEnabled === true ? text(meta.slug) || undefined : undefined
    brand.logo = text(meta.logo) || undefined
    stats.set(key, brand)
  }
  return [...stats.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function BrandLogo({ name, src }: { name: string; src?: string }) {
  const [failedSource, setFailedSource] = useState<string>()
  const artwork = src ? REFERENCE_LOGOS[src] || src : undefined
  return <span className={styles.logo}>
    {!artwork || failedSource === artwork ? <span className={styles.wordmark} aria-hidden="true">{name}</span> : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={artwork} alt={`${name} logo`} onError={() => setFailedSource(artwork)} />
    )}
  </span>
}

export default function BrandsPage() {
  const marketing = useMarketingContent("brands")
  const [brands, setBrands] = useState<Brand[]>([])
  const [logoManifest, setLogoManifest] = useState<Record<string, string>>({})
  const [query, setQuery] = useState("")
  const [letter, setLetter] = useState("All")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const hero = useBanners("brands-hero")[0]

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const [adminResponse, products, logoResponse] = await Promise.all([
          fetchJson("/api/brands", controller.signal),
          fetchCatalog(controller.signal),
          fetchJson("/api/brand-logos", controller.signal),
        ])
        const adminBrands = isRecord(adminResponse) ? adminResponse.brands : adminResponse
        if (!Array.isArray(adminBrands) || !adminBrands.every(isRecord)) throw new Error("Invalid brands response.")
        if (!isRecord(logoResponse) || !isRecord(logoResponse.logos) ||
          !Object.values(logoResponse.logos).every((value) => typeof value === "string")) {
          throw new Error("Invalid brand artwork response.")
        }
        if (controller.signal.aborted) return
        setLogoManifest(Object.fromEntries(Object.entries(logoResponse.logos).map(([key, value]) => [key, text(value)])))
        setBrands(buildBrands(adminBrands, products))
      } catch (cause) {
        if (controller.signal.aborted) return
        console.error("[Brands] Loading failed:", cause)
        setError(cause instanceof Error ? cause.message : "Brand information is temporarily unavailable.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])

  const categories = useMemo(() => [...new Set(brands.flatMap((brand) => brand.categories))].sort(), [brands])
  const visible = useMemo(() => brands.filter((brand) => {
    if (!brand.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    if (category && !brand.categories.includes(category)) return false
    const first = brand.name[0]?.toUpperCase() || ""
    return letter === "All" || (letter === "#" ? !/[A-Z]/.test(first) : first === letter)
  }), [brands, query, category, letter])

  const resetFilters = () => { setQuery(""); setLetter("All"); setCategory("") }

  return <div className={styles.page}>
    <Header />
    <main className={styles.container}>
      {!marketing.enabled("hero") && <h1 className="sr-only">Shop by Brand</h1>}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/">Home</Link><ChevronRight size={12} /><span>Brands</span>
      </nav>
      <MarketingSections page="brands">
      <MarketingSection page="brands" section="hero">
      <section className={`${styles.hero} ${hero ? styles.customHero : ""} ${hero && !hero.dark ? styles.lightText : ""} ${hero && bannerIsPhotoOnly(hero) ? styles.photoHero : ""}`}
        style={hero && !bannerIsPhotoOnly(hero) ? bannerGradient(hero) : undefined} aria-labelledby="brands-hero-heading">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero?.image || marketing.text("hero", "image")} alt="Electronics and home appliances from leading brands" className={hero && bannerIsPhotoOnly(hero) ? styles.heroPhoto : styles.heroImage} />
        {!(hero && bannerIsPhotoOnly(hero)) && <div className={styles.heroContent}>
          <h1 id="brands-hero-heading" className="font-heading whitespace-pre-line">{hero?.title || marketing.text("hero", "title")}</h1>
          <p>{hero?.subtitle || marketing.text("hero", "description")}</p>
          <ul className={styles.heroPoints}>{marketing.items("hero", HERO_POINTS).map(({ icon: Icon, title, detail }) => <li key={title}>
            <Icon strokeWidth={1.6} /><span>{title}<br />{detail}</span>
          </li>)}</ul>
          {hero?.ctaText && hero.ctaLink && <Link href={hero.ctaLink} className={styles.heroCta}>{hero.ctaText}<ArrowRight size={14} /></Link>}
        </div>}
      </section>
      </MarketingSection>

      <MarketingSection page="brands" section="directory">
      <section className={styles.directory} aria-labelledby="shop-by-brand">
        <div className={styles.toolbar}>
          <h2 id="shop-by-brand">{marketing.text("directory", "title")}</h2>
          <div className={styles.filters}>
            <div className={styles.search}>
              <label htmlFor="brand-search" className="sr-only">Search for a brand</label>
              <input id="brand-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for a brand (e.g. Samsung, Apple, LG...)" />
              <Search size={18} aria-hidden="true" />
            </div>
            <label htmlFor="brand-category" className="sr-only">Filter by category</label>
            <select id="brand-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All Categories</option>
              {categories.map((name) => <option key={name}>{name}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.alphabet} role="group" aria-label="Filter brands by first letter">
          {LETTERS.map((value) => <button key={value} type="button" onClick={() => setLetter(value)} aria-pressed={letter === value}>{value}</button>)}
        </div>

        {loading ? <div className={styles.grid} role="status" aria-label="Loading brands">
          {Array.from({ length: 10 }, (_, index) => <div key={index} className={styles.skeleton} />)}
        </div> : error ? <div className={styles.message} role="alert">
          <p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div> : visible.length === 0 ? <div className={styles.message} role="status">
          <p>{brands.length === 0 ? "No brands are currently available." : "No brands match your filters."}</p>
          {(query || category || letter !== "All") && <button type="button" onClick={resetFilters}>Clear filters</button>}
        </div> : <ul className={styles.grid} aria-label="Brand directory">
          {visible.map((brand) => <li key={brand.name.toLowerCase()}>
            <Link href={brand.slug ? `/brands/${encodeURIComponent(brand.slug)}` : `/products?brand=${encodeURIComponent(brand.name)}`} className={styles.card}>
              <BrandLogo name={brand.name} src={isImageUrl(brand.logo) ? brand.logo : logoManifest[slugify(brand.name)]} />
              <h3>{brand.name}</h3>
              <p className={styles.cardCategories}>{brand.categories.length ? brand.categories.slice(0, 3).join(" | ") : "Explore our brand range"}</p>
              <span className={styles.cardCta}>{marketing.text("directory", "ctaText")} <ArrowRight size={13} /></span>
            </Link>
          </li>)}
        </ul>}
        <p className="sr-only" role="status" aria-live="polite">{!loading && !error ? `${visible.length} brands found` : ""}</p>
      </section>
      </MarketingSection>

      <MarketingSection page="brands" section="services">
      <section className={styles.benefits} aria-label="Why shop at SARA">
        <ul>{marketing.items("services", BENEFITS).map(({ icon: Icon, title, detail, href }) => <li key={title}><Link href={href}>
          <Icon strokeWidth={1.6} /><div><strong>{title}</strong><p>{detail}</p></div>
        </Link></li>)}</ul>
      </section>
      </MarketingSection>
      </MarketingSections>
    </main>
    <Footer />
  </div>
}
