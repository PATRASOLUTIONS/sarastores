"use client"

import { useEffect, useState } from "react"

export interface StoreStockState {
  /** Stores holding every cart item; null until loaded. */
  storeIds: Set<string> | null
  /** Beyond this distance checkout suggests ordering online instead. */
  farDistanceKm: number
  loading: boolean
  error: string
  retry: () => void
}

/** Which stores can serve the whole cart from their own stock. */
export function useStoreStock(items: { id: string; quantity: number }[]): StoreStockState {
  const key = items.map(item => `${item.id}:${item.quantity}`).sort().join(",")
  const [storeIds, setStoreIds] = useState<Set<string> | null>(null)
  const [farDistanceKm, setFarDistanceKm] = useState(15)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setStoreIds(null)
    setError("")
    if (!key) return
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/stores/availability?items=${encodeURIComponent(key)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.success || !Array.isArray(data.storeIds)) throw new Error(data?.error || "Store stock could not be checked.")
        setStoreIds(new Set(data.storeIds.map(String)))
        if (typeof data.farDistanceKm === "number") setFarDistanceKm(data.farDistanceKm)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        console.error("[Checkout] Store stock check failed:", reason)
        setError("Store stock could not be checked.")
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [key, attempt])

  return { storeIds, farDistanceKm, loading, error, retry: () => setAttempt(value => value + 1) }
}

/** One-line nudge toward home delivery when the nearest stocked store is far. */
export function farStoreMessage(distance: number | null | undefined, farDistanceKm: number): string {
  if (distance === null || distance === undefined || distance <= farDistanceKm) return ""
  return `The nearest store with your items is about ${Math.round(distance)} km from your delivery address. We suggest buying online with home delivery instead.`
}
