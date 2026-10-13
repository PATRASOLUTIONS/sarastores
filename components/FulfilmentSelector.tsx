"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { CheckCircle, MapPin, Store, Truck, Zap } from "lucide-react"
import { analytics } from "@/lib/analytics"
import { checkoutCity } from "@/lib/checkout-region"
import { useSettingsData } from "@/hooks/useSettingsData"
import styles from "./FulfilmentSelector.module.css"

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
  state?: string
  pincode?: string
  image?: string
}

interface ApiStore {
  id: string
  name: string
  address: string
  city: string
  phone: string
  hours: string
  state?: string
  pincode?: string
  image?: string
}

export default function FulfilmentSelector({
  method,
  onMethodChange,
  selectedStore,
  onStoreChange,
  deliveryFeeLabel = "Charges confirmed at payment",
  children,
}: {
  method: FulfilmentMethod
  onMethodChange: (method: FulfilmentMethod) => void
  selectedStore: PickupStore | null
  onStoreChange: (store: PickupStore | null) => void
  deliveryFeeLabel?: string
  children?: ReactNode
}) {
  const [stores, setStores] = useState<ApiStore[]>([])
  const [city, setCity] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const { data: settings } = useSettingsData()
  const genericPhoto = settings?.storefrontImage || "/store-locator/storefront.webp"

  useEffect(() => {
    if (stores.length > 0) return

    let cancelled = false
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const res = await fetch("/api/stores")
        if (!res.ok) throw new Error("Stores could not be loaded.")
        const data = await res.json()
        if (cancelled) return
        if (!data?.success || !Array.isArray(data.stores)) throw new Error("Invalid stores response.")
        setStores(data.stores.filter((store: ApiStore) => checkoutCity(store.city || "") &&
          (!store.state || store.state.trim().toLowerCase() === "karnataka")))
      } catch (error) {
        if (cancelled) return
        console.error("[Checkout] Store pickup failed:", error)
        setError("Stores could not be loaded. Please retry or choose home delivery.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [stores.length, attempt])

  const cities = useMemo(
    () => Array.from(new Set(stores.map((store) => checkoutCity(store.city)).filter(Boolean))).sort(),
    [stores],
  )

  const visibleStores = useMemo(
    () => {
      const filtered = city ? stores.filter((store) => checkoutCity(store.city) === city) : stores
      return expanded ? filtered : filtered.slice(0, 3)
    },
    [stores, city, expanded],
  )

  return (
    <div>

      <div className={styles.options}>
        <button
          type="button"
          onClick={() => {
            onMethodChange("delivery")
            onStoreChange(null)
            analytics.selectFulfilment("delivery")
          }}
          aria-pressed={method === "delivery"}
          className={method === "delivery" ? styles.selectedOption : undefined}
        >
          <Truck size={23} /><span><strong>Home delivery</strong><small>Bangalore &amp; Mysore</small><b>{deliveryFeeLabel}</b></span>
        </button>

        <button type="button" disabled className={styles.unavailableOption}>
          <Zap size={23} /><span><strong>Express Delivery</strong><small>Currently unavailable</small><b>Not offered yet</b></span>
        </button>

        <button
          type="button"
          onClick={() => {
            onMethodChange("pickup")
            analytics.viewStoreLocator("checkout")
          }}
          aria-pressed={method === "pickup"}
          className={method === "pickup" ? styles.selectedOption : undefined}
        >
          <Store size={23} /><span><strong>Pick up from store</strong><small>Collect from a SARA store</small><b>FREE</b></span>
        </button>
      </div>

      {children}
        <div className={styles.stores}>
          <div className={styles.storeHeading}><h3>Stores for Pickup</h3>
            <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer stores" : "View All Stores"}</button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading stores…</p>
          ) : error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Retry stores</button></p> : stores.length === 0 ? (
            <p className="text-sm text-gray-600">
              Store pickup is unavailable right now. Please choose home delivery.
            </p>
          ) : (
            <>
              {expanded && <label className={styles.cityFilter}>
                Filter by city
                <select
                  aria-label="Pickup city"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value)
                    onStoreChange(null)
                  }}
                >
                  <option value="">Bangalore &amp; Mysore</option>
                  {cities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>}

              <ul className={styles.storeGrid}>
                {visibleStores.map((store) => {
                  const isSelected = method === "pickup" && selectedStore?.id === store.id
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
                            state: store.state,
                            pincode: store.pincode,
                            image: store.image,
                          }
                          onStoreChange(picked)
                          onMethodChange("pickup")
                          analytics.selectStore({
                            storeId: store.id,
                            storeName: store.name,
                            city: store.city,
                            source: "checkout_pickup",
                          })
                          analytics.selectFulfilment("pickup", store.name)
                        }}
                        aria-pressed={isSelected}
                        aria-label={`Collect from ${store.name}`}
                        className={isSelected ? styles.selectedStore : undefined}
                      >
                        <span className={styles.storeRadio} aria-hidden="true" />
                        <div className={styles.storeImage}>
                          <img src={store.image || genericPhoto} alt={store.image ? store.name : "SARA storefront illustration"}
                            onError={event => {
                              const image = event.currentTarget
                              if (image.getAttribute("src") !== "/store-locator/storefront.webp") image.src = "/store-locator/storefront.webp"
                            }} />
                        </div>
                        <strong>{store.name}</strong>
                        <small className={styles.storeCity}>{checkoutCity(store.city)}</small>
                        {store.address && (
                          <span className={styles.storeAddress} title={store.address}>
                            {store.address}
                          </span>
                        )}
                        <small className={styles.storeReady}><MapPin size={10} />Store will confirm availability</small>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {method === "pickup" && selectedStore && (
                <p className={styles.pickupConfirmation}>
                  <CheckCircle size={14} />
                  Collecting from <strong>{selectedStore.name}</strong>. We will confirm stock and
                  message you when your order is ready for pickup.
                  <span className={styles.storeContact}>
                    <span>{selectedStore.address}</span>
                    {selectedStore.hours && <span>{selectedStore.hours}</span>}
                    {selectedStore.phone && <a href={`tel:${selectedStore.phone}`}>{selectedStore.phone}</a>}
                  </span>
                </p>
              )}
            </>
          )}
        </div>
    </div>
  )
}
