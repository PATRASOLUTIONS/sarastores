"use client"

import type { useCartCoupon } from "@/hooks/useCartCoupon"

export default function CartCoupon({ coupon, disabled = false, id = "cart-coupon" }: { coupon: ReturnType<typeof useCartCoupon>; disabled?: boolean; id?: string }) {
  return <section id={id} className="my-4 scroll-mt-48 rounded-lg border bg-gray-50 p-3" aria-label="Cart coupon">
    <label htmlFor={`${id}-code`} className="mb-2 block text-sm font-medium text-gray-700">Have a Coupon Code?</label>
    {!coupon.appliedCoupon ? <div className="flex gap-2">
      <input id={`${id}-code`} className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" value={coupon.couponCode}
        onChange={event => coupon.setCouponCode(event.target.value.toUpperCase())}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void coupon.apply() } }}
        placeholder="Enter coupon code" disabled={disabled || coupon.applyingCoupon} />
      <button type="button" className="rounded bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={disabled || coupon.applyingCoupon || !coupon.couponCode.trim()} onClick={() => void coupon.apply()}>Apply</button>
    </div> : <div className="rounded border border-green-200 bg-green-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-sm font-semibold text-green-900">{coupon.appliedCoupon.code}</p>
          <p className="text-xs text-green-700">{coupon.appliedCoupon.name}</p>
          {coupon.couponDiscount > 0 && <p className="text-xs text-green-700">Saved ₹{coupon.couponDiscount.toLocaleString("en-IN")}</p>}</div>
        {coupon.appliedCoupon.couponRemovable !== false ? <button type="button" disabled={disabled || coupon.applyingCoupon}
          onClick={coupon.remove} className="text-sm font-medium text-red-600 disabled:opacity-50">Remove</button>
          : !coupon.applyingCoupon && <span className="text-xs text-green-700">Cannot be removed</span>}
      </div>
    </div>}
    {coupon.applyingCoupon && <p role="status" className="mt-2 text-xs text-gray-600">Checking coupon…</p>}
    {coupon.error && <p role="alert" className="mt-2 text-sm text-red-700">{coupon.error} <button type="button" disabled={disabled} onClick={coupon.retry} className="underline">Retry</button></p>}
  </section>
}
