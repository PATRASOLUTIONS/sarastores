#!/usr/bin/env node
/**
 * Probes the likely public URLs for this deployment and reports which respond.
 *
 * Candidates are derived from the Vercel build log
 * (github.com/PATRASOLUTIONS/sarastores, branch main), not guessed.
 *
 * Usage: node scripts/find-live-site.mjs [extra-url ...]
 */
const CANDIDATES = [
  "https://sarastores.vercel.app",
  "https://sarastores.com",
  "https://www.sarastores.com",
  "https://sarastores-git-main-patrasolutions.vercel.app",
  "https://sarastores-patrasolutions.vercel.app",
  ...process.argv.slice(2),
]

console.log(`\n  Probing ${CANDIDATES.length} candidate URLs...\n`)

for (const url of CANDIDATES) {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; deploy-check)" },
      signal: AbortSignal.timeout(20_000),
    })
    const ms = Date.now() - started
    const loc = res.headers.get("location")
    const vercelId = res.headers.get("x-vercel-id") || ""
    const region = vercelId.split("::")[0] || ""

    let verdict
    if (res.status === 200) verdict = "LIVE"
    else if (res.status >= 300 && res.status < 400) verdict = `redirects -> ${loc}`
    else if (res.status === 404) verdict = "404"
    else if (res.status === 401) verdict = "401 — Deployment Protection is ON"
    else verdict = String(res.status)

    console.log(`  ${String(res.status).padEnd(4)} ${url.padEnd(56)} ${ms}ms  ${verdict}`)
    if (vercelId) console.log(`       served by Vercel (${region})`)

    if (res.status === 200) {
      const html = await res.text()
      const title = (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1] || "(no title)"
      console.log(`       title: ${title.slice(0, 70)}`)
      console.log(`       bytes: ${html.length}`)
    }
  } catch (e) {
    const msg = e.name === "TimeoutError" ? "timed out" : e.cause?.code || e.message
    console.log(`  ---  ${url.padEnd(56)} ${msg}`)
  }
}
console.log("")
