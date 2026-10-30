"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { apiFetchJson } from "@/lib/api-client"
import { cartLineKey } from "@/lib/cart-line"
import { useCart } from "@/hooks/useCart"
import { isSaraCare, SaraCareQuoteResponseSchema, type SaraCareOffer, type SaraCareYears } from "@/lib/sara-care-types"
import SaraCarePlanPicker from "@/components/cart/SaraCarePlanPicker"

const money = (amount: number) => `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
  const selected: SaraCareYears | null = !pending && !error && !currentOffer ? null : cartSelection !== undefined ? cartSelection : selection !== undefined ? selection : currentOffer?.defaultYears || 1
  const selectedPlan = currentOffer?.options.find(option => option.years === selected)
  useEffect(() => {
    if (!pending && !error && selection === undefined && cartSelection === undefined) onSelect(currentOffer?.defaultYears ?? null)
  }, [pending, error, selection, cartSelection, currentOffer, onSelect])
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
  const { offer, loading, error, retry, selected, selectedPlan, select, saraCareLoading, parent } = care
  const [lastYears, setLastYears] = useState<SaraCareYears>(selected ?? offer?.defaultYears ?? 1)
  useEffect(() => { if (selected !== null) setLastYears(selected) }, [selected])
  const selectedBase = selectedPlan ? selectedPlan.price / (1 + (offer?.taxRate || 18) / 100) : 0
  const coveredQuantity = parent?.quantity || 1
  if (compact) return <section aria-label={`Sara Care for ${productName}`} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs">
    <div className="flex items-center justify-between gap-2">
      <label className="flex cursor-pointer items-center gap-2 font-semibold text-[#0F2557]">
        <input type="checkbox" checked={selected !== null} disabled={disabled || saraCareLoading || (!loading && !error && !offer)}
          onChange={event => select(event.target.checked ? lastYears : null)} className="h-4 w-4 rounded accent-[#1560BD]" />
        <ShieldCheck size={15} />Sara Care
      </label>
      {selectedPlan && <span className="font-semibold text-[#0F2557]" aria-live="polite">+{money(selectedPlan.price)}</span>}
    </div>
    {loading ? <p role="status" className="mt-2 text-gray-600">Loading plan prices…</p> : error ? <p role="alert" className="mt-2 text-red-700">Plans could not be loaded. <button type="button" onClick={retry} className="font-semibold underline">Retry</button></p> : offer ? <>
      <select aria-label="Sara Care duration" value={selected ?? lastYears} disabled={disabled || saraCareLoading || selected === null}
        onChange={event => select(Number(event.target.value) as SaraCareYears)} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-xs disabled:opacity-50">
        {([1, 2, 3] as SaraCareYears[]).map(years => {
          const plan = offer.options.find(option => option.years === years)
          return <option key={years} value={years} disabled={!plan}>{years} {years === 1 ? "year" : "years"}{plan ? ` — ${money(plan.price)}` : " — unavailable"}</option>
        })}
      </select>
      <p className="mt-2 text-gray-600">{selected === null ? "Not added" : "Added · price includes GST"}</p>
    </> : <p className="mt-2 text-gray-600">Unavailable for this product</p>}
    <Link href="/sara-care#coverage-terms" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[#1560BD] hover:underline">Coverage terms</Link>
  </section>
  return <section aria-label={`Sara Care for ${productName}`} className="space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-[#1560BD]"><ShieldCheck size={26} /></span>
      <div><h3 className="text-lg font-semibold text-[#0F2557]">Sara Care protection</h3><p className="mt-1 text-sm leading-6 text-gray-600">Choose optional protection for {productName}. Sara Care appears as a separate product in your cart and can be removed before payment.</p></div>
    </div>
    {loading ? <p role="status" className="text-sm text-gray-600">Loading plans for this product…</p> : error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="font-semibold underline" onClick={retry}>Retry plans</button></p> : offer ? <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-[#0F2557]">Plans and costs for this product</h4>
          {offer.basisAmount !== undefined && <p className="mt-2 text-sm text-gray-600">Price basis: <strong>{offer.basis === "mrp" ? "Product MRP" : "Product selling price"} · {money(offer.basisAmount)}</strong></p>}
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs sm:text-sm">
            <thead><tr className="border-b border-gray-200 text-gray-500"><th scope="col" className="py-2 pr-3 font-medium">Duration</th><th scope="col" className="px-2 py-2 font-medium">Package rate</th><th scope="col" className="py-2 pl-2 text-right font-medium">Cost / device</th></tr></thead>
            <tbody>{([1, 2, 3] as SaraCareYears[]).map(years => {
              const plan = offer.options.find(option => option.years === years)
              return <tr key={years} className={`border-b border-gray-100 last:border-0 ${selected === years ? "bg-blue-50" : ""}`}>
                <th scope="row" className="py-3 pr-3 font-semibold text-[#0F2557]">{years} {years === 1 ? "year" : "years"}{years === offer.defaultYears && <span className="mt-1 block text-[10px] font-normal text-gray-500">Default plan</span>}</th>
                <td className="px-2 py-3 text-gray-600">{plan ? `${plan.percentage}%` : "—"}</td><td className="py-3 pl-2 text-right font-semibold text-[#0F2557]">{plan ? money(plan.price) : <span className="font-normal text-gray-500">Unavailable</span>}</td>
              </tr>
            })}</tbody>
          </table></div>
          <p className="mt-3 text-xs leading-5 text-gray-600">One upfront payment covers the selected duration. Each package rate applies once to the product price basis. All displayed plan costs include {offer.taxRate || 18}% GST.</p>
        </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4"><SaraCarePlanPicker options={offer.options} value={selected} disabled={disabled || saraCareLoading}
        label={`Sara Care duration for ${productName}`} onChange={select} />
        <div className="mt-4 border-t border-blue-100 pt-3" aria-live="polite">
          {selectedPlan ? <><h4 className="text-sm font-semibold text-[#0F2557]">Selected: {selectedPlan.years}-year Sara Care</h4>
            <dl className="mt-2 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between gap-3"><dt>Plan fee before GST</dt><dd>{money(selectedBase)}</dd></div>
              <div className="flex justify-between gap-3"><dt>GST ({offer.taxRate || 18}%)</dt><dd>{money(selectedPlan.price - selectedBase)}</dd></div>
              <div className="flex justify-between gap-3 font-semibold text-[#0F2557]"><dt>Total per device</dt><dd>{money(selectedPlan.price)}</dd></div>
              {coveredQuantity > 1 && <div className="flex justify-between gap-3 font-semibold text-[#0F2557]"><dt>For {coveredQuantity} devices in cart</dt><dd>{money(selectedPlan.price * coveredQuantity)}</dd></div>}
            </dl>
          </> : <p className="text-sm text-gray-600">{selected === null ? "No Care plan selected. No protection charge will be added." : "This duration is currently unavailable. Choose an available plan."}</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-600">{parent ? "Your choice updates the plan for this device in your cart." : "Your choice will be included when you add this device to the cart."}</p>
      </div>
      </div>
      <div className="rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-[#0F2557]">Coverage details</h4>
        <dl className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          <div><dt className="font-medium text-gray-900">Covered product</dt><dd className="mt-1 break-words">{productName}</dd></div>
          {offer.coverageStarts && <div><dt className="font-medium text-gray-900">Coverage begins</dt><dd className="mt-1">{offer.coverageStarts === "delivery" ? "On delivery / collection" : "On purchase after payment"}, according to the terms below.</dd></div>}
          <div><dt className="font-medium text-gray-900">Quantity</dt><dd className="mt-1">One plan per device. The Care quantity follows the covered device quantity.</dd></div>
          <div><dt className="font-medium text-gray-900">Cart and checkout</dt><dd className="mt-1">Sara Care is a separate, optional product. You can change its duration or remove it before payment.</dd></div>
        </dl>
        <h4 className="mt-5 text-sm font-semibold text-[#0F2557]">Coverage terms and exclusions</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{offer.terms}</p>
      </div>
    </> : <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Sara Care is currently unavailable for this product. You can purchase the device without a care plan.</p>}
    <Link href="/sara-care" className="inline-block text-sm font-semibold text-[#1560BD] hover:underline">About Sara Care</Link>
  </section>
}
