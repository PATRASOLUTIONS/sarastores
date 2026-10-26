/** Address helpers shared by the public store lists, for stores not yet geocoded. */

export function derivePincode(address: string): string {
  const m = (address || "").match(/\b(\d{6})\b/)
  return m ? m[1] : ""
}

/** Last-resort city guess for stores that have not been geocoded yet. */
export function deriveCity(address: string): string {
  const canonical = (city: string) => {
    const aliases: Record<string, string> = {
      bangalore: "Bengaluru", banglaore: "Bengaluru", bengaluru: "Bengaluru",
      mysore: "Mysuru", mysuru: "Mysuru", ballary: "Ballari", shimoga: "Shivamogga",
    }
    return aliases[city.toLowerCase()] || city
  }
  const postalCity = address.match(/(?:^|,)\s*([a-z][a-z\s]+?)\s*-\s*\d{6}\b/i)?.[1].trim()
  if (postalCity && !/^(karnataka|india)$/i.test(postalCity)) return canonical(postalCity)
  const parts = address.split(",").map((part) => part.replace(/\b\d{6}\b/g, "").trim())
    .filter((part) => part && !/^(karnataka|india)[\s.-]*$/i.test(part))
  const district = parts.at(-1) || ""
  if (/\b(?:urban|rural)\b/i.test(district)) return canonical(district.replace(/\b(?:urban|rural)\b/gi, "").trim())
  const candidate = parts.at(-2) || ""
  const city = /^[a-z\s]+$/i.test(candidate) && !/\b(road|floor|ground|building|circle|taluk|colony|layout)\b/i.test(candidate) ? candidate : district
  return /^[a-z\s]+$/i.test(city) ? canonical(city) : ""
}

/** Coordinates from a Google Maps link (?q=lat,lng or @lat,lng). */
export function extractLatLng(url: string): { latitude?: number; longitude?: number } {
  if (!url) return {}
  const match = url.match(/[?&]q=([-0-9.]+),([-0-9.]+)/) || url.match(/@([-0-9.]+),([-0-9.]+)/)
  if (!match) return {}
  const latitude = parseFloat(match[1])
  const longitude = parseFloat(match[2])
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {}
}

/** Stored coordinates first, then the map link. */
export function storeCoordinates(store: Record<string, unknown>) {
  const fallback = extractLatLng(String(store.googleMapLocation || ""))
  const latitude = typeof store.latitude === "number" ? store.latitude : fallback.latitude
  const longitude = typeof store.longitude === "number" ? store.longitude : fallback.longitude
  return {
    ...(typeof latitude === "number" ? { latitude } : {}),
    ...(typeof longitude === "number" ? { longitude } : {}),
  }
}
