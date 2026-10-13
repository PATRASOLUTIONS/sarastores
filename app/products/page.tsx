"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SpecFacets from "@/components/SpecFacets"
import ProductListingCard from "@/components/products/ProductListingCard"
import { useListingBanners } from "@/components/products/ListingBanners"
import { OfferTabs, OffersHero, OffersPromotions, OffersTrustStrip, type OfferTab } from "@/components/products/OffersPresentation"
import RazorpayOffers from "@/components/product/RazorpayOffers"
import { useRazorpayOffers } from "@/hooks/useRazorpayOffers"
import { applicableOffers, isEmiOffer, isNoCostEmiOffer } from "@/lib/razorpay-offers"
import { fetchWithCache } from "@/utils/cache"
import { productListingListResponseSchema, type ProductListingResponse as Product } from "@/lib/product-card-response"
import { catalogCategoryListResponseSchema } from "@/lib/catalog-list-response"
import { categoryOf, isInStock } from "@/utils/catalog"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingStatus } from "@/components/marketing/MarketingSections"
import { normalizeProductForSchema, type ProductSchemaInput } from "@/lib/product-schema"
import { calculateDiscount, getCatalogMRP, getCatalogRatingInfo, titleCaseLabel } from "@/lib/product-display"
import {
  buildFacets,
  countActiveFacets,
  matchesFacets,
  toggleFacetValue,
  type FacetSelection,
} from "@/lib/product-facets"

interface Category {
  id: string
  name: string
  icon?: string
}

const PRICE_MAX = Infinity

const PRICE_BANDS: { label: string; range: [number, number] }[] = [
  { label: "Under ₹10,000", range: [0, 10000] },
  { label: "₹10,000 – ₹25,000", range: [10000, 25000] },
  { label: "₹25,000 – ₹50,000", range: [25000, 50000] },
  { label: "₹50,000 – ₹1,00,000", range: [50000, 100000] },
  { label: "Above ₹1,00,000", range: [100000, PRICE_MAX] },
]

const DISCOUNT_BANDS = [10, 20, 30, 40, 50]
const RATING_BANDS = [4, 3, 2]

const titleCase = titleCaseLabel

const getCanonicalMeta = (product: ProductSchemaInput) => normalizeProductForSchema(product)
const getProductSubCategory = (product: ProductSchemaInput) =>
  String(product?.subCategory || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductBrand = (product: ProductSchemaInput) => String(getCanonicalMeta(product).manufacturerName || "")
const getProductCategoryGroupName = (product: ProductSchemaInput): string =>
  String(product?.groupName || product?.category || getCanonicalMeta(product).categoryGroupName || "")

/** "TV 55 INCH" and friends collapse into a single browsable label. */
const normaliseSubCategory = (sub: string) =>
  sub.toLowerCase().startsWith("tv ") || sub.toLowerCase() === "tv" ? "TV" : sub

const shopperCategory = (product: Product) =>
  categoryOf({ ...product, subCategory: getProductSubCategory(product) }) || normaliseSubCategory(getProductSubCategory(product))

async function fetchCatalog(): Promise<Product[]> {
  const catalog: Product[] = []
  for (let skip = 0; ; skip += 500) {
    const response = await fetch(`/api/products?limit=500&skip=${skip}`)
    if (!response.ok) throw new Error("Products could not be loaded. Please try again.")
    const page = productListingListResponseSchema.parse(await response.json())
    catalog.push(...page)
    if (page.length < 500) return catalog
  }
}

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-gray-100 py-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[24px] w-full items-center justify-between py-0.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-bold text-gray-900">{title}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function CheckOption({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count?: number
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-[5px] text-[13px] text-gray-700 hover:text-gray-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-gray-300 text-[#1560BD] focus:ring-[#1560BD]"
      />
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
      {typeof count === "number" && <span className="shrink-0 text-[11px] text-gray-600">({count})</span>}
    </label>
  )
}

