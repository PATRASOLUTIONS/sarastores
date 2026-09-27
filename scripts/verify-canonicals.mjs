#!/usr/bin/env node
/**
 * Confirms canonical/OG URLs still resolve after moving the SEO layouts onto
 * the shared origin helper.
 *
 * Usage: node scripts/verify-canonicals.mjs <url>
 */
const BASE = (process.argv[2] || "http://localhost:3005").replace(/\/$/, "")

const PAGES = [
  ["/products", "products listing"],
  ["/brands", "brands listing"],
  ["/product/mi-1257-cm-50-inches-5x-series-4k-led-smart-android-tv-with-dolby-vision-40w-dolby-atmos-grey", "product detail"],
]

let pass = 0
let fail = 0
const report = (ok, label, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${detail}`)
  ok ? pass++ : fail++
}

console.log(`\n  CANONICAL / OG URL CHECK against ${BASE}`)
console.log(`  NEXT_PUBLIC_SITE_URL is ${process.env.NEXT_PUBLIC_SITE_URL ? `set to ${process.env.NEXT_PUBLIC_SITE_URL}` : "unset (falls back to request headers)"}\n`)

for (const [path, label] of PAGES) {
  try {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(120_000) })
    const html = await res.text()

    const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1]
    const ogUrl = (html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/) || [])[1]
    const ogImage = (html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || [])[1]
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1]

    report(res.status === 200, `${label} renders`, String(res.status))
    report(Boolean(title && title.trim()), `  has a <title>`, (title || "").slice(0, 46))

    // An absolute URL is the point: relative canonicals are ignored by crawlers.
    const absolute = (u) => Boolean(u && /^https?:\/\//.test(u))
    if (canonical) report(absolute(canonical), `  canonical is absolute`, canonical.slice(0, 60))
    if (ogUrl) report(absolute(ogUrl), `  og:url is absolute`, ogUrl.slice(0, 60))
    if (ogImage) report(absolute(ogImage), `  og:image is absolute`, ogImage.slice(0, 60))
    if (!canonical && !ogUrl) console.log(`  note  ${label}: no canonical/og:url emitted`)
  } catch (e) {
    report(false, label, e.message)
  }
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
