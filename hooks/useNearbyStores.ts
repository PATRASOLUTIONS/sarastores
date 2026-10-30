"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { checkoutCity } from "@/lib/checkout-region"
import { calculateDistance, coordinates, geocodePincode, type Coordinates } from "@/lib/geo-client"

export interface NearbyStore {
  id: string
  storeCode?: string
  name: string
  address: string
  city: string
  phone: string
  hours: string
  state?: string
  pincode?: string
  image?: string
  latitude?: number
  longitude?: number
  /** Set by the pay-at-store list: false when the store has no phone or email to receive orders. */
  acceptsPayAtStore?: boolean
}

export type RankedStore = NearbyStore & { distance: number | null }

/**
 * SARA stores, nearest to the delivery address first: by distance when the
 * pincode can be located, otherwise same pincode, then same city. By default the
 * list is limited to checkout-region stores; pass `allStores` to keep every
 * store the endpoint returns.
 */
export function useNearbyStores(
  deliveryPincode = "",
  deliveryCity = "",
  { url = "/api/stores", allStores = false }: { url?: string; allStores?: boolean } = {},
) {
  const [origin, setOrigin] = useState<Coordinates | null>(null)
  const pincode = /^[1-9]\d{5}$/.test(deliveryPincode.trim()) ? deliveryPincode.trim() : ""

  useEffect(() => {
    setOrigin(null)
    if (!pincode) return
    const controller = new AbortController()
    // Debounced so typing a pincode does not fire a lookup per keystroke.
    const timer = setTimeout(() => {
      geocodePincode(pincode, controller.signal)
        .then(coords => { if (!controller.signal.aborted) setOrigin(coords) })
        .catch(error => { if (!controller.signal.aborted) console.warn("[Checkout] Pincode location lookup failed:", error) })
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [pincode])

  const [stores, setStores] = useState<NearbyStore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  // Checkout owns this hook so delivery and payment reuse one store list.
  const requests = useRef(new Map<string, Promise<NearbyStore[]>>())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const requestKey = `${url}:${attempt}`
        let request = requests.current.get(requestKey)
        if (!request) {
          request = (async () => {
            const res = await fetch(url, { cache: "no-store" })
            if (!res.ok) throw new Error("Stores could not be loaded.")
            const data = await res.json()
            if (!data?.success || !Array.isArray(data.stores)) throw new Error("Invalid stores response.")
            return data.stores as NearbyStore[]
          })()
          requests.current.set(requestKey, request)
        }
        const data = await request
        if (cancelled) return
        setStores(allStores ? data : data.filter((store: NearbyStore) => checkoutCity(store.city || "") &&
          (!store.state || store.state.trim().toLowerCase() === "karnataka")))
      } catch (error) {
        if (cancelled) return
        console.error("[Checkout] Store list failed:", error)
        setError("Stores could not be loaded.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [attempt, url, allStores])

  const ranked = useMemo<RankedStore[]>(() => {
    const homeCity = checkoutCity(deliveryCity || "")
    const withDistance = stores.map((store) => {
      const position = coordinates(store.latitude, store.longitude)
      return { ...store, distance: origin && position ? calculateDistance(origin, position) : null }
    })
    const closeness = (store: RankedStore) =>
      (pincode && store.pincode === pincode ? 0 : 2) + (homeCity && checkoutCity(store.city || "") === homeCity ? 0 : 1)
    return withDistance.sort((a, b) =>
      a.distance !== null && b.distance !== null ? a.distance - b.distance
        : a.distance !== null ? -1 : b.distance !== null ? 1
          : closeness(a) - closeness(b))
  }, [stores, origin, pincode, deliveryCity])

  const hasLocation = Boolean(origin) || Boolean(pincode) || Boolean(deliveryCity)

  return {
    stores: ranked,
    loading,
    error,
    retry: () => setAttempt(value => value + 1),
    pincode,
    nearestId: hasLocation ? ranked[0]?.id : undefined,
  }
}

export function formatDistance(distance: number | null): string {
  if (distance === null) return ""
  return `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} km away`
}
