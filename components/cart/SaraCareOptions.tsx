"use client"

import { useEffect, useRef } from "react"
import { useCart } from "@/hooks/useCart"
import { cartLineKey } from "@/lib/cart-line"
import type { CartItem } from "@/contexts/CartContext"
import { ChevronRight, ShieldCheck } from "lucide-react"
import SaraCarePlanPicker from "@/components/cart/SaraCarePlanPicker"
import { isSaraCare, type SaraCareYears } from "@/lib/sara-care-types"

export default function SaraCareOptions({ item, disabled = false, variant = "compact" }: { item: CartItem; disabled?: boolean; variant?: "compact" | "checkout" }) {
  const { cart, saraCareOffers, setSaraCareDuration, isLoading, saraCareLoading } = useCart()
  const parentLineKey = item.saraCare?.parentLineKey || cartLineKey(item)
  const parent = item.saraCare ? cart.find(line => !isSaraCare(line) && cartLineKey(line) === parentLineKey) : item
  const offer = saraCareOffers.find(offer => offer.parentLineKey === parentLineKey)
  const care = cart.find(line => line.saraCare?.parentLineKey === parentLineKey)
  const selected = parent?.saraCareSelection === null ? null : parent?.saraCareSelection ?? care?.saraCare?.durationYears ?? offer?.defaultYears ?? null
  const lastYears = useRef<SaraCareYears | null>(null)
  useEffect(() => { if (selected !== null) lastYears.current = selected }, [selected])
  if (!parent || !offer) return null
  const locked = disabled || isLoading || saraCareLoading
  const remembered = offer.options.some(option => option.years === lastYears.current) ? lastYears.current : offer.defaultYears
  return <section aria-label={`Sara Care for ${parent.name}`} className={`w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 text-gray-900 ${selected === null ? "p-2" : "p-3"} ${variant === "checkout" ? "my-2" : "mt-2"}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#1560BD]"><ShieldCheck size={19} strokeWidth={1.7} /></span>
        <div><h3 className="text-sm font-semibold tracking-tight">Sara Care</h3><a href="/sara-care#coverage-terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-0.5 rounded text-[11px] font-medium text-[#1560BD] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1560BD]">Coverage terms<ChevronRight size={12} aria-hidden="true" /></a></div>
      </div>
      <label className="relative inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-2">
        <input type="checkbox" role="switch" checked={selected !== null} disabled={locked} onChange={event => setSaraCareDuration(parentLineKey, event.target.checked ? remembered : null)} className="peer sr-only" aria-label={`Include Sara Care for ${parent.name}`} />
        <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-[#d2d2d7] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#1560BD] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1560BD] peer-disabled:opacity-50" />
      </label>
    </div>
    {selected !== null && <div className="mt-2"><SaraCarePlanPicker options={offer.options} value={selected} label={`Sara Care duration for ${parent.name}`} disabled={locked} onChange={years => setSaraCareDuration(parentLineKey, years)} /></div>}
    <span role="status" className="sr-only">{saraCareLoading ? "Updating your plan..." : ""}</span>
  </section>
}

export function SaraCareNotice({ disabled = false }: { disabled?: boolean }) {
  const { cart, saraCareOffers, saraCareError, saraCareLoading, refreshSaraCare, removeAllSaraCare } = useCart()
  if (!saraCareError && !saraCareLoading) return null
  if (!saraCareError && !saraCareOffers.length && !cart.some(isSaraCare)) return null
  return <div role={saraCareError ? "alert" : "status"} className="my-2 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] p-3 text-xs leading-5 text-[#6b7280]">
    <p>{saraCareError || "Updating Sara Care prices..."}</p>
    {saraCareError && <div className="mt-2 flex flex-wrap gap-3">
      <button type="button" disabled={disabled || saraCareLoading} className="font-medium text-[#1560BD] hover:underline disabled:opacity-50" onClick={refreshSaraCare}>Try again</button>
      <button type="button" disabled={disabled} className="font-medium text-[#1560BD] hover:underline disabled:opacity-50" onClick={removeAllSaraCare}>Remove care plans</button>
    </div>}
  </div>
}
