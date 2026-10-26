"use client"

import { useEffect, useState } from "react"
import { z } from "zod"
import type { StoreItemAvailability } from "@/lib/store-stock"

export interface StoreStockState {
  /** Stores holding every cart item; null until loaded. */
  storeIds: Set<string> | null
  byStore: Record<string, StoreItemAvailability[]>
  deliveryAvailable: boolean
  availabilityError: string
  /** Beyond this distance checkout suggests ordering online instead. */
  farDistanceKm: number
  loading: boolean
  error: string
  retry: () => void
}

/** Which stores can serve the whole cart from their own stock. */
export function useStoreStock(items: { id: string; quantity: number }[]): StoreStockState {
  const quantities = new Map<string, number>()
  for (const item of items) quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity)
  const key = [...quantities].map(([id, quantity]) => `${id}:${quantity}`).sort().join(",")
  const [result, setResult] = useState<{ key: string; storeIds: Set<string> | null;
    byStore: Record<string, StoreItemAvailability[]>; deliveryAvailable: boolean; availabilityError: string; error: string }>({
    key: "", storeIds: null, byStore: {}, deliveryAvailable: false, availabilityError: "", error: "",
  })
  const [farDistanceKm, setFarDistanceKm] = useState(15)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setResult(previous => previous.key === key && previous.storeIds
      ? { ...previous, error: "" } : { key, storeIds: null, byStore: {}, deliveryAvailable: false, availabilityError: "", error: "" })
    if (!key) return
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/stores/availability?items=${encodeURIComponent(key)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => null)
        const parsed = z.object({ success: z.literal(true), storeIds: z.array(z.string()), deliveryAvailable: z.boolean(),
          byStore: z.record(z.array(z.object({ itemCode: z.string(), required: z.number().int().positive(), available: z.number().int().nonnegative() }))),
          farDistanceKm: z.number().positive(),
          availabilityError: z.string().default(""),
        }).safeParse(data)
        if (!response.ok || !parsed.success) throw new Error(data?.error || "Store stock could not be checked.")
        setResult({ key, storeIds: new Set(parsed.data.storeIds), byStore: parsed.data.byStore,
          deliveryAvailable: parsed.data.deliveryAvailable, availabilityError: parsed.data.availabilityError, error: "" })
        setFarDistanceKm(parsed.data.farDistanceKm)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        console.error("[Checkout] Store stock check failed:", reason)
        setResult({ key, storeIds: null, byStore: {}, deliveryAvailable: false, availabilityError: "", error: "Stock could not be checked." })
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [key, attempt])

  useEffect(() => {
    const refresh = () => { if (!document.hidden) setAttempt(value => value + 1) }
    const timer = setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh) }
  }, [])
  const current = result.key === key ? result : null
  return { storeIds: current?.storeIds ?? null, byStore: current?.byStore ?? {}, deliveryAvailable: current?.deliveryAvailable ?? false,
    availabilityError: current?.availabilityError ?? "",
    farDistanceKm, loading: Boolean(key) && (loading || !current), error: current?.error ?? "", retry: () => setAttempt(value => value + 1) }
}

/** One-line nudge toward home delivery when the nearest stocked store is far. */
export function farStoreMessage(distance: number | null | undefined, farDistanceKm: number): string {
  if (distance === null || distance === undefined || distance <= farDistanceKm) return ""
  return `The nearest store with your items is about ${Math.round(distance)} km from your delivery address. We suggest buying online with home delivery instead.`
}
