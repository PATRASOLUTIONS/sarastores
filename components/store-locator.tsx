"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { AlertCircle, ArrowRight, ChevronRight, Loader2, MapPin, MessageCircle, Phone, Search, Target, X } from "lucide-react"
import type { Store } from "@/lib/store-data"
import { analytics } from "@/lib/analytics"
import { useSettingsData } from "@/hooks/useSettingsData"
import { calculateDistance, coordinates, type Coordinates } from "@/lib/geo-client"
import Header from "./Header"
import Footer from "./Footer"
import { StoreLocatorHero, StoreLocatorTrust } from "./store-locator-chrome"
import { StoreEnquiryDialog } from "./store-enquiry-dialog"
import { StoreGooglePhoto } from "./store-google-photo"
import styles from "./store-locator.module.css"

const StoreMap = dynamic(() => import("./google-store-map"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}><Loader2 className="h-6 w-6 animate-spin" /><span>Loading map...</span></div>,
})

type SearchPlace = Coordinates & { label: string }
type LocatedStore = Store & { coords: Coordinates | null; distance: number | null; brand: string | null }

function storeBrand(name: string): string | null {
  const brand = name.match(/\b(MI|XIAOMI|SAMSUNG|LG|SONY|VIVO|OPPO|REALME|ONEPLUS|APPLE)\b/i)?.[1].toUpperCase()
  return brand === "MI" || brand === "XIAOMI" ? "Xiaomi / MI" : brand || null
}

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return ["id", "name", "address", "city", "region", "phone", "hours"].every((key) => typeof record[key] === "string") &&
    typeof record.isOpen === "boolean"
}

async function searchPlaces(query: string, signal: AbortSignal): Promise<SearchPlace[]> {
  const response = await fetch(`/api/stores/search?query=${encodeURIComponent(query)}`, { signal })
  const data: unknown = await response.json()
  if (!response.ok || !data || typeof data !== "object" || !("places" in data) || !Array.isArray(data.places)) {
    throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Place search is unavailable. Please try again.")
  }
  const places: SearchPlace[] = []
  for (const value of data.places) {
    if (value && typeof value === "object" && "lat" in value && "lng" in value && "label" in value && typeof value.label === "string") {
      const coords = coordinates(value.lat, value.lng)
      if (coords) places.push({ ...coords, label: value.label })
    }
  }
  if (!places.length) throw new Error("No place found. Add the city to the office name, or try its address or pincode.")
  return places
}

