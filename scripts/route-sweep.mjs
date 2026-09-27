/**
 * Walk app/ and exercise every discoverable route, recording status + timing.
 *
 * Usage: node scripts/route-sweep.mjs [baseUrl] [--pages|--apis]
 */
import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3005"
const only = process.argv.includes("--pages") ? "pages" : process.argv.includes("--apis") ? "apis" : "all"
const APP = join(process.cwd(), "app")

// Real values for dynamic segments, filled in from the API before the sweep.
const SUBS = { slug: null, id: null, sku: null, name: null, city: null, store: null, type: null, token: null, partnerId: null, orderId: null, productId: null }

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/^(page|route)\.(tsx?|jsx?)$/.test(entry)) acc.push(full)
  }
  return acc
}

function toUrl(file) {
  const rel = relative(APP, file).split(sep)
  const kind = rel.pop().startsWith("route") ? "api" : "page"
  const segs = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"))
  let dynamic = false
  const out = segs.map((s) => {
    const m = s.match(/^\[\.{0,3}(.+?)\]$/)
    if (!m) return s
    dynamic = true
    const key = m[1].replace(/^\.\.\./, "")
    return SUBS[key] ?? `__${key}__`
  })
  return { url: "/" + out.join("/"), kind, dynamic, unresolved: out.some((s) => String(s).startsWith("__")) }
}

async function hit(url) {
  const t0 = performance.now()
  try {
    const res = await fetch(BASE + url, { redirect: "manual", signal: AbortSignal.timeout(120000) })
    const body = await res.text()
    return { status: res.status, ms: performance.now() - t0, bytes: body.length, body }
  } catch (e) {
    return { status: 0, ms: performance.now() - t0, bytes: 0, body: "", err: e.name === "TimeoutError" ? "TIMEOUT" : e.message }
  }
}

// Resolve dynamic segments from live data so those routes are actually exercised.
try {
  const [p] = await (await fetch(`${BASE}/api/products?fields=card&limit=1`)).json()
  if (p) { SUBS.slug = p.slug; SUBS.sku = p.sku; SUBS.productId = p.id }
  const [c] = await (await fetch(`${BASE}/api/categories`)).json()
  if (c) { SUBS.id = c.id; SUBS.name = c.name }
} catch { /* sweep still runs, dynamic routes just stay unresolved */ }

const routes = walk(APP)
  .map(toUrl)
  .filter((r) => !r.unresolved)
  .filter((r) => (only === "all" ? true : only === "pages" ? r.kind === "page" : r.kind === "api"))
  .filter((r, i, a) => a.findIndex((x) => x.url === r.url) === i)
  .sort((a, b) => a.url.localeCompare(b.url))

console.log(`sweeping ${routes.length} routes on ${BASE}\n`)

const buckets = { ok: [], auth: [], notfound: [], redirect: [], server: [], dead: [] }
for (const r of routes) {
  const res = await hit(r.url)
  const s = res.status
  const bucket =
    s >= 500 || s === 0 ? "server" : s === 401 || s === 403 ? "auth" : s === 404 ? "notfound" : s >= 300 && s < 400 ? "redirect" : "ok"
  buckets[bucket].push({ ...r, ...res })
  if (bucket === "server") {
    console.log(`  ${String(s || res.err).padEnd(8)} ${r.url}`)
  }
}

const label = { ok: "2xx OK", auth: "401/403 (guarded — expected for admin)", notfound: "404", redirect: "3xx", server: "5xx / no response" }
console.log("\n=== SUMMARY ===")
for (const k of ["ok", "redirect", "auth", "notfound", "server"]) {
  console.log(`  ${label[k].padEnd(42)} ${buckets[k].length}`)
}

if (buckets.server.length) {
  console.log("\n=== FAILURES ===")
  for (const f of buckets.server) {
    const digest = f.body.match(/digest["':\s]+([0-9]+)/)?.[1]
    console.log(`  ${String(f.status || f.err).padEnd(8)} ${f.kind.padEnd(5)} ${f.url}${digest ? `   digest ${digest}` : ""}`)
  }
}

if (buckets.notfound.length) {
  console.log("\n=== 404 ===")
  for (const f of buckets.notfound) console.log(`  ${f.kind.padEnd(5)} ${f.url}`)
}

const slow = [...buckets.ok, ...buckets.auth].filter((r) => r.ms > 3000).sort((a, b) => b.ms - a.ms).slice(0, 15)
if (slow.length) {
  console.log("\n=== SLOWEST (>3s) ===")
  for (const r of slow) console.log(`  ${r.ms.toFixed(0).padStart(7)}ms  ${r.url}`)
}
process.exit(0)
