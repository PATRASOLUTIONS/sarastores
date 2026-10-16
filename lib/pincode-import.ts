import * as XLSX from "xlsx"
import { PincodeEntrySchema } from "@/lib/validation"
import type { PincodeEntry } from "@/lib/pincode-policy"

export const MAX_PINCODE_IMPORT_BYTES = 3 * 1024 * 1024
export const MAX_PINCODE_IMPORT_ROWS = 20000

export function readPincodeSpreadsheet(buffer: ArrayBuffer): { entries: PincodeEntry[]; duplicateRows: number } {
  if (buffer.byteLength > MAX_PINCODE_IMPORT_BYTES) throw new Error("Excel file exceeds 3 MB")
  const workbook = XLSX.read(buffer, { type: "array", sheetRows: MAX_PINCODE_IMPORT_ROWS + 2 })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Excel file has no worksheet")
  const range = sheet["!fullref"] || sheet["!ref"]
  if (range && (XLSX.utils.decode_range(range).s.r !== 0 || XLSX.utils.decode_range(range).s.c !== 0)) {
    throw new Error("Start the header row in cell A1, as shown in the template")
  }
  if (range && XLSX.utils.decode_range(range).e.r > MAX_PINCODE_IMPORT_ROWS) {
    throw new Error(`Excel file exceeds ${MAX_PINCODE_IMPORT_ROWS.toLocaleString("en-IN")} data rows`)
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: true })
  const headers = rows[0]?.map(value => typeof value === "string" ? value.trim().toLowerCase() : "")
  if (!headers?.includes("pincode")) throw new Error('The first row must contain a "Pincode" column. Download the template for the format.')
  for (const name of ["pincode", "name", "state"]) {
    if (headers.filter(header => header === name).length > 1) throw new Error(`Duplicate "${name}" column`)
  }
  const pincodeColumn = headers.indexOf("pincode")
  const nameColumn = headers.indexOf("name")
  const stateColumn = headers.indexOf("state")
  const entries = new Map<string, PincodeEntry>()
  let duplicateRows = 0
  const errors: string[] = []
  rows.slice(1).forEach((row, index) => {
    if (row.every(value => value === "" || value == null)) return
    const value = row[pincodeColumn]
    const pincode = typeof value === "number" && Number.isInteger(value) ? String(value)
      : typeof value === "string" ? value.trim() : ""
    const parsed = PincodeEntrySchema.safeParse({
      pincode, name: nameColumn < 0 ? "" : row[nameColumn], state: stateColumn < 0 ? "" : row[stateColumn],
    })
    const formula = [pincodeColumn, nameColumn, stateColumn].filter(column => column >= 0)
      .some(column => sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })]?.f)
    if (!parsed.success || formula) {
      errors.push(`Row ${index + 2}: ${formula ? "Use plain values, not formulas" : parsed.success ? "" : parsed.error.issues[0].message}`)
      return
    }
    if (entries.has(pincode)) duplicateRows++
    entries.set(pincode, parsed.data)
  })
  if (errors.length) throw new Error(`${errors.slice(0, 10).join("; ")}${errors.length > 10 ? `; and ${errors.length - 10} more invalid rows` : ""}. Nothing was imported.`)
  if (!entries.size) throw new Error("Excel file has no pincode rows")
  const result = [...entries.values()]
  if (new TextEncoder().encode(JSON.stringify(result)).length > 8 * 1024 * 1024) {
    throw new Error("Pincode data is too large. Split it into smaller Excel files.")
  }
  return { entries: result, duplicateRows }
}
