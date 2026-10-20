"use client"

import Link from "next/link"
import type { SyntheticEvent } from "react"
import { ArrowRight, BadgeCheck, CreditCard, Headphones, MapPin, RefreshCw, ShieldCheck, Star, Store, Truck, Users } from "lucide-react"
import AddToCartButton from "@/components/AddToCartButton"
import CompareProductButton from "@/components/CompareProductButton"
import { useBrandImages } from "@/hooks/useBrandImages"
import { bannerGradient, type SiteBanner } from "@/hooks/useBanners"
import { cleanProductName } from "@/utils/cleanProductName"
import styles from "./homepage.module.css"
import { useMarketingContent } from "@/hooks/useMarketingContent"

export interface HomeProduct {
  id: string
  name: string
  image: string
  price: number
  mrp?: number
  stock: number
  slug?: string
  category?: string
  subCategory?: string
  brand?: string
  rating?: number
  reviewsCount?: number
}

/**
 * A tile in the "Shop by Category" rail.
 *
 * `match` and `fallbackImage` only apply to the hand-written reference list
 * below. The rail itself is built from the live sub-categories in the
 * catalogue, which carry a real `count` and no regex.
 */
export type HomeCategory = {
  label: string
  image: string
  href: string
  count?: number
  match?: RegExp
  fallbackImage?: string
}
export type HomeBrand = { name: string; logo?: string; href: string }

/**
 * Reference aisles, kept for two jobs the live sub-categories cannot do.
 *
 * `match` spreads the deals row across different kinds of product instead of
 * showing six televisions, and the illustrations are the last fallback for a
 * tile whose sub-category has no photographed stock.
 */
export const HOME_CATEGORIES: HomeCategory[] = [
  { label: "Mobiles", image: "mobiles", match: /mobile|smartphone|iphone/i, href: "/products?subCategory=Mobile&availability=in" },
  { label: "Laptops", image: "laptops", match: /laptop|notebook/i, href: "/products?q=laptop" },
  { label: "Televisions", image: "televisions", match: /television|\btv\b|panel/i, href: "/products?q=television" },
  { label: "Refrigerators", image: "refrigerators", match: /refrigerator|fridge/i, href: "/products?q=refrigerator" },
  { label: "Washing Machines", image: "washing-machines", match: /washing|washer/i, href: "/products?q=washing" },
  { label: "Air Conditioners", image: "air-conditioners", match: /air condition|\bac\b/i, href: "/products?q=air%20conditioner" },
  { label: "Kitchen Appliances", image: "kitchen-appliances", match: /kitchen|microwave|oven|dishwash/i, href: "/products?q=kitchen" },
  { label: "Audio", image: "audio", match: /audio|speaker|headphone|earbud|airpod/i, href: "/products?q=audio" },
  { label: "Wearables", image: "wearables", match: /wearable|watch|fitness band/i, href: "/products?q=watch" },
  { label: "Accessories", image: "accessories", match: /accessor|cable|charger/i, href: "/products?q=accessories" },
].map((item) => ({ ...item, image: `/homepage/category-${item.image}.webp` }))

export const HOME_BRANDS: HomeBrand[] = ["Apple", "Samsung", "OnePlus", "Xiaomi", "Vivo", "OPPO", "realme", "Lenovo", "Dell", "HP"].map(
  (name) => ({
    name,
    logo: `/homepage/brand-${name.toLowerCase()}.webp`,
    href: `/products?brand=${encodeURIComponent(name)}`,
  }),
)

function restoreReferenceImage(event: SyntheticEvent<HTMLImageElement>, fallback?: string) {
  const image = event.currentTarget
  console.warn("[Homepage] Image could not be loaded:", image.getAttribute("src"))
  if (fallback && image.getAttribute("src") !== fallback) image.src = fallback
}

export function HomepageHeading({ title, href, ctaText = "View All" }: { title: string; href: string; ctaText?: string }) {
  return (
    <div className={styles.sectionHeading}>
      <h2>{title}</h2>
      <Link href={href}>{ctaText} <ArrowRight size={14} aria-hidden /></Link>
    </div>
  )
}

