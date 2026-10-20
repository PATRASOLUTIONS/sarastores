"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { titleCaseLabel } from "@/lib/product-display"
import { categoryIcon, type CategoryIcon } from "@/lib/category-icons"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { taxonomyHref, type TaxonomyDivision } from "@/lib/product-taxonomy"
import { taxonomyImage } from "@/lib/taxonomy-images"
import { fetchTaxonomy } from "@/lib/taxonomy-client"
import { fetchWithCache } from "@/utils/cache"

/**
 * Deep category navigation.
 *
 * The panel renders the merchandising hierarchy: the tab is a **division**,
 * each column heading is a **sub-category**, and the links beneath are
 * **segments** — "Accessories" → "Mobile Accessories" → "Chargers & Adapters".
 * A brands column closes the row. That tree comes from /api/taxonomy, which
 * derives it from the products themselves, so classifying stock is all it
 * takes for the menu to follow.
 *
 * Until products carry a division the tree is empty, and a blank header would
 * be worse than the old one, so the component falls back to the previous
 * `categories` / `sub_categories` menu whenever the taxonomy has nothing to
 * show. Both paths are live code: the fallback is what renders on a catalogue
 * that has not been classified yet.
 */

interface Category {
  id: string
  name: string
  slug?: string
  icon?: string
  isEnabled?: boolean
}

interface SubCategory {
  id: string
  name: string
  slug?: string
  category?: string
  categoryId?: string
  parentCategory?: string
}

interface Brand {
  id: string
  name: string
  slug?: string
  enabled?: boolean
}

const PRICE_BANDS = [
  { label: "Under ₹10,000", max: 10000 },
  { label: "₹10,000 – ₹25,000", min: 10000, max: 25000 },
  { label: "₹25,000 – ₹50,000", min: 25000, max: 50000 },
  { label: "₹50,000 – ₹1,00,000", min: 50000, max: 100000 },
  { label: "₹1,00,000 & above", min: 100000 },
] as const

/*
 * Brands, New Arrivals, Business Enquiries and About SARA were removed from
 * this row on request. The pages still exist and are still linked from the
 * footer and from the brands column of the mega-menu — only the nav entries
 * are gone, so none of them became unreachable.
 */
const STATIC_LINKS = [
  { href: "/offers", label: "Offers", accent: true },
  { href: "/store-locator", label: "Store Locator" },
]

/**
 * Segments listed under one sub-category before it defers to a "more" link.
 *
 * The blocks flow through shared columns, so one sub-category with forty
 * segments would otherwise push every sub-category after it out of sight.
 */
