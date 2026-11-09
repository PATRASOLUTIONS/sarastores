import fs from "node:fs/promises"
import path from "node:path"
import { MongoClient } from "mongodb"
import { sourceLoader } from "../tests/source-loader.mjs"

// Explicitly read-only: no update/insert/delete, index creation or provider calls.
const loader = sourceLoader()
const { merchantPreviewItem, validMerchantGtin, merchantOfferId } = loader.load("lib/google-merchant-products.ts")
const { auditCatalogue } = loader.load("lib/catalogue-quality.ts")
const { CATALOGUE_DETAIL_PROJECTION, inspectCatalogueData, matchCatalogueSpecifications } = loader.load("lib/catalogue-quality-data.ts")
const { isPublicProduct } = loader.load("lib/product-visibility.ts")
const { purchaseStock } = loader.load("lib/purchase-validation.ts")
const { formatProductName } = loader.load("lib/product-name-format.ts")
const { groupAdminProductNames } = loader.load("lib/admin-product-name-groups.ts")

const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
if (!process.env.MONGODB_URI || !origin || !origin.startsWith("https://")) {
  throw new Error("MONGODB_URI and a public HTTPS NEXT_PUBLIC_SITE_URL are required")
}
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 12000, socketTimeoutMS: 45000 })
let stage = "connecting"
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise")
  stage = "reading product facts"
  const projection = { ...CATALOGUE_DETAIL_PROJECTION, name: 1, slug: 1, category: 1, division: 1, groupName: 1, segment: 1, subCategory: 1,
    taxonomySource: 1, price: 1, mrp: 1, originalPrice: 1, stock: 1, active: 1, disabled: 1, enabled: 1, isActive: 1,
    deleted: 1, isDeleted: 1, deletedAt: 1, discontinued: 1, status: 1, inStock: 1, serviceKind: 1,
    identifierExists: 1, condition: 1, seoDescription: 1, seoTitle: 1 }
  const collection = db.collection("products")
  const count = await collection.countDocuments({}, { maxTimeMS: 15000 })
  if (count > 20000) throw new Error("Catalogue exceeds the audited 20,000-record limit")
  const products = await collection.find({}, { projection, batchSize: 50, maxTimeMS: 30000 }).sort({ _id: 1 }).limit(20001).toArray()
  if (products.length !== count) throw new Error("Catalogue changed during the read; no partial audit saved")
  stage = "reading specifications"
  const specifications = await db.collection("product_specifications").find({}, { projection: CATALOGUE_DETAIL_PROJECTION, batchSize: 50, maxTimeMS: 30000 }).limit(20001).toArray()
  if (specifications.length > 20000) throw new Error("Specification limit exceeded")
  stage = "analysing facts"
  const normalized = products.map(product => ({ ...product, id: String(product._id) }))
  const quality = auditCatalogue(normalized, specifications, "Configured Sara catalogue (read-only)")
  const links = matchCatalogueSpecifications(normalized, specifications)
  const publicProducts = normalized.filter(isPublicProduct)
  const groups = groupAdminProductNames(publicProducts.map(product => ({ ...product,
    updatedAt: product.updatedAt instanceof Date ? product.updatedAt.toISOString() : product.updatedAt })))
  const selected = new Set([...groups.values()].map(group => String(group[0]._id)))
  const candidates = normalized.filter(product => selected.has(product.id) && (purchaseStock(product) || 0) > 0)
  const byId = new Map(normalized.map((product, index) => [product.id, { product, link: links[index] }]))
  const offerCounts = new Map()
  for (const product of normalized) {
    const offerId = merchantOfferId(product)
    offerCounts.set(offerId, (offerCounts.get(offerId) || 0) + 1)
  }
  const preview = candidates.map(product => {
    const item = merchantPreviewItem(product, origin.replace(/\/$/, ""), process.env.GOOGLE_MERCHANT_FEED_LABEL || "IN")
    if (offerCounts.get(item.offerId) > 1) { item.errors.push("Duplicate offer ID across catalogue"); item.input = null }
    const { link } = byId.get(product.id)
    const data = inspectCatalogueData(product, link.specification)
    const proposals = []
    const formatted = formatProductName(String(product.name || ""))
    if (formatted && formatted !== product.name) proposals.push({ field: "name", before: product.name || "", after: formatted, source: "Existing product name; formatting only", review: "Exact model/variant unchanged" })
    for (const [field, evidence] of [["gtin", data.gtin], ["mpn", data.mpn], ["modelNumber", data.model]]) {
      if (evidence && String(product[field] || "") !== evidence.value) proposals.push({ field, before: String(product[field] || ""), after: evidence.value,
        source: evidence.source, review: field === "gtin" ? (validMerchantGtin(evidence.value) ? "Checksum passes; verify exact variant/manufacturer assignment" : "Invalid checksum/length; do not apply") : "Verify exact manufacturer/variant assignment" })
    }
    if (!item.input && data.images.length && !data.productImages.length) proposals.push({ field: "image", before: String(product.image || ""), after: data.images[0],
      source: "Existing product / matched specification image", review: "Verify exact product/variant and usage rights; no download or record change" })
    return { ...item, specificationMatched: !!link.specification, specificationConflict: link.conflictingLink,
      availableFacts: { gtin: data.gtin?.value || null, gtinSource: data.gtin?.source || null, mpn: data.mpn?.value || null,
        model: data.model?.value || null, imageCount: data.images.length, contentLength: data.content.length }, proposals }
  })
  const errors = new Map()
  for (const item of preview) for (const error of item.errors) errors.set(error, (errors.get(error) || 0) + 1)
  const summary = { scannedAt: new Date().toISOString(), products: count, specifications: specifications.length,
    publicRepresentatives: selected.size, activeInStockCandidates: preview.length, merchantReady: preview.filter(item => item.input).length,
    blocked: preview.filter(item => !item.input).length,
    existingGtinFacts: preview.filter(item => item.availableFacts.gtin).length,
    existingMpnFacts: preview.filter(item => item.availableFacts.mpn).length,
    titleFormattingProposals: preview.filter(item => item.proposals.some(proposal => proposal.field === "name")).length,
    errors: [...errors].map(([error, count]) => ({ error, count })).sort((a, b) => b.count - a.count),
    limitations: ["Read-only catalogue scan; not a transactional snapshot.", "Identifier assignments, image rights, exact variants and policy/account approval need verification.",
      "Image URLs are inspected but not fetched.", "No database/index or Google changes were performed."] }
  const directory = path.resolve(".seo-local", "merchant-catalogue-audit")
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2))
  await fs.writeFile(path.join(directory, "merchant-preview.json"), JSON.stringify(preview, null, 2))
  const csvCell = value => {
    const text = String(value ?? "")
    return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`
  }
  const rows = [["Record ID", "Offer ID", "Formatted title", "Brand", "GTIN (text)", "Manufacturer MPN", "Model reference (NOT verified MPN)", "Description preview", "Image URL", "Selling price INR", "Stock", "Readiness issues", "Verified supplier/manufacturer source"]]
  for (const item of preview) rows.push([item.id, item.offerId, item.title, item.fields.brand, item.fields.gtin, item.fields.mpn,
    item.availableFacts.model, item.fields.description, item.fields.imageLink, item.price, item.stock, item.errors.join("; "), ""])
  await fs.writeFile(path.join(directory, "supplier-verification.csv"), "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n"))
  await fs.writeFile(path.join(directory, "catalogue-quality.json"), JSON.stringify(quality, null, 2))
  console.log(JSON.stringify(summary, null, 2))
} catch (error) {
  console.error(JSON.stringify({ error: "Read-only Merchant catalogue audit failed", stage, type: error?.name || "Error", code: typeof error?.code === "number" ? error.code : undefined }))
  process.exitCode = 1
} finally { await client.close() }
