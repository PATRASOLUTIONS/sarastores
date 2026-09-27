#!/usr/bin/env node
/**
 * Verifies the guards added to write routes.
 *
 * SAFETY: only the anonymous side is probed over HTTP, because a rejected
 * request never reaches the handler. The admin side is checked STATICALLY —
 * an earlier version of this script sent authenticated empty-body POSTs, which
 * ran the handlers and created a junk product_slides row and fired
 * activate-all. Never send an authenticated write to prove a guard.
 *
 * Usage: node scripts/verify-route-guards-safe.mjs <url>
 */
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")

// [route, file, expected guard]
const GUARDED = [
  ["POST", "/api/products", "app/api/products/route.ts", "requireAdmin"],
  ["POST", "/api/offers", "app/api/offers/route.ts", "requireAdmin"],
  ["POST", "/api/advertisements", "app/api/advertisements/route.ts", "requireAdmin"],
  ["POST", "/api/product-advertisements", "app/api/product-advertisements/route.ts", "requireAdmin"],
  ["POST", "/api/animated-banner", "app/api/animated-banner/route.ts", "requireAdmin"],
  ["POST", "/api/split-cards", "app/api/split-cards/route.ts", "requireAdmin"],
  ["POST", "/api/product-slides", "app/api/product-slides/route.ts", "requireAdmin"],
  ["POST", "/api/blocked-pincodes", "app/api/blocked-pincodes/route.ts", "requireAdmin"],
  ["POST", "/api/footer", "app/api/footer/route.ts", "requireAdmin"],
  ["POST", "/api/settings", "app/api/settings/route.ts", "requireAdmin"],
  ["POST", "/api/software", "app/api/software/route.ts", "requireAdmin"],
  ["POST", "/api/software-licenses", "app/api/software-licenses/route.ts", "requireAdmin"],
  ["POST", "/api/software/license-keys", "app/api/software/license-keys/route.ts", "requireAdmin"],
  ["POST", "/api/leads/settings", "app/api/leads/settings/route.ts", "requireAdmin"],
  ["POST", "/api/products/activate-all", "app/api/products/activate-all/route.ts", "requireAdmin"],
  ["POST", "/api/products/bulk-update-mrp", "app/api/products/bulk-update-mrp/route.ts", "requireAdmin"],
  ["POST", "/api/products/bulk-price-update", "app/api/products/bulk-price-update/route.ts", "requireAdmin"],
  ["POST", "/api/products/upload-excel", "app/api/products/upload-excel/route.ts", "requireAdmin"],
  ["POST", "/api/scrape-amazon", "app/api/scrape-amazon/route.ts", "requireAdmin"],
  ["DELETE", "/api/scraped-products", "app/api/scraped-products/route.ts", "requireAdmin"],
  ["POST", "/api/sub-categories/extract-from-products", "app/api/sub-categories/extract-from-products/route.ts", "requireAdmin"],
  ["POST", "/api/vendor/products", "app/api/vendor/products/route.ts", "requireVendor"],
]

let pass = 0
let fail = 0
const problems = []
const report = (ok, label, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)} ${detail}`)
  ok ? pass++ : fail++
  if (!ok) problems.push(`${label} — ${detail}`)
}

console.log(`\n  ROUTE GUARD VERIFICATION (non-mutating)\n`)

console.log("  1. Guard present in the handler source")
for (const [, route, file, expected] of GUARDED) {
  const path = join(ROOT, file)
  if (!existsSync(path)) {
    report(false, route, "file missing")
    continue
  }
  const src = readFileSync(path, "utf8")
  const has = src.includes(`await ${expected}()`) && src.includes("guard.response")
  report(has, route, has ? expected : `no ${expected}() found`)
}

console.log("\n  2. Anonymous requests are rejected (handler never runs)")
for (const [method, route] of GUARDED) {
  try {
    const res = await fetch(BASE + route, {
      method,
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    report([401, 403].includes(res.status), `${method} ${route}`, String(res.status))
  } catch (e) {
    report(false, `${method} ${route}`, `unreachable: ${e.message}`)
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`)
if (problems.length) {
  console.log("\n  PROBLEMS:")
  for (const p of problems) console.log(`    ${p}`)
}
console.log("")
process.exit(fail ? 1 : 0)
