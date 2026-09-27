"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export type MapStore = {
  id: string
  name: string
  address: string
  city?: string
  phone?: string
  hours?: string
  mapUrl?: string
  distance?: number | null
  coords: { lat: number; lng: number } | null
}

function pinIcon(active: boolean) {
  const fill = active ? "#e11d48" : "#1d4ed8"
  const size = active ? 42 : 32
  return L.divIcon({
    className: "sara-store-pin",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <path d="M12 22s7-6.36 7-12A7 7 0 1 0 5 10c0 5.64 7 12 7 12Z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="10" r="2.6" fill="#fff"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 6],
  })
}

const userIcon = L.divIcon({
  className: "sara-user-pin",
  html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.3)"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/** Keeps the viewport framed on the current result set, or on the active store. */
function ViewportSync({
  points,
  active,
}: {
  points: Array<[number, number]>
  active: [number, number] | null
}) {
  const map = useMap()

  useEffect(() => {
    if (active) {
      map.flyTo(active, Math.max(map.getZoom(), 14), { duration: 0.6 })
      return
    }
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 })
    }
  }, [map, active, points])

  return null
}

export default function StoreMap({
  stores,
  selectedStore,
  onSelectStore,
  userLocation,
  className = "",
}: {
  stores: MapStore[]
  selectedStore: string | null
  onSelectStore: (id: string) => void
  userLocation: { lat: number; lng: number } | null
  className?: string
}) {
  const located = useMemo(() => stores.filter((s) => s.coords), [stores])

  const points = useMemo(
    () => located.map((s) => [s.coords!.lat, s.coords!.lng] as [number, number]),
    [located]
  )

  const active = useMemo(() => {
    const s = located.find((x) => x.id === selectedStore)
    return s ? ([s.coords!.lat, s.coords!.lng] as [number, number]) : null
  }, [located, selectedStore])

  if (located.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 text-center p-6 ${className}`}>
        <p className="text-gray-600 font-medium">No mapped stores in this view</p>
        <p className="text-gray-400 text-sm mt-1">Try widening the radius or clearing filters.</p>
      </div>
    )
  }

  return (
    <MapContainer
      center={points[0]}
      zoom={11}
      scrollWheelZoom
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ViewportSync points={points} active={active} />

      {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />}

      {located.map((store) => (
        <Marker
          key={store.id}
          position={[store.coords!.lat, store.coords!.lng]}
          icon={pinIcon(store.id === selectedStore)}
          eventHandlers={{ click: () => onSelectStore(store.id) }}
        >
          <Popup>
            <div className="min-w-[190px]">
              <p className="font-semibold text-gray-900 leading-snug">{store.name}</p>
              {store.city && <p className="text-xs text-gray-500 mt-0.5">{store.city}</p>}
              <p className="text-xs text-gray-600 mt-1 line-clamp-3">{store.address}</p>
              {typeof store.distance === "number" && (
                <p className="text-xs font-medium text-blue-700 mt-1">
                  {store.distance.toFixed(1)} km away
                </p>
              )}
              <div className="flex gap-2 mt-2">
                {store.phone && (
                  <a href={`tel:${store.phone}`} className="text-xs font-medium text-gray-700 underline">
                    Call
                  </a>
                )}
                <a
                  href={
                    store.mapUrl ||
                    `https://www.google.com/maps/dir/?api=1&destination=${store.coords!.lat},${store.coords!.lng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-700 underline"
                >
                  Directions
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
