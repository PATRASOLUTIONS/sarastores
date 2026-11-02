// Read-only synthetic-local probes: missing resources and excluded utilities.
import fs from "node:fs"
import { load } from "cheerio"

const missing = ["/product/missing", "/category/missing", "/sub-category/missing", "/brands/missing", "/campaign/missing", "/blog/missing", "/stores/missing", "/stores/synthetic-city/missing"]
const utilities = ["/wishlist", "/login", "/cart", "/search", "/lucky-draw", "/error"]
const rows = []
for (const path of [...missing, ...utilities]) {
  const response = await fetch("http://127.0.0.1:3016" + path, { redirect: "manual" })
  const $ = load(await response.text())
  const robots = $("meta[name=robots]").map((_, el) => $(el).attr("content")).get().join(",")
  const errors = []
  const expected = missing.includes(path) ? 404 : path === "/error" ? 307 : 200
  if (response.status !== expected) errors.push("Unexpected HTTP status")
  if (!/noindex/i.test(robots)) errors.push("Missing noindex")
  rows.push({ path, status: response.status, robots, errors })
}
const report = { scope: "synthetic localhost only; GET without auth or mutations", checked: rows.length, rows, failures: rows.filter(row => row.errors.length) }
fs.writeFileSync(".seo-local/public-boundary-audit.json", JSON.stringify(report, null, 2))
console.log(JSON.stringify({ checked: rows.length, failures: report.failures }))
process.exitCode = report.failures.length ? 1 : 0
