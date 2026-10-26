"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetchJson } from "@/lib/api-client"
import { DeclinedGiftPromotionsSchema, GiftAwardsResponseSchema, type GiftAward } from "@/lib/gift-validation"
import type { IncomingItem } from "@/lib/order-pricing"

const key = (owner: string) => `sara_cart_gift_choices:${owner}`
export function readCartGiftChoices(owner: string, previousOwner?: string) {
  let choices = DeclinedGiftPromotionsSchema.parse(JSON.parse(localStorage.getItem(key(owner)) || "[]"))
  if (previousOwner === "guest" && owner !== "guest") {
    const guest = DeclinedGiftPromotionsSchema.parse(JSON.parse(localStorage.getItem(key("guest")) || "[]"))
    choices = [...new Set([...choices, ...guest])]
    localStorage.setItem(key(owner), JSON.stringify(choices))
  }
  return choices
}
export function clearCartGiftChoices(owner: string) {
  try { localStorage.removeItem(key(owner)); window.dispatchEvent(new Event("cart-gifts-updated")) } catch { /* Retain choices when storage is unavailable. */ }
}
export function useCartGifts(items: IncomingItem[], owner: string, fulfilment?: { method: string; storeId?: string }) {
  const [offers, setOffers] = useState<GiftAward[]>([])
  const [declined, setDeclined] = useState<string[]>([])
  const [loadedOwner, setLoadedOwner] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [storageError, setStorageError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const currentOwner = useRef(owner); currentOwner.current = owner
  const previousOwner = useRef(owner)
  const context = JSON.stringify({ items, fulfilment })
  const [resolvedContext, setResolvedContext] = useState("")
  useEffect(() => {
    const load = () => {
      try { setDeclined(readCartGiftChoices(owner, previousOwner.current)); previousOwner.current = owner; setStorageError("") }
      catch { setStorageError("Your free gift choices could not be read. Enable browser storage and retry before paying.") }
      setLoadedOwner(owner)
    }
    load()
    window.addEventListener("storage", load); window.addEventListener("cart-gifts-updated", load)
    return () => { window.removeEventListener("storage", load); window.removeEventListener("cart-gifts-updated", load) }
  }, [owner])
  useEffect(() => {
    if (loadedOwner !== owner) return
    if (!items.length) { setOffers([]); setLoading(false); setResolvedContext(context); return }
    const controller = new AbortController()
    setLoading(true); setError("")
    const payload = JSON.parse(context)
    void apiFetchJson("/api/cart/gifts", { method: "POST", json: payload, signal: controller.signal }, value => GiftAwardsResponseSchema.parse(value))
      .then(result => { if (!controller.signal.aborted) { setOffers(result.gifts); setResolvedContext(context) } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not check free gifts") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [context, owner, loadedOwner, attempt, items.length])
  const choose = useCallback((promotionId: string, remove: boolean) => {
    if (currentOwner.current !== owner) return
    const next = remove ? [...new Set([...declined, promotionId])] : declined.filter(id => id !== promotionId)
    try {
      localStorage.setItem(key(owner), JSON.stringify(next)); setDeclined(next)
      window.dispatchEvent(new Event("cart-gifts-updated"))
    } catch { setStorageError("Your free gift choice could not be saved. Enable browser storage and retry before paying.") }
  }, [owner, declined])
  return { offers, gifts: offers.filter(gift => !declined.includes(gift.promotionId)), declinedGiftPromotions: declined,
    loading: !!items.length && (loading || loadedOwner !== owner || resolvedContext !== context), error: storageError || error,
    remove: (id: string) => choose(id, true), restore: (id: string) => choose(id, false),
    retry: () => { window.dispatchEvent(new Event("cart-gifts-updated")); setAttempt(value => value + 1) } }
}
