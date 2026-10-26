import * as XLSX from "xlsx"
import type { SkippedStockRecord } from "@/lib/store-stock-preview"
import type { StoreStockUploadRow } from "@/lib/store-stock"

export function skippedStockWorkbook(rows: StoreStockUploadRow[], skipped: SkippedStockRecord[]) {
  const sheet = XLSX.utils.json_to_sheet(skipped.map(record => {
    const row = rows[record.index]
    return { "Item No.": row.itemCode, "Store Code": row.storeCode, Quantity: row.quantity, Reason: record.reason }
  }))
  sheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 40 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Skipped Rows")
  return workbook
}

const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
const itemHeaders = ["itemcode", "itemno", "itemnumber", "sku"]
const storeHeaders = ["storecode"]
const quantityHeaders = ["quantity", "qty", "stockquantity", "stockqty"]
function cell(row: Record<string, unknown>, headers: string[]) {
  const values = Object.entries(row).filter(([name, value]) => headers.includes(key(name)) && value != null && String(value).trim() !== "")
    .map(([, value]) => String(value).trim())
  if (new Set(values).size > 1) throw new Error("Conflicting columns found. Use one Item No., Store Code and Quantity column.")
  return values[0] || ""
}
export function parseStoreStockRows(sheet: Record<string, unknown>[]) {
  if (!sheet.length) throw new Error("No data found in the sheet")
  if (sheet.length > 50000) throw new Error("Upload at most 50,000 rows")
  const rows: { itemCode: string; storeCode: string; quantity: number }[] = []
  let blankRows = 0
  for (const [index, row] of sheet.entries()) {
    const line = typeof row.__rowNum__ === "number" ? row.__rowNum__ + 1 : index + 2
    const itemCode = cell(row, itemHeaders), storeCode = cell(row, storeHeaders), quantityText = cell(row, quantityHeaders)
    if (!itemCode && !storeCode && !quantityText) {
      if (Object.values(row).some(value => value != null && String(value).trim() !== "")) throw new Error(`Row ${line}: use the columns Item No., Store Code and Quantity`)
      blankRows++; continue
    }
    if (!itemCode || !storeCode || !quantityText) throw new Error(`Row ${line}: Item No., Store Code and Quantity are required. Enter 0 explicitly for zero stock.`)
    const quantity = Number(quantityText.replace(/,/g, ""))
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000) throw new Error(`Row ${line}: quantity must be a whole number between 0 and 1,000,000`)
    rows.push({ itemCode, storeCode, quantity })
  }
  if (!rows.length) throw new Error("The sheet contains no stock rows")
  return { rows, blankRows }
}
export function readStoreStockSpreadsheet(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: "array", raw: true, sheetRows: 50002 })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Spreadsheet has no worksheet")
  if (sheet["!fullref"] && XLSX.utils.decode_range(sheet["!fullref"]).e.r >= 50001) throw new Error("Upload at most 50,000 rows")
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "", blankrows: true })
}
