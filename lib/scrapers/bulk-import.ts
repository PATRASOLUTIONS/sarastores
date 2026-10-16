import { z } from "zod"

export const MAX_SCRAPER_IMPORT_BYTES = 3 * 1024 * 1024
export const MAX_SCRAPER_IMPORT_ROWS = 500
export const SCRAPER_TEMPLATE = [{
  itemno: "REFSAM1187",
  name: "Example refrigerator",
  category: "Refrigerators",
  "sub category": "Double Door",
  "char desc": "Example model",
  brand: "Samsung",
  "product link": "https://www.amazon.in/dp/B000000000",
}]

const requiredText = z.string().trim().min(1).max(500)
export const ScraperImportRowSchema = z.object({
  itemno: requiredText,
  name: requiredText,
  category: requiredText,
  subCategory: requiredText,
  charDesc: z.string().trim().max(2000),
  brand: requiredText,
  url: z.string().trim().url().max(4096),
})
export type ScraperImportRow = z.infer<typeof ScraperImportRowSchema>

const COLUMN_FIELDS: Record<string, keyof ScraperImportRow> = {
  itemno: "itemno", itemnumber: "itemno", sku: "itemno",
  name: "name", category: "category", subcategory: "subCategory",
  chardesc: "charDesc", brand: "brand", productlink: "url", url: "url",
}
const normalizeColumn = (column: string) => column.toLowerCase().replace(/[\s_-]/g, "")

export function scraperColumnField(column: string): keyof ScraperImportRow | undefined {
  const key = normalizeColumn(column)
  return Object.hasOwn(COLUMN_FIELDS, key) ? COLUMN_FIELDS[key] : undefined
}

export interface ScraperImportIssue {
  row: number
  field: keyof ScraperImportRow
  column?: string
  message: string
}

export function validateScraperRows(
  data: Record<string, unknown>[],
  supportedUrl?: (url: string) => boolean,
  rowNumbers?: number[],
): { rows: ScraperImportRow[]; issues: ScraperImportIssue[]; error?: string } {
  if (!data.length || data.length > MAX_SCRAPER_IMPORT_ROWS) {
    return { rows: [], issues: [], error: `Provide between 1 and ${MAX_SCRAPER_IMPORT_ROWS} rows` }
  }
  const seen = new Set<string>()
  const rows: ScraperImportRow[] = []
  const issues: ScraperImportIssue[] = []
  data.forEach((row, index) => {
    const rowNumber = rowNumbers?.[index] ?? index + 2
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [
      normalizeColumn(key),
      value == null ? "" : String(value).trim(),
    ]))
    const sourceColumns = Object.fromEntries(Object.keys(row).map(column => [normalizeColumn(column), column]))
    const addIssue = (field: keyof ScraperImportRow, message: string) => {
      const aliases = Object.keys(COLUMN_FIELDS).filter(key => COLUMN_FIELDS[key] === field)
      const alias = aliases.find(key => fields[key]) ?? aliases.find(key => sourceColumns[key] !== undefined)
      issues.push({ row: rowNumber, field, column: alias ? sourceColumns[alias] : undefined, message })
    }
    const candidate = {
      itemno: fields.itemno || fields.itemnumber || fields.sku,
      name: fields.name,
      category: fields.category,
      subCategory: fields.subcategory,
      charDesc: fields.chardesc ?? "",
      brand: fields.brand,
      url: fields.productlink || fields.url,
    }
    const result = ScraperImportRowSchema.safeParse(candidate)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = ScraperImportRowSchema.keyof().safeParse(issue.path[0])
        if (field.success) addIssue(field.data, issue.message)
      }
    } else {
      rows.push(result.data)
    }
    if (candidate.itemno) {
      const key = candidate.itemno.toLowerCase()
      if (seen.has(key)) addIssue("itemno", `duplicate itemno ${candidate.itemno}`)
      seen.add(key)
    }
    if (supportedUrl && ScraperImportRowSchema.shape.url.safeParse(candidate.url).success && !supportedUrl(candidate.url)) {
      addIssue("url", `Unsupported product link: ${candidate.url}`)
    }
  })
  return { rows, issues }
}

export function parseScraperRows(data: Record<string, unknown>[]): ScraperImportRow[] {
  const result = validateScraperRows(data)
  if (result.error) throw new Error(result.error)
  const issue = result.issues[0]
  if (issue) throw new Error(`Row ${issue.row}: ${issue.field} - ${issue.message}`)
  return result.rows
}

const text = z.string().max(200000)
const images = z.array(z.string().url().max(4096).refine(value => /^https?:\/\//i.test(value), "Use HTTP(S) image URLs")).max(200)
const money = z.number().finite().min(0).max(10000000).nullable()
export const ScrapedProductSchema = z.object({
  source: z.enum(["amazon", "flipkart", "pai", "lg", "reliance", "vijaysales", "bosch", "pdf"]),
  sourceUrl: z.string().max(4096),
  externalId: z.string().max(500).nullable(),
  sap: z.object({
    sku: z.string().max(500), name: text, category: text, subCategory: text,
    brand: text, charDesc: text, price: money,
  }),
  mrp: money,
  description: text,
  images,
  features: z.array(text).max(500),
  technicalDetails: z.record(z.string().max(500), z.string().max(10000)).refine(value => Object.keys(value).length <= 500),
  manufacturerInfo: text,
  manufacturerImages: images,
  whatsIncluded: z.array(text).max(500),
  warranty: text,
  rating: z.number().finite().nullable(),
  reviewCount: z.number().finite().nullable(),
  inStock: z.boolean(),
  reviews: z.array(z.object({ rating: z.number().finite().nullable(), title: text, text })).max(500),
})
