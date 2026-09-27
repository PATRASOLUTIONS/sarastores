/**
 * Manual smoke test for /api/media/upload. Uploads a real product photo and a
 * deliberately bad file to check both paths.
 *
 *   node scripts/test-media-upload.mjs
 */
import axios from "axios"

const BASE = process.env.SCRAPER_TEST_BASE ?? "http://localhost:3005"

const login = await axios.post(
  `${BASE}/api/auth/login`,
  { email: process.env.SCRAPER_TEST_EMAIL, password: process.env.SCRAPER_TEST_PASSWORD },
  { validateStatus: () => true, timeout: 60000 },
)
const cookie = (login.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ")
if (!cookie.includes("session=")) throw new Error(`login failed (${login.status})`)

const photo = await axios.get(
  "https://media3.bsh-group.com/Product_Shots/20834985_KGN56LB42I_STP_def.jpg",
  { responseType: "arraybuffer", timeout: 40000, headers: { "User-Agent": "Mozilla/5.0" } },
)

const form = new FormData()
form.append("file", new Blob([new Uint8Array(photo.data)], { type: "image/jpeg" }), "fridge.jpg")
// A text file wearing an image content type — the route must reject it on magic bytes.
form.append("file", new Blob([new TextEncoder().encode("not an image at all")], { type: "image/png" }), "fake.png")

const res = await axios.post(`${BASE}/api/media/upload`, form, {
  headers: { Cookie: cookie },
  validateStatus: () => true,
  timeout: 120000,
})
console.log("status:", res.status)
console.log(JSON.stringify(res.data, null, 1))

for (const img of res.data?.images ?? []) {
  for (const [label, url] of [["thumb", img.thumb], ["gallery", img.url], ["zoom", img.zoom], ["orig", img.original]]) {
    const r = await axios.get(new URL(url, BASE).toString(), { validateStatus: () => true, responseType: "arraybuffer" })
    console.log(`  ${label.padEnd(8)} ${r.status}  ${Math.round((r.data?.byteLength ?? 0) / 1024)} KB  ${url}`)
  }
}

const anon = await axios.post(`${BASE}/api/media/upload`, new FormData(), { validateStatus: () => true })
console.log("\nunauthenticated upload ->", anon.status, JSON.stringify(anon.data).slice(0, 120))
