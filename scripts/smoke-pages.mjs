#!/usr/bin/env node
/**
 * Fast smoke check of the key consumer pages. Dev compiles each route on first
 * hit, so this allows a generous per-page timeout and runs them sequentially.
 *
 * Usage: node scripts/smoke-pages.mjs <url>
 */
const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")

const PAGES = [
  "/",
  "/products",
  "/offers",
  "/brands",
  "/store-locator",
  "/cart",
  "/login",
  "/register",
  "/forgot-password",
  "/track",
  "/contact",
  "/faq",
  "/privacy-policy",
  "/terms-and-conditions",
  "/compare",
  "/wishlist",
]

let pass = 0
let fail = 0
const failures = []

for (const path of PAGES) {
  const started = Date.now()
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(90_000) })
    const ms = Date.now() - started
    const ok = res.status === 200
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${path.padEnd(26)} ${res.status}  ${ms}ms`)
    ok ? pass++ : fail++
    if (!ok) failures.push(`${path} -> ${res.status}`)
  } catch (e) {
    console.log(`  FAIL  ${path.padEnd(26)} ${e.message}`)
    fail++
    failures.push(`${path} -> ${e.message}`)
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`)
if (failures.length) {
  console.log("\n  FAILURES:")
  for (const f of failures) console.log(`    ${f}`)
}
console.log("")
process.exit(fail ? 1 : 0)
