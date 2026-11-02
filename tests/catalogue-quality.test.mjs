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
  for (const code of ["missing-sku", "generic-title", "missing-brand", "invalid-price", "invalid-stock", "missing-image"]) assert.ok(codes.includes(code), code)
  assert.ok(!codes.includes("missing-warranty"))
  assert.ok(report.products[0].evidence.warrantySource.includes("manufacturer-warranty policy"))
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
test("duplicate SKU and slug issues affect every matching product", () => {
  const report = auditCatalogue([product(), product({ _id: "p2" })])
  assert.equal(report.blocked, 2)
  for (const entry of report.products) for (const code of ["duplicate-sku", "duplicate-slug"]) assert.ok(entry.issues.some(issue => issue.code === code))
})
test("legacy EAN/MRP identify page/feed inconsistencies without conflating brand and manufacturer", () => {
  const report = auditCatalogue([product({ mrp: undefined, raw: { MRP: 25000, "EAN Number": "4006381333931" }, manufacturerName: "Different Manufacturer" })])
  const codes = report.products[0].issues.map(issue => issue.code)
  assert.ok(codes.includes("mrp-reader-conflict"))
  assert.ok(codes.includes("feed-identifier-projection"))
  assert.ok(!codes.includes("brand-reader-conflict"))
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

test("itemno and rich linked specifications are checked before reporting missing identity, content, images or tax", () => {
  const input = product({ sku: undefined, itemno: "000123", description: "NA", modelNumber: undefined, mpn: undefined,
    features: [], technical_details: {}, images: [], image: undefined, warrantyText: undefined, hsnCode: undefined, gstRate: undefined })
  const spec = { sku: " 000123 ", overview: "A detailed manufacturer overview of the exact model with all its useful specifications, features and customer-facing information.",
    technical_details: { "Item model number": "MODEL-123", "Manufacturer Part Number": "MP-123", "Warranty Description": "Two years manufacturer warranty", "HSN Code": "8450", "GST Rate": "18 %", Capacity: "8 kg" },
    specification_images: ["https://example.com/front.jpg", "https://example.com/back.jpg"], from_manufacturer: '<img data-src="https://example.com/detail.jpg" />' }
  const baseline = JSON.stringify([input, spec])
  const entry = auditCatalogue([input], [spec]).products[0]
  for (const code of ["missing-sku", "missing-model", "missing-identifiers", "weak-description", "missing-specifications", "missing-image", "few-images", "missing-warranty", "hsn-needs-review", "gst-needs-review"]) assert.ok(!entry.issues.some(issue => issue.code === code), code)
  assert.equal(entry.sku, "000123")
  assert.equal(entry.evidence.images, 3)
  assert.equal(entry.evidence.model, "MODEL-123")
  assert.ok(entry.evidence.specificationFields >= 6)
  assert.equal(entry.evidence.warranty, "Two years manufacturer warranty")
  assert.equal(entry.evidence.specificationMatched, true)
  assert.ok(entry.issues.some(issue => issue.code === "feed-image-projection" && issue.severity === "review" && issue.current.includes("3 images found")))
  assert.equal(JSON.stringify([input, spec]), baseline)
})

test("product_id joins support missing spec SKUs and do not borrow another product's specification", () => {
  const input = product({ sku: undefined, itemno: "SKU-1", modelNumber: undefined })
  const linked = auditCatalogue([input], [{ product_id: "p1", technical_details: { "Model Number": "LINKED-MODEL" } }]).products[0]
  assert.equal(linked.evidence.model, "LINKED-MODEL")
  assert.equal(linked.evidence.specificationMatched, true)
  const conflicting = auditCatalogue([input], [{ sku: "SKU-1", product_id: "other", technical_details: { "Model Number": "WRONG-MODEL" } }]).products[0]
  assert.equal(conflicting.evidence.model, "")
  assert.equal(conflicting.evidence.specificationMatched, false)
  assert.ok(conflicting.issues.some(issue => issue.code === "specification-link-conflict"))
})

test("JSON/nested technical fields and alternate image fields are recognised; empty fields cannot mask them", () => {
  const input = product({ modelNumber: undefined, warrantyText: undefined, hsnCode: undefined, gstRate: undefined, features: [],
    technical_details: JSON.stringify({ Identity: { "Model Name": "JSON-MODEL" }, Warranty: "Manufacturer warranty", "HSN Code": "8450", GST: "18%", Capacity: "8 kg" }),
    image: undefined, images: [], specification_images: ["/images/front.jpg", "/images/back.jpg"], data: { images: [{ src: "/images/detail.jpg" }] } })
  const entry = auditCatalogue([input]).products[0]
  assert.equal(entry.evidence.model, "JSON-MODEL")
  assert.equal(entry.evidence.images, 3)
  assert.ok(!entry.issues.some(issue => ["missing-specifications", "missing-model", "missing-image", "few-images", "gst-needs-review", "hsn-needs-review"].includes(issue.code)))
  const table = auditCatalogue([product({ modelNumber: undefined, features: [], technical_details: undefined,
    specifications: [{ name: "Model Number", value: "TABLE-MODEL" }, { name: "Capacity", value: "8 kg" }] })]).products[0]
  assert.equal(table.evidence.model, "TABLE-MODEL")
  assert.ok(table.evidence.specificationFields >= 2)
})

test("default manufacturer warranty does not invent a duration or suppress missing GST checks", () => {
  const entry = auditCatalogue([product({ warrantyText: undefined, hsnCode: undefined, gstRate: undefined })]).products[0]
  assert.ok(!entry.issues.some(issue => issue.code === "missing-warranty"))
  assert.ok(entry.evidence.warranty.includes("duration and conditions are set by the manufacturer"))
  assert.ok(!entry.issues.some(issue => issue.code === "hsn-needs-review"))
  assert.ok(entry.issues.some(issue => issue.code === "gst-needs-review"))
  const invalid = auditCatalogue([product({ stock: -1, gtin: "4006381333932", technical_details: { Model: "N/A" } })]).products[0]
  assert.ok(invalid.issues.some(issue => issue.code === "invalid-stock"))
  assert.ok(invalid.issues.some(issue => issue.code === "invalid-gtin"))
  assert.ok(!auditCatalogue([product({ gstRate: 40 })]).products[0].issues.some(issue => issue.code === "gst-needs-review"))
  assert.ok(auditCatalogue([product({ gstRate: 101 })]).products[0].issues.some(issue => issue.code === "gst-needs-review"))
})

test("manufacturer HTML specification tables supply model, warranty and tax details", () => {
  const table = '<table><tr><th>Model&nbsp;Number</th><td>TABLE-HTML</td></tr><tr><td>Warranty Description</td><td>Manufacturer warranty: two years</td></tr><tr><td>HSN Code</td><td>8450</td></tr><tr><td>GST</td><td>18%</td></tr><tr><td>Capacity</td><td>8 kg</td></tr></table>'
  const entry = auditCatalogue([product({ modelNumber: undefined, warrantyText: undefined, hsnCode: undefined, gstRate: undefined, features: [], technical_details: {}, from_manufacturer: table })]).products[0]
  assert.equal(entry.evidence.model, "TABLE-HTML")
  assert.equal(entry.evidence.specificationFields, 5)
  assert.equal(entry.evidence.warrantySource, "Product manufacturer table")
  assert.ok(!entry.issues.some(issue => ["missing-model", "missing-specifications", "hsn-needs-review", "gst-needs-review", "missing-warranty"].includes(issue.code)))
})

function catalogueApiFixture(records, counted = records.length, specifications = []) {
  const reads = []
  const collection = name => ({
    dbName: "fixture-store-catalogue",
    countDocuments: async (_filter, options) => { reads.push({ name, operation: "count", options }); return counted },
    find(_filter, options) {
      // Simulate the deployed failure when a getMore reply grows too large.
      if (!options.batchSize || options.batchSize > 100) {
        throw Object.assign(new Error("Large catalogue batch socket timeout"), { name: "MongoNetworkTimeoutError" })
      }
      for (const path of Object.keys(options.projection)) {
        if (path.split(".").some(part => !part)) throw new Error("MongoDB FieldPath cannot contain an empty path component")
      }
      reads.push({ name, operation: "find", options })
      let skip = 0, limit = Infinity
      return { sort() { return this }, skip(value) { skip = value; return this }, limit(value) { limit = value; return this }, toArray: async () => {
        let rows = name === "products" ? records : specifications
        if (name === "product_specifications" && _filter.$expr) {
          const ids = _filter.$expr.$or[0].$in[1]
          const keys = _filter.$expr.$or[2].$anyElementTrue[0].$map.in.$in[1]
          const { catalogueItemNumber } = sourceLoader().load("lib/catalogue-quality-data.ts")
          rows = rows.filter(row => ids.includes(String(row.product_id || row.productId || "")) || keys.includes(catalogueItemNumber(row).toLowerCase()))
        }
        return rows.slice(skip, skip + limit).map(row => {
        const projected = Object.fromEntries(Object.entries(row).filter(([key]) => key === "_id" || options.projection[key] === 1))
        for (const [key, expression] of Object.entries(options.projection)) {
          if (expression?.$getField) {
            const field = expression.$getField.field.$literal
            if (Object.hasOwn(row, field)) projected[key] = row[field]
          }
        }
        return projected
      }) } }
    },
  })
  const loader = sourceLoader({
    "@/lib/auth": { requireFullAdmin: async () => ({ ok: true, user: { id: "operator" } }) },
    "@/lib/db-service": {
      COLLECTIONS: { PRODUCTS: "products" },
      getCollection: async name => { assert.ok(["products", "product_specifications"].includes(name)); return collection(name) },
      normalizeId: rows => rows.map(({ _id, id: ignored, ...row }) => ({ ...row, id: String(_id) })),
    },
  })
  return { GET: loader.load("app/api/admin/catalogue-quality/route.ts").GET, reads, loader }
}

test("store catalogue scans succeed without clone configuration and use only bounded reads", async () => {
  const records = [product({ id: "forged", price: -1 }), product({ _id: "p2", sku: "SKU-2", name: "Another Verified Product Model", slug: "another" })]
  const baseline = JSON.stringify(records)
  const fx = catalogueApiFixture(records)
  assert.equal(fx.loader.env.DATABASE_CLONE_SOURCE_URI, undefined)
  assert.equal(fx.loader.env.DATABASE_CLONE_APPROVAL_SECRET, undefined)
  const response = await fx.GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  const report = unpackQualityReport(await response.json())
  assert.equal(report.environment, "fixture-store-catalogue")
  assert.equal(report.total, 2)
  assert.equal(report.products[0].id, "p1")
  assert.ok(report.products[0].issues.some(issue => issue.code === "invalid-price" && issue.action))
  assert.equal(report.cloneCompletedAt, undefined)
  assert.ok(fx.reads.every(read => read.options.maxTimeMS > 0 && read.options.maxTimeMS <= 15000))
  assert.ok(fx.reads.filter(read => read.operation === "find").every(read => read.options.batchSize === 100))
  assert.deepEqual(fx.reads.map(read => read.name), ["products", "products", "product_specifications"])
  assert.equal(JSON.stringify(records), baseline)
})

test("store catalogue scans refuse oversize or changing inputs instead of reporting partial success", async () => {
  const oversize = catalogueApiFixture([], 20001)
  assert.equal((await oversize.GET()).status, 413)
  assert.equal(oversize.reads.length, 1)
  const changing = catalogueApiFixture([product()], 2)
  const response = await changing.GET()
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /catalogue changed/i)
})

test("literal dotted spreadsheet headers scan safely in products and specifications", async () => {
  const input = product({ sku: undefined, itemno: undefined, "Item No.": "000042", modelNumber: undefined })
  const spec = { _id: "s42", "Item No.": "000042", technical_details: { "Model Number": "DOT-42" } }
  const fx = catalogueApiFixture([input], 1, [spec])
  const response = await fx.GET()
  assert.equal(response.status, 200)
  const entry = unpackQualityReport(await response.json()).products[0]
  assert.equal(entry.sku, "000042")
  assert.equal(entry.evidence.model, "DOT-42")
  assert.equal(entry.evidence.specificationMatched, true)
  assert.ok(fx.reads.filter(read => read.operation === "find").every(read => !Object.hasOwn(read.options.projection, "Item No.")))
  assert.equal(input["Item No."], "000042")
})

test("unexpected catalogue errors identify the failed stage without exposing provider details", async () => {
  const logs = []
  const loader = sourceLoader({
    "@/lib/auth": { requireFullAdmin: async () => ({ ok: true, user: { id: "operator" } }) },
    "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products" }, normalizeId: value => value,
      getCollection: async () => ({ countDocuments: async () => { throw Object.assign(new Error("private provider details"), { code: 50 }) } }) },
  }, { context: { console: { ...console, error: (...args) => logs.push(args) } } })
  const response = await loader.load("app/api/admin/catalogue-quality/route.ts").GET()
  assert.equal(response.status, 500)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  const result = await response.json()
  assert.match(result.error, /reading products/)
  assert.ok(!result.error.includes("private provider details"))
  assert.ok(!logs.flat().some(value => value instanceof Error && value.message.includes("private provider details")))
})

