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
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { MarketingStatus } from "@/components/marketing/MarketingSections"
import { listingQueryFromUrl, listingResultSchema, type ListingQuery, type ListingResult } from "@/lib/catalogue-listing-contract"
import { apiFetch } from "@/lib/api-client"
import { titleCaseLabel } from "@/lib/product-display"
import {
  countActiveFacets,
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

export default function ProductsPage({ initialListing, initialCategories }: { initialListing: ListingResult; initialCategories?: Category[] }) {
  const initial = initialListing.query
  const marketing = useMarketingContent("products")
  const pathname = usePathname()
  const offersPage = pathname === "/offers"
  const defaultAvailability = offersPage ? "all" : "in"
  const searchParams = useSearchParams()

  const [searchTerm, setSearchTerm] = useState(initial.search)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial.categories)
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>(initial.subCategories)
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initial.brands)
  // Division and segment are the outer and inner levels of the merchandising
  // hierarchy the header menu links into.
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>(initial.divisions)
  const [selectedSegments, setSelectedSegments] = useState<string[]>(initial.segments)
  const [priceRange, setPriceRange] = useState<[number, number]>([initial.minPrice, initial.maxPrice ?? PRICE_MAX])
  const [minDiscount, setMinDiscount] = useState(initial.minDiscount)
  const [minRating, setMinRating] = useState(initial.minRating)
  const [availability, setAvailability] = useState<"all" | "in" | "out">(initial.availability)
  const [facetSelection, setFacetSelection] = useState<FacetSelection>(initial.facets)
  const [sortBy, setSortBy] = useState(initial.sort)
  const [view, setView] = useState<"grid" | "list">("grid")

  const [listing, setListing] = useState(initialListing)
  const categories = initialCategories || []
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef<HTMLElement>(null)
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [currentPage, setCurrentPage] = useState(initialListing.page)
  const [retryCount, setRetryCount] = useState(0)
  const [offerTab, setOfferTab] = useState<OfferTab>(initial.offerTab)
  const bankOffers = useRazorpayOffers()
  const currentOffers = applicableOffers(bankOffers.offers, Infinity)

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

  // URL entry points render the same filtered page on the server and client.
  const urlKey = searchParams.toString()
  const previousUrl = useRef(urlKey)
  useEffect(() => {
    if (previousUrl.current === urlKey) return
    previousUrl.current = urlKey
    let q
    try { q = listingQueryFromUrl(new URLSearchParams(urlKey), offersPage) }
    catch { q = listingQueryFromUrl(new URLSearchParams(), offersPage) }
    setSearchTerm(q.search);setSelectedDivisions(q.divisions);setSelectedCategories(q.categories)
    setSelectedSegments(q.segments);setSelectedSubCategories(q.subCategories);setSelectedBrands(q.brands)
    setPriceRange([q.minPrice,q.maxPrice ?? PRICE_MAX]);setMinDiscount(q.minDiscount);setMinRating(q.minRating)
    lastFilter.current=JSON.stringify({...q,page:1})
    setAvailability(q.availability);setFacetSelection(q.facets);setSortBy(q.sort);setOfferTab(q.offerTab);setCurrentPage(q.page)
  }, [urlKey, offersPage])

  const query = useMemo<ListingQuery>(() => ({
    search:searchTerm,divisions:selectedDivisions,categories:selectedCategories,segments:selectedSegments,
    subCategories:selectedSubCategories,brands:selectedBrands,minPrice:priceRange[0],maxPrice:Number.isFinite(priceRange[1])?priceRange[1]:null,
    minDiscount,minRating,availability,facets:facetSelection,sort:sortBy,offerTab,offersPage,page:currentPage,
  }),[searchTerm,selectedDivisions,selectedCategories,selectedSegments,selectedSubCategories,selectedBrands,priceRange,minDiscount,minRating,availability,facetSelection,sortBy,offerTab,offersPage,currentPage])
  const queryKey=JSON.stringify(query), filterKey=JSON.stringify({...query,page:1})
  const lastFilter=useRef(filterKey), initialKey=useRef(JSON.stringify(initialListing.query))
  const skipInitial=useRef(true)
  useEffect(()=>{if(lastFilter.current!==filterKey){lastFilter.current=filterKey;setCurrentPage(1)}},[filterKey])
  const [refresh,setRefresh]=useState(0)
  useEffect(()=>{
    const run=()=>{if(!document.hidden)setRefresh(v=>v+1)}
    const timer=setInterval(run,60000)
    window.addEventListener('focus',run)
    return ()=>{clearInterval(timer);window.removeEventListener('focus',run)}
  },[])
  useEffect(()=>{
    if(skipInitial.current){skipInitial.current=false;if(queryKey===initialKey.current && refresh===0 && retryCount===0)return}
    const controller=new AbortController();setIsLoading(true);setError(null)
    const timer=setTimeout(async()=>{
      try {
        const r=await apiFetch(`/api/products/listing?state=${encodeURIComponent(queryKey)}`,{signal:controller.signal})
        if(!r.ok)throw new Error('Products could not be loaded. Please retry.')
        const result=listingResultSchema.parse(await r.json())
        if(!controller.signal.aborted){setListing(result);if(result.page!==query.page)setCurrentPage(result.page)}
      }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Products are unavailable.')}
      finally{if(!controller.signal.aborted)setIsLoading(false)}
    },250)
    return ()=>{controller.abort();clearTimeout(timer)}
  },[queryKey,query.page,refresh,retryCount])
  const {divisionCounts,segmentCounts,categoryCounts,subCategoryCounts,brandCounts,availabilityCounts,
    priceBounds,priceBandCounts,discountBandCounts,ratingBandCounts,facets,totalPages}=listing
  const totalProducts=listing.total, currentProducts=error?[]:listing.products
  const facetsNamed=(keys:readonly string[])=>keys.map(key=>facets.find(f=>f.key===key)).filter((f):f is Facet=>Boolean(f))
  const hasVariants=(counts:Array<[string,number]>)=>counts.filter(([,count])=>count>0).length>1
  const pageLink=(page:number)=>`${offersPage?'/offers':'/products'}?listing=${encodeURIComponent(JSON.stringify({...query,page}))}`

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
    setAvailability(defaultAvailability)
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
            <div className="mt-4 flex flex-col gap-4 border-b border-gray-100 pb-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 max-w-xl">
                <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] md:text-[32px]">{focusName}</h1>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                  Latest {focusName.toLowerCase()} from Apple, Samsung, OnePlus, Xiaomi and more.
                </p>
              </div>
              <ul className="flex gap-2 overflow-x-auto pb-1 md:shrink-0 md:flex-nowrap md:overflow-visible md:pb-0">
                {[
                  { icon: ShieldCheck, title: "100% Genuine Products", detail: "Direct from Brands" },
                  { icon: CreditCard, title: "Easy EMI", detail: "All Major Banks" },
                  { icon: RefreshCw, title: "Exchange Available", detail: "Get Best Value" },
                ].map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="flex min-w-[210px] items-center gap-2.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2.5 md:min-w-0">
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
                    ({totalProducts.toLocaleString("en-IN")} Products)
                  </span>
                </h1>
              </div>
              {!offersPage && <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={availability === "in"}
                  onChange={event => setAvailability(event.target.checked ? "in" : "all")}
                  className="h-4 w-4 rounded border-gray-300 text-[#1560BD] focus:ring-[#1560BD]" />
                In stock only
                <span className="text-xs font-normal text-gray-500">({availabilityCounts.in.toLocaleString("en-IN")})</span>
              </label>}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-52 sm:shrink-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search products"
                      aria-label="Search products" maxLength={200}
                      className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-[13px] text-gray-700 outline-none placeholder:text-gray-400 focus:border-[#1560BD] focus:ring-1 focus:ring-[#1560BD]"
                    />
                </div>
                <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                  <label htmlFor="sort-by" className="shrink-0 text-[13px] text-gray-600">
                    Sort By:
                  </label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as ListingQuery["sort"])}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-[13px] text-gray-700 focus:border-[#1560BD] focus:outline-none sm:flex-none sm:px-3"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="discount">Discount</option>
                    <option value="newest">Newest First</option>
                    <option value="rating">Customer Rating</option>
                    <option value="name-asc">Name: A to Z</option>
                  </select>
                  <div className="flex shrink-0 overflow-hidden rounded-md border border-gray-300">
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
                        <Link href={pageLink(page)} prefetch={false} aria-label={`Page ${page}`} aria-current={currentPage === page ? "page" : undefined}
                          onClick={event => { event.preventDefault(); setCurrentPage(page) }} className={`h-8 min-w-8 rounded px-2 text-xs ${currentPage === page ? "bg-[#1560bd] font-bold text-white" : "text-[#0f2557] hover:bg-blue-50"}`}>{page}</Link>
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
