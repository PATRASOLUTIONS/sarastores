import { createHash } from 'node:crypto'
import { ObjectId, type ClientSession, type Document, type Filter } from 'mongodb'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { CreateProductSchema, priceSchema, urlSchema } from '@/lib/validation'
import { CATALOGUE_DETAIL_PROJECTION, catalogueItemNumber, catalogueSpecificationQuery, inspectCatalogueData, matchCatalogueSpecifications, qualityText } from '@/lib/catalogue-quality-data'
import { metadataDocumentUpdates, metadataSheetRowFromProduct } from '@/lib/product-metadata-sheet'
import { formatProductName } from '@/lib/product-name-format'
import { getCatalogMRP } from '@/lib/product-display'
import { validGtin } from '@/lib/catalogue-quality'
import { isUsableImageUrl } from '@/lib/product-images'
import { getCollection } from '@/lib/db-service'
import { connectToDatabase } from '@/lib/mongodb'
import { QUALITY_IMPORT_COLUMNS, QUALITY_IMPORT_MAX_BYTES, QUALITY_IMPORT_MAX_ROWS, type QualityImportColumn, type QualityImportRow, type QualityImportPreview } from '@/lib/catalogue-quality-sheet'

export class QualityImportError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const aliases: Record<string, QualityImportColumn> = Object.fromEntries(QUALITY_IMPORT_COLUMNS.map(column => [key(column), column]))
for (const [alias, column] of Object.entries({
  id: 'product id', _id: 'product id', sku: 'itemno', 'item number': 'itemno', 'product name': 'name',
  'item description': 'name', 'product description': 'description', 'brand name': 'brand',
  characteristics: 'char desc', 'category/group name': 'division', 'group name': 'division',
  'sub-category/prod desc': 'category', 'prod desc': 'category', manufacturer: 'manufacturer name',
  ean: 'gtin', 'ean number': 'gtin', upc: 'gtin', barcode: 'gtin', model: 'model number',
  hsn: 'hsn code', gst: 'gst rate', 'tax rate': 'gst rate', warrantyText: 'warranty',
  image: 'images', 'image urls': 'images', 'meta title': 'seo title', 'meta description': 'seo description',
})) aliases[key(alias)] = column as QualityImportColumn

export function readQualityImport(bytes: Buffer): QualityImportRow[] {
  if (bytes.length > QUALITY_IMPORT_MAX_BYTES) throw new QualityImportError('Excel file must be 3 MB or smaller', 413)
  let workbook: XLSX.WorkBook
  try { workbook = XLSX.read(bytes, { type: 'buffer', sheetRows: QUALITY_IMPORT_MAX_ROWS + 2, cellFormula: true }) }
  catch { throw new QualityImportError('Could not read this Excel file. Upload a valid .xlsx or .xls workbook.') }
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet?.['!ref']) throw new QualityImportError('The first worksheet is empty')
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'])
  if (range.e.c > 50 || range.e.r - range.s.r > QUALITY_IMPORT_MAX_ROWS) throw new QualityImportError('Use at most 500 rows and 51 columns in the first worksheet', 413)
  for (const [address, cell] of Object.entries(sheet)) {
    if (!address.startsWith('!') && cell.f) throw new QualityImportError(`Cell ${address}: formulas are not supported. Paste values instead.`)
  }
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true })
  const headers = grid[0] || []
  const fields = headers.map(header => header.trim() && Object.hasOwn(aliases, key(header)) ? aliases[key(header)] : undefined)
  for (let index = 0; index < headers.length; index++) {
    if (headers[index].trim() && !fields[index]) throw new QualityImportError(`Unsupported column: ${headers[index]}. Use the missing-data template.`)
    if (fields[index] && fields.indexOf(fields[index]) !== index) throw new QualityImportError(`Repeated column: ${headers[index]}`)
  }
  if (!fields.includes('itemno') && !fields.includes('product id')) throw new QualityImportError('Include itemno or product id to match existing products')
  const rows: QualityImportRow[] = []
  let totalCharacters = 0
  for (let index = 1; index < grid.length; index++) {
    if (!grid[index].some(value => String(value).trim())) continue
    const values: QualityImportRow['values'] = {}
    for (let column = 0; column < grid[index].length; column++) {
      const value = String(grid[index][column] ?? '').trim()
      if (!value) continue
      const field = fields[column]
      if (!field) throw new QualityImportError(`Row ${index + range.s.r + 1}: a value has no column heading`)
      totalCharacters += value.length
      if (value.length > 32767 || totalCharacters > 2_000_000) throw new QualityImportError('Worksheet values exceed the import size limit', 413)
      values[field] = value
    }
    rows.push({ row: index + range.s.r + 1, values })
  }
  if (!rows.length || rows.length > QUALITY_IMPORT_MAX_ROWS) throw new QualityImportError('Include between 1 and 500 product rows')
  return rows
}

