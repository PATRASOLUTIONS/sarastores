"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { CheckCircle, MapPin, Store, Truck, Zap } from "lucide-react"
import { analytics } from "@/lib/analytics"
import { checkoutCity } from "@/lib/checkout-region"
import { useSettingsData } from "@/hooks/useSettingsData"
import { formatDistance, useNearbyStores } from "@/hooks/useNearbyStores"
import { farStoreMessage, type StoreStockState } from "@/hooks/useStoreStock"
import styles from "./FulfilmentSelector.module.css"

/**
 * Click & Pick fulfilment selector ("OMNICHANNEL — THIS SHOULD BE A TOP PRIORITY").
 *
 * Shows active retail stores holding the full requested cart. Uploaded
 * item-code/store-code quantities determine pickup and delivery fallback.
 */

export type FulfilmentMethod = "delivery" | "pickup"

export interface PickupStore {
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
}

export default function FulfilmentSelector({
  method,
  onMethodChange,
  selectedStore,
  onStoreChange,
  deliveryFeeLabel = "Charges confirmed at payment",
  deliveryPincode = "",
  deliveryCity = "",
  stock,
  children,
}: {
  method: FulfilmentMethod
  onMethodChange: (method: FulfilmentMethod) => void
  selectedStore: PickupStore | null
  onStoreChange: (store: PickupStore | null) => void
  deliveryFeeLabel?: string
  /** The shopper's delivery address, used to put the nearest stores first. */
  deliveryPincode?: string
  deliveryCity?: string
  /** Whole-cart eligibility and per-item quantities for every active store. */
  stock: StoreStockState
  children?: ReactNode
}) {
  const { stores: nearbyStores, loading: storesLoading, error: storesError, retry: retryStores, pincode, nearestId: nearbyNearestId } = useNearbyStores(deliveryPincode, deliveryCity, { allStores: true })
  const rankedStores = useMemo(
    () => nearbyStores.filter(store => stock.storeIds?.has(store.id)),
    [nearbyStores, stock.storeIds],
  )
  const nearestId = nearbyNearestId ? rankedStores[0]?.id : undefined
  const loading = storesLoading || stock.loading || (!stock.storeIds && !stock.error)
  const error = storesError || stock.error
  const retry = () => { retryStores(); stock.retry() }
  const farMessage = farStoreMessage(rankedStores.find(store => stock.storeIds?.has(store.id))?.distance, stock.farDistanceKm)

  useEffect(() => {
    if (!selectedStore || storesLoading || storesError) return
    const current = nearbyStores.find(store => store.id === selectedStore.id)
    if (!current) { onStoreChange(null); return }
    const refreshed: PickupStore = {
      id: current.id, storeCode: current.storeCode, name: current.name, address: current.address,
      city: current.city, phone: current.phone, hours: current.hours,
      state: current.state, pincode: current.pincode, image: current.image,
    }
    if (Object.keys(refreshed).some(field => refreshed[field as keyof PickupStore] !== selectedStore[field as keyof PickupStore])) {
      onStoreChange(refreshed)
    }
  }, [selectedStore, nearbyStores, storesLoading, storesError, onStoreChange])
  const [city, setCity] = useState("")
  const [expanded, setExpanded] = useState(true)
  const { data: settings } = useSettingsData()
  const genericPhoto = settings?.storefrontImage || "/store-locator/storefront.webp"

  const cities = useMemo(
    () => Array.from(new Set(rankedStores.map((store) => checkoutCity(store.city) || store.city.trim()).filter(Boolean))).sort(),
    [rankedStores],
  )

  useEffect(() => {
    if (city && !cities.includes(city)) setCity("")
  }, [city, cities])

  const visibleStores = useMemo(
    () => {
      const filtered = city ? rankedStores.filter((store) => (checkoutCity(store.city) || store.city.trim()) === city) : rankedStores
      return expanded ? filtered : filtered.slice(0, 3)
    },
    [rankedStores, city, expanded],
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
      {method === "delivery" && <p role="status" className="mt-3 text-sm">
        {stock.error ? <>{stock.error} <button type="button" className="underline" onClick={stock.retry}>Retry stock check</button></>
          : !stock.storeIds ? "Checking overall stock..."
            : stock.deliveryAvailable ? "Your requested quantities are available for home delivery."
              : stock.availabilityError || "Your requested quantities are unavailable for home delivery. Update your cart to continue."}
      </p>}
      {method === "pickup" && <div className={styles.stores}>
          <div className={styles.storeHeading}><h3>{pincode ? `Available pickup stores near ${pincode}` : "Available pickup stores"}</h3>
            <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer stores" : "View All Stores"}</button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading stores…</p>
          ) : error ? <p role="alert" className="text-sm text-red-700">{error} Please retry or choose home delivery. <button type="button" className="underline" onClick={retry}>Retry stores</button></p> : rankedStores.length === 0 ? (
            <p className="text-sm text-gray-600">
              No active store has all the requested quantities. {stock.deliveryAvailable ? <>
                Available for free home delivery. <button type="button" className="font-semibold underline" onClick={() => onMethodChange("delivery")}>Choose Home delivery</button>
              </> : "Please update your cart to continue."}
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
                  <option value="">All cities</option>
                  {cities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>}

              {farMessage && <p role="note" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{farMessage}</p>}
              <ul className={styles.storeGrid}>
                {visibleStores.map((store) => {
                  const isSelected = method === "pickup" && selectedStore?.id === store.id
                  const available = stock.storeIds?.has(store.id) === true
                  const details = stock.byStore[store.id] || []
                  return (
                    <li key={store.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const picked = {
                            id: store.id,
                            storeCode: store.storeCode,
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
                        <small className={styles.storeCity}>
                          {checkoutCity(store.city) || store.city}
                          {store.distance !== null && ` · ${formatDistance(store.distance)}`}
                        </small>
                        {store.id === nearestId && <small className={styles.storeReady}><MapPin size={10} />Nearest to your address</small>}
                        {store.address && (
                          <span className={styles.storeAddress} title={store.address}>
                            {store.address}
                          </span>
                        )}
                        {store.storeCode && <small>Store code: {store.storeCode}</small>}
                        <small className={available ? styles.storeReady : "mt-1 block text-xs text-amber-700"}>{available ? <><CheckCircle size={10} />Available for pickup</> : "Requested quantity unavailable here"}</small>
                        {method === "pickup" && details.map(item => <small key={item.itemCode} className="block text-xs text-slate-600">
                          Item {item.itemCode}: {item.available} available / {item.required} needed
                        </small>)}
                        {!available && stock.deliveryAvailable && <small className="block text-xs font-semibold text-green-700">Available for free home delivery</small>}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {selectedStore && !loading && !stock.storeIds?.has(selectedStore.id) && (
                <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {stock.deliveryAvailable ? <>
                    The requested quantities are unavailable at {selectedStore.name}. Available for free home delivery.
                    <button type="button" className="ml-2 font-semibold underline" onClick={() => {
                      onMethodChange("delivery")
                      analytics.selectFulfilment("delivery")
                    }}>Continue with free home delivery</button>
                  </> : "The requested quantities are not available for pickup or home delivery. Update your cart to continue."}
                </div>
              )}
              {!selectedStore && !loading && stock.storeIds?.size === 0 && stock.deliveryAvailable && <p role="status" className="mt-3 text-sm font-semibold text-green-700">Available for free home delivery. Choose Home delivery to continue.</p>}
              {method === "pickup" && selectedStore && stock.storeIds?.has(selectedStore.id) && (
                <p className={styles.pickupConfirmation}>
                  <CheckCircle size={14} />
                  Collecting from <strong>{selectedStore.name}</strong>. Your items are in stock there;
                  we will message you when your order is ready for pickup.
                  <span className={styles.storeContact}>
                    <span>{selectedStore.address}</span>
                    {selectedStore.hours && <span>{selectedStore.hours}</span>}
                    {selectedStore.phone && <a href={`tel:${selectedStore.phone}`}>{selectedStore.phone}</a>}
                  </span>
                </p>
              )}
            </>
          )}
        </div>}
    </div>
  )
}
