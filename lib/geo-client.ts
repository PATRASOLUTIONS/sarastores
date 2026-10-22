export type Coordinates = { lat: number; lng: number }

export function coordinates(lat: unknown, lng: unknown): Coordinates | null {
  return typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/** Great-circle distance in kilometres. */
export function calculateDistance(a: Coordinates, b: Coordinates): number {
  const radians = Math.PI / 180
  const lat = (b.lat - a.lat) * radians
  const lng = (b.lng - a.lng) * radians
  const haversine = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
}

export function coordinatesFromGeocode(value: unknown): Coordinates | null {
  if (!Array.isArray(value)) return null
  const first: unknown = value[0]
  if (!first || typeof first !== "object" || !("lat" in first) || !("lon" in first)) return null
  const parse = (coordinate: unknown) => typeof coordinate === "number" ? coordinate :
    typeof coordinate === "string" && coordinate.trim() ? Number(coordinate) : NaN
  return coordinates(parse(first.lat), parse(first.lon))
}

export async function geocodePincode(pincode: string, signal: AbortSignal): Promise<Coordinates> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`,
    { signal, headers: { "Accept-Language": "en" } },
  )
  if (!response.ok) throw new Error("Pincode lookup is unavailable. Please try again.")
  const coords = coordinatesFromGeocode(await response.json())
  if (coords) return coords
  const postalResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal })
  if (!postalResponse.ok) throw new Error("Pincode lookup is unavailable. Please try again.")
  const postalData: unknown = await postalResponse.json()
  const first: unknown = Array.isArray(postalData) ? postalData[0] : null
  if (first && typeof first === "object" && "Status" in first && first.Status === "Success" && "PostOffice" in first && Array.isArray(first.PostOffice)) {
    const office: unknown = first.PostOffice[0]
    if (office && typeof office === "object" && "Name" in office && typeof office.Name === "string" &&
      "District" in office && typeof office.District === "string" && "State" in office && typeof office.State === "string") {
      const query = `${office.Name}, ${office.District}, ${office.State}, India`
      const fallback = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { signal })
      if (!fallback.ok) throw new Error("Pincode lookup is unavailable. Please try again.")
      const fallbackCoords = coordinatesFromGeocode(await fallback.json())
      if (fallbackCoords) return fallbackCoords
    }
  }
  throw new Error(`Could not find location for pincode ${pincode}. Please check and try again.`)
}
