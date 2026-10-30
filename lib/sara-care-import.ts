import * as XLSX from "xlsx"
import { SaraCareYearsSchema, SaraCareMasterPlanSchema, normalizeCareItemno, type SaraCareMasterPlan, type SaraCareMasterRow } from "@/lib/sara-care-types"

export const SARA_CARE_HEADERS = ["T ITEM CODES", "6 Months", "T CODE 6Months", "1 YEAR", "T CODE 1YEAR", "2 YEAR", "T CODE 2 YEAR", "3 YEAR VALUE", "T CODE 3YEAR"]
export class SaraCareImportError extends Error {}
const normalized = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
function duration(header: string) {
  const match = header.match(/(\d+)\s*(MONTHS?|YEARS?)/i)
  if (!match) return null
  const years = Number(match[1]) / (/MONTH/i.test(match[2]) ? 12 : 1)
  return SaraCareYearsSchema.safeParse(years).success ? years : null
}
const blank = (value: unknown) => value === undefined || value === null || String(value).trim() === "" || String(value).trim() === "-"
const amount = (value: unknown) => Number(String(value ?? "").replace(/[,₹%\s]/g, ""))

/** Only worksheet 1 is a product master. Never read the damage-protection or code-legend sheets. */
export function parseSaraCareWorkbook(data: Uint8Array, mode: "percentage" | "value") {
  let workbook: XLSX.WorkBook
  try { workbook = XLSX.read(data, { type: "array", cellNF: true, sheets: [0], sheetRows: 50002 }) }
  catch { throw new SaraCareImportError("The Excel file could not be read.") }
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new SaraCareImportError("Worksheet 1 is empty.")
  const actualRange = sheet["!fullref"] || sheet["!ref"]
  if (actualRange && XLSX.utils.decode_range(actualRange).e.r > 50000) throw new SaraCareImportError("Upload at most 50,000 product rows.")
  if (actualRange && XLSX.utils.decode_range(actualRange).e.c > 255) throw new SaraCareImportError("Upload at most 256 columns.")
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true })
  const header = rows[0] || []
  const itemColumn = header.findIndex(value => ["TITEMCODES", "ITEMNO", "ITEMNUMBER"].includes(normalized(value)))
  if (itemColumn < 0) throw new SaraCareImportError("Worksheet 1 must start with a T ITEM CODES column.")
  const nameColumn = header.findIndex(value => normalized(value) === "ITEMDESCRIPTION")
  const columns = header.flatMap((value, index) => {
    const text = normalized(value)
    const years = duration(text)
    if (years === null || !text.startsWith("TCODE")) return []
    const candidates = header.flatMap((heading, column) => duration(normalized(heading)) === years && !normalized(heading).startsWith("TCODE") ? [column] : [])
    // In the example, the first 3 YEAR VALUE is a percentage; the last is a calculated amount.
    const rateColumn = candidates[0]
    const valueColumn = candidates.find(column => column !== rateColumn && normalized(header[column]).includes("VALUE"))
    if (rateColumn === undefined) throw new SaraCareImportError(`Missing price/rate column for ${String(value)}.`)
    return [{ years, codeColumn: index, rateColumn, valueColumn }]
  })
  if (!columns.length || new Set(columns.map(column => column.years)).size !== columns.length) throw new SaraCareImportError("Add one price/rate and T CODE column pair for each duration.")
  const products = new Map<string, SaraCareMasterRow>()
  let omittedRows = 0
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    if (!row || row.every(blank)) continue
    const itemCell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: itemColumn })]
    const itemno = normalizeCareItemno(itemCell ? XLSX.utils.format_cell(itemCell) : row[itemColumn])
    if (!itemno || itemno.length > 200) throw new SaraCareImportError(`Row ${rowIndex + 1}: enter a valid T ITEM CODES value.`)
    const plans: SaraCareMasterPlan[] = []
    for (const column of columns) {
      const rateCell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: column.rateColumn })]
      const rawRate = row[column.rateColumn]
      const rawValue = column.valueColumn === undefined ? undefined : row[column.valueColumn]
      const codeCell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: column.codeColumn })]
      const code = String(codeCell ? XLSX.utils.format_cell(codeCell) : row[column.codeColumn] ?? "").trim()
      const isPercent = String(rateCell?.z || "").includes("%") || String(rawRate).includes("%")
      const rate = blank(rawRate) ? undefined : amount(rawRate) * (isPercent && typeof rawRate === "number" ? 100 : 1)
      const value = mode === "value" ? (blank(rawValue) ? (!isPercent && !blank(rawRate) ? amount(rawRate) : undefined) : amount(rawValue)) : undefined
      // Empty/zero plan entries mean this duration is unavailable.
      if (!code && (blank(rawRate) || rate === 0) && (blank(rawValue) || amount(rawValue) === 0)) continue
      if (!code || (mode === "percentage" ? !rate : !value)) throw new SaraCareImportError(`Row ${rowIndex + 1}: supply both a positive ${mode === "percentage" ? "percentage" : "VALUE amount"} and T CODE for ${column.years * 12} months, or leave both blank.`)
      const parsed = SaraCareMasterPlanSchema.safeParse({ years: column.years, code, ...(mode === "percentage" ? { percentage: rate } : { value }) })
      if (!parsed.success) throw new SaraCareImportError(`Row ${rowIndex + 1}: ${parsed.error.issues[0].message}`)
      plans.push(parsed.data)
    }
    if (products.has(itemno)) {
      const existing = products.get(itemno)!
      if (JSON.stringify(existing.plans) !== JSON.stringify(plans)) throw new SaraCareImportError(`Row ${rowIndex + 1}: conflicting plans for duplicate item ${itemno}.`)
      continue
    }
    products.set(itemno, { itemno, name: String(nameColumn < 0 ? "" : row[nameColumn]).slice(0, 300), plans: plans.sort((a, b) => a.years - b.years) })
    if (!plans.length) omittedRows++
  }
  if (!products.size) throw new SaraCareImportError("Worksheet 1 has no product rows. The existing data has been kept.")
  return { sheetName, rows: [...products.values()].filter(row => row.plans.length), omittedRows }
}
