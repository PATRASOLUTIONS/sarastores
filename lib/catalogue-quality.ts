import { metadataSheetRowFromProduct } from "@/lib/product-metadata-sheet"
import { getProductCommerceAttributes } from "@/lib/product-attributes"
import { getCatalogMRP } from "@/lib/product-display"
import { catalogueItemNumber, inspectCatalogueData, matchCatalogueSpecifications } from "@/lib/catalogue-quality-data"

export type QualitySeverity = "blocked" | "improve" | "review"
export interface QualityIssue {
  code: string; field: string; severity: QualitySeverity; current: string; reason: string; action: string
}
export interface QualityProduct {
  id: string; sku: string; slug?: string; name: string; division: string; category: string; segment: string; brand: string
  active: boolean; status: "blocked" | "needs-improvement" | "ready"; issues: QualityIssue[]
  evidence: { sku: string; model: string; images: number; specificationFields: number; specificationMatched: boolean; warranty: string; warrantySource: string; hsn: string; gst: string }
}
export interface QualityReport {
  scannedAt: string; cloneCompletedAt?: string; environment: string; total: number; active: number
  blocked: number; needsImprovement: number; ready: number; issues: number
  products: QualityProduct[]; rules: { code: string; count: number; severity: QualitySeverity }[]
  limitations: string[]
}
export type PackedQualityReport = Omit<QualityReport, "products"> & {
  definitions: Record<string, Omit<QualityIssue, "current">>
  products: (Omit<QualityProduct, "issues"> & { issues: { code: string; current: string; reason?: string }[] })[]
}

/** Send repeated rule text once so a 1,000+ product report fits Vercel's response limit. */
export function packQualityReport(report: QualityReport): PackedQualityReport {
  const definitions: PackedQualityReport["definitions"] = {}
  const products = report.products.map(product => ({ ...product, issues: product.issues.map(issue => {
    if (!definitions[issue.code]) {
      definitions[issue.code] = { code: issue.code, field: issue.field, severity: issue.severity, reason: issue.reason, action: issue.action }
    }
    return { code: issue.code, current: issue.current,
      ...(definitions[issue.code].reason !== issue.reason ? { reason: issue.reason } : {}) }
  }) }))
  return { ...report, products, definitions }
}
export function unpackQualityReport(report: PackedQualityReport): QualityReport {
  return { ...report, products: report.products.map(product => ({ ...product, issues: product.issues.map(issue => ({ ...report.definitions[issue.code], ...issue })) })) }
}
type Product = Record<string, unknown>
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
const plainText = (value: unknown) => text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
const rawOf = (product: Product): Product => product.raw && typeof product.raw === "object" && !Array.isArray(product.raw) ? product.raw as Product : {}
const numeric = (value: unknown) => value === null || value === undefined || value === "" ? NaN : Number(value)

export function validGtin(value: string) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false
  let sum = 0
  for (let index = value.length - 2, position = 0; index >= 0; index--, position++) sum += Number(value[index]) * (position % 2 === 0 ? 3 : 1)
  return (10 - sum % 10) % 10 === Number(value[value.length - 1])
}

