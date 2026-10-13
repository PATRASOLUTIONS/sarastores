"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { fetchWithCache, revalidateCache } from "@/utils/cache"
import { homeSectionListResponseSchema } from "@/lib/home-components-client"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import HeroSection from "@/components/HeroSection"
import CategoryCircles from "@/components/CategoryCircles"
import SaraAdvantageBar from "@/components/home/SaraAdvantageBar"
import { Reveal, StaggerChildren, StaggerItem } from "@/components/motion/AnimationComponents"
import { usePrefetchHomeProducts, homeComponentResponseSchema, type HomeComponent } from "@/hooks/usePrefetchHomeProducts"
import { DEALS_ANCHOR_ID } from "@/utils/deals"
import {
  buildCategoryRails,
  buildPriceRails,
  buildCategoryTiles,
  buildBrandList,
  pickSpotlights,
  isInStock,
  type Rail,
  type CatalogProduct,
  catalogProductResponseSchema,
  catalogProductListResponseSchema,
} from "@/utils/catalog"
import { z } from "zod"

// ─── Below-the-fold: loaded on demand to protect first paint ──────────
const DealsOfTheDay = dynamic(() => import("@/components/DealsOfTheDay"))
const CategoryProductsSection = dynamic(() => import("@/components/CategoryProductsSection"))
const RecentlyViewed = dynamic(() => import("@/components/RecentlyViewed"), { ssr: false })
const DealOfTheDayPopup = dynamic(() => import("@/components/DealOfTheDayPopup"), { ssr: false })
const ProductRail = dynamic(() => import("@/components/ProductRail"))
const CategoryMosaic = dynamic(() => import("@/components/home/CategoryMosaic"))
const BrandStrip = dynamic(() => import("@/components/home/BrandStrip"))
const StoreCta = dynamic(() => import("@/components/home/StoreCta"), { ssr: false })
const FestiveHeroBand = dynamic(() => import("@/components/home/FestiveHeroBand"))
const LatestArticles = dynamic(() => import("@/components/home/LatestArticles"), { ssr: false })

// ─── Retention layer (the "new" landing experience) ───────────────────
const PlayAndWin = dynamic(() => import("@/components/home/PlayAndWin"))
const SocialProofBand = dynamic(() => import("@/components/home/SocialProofBand"))
const MemberDeals = dynamic(() => import("@/components/home/MemberDeals"))
const CommunityJoin = dynamic(() => import("@/components/home/CommunityJoin"))

const DATA_TTL = 5 * 60 * 1000 // 5 minutes
const FETCH_TIMEOUT = 8000 // a stalled API must never hold up the rest of the page

/** fetch + JSON with a hard timeout, so one slow endpoint can't block first paint. */
async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  if (!res.ok) throw new Error(`Request failed: ${url}`)
  return res.json()
}

/** In-stock products with a believable discount, richest savings first — the
 *  spine of the "members-only prices" rail. */
function buildMemberDeals(products: CatalogProduct[], limit = 12): CatalogProduct[] {
  return products
    .filter((p) => {
      if (!isInStock(p) || !p.image || /placeholder/i.test(p.image)) return false
      const price = Number(p.price)
      const mrp = Number(p.mrp)
      if (!(price > 0) || !(mrp > price)) return false
      const pct = Math.round(((mrp - price) / mrp) * 100)
      return pct >= 8 && pct <= 70
    })
    .sort((a, b) => Number(b.mrp) - Number(b.price) - (Number(a.mrp) - Number(a.price)))
    .slice(0, limit)
}

