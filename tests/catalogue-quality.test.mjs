import test from "node:test"
import assert from "node:assert/strict"
import { sourceLoader } from "./source-loader.mjs"

const { auditCatalogue, validGtin, packQualityReport, unpackQualityReport, qualityCsvCell } = sourceLoader().load("lib/catalogue-quality.ts")
const { DEFAULT_REVIEW_FILTERS, filterReviewProducts, matchingReviewIssues, catalogueReviewSummary, catalogueReviewCsv } = sourceLoader().load("lib/catalogue-review.ts")
const product = (extra = {}) => ({ _id: "p1", sku: "SKU-1", name: "Verified Brand Model 8 kg Front Load Washing Machine", division: "Home Appliances", category: "Washing Machines", segment: "Front Load", brand: "Verified Brand", description: "A useful customer description with verified specifications and practical details about this exact product model.", modelNumber: "MODEL-8", mpn: "MODEL-8", price: 20000, mrp: 25000, stock: 0, active: true, image: "/images/front.webp", images: ["/images/front.webp", "/images/back.webp", "/images/detail.webp"], warrantyText: "Verified two-year manufacturer warranty", hsnCode: "8450", gstRate: 18, slug: "verified-model-8", features: ["Verified feature"], ...extra })

test("complete synthetic product passes automated rules without mutating its data", () => {
  const input = product()
  const baseline = JSON.stringify(input)
  const report = auditCatalogue([input])
  assert.equal(report.ready, 1)
  assert.equal(report.blocked, 0)
  assert.equal(report.products[0].issues.length, 0)
  assert.equal(JSON.stringify(input), baseline)
  assert.ok(report.limitations.some(item => item.includes("not that the product has been fact-checked")))
})
test("missing metadata is actionable and invalid stock/price block readiness", () => {
  const report = auditCatalogue([{ _id: "bad", name: "Product", price: -1, stock: -2 }])
  assert.equal(report.blocked, 1)
  const codes = report.products[0].issues.map(issue => issue.code)
  for (const code of ["missing-sku", "generic-title", "missing-brand", "invalid-price", "invalid-stock", "missing-image", "missing-warranty"]) assert.ok(codes.includes(code), code)
  assert.ok(report.products[0].issues.every(issue => issue.reason && issue.action && issue.current))
})
test("GTIN checksum and genuine manufacturer identifiers are distinguished", () => {
  assert.equal(validGtin("4006381333931"), true)
  assert.equal(validGtin("4006381333932"), false)
  assert.equal(validGtin("SKU-1"), false)
  assert.equal(auditCatalogue([product({ gtin: "4006381333932" })]).blocked, 1)
  const report = auditCatalogue([product({ mpn: "SKU-1" })])
  assert.ok(report.products[0].issues.some(issue => issue.code === "sku-as-mpn" && issue.severity === "review"))
})
test("duplicate SKU, slug and name issues affect every matching product", () => {
  const report = auditCatalogue([product(), product({ _id: "p2" })])
  assert.equal(report.blocked, 2)
  for (const entry of report.products) for (const code of ["duplicate-sku", "duplicate-slug", "duplicate-title"]) assert.ok(entry.issues.some(issue => issue.code === code))
})
test("legacy EAN/MRP and brand differences identify page/feed inconsistencies", () => {
  const report = auditCatalogue([product({ mrp: undefined, raw: { MRP: 25000, "EAN Number": "4006381333931" }, manufacturerName: "Different Manufacturer" })])
  const codes = report.products[0].issues.map(issue => issue.code)
  assert.ok(codes.includes("mrp-reader-conflict"))
  assert.ok(codes.includes("feed-identifier-projection"))
  assert.ok(codes.includes("brand-reader-conflict"))
})
test("label variations are reported without replacing spelling or writing metadata", () => {
  const inputs = [product(), product({ _id: "p2", sku: "SKU-2", slug: "other", name: "Another Verified Product Model", division: "home appliances" })]
  const report = auditCatalogue(inputs)
  assert.ok(report.products.every(item => item.issues.some(issue => issue.code === "inconsistent-division")))
  assert.equal(inputs[1].division, "home appliances")
})
test("large catalogue reports pack repeated rules once and preserve issue details", () => {
  const input = Array.from({ length: 2000 }, (_, index) => ({ _id: `p${index}`, sku: `SKU-${index}`, name: `Model ${index}` }))
  const report = auditCatalogue(input)
  const packed = packQualityReport(report)
  assert.ok(Buffer.byteLength(JSON.stringify(packed)) < 4 * 1024 * 1024)
  assert.deepEqual(JSON.parse(JSON.stringify(unpackQualityReport(packed).products)), JSON.parse(JSON.stringify(report.products)))
})
test("export values neutralize spreadsheet formulas and escape quotes", () => {
  for (const value of ["=HYPERLINK(1)", " +cmd", "\t@SUM(1)", "-1"]) assert.ok(qualityCsvCell(value).startsWith('"\''))
  assert.equal(qualityCsvCell('Normal "title"'), '"Normal ""title"""')
})