function classify(product: Product, specification?: Product, conflictingLink = false): QualityProduct {
  const data = inspectCatalogueData(product, specification)
  const metadata = metadataSheetRowFromProduct({ ...product, sku: catalogueItemNumber(product), raw: product.raw || product.rawData })
  metadata.itemno = catalogueItemNumber(product)
  if (!metadata.brand) metadata.brand = data.find("Brand", "Manufacturer Name", "manufacturerName", "manufacturer_name", "manufacturer")?.value || ""
  const raw = rawOf(product)
  const attributes = getProductCommerceAttributes({ ...product, modelNumber: data.model?.value, gtin: data.gtin?.value, mpn: data.mpn?.value, hsnCode: data.hsn?.value })
  const issues: QualityIssue[] = []
  const add = (code: string, field: string, severity: QualitySeverity, current: unknown, reason: string, action: string) => {
    issues.push({ code, field, severity, current: plainText(current).slice(0, 300) || "Missing", reason, action })
  }
  const id = String(product._id ?? product.id ?? "")
  if (conflictingLink) add("specification-link-conflict", "Specification link", "review", metadata.itemno, "A specification has this item number but points to a different product ID. Its details were not assigned to this product.", "Review the SKU/itemno and product_id link before using that record; the scan will not borrow another product's details.")
  const name = metadata.name
  if (!metadata.itemno) add("missing-sku", "SKU", "blocked", "", "The product cannot be matched reliably across stock, imports and feeds.", "Assign and verify a unique item number; do not generate a manufacturer identifier from it.")
  if (!name || /^(?:product|unnamed product|item|test|new product)(?:\s*\d*)?$/i.test(name)) {
    add("generic-title", "Name", "blocked", name, "The title does not identify a saleable product.", "Use the verified brand, model, product type and key specification.")
  } else if (name.length < 15 || name.length > 150) {
    add("title-length", "Name", "improve", name, "The title is very short or exceeds the Merchant feed's 150-character title limit.", "Write a concise product title that identifies the exact model and variant.")
  }
  for (const [field, value] of [["Division", metadata.division], ["Category", metadata.category], ["Segment", metadata.segment], ["Brand", metadata.brand]] as const) {
    if (!value) add(`missing-${field.toLowerCase()}`, field, field === "Brand" ? "blocked" : "improve", value, `Missing ${field.toLowerCase()} weakens navigation or product identification.`, "Classify using the agreed merchandising hierarchy and verified manufacturer information.")
  }
  if (metadata.brand && metadata.category && metadata.brand.toLowerCase() === metadata.category.toLowerCase()) {
    add("brand-category-conflict", "Brand / Category", "review", metadata.brand, "The brand repeats the category; this may be a legacy warehouse mapping.", "Verify that brand and category describe different, correct facts.")
  }
  const description = data.content
  if (description.length < 80 && data.specificationFields < 3) add("weak-description", "Description", "improve", description, "Little useful descriptive content was found in descriptions, overview, features, manufacturer content or technical details.", "Describe intended use, key benefits and verified details; avoid generic copied filler.")
  const model = data.model?.value
  if (!model) add("missing-model", "Model number", "improve", "", "The exact manufacturer model cannot be established from a structured field.", "Verify the model from packaging or an official manufacturer specification sheet.")
  if (data.gtin && !validGtin(data.gtin.value)) add("invalid-gtin", "GTIN / EAN", "blocked", data.gtin.value, "The identifier has an invalid length, format or checksum.", "Read the genuine barcode from the product or manufacturer; never invent a GTIN.")
  if (data.mpn && data.mpn.value === metadata.itemno) add("sku-as-mpn", "MPN", "review", data.mpn.value, "The manufacturer MPN equals the internal item number; this needs confirmation.", "Confirm it is the actual manufacturer part number, not an internal SKU substituted as MPN.")
  if (!text(product.gtin) && (text(product.ean) || text(raw["EAN Number"]) || text(raw.EAN))) {
    add("feed-identifier-projection", "GTIN / EAN", "improve", product.ean || raw["EAN Number"] || raw.EAN, "EAN exists in a legacy field that the current Merchant feed projection does not fetch.", "Review identifier normalization and the feed projection before submitting this item; no automatic change is applied.")
  }
  const price = numeric(product.price)
  if (!Number.isFinite(price) || price <= 0) add("invalid-price", "Price", "blocked", product.price, "The selling price is missing, non-numeric or not positive.", "Verify the actual selling price with the commercial team.")
  const mrp = getCatalogMRP(product) || getCatalogMRP(specification || {})
  if (!mrp) add("missing-mrp", "MRP", "improve", "", "No actual catalogue MRP is available.", "Verify the printed MRP; never derive a fictitious discount from an estimated MRP.")
  else if (Number.isFinite(price) && price > mrp) add("price-above-mrp", "Price / MRP", "blocked", `${price} / ${mrp}`, "The selling price exceeds the recorded MRP.", "Verify both amounts and correct only after approval.")
  else if (mrp !== numeric(product.mrp)) add("mrp-reader-conflict", "MRP", "improve", mrp, "The storefront can read a legacy MRP, but the Merchant feed uses the top-level mrp field.", "Review page/feed price agreement and the proposed normalization.")
  const stock = numeric(product.stock)
  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) add("invalid-stock", "Stock", "blocked", product.stock, "Stock must be a known nonnegative integer; unknown stock can produce inconsistent availability.", "Reconcile the quantity with the inventory source. Zero stock is valid.")
  const images = data.images
  if (!images.length) add("missing-image", "Images", "blocked", "", "No usable non-placeholder image is present.", "Add a clear image of the exact product and variant from an authorized source.")
  if (images.length && !data.productImages.length) {
    add("feed-image-projection", "Shopping feed image mapping", "review", `${images.length} images found in specification/alternate image fields`, "Product images were found. The Merchant feed currently reads product image/images fields, so its mapping needs review even when the product page has pictures.", "Review feed image mapping using the existing images; do not add duplicate images just to satisfy this scan.")
  }
  const warranty = data.warranty?.value || (data.warrantyMonths?.value ? `${data.warrantyMonths.value} months` : "Manufacturer warranty applies; duration and conditions are set by the manufacturer")
  if (data.warrantyMonths && Number(data.warrantyMonths.value) < 0) add("invalid-warranty", "Warranty duration", "review", data.warrantyMonths.value, "The recorded warranty duration is negative.", "Verify the product-specific manufacturer warranty duration. The scan does not replace it with an invented default term.")
  if (attributes.hsnCode && !/^\d{4}(?:\d{2})?(?:\d{2})?$/.test(attributes.hsnCode)) add("hsn-needs-review", "HSN", "review", attributes.hsnCode, "The recorded HSN does not have a standard 4, 6 or 8-digit format.", "Ask the tax/commercial team to verify the applicable classification; format checks cannot establish tax correctness.")
  const explicitGst = data.gst?.value
  const gstMatch = explicitGst?.match(/^(?:GST\s*@?\s*)?(\d+(?:\.\d+)?)\s*%?$/i)
  if (explicitGst == null || !gstMatch || Number(gstMatch[1]) > 100) {
    add("gst-needs-review", "GST", "review", explicitGst, "An explicit GST percentage was not found, could not be parsed or is outside 0–100%. A platform fallback or manufacturer warranty is not evidence of tax correctness.", "Verify the actual tax treatment using the approved HSN and current tax rules.")
  }
  if (!text(product.slug)) add("missing-slug", "Product URL", "improve", "", "The page falls back to its database ID rather than a descriptive stable URL.", "Propose a stable product slug; preserve existing URLs or add redirects if changing them.")
  const features = [product.features, product.bullet_points, specification?.features, specification?.bullet_points].flatMap(value => Array.isArray(value) ? value : [value]).filter(value => plainText(value))
  if (!features.length && !data.specificationFields) {
    add("missing-specifications", "Specifications", "improve", "", "There are no structured features or technical details available to this scan.", "Add category-specific verified specifications, including model, capacity, power, dimensions and box contents where relevant.")
  }
  if (attributes.weightKg !== null && attributes.weightKg <= 0) add("invalid-weight", "Shipping weight", "improve", attributes.weightKg, "The shipping weight is not positive.", "Verify the packaged shipping weight and units.")
  return { id, sku: metadata.itemno, slug: text(product.slug), name: name || "Unnamed product", division: metadata.division,
    category: metadata.category, segment: metadata.segment, brand: metadata.brand, active: product.active === true,
    status: issues.some(issue => issue.severity === "blocked") ? "blocked" : issues.length ? "needs-improvement" : "ready", issues,
    evidence: { sku: metadata.itemno, model: model || "", images: images.length, specificationFields: data.specificationFields,
      specificationMatched: Boolean(specification), warranty: warranty.slice(0, 300), warrantySource: data.warranty?.source || data.warrantyMonths?.source || "Store manufacturer-warranty policy",
      hsn: attributes.hsnCode || "", gst: explicitGst || "" } }
}

