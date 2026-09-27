/**
 * Backfill latitude/longitude (and city/state) for store_locations.
 *
 * Most stores only have a short `maps.app.goo.gl` share link, which contains no
 * coordinates. Following the redirect expands it to a URL that does. Coordinates
 * are then reverse-geocoded via OpenStreetMap Nominatim to fill city/state,
 * because the existing city values are regex-guessed from the address and wrong.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-store-coordinates.js --dry-run
 *   node --env-file=.env scripts/backfill-store-coordinates.js
 *
 * Flags:
 *   --dry-run    Resolve and report, write nothing. Default when no flag given.
 *   --apply      Persist changes to MongoDB.
 *   --force      Re-resolve stores that already have coordinates.
 *   --limit=N    Only process the first N stores.
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || "e-commerce-bytewise"

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/backfill-store-coordinates.js")
  process.exit(1)
}

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const FORCE = args.includes("--force")
const limitArg = args.find((a) => a.startsWith("--limit="))
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity

const UA = "sara-electronics-store-locator-backfill/1.0"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Pull coordinates out of an expanded Google Maps URL. */
function parseCoords(url) {
  if (!url) return null
  // !3d<lat>!4d<lng> is the resolved place location and is the most accurate.
  const place = url.match(/!3d(-?\d+\.\d+).*?!4d(-?\d+\.\d+)/)
  if (place) return { lat: parseFloat(place[1]), lng: parseFloat(place[2]), via: "!3d!4d" }
  // @<lat>,<lng> is the viewport centre — close enough as a fallback.
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]), via: "@" }
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]), via: "q=" }
  return null
}

async function expand(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } })
  return res.url
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`
  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) return null
  const data = await res.json()
  const a = data.address || {}
  // Prefer town/district over hamlet-level names so the city filter stays usable.
  return {
    city:
      a.city || a.town || a.municipality || a.state_district || a.county || a.village || a.suburb || null,
    state: a.state || null,
    pincode: a.postcode || null,
  }
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const col = client.db(DB_NAME).collection("store_locations")

  const stores = await col.find({}).toArray()
  const targets = stores
    .filter((s) => FORCE || typeof s.latitude !== "number" || typeof s.longitude !== "number")
    .slice(0, LIMIT)

  console.log(`Mode        : ${APPLY ? "APPLY (writes to MongoDB)" : "DRY RUN (no writes)"}`)
  console.log(`Database    : ${DB_NAME}`)
  console.log(`Stores      : ${stores.length} total, ${targets.length} to process\n`)

  let resolved = 0
  let geocoded = 0
  const failures = []

  for (const [i, store] of targets.entries()) {
    const name = store.shopName || String(store._id)
    const link = store.googleMapLocation

    if (!link || !String(link).trim()) {
      failures.push({ name, reason: "no googleMapLocation" })
      continue
    }

    try {
      const expanded = await expand(String(link).trim())
      const coords = parseCoords(expanded)

      if (!coords) {
        failures.push({ name, reason: "no coordinates in expanded URL" })
        continue
      }
      resolved++

      await sleep(1100) // Nominatim allows at most 1 request per second.
      let place = null
      try {
        place = await reverseGeocode(coords.lat, coords.lng)
        if (place && place.city) geocoded++
      } catch {
        // Reverse geocoding is best-effort; coordinates alone are still useful.
      }

      const update = {
        latitude: coords.lat,
        longitude: coords.lng,
        geoUpdatedAt: new Date(),
      }
      if (place) {
        if (place.city) update.city = place.city
        if (place.state) update.state = place.state
        if (place.pincode) update.pincode = place.pincode
      }

      if (APPLY) await col.updateOne({ _id: store._id }, { $set: update })

      console.log(
        `[${i + 1}/${targets.length}] ${name.slice(0, 42).padEnd(42)} ` +
          `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)} (${coords.via})` +
          (place && place.city ? ` — ${place.city}, ${place.state || "?"}` : "")
      )
    } catch (err) {
      failures.push({ name, reason: err.message })
    }
  }

  console.log(`\nResolved coordinates : ${resolved}/${targets.length}`)
  console.log(`Reverse-geocoded     : ${geocoded}/${targets.length}`)
  console.log(`Failed               : ${failures.length}`)
  if (failures.length) {
    failures.slice(0, 15).forEach((f) => console.log(`   - ${f.name}: ${f.reason}`))
  }
  if (!APPLY) console.log("\nDry run — nothing was written. Re-run with --apply to persist.")

  await client.close()
}

main().catch((e) => {
  console.error("Backfill failed:", e.message)
  process.exit(1)
})
