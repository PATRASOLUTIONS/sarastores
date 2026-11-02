import { manufacturerImageSource, productImageUrls, isUsableImageUrl } from "@/lib/product-images"

type RecordData = Record<string, unknown>
const keyOf = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
export const qualityText = (value: unknown): string => {
  const text = typeof value === "string" || typeof value === "number" ? String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim() : ""
  return /^(?:n\/?a|not available|not applicable|null|undefined|-+)$/i.test(text) ? "" : text
}
function asRecord(value: unknown): RecordData {
  if (typeof value === "string" && /^[\[{]/.test(value.trim()) && value.length < 200000) {
    try { value = JSON.parse(value) } catch { return {} }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {}
}
export function catalogueItemNumber(product: RecordData): string {
  const sources = [product, asRecord(product.raw), asRecord(product.rawData), asRecord(product.source)]
  // The uploaded item number is authoritative, including when only the raw
  // import mirror retains it. Legacy SKU fields are a fallback, not a replacement.
  for (const aliases of [
    ["itemno", "itemNo", "item_no", "Item No.", "Item No", "ITEMNO", "ITEM NO", "_catalogueItemNo"],
    ["sku", "SKU", "Sku"],
  ]) for (const source of sources) {
    for (const alias of aliases) {
      const value = qualityText(source[alias]); if (value) return value
    }
  }
  return ""
}
const joinKey = (value: unknown) => qualityText(value).toLowerCase()
export function matchCatalogueSpecifications(products: RecordData[], specifications: RecordData[]) {
  const bySku = new Map<string, RecordData[]>()
  const byProduct = new Map<string, RecordData[]>()
  for (const spec of specifications) {
    const sku = joinKey(catalogueItemNumber(spec))
    const id = String(spec.product_id ?? spec.productId ?? "").trim()
    if (sku) bySku.set(sku, [...(bySku.get(sku) || []), spec])
    if (id) byProduct.set(id, [...(byProduct.get(id) || []), spec])
  }
  return products.map(product => {
    const id = String(product._id ?? product.id ?? "")
    const sku = joinKey(catalogueItemNumber(product))
    const matchingId = (byProduct.get(id) || []).filter(spec => !sku || !catalogueItemNumber(spec) || joinKey(catalogueItemNumber(spec)) === sku)
    const matchingSku = (bySku.get(sku) || []).filter(spec => !spec.product_id && !spec.productId || String(spec.product_id ?? spec.productId) === id)
    const candidates = [...new Set([...matchingId, ...matchingSku])]
    const timestamp = (spec: RecordData) => {
      const value = new Date(String(spec.updatedAt ?? "")).getTime(); return Number.isFinite(value) ? value : 0
    }
    candidates.sort((a, b) => timestamp(b) - timestamp(a) || String(a._id ?? a.id ?? "").localeCompare(String(b._id ?? b.id ?? "")))
    return { specification: candidates[0], conflictingLink: !candidates.length && (bySku.get(sku) || []).length > 0, matches: candidates.length }
  })
}

function sourcesOf(record: RecordData): { label: string; data: RecordData }[] {
  return [
    { label: "fields", data: record },
    ...["raw", "rawData", "source", "technical_details", "technicalDetails", "specifications", "additional_info", "additionalInfo", "data"].map(key => ({ label: key, data: Array.isArray(record[key]) ? { entries: record[key] } : asRecord(record[key]) })),
  ]
}
export function inspectCatalogueData(product: RecordData, specification?: RecordData) {
  const sources = [
    ...sourcesOf(product).map(source => ({ ...source, label: `Product ${source.label}` })),
    ...sourcesOf(specification || {}).map(source => ({ ...source, label: `Specification ${source.label}` })),
  ]
  const entries: { key: string; value: string; source: string }[] = []
  const collect = (data: unknown, source: string, depth = 0) => {
    if (depth > 4 || entries.length >= 2000) return
    if (Array.isArray(data)) {
      for (const row of data.slice(0, 200)) {
        const pair = asRecord(row)
        const name = qualityText(pair.name ?? pair.label ?? pair.key)
        const value = qualityText(pair.value ?? pair.text)
        if (name && value) entries.push({ key: keyOf(name), value, source })
        else collect(row, source, depth + 1)
      }
    } else for (const [key, value] of Object.entries(asRecord(data)).slice(0, 400)) {
      const text = qualityText(value)
      if (text) entries.push({ key: keyOf(key), value: text, source })
      else if (value && typeof value === "object") collect(value, `${source}.${key}`, depth + 1)
    }
  }
  for (const source of sources) collect(source.data, source.label)
  // Some manufacturer sections keep their specs in HTML tables rather than technical_details.
  for (const [index, record] of [product, specification || {}].entries()) {
    const markup = typeof record.from_manufacturer === "string" ? record.from_manufacturer.slice(0, 200000) : ""
    let rowCount = 0
    for (const row of markup.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      if (rowCount++ >= 200 || entries.length >= 2000) break
      const cells = [...row[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(cell => qualityText(cell[2]))
      if (cells.length >= 2 && cells[0] && cells[1]) entries.push({ key: keyOf(cells[0]), value: cells.slice(1).filter(Boolean).join(" / "), source: `${index ? "Specification" : "Product"} manufacturer table` })
    }
  }
  const find = (...aliases: string[]) => entries.find(entry => aliases.map(keyOf).includes(entry.key))
  const imagesFrom = (value: unknown, depth = 0): string[] => {
    if (depth > 4) return []
    if (Array.isArray(value)) return value.slice(0, 200).flatMap(item => imagesFrom(item, depth + 1))
    if (value && typeof value === "object") return Object.entries(value).filter(([key]) => /^(?:url|src|image|images|imageurl|imageurls|primary|front|rear|side|feature|lifestyle|dimensions|specificationimages)$/i.test(keyOf(key))).flatMap(([, item]) => imagesFrom(item, depth + 1))
    return productImageUrls(value)
  }
  const imageKeys = new Set(["image", "images", "imageurl", "imageurls", "specificationimages", "galleryimages", "gallery", "imageroles", "thumbnail"])
  const urls = sources.flatMap(source => Object.entries(source.data).filter(([key]) => imageKeys.has(keyOf(key))).flatMap(([, value]) => imagesFrom(value)))
  for (const record of [product, specification || {}]) {
    const manufacturer = manufacturerImageSource(asRecord(record.technical_details), [], record.from_manufacturer)
    urls.push(...manufacturer.images)
  }
  const images = [...new Set(urls)].filter(url => isUsableImageUrl(url) && !/placehold\.co/i.test(url))
  const productImages = productImageUrls([product.image, product.images]).filter(url => isUsableImageUrl(url) && !/placehold\.co/i.test(url))
  const contentKeys = new Set(["description", "overview", "frommanufacturer", "features", "bulletpoints"])
  const content = sources.flatMap(source => Object.entries(source.data).filter(([key]) => contentKeys.has(keyOf(key))).flatMap(([, value]) => Array.isArray(value) ? value.map(qualityText) : [qualityText(value)])).filter(Boolean).join(" ")
  const specificationFields = new Set(entries.filter(entry => /technical|specifications|additional|manufacturer table/i.test(entry.source)).map(entry => entry.key)).size
  return { find, images, productImages, content, specificationFields,
    model: find("modelNumber", "model_number", "Model Number", "Model Name", "Item model number", "Model"),
    gtin: find("gtin", "ean", "upc", "barcode", "EAN Number"), mpn: find("mpn", "Manufacturer Part Number", "partNumber", "part_number"),
    warranty: find("warrantyText", "warranty", "Warranty Description", "Warranty Details", "Manufacturer Warranty", "warranty_description"),
    warrantyMonths: find("warrantyMonths", "warranty_months"),
    hsn: find("hsnCode", "hsn_code", "HSN", "HSN Code"), gst: find("gstRate", "gst_rate", "GST", "GST Percentage", "GST Rate", "taxRate"),
  }
}

/** Fields read by the audit resolver, including legacy and specification-only content. */
export const CATALOGUE_DETAIL_PROJECTION = {
  raw: 1, rawData: 1, source: 1, itemno: 1, itemNo: 1, item_no: 1, "Item No": 1, ITEMNO: 1, "ITEM NO": 1, sku: 1, SKU: 1,
  // A literal spreadsheet header ending in '.' is not a valid MongoDB FieldPath.
  _catalogueItemNo: { $getField: { field: { $literal: "Item No." }, input: "$$ROOT" } },
  product_id: 1, productId: 1, updatedAt: 1, name: 1, mrp: 1, overview: 1, description: 1, from_manufacturer: 1, features: 1, bullet_points: 1,
  brand: 1, Brand: 1, manufacturer: 1, manufacturerName: 1, manufacturer_name: 1, "Manufacturer Name": 1,
  technical_details: 1, technicalDetails: 1, specifications: 1, additional_info: 1, additionalInfo: 1,
  image: 1, images: 1, specification_images: 1, gallery_images: 1, imageUrls: 1, image_roles: 1, imageRoles: 1, data: 1,
  modelNumber: 1, model_number: 1, "Model Number": 1, "Item model number": 1, model: 1, Model: 1,
  gtin: 1, GTIN: 1, ean: 1, EAN: 1, upc: 1, UPC: 1, barcode: 1, "EAN Number": 1, mpn: 1, MPN: 1, partNumber: 1, part_number: 1,
  warranty: 1, Warranty: 1, warrantyText: 1, warranty_description: 1, warrantyMonths: 1, warranty_months: 1,
  hsnCode: 1, hsn_code: 1, hsn: 1, HSN: 1, "HSN Code": 1, gstRate: 1, gst_rate: 1, GST: 1, gst: 1, taxRate: 1,
} as const

/** Read only specifications belonging to the current product page, including legacy identity aliases. */
export function catalogueSpecificationQuery(products: RecordData[]) {
  const ids = products.map(product => String(product._id ?? product.id ?? ""))
  const itemNumbers = products.map(product => catalogueItemNumber(product).toLowerCase()).filter(Boolean)
  const aliases = ["itemno", "itemNo", "item_no", "Item No.", "Item No", "ITEMNO", "ITEM NO", "sku", "SKU", "Sku"]
  const stringValue = (input: unknown) => ({ $convert: { input, to: "string", onError: "", onNull: "" } })
  const keys = ["$$ROOT", "$raw", "$rawData", "$source"].flatMap(source => aliases.map(alias => ({
    $toLower: { $trim: { input: stringValue({ $getField: {
      field: { $literal: alias },
      input: { $cond: [{ $eq: [{ $type: source }, "object"] }, source, {}] },
    } }) } },
  })))
  return { $expr: { $or: [
    ...["$product_id", "$productId"].map(field => ({ $in: [stringValue(field), ids] })),
    { $anyElementTrue: [{ $map: { input: keys, as: "key", in: { $in: ["$key", itemNumbers] } } }] },
  ] } }
}
