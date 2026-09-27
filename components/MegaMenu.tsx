"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { titleCaseLabel } from "@/lib/product-display"
import { categoryIcon } from "@/lib/category-icons"

/**
 * Deep category navigation ("NAVIGATION — THIS IS ONE OF THE BIGGEST GAPS").
 *
 * Renders a multi-column panel per category: sub-categories, top brands and
 * price bands. The taxonomy comes from the live `categories`, `sub_categories`
 * and `brands` collections, so new catalogue data appears without a code
 * change. Price bands are static because they are merchandising decisions.
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

const STATIC_LINKS = [
  { href: "/brands", label: "Brands" },
  { href: "/offers", label: "Offers", accent: true },
  { href: "/products?sort=newest", label: "New Arrivals" },
  { href: "/store-locator", label: "Store Locator" },
  { href: "/business-enquiries", label: "Business Enquiries" },
  { href: "/about", label: "About SARA" },
]

function priceBandHref(categoryName: string, band: (typeof PRICE_BANDS)[number]): string {
  // `category` filters on the real taxonomy; `q` is free text and matches nothing here.
  const params = new URLSearchParams({ category: categoryName })
  if ("min" in band && band.min !== undefined) params.set("minPrice", String(band.min))
  if ("max" in band && band.max !== undefined) params.set("maxPrice", String(band.max))
  return `/products?${params.toString()}`
}

/** Sub-category documents reference their parent under several key names. */
function parentKeyOf(subCategory: SubCategory): string {
  return String(
    subCategory.categoryId || subCategory.category || subCategory.parentCategory || "",
  ).toLowerCase()
}

export default function MegaMenu() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const [categoryRes, subCategoryRes, brandRes] = await Promise.allSettled([
        fetch("/api/categories"),
        fetch("/api/sub-categories"),
        fetch("/api/brands"),
      ])

      if (cancelled) return

      if (categoryRes.status === "fulfilled" && categoryRes.value.ok) {
        const data = await categoryRes.value.json().catch(() => [])
        if (Array.isArray(data)) {
          setCategories(
            data
              .filter((c: Category) => c.isEnabled !== false && !/^test\d*$/i.test(String(c.name || "").trim()))
              .slice(0, 12),
          )
        }
      }

      if (subCategoryRes.status === "fulfilled" && subCategoryRes.value.ok) {
        const data = await subCategoryRes.value.json().catch(() => [])
        if (Array.isArray(data)) setSubCategories(data)
      }

      if (brandRes.status === "fulfilled" && brandRes.value.ok) {
        const data = await brandRes.value.json().catch(() => [])
        const list = Array.isArray(data) ? data : data?.brands
        if (Array.isArray(list)) {
          setBrands(list.filter((b: Brand) => b.enabled !== false).slice(0, 40))
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

  // A short close delay keeps the panel open while the pointer crosses the gap
  // between the trigger and the panel.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenCategoryId(null), 150)
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
      if (event.key === "Escape") setOpenCategoryId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="relative hidden border-t border-gray-200 bg-white lg:block">
      <div className="section-container">
        <nav aria-label="Product categories">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {categories.map((category) => {
              const isOpen = openCategoryId === category.id
              const children = subCategoriesFor(category)
              const Icon = categoryIcon(category.name)

              return (
                <li
                  key={category.id}
                  className="static"
                  onMouseEnter={() => {
                    cancelClose()
                    setOpenCategoryId(category.id)
                  }}
                  onMouseLeave={scheduleClose}
                >
                  <Link
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    className={`flex items-center gap-1 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
                      isOpen ? "text-brand-primary" : "text-gray-700 hover:text-brand-primary"
                    }`}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onFocus={() => setOpenCategoryId(category.id)}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.7} />
                    {titleCaseLabel(category.name)}
                  </Link>

                  {isOpen && (
                    <div
                      className="absolute left-0 right-0 top-full z-50 border-t border-gray-200 bg-white shadow-xl"
                      onMouseEnter={cancelClose}
                      onMouseLeave={scheduleClose}
                    >
                      <div className="section-container grid grid-cols-1 gap-8 py-6 md:grid-cols-3">
                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Shop {titleCaseLabel(category.name)}
                          </p>
                          {children.length > 0 ? (
                            <ul className="space-y-1.5">
                              {children.slice(0, 10).map((subCategory) => (
                                <li key={subCategory.id}>
                                  <Link
                                    href={`/sub-category/${subCategory.slug || encodeURIComponent(subCategory.name)}`}
                                    className="text-sm text-gray-700 hover:text-brand-primary hover:underline"
                                  >
                                    {subCategory.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Link
                              href={`/products?category=${encodeURIComponent(category.name)}`}
                              className="text-sm text-gray-700 hover:text-brand-primary hover:underline"
                            >
                              Browse all {titleCaseLabel(category.name)}
                            </Link>
                          )}
                        </div>

                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Shop by price
                          </p>
                          <ul className="space-y-1.5">
                            {PRICE_BANDS.map((band) => (
                              <li key={band.label}>
                                <Link
                                  href={priceBandHref(category.name, band)}
                                  className="text-sm text-gray-700 hover:text-brand-primary hover:underline"
                                >
                                  {band.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Top brands
                          </p>
                          {brands.length > 0 ? (
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                              {brands.slice(0, 12).map((brand) => (
                                <li key={brand.id}>
                                  <Link
                                    href={`/brands/${brand.slug || encodeURIComponent(brand.name)}`}
                                    className="text-sm text-gray-700 hover:text-brand-primary hover:underline"
                                  >
                                    {brand.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Link
                              href="/brands"
                              className="text-sm text-gray-700 hover:text-brand-primary hover:underline"
                            >
                              Browse all brands
                            </Link>
                          )}

                          <Link
                            href={`/products?category=${encodeURIComponent(category.name)}`}
                            className="mt-4 inline-block text-sm font-semibold text-brand-primary hover:underline"
                          >
                            View all {titleCaseLabel(category.name)} →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}

            <li className="ml-auto flex items-center gap-0.5">
              {STATIC_LINKS.map(({ href, label, accent }) => (
                <Link
                  key={href}
                  href={href}
                  className={`whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${
                    accent
                      ? "font-semibold text-brand-accent hover:underline"
                      : "font-medium text-gray-700 hover:text-brand-primary"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/offers"
                className="ml-2 whitespace-nowrap rounded-full bg-[#E11D2E] px-3.5 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105"
              >
                SARA Super Sunday
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
