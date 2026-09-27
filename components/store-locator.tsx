"use client"

import { useState, useMemo, useEffect, useRef, createContext, useContext, useCallback } from "react"
import { Search, MapPin, Phone, Clock, Navigation, Store as StoreIcon, Loader2, Target, AlertCircle, X, ExternalLink, Mail, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Lightweight local Select components to avoid needing "@/components/ui/select".
 * This provides the minimal API used in this file:
 * <Select value={...} onValueChange={...}>
 *   <SelectTrigger><SelectValue placeholder="..."/></SelectTrigger>
 *   <SelectContent><SelectItem value="...">Label</SelectItem></SelectContent>
 * </Select>
 */
type LocalSelectContext = {
  value?: string | null
  onValueChange?: (v: string) => void
  open: boolean
  setOpen: (v: boolean) => void
  registerItem: (value: string, label: React.ReactNode) => void
  getLabel: (value?: string | null) => React.ReactNode | undefined
}

const SelectContext = createContext<LocalSelectContext | undefined>(undefined)

export function Select({
  value,
  onValueChange,
  children,
}: {
  value?: string | null
  onValueChange?: (v: string) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const itemsRef = useRef<Map<string, React.ReactNode>>(new Map())

  const registerItem = (val: string, label: React.ReactNode) => {
    itemsRef.current.set(val, label)
  }
  const getLabel = (val?: string | null) => (val ? itemsRef.current.get(val) : undefined)

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, registerItem, getLabel }}>
      {children}
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = useContext(SelectContext)
  if (!ctx) return null
  return (
    <button type="button" className={className} onClick={() => ctx.setOpen(!ctx.open)}>
      {children}
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(SelectContext)
  if (!ctx) return null
  const label = ctx.getLabel(ctx.value)
  return <span>{label ?? placeholder}</span>
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  const ctx = useContext(SelectContext)
  if (!ctx || !ctx.open) return null
  return <div>{children}</div>
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(SelectContext)
  useEffect(() => {
    ctx?.registerItem(value, children)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, children])
  if (!ctx) return null
  return (
    <div
      role="option"
      onClick={() => {
        ctx.onValueChange?.(value)
        ctx.setOpen(false)
      }}
      style={{ cursor: "pointer" }}
    >
      {children}
    </div>
  )
}

import { regions, Store } from "@/lib/store-data"
import { analytics } from "@/lib/analytics"
import dynamic from "next/dynamic"
import Header from "./Header"
import Footer from "./Footer"
import { StoreLocatorHero, StoreLocatorTrust } from "./store-locator-chrome"
import { useBrandImages } from "@/hooks/useBrandImages"

// Leaflet touches `window`, so the map can only render on the client.
const StoreMap = dynamic(() => import("./store-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
    </div>
  ),
})

type BadgeProps = {
  children: React.ReactNode
  variant?: "default" | "secondary" | string
  className?: string
}

/**
 * Local fallback Badge component to avoid missing import errors.
 * Keeps the same minimal API used by this file: <Badge variant="..." className="...">...</Badge>
 */
function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium"
  const variantClasses =
    variant === "secondary"
      ? "bg-secondary text-foreground"
      : variant === "default"
        ? "bg-green-600 text-white"
        : "bg-muted-foreground text-foreground"
  return <span className={`${base} ${variantClasses} ${className}`.trim()}>{children}</span>
}

