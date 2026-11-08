import fs from "node:fs/promises"
import { sourceLoader } from "../tests/source-loader.mjs"
const source = await fs.readFile("scripts/test-scraper.mjs", "utf8")
const entries = [...source.matchAll(/\["([^"]+)",\s*"(https:\/\/[^"\s]+)"\]/g)].map(match => ({ label: match[1], url: match[2] }))
const extract = sourceLoader().load("lib/scrapers/merchant-enrichment.ts").extractMerchantEnrichment
const results = []
for (const label of ["lg-", "vs-", "bosch-"]) {
  const entry = entries.find(item => item.label.startsWith(label))
  if (!entry) throw new Error(`Missing existing smoke-test URL for ${label}`)
  try {
    const enrichment = await extract({ itemno: `QA-${entry.label}`, url: entry.url })
    results.push({ label: entry.label, success: true, enrichment })
    console.log(JSON.stringify({ source: enrichment.product.source, gtin: enrichment.gtin, mpn: enrichment.mpn, title: enrichment.title, images: enrichment.images.length }))
  } catch (error) {
    results.push({ label: entry.label, success: false, url: entry.url, error: error.name === "ScraperError" ? error.message : "Brand source fetch failed" })
    console.log(JSON.stringify(results.at(-1)))
  }
}
await fs.writeFile(".seo-local/merchant-scraper/brand-probe.json", JSON.stringify(results, null, 2))