const BENEFITS = [
  { icon: Store, title: "Stores Near You", subtitle: "Across Karnataka", href: "/store-locator" },
  { icon: ShieldCheck, title: "100% Genuine Products", subtitle: "Direct from Brands", href: "/about" },
  { icon: CreditCard, title: "Easy EMI", subtitle: "All Major Banks", href: "/emi" },
  { icon: RefreshCw, title: "Exchange Available", subtitle: "Get Best Value", href: "/contact" },
  { icon: Truck, title: "Fast Delivery", subtitle: "Across India", href: "/shipping-policy" },
  { icon: Headphones, title: "Expert Support", subtitle: "In-store & Online", href: "/contact" },
]

export function HomepageBenefits({ storeCount }: { storeCount?: number }) {
  const marketing = useMarketingContent("home")
  const benefits = marketing.items("benefits", BENEFITS.map(item => ({ ...item, detail: item.subtitle })))
  return (
    <section className={styles.benefits} aria-label="The SARA advantage">
      {benefits.map(({ icon: Icon, title, detail, href }, index) => (
        <Link href={href} key={title}>
          <Icon size={26} strokeWidth={1.5} aria-hidden />
          <span><strong>{index === 0 && storeCount ? `${storeCount}+ ${marketing.text("benefits", "item1Title", "Stores")}` : title}</strong><small>{detail}</small></span>
        </Link>
      ))}
    </section>
  )
}

export function HomepageCategories({ categories }: { categories: HomeCategory[] }) {
  const marketing = useMarketingContent("home")
  return (
    <section className={styles.categories} aria-label="Shop by Category">
      <HomepageHeading title={marketing.text("categories", "title")} href={marketing.text("categories", "ctaLink")} ctaText={marketing.text("categories", "ctaText")} />
      <div className={styles.circleRail}>
        {categories.map(({ label, image, href, count, fallbackImage }) => (
          <Link key={label} href={href} className={styles.circleItem}>
            <span className={styles.categoryCircle}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" loading="lazy" onError={(event) => restoreReferenceImage(event, fallbackImage)} />
            </span>
            <span>{label}</span>
            {count ? <small className={styles.circleCount}>{count} {count === 1 ? "product" : "products"}</small> : null}
          </Link>
        ))}
      </div>
    </section>
  )
}

