/**
 * Prints one full scrape result and checks that every image URL resolves.
 * Manual smoke test — not part of the app.
 *
 *   node scripts/inspect-scrape.mjs <product-url>
 */
import axios from "axios"

const BASE = process.env.SCRAPER_TEST_BASE ?? "http://localhost:3005"

const res0 = await axios.post(
  `${BASE}/api/auth/login`,
  { email: process.env.SCRAPER_TEST_EMAIL, password: process.env.SCRAPER_TEST_PASSWORD },
  { validateStatus: () => true },
)
const cookie = (res0.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ")

const res = await axios.post(
  `${BASE}/api/scrape`,
  { url: process.argv[2] },
  { headers: { Cookie: cookie }, validateStatus: () => true, timeout: 180000 },
)
if (!res.data?.success) {
  console.log("FAILED", res.status, JSON.stringify(res.data))
  process.exit(1)
}
const p = res.data.product
console.log(JSON.stringify({ ...p, technicalDetails: undefined, reviews: p.reviews.length }, null, 2))
console.log("\n--- technicalDetails ---")
for (const [k, v] of Object.entries(p.technicalDetails)) console.log(`  ${k} = ${String(v).slice(0, 110)}`)

console.log("\n--- image reachability ---")
for (const src of [...p.images, ...p.manufacturerImages]) {
  const r = await axios
    .get(src, { responseType: "stream", timeout: 20000, validateStatus: () => true, headers: { "User-Agent": "Mozilla/5.0" } })
    .catch((e) => ({ status: e.message }))
  r.data?.destroy?.()
  console.log(`  ${r.status}  ${src}`)
}
