/** Shared labels and response types; no database or Excel parser in the client bundle. */
export const QUALITY_IMPORT_MAX_ROWS = 500
export const QUALITY_IMPORT_MAX_BYTES = 3 * 1024 * 1024
export const QUALITY_IMPORT_COLUMNS = [
  'product id', 'itemno', 'name', 'division', 'category', 'segment', 'brand',
  'description', 'char desc', 'sub category', 'manufacturer name', 'model number',
  'gtin', 'mpn', 'hsn code', 'gst rate', 'warranty', 'warranty months',
  'images', 'seo title', 'seo description', 'price', 'mrp', 'stock',
] as const
export type QualityImportColumn = typeof QUALITY_IMPORT_COLUMNS[number]
export type QualityImportRow = { row: number; values: Partial<Record<QualityImportColumn, string>> }
export type QualityImportPreviewRow = {
  row: number; productId: string; itemno: string; name: string
  changes: { field: string; before: string; after: string }[]
  preserved: string[]; error: string
}
export type QualityImportPreview = {
  rows: QualityImportPreviewRow[]; digest: string; canApply: boolean
  summary: { rows: number; products: number; fields: number; errors: number }
}