const shortText = z.string().trim().min(1).max(200)
const numeric = (value: string) => Number(value.replace(/[₹,%\s]/g, ''))
function validated(field: QualityImportColumn, value: string): string | number | string[] {
  if (!qualityText(value)) throw new QualityImportError(`${field}: supply a real value or leave the cell blank`)
  let schema: z.ZodTypeAny = shortText
  let input: unknown = value
  if (field === 'itemno') schema = CreateProductSchema.shape.sku
  else if (field === 'product id') schema = z.string().trim().min(1).max(100)
  else if (field === 'name') schema = CreateProductSchema.shape.name
  else if (field === 'description') schema = CreateProductSchema.shape.description
  else if (field === 'brand') schema = z.string().min(1).max(100)
  else if (field === 'seo title') schema = z.string().min(1).max(70)
  else if (field === 'seo description') schema = z.string().min(1).max(160)
  else if (field === 'warranty') schema = z.string().min(1).max(2000)
  else if (field === 'gtin') schema = z.string().refine(validGtin, 'Use a genuine GTIN with a valid length and checksum; format the cell as Text')
  else if (field === 'hsn code') schema = z.string().regex(/^\d{4}(?:\d{2})?(?:\d{2})?$/, 'HSN must contain 4, 6 or 8 digits')
  else if (['price', 'mrp', 'stock', 'gst rate', 'warranty months'].includes(field)) {
    input = numeric(value)
    schema = field === 'stock' ? z.number().int().nonnegative().max(1_000_000)
      : field === 'gst rate' ? z.number().finite().min(0).max(100)
      : field === 'warranty months' ? z.number().int().min(0).max(1200) : priceSchema
  } else if (field === 'images') {
    input = value.split(/[;\n]|\s*\|\s*/).map(url => url.trim()).filter(Boolean)
    schema = z.array(z.union([
      urlSchema.refine(url => url.startsWith('https://'), 'Image URLs must use HTTPS'),
      z.string().max(2048).regex(/^\/(?!\/)[^\s<>]+$/, 'Use a same-site image path or HTTPS URL'),
    ]).refine(isUsableImageUrl, 'Placeholder images are not supported')).min(1).max(10)
  }
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new QualityImportError(`${field}: ${parsed.error.issues[0].message}`)
  return field === 'name' ? formatProductName(parsed.data) : parsed.data
}
const itemAliases = ['itemno', 'itemNo', 'item_no', 'Item No.', 'Item No', 'ITEMNO', 'ITEM NO', 'sku', 'SKU', 'Sku']
function productQuery(rows: QualityImportRow[]): Filter<Document> {
  const ids = rows.map(row => row.values['product id']).filter((id): id is string => Boolean(id))
  const itemnos = rows.map(row => row.values.itemno).filter((id): id is string => Boolean(id))
  const patterns = [...new Set(itemnos)].map(value => new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'))
  const stringValue = (input: unknown) => ({ $convert: { input, to: 'string', onError: '', onNull: '' } })
  const literalKeys = ['$$ROOT', '$raw', '$rawData', '$source'].flatMap(source => itemAliases.map(alias => ({
    $toLower: { $trim: { input: stringValue({ $getField: {
      field: { $literal: alias }, input: { $cond: [{ $eq: [{ $type: source }, 'object'] }, source, {}] },
    } }) } },
  })))
  return { $or: [
    { _id: { $in: ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } },
    { $expr: { $in: [stringValue('$_id'), ids] } },
    // $getField in the reviewed join query also handles literal 'Item No.' keys.
    ...itemAliases.filter(alias => !alias.includes('.')).flatMap(alias => [alias, `raw.${alias}`, `rawData.${alias}`, `source.${alias}`]).map(field => ({ [field]: { $in: patterns } })),
    { $expr: { $anyElementTrue: [{ $map: { input: literalKeys, as: 'key', in: { $in: ['$$key', itemnos.map(value => value.toLowerCase())] } } }] } },
  ] }
}
type Plan = { product: Document; set: Record<string, unknown>; preview: QualityImportPreview['rows'][number] }
const display = (value: unknown) => Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value)
const plainRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const actualMrp = (product: Document = {}) => getCatalogMRP(product)
  || getCatalogMRP({ raw: plainRecord(product.rawData) }) || getCatalogMRP({ raw: plainRecord(product.source) })
