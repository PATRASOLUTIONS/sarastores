import { MongoClient } from "mongodb"

/**
 * Store records carry only a free-text address, so the locator had nothing to
 * plot. Resolve each one to lat/lng via Nominatim and persist it.
 *
 *   node --env-file=.env scripts/geocode-stores.mjs          (dry run)
 *   node --env-file=.env scripts/geocode-stores.mjs --apply
 */
const APPLY = process.argv.includes("--apply")
const UA = "sara-electronics-store-locator/1.0 (admin@saraelectronics.example)"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function nominatim(params) {
  const url = `https://nominatim.openstreetmap.org/search?${params}&format=json&limit=1&countrycodes=in`
  // Nominatim occasionally drops connections; a transient failure must not abort the run.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "en" },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) return null
      const json = await res.json().catch(() => null)
      if (!Array.isArray(json) || json.length === 0) return null
      return { lat: Number(json[0].lat), lng: Number(json[0].lon), label: json[0].display_name }
    } catch {
      await sleep(2500)
    }
  }
  return null
}

/** Addresses are messy, so try the most specific signal first. */
async function geocode(address, name) {
  const text = String(address ?? "")
  const pincode = (text.match(/\b([1-9]\d{5})\b/) ?? [])[1]

  const locality = text
    .replace(/\s+/g, " ")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^\d|^(no|shop|floor|ward|property|#)/i.test(p))
    .slice(-3)
    .join(", ")

  // "MOBILE STORE - YELAHANKA" carries the locality that the free-text address
  // often buries, and Bengaluru addresses otherwise snap to one city centroid.
  const nameLocality = String(name ?? "")
    .replace(/^(mobile|electronic|electronics)\s+store\s*-?\s*/i, "")
    .replace(/\b\d+\b/g, "")
    .trim()
  const isCity = /bangalore|bengaluru/i.test(text)

  const attempts = []
  if (isCity && nameLocality) attempts.push([`q=${encodeURIComponent(nameLocality + ", Bengaluru, Karnataka, India")}`, "name+city"])
  if (locality && pincode) attempts.push([`q=${encodeURIComponent(locality.replace(/\b\d{6}\b/g, "").trim() + " " + pincode + ", Karnataka, India")}`, "locality+pin"])
  if (pincode) attempts.push([`postalcode=${pincode}`, "pincode"])
  if (locality) attempts.push([`q=${encodeURIComponent(locality + ", Karnataka, India")}`, "locality"])
  if (nameLocality) attempts.push([`q=${encodeURIComponent(nameLocality + ", Karnataka, India")}`, "name"])

  for (const [params, via] of attempts) {
    const hit = await nominatim(params)
    if (hit) return { ...hit, via }
    await sleep(1100)
  }
  return null
}

const client = await MongoClient.connect(process.env.MONGODB_URI)
const col = client.db("e-commerce-bytewise").collection("store_locations")

const docs = await col
  .find({})
  .project({ shopName: 1, locationDescription: 1, latitude: 1, longitude: 1 })
  .toArray()

let resolved = 0
let failed = 0
let already = 0
const seen = new Map()

for (const d of docs) {
  if (Number(d.latitude) && Number(d.longitude)) {
    already += 1
    continue
  }

  const hit = await geocode(d.locationDescription, d.shopName)
  if (!hit) {
    failed += 1
    console.log("  MISS  " + d.shopName)
    await sleep(1100)
    continue
  }

  resolved += 1
  const key = hit.lat.toFixed(4) + "," + hit.lng.toFixed(4)
  seen.set(key, [...(seen.get(key) ?? []), d.shopName])
  console.log(
    "  ok    " + String(d.shopName).padEnd(40).slice(0, 40) +
      hit.lat.toFixed(4) + ", " + hit.lng.toFixed(4) + "  (" + hit.via + ")",
  )

  if (APPLY) {
    await col.updateOne(
      { _id: d._id },
      { $set: { latitude: hit.lat, longitude: hit.lng, geocodedAt: new Date(), geocodeSource: hit.via } },
    )
  }
  // Nominatim's usage policy allows at most one request per second.
  await sleep(1100)
}

console.log(
  "\n" + (APPLY ? "APPLIED" : "DRY RUN") +
    " — resolved " + resolved + ", missed " + failed + ", already had coords " + already,
)

const dupes = new Map()
for (const [key, names] of seen) {
  if (names.length > 1) dupes.set(key, names)
}
if (dupes.size > 0) {
  console.log("\nstores sharing an identical point (geocoder fell back to an area centre):")
  for (const [key, names] of dupes) console.log("  " + key + " -> " + names.length + ": " + names.join(", "))
}

await client.close()
