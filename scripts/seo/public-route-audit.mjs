// Complete source inventory + bounded local HTTP audit. Never connects to live DB.
import fs from "node:fs"
import path from "node:path"
import { load } from "cheerio"

const root = path.resolve(import.meta.dirname, "../..")
const app = path.join(root, "app")
const files = fs.readdirSync(app, { recursive: true }).filter(file => String(file).endsWith("page.tsx"))
const gated = /^\/(admin|account|dashboard|vendor)(\/|$)/
const utility = /^\/(cart|checkout|order|thank-you|track|compare|search|wishlist|login|register|forgot-password|reset-password|verify-email|auth|spin|subham|credits|error|partner-api-test|partner-api-docs|loaders-demo)(\/|$)/
const samples = {
  "/product/[slug]": "/product/synthetic-phone", "/category/[id]": "/category/synthetic-phones",
  "/sub-category/[name]": "/sub-category/Synthetic%20Smartphones", "/brands/[slug]": "/brands/synthetic-brand",
  "/campaign/[slug]": "/campaign/synthetic-campaign", "/blog/[slug]": "/blog/synthetic-guide",
  "/stores/[city]": "/stores/synthetic-city", "/stores/[city]/[store]": "/stores/synthetic-city/synthetic-store",
}
const inventory = files.map(file => {
  const route = "/" + String(file).replaceAll("\\", "/").replace(/\/?page\.tsx$/, "")
  const source = fs.readFileSync(path.join(app, file), "utf8")
  const own = [source]
  let directory = path.dirname(path.join(app, file))
  while (directory !== app) {
    const layout = path.join(directory, "layout.tsx")
    if (fs.existsSync(layout)) own.push(fs.readFileSync(layout, "utf8"))
    directory = path.dirname(directory)
  }
  return { route, file: "app/" + String(file).replaceAll("\\", "/"),
    kind: gated.test(route) ? "gated" : utility.test(route) || route === "/lucky-draw" || route.startsWith("/lucky-draw/draw/") ? "noindex-utility" : "indexable",
    own_metadata: route === "/" || own.some(text => /export\s+(?:async\s+)?(?:function|const)\s+(?:generateMetadata|metadata)\b/.test(text)),
    sample: samples[route] || (!route.includes("[") ? route : null),
  }
}).sort((a, b) => a.route.localeCompare(b.route))
fs.mkdirSync(path.join(root, ".seo-local"), { recursive: true })
const report = { scope: "all page source routes; synthetic local runtime only", inventory, pages: [] }
if (process.argv.includes("--http")) {
  for (const entry of inventory.filter(row => row.kind === "indexable" && row.sample)) {
    const response = await fetch("http://127.0.0.1:3016" + entry.sample, { redirect: "manual" })
    const html = await response.text()
    const $ = load(html)
    const canonicals = $("link[rel=canonical]").map((_, el) => $(el).attr("href")).get()
    const headings = $("h1").map((_, el) => $(el).text().trim()).get()
    const hidden_h1 = $("h1").toArray().some(heading => [heading, ...$(heading).parents().toArray()].some(element => $(element).attr("hidden") !== undefined || /(?:^|;)\s*(?:opacity\s*:\s*0(?:\s|;|$)|display\s*:\s*none(?:\s|;|$))/.test($(element).attr("style") || "")))
    const schemas = [], errors = []
    $("script[type='application/ld+json']").each((_, el) => { try { schemas.push(JSON.parse($(el).text())) } catch { errors.push("invalid JSON-LD") } })
    const title = $("title").first().text().trim()
    const description = $("meta[name=description]").first().attr("content") || ""
    const robots = $("meta[name=robots]").map((_, el) => $(el).attr("content")).get().join(",")
    const images_missing_alt = $("img:not([alt])").length
    $("script,style,header,footer,nav").remove()
    const text = $("main").text().trim() || $("body").text().trim()
    const expected = entry.sample === "/super-sunday" ? "/campaign/super-sunday" : entry.sample
    if (response.status !== 200) errors.push(`HTTP ${response.status}`)
    if (headings.length !== 1 || !headings[0]) errors.push("requires one meaningful H1")
    if (hidden_h1) errors.push("primary heading initially hidden")
    if (!title || !description) errors.push("missing title/description")
    if (canonicals.length !== 1 || !["https://www.sarastores.com" + expected, ...(expected === "/" ? ["https://www.sarastores.com"] : [])].includes(canonicals[0])) errors.push("canonical mismatch")
    if (/noindex/i.test(robots)) errors.push("indexable route is noindex")
    if (images_missing_alt) errors.push(`${images_missing_alt} images missing alt attribute`)
    if (text.length < 80) errors.push("no primary page content")
    report.pages.push({ route: entry.route, path: entry.sample, status: response.status, title, description, canonicals, robots, h1: headings,
      primary_text_length: text.length, images_missing_alt, schema_types: schemas.map(node => node["@type"]), errors })
  }
}
report.summary = { routes: inventory.length, indexable: inventory.filter(row => row.kind === "indexable").length,
  gated: inventory.filter(row => row.kind === "gated").length, utilities: inventory.filter(row => row.kind === "noindex-utility").length,
  missing_metadata: inventory.filter(row => row.kind !== "gated" && !row.own_metadata).map(row => row.route),
  checked_pages: report.pages.length, failed_pages: report.pages.filter(row => row.errors.length).map(row => ({path: row.path, errors: row.errors})) }
fs.writeFileSync(path.join(root, ".seo-local/public-route-audit.json"), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.summary, null, 2))
process.exitCode = report.summary.missing_metadata.length || report.summary.failed_pages.length ? 1 : 0
