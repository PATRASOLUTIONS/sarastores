"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, CreditCard, LayoutGrid, List, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SpecFacets from "@/components/SpecFacets"
import ProductListingCard from "@/components/products/ProductListingCard"
import { ListingHero, ListingPromoRow, useListingBanners } from "@/components/products/ListingBanners"
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
  buildMobileFacets,
  buildSelectionAwareFacets,
  countActiveFacets,
  facetValuesFor,
  matchesFacetValues,
  mobileFacetValuesFor,
  MOBILE_FACETS_AFTER_RATING,
  MOBILE_FACETS_BEFORE_RATING,
  toggleFacetValue,
  type Facet,
  type FacetSelection,
} from "@/lib/product-facets"

interface Category {
  id: string
  name: string
  icon?: string
}

/**
 * One independent filter in the sidebar. Naming them lets a count leave its own
 * dimension out, which is what makes the numbers respond to the other filters.
 */
type Dimension =
  | "search"
  | "division"
  | "category"
  | "segment"
  | "subCategory"
  | "brand"
  | "price"
  | "discount"
  | "rating"
  | "availability"

/** Taxonomy labels are typed into spreadsheets, so compare them loosely. */
const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

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

function PriceRangeBar({
  min,
  max,
  value,
  onChange,
}: {
  min: number
  max: number
  value: [number, number]
  onChange: (next: [number, number]) => void
}) {
  if (!(max > min)) return null
  const step = 100
  const low = Math.min(Math.max(value[0], min), max - step)
  const high = Math.min(Number.isFinite(value[1]) ? value[1] : max, max)
  const span = max - min
  const start = ((low - min) / span) * 100
  const end = ((Math.max(high, low + step) - min) / span) * 100
  const thumb =
    "pointer-events-none absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#1560BD] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#1560BD]"

  const commit = (nextLow: number, nextHigh: number) => {
    const floor = Math.min(nextLow, nextHigh - step)
    const ceiling = Math.max(nextHigh, floor + step)
    const open = floor <= min && ceiling >= max
    onChange(open ? [0, PRICE_MAX] : [floor, ceiling])
  }

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-[12px] font-medium text-gray-600">
        <span>₹{low.toLocaleString("en-IN")}</span>
        <span>₹{Math.max(high, low + step).toLocaleString("en-IN")}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#1560BD]"
          style={{ left: `${start}%`, width: `${Math.max(end - start, 0)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-label="Minimum price"
          onChange={(event) => commit(Number(event.target.value), Math.max(high, low + step))}
          className={`${thumb} ${low > min + span / 2 ? "z-30" : "z-10"}`}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.max(high, low + step)}
          aria-label="Maximum price"
          onChange={(event) => commit(low, Number(event.target.value))}
          className={`${thumb} z-20`}
        />
      </div>
    </div>
  )
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
  const pathname = usePathname()
  const offersPage = pathname === "/offers"
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  // Division and segment are the outer and inner levels of the merchandising
  // hierarchy the header menu links into.
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([])
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_MAX])
  const [minDiscount, setMinDiscount] = useState(0)
  const [minRating, setMinRating] = useState(0)
  const [availability, setAvailability] = useState<"all" | "in" | "out">("all")
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({})
  const [sortBy, setSortBy] = useState("relevance")
  const [view, setView] = useState<"grid" | "list">("grid")

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef<HTMLElement>(null)
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [offerTab, setOfferTab] = useState<OfferTab>(offersPage ? "all-offers" : "all-products")
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

    // Header menu links arrive as ?division=…&subCategory=…&segment=….
    const commaList = (value: string | null) =>
      value ? value.split(",").map(entry => entry.trim()).filter(Boolean) : []
    setSelectedDivisions(commaList(searchParams.get("division") || searchParams.get("divisions")))
    setSelectedSegments(commaList(searchParams.get("segment") || searchParams.get("segments")))

    setOfferTab(offersPage ? (searchParams.size > 0 ? "all-products" : "all-offers") : "all-products")
    setMinDiscount(0)
    setMinRating(0)
    const availabilityFromUrl = searchParams.get("availability")
    setAvailability(availabilityFromUrl === "in" || availabilityFromUrl === "out" ? availabilityFromUrl : "all")

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
  }, [offersPage, searchParams])

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

  /*
   * ── Filtering and faceted counts ──────────────────────────────────
   *
   * Every sidebar number used to be counted over `eligibleProducts`, the set
   * before any filter ran, so the counts never moved: choosing "LG" left the
   * category tallies untouched and choosing "Televisions" left the brand
   * tallies untouched. They answered "what does the catalogue hold" when the
   * shopper is asking "what is still available".
   *
   * A dimension is now counted over the products matching every *other*
   * dimension, deliberately ignoring its own selection. Applying a dimension
   * to its own counts would read (0) against every value the shopper has not
   * picked — select "LG" and no second brand could ever be added, because each
   * would look empty. Values within one dimension are OR-ed, so each has to be
   * counted as though nothing in that dimension were chosen.
   */
  const matchesExcept = useCallback(
    (product: Product, skip: Dimension | null): boolean => {
      if (skip !== "search") {
        const term = searchTerm.trim().toLowerCase()
        if (
          term &&
          !(product.name || "").toLowerCase().includes(term) &&
          !(product.description || "").toLowerCase().includes(term)
        )
          return false
      }

      if (skip !== "division" && selectedDivisions.length > 0) {
        const division = String(product.division ?? "")
        if (!division || !selectedDivisions.some(value => sameLabel(value, division))) return false
      }

      if (skip !== "segment" && selectedSegments.length > 0) {
        const segment = String(product.segment ?? "")
        if (!segment || !selectedSegments.some(value => sameLabel(value, segment))) return false
      }

      if (skip !== "category" && selectedCategories.length > 0) {
        const raw = getProductCategoryGroupName(product)
        const matching = categories.find(
          (c) => c.id === raw || c.name.toLowerCase() === raw.toLowerCase(),
        )
        if (!selectedCategories.some(value => value.toLowerCase() === raw.toLowerCase() ||
          value === matching?.id || value.toLowerCase() === matching?.name.toLowerCase())) return false
      }

      if (skip !== "subCategory" && selectedSubCategories.length > 0) {
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

      if (skip !== "brand" && selectedBrands.length > 0) {
        const brand = getProductBrand(product).toLowerCase()
        if (!selectedBrands.some((b) => b.toLowerCase() === brand)) return false
      }

      if (skip !== "price" && (product.price < priceRange[0] || product.price > priceRange[1])) return false

      if (skip !== "discount" && minDiscount > 0 &&
        calculateDiscount(getCatalogMRP(product), product.price) < minDiscount) return false

      if (skip !== "rating" && minRating > 0 &&
        getCatalogRatingInfo(product).rating < minRating) return false

      if (skip !== "availability") {
        if (availability === "in" && !isInStock(product)) return false
        if (availability === "out" && isInStock(product)) return false
      }

      return true
    },
    [
      categories,
      searchTerm,
      selectedCategories,
      selectedDivisions,
      selectedSegments,
      selectedSubCategories,
      selectedBrands,
      priceRange,
      minDiscount,
      minRating,
      availability,
    ],
  )

  /*
   * Spec facet values are derived with a dozen regexes over the name, spec keys
   * and features, so they are extracted once per product and reused. Counting
   * eight dimensions and a dozen facets separately would otherwise re-derive
   * them tens of thousands of times on every click.
   */
  const facetValuesById = useMemo(() => {
    const map = new Map<string, Record<string, string[]>>()
    const read = offersPage ? facetValuesFor : mobileFacetValuesFor
    for (const product of eligibleProducts) map.set(String(product.id), read(product))
    return map
  }, [eligibleProducts, offersPage])

  const valuesFor = useCallback(
    (product: Product) => facetValuesById.get(String(product.id)) ?? {},
    [facetValuesById],
  )

  /** Products matching every dimension except `skip`, spec facets included. */
  const countBase = useCallback(
    (skip: Dimension) =>
      eligibleProducts.filter(
        (product) => matchesExcept(product, skip) && matchesFacetValues(valuesFor(product), facetSelection),
      ),
    [eligibleProducts, matchesExcept, facetSelection, valuesFor],
  )

  // ── Derived options ─────────────────────────────────────────────────
  /**
   * Count a taxonomy field, keeping any selected label listed even at zero so
   * the shopper always has a control to undo the choice.
   */
  const labelCounts = useCallback(
    (dimension: Dimension, valueOf: (product: Product) => string, selected: string[]) => {
      const counts = new Map<string, number>()
      for (const product of countBase(dimension)) {
        const value = valueOf(product).trim()
        if (value) counts.set(value, (counts.get(value) || 0) + 1)
      }
      for (const choice of selected) {
        if (![...counts.keys()].some(label => sameLabel(label, choice))) counts.set(choice, 0)
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    },
    [countBase],
  )

  const divisionCounts = useMemo(
    () => labelCounts("division", p => String(p.division ?? ""), selectedDivisions),
    [labelCounts, selectedDivisions],
  )

  const segmentCounts = useMemo(
    () => labelCounts("segment", p => String(p.segment ?? ""), selectedSegments),
    [labelCounts, selectedSegments],
  )

  const categoryCounts = useMemo(
    () => labelCounts("category", p => getProductCategoryGroupName(p), selectedCategories),
    [labelCounts, selectedCategories],
  )

  const subCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of countBase("subCategory")) {
      const sub = shopperCategory(p)
      if (sub) counts.set(sub, (counts.get(sub) || 0) + 1)
    }
    // A selected value stays listed at zero so it can still be switched off.
    for (const selected of selectedSubCategories) {
      if (!counts.has(selected)) counts.set(selected, 0)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [countBase, selectedSubCategories])

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of countBase("brand")) {
      const brand = getProductBrand(p)
      if (brand) counts.set(brand, (counts.get(brand) || 0) + 1)
    }
    for (const selected of selectedBrands) {
      if (![...counts.keys()].some(brand => brand.toLowerCase() === selected.toLowerCase())) {
        counts.set(selected, 0)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [countBase, selectedBrands])

  const availabilityCounts = useMemo(() => {
    const base = countBase("availability")
    return { in: base.filter(isInStock).length, out: base.filter(p => !isInStock(p)).length }
  }, [countBase])

  const priceBounds = useMemo(() => {
    const prices = eligibleProducts.map((product) => Number(product.price)).filter((price) => Number.isFinite(price) && price > 0)
    if (prices.length === 0) return { min: 0, max: 0 }
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
  }, [eligibleProducts])

  const priceBandCounts = useMemo(() => {
    const base = countBase("price")
    return PRICE_BANDS.map(band =>
      base.filter(p => p.price >= band.range[0] && p.price <= band.range[1]).length,
    )
  }, [countBase])

  const discountBandCounts = useMemo(() => {
    const base = countBase("discount")
    return DISCOUNT_BANDS.map(threshold =>
      base.filter(p => calculateDiscount(getCatalogMRP(p), p.price) >= threshold).length,
    )
  }, [countBase])

  const ratingBandCounts = useMemo(() => {
    const base = countBase("rating")
    return RATING_BANDS.map(threshold =>
      base.filter(p => getCatalogRatingInfo(p).rating >= threshold).length,
    )
  }, [countBase])

  const filteredProducts = useMemo(
    () => eligibleProducts.filter(product => matchesExcept(product, null)),
    [eligibleProducts, matchesExcept],
  )

  // Each spec facet is counted ignoring its own selection, for the same reason
  // the sidebar dimensions are.
  const facets = useMemo(
    () => offersPage
      ? buildSelectionAwareFacets(filteredProducts.map(valuesFor), facetSelection)
      : buildMobileFacets(filteredProducts.map(valuesFor), facetSelection),
    [offersPage, filteredProducts, facetSelection, valuesFor],
  )

  const facetsNamed = (keys: readonly string[]) =>
    keys.map((key) => facets.find((facet) => facet.key === key)).filter((facet): facet is Facet => Boolean(facet))

  /** A taxonomy filter with a single value cannot narrow the list. */
  const hasVariants = (counts: Array<[string, number]>) => counts.filter(([, count]) => count > 0).length > 1

  const facetedProducts = useMemo(
    () => filteredProducts.filter((p) => matchesFacetValues(valuesFor(p), facetSelection)),
    [filteredProducts, facetSelection, valuesFor],
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
        // Only the unranked default may demote out-of-stock items: an explicit
        // sort is a promise about the column the shopper picked, and stock is
        // not that column. A partition, not a sort, so the catalogue order
        // inside each group survives.
        return [...list.filter(isInStock), ...list.filter(product => !isInStock(product))]
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

  const divisionLanding = !offersPage && selectedDivisions.length === 1
  const showSubFilters = selectedDivisions.length > 0
  const divisionName = selectedDivisions[0] ? titleCase(selectedDivisions[0]) : ""
  const focusName = selectedSubCategories[0] ? titleCase(selectedSubCategories[0]) : divisionName
  const activeScope =
    selectedDivisions[0] ||
    selectedSubCategories[0] ||
    (selectedCategories[0] ? getCategoryName(selectedCategories[0]) : "") ||
    ""
  const heading = offersPage
    ? (offerTab === "all-products" ? (focusName || (activeScope ? titleCase(activeScope) : "All Products")) : marketing.text("results", "title"))
    : (divisionLanding ? focusName : "All Products")
  const pageNumbers = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => currentPage - 2 + index), totalPages])]
    .filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b)

  const heroBanners = useListingBanners("hero", activeScope)
  const promoBanners = useListingBanners("promo", activeScope)
  const sameScope = (scope?: string) => (scope || "").trim().toLowerCase() === (selectedDivisions[0] || "").trim().toLowerCase()
  const divisionHero = heroBanners.find((banner) => sameScope(banner.scope))
  const divisionPromos = promoBanners.filter((banner) => sameScope(banner.scope))

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
  const toggleDivision = toggleIn(setSelectedDivisions)
  const toggleSegment = toggleIn(setSelectedSegments)
  const toggleFacet = (key: string, value: string) =>
    setFacetSelection((prev) => toggleFacetValue(prev, key, value))

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedSubCategories([])
    setSelectedBrands([])
    setSelectedDivisions([])
    setSelectedSegments([])
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
    selectedDivisions.length > 0 ||
    selectedSegments.length > 0 ||
    minDiscount > 0 ||
    minRating > 0 ||
    availability !== "all" ||
    Boolean(searchTerm) ||
    countActiveFacets(facetSelection) > 0 ||
    !(priceRange[0] === 0 && priceRange[1] === PRICE_MAX)

  /*
   * The collapsed brand list shows the six largest. Now that counts move with
   * the other filters the order moves too, so a brand the shopper picked can
   * drop out of the top six and take its own checkbox off screen with it.
   * Selected brands are always listed.
   */
  const renderFacetSections = (list: Facet[]) => list.map((facet) => (
    <FilterSection key={facet.key} title={facet.label} defaultOpen={false}>
      <div className="max-h-64 overflow-y-auto pr-1">
        {facet.values.map(({ value, count }) => (
          <CheckOption
            key={value}
            label={value}
            count={count}
            checked={(facetSelection[facet.key] || []).includes(value)}
            onChange={() => toggleFacet(facet.key, value)}
          />
        ))}
      </div>
    </FilterSection>
  ))

  const visibleBrands = useMemo(() => {
    if (showAllBrands) return brandCounts
    const isSelected = ([label]: [string, number]) =>
      selectedBrands.some(brand => brand.toLowerCase() === label.toLowerCase())
    return [
      ...brandCounts.filter(isSelected),
      ...brandCounts.filter(entry => !isSelected(entry)).slice(0, Math.max(0, 6 - selectedBrands.length)),
    ]
  }, [brandCounts, selectedBrands, showAllBrands])

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

      {/*
        Division and Segment are the outer and inner levels of the
        merchandising hierarchy. They only render once products carry those
        labels, so an unclassified catalogue shows the sidebar it always had
        rather than two empty sections.
      */}
      {!offersPage && !divisionLanding && hasVariants(divisionCounts) && (
        <FilterSection title="Division">
          <div className="max-h-64 overflow-y-auto pr-1">
            {divisionCounts.map(([label, count]) => (
              <CheckOption
                key={label}
                label={titleCase(label)}
                count={count}
                checked={selectedDivisions.some(value => sameLabel(value, label))}
                onChange={() => toggleDivision(label)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {!offersPage && hasVariants(categoryCounts) && (
      <FilterSection title="Category">
        <div className="max-h-64 overflow-y-auto pr-1">
          {categoryCounts.map(([label, count]) => (
            <CheckOption
              key={label}
              label={titleCase(label)}
              count={count}
              checked={selectedCategories.some(value => sameLabel(value, label))}
              onChange={() => toggleCategory(label)}
            />
          ))}
        </div>
      </FilterSection>
      )}

      {offersPage && subCategoryCounts.length > 0 && (
      <FilterSection title="Sub-Category">
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
      )}

      {!offersPage && hasVariants(segmentCounts) && (
        <FilterSection title="Segment">
          <div className="max-h-64 overflow-y-auto pr-1">
            {segmentCounts.map(([label, count]) => (
              <CheckOption
                key={label}
                label={titleCase(label)}
                count={count}
                checked={selectedSegments.some(value => sameLabel(value, label))}
                onChange={() => toggleSegment(label)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {!offersPage && (
        <FilterSection title="Price">
          <PriceRangeBar min={priceBounds.min} max={priceBounds.max} value={priceRange} onChange={setPriceRange} />
          {PRICE_BANDS.map((band, index) => (
            <CheckOption
              key={band.label}
              label={band.label}
              count={priceBandCounts[index]}
              checked={priceBandActive(band.range)}
              onChange={() => togglePriceBand(band.range)}
            />
          ))}
        </FilterSection>
      )}

      <FilterSection key={offerTab === "brand" ? "brand-offers" : "brand-filter"} title={offersPage ? "Brand" : "Brands"} defaultOpen={offerTab === "brand"}>
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

      {offersPage && (
      <FilterSection title="Price Range" defaultOpen={false}>
        <PriceRangeBar min={priceBounds.min} max={priceBounds.max} value={priceRange} onChange={setPriceRange} />
        {PRICE_BANDS.map((band, index) => (
          <CheckOption
            key={band.label}
            label={band.label}
            count={priceBandCounts[index]}
            checked={priceBandActive(band.range)}
            onChange={() => togglePriceBand(band.range)}
          />
        ))}
      </FilterSection>
      )}

      {!offersPage && renderFacetSections(facetsNamed(MOBILE_FACETS_BEFORE_RATING))}

      {offersPage && (
      <FilterSection title="Discount" defaultOpen={false}>
        {DISCOUNT_BANDS.map((d, index) => (
          <CheckOption
            key={d}
            label={`${d}% and above`}
            count={discountBandCounts[index]}
            checked={minDiscount === d}
            onChange={() => setMinDiscount(minDiscount === d ? 0 : d)}
          />
        ))}
      </FilterSection>
      )}

      {offersPage && (
      <FilterSection title="Availability">
        <CheckOption label="In Stock" count={availabilityCounts.in} checked={availability === "in"} onChange={() => setAvailability(value => value === "in" ? "all" : "in")} />
        <CheckOption label="Out of Stock" count={availabilityCounts.out} checked={availability === "out"} onChange={() => setAvailability(value => value === "out" ? "all" : "out")} />
      </FilterSection>
      )}

      <FilterSection title={offersPage ? "Rating" : "Customer Ratings"} defaultOpen={false}>
        {RATING_BANDS.map((r, index) => (
          <CheckOption
            key={r}
            label={`${r}★ & above`}
            count={ratingBandCounts[index]}
            checked={minRating === r}
            onChange={() => setMinRating(minRating === r ? 0 : r)}
          />
        ))}
      </FilterSection>

      {!offersPage && renderFacetSections(facetsNamed(MOBILE_FACETS_AFTER_RATING))}

      {!offersPage && (
      <FilterSection title="Availability">
        <CheckOption label="In Stock" count={availabilityCounts.in} checked={availability === "in"} onChange={() => setAvailability(value => value === "in" ? "all" : "in")} />
        <CheckOption label="Out of Stock" count={availabilityCounts.out} checked={availability === "out"} onChange={() => setAvailability(value => value === "out" ? "all" : "out")} />
      </FilterSection>
      )}

      {offersPage && showSubFilters && facets.length > 0 && (
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
          <nav className={`flex flex-wrap items-center text-[13px] ${divisionLanding ? "gap-1 text-[#1560BD]" : "text-gray-500"}`} aria-label="Breadcrumb">
            <Link href="/" className={divisionLanding ? "font-medium hover:underline" : "hover:text-[#1560BD]"}>Home</Link>
            {divisionLanding ? <ChevronRight className="h-3.5 w-3.5" /> : <span className="mx-2 text-gray-300">/</span>}
            {offersPage ? (
              <span className="font-medium text-gray-700">Offers</span>
            ) : (
              <>
                {divisionLanding ? (
                  <Link href="/products" className="font-medium hover:underline">Products</Link>
                ) : (
                  <span className="font-medium text-gray-700">Products</span>
                )}
                {divisionName && (
                  <>
                    {divisionLanding ? <ChevronRight className="h-3.5 w-3.5" /> : <span className="mx-2 text-gray-300">/</span>}
                    {selectedSubCategories[0] ? (
                      <Link href={`/products?division=${encodeURIComponent(selectedDivisions[0])}`} className="font-medium hover:underline">{divisionName}</Link>
                    ) : (
                      <span className={divisionLanding ? "font-semibold" : "font-medium text-gray-700"}>{divisionName}</span>
                    )}
                  </>
                )}
                {selectedSubCategories[0] && (
                  <>
                    {divisionLanding ? <ChevronRight className="h-3.5 w-3.5" /> : <span className="mx-2 text-gray-300">/</span>}
                    <span className={divisionLanding ? "font-semibold" : "font-medium text-gray-700"}>{titleCase(selectedSubCategories[0])}</span>
                  </>
                )}
              </>
            )}
          </nav>

          {divisionLanding && (
            <div className="mt-4 flex items-center justify-between gap-6 border-b border-gray-100 pb-5">
              <div className="min-w-0 max-w-xl">
                <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A] md:text-[32px]">{focusName}</h1>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                  Latest {focusName.toLowerCase()} from Apple, Samsung, OnePlus, Xiaomi and more.
                </p>
              </div>
              <ul className="flex shrink-0 flex-nowrap gap-3">
                {[
                  { icon: ShieldCheck, title: "100% Genuine Products", detail: "Direct from Brands" },
                  { icon: CreditCard, title: "Easy EMI", detail: "All Major Banks" },
                  { icon: RefreshCw, title: "Exchange Available", detail: "Get Best Value" },
                ].map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="flex items-center gap-2.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E8F1FF] text-[#1560BD]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[13px] font-bold leading-tight text-[#0F2557]">{title}</span>
                      <span className="mt-0.5 block text-[11px] text-gray-500">{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {offersPage && (
            <>
              <div className="mt-3"><OffersHero banner={heroBanners[0]} /></div>
              <OfferTabs selected={offerTab} onSelect={setOfferTab} />
            </>
          )}

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
              } flex-shrink-0 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:w-[230px] lg:self-start lg:overflow-y-auto lg:overscroll-y-contain lg:bg-transparent lg:p-0 lg:shadow-none`}
            >
              <div>{filterPanel}</div>
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

              {offersPage && <div className="mb-4"><OffersPromotions banners={promoBanners} onBank={() => setOfferTab("bank")} onExchange={() => setOfferTab("exchange")} /></div>}
              {divisionLanding && divisionHero && <div className="mb-4"><ListingHero banner={divisionHero} /></div>}

              {(offerTab === "bank" || offerTab === "no-cost-emi") && <div className="mb-4">
                <RazorpayOffers offers={offerTab === "no-cost-emi" ? currentOffers.filter(isNoCostEmiOffer) : currentOffers}
                  loading={bankOffers.isLoading} error={bankOffers.error} retry={bankOffers.retry} mode={offerTab === "no-cost-emi" ? "emi" : "offers"} />
              </div>}

              <div className="mb-3">
                <h1 className={divisionLanding ? "sr-only" : marketing.enabled("results") ? "min-w-0 flex-1 text-xl font-bold text-gray-900" : "sr-only"}>
                  {heading}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    ({sortedProducts.length.toLocaleString("en-IN")} Products)
                  </span>
                </h1>
              </div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-52 shrink-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search products"
                      aria-label="Search products"
                      className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-[13px] text-gray-700 outline-none placeholder:text-gray-400 focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                    />
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <label htmlFor="sort-by" className="text-[13px] text-gray-600">
                    Sort By:
                  </label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] text-gray-700 focus:border-[#1560BD] focus:outline-none"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="discount">Discount</option>
                    <option value="newest">Newest First</option>
                    <option value="rating">Customer Rating</option>
                    <option value="name-asc">Name: A to Z</option>
                  </select>
                  <div className="flex overflow-hidden rounded-md border border-gray-300">
                    <button
                      type="button"
                      aria-label="Grid view"
                      aria-pressed={view === "grid"}
                      onClick={() => setView("grid")}
                      className={`px-2 py-1.5 ${view === "grid" ? "bg-[#1560BD] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="List view"
                      aria-pressed={view === "list"}
                      onClick={() => setView("list")}
                      className={`border-l border-gray-300 px-2 py-1.5 ${view === "list" ? "bg-[#1560BD] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
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
                <div role="status" aria-label="Loading products" className={view === "list" ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"}>
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
                  <div aria-label="Product results" className={view === "list" ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"}>
                    {currentProducts.map((product) => (
                      <ProductListingCard key={product.id} product={product} offersMode layout={view}
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
              {divisionLanding && divisionPromos.length > 0 && (
                <div className="mt-8"><ListingPromoRow banners={divisionPromos} /></div>
              )}
            </div>
          </div>
        </div>
        {!divisionLanding && <OffersTrustStrip />}
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