// Haversine formula to calculate distance between two coordinates in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Approximate coordinates for Bangalore areas (for demo - in production, use geocoding API)
const areaCoordinates: Record<string, { lat: number; lng: number }> = {
  "BEGUR ROAD": { lat: 12.8726, lng: 77.6209 },
  "CHANDRA LAYOUT": { lat: 12.9752, lng: 77.5284 },
  "HEGANAHALLI ROAD": { lat: 13.0205, lng: 77.5186 },
  "JAYANAGAR": { lat: 12.9315, lng: 77.5825 },
  "MAGADI ROAD": { lat: 12.9754, lng: 77.5381 },
  "NAGARBHAVI": { lat: 12.9604, lng: 77.5104 },
  "HEBBAGODI 2": { lat: 12.8156, lng: 77.6686 },
  "CHANDAPURA": { lat: 12.8014, lng: 77.7045 },
  "BOMMASANDRA": { lat: 12.8161, lng: 77.6686 },
  "GOLLARAHATTI": { lat: 12.9853, lng: 77.4786 },
  "PEENYA 2ND STAGE": { lat: 13.0339, lng: 77.5195 },
  "RAJAJI NAGAR": { lat: 12.9935, lng: 77.5548 },
  "Basavakalyana": { lat: 17.8713, lng: 76.9476 },
  "Hospet": { lat: 15.2686, lng: 76.3910 },
  "Ballary": { lat: 15.1394, lng: 76.9214 },
  "Hubballi": { lat: 15.3647, lng: 75.1240 },
  "HONGASANDRA": { lat: 12.8755, lng: 77.6198 },
  "Chinthamani": { lat: 13.3996, lng: 78.0601 },
  "Bijapur": { lat: 16.8302, lng: 75.7100 },
  "YELAHANKA": { lat: 13.1007, lng: 77.5963 },
  "HONGASANDRA 2": { lat: 12.8755, lng: 77.6198 },
  "HEBBAGODI": { lat: 12.8156, lng: 77.6686 },
  "Gangavati": { lat: 15.4315, lng: 76.5317 },
  "Shivmogga": { lat: 13.9299, lng: 75.5681 },
  "Hassan": { lat: 13.0073, lng: 76.0962 },
  "Haveri": { lat: 14.7956, lng: 75.4015 },
  "JAYANAGAR 2": { lat: 12.9315, lng: 77.5825 },
  "HOSKOTE": { lat: 13.0699, lng: 77.7984 },
  "RAJAJI NAGAR 2": { lat: 12.9935, lng: 77.5548 },
  "Dharwad": { lat: 15.4589, lng: 75.0078 },
  "Nanjangud": { lat: 12.1174, lng: 76.6843 },
  "Hunsur": { lat: 12.3028, lng: 76.2918 },
  "Ramdurga": { lat: 15.4361, lng: 75.3228 },
  "Bagepalli ": { lat: 13.7823, lng: 77.7940 },
  "Bommanahalli": { lat: 12.9016, lng: 77.6229 },
  "Chikkballapur": { lat: 13.4348, lng: 77.7269 },
  "Kammanahalli": { lat: 13.0104, lng: 77.6394 },
  "Mandya ": { lat: 12.5242, lng: 76.8958 },
  "Koppal": { lat: 15.3500, lng: 76.1546 },
  "SRINIVASAPUR": { lat: 13.3330, lng: 78.2115 },
  "CHINTHAMANI": { lat: 13.3996, lng: 78.0601 },
  "RAICHUR": { lat: 16.2076, lng: 77.3463 },
  "MULBAGAL": { lat: 13.1600, lng: 78.3932 },
  "GADAG": { lat: 15.4302, lng: 75.6354 },
  "doddaballapura": { lat: 13.2949, lng: 77.5399 },
  "Sunkadakatte": { lat: 12.9853, lng: 77.4786 },
  "Chamarajanagar": { lat: 11.9261, lng: 76.9397 },
  "YESWANTHPUR": { lat: 13.0226, lng: 77.5439 },
  "DEVANAHALLI": { lat: 13.2477, lng: 77.7124 },
  "MOBILE STORE": { lat: 12.3052, lng: 76.6551 },
}

// Get store coordinates
function getStoreCoordinates(store: Store): { lat: number; lng: number } | null {
  // Check if store has direct coordinates
  if (store.latitude && store.longitude) {
    return { lat: store.latitude, lng: store.longitude }
  }
  // Fall back to area-based coordinates
  const coords = areaCoordinates[store.region]
  if (coords) return coords
  // No usable coordinates. Callers must not invent a location for these stores.
  return null
}

