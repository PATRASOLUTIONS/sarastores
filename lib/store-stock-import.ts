import * as XLSX from "xlsx"
import type { SkippedStockRecord } from "@/lib/store-stock-preview"
import type { StoreStockUploadRow } from "@/lib/store-stock"

export function skippedStockWorkbook(rows: StoreStockUploadRow[], skipped: SkippedStockRecord[]) {
  const sheet = XLSX.utils.json_to_sheet(skipped.map(record => {
    const row = rows[record.index]
    return { CODE: row.itemCode, WhsCode: row.storeCode, Total: row.quantity, Reason: record.reason }
  }))
  sheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 40 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Skipped Rows")
  return workbook
}

const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
const itemHeaders = ["code", "itemcode", "itemno", "itemnumber", "sku"]
const storeHeaders = ["whscode", "storecode"]
const quantityHeaders = ["total", "quantity", "qty", "stockquantity", "stockqty"]
function cell(row: Record<string, unknown>, headers: string[]) {
  const values = Object.entries(row).filter(([name, value]) => headers.includes(key(name)) && value != null && String(value).trim() !== "")
    .map(([, value]) => String(value).trim())
  if (new Set(values).size > 1) throw new Error("Conflicting columns found. Use one CODE, WhsCode and Total column.")
  return values[0] || ""
}
export function parseStoreStockRows(sheet: Record<string, unknown>[]) {
  if (!sheet.length) throw new Error("No data found in the sheet")
  const rows: { itemCode: string; storeCode: string; quantity: number }[] = []
  let blankRows = 0
  for (const [index, row] of sheet.entries()) {
    const line = typeof row.__rowNum__ === "number" ? row.__rowNum__ + 1 : index + 2
    const itemCode = cell(row, itemHeaders), storeCode = cell(row, storeHeaders), quantityText = cell(row, quantityHeaders)
    if (!itemCode && !storeCode && !quantityText) {
      if (Object.values(row).some(value => value != null && String(value).trim() !== "")) throw new Error(`Row ${line}: use the columns CODE, WhsCode and Total`)
      blankRows++; continue
    }
    if (!itemCode || !storeCode || !quantityText) throw new Error(`Row ${line}: CODE, WhsCode and Total are required. Enter 0 explicitly for zero stock.`)
    const quantity = Number(quantityText.replace(/,/g, ""))
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000) throw new Error(`Row ${line}: Total must be a whole number between 0 and 1,000,000`)
    rows.push({ itemCode, storeCode, quantity })
  }
  if (!rows.length) throw new Error("The sheet contains no stock rows")
  return { rows, blankRows }
}
export function readStoreStockSpreadsheet(data: ArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(data), { type: "array", raw: true, sheets: [0] })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Spreadsheet has no worksheet")
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "", blankrows: true })
}
