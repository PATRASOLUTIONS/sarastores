"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SpecFacets from "@/components/SpecFacets"
import ProductListingCard from "@/components/products/ProductListingCard"
import SubCategoryTiles from "@/components/products/SubCategoryTiles"
import { ListingHero, ListingPromoRow, useListingBanners } from "@/components/products/ListingBanners"
import { fetchWithCache, revalidateCache } from "@/utils/cache"
import { normalizeProductForSchema } from "@/lib/product-schema"
import { calculateDiscount, getEffectiveMRP, getRatingInfo, titleCaseLabel } from "@/lib/product-display"
import {
  buildFacets,
  countActiveFacets,
  matchesFacets,
  toggleFacetValue,
  type FacetSelection,
} from "@/lib/product-facets"

interface Product {
  id: string
  slug?: string
  name: string
  description: string
  price: number
  image: string
  stock: number
  category?: string
  manufacturer?: string
  manufacturerName?: string
  images?: string[]
  sku?: string
  type?: string
  trusted?: boolean
  mrp?: number
}

interface Category {
  id: string
  name: string
  icon?: string
}

const PRICE_MAX = 200000

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

const getCanonicalMeta = (product: any) => normalizeProductForSchema(product)
const getProductSubCategory = (product: any) =>
  String(product?.subCategory || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductType = (product: any) => String(product?.type || getCanonicalMeta(product).subCategoryProdDesc || "")
const getProductBrand = (product: any) => String(getCanonicalMeta(product).manufacturerName || "")
const getProductCharDesc = (product: any) => String(getCanonicalMeta(product).charDesc || "")
const getProductCategoryGroupName = (product: any): string =>
  String(product?.groupName || product?.category || getCanonicalMeta(product).categoryGroupName || "")

/** "TV 55 INCH" and friends collapse into a single browsable label. */
const normaliseSubCategory = (sub: string) =>
  sub.toLowerCase().startsWith("tv ") || sub.toLowerCase() === "tv" ? "TV" : sub

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
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && <span className="text-gray-400">({count})</span>}
    </label>
  )
}

