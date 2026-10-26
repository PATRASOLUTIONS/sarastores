"use client"

import type { useCartGifts } from "@/hooks/useCartGifts"
import { isGiftSelected } from "@/lib/gift-validation"
import CartProductImage from "@/components/CartProductImage"
import { Gift, LockKeyhole, Plus, Trash2 } from "lucide-react"

export default function CartGifts({ quote, disabled = false, compact = false }: { quote: ReturnType<typeof useCartGifts>; disabled?: boolean; compact?: boolean }) {
  if (quote.error) return <div role="alert" className="my-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{quote.error}<button disabled={disabled} onClick={quote.retry} className="ml-2 underline">Retry</button></div>
  if (quote.loading) return <p role="status" className="my-3 text-sm text-gray-600">Checking free gifts…</p>
  if (!quote.offers.length) return null
  if (compact) return <section className="mt-4 overflow-hidden rounded-md border border-[#dce6f3] bg-white" aria-label="Free gifts">
    <div className="flex items-center gap-2 border-b border-[#e8edf5] bg-[#f5f8fd] px-3 py-2.5">
      <Gift size={15} className="shrink-0 text-[#0054f0]" aria-hidden="true" />
      <h3 className="text-xs font-semibold text-[#101828]">Your free gifts</h3>
    </div>
    <div className="divide-y divide-[#e8edf5]">{quote.offers.map(gift => {
      const removed = !isGiftSelected(gift, quote.declinedGiftPromotions, quote.selectedGiftPromotions)
      const status = removed ? (gift.giftAutoAdd === false ? "Not added" : "Removed") : "FREE"
      return <article key={gift.promotionId} className={`p-3 ${removed ? "bg-[#fafbfc]" : ""}`}>
        <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded border border-[#edf0f5] bg-white p-1">
            <CartProductImage src={gift.photo} name={gift.name} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-xs font-semibold leading-4 text-[#0f2557]">{gift.name}</p>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${removed ? "bg-gray-100 text-gray-600" : "bg-[#e8f8ed] text-[#00712b]"}`}>{status}</span>
            </div>
            <p className="mt-1 break-all text-[10px] leading-4 text-[#667085]">SKU: {gift.sku} <span className="whitespace-nowrap">· Qty: {gift.quantity}</span></p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4">
              {!removed && <strong className="text-xs text-[#00712b]">₹0</strong>}
              <span className="text-[#526079]">Value ₹{gift.price.toLocaleString("en-IN")}</span>
              <span className="text-[#667085] line-through">MRP ₹{gift.mrp.toLocaleString("en-IN")}</span>
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#edf0f5] pt-2">
          <p className="min-w-0 flex-1 break-words text-[10px] leading-4 text-[#667085]">{gift.promotionName}</p>
          {gift.giftRemovable === false ? <span className="inline-flex items-center gap-1 text-[10px] text-[#526079]" title="Included automatically · Cannot be removed">
            <LockKeyhole size={11} aria-hidden="true" />Cannot be removed
          </span> : <button type="button" disabled={disabled}
            aria-label={`${removed ? "Add free gift" : "Remove gift"}: ${gift.name}`}
            onClick={() => removed ? quote.restore(gift.promotionId) : quote.remove(gift.promotionId)}
            className={`inline-flex min-h-7 shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0054f0] disabled:opacity-50 ${removed ? "bg-[#edf4ff] text-[#0054f0] hover:bg-blue-100" : "text-[#667085] hover:bg-red-50 hover:text-red-700"}`}>
            {removed ? <Plus size={12} aria-hidden="true" /> : <Trash2 size={12} aria-hidden="true" />}
            {removed ? (gift.giftAutoAdd === false ? "Add free gift" : "Add gift back") : "Remove gift"}
          </button>}
        </div>
      </article>
    })}</div>
  </section>
  return <section className="my-4 rounded-lg border border-green-200 bg-green-50 p-4" aria-label="Free gifts">
    <h3 className="font-semibold text-green-900">Your free gifts</h3><p className="mb-3 mt-1 text-xs text-green-800">Free gifts available with your eligible products.</p>
    <div className="space-y-3">{quote.offers.map(gift => {
      const removed = !isGiftSelected(gift, quote.declinedGiftPromotions, quote.selectedGiftPromotions)
      return <div key={gift.promotionId} className={`flex items-center gap-3 rounded border bg-white p-3 ${removed ? "opacity-70" : ""}`}>
        <img src={gift.photo} alt={gift.name} className="h-16 w-16 flex-none object-contain" />
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{gift.name}</p><p className="text-xs text-gray-600">SKU: {gift.sku} · Qty: {gift.quantity}</p><p className="text-xs text-gray-600">{gift.promotionName}</p><p className="mt-1 text-sm"><strong className="text-green-800">{removed ? (gift.giftAutoAdd === false ? "Not added" : "Removed") : "FREE · ₹0"}</strong> <span className="text-gray-600">Value ₹{gift.price.toLocaleString("en-IN")}</span> <span className="text-gray-500 line-through">MRP ₹{gift.mrp.toLocaleString("en-IN")}</span></p></div>
        {gift.giftRemovable === false ? <span className="text-xs text-green-800">Included automatically · Cannot be removed</span> : <button type="button" disabled={disabled} onClick={() => removed ? quote.restore(gift.promotionId) : quote.remove(gift.promotionId)} className="text-xs font-semibold text-blue-700 underline disabled:opacity-50">{removed ? (gift.giftAutoAdd === false ? "Add free gift" : "Add gift back") : "Remove gift"}</button>}
      </div>
    })}</div>
  </section>
}
