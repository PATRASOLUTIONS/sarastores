"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { ApiError, apiFetchJson } from "@/lib/api-client"
import { CouponQuoteSchema } from "@/lib/coupon-validation"
import { CART_COUPON_UPDATED, readCartCoupon, saveCartCoupon, type CartCouponSelection } from "@/lib/cart-coupon"
import type { IncomingItem } from "@/lib/order-pricing"

export function useCartCoupon(items: IncomingItem[], owner: string, fulfilment: { method: string; storeId?: string } = { method: "delivery" }, enabled = true) {
  const [couponCode, setCouponCode] = useState("")
  const [selection, setSelection] = useState<CartCouponSelection | null>(null)
  const [loadedOwner, setLoadedOwner] = useState("")
  const [quote, setQuote] = useState<{ context: string; coupon: CartCouponSelection; discount: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState("")
  const [storageError, setStorageError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const previousOwner = useRef(owner)
  const context = JSON.stringify({ items, owner, fulfilment, code: selection?.code ?? null })
  const currentContext = useRef(context); currentContext.current = context

  useEffect(() => {
    if (!enabled) return
    const load = () => {
      try {
        let saved = readCartCoupon(owner)
        if (previousOwner.current === "guest" && owner !== "guest" && !saved) {
          saved = readCartCoupon("guest")
          if (saved) saveCartCoupon(owner, saved)
        }
        previousOwner.current = owner
        setSelection(saved)
        setStorageError("")
      } catch { setStorageError("Your coupon could not be read. Enable browser storage and retry.") }
      setLoadedOwner(owner)
    }
    load()
    window.addEventListener("storage", load)
    window.addEventListener(CART_COUPON_UPDATED, load)
    return () => { window.removeEventListener("storage", load); window.removeEventListener(CART_COUPON_UPDATED, load) }
  }, [owner, enabled])

  useEffect(() => {
    if (!enabled || loadedOwner !== owner) return
    setError("")
    if (!selection || !items.length) { setQuote(null); return }
    const controller = new AbortController()
    const payload = JSON.parse(context)
    void apiFetchJson("/api/coupons/validate", {
      method: "POST", json: { code: payload.code, cart: payload.items, fulfilment: payload.fulfilment },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
    }, value => CouponQuoteSchema.parse(value)).then(data => {
      if (controller.signal.aborted || currentContext.current !== context) return
      setQuote({ context, coupon: data, discount: data.discount })
    }).catch(failure => {
      if (controller.signal.aborted) return
      const message = failure instanceof Error ? failure.message : "Could not check coupon"
      if (failure instanceof ApiError && failure.status === 400) {
        // Coupons that are no longer eligible are removed by the server check.
        try { saveCartCoupon(owner, null); setSelection(null); setQuote(null); toast.error(message) }
        catch { setStorageError("The invalid coupon could not be cleared. Enable browser storage and retry.") }
      } else setError(message)
    })
    return () => controller.abort()
  }, [context, owner, loadedOwner, enabled, attempt, items.length])

  const resolved = quote?.context === context && loadedOwner === owner
  const appliedCoupon = loadedOwner === owner && selection
    ? resolved ? quote!.coupon : { ...selection, couponRemovable: false }
    : null
  const applyingCoupon = busy || (enabled && loadedOwner !== owner) || (!!appliedCoupon && !!items.length && !resolved && !error && !storageError)

  const apply = async () => {
    if (!couponCode.trim() || !enabled || applyingCoupon || selection || busyRef.current) return
    busyRef.current = true; setBusy(true); setError("")
    const expectedContext = context
    try {
      const data = await apiFetchJson("/api/coupons/validate", {
        method: "POST", json: { code: couponCode.trim(), cart: items, fulfilment }, signal: AbortSignal.timeout(12_000),
      }, value => CouponQuoteSchema.parse(value))
      if (currentContext.current !== expectedContext) throw new Error("Your cart changed. Apply the coupon again.")
      saveCartCoupon(owner, data)
      setSelection(data)
      setQuote({ context: JSON.stringify({ items, owner, fulfilment, code: data.code }), coupon: data, discount: data.discount })
      toast.success(`Applied ${data.code}`)
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Could not apply coupon") }
    finally { busyRef.current = false; setBusy(false) }
  }
  const remove = () => {
    if (!resolved || applyingCoupon || quote!.coupon.couponRemovable === false) return
    try { saveCartCoupon(owner, null); setSelection(null); setQuote(null); setCouponCode(""); toast.success("Coupon removed") }
    catch { setStorageError("Your coupon removal could not be saved. Enable browser storage and retry.") }
  }
  const acceptCheckoutQuote = (coupon: (CartCouponSelection & { discount: number }) | null, refreshedItems: IncomingItem[]) => {
    saveCartCoupon(owner, coupon)
    setSelection(coupon)
    setQuote(coupon ? {
      context: JSON.stringify({ items: refreshedItems, owner, fulfilment, code: coupon.code }),
      coupon, discount: coupon.discount,
    } : null)
    setError("")
    setStorageError("")
    if (!coupon) setCouponCode("")
  }
  return { couponCode, setCouponCode, appliedCoupon, couponDiscount: resolved ? quote!.discount : 0, applyingCoupon,
    error: storageError || error, apply, remove, acceptCheckoutQuote,
    setCouponDiscount: (discount: number) => setQuote(previous => previous ? { ...previous, discount } : previous),
    retry: () => { window.dispatchEvent(new Event(CART_COUPON_UPDATED)); setAttempt(value => value + 1) } }
}
