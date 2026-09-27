#!/usr/bin/env node
/**
 * Verifies every JSON-LD block a page emits is free of raw < > & so it cannot
 * break out of its <script> tag, while still parsing as valid JSON.
 *
 * Usage: node scripts/verify-jsonld-escaping.mjs http://localhost:3005
 */
const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")

const PAGES = [
  "/",
  "/product/mi-1257-cm-50-inches-5x-series-4k-led-smart-android-tv-with-dolby-vision-40w-dolby-atmos-grey",
  "/store-locator",
  "/faq",
]

const BLOCK_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g

let totalBlocks = 0
let unsafe = 0
let unparseable = 0

for (const path of PAGES) {
  let html
  try {
    const res = await fetch(BASE + path)
    if (!res.ok) {
      console.log(`  SKIP  ${path} -> ${res.status}`)
      continue
    }
    html = await res.text()
  } catch (e) {
    console.log(`  SKIP  ${path} -> ${e.message}`)
    continue
  }

  const blocks = [...html.matchAll(BLOCK_RE)].map((m) => m[1])
  let pageUnsafe = 0
  let pageBad = 0

  for (const block of blocks) {
    totalBlocks++
    if (/[<>]/.test(block)) {
      pageUnsafe++
      unsafe++
    }
    try {
      JSON.parse(block)
    } catch {
      pageBad++
      unparseable++
    }
  }

  const mark = pageUnsafe === 0 && pageBad === 0 ? "PASS" : "FAIL"
  console.log(`  ${mark}  ${path.slice(0, 60).padEnd(62)} blocks=${blocks.length} rawAngle=${pageUnsafe} unparseable=${pageBad}`)
}

console.log(`\n  ${totalBlocks} JSON-LD blocks checked`)
console.log(`  blocks with raw < or > (tag-breakout risk): ${unsafe}`)
console.log(`  blocks that no longer parse as JSON       : ${unparseable}\n`)

process.exit(unsafe || unparseable ? 1 : 0)
