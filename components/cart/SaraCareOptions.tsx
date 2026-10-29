"use client"

import { useCart } from "@/hooks/useCart"
import { cartLineKey } from "@/lib/cart-line"
import type { CartItem } from "@/contexts/CartContext"
import { ShieldCheck } from "lucide-react"
import SaraCarePlanPicker from "@/components/cart/SaraCarePlanPicker"
import { isSaraCare } from "@/lib/sara-care-types"

export default function SaraCareOptions({ item, disabled = false, variant = "compact" }: { item: CartItem; disabled?: boolean; variant?: "compact" | "checkout" }) {
  const { cart, saraCareOffers, setSaraCareDuration, isLoading, saraCareLoading } = useCart()
  const parentLineKey = item.saraCare?.parentLineKey || cartLineKey(item)
  const parent = item.saraCare ? cart.find(line => !isSaraCare(line) && cartLineKey(line) === parentLineKey) : item
  if (!parent) return null
  const offer = saraCareOffers.find(offer => offer.parentLineKey === parentLineKey)
  if (!offer) return null
  const care = cart.find(line => line.saraCare?.parentLineKey === parentLineKey)
  // The linked service row owns the controls once added. The device only
  // offers Care when there is no service row, so it can still be added back.
  if (!isSaraCare(item) && care) return null
  const selected = parent.saraCareSelection === null ? "none" : parent.saraCareSelection || care?.saraCare?.durationYears || offer.defaultYears
  const selectedPrice = offer.options.find(option => option.years === Number(selected))?.price
  const picker = <SaraCarePlanPicker options={offer.options} value={selected === "none" ? null : selected}
    label={`Sara Care duration for ${parent.name}`} disabled={disabled || isLoading} onChange={years => setSaraCareDuration(parentLineKey, years)} />
  if (isSaraCare(item)) return <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 p-2">
    {picker}
    {saraCareLoading && <p role="status" className="mt-1 text-xs text-gray-600">Updating your plan…</p>}
    <details className="mt-2 text-xs text-gray-600"><summary className="cursor-pointer text-[#1560BD]">Coverage terms</summary><p className="mt-1 whitespace-pre-wrap break-words">{offer.terms}</p></details>
  </div>
  if (variant === "checkout") return <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F2557]"><ShieldCheck size={15} />Sara Care <span className="font-normal text-gray-500">Optional</span></span>
      {selected !== "none" && <button type="button" disabled={disabled} onClick={() => setSaraCareDuration(parentLineKey, null)} className="text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50">Remove Care</button>}
    </div>
    {picker}
    <p className="mt-2 leading-relaxed text-gray-600" aria-live="polite">{saraCareLoading ? "Updating your plan and order total…" : selected === "none" ? "No protection added. Choose a duration to add Sara Care." : selectedPrice === undefined ? "This duration is unavailable. Choose another duration or remove Care." :
      `${item.quantity} ${item.quantity === 1 ? "device" : "devices"} · ₹${(selectedPrice * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total, including GST. Shown as a separate product.`}</p>
    <details className="mt-2 text-gray-600"><summary className="cursor-pointer font-medium text-[#1560BD]">Coverage terms</summary><p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{offer.terms}</p></details>
  </div>
  return <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs">
    <p className="mb-2 font-semibold text-maroon-800">Sara Care — optional</p>
    {picker}
    <p className="mt-1 text-gray-600">{selected === "none" ? "Removed. You can add protection again here." : "Added as a separate product below. You can remove it."}</p>
    <details className="mt-1"><summary className="cursor-pointer text-maroon-800">Coverage terms</summary><p className="mt-1 whitespace-pre-wrap text-gray-700">{offer.terms}</p></details>
  </div>
}

export function SaraCareNotice({ disabled = false }: { disabled?: boolean }) {
  const { saraCareError, saraCareLoading, refreshSaraCare, removeAllSaraCare } = useCart()
  if (!saraCareError && !saraCareLoading) return null
  return <div role={saraCareError ? "alert" : "status"} className="my-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
    <p>{saraCareError || "Updating optional Sara Care prices…"}</p>
    <div className="mt-2 flex flex-wrap gap-3">
      {saraCareError && <button type="button" disabled={disabled || saraCareLoading} className="font-semibold underline disabled:opacity-50" onClick={refreshSaraCare}>Retry Sara Care</button>}
      <button type="button" disabled={disabled} className="font-semibold underline disabled:opacity-50" onClick={removeAllSaraCare}>Continue without Sara Care</button>
    </div>
  </div>
}
