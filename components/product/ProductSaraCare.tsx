"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronRight, ShieldCheck } from "lucide-react"
import Link from "next/link"
import SaraCarePlanPicker from "@/components/cart/SaraCarePlanPicker"
import { apiFetchJson } from "@/lib/api-client"
import { cartLineKey } from "@/lib/cart-line"
import { useCart } from "@/hooks/useCart"
import { isSaraCare, formatSaraCarePrice, SaraCareQuoteResponseSchema, type SaraCareOffer, type SaraCareYears } from "@/lib/sara-care-types"

const money = formatSaraCarePrice

export function useProductSaraCare({ productId, selection, onSelect }: {
  productId: string; selection: SaraCareYears | null | undefined;
  onSelect: (years: SaraCareYears | null) => void;
}) {
  const [offer, setOffer] = useState<SaraCareOffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [quotedProductId, setQuotedProductId] = useState("")
  const { cart, setSaraCareDuration, saraCareLoading } = useCart()
  const parentKey = cartLineKey({ id: productId, color: null, size: null })
  const parent = cart.find(item => !isSaraCare(item) && cartLineKey(item) === parentKey)
  const cartSelection = parent?.saraCareSelection
  useEffect(() => { if (cartSelection !== undefined) onSelect(cartSelection) }, [cartSelection, onSelect])
  useEffect(() => {
    if (!productId) return
    const controller = new AbortController()
    setLoading(true); setError(""); setOffer(null)
    void apiFetchJson("/api/sara-care/quote", { method: "POST", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(process.env.NODE_ENV === "development" ? 60000 : 30000)]),
      json: { items: [{ id: productId, quantity: 1, color: null, size: null, saraCareSelection: null }] } }, value => SaraCareQuoteResponseSchema.parse(value))
      .then(value => { if (!controller.signal.aborted) {
        setOffer(value.offers.find(item => item.parentLineKey === parentKey) || null)
        setQuotedProductId(productId)
      } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Care plans could not be loaded. Please retry.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [productId, parentKey, attempt])
  const currentOffer = quotedProductId === productId ? offer : null
  const pending = loading || (quotedProductId !== productId && !error)
  const selected: SaraCareYears | null = error || (!pending && !currentOffer) ? null : cartSelection !== undefined ? cartSelection : selection !== undefined ? selection : currentOffer?.defaultYears || 1
  const selectedPlan = currentOffer?.options.find(option => option.years === selected)
  useEffect(() => {
    if (!pending && !error && selection === undefined && cartSelection === undefined) onSelect(currentOffer?.defaultYears ?? null)
  }, [pending, error, selection, cartSelection, currentOffer, onSelect])
  useEffect(() => {
    if (!pending && !error && currentOffer && selected !== null && !selectedPlan) {
      onSelect(currentOffer.defaultYears)
      if (parent) setSaraCareDuration(parentKey, currentOffer.defaultYears)
    }
  }, [pending, error, currentOffer, selected, selectedPlan, onSelect, parent, parentKey, setSaraCareDuration])
  const select = useCallback((years: SaraCareYears | null) => {
    onSelect(years)
    if (parent) setSaraCareDuration(parentKey, years)
  }, [onSelect, parent, parentKey, setSaraCareDuration])
  return { offer: currentOffer, loading: pending, error, retry: () => setAttempt(value => value + 1),
    selected, selectedPlan, select, saraCareLoading, parent }
}

export type ProductSaraCareState = ReturnType<typeof useProductSaraCare>

export default function ProductSaraCare({ productName, care, compact = false, disabled = false }: {
  productName: string; care: ProductSaraCareState; compact?: boolean; disabled?: boolean;
}) {
  const { offer, loading, selected, selectedPlan, select, saraCareLoading, parent } = care
  const [lastYears, setLastYears] = useState<SaraCareYears>(selected ?? offer?.defaultYears ?? 1)
  useEffect(() => { if (selected !== null) setLastYears(selected) }, [selected])
  if (!offer) return null
  const locked = disabled || loading || saraCareLoading
  const rememberedYears = offer.options.some(plan => plan.years === lastYears) ? lastYears : offer.defaultYears
  const selectedBase = selectedPlan ? Math.round(selectedPlan.price / (1 + (offer.taxRate || 18) / 100)) : 0
  const coveredQuantity = parent?.quantity || 1
  return <section aria-label={`Sara Care for ${productName}`} className={`w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-900 ${selected === null ? "p-2" : "p-3"}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#1560BD]"><ShieldCheck size={19} strokeWidth={1.7} /></span>
        <div><h3 className="text-sm font-semibold tracking-tight">Sara Care</h3><Link href="/sara-care#coverage-terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-0.5 rounded text-[11px] font-medium text-[#1560BD] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1560BD]">Coverage terms<ChevronRight size={12} aria-hidden="true" /></Link></div>
      </div>
      <label className="relative inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-end gap-2">
        <span className="sr-only">Add Sara Care for {productName}</span>
        <input type="checkbox" checked={selected !== null} disabled={locked} onChange={event => select(event.target.checked ? rememberedYears : null)} className="peer sr-only" />
        <span aria-hidden="true" className="relative h-6 w-10 rounded-full bg-[#d2d2d7] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#1560BD] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#1560BD] peer-disabled:opacity-50" />
      </label>
    </div>
    {selected !== null && <div className="mt-2"><SaraCarePlanPicker options={offer.options} value={selected} onChange={select} disabled={locked} label={`Sara Care duration for ${productName}`} /></div>}
    <span role="status" className="sr-only">{saraCareLoading ? "Updating your plan..." : ""}</span>
    {!compact && selected !== null && <details className="mt-2 border-t border-gray-200 pt-2"><summary className="cursor-pointer text-xs font-semibold text-[#1560BD]">Plan details and coverage</summary><div className="mt-2 space-y-2">
      <p className="text-xs leading-5 text-[#6b7280]">Optional protection for {productName}. Your plan appears as a separate item in the cart, and you can change or remove it before payment.</p>
      {offer.pricingMode !== "value" && offer.basisAmount !== undefined && <p className="text-xs text-[#6b7280]">Plan fees are calculated from the product {offer.basis === "mrp" ? "MRP" : "selling price"} of <span className="font-medium text-[#1d1d1f]">{money(offer.basisAmount)}</span>.</p>}
      {selectedPlan && <dl className="grid gap-2 rounded-lg bg-white p-3 text-xs sm:grid-cols-3">
        <div><dt className="text-[#6b7280]">Plan fee before GST</dt><dd className="mt-1 font-semibold">{money(selectedBase)}</dd></div>
        <div><dt className="text-[#6b7280]">GST ({offer.taxRate || 18}%)</dt><dd className="mt-1 font-semibold">{money(selectedPlan.price - selectedBase)}</dd></div>
        <div><dt className="text-[#6b7280]">{coveredQuantity > 1 ? `Total for ${coveredQuantity} devices` : "Total per device"}</dt><dd className="mt-1 font-semibold">{money(selectedPlan.price * coveredQuantity)}</dd></div>
      </dl>}
      {offer.coverageStarts && <p className="text-xs text-[#6b7280]">Coverage begins {offer.coverageStarts === "delivery" ? "on delivery / collection" : "on purchase after payment"}, according to the terms below. One plan covers one device.</p>}
      <details className="rounded-lg border border-gray-200 bg-white p-2 text-xs"><summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1560BD]">Coverage terms and exclusions</summary><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-[#6b7280]">{offer.terms}</p></details>
    </div></details>}
  </section>
}
