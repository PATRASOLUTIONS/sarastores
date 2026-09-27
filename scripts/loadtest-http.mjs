/**
 * HTTP load harness for the local production build. No dependencies.
 *
 * Usage:
 *   node scripts/loadtest-http.mjs probe           # one request per endpoint, sizes + headers
 *   node scripts/loadtest-http.mjs sweep           # concurrency sweep on the hot endpoints
 *   node scripts/loadtest-http.mjs journey <conc>  # simulated visitor page-load fan-out
 */
import http from "node:http"

const BASE = process.env.LOADTEST_BASE || "http://localhost:3000"
const mode = process.argv[2] || "probe"

const agent = new http.Agent({ keepAlive: true, maxSockets: 1024 })

function request(path) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const req = http.get(`${BASE}${path}`, { agent, headers: { "accept-encoding": "identity" } }, (res) => {
      let bytes = 0
      res.on("data", (c) => (bytes += c.length))
      res.on("end", () => resolve({ ok: res.statusCode < 400, status: res.statusCode, bytes, ms: performance.now() - t0, cc: res.headers["cache-control"] }))
    })
    req.on("error", (e) => resolve({ ok: false, status: 0, bytes: 0, ms: performance.now() - t0, err: e.code }))
    req.setTimeout(120000, () => { req.destroy(); resolve({ ok: false, status: 0, bytes: 0, ms: performance.now() - t0, err: "TIMEOUT" }) })
  })
}

const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0
const MB = (b) => (b / 1048576).toFixed(2)

// One homepage view's API fan-out, as SaraLanding + Header + Footer + AuthContext issue it.
const HOME_JOURNEY = [
  "/api/auth/session", "/api/settings", "/api/categories", "/api/sub-categories",
  "/api/brands", "/api/products?fields=card", "/api/stores", "/api/footer",
]

const ENDPOINTS = [
  "/",
  "/api/products?fields=card",
  "/api/products?fields=card&limit=60",
  "/api/products?featured=true&limit=12",
  "/api/products?search=samsung&limit=6",
  "/api/categories",
  "/api/settings",
  "/api/home-components",
  "/api/auth/session",
]

async function probe() {
  console.log(`probe ${BASE}\n`)
  console.log("endpoint".padEnd(44) + "status   size        ms     cache-control")
  for (const p of [...ENDPOINTS, "/api/products"]) {
    const r = await request(p)
    console.log(
      p.padEnd(44) +
        String(r.status).padEnd(8) +
        `${MB(r.bytes).padStart(7)} MB` +
        `${r.ms.toFixed(0).padStart(7)}  ` +
        (r.cc ?? r.err ?? ""),
    )
  }
}

async function runFixed(paths, concurrency, durationMs) {
  const lat = []
  let done = 0, failed = 0, bytes = 0
  const deadline = Date.now() + durationMs
  let i = 0
  const worker = async () => {
    while (Date.now() < deadline) {
      const r = await request(paths[i++ % paths.length])
      lat.push(r.ms)
      bytes += r.bytes
      r.ok ? done++ : failed++
    }
  }
  const t0 = performance.now()
  await Promise.all(Array.from({ length: concurrency }, worker))
  const elapsed = (performance.now() - t0) / 1000
  lat.sort((a, b) => a - b)
  return {
    concurrency, done, failed, rps: done / elapsed,
    p50: pct(lat, 0.5), p95: pct(lat, 0.95), p99: pct(lat, 0.99), max: lat[lat.length - 1] ?? 0,
    mbps: bytes / 1048576 / elapsed,
  }
}

async function sweep() {
  const targets = [
    ["/api/products?fields=card         (full catalogue)", ["/api/products?fields=card"]],
    ["/api/products?fields=card&limit=60 (paged)", ["/api/products?fields=card&limit=60"]],
    ["/api/products?search=samsung&limit=6", ["/api/products?search=samsung&limit=6"]],
    ["/api/categories", ["/api/categories"]],
    ["/api/auth/session", ["/api/auth/session"]],
    ["/  (home document)", ["/"]],
  ]
  for (const [label, paths] of targets) {
    console.log(`\n--- ${label} ---`)
    console.log("conc    rps     p50      p95      p99      max    fail   MB/s")
    for (const c of [1, 10, 50, 100]) {
      const r = await runFixed(paths, c, 8000)
      console.log(
        String(r.concurrency).padStart(4) +
          r.rps.toFixed(1).padStart(8) +
          r.p50.toFixed(0).padStart(8) + "ms" +
          r.p95.toFixed(0).padStart(7) + "ms" +
          r.p99.toFixed(0).padStart(7) + "ms" +
          r.max.toFixed(0).padStart(7) + "ms" +
          String(r.failed).padStart(7) +
          r.mbps.toFixed(1).padStart(8),
      )
    }
  }
}

async function journey() {
  const conc = Number(process.argv[3] || 25)
  console.log(`simulated homepage loads, ${conc} concurrent visitors, ${HOME_JOURNEY.length} requests each\n`)
  const lat = []
  let failed = 0, bytes = 0
  const deadline = Date.now() + 15000
  let views = 0
  const worker = async () => {
    while (Date.now() < deadline) {
      const t0 = performance.now()
      const rs = await Promise.all(HOME_JOURNEY.map(request))
      lat.push(performance.now() - t0)
      views++
      for (const r of rs) { bytes += r.bytes; if (!r.ok) failed++ }
    }
  }
  const t0 = performance.now()
  await Promise.all(Array.from({ length: conc }, worker))
  const elapsed = (performance.now() - t0) / 1000
  lat.sort((a, b) => a - b)
  console.log(`page views          ${views}  (${(views / elapsed).toFixed(1)}/s)`)
  console.log(`failed requests     ${failed}`)
  console.log(`full-page latency   p50 ${pct(lat, 0.5).toFixed(0)}ms   p95 ${pct(lat, 0.95).toFixed(0)}ms   p99 ${pct(lat, 0.99).toFixed(0)}ms`)
  console.log(`bytes per page view ${MB(bytes / views)} MB`)
  console.log(`origin egress       ${(bytes / 1048576 / elapsed).toFixed(1)} MB/s`)
}

if (mode === "probe") await probe()
else if (mode === "sweep") await sweep()
else if (mode === "journey") await journey()
process.exit(0)