export default function ProductsPage() {
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_MAX])
  const [minDiscount, setMinDiscount] = useState(0)
  const [minRating, setMinRating] = useState(0)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [facetSelection, setFacetSelection] = useState<FacetSelection>({})
  const [sortBy, setSortBy] = useState("relevance")

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategoryImages, setSubCategoryImages] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // ── URL hydration + data ────────────────────────────────────────────
  useEffect(() => {
    const categoryFromUrl = searchParams.get("category")
    const searchFromUrl = searchParams.get("search")
    const brandFromUrl = searchParams.get("brand") || searchParams.get("brands")
    const subCategoryFromUrl = searchParams.get("subCategory")
    const subCategoriesFromUrl = searchParams.get("subCategories")

    if (categoryFromUrl) setSelectedCategories([categoryFromUrl])
    if (searchFromUrl) setSearchTerm(searchFromUrl)
    if (brandFromUrl) setSelectedBrands([brandFromUrl])

    const sortFromUrl = searchParams.get("sort")
    if (sortFromUrl) setSortBy(sortFromUrl)

    // Search suggestions deep-link structured intent here, so "55 inch tv under
    // 60000" arrives as real filters rather than a raw string.
    const qFromUrl = searchParams.get("q")
    if (qFromUrl && !searchFromUrl) setSearchTerm(qFromUrl)

    const minPrice = Number(searchParams.get("minPrice"))
    const maxPrice = Number(searchParams.get("maxPrice"))
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
      setPriceRange([
        Number.isFinite(minPrice) ? minPrice : 0,
        Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : PRICE_MAX,
      ])
    }

    const urlFacets: FacetSelection = {}
    const size = searchParams.get("size")
    if (size) urlFacets.screenSize = [`${size}"`]
    const star = searchParams.get("star")
    if (star) urlFacets.energyRating = [`${star} Star`]
    const features = searchParams.getAll("feature")
    if (features.length > 0) urlFacets.smartFeatures = features.map((f) => f.replace(/\b\w/g, (c) => c.toUpperCase()))
    if (Object.keys(urlFacets).length > 0) setFacetSelection(urlFacets)

    const selections: string[] = []
    if (subCategoryFromUrl) selections.push(subCategoryFromUrl)
    if (subCategoriesFromUrl) selections.push(...subCategoriesFromUrl.split(",").map((s) => s.trim()).filter(Boolean))
    if (selections.length > 0) setSelectedSubCategories(selections)

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [productsData, categoriesData, subCategoryData] = await Promise.all([
          fetchWithCache(
            "products",
            async () => {
              const r = await fetch("/api/products")
              if (!r.ok) throw new Error("Failed to fetch products")
              return r.json()
            },
            5 * 60 * 1000,
          ),
          fetchWithCache(
            "categories",
            async () => {
              const r = await fetch("/api/categories")
              if (!r.ok) throw new Error("Failed to fetch categories")
              return r.json()
            },
            5 * 60 * 1000,
          ),
          fetchWithCache(
            "sub-categories",
            async () => {
              const r = await fetch("/api/sub-categories")
              return r.ok ? r.json() : []
            },
            5 * 60 * 1000,
          ),
        ])

        setProducts(productsData)
        setCategories(categoriesData)
        setSubCategoryImages(
          Object.fromEntries(
            (Array.isArray(subCategoryData) ? subCategoryData : [])
              .filter((s: any) => s?.name)
              .map((s: any) => [String(s.name).toLowerCase(), s.image || ""]),
          ),
        )

        revalidateCache(
          "products",
          async () => {
            const r = await fetch("/api/products")
            if (!r.ok) throw new Error("Failed to fetch products")
            return r.json()
          },
          5 * 60 * 1000,
        )
      } catch (err) {
        console.error("Error fetching data:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [searchParams])

  // ── Derived options ─────────────────────────────────────────────────
  const subCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const sub = normaliseSubCategory(getProductSubCategory(p))
      if (sub) counts.set(sub, (counts.get(sub) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [products])

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const brand = getProductBrand(p)
      if (brand) counts.set(brand, (counts.get(brand) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [products])

  const tiles = useMemo(
    () =>
      subCategoryCounts.slice(0, 14).map(([label]) => ({
        label,
        image: subCategoryImages[label.toLowerCase()] || undefined,
      })),
    [subCategoryCounts, subCategoryImages],
  )

  // ── Filtering ───────────────────────────────────────────────────────
  const filteredProducts = useMemo(
    () =>
      products.filter((product: any) => {
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
          if (!selectedCategories.includes(raw) && !(matching && selectedCategories.includes(matching.id))) return false
        }

        if (selectedSubCategories.length > 0) {
          // Tiles select the collapsed label ("TV"), but footer/menu links deep-link
          // the exact stored value ('TV 43"'), so match either form.
          const rawSub = getProductSubCategory(product).toLowerCase()
          const sub = normaliseSubCategory(getProductSubCategory(product)).toLowerCase()
          if (
            !selectedSubCategories.some((s) => {
              const target = s.toLowerCase()
              return target === sub || target === rawSub
            })
          )
            return false
        }

        if (selectedBrands.length > 0) {
          const brand = getProductBrand(product).toLowerCase()
          if (!selectedBrands.some((b) => b.toLowerCase() === brand)) return false
        }

        if (product.price < priceRange[0] || product.price > priceRange[1]) return false

        if (minDiscount > 0 && calculateDiscount(getEffectiveMRP(product), product.price) < minDiscount) return false
        if (minRating > 0 && getRatingInfo(product).rating < minRating) return false
        if (inStockOnly && typeof product.stock === "number" && product.stock <= 0) return false

        return true
      }),
    [
      products,
      categories,
      searchTerm,
      selectedCategories,
      selectedSubCategories,
      selectedBrands,
      priceRange,
      minDiscount,
      minRating,
      inStockOnly,
    ],
  )

  // Facets come from the pre-facet result set so choosing one value doesn't
  // erase the sibling options from the sidebar.
  const facets = useMemo(() => buildFacets(filteredProducts), [filteredProducts])
  const facetedProducts = useMemo(
    () => filteredProducts.filter((p: any) => matchesFacets(p, facetSelection)),
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
            calculateDiscount(getEffectiveMRP(b), b.price) - calculateDiscount(getEffectiveMRP(a), a.price),
        )
      case "rating":
        return list.sort((a, b) => getRatingInfo(b).rating - getRatingInfo(a).rating)
      case "newest":
        return list.sort(
          (a: any, b: any) =>
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
    inStockOnly,
    sortBy,
    facetSelection,
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
  const heading = activeScope ? titleCase(activeScope) : "All Products"

  const heroBanners = useListingBanners("hero", activeScope)
  const promoBanners = useListingBanners("promo", activeScope)

  const priceBandActive = (band: [number, number]) => priceRange[0] === band[0] && priceRange[1] === band[1]

  const togglePriceBand = (band: [number, number]) =>
    setPriceRange(priceBandActive(band) ? [0, PRICE_MAX] : band)

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

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
    setInStockOnly(false)
    setFacetSelection({})
    setSearchTerm("")
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSubCategories.length > 0 ||
    selectedBrands.length > 0 ||
    minDiscount > 0 ||
    minRating > 0 ||
    inStockOnly ||
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

      <FilterSection title="Brand">
        <div className="max-h-64 overflow-y-auto pr-1">
          {visibleBrands.map(([label, count]) => (
            <CheckOption
              key={label}
              label={titleCase(label)}
              count={count}
              checked={selectedBrands.includes(label)}
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

      <FilterSection title="Price Range">
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

      <FilterSection title="Availability" defaultOpen={false}>
        <CheckOption label="In stock only" checked={inStockOnly} onChange={() => setInStockOnly((v) => !v)} />
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="flex-grow">
        <div className="section-container py-4">
          <nav className="flex items-center text-[13px] text-gray-500" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[#1560BD]">
              Home
            </Link>
            <span className="mx-2 text-gray-300">/</span>
            <span className="font-medium text-gray-700">{heading}</span>
          </nav>

          {heroBanners[0] && (
            <div className="mt-3">
              <ListingHero banner={heroBanners[0]} />
            </div>
          )}

          {tiles.length > 0 && (
            <div className="mt-4">
              <SubCategoryTiles items={tiles} selected={selectedSubCategories} onToggle={toggleSubCategory} />
            </div>
          )}

          <div className="mt-5 flex gap-5">
            {showFilters && (
              <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setShowFilters(false)}
              />
            )}

            <aside
              className={`${
                showFilters
                  ? "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[330px] overflow-y-auto bg-white p-3 shadow-2xl"
                  : "hidden"
              } flex-shrink-0 lg:block lg:w-[236px] lg:bg-transparent lg:p-0 lg:shadow-none`}
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

              {promoBanners.length > 0 && (
                <div className="mb-5">
                  <ListingPromoRow banners={promoBanners} />
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-bold text-gray-900">
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
                    <option value="relevance">Popularity</option>
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
                    <FilterPill key={`brand-${brand}`} label={titleCase(brand)} onRemove={() => toggleBrand(brand)} />
                  ))}
                  {minDiscount > 0 && (
                    <FilterPill label={`${minDiscount}%+ off`} onRemove={() => setMinDiscount(0)} />
                  )}
                  {minRating > 0 && <FilterPill label={`${minRating}★ & above`} onRemove={() => setMinRating(0)} />}
                  {inStockOnly && <FilterPill label="In stock" onRemove={() => setInStockOnly(false)} />}
                  {!(priceRange[0] === 0 && priceRange[1] === PRICE_MAX) && (
                    <FilterPill
                      label={`₹${priceRange[0].toLocaleString("en-IN")} – ₹${priceRange[1].toLocaleString("en-IN")}`}
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
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
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
                </div>
              ) : currentProducts.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
                  <p className="text-gray-500">No products found matching your criteria.</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-md bg-[#1560BD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D4C99]"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {currentProducts.map((product) => (
                      <ProductListingCard key={product.id} product={product} />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="px-2 text-[13px] text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
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