export function HomepageDeals({ products, loading, error, retry }: {
  products: HomeProduct[]
  loading: boolean
  error?: string
  retry: () => void
}) {
  const marketing = useMarketingContent("home")
  return (
    <section className={styles.deals} id="deals-of-the-day" aria-label="Today's Deals" aria-busy={loading}>
      <HomepageHeading title={marketing.text("deals", "title")} href={marketing.text("deals", "ctaLink")} ctaText={marketing.text("deals", "ctaText")} />
      {error ? (
        <div className={styles.catalogueMessage} role="alert">
          <p>{error}</p><button type="button" onClick={retry}>Try again</button>
        </div>
      ) : loading ? (
        <div className={styles.productGrid} role="status" aria-label="Loading deals">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : products.length === 0 ? (
        <div className={styles.catalogueMessage}><p>New deals are on their way.</p><Link href="/products">Explore all products <ArrowRight size={14} /></Link></div>
      ) : (
        <div className={styles.productGrid}>
          {products.map((product) => {
            const mrp = product.mrp && product.mrp > product.price ? product.mrp : undefined
            const discount = mrp ? Math.round((1 - product.price / mrp) * 100) : 0
            const name = cleanProductName(product.name)
            return (
              <article key={product.id} className={styles.productCard}>
                <Link href={`/product/${product.slug || product.id}`} className={styles.productImage} aria-label={name}>
                  {discount > 0 && <span className={styles.discount}>{discount}% OFF</span>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image} alt={name} loading="lazy" onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = "/placeholder.svg"
                  }} />
                </Link>
                <Link href={`/product/${product.slug || product.id}`} className={styles.productName}>{name}</Link>
                <p className={styles.price}>
                  <strong>₹{product.price.toLocaleString("en-IN")}</strong>
                  {mrp && <del>₹{mrp.toLocaleString("en-IN")}</del>}
                </p>
                <p className={styles.rating}>
                  {product.rating ? <><Star size={14} fill="currentColor" aria-hidden /><span>{product.rating.toFixed(1)}{product.reviewsCount ? ` (${product.reviewsCount.toLocaleString("en-IN")})` : ""}</span></> : <span className={styles.warranty}>{marketing.text("deals", "warrantyLabel")}</span>}
                </p>
                <AddToCartButton product={product} className={styles.cartButton} />
                <CompareProductButton productId={product.id} name={name} />
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function HomepagePromotions({ banners }: { banners: SiteBanner[] }) {
  const cards = banners.slice(0, 3)
  if (!cards.length) return null
  return (
    <section className={styles.promotions} style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }} aria-label="Exchange, EMI and special offers">
      {cards.map((card) => (
        <article key={card.id} className={`${styles.promoCard} ${!card.image ? styles.emiCard : ""}`} style={bannerGradient(card)}>
          <div className={styles.promoCopy} style={{ color: card.dark ? "var(--brand-text-primary)" : "#FFFFFF" }}>
            <h2>{card.title}</h2>
            <p>{card.subtitle}</p>
            {card.ctaText && <Link href={card.ctaLink || "/offers"} className={styles.shopButton}>{card.ctaText} <ArrowRight size={14} aria-hidden /></Link>}
          </div>
          {card.image && <img src={card.image} alt="" className={styles.promoImage} loading="lazy" />}
        </article>
      ))}
    </section>
  )
}

export function HomepageBrands({ brands }: { brands: HomeBrand[] }) {
  const marketing = useMarketingContent("home")
  if (brands.length === 0) return null

  return (
    <section className={styles.brands} aria-label="Top Brands">
      <HomepageHeading title={marketing.text("brands", "title")} href={marketing.text("brands", "ctaLink")} ctaText={marketing.text("brands", "ctaText")} />
      <div className={styles.circleRail}>
        {brands.map(({ name, logo, href }) => (
          <Link key={name} href={href} className={styles.circleItem}>
            <span className={styles.brandCircle}>
              {logo ? <img src={logo} alt="" loading="lazy" onError={(event) => restoreReferenceImage(event, HOME_BRANDS.find((item) => item.name === name)?.logo)} /> : <strong>{name}</strong>}
            </span>
            <span>{name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function HomepageStores({ storeCount }: { storeCount?: number }) {
  const marketing = useMarketingContent("home")
  const { storefront } = useBrandImages()
  const reasons = marketing.items("stores", [
    { icon: MapPin, title: storeCount ? `${storeCount}+ Stores` : "Local Stores", subtitle: "Across Karnataka" },
    { icon: Users, title: "Happy Customers", subtitle: "Our SARA Family" },
    { icon: BadgeCheck, title: "Trusted Brands", subtitle: "100% Genuine" },
    { icon: CreditCard, title: "Easy EMI", subtitle: "All Major Banks" },
    { icon: Headphones, title: "Expert Support", subtitle: "Always Here" },
  ].map(item => ({ ...item, detail: item.subtitle })))
  return (
    <section className={styles.stores} aria-label="Find a store and why choose SARA">
      <div className={styles.storeCard}>
        <div>
          <h2>{marketing.text("stores", "title")}</h2>
          <p>{storeCount ? `${storeCount}+ Stores Across Karnataka` : "Your neighbourhood electronics store"}<br />{marketing.text("stores", "description")}</p>
          <Link href={marketing.text("stores", "ctaLink")} className={styles.shopButton}>{marketing.text("stores", "ctaText")} <ArrowRight size={14} aria-hidden /></Link>
        </div>
        <img src={marketing.image("stores", "image", storefront)} alt="SARA electronics store" loading="lazy" />
      </div>
      <div className={styles.whyCard}>
        <h2>{marketing.text("stores", "whyTitle")}</h2>
        <div className={styles.reasons}>
          {reasons.map(({ icon: Icon, title, detail }) => (
            <div key={title}><span className={styles.reasonIcon}><Icon size={23} strokeWidth={1.5} aria-hidden /></span><strong>{title}</strong><small>{detail}</small></div>
          ))}
        </div>
      </div>
    </section>
  )
}