export default function HomeExperience() {
  const [homeComponents, setHomeComponents] = useState<HomeComponent[]>([])
  const [manualProductsMap, setManualProductsMap] = useState<Record<string, CatalogProduct[]>>({})
  const [categoryProductsMap, setCategoryProductsMap] = useState<Record<string, CatalogProduct[]>>({})
  const [catalogRails, setCatalogRails] = useState<Rail[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])

  const handleCategoryProducts = useCallback((map: Record<string, CatalogProduct[]>) => {
    setCategoryProductsMap((prev) => ({ ...prev, ...map }))
  }, [])
  const handleManualProducts = useCallback((map: Record<string, CatalogProduct[]>) => {
    setManualProductsMap((prev) => ({ ...prev, ...map }))
  }, [])

  usePrefetchHomeProducts(homeComponents, handleCategoryProducts, handleManualProducts)

  useEffect(() => {
    const fetchHomeComponents = async () => {
      try {
        const data = await fetchWithCache(
          "home-components",
          async () => z.array(homeComponentResponseSchema).parse(await fetchJson("/api/home-components")),
          homeSectionListResponseSchema,
          DATA_TTL,
        )
        setHomeComponents(data || [])
        revalidateCache(
          "home-components",
          async () => z.array(homeComponentResponseSchema).parse(await fetchJson("/api/home-components")),
          homeSectionListResponseSchema,
        )
      } catch (error) {
        console.error("Failed to load homepage sections", error)
      }
    }

    const fetchCatalog = async () => {
      try {
        // `fields=card` keeps this to what the rails and tiles actually render.
        const products = await fetchWithCache(
          "products-card",
          async () => z.array(catalogProductResponseSchema).parse(await fetchJson("/api/products?fields=card")),
          catalogProductListResponseSchema,
          DATA_TTL,
        )
        if (!Array.isArray(products)) return
        setCatalogProducts(products)
        setCatalogRails([...buildCategoryRails(products), ...buildPriceRails(products)])
      } catch (error) {
        console.error("Failed to load homepage catalogue", error)
      }
    }

    fetchHomeComponents()
    fetchCatalog()
  }, [])

  // Admin-configured blocks win; drop catalogue rails that duplicate their topic.
  const railKey = (s: string) => {
    const v = (s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "")
    return v === "tv" ? "television" : v
  }
  const curatedKeys = new Set(
    homeComponents.filter((c) => c.enabled).map((c) => railKey(c.title || "")),
  )
  const extraRails = catalogRails.filter((r) => !curatedKeys.has(railKey(r.title)))

  const categoryTiles = buildCategoryTiles(catalogProducts)
  const brands = buildBrandList(catalogProducts)
  const spotlights = pickSpotlights(catalogProducts, 3)
  const memberDeals = buildMemberDeals(catalogProducts)
  const railsFirst = extraRails.slice(0, 2)
  const railsRest = extraRails.slice(2)

  return (
    <>
      <Header />
      <CategoryCircles />
      <DealOfTheDayPopup />

      <main id="main-content" className="flex-grow relative z-10">
        <HeroSection />
        <FestiveHeroBand />
        <SaraAdvantageBar />

        <div className="section-container space-y-8 py-6 sm:space-y-10 sm:py-8 md:space-y-12 md:py-10">
          {/* Time-boxed deals with the shared anchor other CTAs scroll to */}
          <div id={DEALS_ANCHOR_ID} className="scroll-mt-24">
            <Reveal>
              <DealsOfTheDay />
            </Reveal>
          </div>

          {categoryTiles.length > 0 && (
            <Reveal>
              <CategoryMosaic tiles={categoryTiles} />
            </Reveal>
          )}

          <Reveal>
            <PlayAndWin />
          </Reveal>

          {/* "Top selling" style rails, mirroring the category-led browse pattern */}
          {railsFirst.map((rail) => (
            <Reveal key={rail.id}>
              <ProductRail rail={rail} />
            </Reveal>
          ))}

          {memberDeals.length >= 4 && (
            <Reveal>
              <MemberDeals products={memberDeals} />
            </Reveal>
          )}

          {/* Admin-curated merchandising keeps working alongside the new layer */}
          {homeComponents.some((c) => c.enabled) && (
            <StaggerChildren className="space-y-8 sm:space-y-10 md:space-y-12" staggerDelay={0.12}>
              {homeComponents.map((c) => {
                if (!c.enabled) return null
                if (c.type === "category") {
                  const catId = c.config?.categoryId
                  return (
                    <StaggerItem key={c.id}>
                      <CategoryProductsSection
                        categoryId={catId}
                        categoryName={c.title || ""}
                        prefetchedProducts={categoryProductsMap[catId]}
                      />
                    </StaggerItem>
                  )
                }
                if (c.type === "manual") {
                  const ids: string[] = Array.isArray(c.config?.productIds) ? c.config.productIds : []
                  if (ids.length === 0) return null
                  return (
                    <StaggerItem key={c.id}>
                      <CategoryProductsSection
                        categoryId={""}
                        categoryName={c.title || "Custom Products"}
                        subtitle={c.title || "Featured Products"}
                        products={manualProductsMap[c.id] || []}
                      />
                    </StaggerItem>
                  )
                }
                return null
              })}
            </StaggerChildren>
          )}

          {railsRest.map((rail) => (
            <Reveal key={rail.id}>
              <ProductRail rail={rail} />
            </Reveal>
          ))}

          {brands.length > 0 && (
            <Reveal>
              <BrandStrip brands={brands} />
            </Reveal>
          )}

          <Reveal>
            <SocialProofBand />
          </Reveal>

          <Reveal>
            <StoreCta />
          </Reveal>

          <Reveal>
            <LatestArticles />
          </Reveal>

          {/* Last impression is a reason to come back, not just leave */}
          <Reveal>
            <CommunityJoin />
          </Reveal>

          <Reveal>
            <RecentlyViewed />
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  )
}
