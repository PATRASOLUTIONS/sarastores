/**
 * Manual smoke test for the PDF spec-sheet importer. Downloads real vendor
 * spec sheets and pushes them through /api/scrape/pdf.
 *
 *   node scripts/test-pdf-scraper.mjs
 */
import axios from "axios"
import fs from "node:fs/promises"
import path from "node:path"

const BASE = process.env.SCRAPER_TEST_BASE ?? "http://localhost:3005"
const DIR = path.join(process.cwd(), ".scrape-probe", "pdfs")

const SHEETS = [
  ["bosch-CST22U14PI", "https://media3.bsh-group.com/Documents/specsheet/en-IN/CST22U14PI.pdf"],
  ["bosch-KGN56LB42I", "https://media3.bsh-group.com/Documents/specsheet/en-IN/KGN56LB42I.pdf"],
  ["bosch-WGA254IRIN", "https://media3.bsh-group.com/Documents/specsheet/en-IN/WGA254IRIN.pdf"],
  ["bosch-WAJ2826DIN", "https://media3.bsh-group.com/Documents/specsheet/en-IN/WAJ2826DIN.pdf"],
  ["bosch-CST20S25PI", "https://media3.bsh-group.com/Documents/specsheet/en-IN/CST20S25PI.pdf"],
]

async function login() {
  const res = await axios.post(
    `${BASE}/api/auth/login`,
    { email: process.env.SCRAPER_TEST_EMAIL, password: process.env.SCRAPER_TEST_PASSWORD },
    { validateStatus: () => true, timeout: 60000 },
  )
  const cookie = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ")
  if (!cookie.includes("session=")) throw new Error(`login failed (${res.status})`)
  return cookie
}

async function ensure(name, url) {
  await fs.mkdir(DIR, { recursive: true })
  const file = path.join(DIR, `${name}.pdf`)
  try {
    await fs.access(file)
  } catch {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    if (res.status !== 200) return null
    await fs.writeFile(file, Buffer.from(res.data))
  }
  return file
}

const short = (s, n = 60) => (s ? String(s).replace(/\s+/g, " ").slice(0, n) : "—")

const cookie = await login()
console.log("logged in\n")

for (const [name, url] of SHEETS) {
  const file = await ensure(name, url)
  if (!file) {
    console.log(`${name.padEnd(20)} download failed`)
    continue
  }
  const bytes = await fs.readFile(file)
  const form = new FormData()
  form.append("file", new Blob([bytes], { type: "application/pdf" }), `${name}.pdf`)

  const started = Date.now()
  const res = await axios.post(`${BASE}/api/scrape/pdf`, form, {
    headers: { Cookie: cookie },
    validateStatus: () => true,
    timeout: 120000,
  })
  const ms = Date.now() - started

  if (!res.data?.success) {
    console.log(`${name.padEnd(20)} FAIL ${res.status} ${JSON.stringify(res.data).slice(0, 220)}`)
    continue
  }
  const p = res.data.product
  console.log(
    `${name.padEnd(20)} OK ${String(ms).padStart(5)}ms  specs=${String(Object.keys(p.technicalDetails).length).padStart(3)} ` +
      `feat=${String(p.features.length).padStart(2)} price=${p.sap.price ?? "—"} mrp=${p.mrp ?? "—"}`,
  )
  console.log(`  name : ${short(p.sap.name, 78)}`)
  console.log(`  brand: ${short(p.sap.brand, 14)}   model: ${short(p.sap.charDesc, 22)}`)
  Object.entries(p.technicalDetails)
    .slice(0, 6)
    .forEach(([k, v]) => console.log(`         ${short(k, 34).padEnd(34)} = ${short(v, 46)}`))
  console.log()
}
