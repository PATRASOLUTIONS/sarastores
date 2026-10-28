"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMarketingContent } from "@/hooks/useMarketingContent"
import { useHeaderPromotion } from "@/hooks/useHeaderPromotion"
import { fetchActiveProductBrands, selectHeaderBrands, type ActiveProductBrand } from "@/lib/active-brand-client"

const STATIC_LINKS = [
  { href: "/offers", label: "Offers", accent: true },
  { href: "/store-locator", label: "Store Locator" },
]

// Show the same featured, in-stock brands as the mobile menu.
export default function MegaMenu() {
  const marketing = useMarketingContent("header")
  const headerPromotion = useHeaderPromotion()
  const links = marketing.items("navigation", STATIC_LINKS.map(item => ({ ...item, title: item.label })))
  const [brands, setBrands] = useState<ActiveProductBrand[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    setLoading(true)
    void fetchActiveProductBrands(attempt > 0).then(data => {
      if (!cancelled) setBrands(selectHeaderBrands(data))
    }).catch(() => {
      if (!cancelled) setError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [attempt])

  return (
    <div className="hidden border-t border-gray-200 bg-white lg:block">
      <div className="section-container flex items-center gap-2">
        <nav aria-label="Product brands" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex w-max items-center gap-1">
            <li>
              <Link href="/products" className="flex whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-brand-primary transition-colors hover:text-brand-primary-hover">All Products</Link>
            </li>
            {brands.map(brand => <li key={brand.name.toLowerCase()}>
              <Link href={`/products?brand=${encodeURIComponent(brand.name)}`}
                className="flex whitespace-nowrap px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:text-brand-primary">
                {brand.name.charAt(0).toUpperCase() + brand.name.slice(1).toLowerCase()}
              </Link>
            </li>)}
            {loading && brands.length === 0 && <li className="px-3 text-xs text-gray-500" role="status">Loading brands…</li>}
            {error && <li className="px-3 text-xs text-gray-500" role="status">Brands unavailable. <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Retry</button></li>}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-0.5">
          {marketing.enabled("navigation") && links.map(({ href, title, accent }) => (
            <Link key={href} href={href}
              className={`whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${accent
                ? "font-semibold text-[#B93C00] hover:text-[#8C2E00]"
                : "font-medium text-gray-700 hover:text-brand-primary"}`}>
              {title}
            </Link>
          ))}
          {headerPromotion && <Link href={headerPromotion.href}
            className="ml-2 whitespace-nowrap rounded-full bg-[#E11D2E] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#C41928]">
            {headerPromotion.title}
          </Link>}
        </div>
      </div>
    </div>
  )
}