export function auditCatalogue(products: Product[], specifications: Product[] = [], environment = "Store catalogue"): QualityReport {
  const linked = matchCatalogueSpecifications(products, specifications)
  const results = products.map((product, index) => classify(product, linked[index].specification, linked[index].conflictingLink))
  return completeCatalogueReport(results, environment)
}

/** Reconcile uniqueness and label consistency across all scanned pages. */
export function completeCatalogueReport(results: QualityProduct[], environment = "Store catalogue"): QualityReport {
  results = results.map(product => ({ ...product, issues: product.issues.filter(issue => !["duplicate-sku", "duplicate-slug", "inconsistent-division", "inconsistent-category", "inconsistent-segment", "inconsistent-brand"].includes(issue.code)) }))
  const addDuplicate = (field: "sku" | "slug", code: string, severity: QualitySeverity) => {
    const groups = new Map<string, number[]>()
    results.forEach((product, index) => {
      const value = field === "sku" ? product.sku : text(product.slug)
      if (!value) return
      const key = value.toLowerCase().replace(/\s+/g, " ").trim()
      groups.set(key, [...(groups.get(key) || []), index])
    })
    for (const indexes of groups.values()) {
      if (indexes.length < 2) continue
      for (const index of indexes) results[index].issues.push({ code, field, severity,
        current: field === "slug" ? text(results[index].slug) : results[index][field],
        reason: `${indexes.length} products share this ${field}.`,
        action: "Reconcile duplicates before changing identifiers; preserve product references and existing URLs." })
    }
  }
  addDuplicate("sku", "duplicate-sku", "blocked")
  addDuplicate("slug", "duplicate-slug", "blocked")
  // Report inconsistent spelling/casing without choosing or writing a canonical label.
  for (const field of ["division", "category", "segment", "brand"] as const) {
    const labels = new Map<string, Set<string>>()
    for (const product of results) {
      const value = product[field]
      if (!value) continue
      const key = value.toLowerCase().replace(/[\s_-]+/g, " ").trim()
      labels.set(key, new Set([...(labels.get(key) || []), value]))
    }
    for (const product of results) {
      const variants = labels.get(product[field].toLowerCase().replace(/[\s_-]+/g, " ").trim())
      if (variants && variants.size > 1) product.issues.push({ code: `inconsistent-${field}`, field, severity: "improve",
        current: [...variants].join(" / "), reason: "Equivalent labels use inconsistent spelling, spacing or case.", action: "Agree one canonical label and preview the affected products before applying any correction." })
    }
  }
  const counts = new Map<string, { code: string; count: number; severity: QualitySeverity }>()
  for (const product of results) {
    product.status = product.issues.some(issue => issue.severity === "blocked") ? "blocked" : product.issues.length ? "needs-improvement" : "ready"
    for (const issue of product.issues) {
      const count = counts.get(issue.code) || { code: issue.code, count: 0, severity: issue.severity }
      count.count++; counts.set(issue.code, count)
    }
  }
  return { scannedAt: new Date().toISOString(), environment, total: results.length,
    active: results.filter(product => product.active).length, blocked: results.filter(product => product.status === "blocked").length,
    needsImprovement: results.filter(product => product.status === "needs-improvement").length,
    ready: results.filter(product => product.status === "ready").length, issues: results.reduce((sum, product) => sum + product.issues.length, 0),
    products: results, rules: [...counts.values()].sort((a, b) => b.count - a.count),
    limitations: [
      "Read-only report of the store catalogue at scan time. Products can change while scanning; this is not a point-in-time snapshot and does not reflect later updates.",
      "HSN is provided on the printed delivery invoice, so missing online HSN does not create a catalogue issue. An HSN already recorded in the catalogue is still checked for format. The scan does not verify the printed invoice. One usable image is sufficient; a low photo count is not an issue.",
      "Images are checked by URL metadata only; the scan does not fetch URLs or verify that photos match the product.",
      "Manufacturer facts, variant accuracy, warranty, tax classification and category-specific specifications require human verification.",
      "The uploaded itemno is the store SKU and is preserved exactly, including letters and leading zeros. A missing manufacturer GTIN or MPN is not a catalogue error; itemno is never converted into a manufacturer barcode or part number.",
      "Different item numbers may share a product name. Public listings show one representative per name; this scan keeps every database record and checks item-number and URL uniqueness separately.",
      "Descriptions, manufacturer content, image fields and technical details from linked specifications are checked before reporting missing data.",
      "The store's default manufacturer-warranty policy is recognised. An exact duration is not guessed; explicit GST must still be found in the product or specification data.",
      "Ready means these automated rules passed, not that the product has been fact-checked or approved by Google.",
      "No product corrections or scan results are written to the database. Proposed changes need separate approval before implementation.",
    ] }
}

/** Spreadsheet formula injection protection, including whitespace before a formula. */
export function qualityCsvCell(value: unknown) {
  const original = String(value ?? "")
  const safe = /^[\s]*[=+\-@]/.test(original) ? `'${original}` : original
  return `"${safe.replace(/"/g, '""')}"`
}
