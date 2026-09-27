"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, MapPin, Phone, Store, Truck } from "lucide-react"
import { analytics } from "@/lib/analytics"

/**
 * Click & Pick fulfilment selector ("OMNICHANNEL — THIS SHOULD BE A TOP PRIORITY").
 *
 * Lets the shopper choose home delivery or collection from a SARA store. Store
 * availability is shown as "reserve on confirmation" because per-store stock
 * comes from SAP, which is not connected yet — see
 * docs/brd/PENDING-EXTERNAL-INTEGRATIONS.md (SAP-02, SAP-06).
 */

export type FulfilmentMethod = "delivery" | "pickup"

export interface PickupStore {
  id: string
  name: string
  address: string
  city: string
  phone: string
  hours: string
}

interface ApiStore {
  id: string
  name: string
  address: string
  city: string
  phone: string
  hours: string
}

export default function FulfilmentSelector({
  method,
  onMethodChange,
  selectedStore,
  onStoreChange,
}: {
  method: FulfilmentMethod
  onMethodChange: (method: FulfilmentMethod) => void
  selectedStore: PickupStore | null
  onStoreChange: (store: PickupStore | null) => void
}) {
  const [stores, setStores] = useState<ApiStore[]>([])
  const [city, setCity] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (method !== "pickup" || stores.length > 0) return

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/stores")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data?.success || !Array.isArray(data.stores)) return
        setStores(data.stores)
      } catch {
        // Pickup simply stays unavailable if stores can't be loaded.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [method, stores.length])

  const cities = useMemo(
    () => Array.from(new Set(stores.map((store) => store.city).filter(Boolean))).sort(),
    [stores],
  )

  const visibleStores = useMemo(
    () => (city ? stores.filter((store) => store.city === city) : stores),
    [stores, city],
  )

  return (
    <div className="mt-6">
      <h3 className="mb-4 flex items-center text-lg font-medium">
        <Truck className="mr-2 h-5 w-5" />
        How would you like to receive your order?
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            onMethodChange("delivery")
            onStoreChange(null)
            analytics.selectFulfilment("delivery")
          }}
          aria-pressed={method === "delivery"}
          className={`rounded-lg border p-4 text-left transition-colors ${
            method === "delivery"
              ? "border-brand-primary bg-brand-primary-subtle"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Truck className="h-4 w-4" />
            Home delivery
          </span>
          <span className="mt-1 block text-sm text-gray-600">
            Delivered to your address with installation support
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onMethodChange("pickup")
            analytics.viewStoreLocator("checkout")
          }}
          aria-pressed={method === "pickup"}
          className={`rounded-lg border p-4 text-left transition-colors ${
            method === "pickup"
              ? "border-brand-primary bg-brand-primary-subtle"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Store className="h-4 w-4" />
            Pick up from store
          </span>
          <span className="mt-1 block text-sm text-gray-600">
            Collect from your nearest SARA store — no delivery charge
          </span>
        </button>
      </div>

      {method === "pickup" && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {loading ? (
            <p className="text-sm text-gray-600">Loading stores…</p>
          ) : stores.length === 0 ? (
            <p className="text-sm text-gray-600">
              Store pickup is unavailable right now. Please choose home delivery.
            </p>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Filter by city
                <select
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value)
                    onStoreChange(null)
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">All cities</option>
                  {cities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {visibleStores.map((store) => {
                  const isSelected = selectedStore?.id === store.id
                  return (
                    <li key={store.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const picked = {
                            id: store.id,
                            name: store.name,
                            address: store.address,
                            city: store.city,
                            phone: store.phone,
                            hours: store.hours,
                          }
                          onStoreChange(picked)
                          analytics.selectStore({
                            storeId: store.id,
                            storeName: store.name,
                            city: store.city,
                            source: "checkout_pickup",
                          })
                          analytics.selectFulfilment("pickup", store.name)
                        }}
                        aria-pressed={isSelected}
                        className={`w-full rounded-lg border bg-white p-3 text-left transition-colors ${
                          isSelected
                            ? "border-brand-primary ring-1 ring-brand-primary"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="block font-medium text-gray-900">{store.name}</span>
                        {store.address && (
                          <span className="mt-1 flex items-start gap-1.5 text-xs text-gray-600">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {store.address}
                          </span>
                        )}
                        <span className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {store.hours}
                          </span>
                          {store.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {store.phone}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {selectedStore && (
                <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                  Collecting from <strong>{selectedStore.name}</strong>. We will confirm stock and
                  message you when your order is ready for pickup.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
