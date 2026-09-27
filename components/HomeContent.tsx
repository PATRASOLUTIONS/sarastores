"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { fetchWithCache, revalidateCache, prefetchAll } from "@/utils/cache"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import HeroSection from "@/components/HeroSection"
import CategoryCircles from "@/components/CategoryCircles"
import TrustBar from "@/components/TrustBar"
import { Reveal, StaggerChildren, StaggerItem } from '@/components/motion/AnimationComponents'
import { usePrefetchHomeProducts } from '@/hooks/usePrefetchHomeProducts'
import { DEALS_ANCHOR_ID } from '@/utils/deals'
import { buildCategoryRails, buildPriceRails, buildCategoryTiles, buildBrandList, pickSpotlights, type Rail } from '@/utils/catalog'

// ─── Dynamic imports: below-the-fold components loaded on demand ──────
const DealsOfTheDay = dynamic(() => import("@/components/DealsOfTheDay"))
const CategoryProductsSection = dynamic(() => import("@/components/CategoryProductsSection"))
const RecentlyViewed = dynamic(() => import("@/components/RecentlyViewed"), { ssr: false })
const DealOfTheDayPopup = dynamic(() => import("@/components/DealOfTheDayPopup"), { ssr: false })
const ProductRail = dynamic(() => import("@/components/ProductRail"))
const CategoryMosaic = dynamic(() => import("@/components/home/CategoryMosaic"))
const SpotlightBanner = dynamic(() => import("@/components/home/SpotlightBanner"))
const BrandStrip = dynamic(() => import("@/components/home/BrandStrip"))
const StoreCta = dynamic(() => import("@/components/home/StoreCta"), { ssr: false })

const DATA_TTL = 5 * 60 * 1000 // 5 minutes