// Helper: check if string is a valid 6-digit Indian pincode
function isIndianPincode(value: string): boolean {
  return /^[1-9][0-9]{5}$/.test(value.trim())
}

// Geocode an Indian pincode to lat/lng using India Post API with Nominatim fallback
async function geocodePincode(pincode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Try India Post API first
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
    const data = await res.json()
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      // India Post doesn't return lat/lng directly, so use the district/state with Nominatim
      const po = data[0].PostOffice[0]
      const query = `${po.Name}, ${po.District}, ${po.State}, India`
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      )
      const nominatimData = await nominatimRes.json()
      if (nominatimData?.[0]) {
        return { lat: parseFloat(nominatimData[0].lat), lng: parseFloat(nominatimData[0].lon) }
      }
    }
  } catch {
    // Silently fall through to Nominatim-only fallback
  }

  try {
    // Fallback: search Nominatim directly with pincode
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    )
    const data = await res.json()
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch {
    // geocoding failed
  }

  return null
}

export function StoreLocator() {
  const { storefront } = useBrandImages()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRegion, setSelectedRegion] = useState<string>("all")
  const [selectedStore, setSelectedStore] = useState<string | null>(null)

  // Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [nearbyMode, setNearbyMode] = useState(false)
  const [radiusKm, setRadiusKm] = useState(25)
  const [selectedCity, setSelectedCity] = useState<string>("all")

  // Pincode search state
  const [pincodeMode, setPincodeMode] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeLocation, setPincodeLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const pincodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    analytics.viewStoreLocator("store_locator_page")
  }, [])

  // Fetch stores from DB
  useEffect(() => {
    async function fetchStores() {
      setIsDataLoading(true)
      try {
        const res = await fetch("/api/stores")
        const data = await res.json()
        if (data.success) {
          setStores(data.stores)
        }
      } catch (e) {
        console.error("Failed to fetch stores", e)
      } finally {
        setIsDataLoading(false)
      }
    }
    fetchStores()
  }, [])

  // Get user's current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      setLocationLoading(false)
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setNearbyMode(true)
        setLocationLoading(false)
      },
      (error) => {
        let errorMessage = "Unable to retrieve your location"
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable."
            break
          case error.TIMEOUT:
            errorMessage = "Location request timed out."
            break
        }
        setLocationError(errorMessage)
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  // Location is opt-in: auto-prompting on mount blocked the map behind a spinner
  // and frequently timed out.

  // Clear location filter
  const clearLocationFilter = () => {
    setUserLocation(null)
    setNearbyMode(false)
    setLocationError(null)
    setPincodeMode(false)
    setPincodeLocation(null)
  }

  // Pincode search: geocode pincode and switch to nearby mode
  const searchByPincode = useCallback(async (pincode: string) => {
    setPincodeLoading(true)
    setLocationError(null)
    const coords = await geocodePincode(pincode)
    if (coords) {
      setPincodeLocation(coords)
      setUserLocation(coords)
      setPincodeMode(true)
      setNearbyMode(true)
    } else {
      setLocationError(`Could not find location for pincode ${pincode}. Please check and try again.`)
      setPincodeMode(false)
      setPincodeLocation(null)
    }
    setPincodeLoading(false)
  }, [])

  // Watch search query for pincode pattern
  useEffect(() => {
    if (pincodeDebounceRef.current) clearTimeout(pincodeDebounceRef.current)

    const trimmed = searchQuery.trim()
    if (isIndianPincode(trimmed)) {
      // Debounce 600ms so we don't fire on every keystroke
      pincodeDebounceRef.current = setTimeout(() => {
        searchByPincode(trimmed)
        analytics.checkPincode(trimmed, true, "store_locator")
      }, 600)
    } else if (pincodeMode) {
      // User cleared the pincode — exit pincode mode
      setPincodeMode(false)
      setPincodeLocation(null)
      // Restore to non-nearby if we were only in pincode mode
      if (!navigator.geolocation) {
        setNearbyMode(false)
        setUserLocation(null)
      }
    }

    return () => {
      if (pincodeDebounceRef.current) clearTimeout(pincodeDebounceRef.current)
    }
  }, [searchQuery, searchByPincode])

  // Calculate distance for each store and filter
  const storesWithDistance = useMemo(() => {
    return stores.map((store) => {
      const coords = getStoreCoordinates(store)
      let distance: number | null = null
      if (userLocation && coords) {
        distance = calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
      }
      return { ...store, distance, coords }
    })
  }, [userLocation, stores])

  const filteredStores = useMemo(() => {
    // When in pincode mode, skip text-based search filtering (pincode IS the search)
    const isPincodeSearch = pincodeMode && isIndianPincode(searchQuery.trim())

    return storesWithDistance.filter((store) => {
      const matchesSearch = isPincodeSearch
        ? true // pincode mode: don't filter by name/address text
        : store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        store.city.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRegion = selectedRegion === "all" || store.region === selectedRegion
      const matchesCity = selectedCity === "all" || store.city === selectedCity

      // If nearby mode is on (geolocation or pincode), filter by distance
      if (nearbyMode && userLocation) {
        const withinRadius = store.distance !== null && store.distance <= radiusKm
        return matchesSearch && matchesRegion && matchesCity && withinRadius
      }

      return matchesSearch && matchesRegion && matchesCity
    }).sort((a, b) => {
      // Sort by distance if in nearby mode
      if (nearbyMode && a.distance !== null && b.distance !== null) {
        return a.distance - b.distance
      }
      return 0
    })
  }, [storesWithDistance, searchQuery, selectedRegion, selectedCity, radiusKm, nearbyMode, userLocation, pincodeMode])

  const cities = useMemo(
    () => Array.from(new Set(stores.map((s) => s.city).filter(Boolean))).sort(),
    [stores]
  )
  const mappedCount = useMemo(
    () => filteredStores.filter((s) => s.coords).length,
    [filteredStores]
  )

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <Header />

      {/* Breadcrumb */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <a href="/" className="hover:text-brand-primary transition-colors">Home</a>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-900 font-medium">Store Locator</span>
          </nav>
        </div>
      </div>

      <StoreLocatorHero />

      {/* Main Content — PAI-style two-column layout */}
      <section className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row lg:gap-[2.5%]">

            {/* LEFT COLUMN — Store List (57.5% on desktop) */}
            <div className="w-full lg:w-[57.5%] lg:flex-none py-5 lg:py-6">

              {/* Heading */}
              <h2 className="text-xl lg:text-[26px] font-bold text-gray-900 leading-tight mb-5">
                Our Stores
              </h2>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-1">
                {/* Search */}
                <div className="relative flex-1 sm:flex-[0_0_60%]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter pincode or search by name, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
                  />
                  {pincodeLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-primary animate-spin" />
                  )}
                </div>

                <span className="hidden sm:inline text-sm text-gray-500 font-medium capitalize">or</span>

                {/* Location Button */}
                <div className="flex-1">
                  {!nearbyMode ? (
                    <button
                      onClick={getCurrentLocation}
                      disabled={locationLoading}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded hover:bg-brand-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {locationLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Detecting...
                        </>
                      ) : (
                        <>
                          <Target className="w-4 h-4" />
                          Use my location
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded">
                      <Target className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 text-sm font-medium">Within {radiusKm} km</span>
                      <button
                        onClick={clearLocationFilter}
                        className="p-0.5 hover:bg-green-100 rounded transition-colors"
                        title="Clear location filter"
                      >
                        <X className="w-3.5 h-3.5 text-green-700" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* City + radius filters */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">City</span>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  >
                    <option value="all">All cities ({cities.length})</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Radius</span>
                  <select
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    disabled={!nearbyMode}
                    title={nearbyMode ? undefined : "Use my location or enter a pincode first"}
                    className="border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  >
                    {[5, 10, 25, 50, 100].map((r) => (
                      <option key={r} value={r}>{r} km</option>
                    ))}
                  </select>
                </label>

                {(selectedCity !== "all" || nearbyMode) && (
                  <button
                    onClick={() => { setSelectedCity("all"); clearLocationFilter() }}
                    className="text-sm text-brand-primary font-medium underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {/* Error Message */}
              {locationError && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded mb-3 mt-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-red-600 text-sm flex-1">{locationError}</span>
                  <button
                    onClick={() => setLocationError(null)}
                    className="p-0.5 hover:bg-red-100 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              )}

              {/* Mobile Map — shown above store list on small screens */}
              <div className="block lg:hidden my-4 rounded overflow-hidden border border-gray-200 relative" style={{ height: '320px' }}>
                <StoreMap
                  stores={filteredStores}
                  selectedStore={selectedStore}
                  onSelectStore={setSelectedStore}
                  userLocation={nearbyMode ? userLocation : null}
                  className="w-full h-full"
                />
              </div>

              {/* Pincode mode indicator */}
              {pincodeMode && pincodeLocation && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary-subtle border border-brand-primary/30 rounded mb-3 mt-3">
                  <MapPin className="w-4 h-4 text-brand-primary flex-shrink-0" />
                  <span className="text-brand-primary text-sm flex-1">
                    Showing stores within <strong>{radiusKm} km</strong> of pincode <strong>{searchQuery.trim()}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      clearLocationFilter()
                    }}
                    className="p-0.5 hover:bg-brand-primary-light rounded transition-colors"
                    title="Clear pincode search"
                  >
                    <X className="w-3.5 h-3.5 text-brand-primary" />
                  </button>
                </div>
              )}

              {/* Results Count & Loading */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-400">
                  Total of{" "}
                  <span className="font-medium text-gray-700">{filteredStores.length}</span>{" "}
                  {filteredStores.length === 1 ? "Store" : "Stores"} Found
                  {nearbyMode && userLocation && !pincodeMode && (
                    <span className="ml-1 text-gray-400">• sorted by distance</span>
                  )}
                  {pincodeMode && (
                    <span className="ml-1 text-gray-400">• within {radiusKm} km of pincode</span>
                  )}
                </p>
                {isDataLoading && (
                  <div className="flex items-center gap-2 text-brand-primary text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </div>
                )}
              </div>

              {/* Store List — horizontal cards separated by borders */}
              <div className="max-h-[calc(100vh-260px)] lg:max-h-[700px] overflow-y-auto">
                {isDataLoading && stores.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">Loading stores...</p>
                  </div>
                ) : (
                  filteredStores.map((store) => (
                    <div
                      key={store.id}
                      className={`flex flex-col sm:flex-row gap-4 p-4 mb-4 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                        selectedStore === store.id 
                          ? "bg-brand-primary-subtle/40 border-brand-primary/50 shadow-md transform -translate-y-0.5" 
                          : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-brand-primary/30"
                      }`}
                      onClick={() => setSelectedStore(store.id)}
                    >
                      {/* Stores rarely carry their own photo, so fall back to SARA storefront art. */}
                      <div className="relative h-[130px] w-full flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 sm:h-[110px] sm:w-[150px]">
                        <img
                          src={store.image || storefront}
                          alt={store.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement
                            if (img.src !== storefront) img.src = storefront
                          }}
                        />
                        {store.distance !== null && nearbyMode && (
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
                            {store.distance.toFixed(1)} km
                          </span>
                        )}
                        {!store.coords && (
                          <span
                            className="absolute left-1.5 top-1.5 rounded border border-amber-200 bg-amber-50/95 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                            title="This store has no map coordinates yet"
                          >
                            Not on map
                          </span>
                        )}
                      </div>

                      {/* Store Details */}
                      <div className="flex-1 min-w-0">
                        {/* Name + Hours Row */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-2">
                          <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1 group-hover:text-brand-primary transition-colors">
                            {store.name}
                          </h3>
                          <p className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                            Opens:{" "}
                            <span className="text-gray-700 font-medium">{store.hours}</span>
                            {store.isOpen && (
                              <span className="ml-1 inline-flex items-center gap-1 text-green-600 font-medium">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                Open
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Address */}
                        <p className="text-sm text-gray-500 leading-snug mb-3 line-clamp-2">
                          {store.address}, {store.city}
                        </p>

                        {/* Bottom Row: Contact + Direction */}
                        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-auto">
                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-gray-500 font-medium">
                              Contact Store:{" "}
                              <a
                                href={`tel:${store.phone}`}
                                className="text-gray-900 font-bold hover:text-brand-primary transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  analytics.callClick("store_locator", store.phone)
                                }}
                              >
                                {store.phone}
                              </a>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
                            {/* Animated WhatsApp Button */}
                            <button
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm shadow-green-500/30 group-hover:animate-bounce"
                              onClick={(e) => {
                                e.stopPropagation()
                                const message = encodeURIComponent(`Hi ${store.name},I’m looking to purchase and would like to know about your products, pricing, and available offers.`)
                                analytics.whatsappClick("store_locator", { store_id: store.id, city: store.city })
                                window.open(`https://wa.me/91${store.phone.replace(/\D/g, '').slice(-10)}?text=${message}`, "_blank")
                              }}
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WhatsApp
                            </button>

                            {/* Direction Button */}
                            <button
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-primary-subtle text-brand-primary hover:bg-brand-primary-light hover:text-brand-primary-hover text-[11px] uppercase tracking-wider font-bold rounded-lg transition-colors border border-brand-primary/20"
                              onClick={(e) => {
                                e.stopPropagation()
                                const coords = store.coords
                                if (coords) {
                                  window.open(`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15`, "_blank")
                                } else {
                                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address + ", " + store.city)}`, "_blank")
                                }
                              }}
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Direction
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Empty State */}
                {filteredStores.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MapPin className="w-8 h-8 text-gray-300" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-lg mb-1">No stores found</h4>
                    <p className="text-gray-500 text-sm mb-4 max-w-xs mx-auto">
                      {nearbyMode
                        ? `No stores within ${radiusKm} km of your location`
                        : "Try adjusting your search criteria"}
                    </p>
                    {nearbyMode && (
                      <button
                        onClick={clearLocationFilter}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded hover:bg-brand-primary-hover transition-colors"
                      >
                        <StoreIcon className="w-4 h-4" />
                        Show All Stores
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — Map (40% on desktop, sticky full-height) */}
            <div className="hidden lg:block lg:w-[40%] lg:flex-none">
              <div className="sticky top-0 h-screen py-6">
                <div className="w-full h-full rounded overflow-hidden border border-gray-200 bg-gray-100 relative">
                  {filteredStores.length > 0 ? (
                    <>
                      <StoreMap
                        stores={filteredStores}
                        selectedStore={selectedStore}
                        onSelectStore={setSelectedStore}
                        userLocation={nearbyMode ? userLocation : null}
                        className="w-full h-full"
                      />

                      {/* Coverage badge — z-index must clear Leaflet's map panes */}
                      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded px-3 py-2 shadow border border-gray-200 pointer-events-none">
                        <p className="text-xs font-semibold text-gray-900">
                          {mappedCount} of {filteredStores.length} stores on map
                        </p>
                        {mappedCount < filteredStores.length && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {filteredStores.length - mappedCount} missing coordinates
                          </p>
                        )}
                      </div>

                      {/* User location indicator */}
                      {nearbyMode && userLocation && (
                        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded px-3 py-2 shadow border border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-brand-primary rounded-full animate-pulse"></span>
                            <span className="text-xs font-medium text-gray-600">Your Location</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                      <MapPin className="w-10 h-10 text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium">No nearby stores to display</p>
                      <p className="text-gray-400 text-sm mt-1">Try expanding your search area</p>
                      {nearbyMode && (
                        <button
                          onClick={clearLocationFilter}
                          className="mt-4 px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded hover:bg-brand-primary-hover transition-colors"
                        >
                          Show All Stores
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <StoreLocatorTrust />

      {/* Footer */}
      <Footer />
    </div>
  )
}
