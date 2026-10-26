"use client"

import type { useCartGifts } from "@/hooks/useCartGifts"

export default function CartGifts({ quote, disabled = false }: { quote: ReturnType<typeof useCartGifts>; disabled?: boolean }) {
  if (quote.loading) return <p role="status" className="my-3 text-sm text-gray-600">Checking free gifts…</p>
  if (quote.error) return <div role="alert" className="my-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{quote.error}<button disabled={disabled} onClick={quote.retry} className="ml-2 underline">Retry</button></div>
  if (!quote.offers.length) return null
  return <section className="my-4 rounded-lg border border-green-200 bg-green-50 p-4" aria-label="Free gifts">
    <h3 className="font-semibold text-green-900">Your free gifts</h3><p className="mb-3 mt-1 text-xs text-green-800">Added automatically with eligible products. You can remove a gift.</p>
    <div className="space-y-3">{quote.offers.map(gift => {
      const removed = quote.declinedGiftPromotions.includes(gift.promotionId)
      return <div key={gift.promotionId} className={`flex items-center gap-3 rounded border bg-white p-3 ${removed ? "opacity-70" : ""}`}>
        <img src={gift.photo} alt={gift.name} className="h-16 w-16 flex-none object-contain" />
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{gift.name}</p><p className="text-xs text-gray-600">SKU: {gift.sku} · Qty: {gift.quantity}</p><p className="text-xs text-gray-600">{gift.promotionName}</p><p className="mt-1 text-sm"><strong className="text-green-800">{removed ? "Removed" : "FREE · ₹0"}</strong> <span className="text-gray-600">Value ₹{gift.price.toLocaleString("en-IN")}</span> <span className="text-gray-500 line-through">MRP ₹{gift.mrp.toLocaleString("en-IN")}</span></p></div>
        <button type="button" disabled={disabled} onClick={() => removed ? quote.restore(gift.promotionId) : quote.remove(gift.promotionId)} className="text-xs font-semibold text-blue-700 underline disabled:opacity-50">{removed ? "Add gift back" : "Remove gift"}</button>
      </div>
    })}</div>
  </section>
}
