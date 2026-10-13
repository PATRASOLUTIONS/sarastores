"use client"

import Link from "next/link"
import { ArrowRight, CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react"
import { bannerGradient, type SiteBanner } from "@/hooks/useBanners"
import { useMarketingContent } from "@/hooks/useMarketingContent"

export const OFFER_TABS = [
  ["all-offers", "All Offers"], ["festival", "Festival Offers"], ["bank", "Bank Offers"],
  ["exchange", "Exchange Offers"], ["no-cost-emi", "No Cost EMI"], ["bundle", "Bundle Offers"],
  ["brand", "Brand Offers"], ["online", "Online Exclusive"], ["all-products", "All Products"],
] as const
export type OfferTab = typeof OFFER_TABS[number][0]

export function OffersHero({ banner }: { banner?: SiteBanner }) {
  const marketing = useMarketingContent("products")
  if (!marketing.enabled("hero")) return null
  return (
    <section aria-label="Shopping offers" className={`relative overflow-hidden rounded-lg ${banner?.dark ? "text-slate-900" : "text-white"}`}
      style={bannerGradient(banner || { bgFrom: "#0453cc", bgTo: "#003488" })}>
      <div className="relative grid min-h-[200px] items-center gap-5 px-5 py-6 sm:grid-cols-[0.8fr_1.4fr_1fr] sm:px-6 sm:py-4">
        <div className="hidden -rotate-6 text-center sm:block">
          <p className="mx-auto w-fit bg-[#e11d2e] px-4 py-1 text-xl font-black italic text-white">SARA</p>
          <p className="text-3xl font-black italic leading-none lg:text-4xl">{marketing.text("hero", "ribbonTitle")}</p>
          <p className="mx-auto mt-2 w-fit bg-yellow-300 px-2 py-1 text-[10px] font-extrabold uppercase text-[#0f2557]">{marketing.text("hero", "ribbonDetail")}</p>
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold leading-tight lg:text-3xl">{banner?.title || "Amazing Offers On Your Favourite Brands"}</h2>
          <p className="mt-2 text-xs opacity-90 sm:text-sm">{banner?.subtitle || "Discover current catalog savings and available bank offers."}</p>
          <Link href={banner?.ctaLink || "/products"} className="mt-4 inline-flex items-center gap-2 rounded bg-white px-3 py-2 text-xs font-bold text-[#1560bd]">
            {banner?.ctaText || "Explore Products"} <ArrowRight size={14} />
          </Link>
        </div>
        <img src={banner?.image || "/brand-page/hero-products.webp"} alt="" aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-36 w-36 object-contain opacity-20 sm:static sm:h-[170px] sm:w-full sm:opacity-100" />
      </div>
    </section>
  )
}

export function OfferTabs({ selected, onSelect }: { selected: OfferTab; onSelect: (tab: OfferTab) => void }) {
  const marketing = useMarketingContent("products")
  if (!marketing.enabled("tabs")) return null
  return (
    <nav aria-label="Offer categories" className="mt-3 flex w-full min-w-0 overflow-x-auto border-b border-[#e2e8f0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {OFFER_TABS.map(([key, label], index) => (
        <button type="button" key={key} aria-pressed={selected === key} onClick={() => onSelect(key)}
          className={`min-h-11 shrink-0 border-b-2 px-3 text-[11px] font-medium sm:flex-1 sm:px-2 ${selected === key ? "border-[#1560bd] text-[#1560bd]" : "border-transparent text-[#0f2557] hover:bg-blue-50"}`}>
          {marketing.text("tabs", `item${index + 1}Title`, label)}
        </button>
      ))}
    </nav>
  )
}

export function OffersPromotions({ banners, onBank, onExchange }: {
  banners: SiteBanner[]; onBank: () => void; onExchange: () => void
}) {
  const marketing = useMarketingContent("products")
  if (!marketing.enabled("promotions")) return null
  return (
    <section aria-label="Featured promotions" className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map(index => {
        const banner = banners[index]
        return banner ? (
          <article key={banner.id} aria-label={banner.title} className={`relative flex min-h-[108px] items-center overflow-hidden rounded-md ${banner.dark ? "text-[#0f2557]" : "text-white"}`} style={bannerGradient(banner)}>
            <div className="relative z-10 w-[67%] px-3 py-3">
              <h3 className="text-base font-bold leading-tight">{banner.title}</h3>
              {banner.subtitle && <p className="mt-1 text-[11px] font-medium leading-tight">{banner.subtitle}</p>}
              {banner.ctaText && <Link href={banner.ctaLink || "/products"} className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1.5 text-[10px] font-bold text-white" style={{ backgroundColor: banner.accent || "#1560bd" }}>{banner.ctaText}<ArrowRight size={12} /></Link>}
            </div>
            {banner.image && <img src={banner.image} alt="" aria-hidden className="absolute bottom-0 right-0 h-24 w-[40%] object-contain" />}
          </article>
        ) : (
          <article key={index} className={`relative flex min-h-[108px] items-center overflow-hidden rounded-md p-3 ${index === 0 ? "bg-rose-50" : "bg-blue-50"}`}>
            <div className="relative z-10 max-w-[68%]">
              <h3 className="text-base font-bold leading-tight text-[#1560bd]">{marketing.text("promotions", `item${index + 1}Title`)}</h3>
              <p className="mt-1 text-[11px] text-[#0f2557]">{marketing.text("promotions", `item${index + 1}Detail`)}</p>
              {marketing.text("promotions", `item${index + 1}Href`) ? <Link href={marketing.text("promotions", `item${index + 1}Href`)} className="mt-2 inline-flex rounded bg-[#1560bd] px-2 py-1.5 text-[10px] font-bold text-white">{marketing.text("promotions", `item${index + 1}CtaText`)} &rarr;</Link> :
                <button type="button" onClick={index === 1 ? onBank : onExchange} className="mt-2 rounded bg-[#1560bd] px-2 py-1.5 text-[10px] font-bold text-white">{marketing.text("promotions", `item${index + 1}CtaText`)} &rarr;</button>}
            </div>
            <img src={marketing.text("promotions", `item${index + 1}Image`)} alt="" aria-hidden className="absolute bottom-0 right-0 h-24 w-[37%] object-contain" />
          </article>
        )
      })}
    </section>
  )
}

export function OffersTrustStrip() {
  const marketing = useMarketingContent("products")
  const services = marketing.items("services", [
    { icon: ShieldCheck, title: "Genuine Products", detail: "Manufacturer warranty terms", href: "/warranty" },
    { icon: CreditCard, title: "EMI Options", detail: "Check bank eligibility", href: "/emi" },
    { icon: Headphones, title: "Upgrade Assistance", detail: "Talk to our team", href: "/contact" },
    { icon: Truck, title: "Delivery Options", detail: "Charges confirmed at checkout", href: "/shipping-policy" },
  ])
  if (!marketing.enabled("services")) return null
  return <section aria-label="Shopping services" className="mt-7 border-y border-[#e6eef8] bg-[#f7faff]">
    <div className="section-container grid grid-cols-2 gap-y-4 py-5 lg:grid-cols-4">
      {services.map(({ icon: Icon, title, detail, href }) => <Link key={title} href={href} className="flex items-center gap-3 px-2 lg:border-r lg:border-[#e0eaf6] lg:last:border-0">
        <Icon className="h-8 w-8 shrink-0 text-[#1560bd]" strokeWidth={1.7} />
        <div><p className="text-xs font-bold text-[#0f2557]">{title}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p></div>
      </Link>)}
    </div>
  </section>
}
