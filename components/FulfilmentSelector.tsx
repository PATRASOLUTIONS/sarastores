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
 * Lets the shopper choose home delivery or collection from a SARA store. Only
 * stores whose uploaded stock (/admin/stock-check) covers the whole cart are
 * offered.
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
  /** Stores that hold the whole cart; stores outside it are not offered. */
  stock: StoreStockState
  children?: ReactNode
}) {
  const { stores: nearbyStores, loading: storesLoading, error: storesError, retry: retryStores, pincode, nearestId: nearbyNearestId } = useNearbyStores(deliveryPincode, deliveryCity)
  const rankedStores = useMemo(
    () => stock.storeIds ? nearbyStores.filter((store) => stock.storeIds!.has(store.id)) : [],
    [nearbyStores, stock.storeIds],
  )
  const nearestId = nearbyNearestId ? rankedStores[0]?.id : undefined
  const loading = storesLoading || stock.loading || (!stock.storeIds && !stock.error)
  const error = storesError || stock.error
  const retry = () => { retryStores(); stock.retry() }
  const farMessage = farStoreMessage(rankedStores[0]?.distance, stock.farDistanceKm)

  useEffect(() => {
    if (selectedStore && stock.storeIds && !stock.storeIds.has(selectedStore.id)) onStoreChange(null)
  }, [selectedStore, stock.storeIds, onStoreChange])
  const [city, setCity] = useState("")
  const [expanded, setExpanded] = useState(false)
  const { data: settings } = useSettingsData()
  const genericPhoto = settings?.storefrontImage || "/store-locator/storefront.webp"

  const cities = useMemo(
    () => Array.from(new Set(rankedStores.map((store) => checkoutCity(store.city)).filter(Boolean))).sort(),
    [rankedStores],
  )

  const visibleStores = useMemo(
    () => {
      const filtered = city ? rankedStores.filter((store) => checkoutCity(store.city) === city) : rankedStores
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
        <div className={styles.stores}>
          <div className={styles.storeHeading}><h3>{pincode ? `Stores near ${pincode}` : "Stores for Pickup"}</h3>
            <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer stores" : "View All Stores"}</button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading stores…</p>
          ) : error ? <p role="alert" className="text-sm text-red-700">{error} Please retry or choose home delivery. <button type="button" className="underline" onClick={retry}>Retry stores</button></p> : rankedStores.length === 0 ? (
            <p className="text-sm text-gray-600">
              None of our stores has every item in your cart in stock. Please choose home delivery.
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

              {farMessage && <p role="note" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{farMessage}</p>}
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
                        <small className={styles.storeCity}>
                          {checkoutCity(store.city)}
                          {store.distance !== null && ` · ${formatDistance(store.distance)}`}
                        </small>
                        {store.id === nearestId && <small className={styles.storeReady}><MapPin size={10} />Nearest to your address</small>}
                        {store.address && (
                          <span className={styles.storeAddress} title={store.address}>
                            {store.address}
                          </span>
                        )}
                        <small className={styles.storeReady}><CheckCircle size={10} />Items in stock</small>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {method === "pickup" && selectedStore && (
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
        </div>
    </div>
  )
}