export default function ProductsPage() {
  const marketing = useMarketingContent("products")
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_MAX])
  const [minDiscount, setMinDiscount] = useState(0)
  const [minRating, setMinRating] = useState(0)
  const [availability, setAvailability] = useState<"all" | "in" | "out">("all")
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({})
  const [sortBy, setSortBy] = useState("relevance")

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef<HTMLElement>(null)
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [offerTab, setOfferTab] = useState<OfferTab>("all-offers")
  const bankOffers = useRazorpayOffers()
  const currentOffers = applicableOffers(bankOffers.offers, Infinity)
  const itemsPerPage = 24

  useEffect(() => {
    if (!showFilters) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    filterRef.current?.querySelector<HTMLElement>("button")?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowFilters(false)
      if (event.key !== "Tab") return
      const controls = Array.from(filterRef.current?.querySelectorAll<HTMLElement>("button, input, select, a[href]") || [])
        .filter(element => element.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const onResize = () => { if (window.innerWidth >= 1024) setShowFilters(false) }
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("resize", onResize)
      previousFocus?.focus()
    }
  }, [showFilters])

  // ── URL hydration + data ────────────────────────────────────────────
  useEffect(() => {
    const categoryFromUrl = searchParams.get("category")
    const searchFromUrl = searchParams.get("search")
    const brandFromUrl = searchParams.get("brand") || searchParams.get("brands")
    const subCategoryFromUrl = searchParams.get("subCategory")
    const subCategoriesFromUrl = searchParams.get("subCategories")

    setSelectedCategories(categoryFromUrl ? [categoryFromUrl] : [])
    setSearchTerm(searchFromUrl || searchParams.get("q") || "")
    setSelectedBrands(brandFromUrl ? brandFromUrl.split(",").map(value => value.trim()).filter(Boolean) : [])
    setOfferTab(searchParams.size > 0 ? "all-products" : "all-offers")
    setMinDiscount(0)
    setMinRating(0)
    setAvailability("all")

    const sortFromUrl = searchParams.get("sort")
    setSortBy(sortFromUrl || "relevance")

    const minPrice = Number(searchParams.get("minPrice"))
    const maxPrice = Number(searchParams.get("maxPrice"))
    setPriceRange([
      Number.isFinite(minPrice) && minPrice >= 0 ? minPrice : 0,
      Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : PRICE_MAX,
    ])

    const urlFacets: FacetSelection = {}
    const size = searchParams.get("size")
    if (size) urlFacets.screenSize = [`${size}"`]
    const star = searchParams.get("star")
    if (star) urlFacets.energyRating = [`${star} Star`]
    const features = searchParams.getAll("feature")
    if (features.length > 0) urlFacets.smartFeatures = features.map((f) => f.replace(/\b\w/g, (c) => c.toUpperCase()))
    setFacetSelection(urlFacets)

    const selections: string[] = []
    if (subCategoryFromUrl) selections.push(subCategoryFromUrl)
    if (subCategoriesFromUrl) selections.push(...subCategoriesFromUrl.split(",").map((s) => s.trim()).filter(Boolean))
    setSelectedSubCategories(selections)
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [productsData, categoriesData] = await Promise.all([
          retryCount > 0 ? fetchCatalog() : fetchWithCache("products-offers-catalog", fetchCatalog, productListingListResponseSchema, 5 * 60 * 1000),
          fetchWithCache(
            "categories",
            async () => {
              const r = await fetch("/api/categories")
              if (!r.ok) throw new Error("Failed to fetch categories")
              return r.json()
            },
            catalogCategoryListResponseSchema,
            5 * 60 * 1000,
          ),
        ])

        if (cancelled) return
        if (!Array.isArray(categoriesData)) throw new Error("Invalid categories response.")
        setProducts(productsData)
        setCategories(categoriesData)
      } catch (err) {
        console.error("Error fetching data:", err)
        if (!cancelled) setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [retryCount])

  const eligibleProducts = useMemo(() => products.filter(product => {
    const price = Number(product.price)
    if (offerTab === "all-offers" || offerTab === "brand") return price > 0 && getCatalogMRP(product) > price
    if (offerTab === "bank") return applicableOffers(bankOffers.offers, price).some(offer => !isEmiOffer(offer))
    if (offerTab === "no-cost-emi") return applicableOffers(bankOffers.offers, price).some(isNoCostEmiOffer)
    if (["festival", "exchange", "bundle", "online"].includes(offerTab)) return false
    return true
  }), [products, offerTab, bankOffers.offers])

  // ── Derived options ─────────────────────────────────────────────────
  const subCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of eligibleProducts) {
      const sub = shopperCategory(p)
      if (sub) counts.set(sub, (counts.get(sub) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [eligibleProducts])

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of eligibleProducts) {
      const brand = getProductBrand(p)
      if (brand) counts.set(brand, (counts.get(brand) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [eligibleProducts])

  // ── Filtering ───────────────────────────────────────────────────────
  const filteredProducts = useMemo(
    () =>
      eligibleProducts.filter((product) => {
        const term = searchTerm.trim().toLowerCase()
        if (
          term &&
          !(product.name || "").toLowerCase().includes(term) &&
          !(product.description || "").toLowerCase().includes(term)
        )
          return false

        if (selectedCategories.length > 0) {
          const raw = getProductCategoryGroupName(product)
          const matching = categories.find(
            (c) => c.id === raw || c.name.toLowerCase() === raw.toLowerCase(),
          )
          if (!selectedCategories.some(value => value.toLowerCase() === raw.toLowerCase() ||
            value === matching?.id || value.toLowerCase() === matching?.name.toLowerCase())) return false
        }

        if (selectedSubCategories.length > 0) {
          // Sidebar categories are normalized; existing menu links use stored labels.
          const rawSub = getProductSubCategory(product).toLowerCase()
          const sub = normaliseSubCategory(getProductSubCategory(product)).toLowerCase()
          if (
            !selectedSubCategories.some((s) => {
              const target = s.toLowerCase()
              return target === sub || target === rawSub || target === shopperCategory(product).toLowerCase()
            })
          )
            return false
        }

        if (selectedBrands.length > 0) {
          const brand = getProductBrand(product).toLowerCase()
          if (!selectedBrands.some((b) => b.toLowerCase() === brand)) return false
        }

        if (product.price < priceRange[0] || product.price > priceRange[1]) return false

        if (minDiscount > 0 && calculateDiscount(getCatalogMRP(product), product.price) < minDiscount) return false
        if (minRating > 0 && getCatalogRatingInfo(product).rating < minRating) return false
        if (availability === "in" && !isInStock(product)) return false
        if (availability === "out" && isInStock(product)) return false
        return true
      }),
    [
      eligibleProducts,
      categories,
      searchTerm,
      selectedCategories,
      selectedSubCategories,
      selectedBrands,
      priceRange,
      minDiscount,
      minRating,
      availability,
    ],
  )

  // Facets come from the pre-facet result set so choosing one value doesn't
  // erase the sibling options from the sidebar.
  const facets = useMemo(() => buildFacets(filteredProducts), [filteredProducts])
  const facetedProducts = useMemo(
    () => filteredProducts.filter((p) => matchesFacets(p, facetSelection)),
    [filteredProducts, facetSelection],
  )

  const sortedProducts = useMemo(() => {
    const list = [...facetedProducts]
    switch (sortBy) {
      case "price-asc":
        return list.sort((a, b) => a.price - b.price)
      case "price-desc":
        return list.sort((a, b) => b.price - a.price)
      case "discount":
        return list.sort(
          (a, b) =>
            calculateDiscount(getCatalogMRP(b), b.price) - calculateDiscount(getCatalogMRP(a), a.price),
        )
      case "rating":
        return list.sort((a, b) => getCatalogRatingInfo(b).rating - getCatalogRatingInfo(a).rating)
      case "newest":
        return list.sort(
          (a, b) =>
            (new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() || 0) -
            (new Date(a.createdAt ?? a.updatedAt ?? 0).getTime() || 0),
        )
      case "name-asc":
        return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      default:
        return list
    }
  }, [facetedProducts, sortBy])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    searchTerm,
    selectedCategories,
    selectedSubCategories,
    selectedBrands,
    priceRange,
    minDiscount,
    minRating,
    availability,
    sortBy,
    facetSelection,
    offerTab,
    products,
    bankOffers.offers,
  ])

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage))
  const pageStart = (currentPage - 1) * itemsPerPage
  const currentProducts = sortedProducts.slice(pageStart, pageStart + itemsPerPage)

  // ── Presentation helpers ────────────────────────────────────────────
  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || id

  const activeScope =
    selectedSubCategories[0] ||
    (selectedCategories[0] ? getCategoryName(selectedCategories[0]) : "") ||
    ""
  const heading = offerTab === "all-products" ? (activeScope ? titleCase(activeScope) : "All Products") : marketing.text("results", "title")
  const pageNumbers = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => currentPage - 2 + index), totalPages])]
    .filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b)

  const heroBanners = useListingBanners("hero", activeScope)
  const promoBanners = useListingBanners("promo", activeScope)

  const priceBandActive = (band: [number, number]) => priceRange[0] === band[0] && priceRange[1] === band[1]

  const togglePriceBand = (band: [number, number]) =>
    setPriceRange(priceBandActive(band) ? [0, PRICE_MAX] : band)

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
    setter((prev) => (prev.some(item => item.toLowerCase() === value.toLowerCase())
      ? prev.filter(item => item.toLowerCase() !== value.toLowerCase())
      : [...prev, value]))

  const toggleSubCategory = toggleIn(setSelectedSubCategories)
  const toggleBrand = toggleIn(setSelectedBrands)
  const toggleCategory = toggleIn(setSelectedCategories)
  const toggleFacet = (key: string, value: string) =>
    setFacetSelection((prev) => toggleFacetValue(prev, key, value))

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedSubCategories([])
    setSelectedBrands([])
    setPriceRange([0, PRICE_MAX])
    setMinDiscount(0)
    setMinRating(0)
    setAvailability("all")
    setFacetSelection({})
    setSearchTerm("")
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSubCategories.length > 0 ||
    selectedBrands.length > 0 ||
    minDiscount > 0 ||
    minRating > 0 ||
    availability !== "all" ||
    Boolean(searchTerm) ||
    countActiveFacets(facetSelection) > 0 ||
    !(priceRange[0] === 0 && priceRange[1] === PRICE_MAX)

  const visibleBrands = showAllBrands ? brandCounts : brandCounts.slice(0, 6)

  const filterPanel = (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-base font-bold text-gray-900">Filter By</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-[24px] items-center px-1 text-[13px] font-medium text-[#1560BD] hover:underline"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(false)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <FilterSection title="Category">
        <div className="max-h-64 overflow-y-auto pr-1">
          {subCategoryCounts.map(([label, count]) => (
            <CheckOption
              key={label}
              label={titleCase(label)}
              count={count}
              checked={selectedSubCategories.includes(label)}
              onChange={() => toggleSubCategory(label)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection key={offerTab === "brand" ? "brand-offers" : "brand-filter"} title="Brand" defaultOpen={offerTab === "brand"}>
        <div className="max-h-64 overflow-y-auto pr-1">
          {visibleBrands.map(([label, count]) => (
            <CheckOption
              key={label}
              label={label}
              count={count}
              checked={selectedBrands.some(brand => brand.toLowerCase() === label.toLowerCase())}
              onChange={() => toggleBrand(label)}
            />
          ))}
        </div>
        {brandCounts.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAllBrands((v) => !v)}
            className="mt-1 inline-flex min-h-[24px] items-center px-1 text-[13px] font-medium text-[#1560BD] hover:underline"
          >
            {showAllBrands ? "− Show Less" : "+ Show More"}
          </button>
        )}
      </FilterSection>

      <FilterSection title="Price Range" defaultOpen={false}>
        {PRICE_BANDS.map((band) => (
          <CheckOption
            key={band.label}
            label={band.label}
            checked={priceBandActive(band.range)}
            onChange={() => togglePriceBand(band.range)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Discount" defaultOpen={false}>
        {DISCOUNT_BANDS.map((d) => (
          <CheckOption
            key={d}
            label={`${d}% and above`}
            checked={minDiscount === d}
            onChange={() => setMinDiscount(minDiscount === d ? 0 : d)}
          />
        ))}
      </FilterSection>

      <FilterSection title="Availability">
        <CheckOption label="In Stock" count={eligibleProducts.filter(isInStock).length} checked={availability === "in"} onChange={() => setAvailability(value => value === "in" ? "all" : "in")} />
        <CheckOption label="Out of Stock" count={eligibleProducts.filter(product => !isInStock(product)).length} checked={availability === "out"} onChange={() => setAvailability(value => value === "out" ? "all" : "out")} />
      </FilterSection>

      <FilterSection title="Rating" defaultOpen={false}>
        {RATING_BANDS.map((r) => (
          <CheckOption
            key={r}
            label={`${r}★ & above`}
            checked={minRating === r}
            onChange={() => setMinRating(minRating === r ? 0 : r)}
          />
        ))}
      </FilterSection>

      {Object.keys(facets).length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <SpecFacets facets={facets} selection={facetSelection} onToggle={toggleFacet} />
        </div>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-white">
      <Header />

      <main id="main-content" className="w-full min-w-0 flex-grow">
        <div className="section-container py-4">
          <MarketingStatus page="products" />
          <nav className="flex items-center text-[13px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            <span className="mx-2 text-gray-300">/</span>
            <span className="font-medium text-gray-700">Offers</span>
          </nav>

          <div className="mt-3"><OffersHero banner={heroBanners[0]} /></div>
          <OfferTabs selected={offerTab} onSelect={setOfferTab} />

          <div className="mt-4 flex gap-4">
            {showFilters && (
              <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setShowFilters(false)}
              />
            )}

            <aside
              ref={filterRef}
              role={showFilters ? "dialog" : undefined}
              aria-modal={showFilters ? true : undefined}
              aria-label="Product filters"
              className={`${
                showFilters
                  ? "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[330px] overflow-y-auto bg-white p-3 shadow-2xl"
                  : "hidden"
              } flex-shrink-0 lg:block lg:w-[195px] lg:bg-transparent lg:p-0 lg:shadow-none`}
            >
              <div className="lg:sticky lg:top-24">{filterPanel}</div>
            </aside>

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>

              <div className="mb-4"><OffersPromotions banners={promoBanners} onBank={() => setOfferTab("bank")} onExchange={() => setOfferTab("exchange")} /></div>

              {(offerTab === "bank" || offerTab === "no-cost-emi") && <div className="mb-4">
                <RazorpayOffers offers={offerTab === "no-cost-emi" ? currentOffers.filter(isNoCostEmiOffer) : currentOffers}
                  loading={bankOffers.isLoading} error={bankOffers.error} retry={bankOffers.retry} mode={offerTab === "no-cost-emi" ? "emi" : "offers"} />
              </div>}

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className={marketing.enabled("results") ? "text-xl font-bold text-gray-900" : "sr-only"}>
                  {heading}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    ({sortedProducts.length.toLocaleString("en-IN")} Products)
                  </span>
                </h1>
                <div className="flex items-center gap-2">
                  <label htmlFor="sort-by" className="text-[13px] text-gray-600">
                    Sort By:
                  </label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] text-gray-700 focus:border-[#1560BD] focus:outline-none"
                  >
                    <option value="relevance">Featured</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="discount">Discount</option>
                    <option value="newest">Newest First</option>
                    <option value="rating">Customer Rating</option>
                    <option value="name-asc">Name: A to Z</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedCategories.map((id) => (
                    <FilterPill key={`cat-${id}`} label={titleCase(getCategoryName(id))} onRemove={() => toggleCategory(id)} />
                  ))}
                  {selectedSubCategories.map((sub) => (
                    <FilterPill key={`sub-${sub}`} label={titleCase(sub)} onRemove={() => toggleSubCategory(sub)} />
                  ))}
                  {selectedBrands.map((brand) => (
                    <FilterPill key={`brand-${brand}`} label={brand} onRemove={() => toggleBrand(brand)} />
                  ))}
                  {searchTerm && <FilterPill label={`Search: ${searchTerm}`} onRemove={() => setSearchTerm("")} />}
                  {minDiscount > 0 && (
                    <FilterPill label={`${minDiscount}%+ off`} onRemove={() => setMinDiscount(0)} />
                  )}
                  {minRating > 0 && <FilterPill label={`${minRating}★ & above`} onRemove={() => setMinRating(0)} />}
                  {availability !== "all" && <FilterPill label={availability === "in" ? "In stock" : "Out of stock"} onRemove={() => setAvailability("all")} />}
                  {!(priceRange[0] === 0 && priceRange[1] === PRICE_MAX) && (
                    <FilterPill
                      label={priceRange[1] === Infinity ? `Above ₹${priceRange[0].toLocaleString("en-IN")}` : `₹${priceRange[0].toLocaleString("en-IN")} – ₹${priceRange[1].toLocaleString("en-IN")}`}
                      onRemove={() => setPriceRange([0, PRICE_MAX])}
                    />
                  )}
                  {Object.entries(facetSelection).flatMap(([key, values]) =>
                    values.map((value) => (
                      <FilterPill key={`f-${key}-${value}`} label={value} onRemove={() => toggleFacet(key, value)} />
                    )),
                  )}
                </div>
              )}

              {isLoading ? (
                <div role="status" aria-label="Loading products" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white">
                      <div className="aspect-[4/3] rounded-t-lg bg-gray-100" />
                      <div className="space-y-2 p-3">
                        <div className="h-3 w-5/6 rounded bg-gray-100" />
                        <div className="h-3 w-2/3 rounded bg-gray-100" />
                        <div className="h-4 w-1/2 rounded bg-gray-100" />
                        <div className="h-9 rounded bg-gray-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                  {error}
                  <button type="button" onClick={() => setRetryCount(count => count + 1)} className="ml-3 underline">Retry products</button>
                </div>
              ) : currentProducts.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
                  <p className={`px-4 text-sm text-gray-500 ${offerTab === "exchange" && !marketing.enabled("results") ? "sr-only" : ""}`}>
                    {offerTab === "exchange" ? marketing.text("results", "exchangeDescription") :
                      ["festival", "bundle", "online"].includes(offerTab) ? "No eligible products are currently published for this offer category. Explore current catalog savings instead." :
                      "No products found matching your criteria."}
                  </p>
                  {offerTab === "exchange" && marketing.enabled("results") && <Link href={marketing.text("results", "exchangeCtaLink")} className="mt-3 inline-block text-sm font-semibold text-[#1560bd] underline">{marketing.text("results", "exchangeCtaText")}</Link>}
                  <button
                    type="button"
                    onClick={() => { clearFilters(); setOfferTab("all-products") }}
                    className="mt-4 rounded-md bg-[#1560BD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D4C99]"
                  >
                    View All Products
                  </button>
                </div>
              ) : (
                <>
                  <div aria-label="Product results" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {currentProducts.map((product) => (
                      <ProductListingCard key={product.id} product={product} offersMode
                        offerLabels={applicableOffers(bankOffers.offers, Number(product.price)).slice(0, 2).map(offer => `${offer.name} · Terms apply`)} />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <nav aria-label="Product pagination" className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                        className="rounded-md border border-gray-200 bg-white p-2 text-[#1560bd] disabled:opacity-40"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {pageNumbers.map((page, index) => <span key={page} className="inline-flex items-center gap-2">
                        {index > 0 && page - pageNumbers[index - 1] > 1 && <span className="text-xs text-slate-500">...</span>}
                        <button type="button" aria-label={`Page ${page}`} aria-current={currentPage === page ? "page" : undefined}
                          onClick={() => setCurrentPage(page)} className={`h-8 min-w-8 rounded px-2 text-xs ${currentPage === page ? "bg-[#1560bd] font-bold text-white" : "text-[#0f2557] hover:bg-blue-50"}`}>{page}</button>
                      </span>)}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                        className="rounded-md border border-gray-200 bg-white p-2 text-[#1560bd] disabled:opacity-40"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <OffersTrustStrip />
      </main>

      <Footer />
    </div>
  )
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="text-gray-400 hover:text-gray-700">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
