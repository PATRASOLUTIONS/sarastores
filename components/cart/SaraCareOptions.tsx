"use client"

import { useEffect, useRef } from "react"
import { useCart } from "@/hooks/useCart"
import { cartLineKey } from "@/lib/cart-line"
import type { CartItem } from "@/contexts/CartContext"
import { ShieldCheck } from "lucide-react"
import SaraCarePlanPicker from "@/components/cart/SaraCarePlanPicker"
import { formatSaraCarePrice, isSaraCare, type SaraCareYears } from "@/lib/sara-care-types"

export default function SaraCareOptions({ item, disabled = false, variant = "compact" }: { item: CartItem; disabled?: boolean; variant?: "compact" | "checkout" }) {
  const { cart, saraCareOffers, setSaraCareDuration, isLoading, saraCareLoading } = useCart()
  const parentLineKey = item.saraCare?.parentLineKey || cartLineKey(item)
  const parent = item.saraCare ? cart.find(line => !isSaraCare(line) && cartLineKey(line) === parentLineKey) : item
  const offer = saraCareOffers.find(offer => offer.parentLineKey === parentLineKey)
  const care = cart.find(line => line.saraCare?.parentLineKey === parentLineKey)
  const selected = parent?.saraCareSelection === null ? null : parent?.saraCareSelection ?? care?.saraCare?.durationYears ?? offer?.defaultYears ?? null
  const lastYears = useRef<SaraCareYears | null>(null)
  useEffect(() => { if (selected !== null) lastYears.current = selected }, [selected])
  if (!parent || !offer || (!isSaraCare(item) && care)) return null
  const locked = disabled || isLoading || saraCareLoading
  const plan = offer.options.find(option => option.years === selected)
  const remembered = offer.options.some(option => option.years === lastYears.current) ? lastYears.current : offer.defaultYears
  return <section aria-label={`Sara Care for ${parent.name}`} className={`rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] p-3 text-[#1d1d1f] ${variant === "checkout" ? "my-2" : "mt-2"}`}>
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">{!isSaraCare(item) && <ShieldCheck size={15} className="text-[#0071e3]" />}{isSaraCare(item) ? "Protection plan" : "Sara Care"}</span>
      <label className="relative inline-flex min-h-8 cursor-pointer items-center gap-2">
        <span className="text-[11px] text-[#6e6e73]">{selected === null ? "Add protection" : "Included"}</span>
        <input type="checkbox" role="switch" checked={selected !== null} disabled={locked} onChange={event => setSaraCareDuration(parentLineKey, event.target.checked ? remembered : null)} className="peer sr-only" aria-label={`Include Sara Care for ${parent.name}`} />
        <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-[#d2d2d7] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#0071e3] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0071e3] peer-disabled:opacity-50" />
      </label>
    </div>
    <SaraCarePlanPicker options={offer.options} value={selected} label={`Sara Care duration for ${parent.name}`} disabled={locked || selected === null} onChange={years => setSaraCareDuration(parentLineKey, years)} />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-4 text-[#6e6e73]">
      <p aria-live="polite">{saraCareLoading ? "Updating your plan..." : plan ? `${formatSaraCarePrice(plan.price * parent.quantity)} for ${parent.quantity} ${parent.quantity === 1 ? "device" : "devices"}, including GST` : "Optional protection for your device"}</p>
      <a href="/sara-care#coverage-terms" target="_blank" rel="noopener noreferrer" className="font-medium text-[#0071e3] hover:underline">Coverage terms</a>
    </div>
  </section>
}

export function SaraCareNotice({ disabled = false }: { disabled?: boolean }) {
  const { cart, saraCareOffers, saraCareError, saraCareLoading, refreshSaraCare, removeAllSaraCare } = useCart()
  if (!saraCareError && !saraCareLoading) return null
  if (!saraCareError && !saraCareOffers.length && !cart.some(isSaraCare)) return null
  return <div role={saraCareError ? "alert" : "status"} className="my-2 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] p-3 text-xs leading-5 text-[#6e6e73]">
    <p>{saraCareError || "Updating Sara Care prices..."}</p>
    {saraCareError && <div className="mt-2 flex flex-wrap gap-3">
      <button type="button" disabled={disabled || saraCareLoading} className="font-medium text-[#0071e3] hover:underline disabled:opacity-50" onClick={refreshSaraCare}>Try again</button>
      <button type="button" disabled={disabled} className="font-medium text-[#0071e3] hover:underline disabled:opacity-50" onClick={removeAllSaraCare}>Remove care plans</button>
    </div>}
  </div>
}
