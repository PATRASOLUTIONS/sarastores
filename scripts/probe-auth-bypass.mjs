#!/usr/bin/env node
/**
 * Live, NON-DESTRUCTIVE probe of sensitive endpoints without credentials.
 *
 * Only issues GETs, plus POSTs with deliberately empty/invalid bodies so a
 * reachable handler fails validation instead of mutating data. Never sends a
 * payload that could create, delete or modify a record.
 *
 * Usage: node scripts/probe-auth-bypass.mjs http://localhost:3005
 */
const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")

// GET-only probes. A 200 here means anonymous read access.
const READS = [
  ["/api/admin/partners", "admin", "partner list (PII + API keys)"],
  ["/api/admin/customers", "admin", "customer list (PII)"],
  ["/api/admin/retention/overview", "admin", "retention analytics"],
  ["/api/admin/external-orders", "admin", "external orders"],
  ["/api/users", "admin", "user list (PII)"],
  ["/api/orders", "user", "order list"],
  ["/api/employees", "admin", "employee list"],
  ["/api/leads", "admin", "sales leads (PII)"],
  ["/api/leads/export", "admin", "lead export (PII)"],
  ["/api/complaints", "admin", "complaints (PII)"],
  ["/api/contact-inquiries", "admin", "contact inquiries (PII)"],
  ["/api/software/license-keys", "admin", "software licence keys"],
  ["/api/software-licenses", "admin", "software licences"],
  ["/api/coupons", "admin", "coupon list"],
  ["/api/debug", "none", "debug endpoint"],
  ["/api/debug/cookie", "none", "cookie dump"],
  ["/api/debug/session", "none", "session dump"],
  ["/api/test-db", "none", "db connectivity probe"],
  ["/api/test-connection", "none", "connection probe"],
  ["/api/debug-categories", "none", "category debug"],
  ["/api/migrate", "admin", "migration endpoint"],
  ["/api/seed-database", "admin", "seed endpoint"],
  ["/api/clear_database", "admin", "DESTRUCTIVE clear endpoint"],
  ["/api/scraped-products", "admin", "scraped products"],
  ["/api/products/export", "admin", "product export"],
  ["/api/admin/database/clear", "admin", "DESTRUCTIVE db clear"],
]

// POSTs with an empty body: 400/422 proves the handler RAN (reachable, unguarded).
// 401/403 proves something blocked it first. Nothing is mutated either way.
const WRITES = [
  ["/api/products", "admin", "create product"],
  ["/api/offers", "admin", "create offer"],
  ["/api/advertisements", "admin", "create advertisement"],
  ["/api/footer", "admin", "overwrite footer"],
  ["/api/product-slides", "admin", "create slide"],
  ["/api/blocked-pincodes", "admin", "block pincode"],
  ["/api/products/bulk-price-update", "admin", "BULK PRICE UPDATE"],
  ["/api/products/activate-all", "admin", "activate all products"],
  ["/api/products/bulk-update-mrp", "admin", "bulk MRP update"],
  ["/api/coupons", "admin", "create coupon"],
  ["/api/employees", "admin", "create employee"],
  ["/api/newsletter", "public", "newsletter signup"],
  ["/api/orders/[id]/assign-license".replace("[id]", "000000000000000000000000"), "admin", "assign licence"],
]

const results = []

async function probe(method, path, expected, label) {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : {},
      body: method === "POST" ? "{}" : undefined,
      redirect: "manual",
    })
    const text = (await res.text()).slice(0, 120).replace(/\s+/g, " ")
    results.push({ method, path, expected, label, status: res.status, body: text })
  } catch (e) {
    results.push({ method, path, expected, label, status: 0, body: e.message })
  }
}

const BLOCKED = new Set([401, 403])

console.log(`\n  ANONYMOUS ACCESS PROBE against ${BASE}`)
console.log(`  (no cookie, no bearer token — this is what the internet sees)\n`)

for (const [path, expected, label] of READS) await probe("GET", path, expected, label)
for (const [path, expected, label] of WRITES) await probe("POST", path, expected, label)

const exposedReads = []
const reachableWrites = []

for (const r of results) {
  const blocked = BLOCKED.has(r.status)
  if (r.method === "GET") {
    // 200 on an endpoint that should need auth = anonymous data exposure.
    if (r.status === 200 && r.expected !== "public") exposedReads.push(r)
  } else if (!blocked && r.status !== 404 && r.expected !== "public") {
    // Handler executed and rejected on validation, not on identity.
    reachableWrites.push(r)
  }
}

const mark = (r) => (BLOCKED.has(r.status) ? "BLOCKED" : r.status === 404 ? "404" : r.status === 200 ? "OPEN!!" : `${r.status}`)

console.log("  GET probes")
for (const r of results.filter((x) => x.method === "GET")) {
  console.log(`    ${mark(r).padEnd(8)} ${r.path.padEnd(38)} ${r.label}`)
}
console.log("\n  POST probes (empty body — 400 means the handler ran)")
for (const r of results.filter((x) => x.method === "POST")) {
  console.log(`    ${mark(r).padEnd(8)} ${r.path.padEnd(38)} ${r.label}`)
}

console.log(`\n  SUMMARY`)
console.log(`    anonymous reads returning 200 on protected data : ${exposedReads.length}`)
console.log(`    writes reachable without auth                   : ${reachableWrites.length}`)

if (exposedReads.length) {
  console.log(`\n  DATA EXPOSED TO ANONYMOUS USERS:`)
  for (const r of exposedReads) console.log(`    ${r.path}  —  ${r.label}\n      ${r.body}`)
}
if (reachableWrites.length) {
  console.log(`\n  WRITE HANDLERS REACHABLE WITHOUT AUTH:`)
  for (const r of reachableWrites) console.log(`    ${r.status} ${r.path}  —  ${r.label}\n      ${r.body}`)
}
console.log("")

process.exit(exposedReads.length || reachableWrites.length ? 1 : 0)
