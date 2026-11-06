"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Gift, Plus, Sparkles, X } from "lucide-react"
import SiteImage from "@/components/SiteImage"
import { track, toAnalyticsItem } from "@/lib/analytics"
import type { PromotionBenefit, PromotionProduct } from "@/lib/storefront-promotion-types"
import { useStorefrontPromotions } from "@/hooks/useStorefrontPromotions"
import { formatGiftExpiryDate, giftTermsHref, shortGiftName } from "@/lib/product-promotion-display"
import MetalCoin from "@/components/promotions/MetalCoin"
import ProductGiftCelebration from "@/components/promotions/ProductGiftCelebration"

function measure(event: "view_promotion" | "select_promotion", product: PromotionProduct, slot: string) {
  for (const benefit of product.benefits) track(event, {
    promotion_id: benefit.id, promotion_name: benefit.name, creative_slot: slot,
    item_id: product.id, items: [toAnalyticsItem(product)],
  })
}

function BenefitTile({ benefit, showExpiry = false, large = false }: { benefit: PromotionBenefit; showExpiry?: boolean; large?: boolean }) {
  return <div className="min-w-0 flex-1 rounded-xl border border-amber-100 bg-white p-2 text-center">
    {benefit.photo ? <SiteImage src={benefit.photo} alt="" width={large ? 104 : 40} height={large ? 104 : 40} className={`mx-auto object-contain ${large ? "h-24 w-24 max-w-full" : "h-10 w-10"}`} />
      : benefit.kind === "diwali" ? <MetalCoin tone={/gold/i.test(benefit.name) ? "gold" : "silver"} className={`mx-auto ${large ? "h-24 w-24 max-w-full" : "h-10 w-10"}`} />
      : <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1560BD]"><Gift className="h-5 w-5" aria-hidden="true" /></div>}
    <p title={benefit.name} className="mt-1 text-xs font-semibold text-gray-900">{benefit.quantity > 1 ? `${benefit.quantity} × ` : ""}{showExpiry ? shortGiftName(benefit.name) : benefit.name}</p>
    {showExpiry && benefit.expiresAt && <p className="mt-1 text-[10px] leading-relaxed text-gray-500">{formatGiftExpiryDate(benefit.expiresAt)}</p>}
  </div>
}

/** One short entrance animation, without looping confetti or invented urgency. */
export function PromotionCombination({ product, showExpiry = false, large = false }: { product: PromotionProduct; showExpiry?: boolean; large?: boolean }) {
  const gifts = product.benefits.filter(benefit => benefit.kind !== "coupon")
  return <div className="sara-offer-combination flex items-start gap-1.5" aria-label={`${product.name}${gifts.map(gift => ` plus ${gift.quantity} ${gift.name}`).join("")}`}>
    <div className="min-w-0 flex-1 rounded-xl border border-gray-100 bg-white p-2 text-center">
      <SiteImage src={product.image || undefined} alt="" width={large ? 112 : 44} height={large ? 112 : 44} className={`mx-auto object-contain ${large ? "h-28 w-28 max-w-full" : "h-11 w-11"}`} />
      <p className="mt-1 text-xs font-semibold text-gray-900">Your product</p>
    </div>
    {gifts.slice(0, 3).map(benefit => <div key={benefit.id} className="contents"><Plus className="mt-5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" /><BenefitTile benefit={benefit} showExpiry={showExpiry} large={large} /></div>)}
    <style>{`
      .sara-offer-combination { animation: sara-reveal-gifts 650ms ease-out both; }
      @keyframes sara-reveal-gifts { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .sara-offer-combination { animation: none; } }
    `}</style>
  </div>
}

