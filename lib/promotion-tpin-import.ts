import * as XLSX from "xlsx"

export const MAX_PROMOTION_TPINS = 5000
const headers = new Set(["tpin", "tpinnumber", "tpinno", "sku", "itemno", "itemnumber"])

/** Read displayed cell text so Excel formats such as 00001234 survive import. */
export function importPromotionTpins(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: "array", sheetRows: MAX_PROMOTION_TPINS + 2 })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("The workbook has no worksheets")
  if (sheet["!fullref"] && XLSX.utils.decode_range(sheet["!fullref"]).e.r >= MAX_PROMOTION_TPINS + 1) {
    throw new Error(`Upload at most ${MAX_PROMOTION_TPINS.toLocaleString()} TPIN rows`)
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false })
  const column = rows[0]?.findIndex(value => headers.has(String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, ""))) ?? -1
  if (column < 0) throw new Error("Add a TPIN column header (SKU or Item No. also works) in the first worksheet")
  const tpins: string[] = []
  const seen = new Set<string>()
  let duplicates = 0
  for (const row of rows.slice(1)) {
    const value = String(row[column] ?? "").trim()
    if (!value) continue
    if (value.length > 200 || /[,;\r\n]/.test(value)) throw new Error("Each TPIN must be a single identifier of at most 200 characters")
    const key = value.toLowerCase()
    if (seen.has(key)) { duplicates++; continue }
    seen.add(key)
    tpins.push(value)
  }
  if (!tpins.length) throw new Error("The TPIN column contains no identifiers")
  if (tpins.length > MAX_PROMOTION_TPINS) throw new Error(`Upload at most ${MAX_PROMOTION_TPINS.toLocaleString()} TPINs`)
  return { tpins, duplicates }
}