function effectiveMetadata(product: Document) {
  return metadataSheetRowFromProduct({ ...product, raw: product.raw || product.rawData })
}

export function planQualityImport(rows: QualityImportRow[], products: Document[], specifications: Document[] = []): Plan[] {
  const joins = matchCatalogueSpecifications(products, specifications)
  const usedProducts = new Set<string>(), usedItems = new Set<string>()
  return rows.map(row => {
    const preview: QualityImportPreview['rows'][number] = { row: row.row, productId: '', itemno: row.values.itemno || '', name: '', changes: [], preserved: [], error: '' }
    const plan: Plan = { product: {}, set: {}, preview }
    try {
      const input = { ...row.values }
      // Identity is validated first; values on populated fields are preserved,
      // including legacy values prefilled by the catalogue download.
      for (const field of ['itemno', 'product id'] as const) if (input[field]) validated(field, input[field]!)
      const itemno = String(input.itemno || ''), id = String(input['product id'] || '')
      if (!id && !itemno) throw new QualityImportError('Include itemno or product id')
      if (itemno && usedItems.has(itemno.toLowerCase())) throw new QualityImportError('Duplicate itemno in this workbook')
      if (itemno) usedItems.add(itemno.toLowerCase())
      const candidates = products.filter(product => id ? String(product._id) === id : catalogueItemNumber(product).toLowerCase() === itemno.toLowerCase())
      if (candidates.length !== 1) throw new QualityImportError(candidates.length ? 'Ambiguous product match; resolve duplicate item numbers first' : 'Existing product not found; this upload does not create products')
      const product = candidates[0], productId = String(product._id), existingItem = catalogueItemNumber(product)
      if (usedProducts.has(productId)) throw new QualityImportError('This product appears more than once in the workbook')
      usedProducts.add(productId)
      if (id && itemno && existingItem && existingItem.toLowerCase() !== itemno.toLowerCase()) throw new QualityImportError('Product id and itemno refer to different identities')
      if (itemno && products.some(other => String(other._id) !== productId && catalogueItemNumber(other).toLowerCase() === itemno.toLowerCase())) throw new QualityImportError('Item number belongs to multiple products')
      const spec = joins[products.indexOf(product)]?.specification
      const data = inspectCatalogueData(product, spec)
      const metadata = effectiveMetadata(product)
      if (!metadata.brand) metadata.brand = data.find('Brand', 'Manufacturer Name', 'manufacturerName', 'manufacturer_name', 'manufacturer')?.value || ''
      const roots = [product, plainRecord(product.raw), plainRecord(product.rawData), plainRecord(product.source)]
      const current = (...names: string[]) => roots.flatMap(source => names.map(name => Array.isArray(source[name])
        ? (source[name] as unknown[]).map(qualityText).filter(Boolean).join('; ') : qualityText(source[name]))).find(Boolean) || ''
      const set: Record<string, unknown> = {}
      let taxonomy = false
      for (const [column, supplied] of Object.entries(input)) {
        const field = column as QualityImportColumn
        if (field === 'product id') continue
        let before: unknown = ''
        let target = column
        if (field === 'itemno') before = existingItem
        else if (['name', 'division', 'category', 'segment', 'brand'].includes(field)) {
          before = metadata[field as 'name' | 'division' | 'category' | 'segment' | 'brand']
        } else if (field === 'description') before = data.content
        else if (field === 'model number') { target = 'modelNumber'; before = data.model?.value }
        else if (field === 'gtin') before = data.gtin?.value
        else if (field === 'mpn') before = data.mpn?.value
        else if (field === 'hsn code') { target = 'hsnCode'; before = data.hsn?.value }
        else if (field === 'gst rate') { target = 'gstRate'; before = data.gst?.value }
        else if (field === 'warranty') { target = 'warrantyText'; before = data.warranty?.value || data.warrantyMonths?.value }
        else if (field === 'warranty months') { target = 'warrantyMonths'; before = data.warrantyMonths?.value || data.warranty?.value }
        else if (field === 'images') before = data.images.length ? data.images : ''
        else if (field === 'char desc') { target = 'characteristics'; before = current('characteristics', 'char_desc', 'CHAR DESC', 'CHARDESC') }
        else if (field === 'sub category') { target = 'subCategory'; before = current('subCategory', 'prod_desc', 'sub-category/PROD DESC', 'PROD DESC') }
        else if (field === 'manufacturer name') { target = 'manufacturerName'; before = current('manufacturerName', 'manufacturer_name', 'manufacturer', 'Manufacturer Name') }
        else if (field === 'seo title') { target = 'seoTitle'; before = current('seoTitle', 'seo_title', 'metaTitle', 'meta_title') }
        else if (field === 'seo description') { target = 'seoDescription'; before = current('seoDescription', 'seo_description', 'metaDescription', 'meta_description') }
        else if (field === 'mrp') before = actualMrp(product) || actualMrp(spec) || ''
        else if (field === 'price') before = Number(product.price) > 0 ? product.price : ''
        else if (field === 'stock') before = product.stock != null && product.stock !== '' && Number.isInteger(Number(product.stock)) && Number(product.stock) >= 0 ? product.stock : ''
        if (display(before).trim()) { preview.preserved.push(field); continue }
        const value = validated(field, supplied!)
        preview.changes.push({ field, before: display(before), after: display(value) })
        if (['name', 'division', 'category', 'segment', 'brand'].includes(field)) {
          Object.assign(metadata, { [field]: value })
          taxonomy ||= field !== 'name'
          if (field === 'name') Object.assign(set, metadataDocumentUpdates({ itemno: '', name: String(value), division: '', category: '', segment: '', brand: '' }))
        } else {
          set[target] = value
          if (field === 'itemno' && !qualityText(product.sku)) set.sku = value
          if (field === 'images') set.image = (value as string[])[0]
        }
      }
      // Keep the existing semantic hierarchy when a legacy warehouse row becomes classified.
      // Never alter its raw import mirror; use the same mapping as the metadata importer.
      if (taxonomy) {
        const normalized = metadataDocumentUpdates({ ...metadata, name: '' })
        // A legacy 'category' can hold the division. Move that value into division
        // instead of leaving it to masquerade as the category after classification.
        if (product.taxonomySource !== 'metadata-sheet' && !qualityText(product.division) && !qualityText(plainRecord(product.raw).Division) && !metadata.category) {
          normalized.category = ''; normalized.groupName = ''
        }
        for (const [field, value] of Object.entries(normalized)) {
          if (field === 'taxonomySource' || display(product[field]) === value) continue
          if (!preview.changes.some(change => change.field === field) || display(product[field])) preview.changes.push({ field: `${field} (classification mapping)`, before: display(product[field]), after: value })
        }
        Object.assign(set, normalized)
      }
      const nextPrice = Number(set.price ?? product.price), nextMrp = Number(set.mrp ?? (actualMrp(product) || actualMrp(spec)))
      if (('price' in set || 'mrp' in set) && nextMrp > 0 && nextPrice > nextMrp) throw new QualityImportError('Selling price would exceed MRP')
      plan.product = product; plan.set = set
      preview.productId = productId; preview.itemno = itemno || existingItem; preview.name = metadata.name || '(missing name)'
    } catch (error) {
      preview.error = error instanceof QualityImportError ? error.message : 'Invalid row'
      preview.changes = []; plan.set = {}
    }
    return plan
  })
}
/** Existing facts for the editable workbook, with genuine gaps kept blank. */
export function qualityImportExportValues(product: Document, specification?: Document): Record<QualityImportColumn, string | number> {
  const metadata = effectiveMetadata(product), data = inspectCatalogueData(product, specification)
  const roots = [product, plainRecord(product.raw), plainRecord(product.rawData), plainRecord(product.source)]
  const current = (...names: string[]) => roots.flatMap(source => names.map(name => Array.isArray(source[name])
    ? (source[name] as unknown[]).map(qualityText).filter(Boolean).join('; ') : qualityText(source[name]))).find(Boolean) || ''
  const validStock = product.stock != null && product.stock !== '' && Number.isInteger(Number(product.stock)) && Number(product.stock) >= 0
  return {
    'product id': String(product._id ?? product.id ?? ''), itemno: catalogueItemNumber(product), name: metadata.name,
    division: metadata.division, category: metadata.category, segment: metadata.segment,
    brand: metadata.brand || data.find('Brand', 'Manufacturer Name', 'manufacturerName', 'manufacturer_name', 'manufacturer')?.value || '',
    description: qualityText(product.description) || data.content,
    'char desc': current('characteristics', 'char_desc', 'CHAR DESC', 'CHARDESC'),
    'sub category': current('subCategory', 'prod_desc', 'sub-category/PROD DESC', 'PROD DESC'),
    'manufacturer name': current('manufacturerName', 'manufacturer_name', 'manufacturer', 'Manufacturer Name'),
    'model number': data.model?.value || '', gtin: data.gtin?.value || '', mpn: data.mpn?.value || '',
    'hsn code': data.hsn?.value || '', 'gst rate': data.gst?.value || '',
    warranty: data.warranty?.value || '', 'warranty months': data.warrantyMonths?.value || '',
    images: data.images.join('; '),
    'seo title': current('seoTitle', 'seo_title', 'metaTitle', 'meta_title'),
    'seo description': current('seoDescription', 'seo_description', 'metaDescription', 'meta_description'),
    price: Number(product.price) > 0 ? Number(product.price) : '',
    mrp: actualMrp(product) || actualMrp(specification) || '', stock: validStock ? Number(product.stock) : '',
  }
}
function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (value instanceof ObjectId) return value.toHexString()
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, entry]) => [name, stable(entry)]))
  return value
}
export function qualityImportPreview(plans: Plan[]): QualityImportPreview {
  const rows = plans.map(plan => plan.preview)
  const errors = rows.filter(row => row.error).length
  const products = plans.filter(plan => Object.keys(plan.set).length).length
  return { rows, digest: createHash('sha256').update(JSON.stringify(stable(plans))).digest('hex'), canApply: !errors && products > 0,
    summary: { rows: rows.length, products, fields: rows.reduce((total, row) => total + row.changes.length, 0), errors } }
}
export const QUALITY_IMPORT_PROJECTION = { ...CATALOGUE_DETAIL_PROJECTION, Sku: 1, taxonomySource: 1, division: 1, category: 1, groupName: 1,
    segment: 1, subCategory: 1, prod_desc: 1, characteristics: 1, char_desc: 1, price: 1, stock: 1, originalPrice: 1,
    seoTitle: 1, seo_title: 1, metaTitle: 1, meta_title: 1, seoDescription: 1, seo_description: 1, metaDescription: 1, meta_description: 1 }