const MAX_SEGMENTS_PER_SUBCATEGORY = 8

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed: ${url} (${response.status})`)
  return response.json()
}

/**
 * Permissive cache parser for the three catalogue lists.
 *
 * Each is filtered field by field below, so the parser only has to guarantee
 * that a malformed response does not poison the cache with something the
 * filters would throw on. An empty array is a safe thing to cache briefly:
 * the menu falls back to its division tabs, which come from elsewhere.
 */
const listParser = {
  parse: (value: unknown): unknown => (Array.isArray(value) || (value && typeof value === "object") ? value : []),
}

function priceBandHref(categoryName: string, band: (typeof PRICE_BANDS)[number]): string {
  // `category` filters on the real taxonomy; `q` is free text and matches nothing here.
  const params = new URLSearchParams({ category: categoryName })
  if ("min" in band && band.min !== undefined) params.set("minPrice", String(band.min))
  if ("max" in band && band.max !== undefined) params.set("maxPrice", String(band.max))
  return `/products?${params.toString()}`
}

function categoryHref(categoryName: string): string {
  return /^mobiles?$/i.test(categoryName)
    ? "/products?subCategory=Mobile&availability=in"
    : `/products?category=${encodeURIComponent(categoryName)}`
}

/** Sub-category documents reference their parent under several key names. */
function parentKeyOf(subCategory: SubCategory): string {
  return String(
    subCategory.categoryId || subCategory.category || subCategory.parentCategory || "",
  ).toLowerCase()
}

const panelLinkClass = "text-sm text-gray-600 hover:text-brand-primary hover:underline"
const panelHeadingClass = "mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"

/**
 * A column heading with its icon.
 *
 * `href` is optional because the brands column heads a list of links rather
 * than naming a destination of its own.
 */
function PanelHeading({ icon: Icon, label, href }: { icon: CategoryIcon; label: string; href?: string }) {
  return (
    <p className={panelHeadingClass}>
      <Icon className="h-4 w-4 shrink-0 text-gray-700" strokeWidth={1.7} />
      {href ? (
        <Link href={href} className="hover:text-brand-primary hover:underline">
          {label}
        </Link>
      ) : (
        label
      )}
    </p>
  )
}

function BrandColumn({ brands }: { brands: Brand[] }) {
  return (
    <div>
      <PanelHeading icon={Star} label="Top Brands" />
      {brands.length > 0 ? (
        // Two columns rather than one tall list: a single column of eighteen
        // brands set the height of the whole panel on its own.
        <ul className="columns-2 gap-4 space-y-1.5">
          {brands.slice(0, 18).map(brand => (
            // Keyed on the name: the feed carries entries whose `id` is absent
            // or shared, and the list is deduplicated by name on arrival.
            <li key={brand.name} className="break-inside-avoid">
              <Link href={`/brands/${brand.slug || encodeURIComponent(brand.name)}`} className={panelLinkClass}>
                {brand.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/brands" className={panelLinkClass}>
          Browse all brands
        </Link>
      )}
      <Link href="/brands" className="mt-3 inline-block text-sm font-semibold text-brand-primary hover:underline">
        View All Brands →
      </Link>
    </div>
  )
}

/**
 * The division's own card, at the head of the panel.
 *
 * It is deliberately generated from the division rather than from a CMS slot:
 * a hand-authored card per division would leave every newly classified aisle
 * with a blank space until somebody filled it in.
 */
function DivisionCard({ division }: { division: TaxonomyDivision }) {
  const Icon = categoryIcon(division.name)
  const photo = taxonomyImage(division.name)

  return (
    <Link
      href={taxonomyHref(division.name)}
      className="group flex w-44 shrink-0 flex-col rounded-lg bg-gradient-to-b from-gray-50 to-gray-100 p-4 transition-colors hover:from-blue-50 hover:to-blue-100"
    >
      {photo ? (
        // A served-from-disk copy of catalogue imagery, so it cannot be blocked
        // cross-origin the way several of the vendor CDNs here are. The icon
        // stays as the fallback for a division the fetch script has not covered.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          loading="lazy"
          // Grows into the card, which stretches to the height of the panel
          // beside it. At a fixed height a tall division left most of the card
          // empty below a postage-stamp picture.
          className="min-h-24 w-full flex-1 rounded-md bg-white object-contain p-1"
          onError={event => {
            event.currentTarget.style.display = "none"
          }}
        />
      ) : (
        <Icon className="h-9 w-9 text-brand-primary" strokeWidth={1.3} />
      )}
      <p className="mt-3 text-base font-bold leading-tight text-gray-900">{titleCaseLabel(division.name)}</p>
      <p className="mt-1 text-xs text-gray-500">
        {division.count} {division.count === 1 ? "product" : "products"}
      </p>
      {/* mt-auto, not justify-between: the card stretches to the tallest
          column, and spreading three items over that height leaves the name
          marooned in the middle of an empty panel. */}
      <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white">
        Shop {titleCaseLabel(division.name)}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

/**
 * Division panel: every sub-category with its segments, flowed into columns.
 *
 * CSS columns rather than a grid, because a grid gives each sub-category a
 * column of its own and the panel then stands as tall as the longest one while
 * the short ones leave dead space — and only five fit, so a division with
 * nineteen hid fourteen of them behind a "more" link. Flowing the blocks means
 * a finished sub-category is followed by the next one in the same column, so
 * the height is the total content divided by the column count and every
 * sub-category is reachable. `break-inside-avoid` keeps a heading attached to
 * its own segments across a column boundary.
 */
function DivisionPanel({ division, brands }: { division: TaxonomyDivision; brands: Brand[] }) {
  return (
    <div className="section-container flex gap-5 py-5">
      <DivisionCard division={division} />

      {/*
        The blocks carry no horizontal padding of their own. `first:` matches
        the first element in the DOM, not the first of each column, so padding
        "the rest" indented every block that happened to land at the top of a
        column. The column gap and rule already separate them.
      */}
      <div className="min-w-0 flex-1 columns-2 gap-5 md:columns-3 lg:columns-4 [column-rule:1px_solid_#e5e7eb]">
        {division.subCategories.map(subCategory => (
          <div key={subCategory.name} className="mb-5 break-inside-avoid">
            <PanelHeading
              icon={categoryIcon(subCategory.name)}
              label={titleCaseLabel(subCategory.name)}
              href={taxonomyHref(division.name, subCategory.name)}
            />
            {subCategory.segments.length > 0 ? (
              <ul className="space-y-1.5">
                {subCategory.segments.slice(0, MAX_SEGMENTS_PER_SUBCATEGORY).map(segment => (
                  <li key={segment.name}>
                    <Link
                      href={taxonomyHref(division.name, subCategory.name, segment.name)}
                      className={panelLinkClass}
                    >
                      {titleCaseLabel(segment.name)}
                    </Link>
                  </li>
                ))}
                {subCategory.segments.length > MAX_SEGMENTS_PER_SUBCATEGORY && (
                  <li>
                    <Link
                      href={taxonomyHref(division.name, subCategory.name)}
                      className="text-sm font-semibold text-brand-primary hover:underline"
                    >
                      More →
                    </Link>
                  </li>
                )}
              </ul>
            ) : (
              // A sub-category nobody has split into segments yet still needs a way in.
              <Link href={taxonomyHref(division.name, subCategory.name)} className={panelLinkClass}>
                Browse all
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="w-56 shrink-0 border-l border-gray-200 pl-5">
        <BrandColumn brands={brands} />
      </div>
    </div>
  )
}

/** Pre-taxonomy panel, used while no product carries a division. */
function LegacyCategoryPanel({
  category,
  subCategories,
  brands,
}: {
  category: Category
  subCategories: SubCategory[]
  brands: Brand[]
}) {
  return (
    <div className="section-container grid grid-cols-1 gap-8 py-6 md:grid-cols-3">
      <div>
        <PanelHeading
          icon={categoryIcon(category.name)}
          label={`Shop ${titleCaseLabel(category.name)}`}
          href={categoryHref(category.name)}
        />
        {subCategories.length > 0 ? (
          <ul className="space-y-1.5">
            {subCategories.slice(0, 10).map(subCategory => (
              <li key={subCategory.id}>
                <Link
                  href={`/sub-category/${subCategory.slug || encodeURIComponent(subCategory.name)}`}
                  className={panelLinkClass}
                >
                  {subCategory.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link href={categoryHref(category.name)} className={panelLinkClass}>
            Browse all {titleCaseLabel(category.name)}
          </Link>
        )}
      </div>

      <div>
        <p className={panelHeadingClass}>Shop by price</p>
        <ul className="space-y-1.5">
          {PRICE_BANDS.map(band => (
            <li key={band.label}>
              <Link href={priceBandHref(category.name, band)} className={panelLinkClass}>
                {band.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <BrandColumn brands={brands} />
        <Link
          href={categoryHref(category.name)}
          className="mt-4 inline-block text-sm font-semibold text-brand-primary hover:underline"
        >
          View all {titleCaseLabel(category.name)} →
        </Link>
      </div>
    </div>
  )
}

export default function MegaMenu() {
  const marketing = useMarketingContent("header")
  const links = marketing.items("navigation", STATIC_LINKS.map(item => ({ ...item, title: item.label })))
  const [divisions, setDivisions] = useState<TaxonomyDivision[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [openTabId, setOpenTabId] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    /*
     * Everything here goes through the shared cache. This menu is mounted on
     * every route and remounts freely, and each mount used to issue its own
     * four requests — seventeen copies of the taxonomy aggregation for one
     * homepage view. The cache keys are the same ones the homepage uses, so
     * the two share a single response instead of asking twice.
     */
    ;(async () => {
      const [taxonomyRes, categoryRes, subCategoryRes, brandRes] = await Promise.allSettled([
        fetchTaxonomy(),
        fetchWithCache("categories", () => fetchJson("/api/categories"), listParser),
        fetchWithCache("sub-categories", () => fetchJson("/api/sub-categories"), listParser),
        fetchWithCache("brands", () => fetchJson("/api/brands"), listParser),
      ])

      if (cancelled) return

      if (taxonomyRes.status === "fulfilled") {
        setDivisions(taxonomyRes.value)
      }

      if (categoryRes.status === "fulfilled") {
        const data = categoryRes.value
        if (Array.isArray(data)) {
          const visibleCategories = data.filter(
            (c: Category) =>
              c.isEnabled !== false &&
              !/^test\d*$/i.test(String(c.name || "").trim()) &&
              !/^small appliance$/i.test(String(c.name || "").trim()) &&
              !/^mobiles?$/i.test(String(c.name || "").trim()),
          )
          setCategories([{ id: "Mobile", name: "Mobiles" }, ...visibleCategories].slice(0, 12))
        }
      }

      if (subCategoryRes.status === "fulfilled") {
        const data = subCategoryRes.value
        if (Array.isArray(data)) setSubCategories(data as SubCategory[])
      }

      if (brandRes.status === "fulfilled") {
        const data = brandRes.value
        const list = Array.isArray(data) ? data : (data as { brands?: unknown })?.brands
        if (Array.isArray(list)) {
          // The feed is assembled from several sources and repeats a brand
          // under more than one id, which showed up as a duplicate key and
          // would have listed the same brand twice in the panel.
          const seen = new Set<string>()
          const unique = list.filter((brand: Brand) => {
            const name = String(brand?.name || "").trim()
            if (!name || brand.enabled === false) return false
            const key = name.toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setBrands(unique.slice(0, 40))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const subCategoriesByCategory = useMemo(() => {
    const map = new Map<string, SubCategory[]>()
    for (const subCategory of subCategories) {
      const key = parentKeyOf(subCategory)
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) bucket.push(subCategory)
      else map.set(key, [subCategory])
    }
    return map
  }, [subCategories])

  const subCategoriesFor = (category: Category): SubCategory[] =>
    subCategoriesByCategory.get(category.id.toLowerCase()) ??
    subCategoriesByCategory.get(category.name.toLowerCase()) ??
    []

  /*
   * One tab list from whichever source has data. Divisions win when the
   * catalogue is classified; otherwise the existing category tabs stay, so the
   * header never empties out mid-migration.
   */
  const tabs = useMemo(() => {
    if (divisions.length > 0) {
      return divisions.slice(0, 12).map(division => ({
        id: `division:${division.name.toLowerCase()}`,
        name: division.name,
        href: taxonomyHref(division.name),
        division,
        category: null as Category | null,
      }))
    }

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      href: categoryHref(category.name),
      division: null as TaxonomyDivision | null,
      category,
    }))
  }, [divisions, categories])

  // A short close delay keeps the panel open while the pointer crosses the gap
  // between the trigger and the panel.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenTabId(null), 150)
  }

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  useEffect(() => () => cancelClose(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenTabId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="relative hidden border-t border-gray-200 bg-white lg:block">
      <div className="section-container">
        <nav aria-label="Product categories">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const isOpen = openTabId === tab.id
              const Icon = categoryIcon(tab.name)

              return (
                <li
                  key={tab.id}
                  className="static"
                  onMouseEnter={() => {
                    cancelClose()
                    setOpenTabId(tab.id)
                  }}
                  onMouseLeave={scheduleClose}
                >
                  <Link
                    href={tab.href}
                    className={`flex items-center gap-1 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
                      isOpen ? "text-brand-primary" : "text-gray-700 hover:text-brand-primary"
                    }`}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onFocus={() => setOpenTabId(tab.id)}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.7} />
                    {titleCaseLabel(tab.name)}
                  </Link>

                  {isOpen && (
                    <div
                      // Capped and scrollable: the columns bound the height for
                      // a normal division, but a catalogue with a hundred
                      // sub-categories must not run off the bottom of the
                      // screen with no way to reach the end.
                      className="absolute left-0 right-0 top-full z-50 max-h-[78vh] overflow-y-auto border-t border-gray-200 bg-white shadow-xl"
                      onMouseEnter={cancelClose}
                      onMouseLeave={scheduleClose}
                    >
                      {tab.division ? (
                        <DivisionPanel division={tab.division} brands={brands} />
                      ) : (
                        tab.category && (
                          <LegacyCategoryPanel
                            category={tab.category}
                            subCategories={subCategoriesFor(tab.category)}
                            brands={brands}
                          />
                        )
                      )}
                    </div>
                  )}
                </li>
              )
            })}

            <li className="ml-auto flex items-center gap-0.5">
              {marketing.enabled("navigation") && links.map(({ href, title, accent }) => (
                <Link
                  key={href}
                  href={href}
                  className={`whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${
                    accent
                      ? "font-semibold text-[#B93C00] hover:underline"
                      : "font-medium text-gray-700 hover:text-brand-primary"
                  }`}
                >
                  {title}
                </Link>
              ))}
              {marketing.enabled("promotion") && <Link
                href={marketing.text("promotion", "ctaLink")}
                className="ml-2 whitespace-nowrap rounded-full bg-[#E11D2E] px-3.5 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105"
              >
                {marketing.text("promotion", "title")}
              </Link>}
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
