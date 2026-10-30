"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { Check, ChevronRight, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { apiFetchJson } from "@/lib/api-client"
import { cartLineKey } from "@/lib/cart-line"
import { useCart } from "@/hooks/useCart"
import { isSaraCare, saraCareDurationLabel, formatSaraCarePrice, SaraCareQuoteResponseSchema, type SaraCareOffer, type SaraCareYears } from "@/lib/sara-care-types"

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
  const pickerId = useId()
  useEffect(() => { if (selected !== null) setLastYears(selected) }, [selected])
  if (!offer) return null
  const locked = disabled || loading || saraCareLoading
  const rememberedYears = offer.options.some(plan => plan.years === lastYears) ? lastYears : offer.defaultYears
  const preferred = [1, 2, 3, 0.5]
  const rank = (years: number) => preferred.includes(years) ? preferred.indexOf(years) : preferred.length + years
  const options = [...offer.options].sort((a, b) => rank(a.years) - rank(b.years))
  const selectedBase = selectedPlan ? Math.round(selectedPlan.price / (1 + (offer.taxRate || 18) / 100)) : 0
  const coveredQuantity = parent?.quantity || 1
  return <section aria-label={`Sara Care for ${productName}`} className={`overflow-hidden rounded-2xl border border-[#dedee3] bg-[#f5f5f7] text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.025)] ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0071e3]"><ShieldCheck size={19} strokeWidth={1.7} /></span>
        <div><h3 className="text-base font-semibold tracking-tight">Sara Care</h3><p className="mt-0.5 text-[11px] leading-4 text-[#6e6e73]">Protection, made simple.</p></div>
      </div>
      <label className="relative inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-end gap-2">
        <span className="sr-only">Add Sara Care for {productName}</span>
        <input type="checkbox" checked={selected !== null} disabled={locked} onChange={event => select(event.target.checked ? rememberedYears : null)} className="peer sr-only" />
        <span aria-hidden="true" className="relative h-6 w-10 rounded-full bg-[#d2d2d7] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#0071e3] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#0071e3] peer-disabled:opacity-50" />
      </label>
    </div>
    <fieldset disabled={locked} className="mt-3 min-w-0">
      <legend className="mb-2 text-xs font-medium text-[#6e6e73]">Choose your protection plan</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(plan => {
          const checked = selected === plan.years
          return <label key={plan.years} className={`relative min-w-[80px] flex-1 basis-[80px] cursor-pointer rounded-lg border px-2 py-2 transition-[border-color,box-shadow,background-color] motion-reduce:transition-none ${checked ? "border-[#0071e3] bg-[#f2f7ff] shadow-[inset_0_0_0_1px_#0071e3]" : "border-[#d2d2d7] bg-white hover:border-[#86868b]"} ${locked ? "cursor-not-allowed opacity-60" : ""}`}>
            <input type="radio" name={`${pickerId}-duration`} value={plan.years} checked={checked} onChange={() => select(plan.years)} className="peer sr-only" />
            <span aria-hidden="true" className="pointer-events-none absolute -inset-1 rounded-2xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#0071e3]" />
            <span className="flex items-start justify-between gap-1">
              <span className="text-xs font-semibold leading-4 tracking-tight">{saraCareDurationLabel(plan.years)}</span>
              {checked && <Check size={12} aria-hidden="true" className="shrink-0 text-[#0071e3]" />}
            </span>
            <span className="mt-1 block break-words text-[11px] font-medium tabular-nums">{money(plan.price)}</span>
          </label>
        })}
      </div>
    </fieldset>
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#dedee3] pt-3" aria-live="polite" aria-atomic="true">
      <div><p className="text-xs font-medium">{saraCareLoading ? "Updating your plan..." : selectedPlan ? "Added to your purchase" : "Sara Care not added"}</p><p className="mt-0.5 text-[10px] leading-4 text-[#6e6e73]">{selectedPlan ? "Price per device, including GST" : "Choose a plan to add protection"}</p></div>
      <span className="shrink-0 text-sm font-semibold tracking-tight tabular-nums">{selectedPlan ? `+${money(selectedPlan.price)}` : money(0)}</span>
    </div>
    <Link href="/sara-care#coverage-terms" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-6 items-center gap-0.5 rounded text-[11px] font-medium text-[#0071e3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]">Coverage terms<ChevronRight size={12} aria-hidden="true" /></Link>
    {!compact && <div className="mt-5 space-y-4 border-t border-[#dedee3] pt-5">
      <p className="text-sm leading-6 text-[#6e6e73]">Optional protection for {productName}. Your plan appears as a separate item in the cart, and you can change or remove it before payment.</p>
      {offer.pricingMode !== "value" && offer.basisAmount !== undefined && <p className="text-xs text-[#6e6e73]">Plan fees are calculated from the product {offer.basis === "mrp" ? "MRP" : "selling price"} of <span className="font-medium text-[#1d1d1f]">{money(offer.basisAmount)}</span>.</p>}
      {selectedPlan && <dl className="grid gap-3 rounded-xl bg-white p-4 text-xs sm:grid-cols-3">
        <div><dt className="text-[#6e6e73]">Plan fee before GST</dt><dd className="mt-1 font-semibold">{money(selectedBase)}</dd></div>
        <div><dt className="text-[#6e6e73]">GST ({offer.taxRate || 18}%)</dt><dd className="mt-1 font-semibold">{money(selectedPlan.price - selectedBase)}</dd></div>
        <div><dt className="text-[#6e6e73]">{coveredQuantity > 1 ? `Total for ${coveredQuantity} devices` : "Total per device"}</dt><dd className="mt-1 font-semibold">{money(selectedPlan.price * coveredQuantity)}</dd></div>
      </dl>}
      {offer.coverageStarts && <p className="text-xs text-[#6e6e73]">Coverage begins {offer.coverageStarts === "delivery" ? "on delivery / collection" : "on purchase after payment"}, according to the terms below. One plan covers one device.</p>}
      <details className="rounded-xl border border-[#dedee3] bg-white p-4 text-sm"><summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0071e3]">Coverage terms and exclusions</summary><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-[#6e6e73]">{offer.terms}</p></details>
    </div>}
  </section>
}