function openingStatus(hours: string, now: Date | null): "Open Now" | "Closed Now" | null {
  if (!now) return null
  const match = hours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null
  if ([match[1], match[4]].some((hour) => Number(hour) < 1 || Number(hour) > 12) ||
    [match[2], match[5]].some((minute) => Number(minute) > 59)) return null
  const minutes = (hour: string, minute: string, period: string) => (Number(hour) % 12 + (period.toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(minute)
  const start = minutes(match[1], match[2], match[3])
  const end = minutes(match[4], match[5], match[6])
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const current = Number(parts.find((part) => part.type === "hour")?.value) * 60 + Number(parts.find((part) => part.type === "minute")?.value)
  const open = start < end ? current >= start && current < end : current >= start || current < end
  return open ? "Open Now" : "Closed Now"
}

function directionsUrl(store: LocatedStore, origin: Coordinates | null): string {
  if (!origin && store.mapUrl) return store.mapUrl
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    store.coords ? `${store.coords.lat},${store.coords.lng}` : `${store.address}, ${store.city}`,
  )}${origin ? `&origin=${origin.lat},${origin.lng}` : ""}`
}

export function StoreLocator() {
  const { data: settings } = useSettingsData()
  const [stores, setStores] = useState<Store[]>([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedBrand, setSelectedBrand] = useState("all")
  const [sort, setSort] = useState("nearest")
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [enquiryStore, setEnquiryStore] = useState<Store | null>(null)
  const [showAll, setShowAll] = useState(true)
  const [view, setView] = useState<"map" | "list">("map")
  const [mapReset, setMapReset] = useState(0)
  const [gpsLocation, setGpsLocation] = useState<Coordinates | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [pincodeLocation, setPincodeLocation] = useState<Coordinates | null>(null)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeError, setPincodeError] = useState<string | null>(null)
  const [pincodeRetry, setPincodeRetry] = useState(0)
  const [placeResults, setPlaceResults] = useState<SearchPlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null)
  const [placeQuery, setPlaceQuery] = useState("")
  const [placeLoading, setPlaceLoading] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const placeRequest = useRef<AbortController | null>(null)
  const [radiusKm, setRadiusKm] = useState(25)
  const [now, setNow] = useState<Date | null>(null)
  const locationRequest = useRef(0)
  const isPincodeSearch = /^[1-9]\d{5}$/.test(searchQuery.trim())
  const activePlace = placeQuery === searchQuery.trim() ? selectedPlace : null
  const userLocation = isPincodeSearch ? pincodeLocation : activePlace || gpsLocation
  const genericPhoto = settings?.storefrontImage || "/store-locator/storefront.webp"

  useEffect(() => {
    analytics.viewStoreLocator("store_locator_page")
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => { clearInterval(timer); locationRequest.current++; placeRequest.current?.abort() }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadStores() {
      setIsDataLoading(true)
      setDataError(null)
      try {
        const response = await fetch("/api/stores", { signal: controller.signal, cache: "no-store" })
        const data: unknown = await response.json()
        if (!response.ok || !data || typeof data !== "object" || !("success" in data) || data.success !== true ||
          !("stores" in data) || !Array.isArray(data.stores) || !data.stores.every(isStore)) {
          throw new Error("Unable to load stores. Please try again.")
        }
        // Shuffle once per successful load; filtering keeps this order stable.
        const shuffled = [...data.stores]
        for (let index = shuffled.length - 1; index > 0; index--) {
          const other = Math.floor(Math.random() * (index + 1))
          const value = shuffled[index]
          shuffled[index] = shuffled[other]
          shuffled[other] = value
        }
        setStores(shuffled)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("Failed to load stores:", error)
        setDataError(error instanceof Error ? error.message : "Unable to load stores. Please try again.")
      } finally {
        if (!controller.signal.aborted) setIsDataLoading(false)
      }
    }
    void loadStores()
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    const controller = new AbortController()
    setPincodeLocation(null)
    setPincodeError(null)
    setPincodeLoading(isPincodeSearch)
    if (!isPincodeSearch) return () => controller.abort()
    const pincode = searchQuery.trim()
    const timer = setTimeout(async () => {
      try {
        const places = await searchPlaces(pincode, controller.signal)
        const coords = places[0]
        if (controller.signal.aborted) return
        setPincodeLocation(coords)
        analytics.checkPincode(pincode, true, "store_locator")
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("Store pincode lookup failed:", error)
        setPincodeError(error instanceof Error ? error.message : "Pincode lookup failed. Please try again.")
        analytics.checkPincode(pincode, false, "store_locator")
      } finally {
        if (!controller.signal.aborted) setPincodeLoading(false)
      }
    }, 600)
    return () => { clearTimeout(timer); controller.abort() }
  }, [searchQuery, isPincodeSearch, pincodeRetry])

  useEffect(() => {
    placeRequest.current?.abort()
    setPlaceResults([])
    setSelectedPlace(null)
    setPlaceLoading(false)
    setPlaceError(null)
  }, [searchQuery])

  async function findPlace() {
    const query = searchQuery.trim()
    if (query.length < 3) {
      setPlaceError("Enter an office name, place or address with at least 3 characters.")
      return
    }
    if (isPincodeSearch) {
      setPincodeRetry((value) => value + 1)
      setSort("nearest")
      return
    }
    placeRequest.current?.abort()
    const controller = new AbortController()
    placeRequest.current = controller
    setPlaceLoading(true)
    setPlaceError(null)
    setSelectedPlace(null)
    setPlaceResults([])
    try {
      const places = await searchPlaces(query, controller.signal)
      if (controller.signal.aborted) return
      setPlaceQuery(query)
      setPlaceResults(places)
      setSelectedPlace(places[0])
      setSelectedCity("all")
      setSort("nearest")
    } catch (error) {
      if (controller.signal.aborted) return
      console.error("Store place search failed:", error)
      setPlaceError(error instanceof Error ? error.message : "Place search failed. Please try again.")
    } finally {
      if (!controller.signal.aborted) setPlaceLoading(false)
    }
  }

  useEffect(() => {
    setShowAll(true)
    setSelectedStore(null)
  }, [searchQuery, selectedCity, selectedType, selectedBrand, radiusKm, userLocation])

  function clearLocation() {
    locationRequest.current++
    placeRequest.current?.abort()
    setPlaceLoading(false)
    setPlaceError(null)
    setGpsLocation(null)
    setLocationLoading(false)
    setLocationError(null)
    setSelectedPlace(null)
    setPlaceResults([])
    if (isPincodeSearch || activePlace) setSearchQuery("")
  }

  function resetFilters() {
    setSearchQuery("")
    setSelectedCity("all")
    setSelectedType("all")
    setSelectedBrand("all")
    setRadiusKm(25)
    clearLocation()
  }

  function getCurrentLocation(automatic = false) {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.")
      return
    }
    const request = ++locationRequest.current
    setLocationLoading(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition((position) => {
      if (request !== locationRequest.current) return
      if (!automatic) setSearchQuery("")
      setGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
      setSort("nearest")
      setLocationLoading(false)
    }, (error) => {
      if (request !== locationRequest.current) return
      setGpsLocation(null)
      setLocationError(error.code === 1 ? "Location access wasn't granted. Showing stores in a shuffled order; you can still search by city or pincode." :
        error.code === 3 ? "Location request timed out. Please try again." : "Unable to retrieve your location. Please try again.")
      setLocationLoading(false)
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
  }

  useEffect(() => {
    getCurrentLocation(true)
    return () => { locationRequest.current++ }
  }, [])

  const locatedStores = useMemo<LocatedStore[]>(() => stores.map((store) => {
    const coords = coordinates(store.latitude, store.longitude)
    return { ...store, coords, distance: userLocation && coords ? calculateDistance(userLocation, coords) : null, brand: storeBrand(store.name) }
  }), [stores, userLocation])

  const cities = useMemo(() => [...new Set(stores.map((store) => store.city).filter(Boolean))].sort(), [stores])
  const types = useMemo(() => [...new Set(stores.map((store) => store.region).filter(Boolean))].sort(), [stores])
  const brands = useMemo(() => [...new Set(locatedStores.map((store) => store.brand).filter((brand): brand is string => !!brand))].sort(), [locatedStores])
  const matchingStores = useMemo(() => locatedStores.filter((store) => {
    const text = searchQuery.trim().toLowerCase()
    const matchesSearch = isPincodeSearch || !!activePlace || [store.name, store.address, store.city, store.pincode || ""].some((value) => value.toLowerCase().includes(text))
    return matchesSearch && (selectedCity === "all" || store.city === selectedCity) &&
      (selectedType === "all" || store.region === selectedType) && (selectedBrand === "all" || store.brand === selectedBrand)
  }), [locatedStores, searchQuery, isPincodeSearch, activePlace, selectedCity, selectedType, selectedBrand])
  const nearestFallback = useMemo(() => {
    if (!userLocation) return null
    if (matchingStores.some((store) => store.distance !== null && store.distance <= radiusKm)) return null
    const candidates = matchingStores.filter((store) => store.distance !== null)
    const networkFallback = candidates.length === 0
    const nearest = [...(networkFallback ? locatedStores.filter((store) => store.distance !== null) : candidates)]
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0]
    return nearest ? { store: nearest, networkFallback } : null
  }, [userLocation, matchingStores, locatedStores, radiusKm])
  const filteredStores = useMemo(() => {
    if (nearestFallback) return [nearestFallback.store]
    return matchingStores.filter((store) => !userLocation || (store.distance !== null && store.distance <= radiusKm)).sort((a, b) => {
    if (sort === "nearest") return userLocation ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : 0
    return sort === "name-desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
    })
  }, [matchingStores, nearestFallback, userLocation, radiusKm, sort])
  const visibleStores = showAll ? filteredStores : filteredStores.slice(0, 5)
  const nearestStoreId = useMemo(() => userLocation ? [...filteredStores].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0]?.id : null, [filteredStores, userLocation])
  const filterActive = !!searchQuery || selectedCity !== "all" || selectedType !== "all" || selectedBrand !== "all" || !!userLocation

  function selectStore(id: string) {
    setSelectedStore(id)
    if (filteredStores.findIndex((store) => store.id === id) >= 5) setShowAll(true)
  }

  const viewTabs = (
    <div className={styles.viewTabs} role="group" aria-label="Store display">
      <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
      <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
    </div>
  )

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link><ChevronRight size={12} /><span>Store Locator</span>
        </nav>
        <StoreLocatorHero />
        <section className={styles.filters} aria-label="Find a store">
          <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void findPlace() }}>
            <input name="storeSearch" maxLength={200} aria-label="Search by office, place, city or pincode" placeholder="Office, place, city or pincode" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            <button type="submit" aria-label="Search for this place" disabled={placeLoading || pincodeLoading}>
              {pincodeLoading || placeLoading ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
            </button>
          </form>
          <select aria-label="City" value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}>
            <option value="all">All Cities</option>
            {cities.map((city) => <option key={city}>{city}</option>)}
          </select>
          <select aria-label="Store type" value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="all">All Store Types</option>
            {types.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select aria-label="Store brand" value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}>
            <option value="all">All Brands</option>
            {brands.map((brand) => <option key={brand}>{brand}</option>)}
          </select>
          <button className={styles.locationButton} type="button" onClick={() => getCurrentLocation()} disabled={locationLoading}>
            {locationLoading ? <Loader2 size={19} className="animate-spin" /> : <Target size={19} />}
            {locationLoading ? "Detecting..." : "Use My Location"}
          </button>
        </section>
        <p className={styles.searchHint}>Search a store, place or pincode. Select a store to view its Google Map, photos and directions.</p>
        {placeLoading && <p role="status" className={styles.searchHint}>Finding this place...</p>}
        {placeResults.length > 0 && <section className={styles.placeResults} aria-label="Matching places">
          <p>{placeResults.length > 1 ? "Choose the correct place. Nearest stores are shown for the selected result." : "Showing stores nearest to this place."}</p>
          {placeResults.map((place, index) => <button key={`${place.lat},${place.lng},${index}`} type="button" aria-pressed={activePlace === place} onClick={() => { setSelectedPlace(place); setSort("nearest") }}><MapPin size={16} /><span>{place.label}</span></button>)}
        </section>}
        {(userLocation || filterActive || pincodeLoading) && (
          <div className={styles.filterStatus} aria-live="polite">
            {pincodeLoading && <span>Looking up pincode {searchQuery.trim()}...</span>}
            {userLocation && <><span>{isPincodeSearch ? `Near pincode ${searchQuery.trim()}` : activePlace ? `Near ${activePlace.label}` : "Near your location"}</span>
              <label>Within <select aria-label="Search radius" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
                {[5, 10, 25, 50, 100].map((radius) => <option key={radius} value={radius}>{radius} km</option>)}
              </select></label><button type="button" onClick={clearLocation}>Clear location</button></>}
            {selectedBrand !== "all" && <span>Showing stores explicitly named for {selectedBrand}.</span>}
            {filterActive && <button type="button" onClick={resetFilters}>Reset filters</button>}
          </div>
        )}
        {nearestFallback && <p className={styles.fallbackNotice} role="status">{nearestFallback.networkFallback ? "No mapped stores match your filters. Showing the nearest SARA store across the network." : `No matching stores within ${radiusKm} km. Showing the nearest available SARA store instead.`}</p>}
        {(locationError || pincodeError || placeError) && (
          <div className={styles.error} role="alert">
            <AlertCircle size={18} /><span>{locationError || pincodeError || placeError}</span>
            {placeError && searchQuery.trim().length >= 3 && <button type="button" onClick={() => void findPlace()}>Retry place search</button>}
            {pincodeError && <button type="button" onClick={() => setPincodeRetry((value) => value + 1)}>Retry lookup</button>}
            <button type="button" aria-label="Dismiss location error" onClick={() => { setLocationError(null); setPincodeError(null); setPlaceError(null) }}><X size={16} /></button>
          </div>
        )}
        <section className={`${styles.results} ${view === "list" ? styles.listView : ""}`} aria-label="Store results">
          <div className={styles.storeColumn}>
            <div className={styles.resultsHeading}>
              <h2>Our Stores <span>({isDataLoading ? "Loading..." : `${filteredStores.length} Stores`})</span></h2>
              <label>Sort By: <select aria-label="Sort stores" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="nearest">{userLocation ? "Nearest First" : "Suggested order"}</option><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option>
              </select></label>
            </div>
            {view === "list" && <div className={styles.listViewToolbar}>{viewTabs}</div>}
            {!isDataLoading && <p className={styles.distanceHint}>{userLocation ? "Distances are approximate, straight-line distances. Google Maps shows the driving route." : "Showing stores in a shuffled order. Use your location or search a pincode to find nearby stores."}</p>}
            {isDataLoading ? <div className={styles.empty} role="status"><Loader2 className="animate-spin" /><p>Loading stores...</p></div> :
              dataError ? <div className={styles.empty} role="alert"><AlertCircle /><p>{dataError}</p><button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div> :
              filteredStores.length === 0 ? <div className={styles.empty}><MapPin /><h3>No stores found</h3><p>{userLocation ? `No matching stores within ${radiusKm} km. Widen the radius or reset filters.` : "Try another city, area or store type."}</p><button type="button" onClick={resetFilters}>Show All Stores</button></div> :
              <div className={`${styles.storeList} ${showAll ? styles.expandedList : ""}`}>
                {visibleStores.map((store) => {
                  const status = openingStatus(store.hours, now)
                  return (
                    <article key={store.id} className={`${styles.storeCard} ${selectedStore === store.id ? styles.selectedCard : ""}`} data-store-id={store.id}
                      onClick={event => { if (event.target instanceof Element && !event.target.closest("a, button")) setEnquiryStore(store) }}>
                      <StoreGooglePhoto store={store} fallback={genericPhoto} />
                      <div className={styles.storeDetails}>
                        <h3><button type="button" aria-haspopup="dialog" onClick={() => { selectStore(store.id); setEnquiryStore(store) }}>{store.name}</button></h3>
                        <p className={styles.address}>{store.address}</p>
                        <div className={styles.hours}><span className={status === "Open Now" ? styles.open : styles.closed}>{status && <i />}{status || "Opening hours"}</span><span>{store.hours}</span></div>
                        {store.phone && <a className={styles.phone} href={`tel:${store.phone}`} onClick={() => analytics.callClick("store_locator", store.phone)}><Phone size={12} />{store.phone}</a>}
                        <div className={styles.tags}><span>{store.region}</span>{store.brand && <span>{store.brand}</span>}{store.id === nearestStoreId && <span>Nearest Store</span>}</div>
                      </div>
                      <div className={styles.cardActions}>
                        {store.distance !== null && <strong>{store.distance < 10 ? store.distance.toFixed(1) : Math.round(store.distance)} km</strong>}
                        <button type="button" className={styles.mapSelect} aria-label={`View ${store.name} on Google Maps`} onClick={() => { selectStore(store.id); setView("map") }}><MapPin size={20} /></button>
                        {store.phone && <a className={styles.whatsapp} href={`https://wa.me/91${store.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Hi ${store.name}, I would like to know about your products, pricing and available offers.`)}`} target="_blank" rel="noopener noreferrer" onClick={() => analytics.whatsappClick("store_locator", { store_id: store.id, city: store.city })}><MessageCircle size={12} />WhatsApp</a>}
                        <a className={styles.directions} href={directionsUrl(store, userLocation)} target="_blank" rel="noopener noreferrer">Get Directions <ArrowRight size={13} /></a>
                      </div>
                    </article>
                  )
                })}
              </div>}
            {!isDataLoading && !dataError && filteredStores.length > 5 && <button className={styles.viewAll} type="button" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "Show Fewer Stores" : `View All ${filteredStores.length} Stores`} <ArrowRight size={16} />
            </button>}
          </div>
          {view === "map" && <div className={`${styles.mapPanel} ${styles.googleMapPanel}`}>
            <div className={styles.googleMapHeading}>{viewTabs}<span>Google Maps · {filteredStores.find(store => store.id === selectedStore)?.name || filteredStores[0]?.name || "Our stores"}</span>
              <button type="button" aria-label="Reset Google Map to the first matching store" onClick={() => { setSelectedStore(null); setMapReset((value) => value + 1) }}><Target size={18} /></button>
            </div>
            <div className={styles.googleMapFrame}><StoreMap stores={filteredStores} selectedStore={selectedStore} resetKey={mapReset} /></div>
          </div>}
        </section>
        <StoreLocatorTrust />
      </div>
      <Footer />
      {enquiryStore && <StoreEnquiryDialog key={enquiryStore.id} store={enquiryStore} origin={userLocation} onClose={() => setEnquiryStore(null)} />}
    </div>
  )
}
