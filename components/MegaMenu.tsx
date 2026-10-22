"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { titleCaseLabel } from "@/lib/product-display"
import { categoryIcon } from "@/lib/category-icons"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { useHeaderPromotion } from "@/hooks/useHeaderPromotion"
import { taxonomyHref, type TaxonomyDivision } from "@/lib/product-taxonomy"
import { fetchTaxonomy } from "@/lib/taxonomy-client"
import { fetchWithCache } from "@/utils/cache"

/**
 * Category navigation row.
 *
 * Tabs are divisions from /api/taxonomy. Until products carry a division the
 * row falls back to the category list, so the header never goes blank.
 * Each item is a link. Hovering does not open a panel.
 */

interface Category {
  id: string
  name: string
  slug?: string
  icon?: string
  isEnabled?: boolean
}

/*
 * Brands, New Arrivals, Business Enquiries and About SARA were removed from
 * this row on request. The pages still exist and are still linked from the
 * footer — only the nav entries are gone.
 */
const STATIC_LINKS = [
  { href: "/offers", label: "Offers", accent: true },
  { href: "/store-locator", label: "Store Locator" },
]

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed: ${url} (${response.status})`)
  return response.json()
}

const listParser = {
  parse: (value: unknown): unknown => (Array.isArray(value) || (value && typeof value === "object") ? value : []),
}

function categoryHref(categoryName: string): string {
  return /^mobiles?$/i.test(categoryName)
    ? "/products?subCategory=Mobile&availability=in"
    : `/products?category=${encodeURIComponent(categoryName)}`
}

export default function MegaMenu() {
  const marketing = useMarketingContent("header")
  const headerPromotion = useHeaderPromotion()
  const links = marketing.items("navigation", STATIC_LINKS.map(item => ({ ...item, title: item.label })))
  const [divisions, setDivisions] = useState<TaxonomyDivision[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    let cancelled = false

    /*
     * Shared with the homepage cache so this row, which remounts on every
     * route, does not fire its own taxonomy request.
     */
    ;(async () => {
      const [taxonomyRes, categoryRes] = await Promise.allSettled([
        fetchTaxonomy(),
        fetchWithCache("categories", () => fetchJson("/api/categories"), listParser),
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
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * Divisions win when the catalogue is classified; otherwise the category
   * tabs stay, so the header never empties out mid-migration.
   */
  const tabs = useMemo(() => {
    if (divisions.length > 0) {
      return divisions.slice(0, 12).map(division => ({
        id: `division:${division.name.toLowerCase()}`,
        name: division.name,
        href: taxonomyHref(division.name),
      }))
    }

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      href: categoryHref(category.name),
    }))
  }, [divisions, categories])

  return (
    <div className="hidden border-t border-gray-200 bg-white lg:block">
      <div className="section-container">
        <nav aria-label="Product categories">
          <ul className="flex items-center gap-1">
            {tabs.map(tab => {
              const Icon = categoryIcon(tab.name)

              return (
                <li key={tab.id}>
                  <Link
                    href={tab.href}
                    className="flex items-center gap-1 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:text-brand-primary"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.7} />
                    {titleCaseLabel(tab.name)}
                  </Link>
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
                      ? "font-semibold text-[#B93C00] hover:text-[#8C2E00]"
                      : "font-medium text-gray-700 hover:text-brand-primary"
                  }`}
                >
                  {title}
                </Link>
              ))}
              {headerPromotion && <Link
                href={headerPromotion.href}
                className="ml-2 whitespace-nowrap rounded-full bg-[#E11D2E] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#C41928]"
              >
                {headerPromotion.title}
              </Link>}
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