test("catalogue API fetches the full specification fields needed by the quality checks", async () => {
  const input = product({ sku: undefined, itemno: "I-1", modelNumber: undefined, description: "", features: [], images: [], image: undefined })
  const fx = catalogueApiFixture([input], 1, [{ _id: "spec", product_id: "p1", overview: "A useful manufacturer overview of this exact product model with detailed description and verified facts for customers.",
    technical_details: { "Model Number": "PROJECTED-MODEL", Capacity: "8 kg", Colour: "White" },
    specification_images: ["/images/one.jpg", "/images/two.jpg"], from_manufacturer: '<img src="/images/three.jpg" />' }])
  const response = await fx.GET()
  assert.equal(response.status, 200)
  const entry = unpackQualityReport(await response.json()).products[0]
  assert.equal(entry.evidence.model, "PROJECTED-MODEL")
  assert.equal(entry.evidence.images, 3)
  assert.equal(entry.evidence.specificationMatched, true)
  assert.ok(!entry.issues.some(issue => ["missing-model", "missing-image", "few-images", "weak-description", "missing-specifications"].includes(issue.code)))
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


test("uploaded itemno is the SKU; missing manufacturer identifiers do not need correction", () => {
  const input = product({ itemno: "T008025", sku: "OLD-INTERNAL-SKU", mpn: undefined, gtin: undefined })
  const before = JSON.stringify(input)
  const entry = auditCatalogue([input]).products[0]
  assert.equal(entry.sku, "T008025")
  assert.equal(entry.evidence.sku, "T008025")
  assert.ok(!entry.issues.some(issue => ["missing-sku", "missing-identifiers", "sku-as-mpn"].includes(issue.code)))
  assert.equal(JSON.stringify(input), before)
  assert.equal(input.mpn, undefined)
  assert.equal(input.gtin, undefined)
})

test("raw uploaded itemno takes precedence over legacy SKU and matches its own specification", () => {
  const input = product({ sku: "OLD-SKU", raw: { "Item No.": "T000007" }, modelNumber: undefined })
  const spec = { sku: "T000007", technical_details: { "Model number": "NOKIA-110" } }
  const before = JSON.stringify([input, spec])
  const entry = auditCatalogue([input], [spec]).products[0]
  assert.equal(entry.sku, "T000007")
  assert.equal(entry.evidence.specificationMatched, true)
  assert.equal(entry.evidence.model, "NOKIA-110")
  assert.equal(JSON.stringify([input, spec]), before)
})

test("same name with different uploaded item numbers stays as separate catalogue records without title warnings", () => {
  const inputs = [
    product({ itemno: "T008025", sku: undefined, name: "NOKIA HMD 110 DS GREEN", slug: "nokia-green-t008025", mpn: undefined }),
    product({ _id: "p2", itemno: "T008026", sku: undefined, name: "NOKIA HMD 110 DS GREEN", slug: "nokia-green-t008026", mpn: undefined }),
  ]
  const before = JSON.stringify(inputs), report = auditCatalogue(inputs)
  assert.equal(report.total, 2)
  assert.deepEqual(Array.from(report.products, entry => entry.sku), ["T008025", "T008026"])
  for (const entry of report.products) {
    assert.ok(!entry.issues.some(issue => ["duplicate-title", "duplicate-sku", "missing-identifiers"].includes(issue.code)))
  }
  assert.equal(JSON.stringify(inputs), before)
})

test("real duplicate uploaded item numbers remain blocking even with different legacy SKUs", () => {
  const report = auditCatalogue([
    product({ itemno: "T000001", sku: "OLD-ONE" }),
    product({ _id: "p2", itemno: "T000001", sku: "OLD-TWO", slug: "other-url" }),
  ])
  assert.equal(report.blocked, 2)
  for (const entry of report.products) assert.ok(entry.issues.some(issue => issue.code === "duplicate-sku"))
})


test("paged scans bound each product read and combine cross-page duplicate item numbers correctly", async () => {
  const records = Array.from({ length: 102 }, (_, index) => product({ _id: "p" + String(index).padStart(3, "0"),
    itemno: index === 101 ? "T000000" : "T" + String(index).padStart(6, "0"), sku: undefined,
    slug: index === 101 ? "product-0" : "product-" + index,
    division: index === 101 ? "home appliances" : "Home Appliances", modelNumber: undefined }))
  const specs = records.slice(0, 101).map((row, index) => ({ _id: "s" + index, sku: row.itemno,
    technical_details: { "Model Number": "MODEL-" + index } }))
  const before = JSON.stringify([records, specs]), fx = catalogueApiFixture(records, 102, specs)
  const pages = []
  for (const offset of [0, 100]) {
    const response = await fx.GET(new Request("https://fixture.invalid/api/admin/catalogue-quality?offset=" + offset))
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.scan.totalProducts, 102)
    assert.equal(data.scan.offset, offset)
    assert.equal(data.scan.read, offset === 0 ? 100 : 2)
    assert.equal(data.scan.nextOffset, offset === 0 ? 100 : null)
    pages.push(unpackQualityReport(data))
  }
  const complete = sourceLoader().load("lib/catalogue-quality.ts").completeCatalogueReport(pages.flatMap(page => page.products), pages[0].environment)
  assert.equal(complete.total, 102)
  assert.equal(new Set(complete.products.map(row => row.id)).size, 102)
  assert.equal(complete.products[0].evidence.model, "MODEL-0")
  assert.equal(complete.products[100].evidence.model, "MODEL-100")
  for (const index of [0, 101]) for (const code of ["duplicate-sku", "duplicate-slug", "inconsistent-division"]) assert.ok(complete.products[index].issues.some(issue => issue.code === code), code)
  assert.equal(JSON.stringify([records, specs]), before)
})

test("invalid scan offsets are rejected before reading the database", async () => {
  for (const offset of ["-1", "1", "100.5", "abc", "20100", ""]) {
    const fx = catalogueApiFixture([])
    const response = await fx.GET(new Request("https://fixture.invalid/api/admin/catalogue-quality?offset=" + offset))
    assert.equal(response.status, 400, offset)
    assert.equal(fx.reads.length, 0)
  }
})


test("missing catalogue HSN and one or two usable images are accepted under the delivery invoice policy", () => {
  for (const images of [["/images/front.webp"], ["/images/front.webp", "/images/back.webp"]]) {
    const input = product({ hsnCode: undefined, image: images[0], images })
    const before = JSON.stringify(input), report = auditCatalogue([input]), entry = report.products[0]
    assert.equal(entry.evidence.images, images.length)
    assert.equal(entry.evidence.hsn, "")
    assert.ok(!entry.issues.some(issue => ["hsn-needs-review", "few-images", "missing-image"].includes(issue.code)))
    assert.equal(entry.status, "ready")
    assert.ok(report.limitations.some(value => value.includes("printed delivery invoice")))
    assert.equal(JSON.stringify(input), before)
    assert.equal(input.hsnCode, undefined)
  }
})

test("no usable image remains blocking and an explicitly malformed HSN still needs review", () => {
  const missing = auditCatalogue([product({ image: "/placeholder.svg", images: [], hsnCode: undefined })]).products[0]
  assert.ok(missing.issues.some(issue => issue.code === "missing-image" && issue.severity === "blocked"))
  assert.ok(!missing.issues.some(issue => issue.code === "few-images"))
  const malformed = auditCatalogue([product({ hsnCode: "123" })]).products[0]
  const issue = malformed.issues.find(issue => issue.code === "hsn-needs-review")
  assert.ok(issue)
  assert.equal(issue.current, "123")
  assert.ok(!issue.reason.includes("absent"))
})
