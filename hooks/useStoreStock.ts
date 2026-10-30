"use client"

import { useEffect, useRef, useState } from "react"
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
export function useStoreStock(items: { id: string; quantity: number; type?: string; saraCare?: unknown }[]): StoreStockState {
  const quantities = new Map<string, number>()
  for (const item of items.filter(item => item.type !== "service" && !item.saraCare)) quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity)
  const key = [...quantities].map(([id, quantity]) => `${id}:${quantity}`).sort().join(",")
  const [result, setResult] = useState<{ key: string; storeIds: Set<string> | null;
    byStore: Record<string, StoreItemAvailability[]>; deliveryAvailable: boolean; availabilityError: string; error: string }>({
    key: "", storeIds: null, byStore: {}, deliveryAvailable: false, availabilityError: "", error: "",
  })
  const [farDistanceKm, setFarDistanceKm] = useState(15)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Retain in-flight and completed checks through effect replay and section changes.
  const requests = useRef(new Map<string, Promise<{
    storeIds: string[]; byStore: Record<string, StoreItemAvailability[]>; deliveryAvailable: boolean;
    availabilityError: string; farDistanceKm: number
  }>>())

  useEffect(() => {
    setResult(previous => previous.key === key && previous.storeIds
      ? { ...previous, error: "" } : { key, storeIds: null, byStore: {}, deliveryAvailable: false, availabilityError: "", error: "" })
    if (!key) return
    let cancelled = false
    setLoading(true)
    const requestKey = `${key}|${attempt}`
    let request = requests.current.get(requestKey)
    if (!request) {
      request = fetch(`/api/stores/availability?items=${encodeURIComponent(key)}`, { cache: "no-store" })
        .then(async response => {
          const data = await response.json().catch(() => null)
          const parsed = z.object({ success: z.literal(true), storeIds: z.array(z.string()), deliveryAvailable: z.boolean(),
            byStore: z.record(z.array(z.object({ itemCode: z.string(), required: z.number().int().positive(), available: z.number().int().nonnegative() }))),
            farDistanceKm: z.number().positive(),
            availabilityError: z.string().default(""),
          }).safeParse(data)
          if (!response.ok || !parsed.success) throw new Error(data?.error || "Store stock could not be checked.")
          return parsed.data
        })
      requests.current.set(requestKey, request)
    }
    request.then(data => {
        if (cancelled) return
        setResult({ key, storeIds: new Set(data.storeIds), byStore: data.byStore,
          deliveryAvailable: data.deliveryAvailable, availabilityError: data.availabilityError, error: "" })
        setFarDistanceKm(data.farDistanceKm)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        console.error("[Checkout] Store stock check failed:", reason)
        setResult({ key, storeIds: null, byStore: {}, deliveryAvailable: false, availabilityError: "", error: "Stock could not be checked." })
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [key, attempt])
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
