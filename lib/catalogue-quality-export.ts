import * as XLSX from 'xlsx'
import type { Document, Filter } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import { CATALOGUE_DETAIL_PROJECTION, catalogueSpecificationQuery, matchCatalogueSpecifications } from '@/lib/catalogue-quality-data'
import { QUALITY_IMPORT_COLUMNS } from '@/lib/catalogue-quality-sheet'
import { QUALITY_IMPORT_PROJECTION, QualityImportError, qualityImportExportValues } from '@/lib/catalogue-quality-import'

/** Read the current catalogue in bounded pages; never download a silent partial list. */
export async function exportQualityWorkbook(ids?: string[]) {
  if (ids && !ids.length) throw new QualityImportError('No products match the selected filters')
  const collection = await getCollection('products')
  const query: Filter<Document> = ids ? { $expr: { $in: [
    { $convert: { input: '$_id', to: 'string', onError: '', onNull: '' } }, { $literal: ids },
  ] } } : {}
  const total = await collection.countDocuments(query, { maxTimeMS: 15000 })
  if (!total) throw new QualityImportError('There are no catalogue products to download')
  if (total > 20000) throw new QualityImportError('Filter the catalogue to 20,000 or fewer products before downloading', 413)
  if (ids && total !== new Set(ids).size) throw new QualityImportError('The catalogue changed. Rescan before downloading.', 409)
  const grid: (string | number)[][] = [[...QUALITY_IMPORT_COLUMNS]]
  const seen = new Set<string>()
  for (let offset = 0; offset < total; offset += 100) {
    const products = await collection.find(query, { projection: QUALITY_IMPORT_PROJECTION, maxTimeMS: 15000 }).sort({ _id: 1 }).skip(offset).limit(100).toArray()
    if (products.length !== Math.min(100, total - offset)) throw new QualityImportError('The catalogue changed during download. Please try again.', 409)
    const specs = await (await getCollection('product_specifications')).find(catalogueSpecificationQuery(products), { projection: CATALOGUE_DETAIL_PROJECTION, maxTimeMS: 15000 }).limit(2001).toArray()
    if (specs.length > 2000) throw new QualityImportError('Too many matching specifications; filter the catalogue before downloading', 413)
    const joins = matchCatalogueSpecifications(products, specs)
    products.forEach((product, index) => {
      const id = String(product._id)
      if (seen.has(id)) throw new QualityImportError('The catalogue changed during download. Please try again.', 409)
      seen.add(id)
      const values = qualityImportExportValues(product, joins[index].specification)
      grid.push(QUALITY_IMPORT_COLUMNS.map(column => {
        const value = values[column]
        if (typeof value === 'string' && value.length > 32767) throw new QualityImportError(`Product ${values.itemno || id}: ${column} is too long for an Excel cell. Exclude this product before downloading.`, 413)
        return value
      }))
    })
  }
  if (await collection.countDocuments(query, { maxTimeMS: 15000 }) !== total) throw new QualityImportError('The catalogue changed during download. Please try again.', 409)
  const workbook = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet(grid)
  sheet['!cols'] = QUALITY_IMPORT_COLUMNS.map(column => ({ wch: ['description', 'images'].includes(column) ? 45 : 24 }))
  XLSX.utils.book_append_sheet(workbook, sheet, 'Missing data')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['How to use this workbook'],
    [`${total} existing products are included with their current itemno, name and other available data.`],
    ['Fill verified missing values. Existing populated fields are preserved during upload.'],
    ['Remove rows you are not correcting before uploading. Upload at most 500 rows / 3 MB at a time.'],
    ['Keep product id and itemno unchanged. If itemno is absent, supply the verified item number using the product id.'],
    ['itemno, gtin and hsn code are Text cells to preserve leading zeroes. Paste values, not formulas.'],
    ['Missing or nonpositive prices and absent actual MRP are blank. Genuine zero stock and tax values are retained.'],
    ['images: semicolon-separated image URLs. No guessed prices, stock, barcodes or warranty terms are added.'],
    ['Upload the edited workbook, preview changes and approve saving.'],
  ]), 'Instructions')
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer
  if (bytes.length > 4 * 1024 * 1024) throw new QualityImportError('The Excel download exceeds 4 MB. Filter the catalogue to fewer products and download again.', 413)
  return { bytes, total }
}