export default function HomeContent() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [categoryIds, setCategoryIds] = useState<{ [key: string]: string }>({})
  const [homeComponents, setHomeComponents] = useState<any[]>([])
  const [manualProductsMap, setManualProductsMap] = useState<Record<string, any[]>>({})
  const [categoryProductsMap, setCategoryProductsMap] = useState<Record<string, any[]>>({})
  const [catalogRails, setCatalogRails] = useState<Rail[]>([])
  const [catalogProducts, setCatalogProducts] = useState<any[]>([])

  const handleCategoryProducts = useCallback((map: Record<string, any[]>) => {
    setCategoryProductsMap(prev => ({ ...prev, ...map }))
  }, [])
  const handleManualProducts = useCallback((map: Record<string, any[]>) => {
    setManualProductsMap(prev => ({ ...prev, ...map }))
  }, [])

  usePrefetchHomeProducts(homeComponents, handleCategoryProducts, handleManualProducts)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCategories = localStorage.getItem("categories")
      if (storedCategories) {
        try {
          const categories = JSON.parse(storedCategories)
          const ids: { [key: string]: string } = {}
          categories.forEach((cat: any) => {
            const name = cat.name.toLowerCase()
            if (name.includes("home") && name.includes("appliance")) ids.home = cat.id
            if (name.includes("panel")) ids.panel = cat.id
            if (name.includes("television") || name.includes("tv")) ids.televisions = cat.id
            if (name.includes("refrigerators") || name.includes("fridge")) ids.refrigerators = cat.id
          })
          setCategoryIds(ids)
        } catch { /* corrupted localStorage data — will refetch from API */ }
      }
      const storedHomeComponents = localStorage.getItem("home-components")
      if (storedHomeComponents) {
        try {
          setHomeComponents(JSON.parse(storedHomeComponents))
        } catch { /* corrupted localStorage data — will refetch from API */ }
      }
    }

    const fetchCategoryIds = async () => {
      const allCategories = await fetchWithCache("categories", async () => {
        const response = await fetch("/api/categories")
        if (!response.ok) throw new Error("Failed to fetch categories")
        return response.json()
      }, DATA_TTL)
      const categories = allCategories.filter((cat: any) => cat.isEnabled !== false)
      localStorage.setItem("categories", JSON.stringify(categories))
      const ids: { [key: string]: string } = {}
      categories.forEach((cat: any) => {
        const name = cat.name.toLowerCase()
        if (name.includes("home") && name.includes("appliance")) ids.home = cat.id
        if (name.includes("panel")) ids.panel = cat.id
        if (name.includes("television") || name.includes("tv")) ids.televisions = cat.id
        if (name.includes("refrigerators") || name.includes("fridge")) ids.refrigerators = cat.id
      })
      setCategoryIds(ids)
      revalidateCache("categories", async () => {
        const response = await fetch("/api/categories")
        if (!response.ok) throw new Error("Failed to fetch categories")
        const allFresh = await response.json()
        const fresh = allFresh.filter((cat: any) => cat.isEnabled !== false)
        localStorage.setItem("categories", JSON.stringify(fresh))
        return fresh
      }, DATA_TTL)
    }

    const fetchHomeComponents = async () => {
      const data = await fetchWithCache("home-components", async () => {
        const res = await fetch('/api/home-components')
        if (!res.ok) throw new Error("Failed to fetch home components")
        return res.json()
      }, DATA_TTL)
      localStorage.setItem("home-components", JSON.stringify(data))
      setHomeComponents(data || [])
      revalidateCache("home-components", async () => {
        const res = await fetch('/api/home-components')
        if (!res.ok) throw new Error("Failed to fetch home components")
        const fresh = await res.json()
        localStorage.setItem("home-components", JSON.stringify(fresh))
        return fresh
      }, DATA_TTL)
    }

    const fetchCatalogRails = async () => {
      try {
        const products = await fetchWithCache("products", async () => {
          const res = await fetch('/api/products')
          if (!res.ok) throw new Error("Failed to fetch products")
          return res.json()
        }, DATA_TTL)
        if (!Array.isArray(products)) return
        setCatalogProducts(products)
        setCatalogRails([...buildCategoryRails(products), ...buildPriceRails(products)])
      } catch {
        /* rails are supplementary — the page still works without them */
      }
    }

    fetchCategoryIds()
    fetchHomeComponents()
    fetchCatalogRails()
    setIsLoaded(true)
  }, [])

  // Admin-configured blocks take precedence; drop catalogue rails that repeat them.
  const railKey = (s: string) => {
    const v = (s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "")
    return v === "tv" ? "television" : v
  }
  const curatedKeys = new Set(
    homeComponents.filter((c) => c.enabled).map((c) => railKey(c.title || ""))
  )
  const extraRails = catalogRails.filter((r) => !curatedKeys.has(railKey(r.title)))

  const categoryTiles = buildCategoryTiles(catalogProducts)
  const brands = buildBrandList(catalogProducts)
  const spotlights = pickSpotlights(catalogProducts, 3)
  const railsFirst = extraRails.slice(0, 2)
  const railsRest = extraRails.slice(2)

  return (
    <>
      <Header />
      <CategoryCircles />
      <DealOfTheDayPopup />

      <main id="main-content" className="flex-grow relative z-10">
        <HeroSection />

        {/* Offer spotlight sits in the slot directly under the hero, so a real product,
            price and discount are visible before any scrolling. */}
        {spotlights[0] && (
          <div className="section-container pt-3 md:pt-4">
            <Reveal>
              <SpotlightBanner product={spotlights[0]} />
            </Reveal>
          </div>
        )}

        <div className="section-container pt-3 md:pt-4">
          <div id={DEALS_ANCHOR_ID} className="scroll-mt-24">
            <Reveal>
              <DealsOfTheDay />
            </Reveal>
          </div>
        </div>

        <TrustBar />

        <div className="section-container space-y-6 py-6 sm:space-y-8 sm:py-8 md:space-y-10 md:py-10">
          {categoryTiles.length > 0 && (
            <Reveal>
              <CategoryMosaic tiles={categoryTiles} />
            </Reveal>
          )}

          {spotlights[1] && (
            <Reveal>
              <SpotlightBanner product={spotlights[1]} />
            </Reveal>
          )}

          {railsFirst.map((rail) => (
            <Reveal key={rail.id}>
              <ProductRail rail={rail} />
            </Reveal>
          ))}

          <StaggerChildren className="space-y-6 sm:space-y-8 md:space-y-10" staggerDelay={0.12}>
            {homeComponents.map((c) => {
              if (!c.enabled) return null
              if (c.type === 'category') {
                const catId = c.config?.categoryId
                return (
                  <StaggerItem key={c.id}>
                    <CategoryProductsSection
                      categoryId={catId}
                      categoryName={c.title || undefined}
                      prefetchedProducts={categoryProductsMap[catId]}
                    />
                  </StaggerItem>
                )
              }

              if (c.type === 'manual') {
                const ids: string[] = Array.isArray(c.config?.productIds) ? c.config.productIds : []
                if (ids.length === 0) return null
                const productsForBlock = manualProductsMap[c.id] || []
                return (
                  <StaggerItem key={c.id}>
                    <CategoryProductsSection
                      categoryId={""}
                      categoryName={c.title || "Custom Products"}
                      subtitle={c.title || "Featured Products"}
                      products={productsForBlock}
                    />
                  </StaggerItem>
                )
              }

              return null
            })}
          </StaggerChildren>

          {brands.length > 0 && (
            <Reveal>
              <BrandStrip brands={brands} />
            </Reveal>
          )}

          {spotlights[2] && (
            <Reveal>
              <SpotlightBanner product={spotlights[2]} />
            </Reveal>
          )}

          {railsRest.map((rail) => (
            <Reveal key={rail.id}>
              <ProductRail rail={rail} />
            </Reveal>
          ))}

          <Reveal>
            <StoreCta />
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