test("review priority puts active blocked products first without changing the report", () => {
  const report = auditCatalogue([
    product({ _id: "ready", sku: "R", slug: "r" }),
    product({ _id: "inactive", sku: "I", slug: "i", name: "Inactive Product Model", active: false, stock: -1 }),
    product({ _id: "improve", sku: "M", slug: "m", name: "Active Product Model", description: "Short" }),
    product({ _id: "blocked", sku: "B", slug: "b", name: "Blocked Product Model", price: -1 }),
  ])
  const original = JSON.stringify(report)
  const queue = filterReviewProducts(report.products, DEFAULT_REVIEW_FILTERS)
  assert.deepEqual(Array.from(queue, entry => entry.id), ["blocked", "inactive", "improve", "ready"])
  assert.equal(JSON.stringify(report), original)
})

test("area, rule and severity must match the same issue, and readiness/visibility filter products", () => {
  const report = auditCatalogue([product({ price: -1, description: "Short" }), product({ _id: "inactive", sku: "I", name: "Inactive Model Product", slug: "i", active: false, price: -1 })])
  const filters = { ...DEFAULT_REVIEW_FILTERS, area: "content", severity: "blocked" }
  assert.equal(filterReviewProducts(report.products, filters).length, 0)
  const active = { ...DEFAULT_REVIEW_FILTERS, area: "commercial", severity: "blocked", visibility: "active", status: "blocked" }
  const queue = filterReviewProducts(report.products, active)
  assert.equal(queue.length, 1)
  assert.deepEqual(Array.from(matchingReviewIssues(queue[0], active), issue => issue.code), ["invalid-price"])
  assert.equal(filterReviewProducts(report.products, { ...active, rule: "weak-description" }).length, 0)
  assert.equal(filterReviewProducts(report.products, { ...DEFAULT_REVIEW_FILTERS, search: "Home Appliances" }).length, 2)
})

test("review overview counts products distinctly while disclosing overlapping areas", () => {
  const report = auditCatalogue([product({ price: -1, stock: -1, image: undefined, images: [] }), product({ _id: "inactive", sku: "I", name: "Inactive Model Product", slug: "i", division: "", taxonomySource: "metadata-sheet", active: false, price: -1 })])
  const summary = catalogueReviewSummary(report.products)
  const commercial = summary.areas.find(area => area.id === "commercial")
  assert.equal(commercial.products, 2)
  assert.equal(commercial.issues, 3)
  assert.equal(commercial.activeBlocked, 1)
  assert.equal(summary.activeBlocked, 1)
  assert.equal(summary.divisions[0].division, "Home Appliances")
  assert.ok(summary.divisions.some(row => row.division === ""))
  assert.equal(summary.rules.find(rule => rule.code === "invalid-price").active, 1)
})

test("review worksheet includes every matching product and blank approval cells with safe values", () => {
  const report = auditCatalogue(Array.from({ length: 61 }, (_, index) => product({ _id: `p${index}`, sku: `SKU-${index}`, name: index === 0 ? '=HYPERLINK("unsafe")' : `Verified Product Model ${index}`, slug: `p${index}`, price: -1 })))
  const filters = { ...DEFAULT_REVIEW_FILTERS, rule: "invalid-price" }
  const queue = filterReviewProducts(report.products, filters)
  const original = JSON.stringify(report)
  const csv = catalogueReviewCsv(queue, filters, "sara_clone", "2026-11-01T00:00:00Z", true)
  const rows = csv.split("\r\n")
  assert.equal(rows.length, 62)
  assert.ok(rows[0].includes('"Proposed value (review only)"'))
  assert.ok(rows[0].includes('"Approval decision (not applied)"'))
  assert.ok(rows.slice(1).every(row => row.endsWith(',"","","",""')))
  assert.ok(csv.includes("'="))
  assert.ok(csv.includes('"SKU-60"'))
  assert.ok(!csv.includes('"weak-description"'))
  assert.equal(JSON.stringify(report), original)
  assert.ok(!catalogueReviewCsv(queue, filters, "sara_clone", report.scannedAt).includes("Proposed value"))
})
