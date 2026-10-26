import type { GiftAward } from "@/lib/gift-validation"
import CartProductImage from "@/components/CartProductImage"

/** Saved order gifts have a display value, but never add to the order total. */
export default function OrderGiftItems({ gifts = [], heading = "Free gifts included", showPromotion = false }: {
  gifts?: GiftAward[]
  heading?: string
  showPromotion?: boolean
}) {
  if (!gifts.length) return null

  return <section className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3" aria-label={heading}>
    <h4 className="text-sm font-semibold text-green-900">{heading}</h4>
    <ul className="mt-2 space-y-2">
      {gifts.map(gift => <li key={`${gift.promotionId}:${gift.giftId}`} className="flex items-center gap-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-green-100 bg-white">
          <CartProductImage src={gift.photo || undefined} name={gift.name} className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block break-words text-sm font-medium text-slate-900">{gift.name}</strong>
          <p className="mt-1 break-words text-xs text-slate-600">SKU: {gift.sku} · Qty: {gift.quantity}</p>
          {showPromotion && <p className="mt-1 break-words text-xs text-slate-600">Offer: {gift.code}</p>}
        </div>
        <span className="shrink-0 rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-800">FREE</span>
      </li>)}
    </ul>
  </section>
}