async function readPlans(rows: QualityImportRow[], session?: ClientSession) {
  const products = await (await getCollection('products')).find(productQuery(rows), { session, projection: QUALITY_IMPORT_PROJECTION, maxTimeMS: 15000 }).limit(2001).toArray()
  if (products.length > 2000) throw new QualityImportError('Too many product matches; resolve duplicate item numbers first', 413)
  const specs = products.length ? await (await getCollection('product_specifications')).find(catalogueSpecificationQuery(products), { session, projection: CATALOGUE_DETAIL_PROJECTION, maxTimeMS: 15000 }).limit(2001).toArray() : []
  if (specs.length > 2000) throw new QualityImportError('Too many matching specifications; reduce the upload size', 413)
  return planQualityImport(rows, products, specs)
}
export async function previewQualityImport(rows: QualityImportRow[]) { return qualityImportPreview(await readPlans(rows)) }
export async function applyQualityImport(rows: QualityImportRow[], digest: string) {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new QualityImportError('Preview this upload before saving', 409)
  const { client } = await connectToDatabase()
  const session = client.startSession()
  try {
    return await session.withTransaction(async () => {
      const plans = await readPlans(rows, session), preview = qualityImportPreview(plans)
      if (!preview.canApply || preview.digest !== digest) throw new QualityImportError('The file or catalogue changed. Preview again before saving. No changes were saved.', 409)
      const operations = plans.filter(plan => Object.keys(plan.set).length).map(plan => ({ updateOne: {
        filter: { _id: plan.product._id }, update: { $set: { ...plan.set, updatedAt: new Date() } }, upsert: false,
      } }))
      const saved = await (await getCollection('products')).bulkWrite(operations, { session, ordered: true })
      if (saved.matchedCount !== operations.length) throw new QualityImportError('A product changed during saving. Preview again. No changes were saved.', 409)
      return { saved: saved.matchedCount, fields: preview.summary.fields }
    })
  } finally { await session.endSession() }
}
