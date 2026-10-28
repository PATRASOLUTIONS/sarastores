"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, Gift, Headphones, Home, Info, LayoutGrid, MapPin, Tags } from "lucide-react"
import CategoryGlyph from "@/components/CategoryGlyph"
import { fetchActiveProductBrands, selectHeaderBrands, type ActiveProductBrand } from "@/lib/active-brand-client"

type MenuLink = { href: string; label: string }
type CategoryLink = MenuLink & { id: string }
const EXCLUSIVE_LINKS: MenuLink[] = [
  { href: "/offers", label: "Offers & Deals" },
  { href: "/emi", label: "Easy EMI Options" },
  { href: "/software", label: "Software & Subscriptions" },
]
const SUPPORT_LINKS: MenuLink[] = [
  { href: "/contact", label: "Contact Us" },
  { href: "/faq", label: "Frequently Asked Questions" },
  { href: "/track", label: "Track Order" },
  { href: "/shipping-policy", label: "Shipping & Delivery" },
  { href: "/warranty", label: "Warranty & Service" },
  { href: "/cancellation-policy", label: "Cancellation & Returns" },
]
const rowClass = "flex min-h-[56px] items-center gap-3 px-3 py-4 text-sm font-semibold text-white hover:bg-white/5 rounded-lg transition-colors"
const childClass = "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"

function MenuSection({ label, icon, children, onToggle }: { label: string; icon: ReactNode; children: ReactNode; onToggle?: (open: boolean) => void }) {
  return <details name="sara-mobile-menu" className="group border-b border-white/10" onToggle={event => onToggle?.(event.currentTarget.open)}>
    <summary className={`${rowClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
      <span className="text-white/60" aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronDown className="h-4 w-4 text-white/60 transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="pb-3 pl-8 pr-2">{children}</div>
  </details>
}

export default function MobileMenuNavigation({ categories, onNavigate }: { categories: CategoryLink[]; onNavigate: () => void }) {
  const [brandsOpen, setBrandsOpen] = useState(false)
  const [brands, setBrands] = useState<ActiveProductBrand[]>([])
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [brandsError, setBrandsError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!brandsOpen) return
    let cancelled = false
    setBrandsLoading(true)
    setBrandsError("")
    void fetchActiveProductBrands(attempt > 0)
      .then(data => {
        if (cancelled) return
        setBrands(selectHeaderBrands(data))
        setBrandsLoading(false)
      }).catch(error => {
        if (cancelled) return
        setBrandsError(error instanceof Error ? error.message : "Brands could not be loaded.")
        setBrandsLoading(false)
      })
    return () => { cancelled = true }
  }, [brandsOpen, attempt])

  const links = (items: MenuLink[]) => items.map(item => <Link key={item.href} href={item.href} className={childClass} onClick={onNavigate}>{item.label}</Link>)
  return <div aria-label="Shopping and information">
    <Link href="/" onClick={onNavigate} className={`${rowClass} border-b border-white/10`}><Home className="h-5 w-5 text-white/60" aria-hidden="true" /><span className="flex-1">Home</span></Link>
    <MenuSection label="Shop by Category" icon={<LayoutGrid className="h-5 w-5" />}>
      <Link href="/products" onClick={onNavigate} className={`${childClass} font-semibold text-white`}>All Products</Link>
      {categories.map(category => <Link key={category.id} href={category.href} onClick={onNavigate} className={childClass}>
        <CategoryGlyph label={category.label} className="h-5 w-5 flex-shrink-0" strokeWidth={1.7} /><span>{category.label}</span>
      </Link>)}
    </MenuSection>
    <MenuSection label="Shop by Brand" icon={<Tags className="h-5 w-5" />} onToggle={setBrandsOpen}>
      {brandsLoading && <p role="status" className="px-3 py-2 text-xs text-white/60">Loading brands…</p>}
      {brandsError && <p role="alert" className="px-3 py-2 text-xs text-white/70">Could not load brands. <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">Retry</button></p>}
      {!brandsLoading && !brandsError && brands.map(brand => <Link key={brand.name}
        href={`/products?brand=${encodeURIComponent(brand.name)}`}
        onClick={onNavigate} className={childClass}>{brand.name.charAt(0).toUpperCase() + brand.name.slice(1).toLowerCase()}</Link>)}
    </MenuSection>
    <MenuSection label="Exclusive at Sara" icon={<Gift className="h-5 w-5" />}>{links(EXCLUSIVE_LINKS)}</MenuSection>
    <MenuSection label="Help & Support" icon={<Headphones className="h-5 w-5" />}>{links(SUPPORT_LINKS)}</MenuSection>
    {[
      { href: "/about", label: "About", icon: Info },
      { href: "/store-locator", label: "Store Locator", icon: MapPin },
    ].map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onNavigate} className={`${rowClass} border-b border-white/10`}>
      <Icon className="h-5 w-5 text-white/60" aria-hidden="true" /><span className="flex-1">{label}</span><ChevronRight className="h-4 w-4 text-white/60" aria-hidden="true" />
    </Link>)}
  </div>
}
