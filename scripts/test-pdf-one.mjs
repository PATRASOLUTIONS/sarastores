/**
 * Pushes one local PDF through /api/scrape/pdf and prints the full result,
 * including the stored image renditions. Manual smoke test.
 *
 *   node scripts/test-pdf-one.mjs <path-to.pdf>
 */
import axios from "axios"
import fs from "node:fs/promises"
import path from "node:path"

const BASE = process.env.SCRAPER_TEST_BASE ?? "http://localhost:3005"

const login = await axios.post(
  `${BASE}/api/auth/login`,
  { email: process.env.SCRAPER_TEST_EMAIL, password: process.env.SCRAPER_TEST_PASSWORD },
  { validateStatus: () => true, timeout: 60000 },
)
const cookie = (login.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ")
if (!cookie.includes("session=")) throw new Error(`login failed (${login.status})`)

const file = process.argv[2]
const bytes = await fs.readFile(file)
const form = new FormData()
form.append("file", new Blob([bytes], { type: "application/pdf" }), path.basename(file))

const res = await axios.post(`${BASE}/api/scrape/pdf`, form, {
  headers: { Cookie: cookie },
  validateStatus: () => true,
  timeout: 180000,
})

if (!res.data?.success) {
  console.log("FAILED", res.status, JSON.stringify(res.data, null, 1))
  process.exit(1)
}
const p = res.data.product
console.log("name    :", p.sap.name)
console.log("brand   :", p.sap.brand, "| model:", p.sap.charDesc)
console.log("price   :", p.sap.price, "| mrp:", p.mrp)
console.log("images  :", p.images.length)
p.images.forEach((u) => console.log("          ", u))
console.log("manufacturerInfo:\n ", p.manufacturerInfo.replace(/\n/g, "\n  "))
console.log("specs   :", Object.keys(p.technicalDetails).length)
Object.entries(p.technicalDetails)
  .slice(0, 10)
  .forEach(([k, v]) => console.log(`           ${k} = ${String(v).slice(0, 60)}`))

console.log("\n--- image reachability ---")
for (const u of p.images) {
  const r = await axios.get(new URL(u, BASE).toString(), { validateStatus: () => true, responseType: "arraybuffer" })
  console.log(`  ${r.status}  ${String(r.headers["content-type"])}  ${Math.round((r.data?.byteLength ?? 0) / 1024)} KB  ${u}`)
}