export function PromotionPopup({ products, productPage = false }: { products: PromotionProduct[]; productPage?: boolean }) {
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0)
  const headingId = useId(), panel = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const observed = useRef(new Set<string>())
  const shownProduct = useRef<string | null>(null)
  const productId = products[0]?.id
  const signature = products.map(product => `${product.id}:${product.benefits.map(benefit => `${benefit.id}:${benefit.expiresAt}`).sort().join(",")}`).sort().join("|")
  const storageKey = `sara:offer-preview:v1:${productPage ? "product" : "entry"}:${signature}`
  const current = products[Math.min(index, products.length - 1)]

  function close() {
    if (panel.current?.contains(document.activeElement)) previousFocus.current?.focus({ preventScroll: true })
    setOpen(false)
  }
  useEffect(() => {
    setOpen(false)
    setIndex(0)
    if (!signature) return
    if (productPage && shownProduct.current === productId) return
    if (!productPage) {
      try { if (sessionStorage.getItem(storageKey)) return } catch { /* Session storage may be unavailable. */ }
    }
    let timer: number | undefined
    function invite() {
      // Give the existing privacy choice priority; offers do not need tracking consent.
      if (document.querySelector('[aria-labelledby="consent-banner-title"], [aria-modal="true"]')) { timer = window.setTimeout(invite, 1500); return }
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
      if (productPage) shownProduct.current = productId || null
      else try { sessionStorage.setItem(storageKey, "shown") } catch { /* Functional preview still works. */ }
    }
    timer = window.setTimeout(invite, productPage ? 250 : 1800)
    return () => { window.clearTimeout(timer) }
  }, [signature, storageKey, productPage, productId])
  useEffect(() => {
    if (!open || !current) return
    const key = `${current.id}:${current.benefits.map(benefit => benefit.id).join(",")}`
    if (!observed.current.has(key)) { measure("view_promotion", current, productPage ? "product_popup" : "entry_popup"); observed.current.add(key) }
  }, [open, current, productPage])
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[aria-modal="true"]')) {
        if (panel.current?.contains(document.activeElement)) previousFocus.current?.focus({ preventScroll: true })
        setOpen(false)
      }
    }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [open])

  if (!open || !current) return null
  if (productPage) return <ProductGiftCelebration product={current} onClose={close} restoreFocus={() => previousFocus.current?.focus({ preventScroll: true })}><PromotionCombination product={current} large showExpiry /></ProductGiftCelebration>
  const gifts = current.benefits.filter(benefit => benefit.kind !== "coupon")
  return <aside ref={panel} role="dialog" aria-modal="false" aria-labelledby={headingId}
    className="fixed bottom-3 left-3 right-3 z-40 max-h-[45dvh] overflow-y-auto rounded-2xl border border-amber-200 bg-white p-4 shadow-xl sm:left-auto sm:right-5 sm:w-[420px] sm:max-h-[65dvh]">
    <div className="flex items-start justify-between gap-3">
      <div><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Active offers</p>
        <h2 id={headingId} className="mt-1 text-base font-bold text-gray-900">{gifts.length ? "Your purchase comes with more" : "An offer for your purchase"}</h2></div>
      <button type="button" onClick={close} aria-label="Close offer preview" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
    </div>
    <p className="mb-3 mt-2 text-sm font-semibold text-gray-800">{current.name} · ₹{current.price.toLocaleString("en-IN")}</p>
    <PromotionCombination key={current.id} product={current} />
    {gifts.length > 3 && <p className="mt-2 text-xs text-gray-600">+ {gifts.length - 3} more gifts in the product offer details.</p>}
    {!gifts.length && <p className="mt-2 text-xs text-gray-700">{current.benefits[0].description}</p>}
    <p className="mt-2 text-[11px] leading-relaxed text-gray-600">Eligible for one unit at the current price. Coupons can change gift eligibility. Checkout confirms offers; Diwali gifts require payment confirmation and approval.</p>
    <div className="mt-3 flex items-center justify-between gap-2">
      <Link href={productPage ? "#product-gifts" : current.href} onClick={() => { measure("select_promotion", current, productPage ? "product_popup" : "entry_popup"); close() }}
        className="rounded-lg bg-[#1560BD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D4C99]">{productPage ? "See gifts and conditions" : "View product and gifts"}</Link>
      {products.length > 1 && <div className="flex items-center gap-1 text-xs text-gray-600">
        <button type="button" aria-label="Previous offer product" onClick={() => setIndex(value => (value + products.length - 1) % products.length)} className="rounded p-1.5 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
        <span>{Math.min(index + 1, products.length)}/{products.length}</span>
        <button type="button" aria-label="Next offer product" onClick={() => setIndex(value => (value + 1) % products.length)} className="rounded p-1.5 hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
      </div>}
    </div>
  </aside>
}

export default function ProductPromotions({ productId }: { productId: string }) {
  const { products } = useStorefrontPromotions(productId)
  const product = products[0]
  if (!product) return null
  return <>
    <section id="product-gifts" aria-label="Eligible gifts and offers" className="scroll-mt-20 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Gift className="h-4 w-4 text-amber-700" aria-hidden="true" />Gifts &amp; active offers</h2>
        <Link href={giftTermsHref(product.id)} className="text-xs font-semibold text-[#1560BD] underline">Gift Terms*</Link></div>
      <PromotionCombination product={product} showExpiry />
      {product.benefits.filter(benefit => benefit.kind === "coupon").map(benefit => <p key={benefit.id} className="mt-2 text-xs text-gray-700">{benefit.name}{benefit.code ? ` · ${benefit.code}` : ""}</p>)}
    </section>
    <PromotionPopup products={products.filter(candidate => candidate.benefits.some(benefit => benefit.kind !== "coupon"))} productPage />
  </>
}
