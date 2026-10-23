"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import * as XLSX from "xlsx"
import { toast } from "react-hot-toast"
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Search, Upload } from "lucide-react"
import { apiFetch } from "@/lib/api-client"

interface StoreSummary {
  storeCode: string
  storeName: string
  isActive: boolean
  items: number
  inStock: number
  units: number
  updatedAt: string | null
}

interface UploadResult {
  saved: number
  stores: number
  zeroedItems: number
  productsUpdated: number
  unknownStores: string[]
  unknownStoreCount: number
  unknownItems: string[]
  unknownItemCount: number
  skippedRows: number
}

interface ItemLookup {
  product: { name: string; sku: string; stock: number } | null
  rows: { storeCode: string; storeName: string; quantity: number; updatedAt: string }[]
}

const ITEM_COLUMNS = ["Item Code", "ItemCode", "itemcode", "Item No.", "Item No", "itemno", "SKU", "sku"]
const QUANTITY_COLUMNS = ["Quantity", "quantity", "Qty", "qty", "QTY"]
const STORE_COLUMNS = ["Store Code", "StoreCode", "storecode", "storeCode"]

function readCell(row: Record<string, unknown>, columns: string[]): string {
  for (const column of columns) {
    const value = row[column]
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim()
  }
  return ""
}

export default function StockCheckPage() {
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [itemCode, setItemCode] = useState("")
  const [lookup, setLookup] = useState<ItemLookup | null>(null)
  const [searching, setSearching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadSummary() {
    setLoading(true)
    try {
      const res = await apiFetch("/api/admin/store-stock")
      const data = await res.json()
      if (!data.success) throw new Error(data.message || data.error)
      setStores(data.stores || [])
    } catch {
      toast.error("Failed to load store stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSummary() }, [])

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Item Code": "T000946", "Quantity": 5, "Store Code": "BLR001" },
      { "Item Code": "T000909", "Quantity": 2, "Store Code": "BLR001" },
      { "Item Code": "T000946", "Quantity": 3, "Store Code": "BLR002" },
    ])
    ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Store Stock")
    XLSX.writeFile(wb, "store_stock_template.xlsx")
  }

  const exportStock = async () => {
    const toastId = toast.loading("Preparing export...")
    try {
      const res = await apiFetch("/api/admin/store-stock?export=1")
      const data = await res.json()
      if (!data.success) throw new Error(data.message || data.error)
      if (!data.rows.length) { toast.error("No store stock to export", { id: toastId }); return }
      const ws = XLSX.utils.json_to_sheet(data.rows.map((row: { itemCode: string; quantity: number; storeCode: string; storeName: string }) => ({
        "Item Code": row.itemCode, "Quantity": row.quantity, "Store Code": row.storeCode, "Store Name": row.storeName,
      })))
      ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 35 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Store Stock")
      XLSX.writeFile(wb, `store_stock_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Store stock exported", { id: toastId })
    } catch {
      toast.error("Failed to export store stock", { id: toastId })
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setResult(null)
    const toastId = toast.loading("Processing file...")
    try {
      const workbook = XLSX.read(await file.arrayBuffer())
      const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
      if (sheet.length === 0) { toast.error("No data found in the file", { id: toastId }); return }

      const rows = []
      for (const [index, row] of sheet.entries()) {
        const line = index + 2
        const code = readCell(row, ITEM_COLUMNS)
        const storeCode = readCell(row, STORE_COLUMNS)
        const quantityText = readCell(row, QUANTITY_COLUMNS)
        if (!code && !storeCode && !quantityText) continue
        const quantity = Number(quantityText || 0)
        if (!code || !storeCode) { toast.error(`Row ${line}: item code and store code are required`, { id: toastId }); return }
        if (!Number.isInteger(quantity) || quantity < 0) { toast.error(`Row ${line}: quantity must be a whole number of 0 or more`, { id: toastId }); return }
        rows.push({ itemCode: code, storeCode, quantity })
      }

      const res = await apiFetch("/api/admin/store-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Saved ${data.saved} rows for ${data.stores} store(s)`, { id: toastId })
        setResult(data)
        void loadSummary()
      } else {
        toast.error(data.message || data.error || "Upload failed", { id: toastId })
        if (data.unknownStores || data.unknownItems) setResult({ saved: 0, stores: 0, zeroedItems: 0, productsUpdated: 0, ...data })
      }
    } catch {
      toast.error("Failed to process Excel file", { id: toastId })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const search = async (event: FormEvent) => {
    event.preventDefault()
    const code = itemCode.trim()
    if (!code) return
    setSearching(true)
    try {
      const res = await apiFetch(`/api/admin/store-stock?itemCode=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || data.error)
      setLookup({ product: data.product, rows: data.rows })
    } catch {
      toast.error("Failed to look up the item")
    } finally {
      setSearching(false)
    }
  }

  const missingCodes = stores.length === 0

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Stock Check</h1>
        <p className="text-gray-600">Upload each store&apos;s stock by item code. A product&apos;s stock on the website is the total across all stores.</p>
      </div>

      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} id="stock-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
          <label htmlFor="stock-upload" className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
            <Upload className="h-4 w-4" />{uploading ? "Uploading..." : "Upload Stock Excel"}
          </label>
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
            <FileSpreadsheet className="h-4 w-4" />Download Template
          </button>
          <button type="button" onClick={exportStock} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" />Export Store Stock
          </button>
        </div>
        <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
          <p className="mb-1 font-medium">Columns: Item Code, Quantity, Store Code</p>
          <p>Item Code is the product SKU / Item No. Store Code comes from Store Locations.</p>
          <p className="mt-1 flex items-start gap-1 font-medium text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Each store in the sheet is replaced in full: that store&apos;s items not listed in the sheet are set to 0.
          </p>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border p-4 text-sm">
            <p className="font-medium text-gray-900">
              {result.saved} rows saved for {result.stores} store(s) · {result.zeroedItems} item(s) set to 0 · {result.productsUpdated} product stock total(s) updated
            </p>
            {result.skippedRows > 0 && <p className="mt-1 text-amber-800">{result.skippedRows} row(s) skipped because the store code or item code is unknown.</p>}
            {result.unknownStoreCount > 0 && <p className="mt-1 text-red-700">
              Unknown store codes ({result.unknownStoreCount}): {result.unknownStores.join(", ")}{result.unknownStoreCount > result.unknownStores.length ? "…" : ""}
            </p>}
            {result.unknownItemCount > 0 && <p className="mt-1 text-red-700">
              Unknown item codes ({result.unknownItemCount}): {result.unknownItems.join(", ")}{result.unknownItemCount > result.unknownItems.length ? "…" : ""}
            </p>}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Find an item</h2>
        <form onSubmit={search} className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={itemCode} onChange={e => setItemCode(e.target.value)} placeholder="Item code, e.g. T000946"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={searching} className="rounded-xl bg-gray-900 px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {searching ? "Searching..." : "Search"}
          </button>
        </form>
        {lookup && (
          <div className="mt-4">
            {lookup.product
              ? <p className="mb-2 text-sm text-gray-700"><strong>{lookup.product.name}</strong> · website stock <strong>{lookup.product.stock}</strong></p>
              : <p className="mb-2 text-sm text-red-700">No product has this item code.</p>}
            {lookup.rows.length === 0 ? <p className="text-sm text-gray-600">No store has stock uploaded for this item.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="border-b text-gray-500"><tr><th className="py-2">Store Code</th><th>Store</th><th className="text-right">Quantity</th></tr></thead>
                <tbody>
                  {lookup.rows.map(row => (
                    <tr key={row.storeCode} className="border-b last:border-0">
                      <td className="py-2 font-mono">{row.storeCode}</td><td>{row.storeName}</td>
                      <td className={`text-right font-semibold ${row.quantity > 0 ? "text-green-700" : "text-gray-400"}`}>{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Stock by store</h2>
          <button type="button" onClick={() => void loadSummary()} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
        {loading ? <p className="text-sm text-gray-600">Loading…</p> : missingCodes ? (
          <p className="text-sm text-amber-800">No store has a store code yet. Add store codes in Store Locations before uploading stock.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr><th className="py-2">Store Code</th><th>Store</th><th className="text-right">Items listed</th><th className="text-right">In stock</th><th className="text-right">Units</th><th className="text-right">Last upload</th></tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <tr key={store.storeCode} className={`border-b last:border-0 ${store.isActive ? "" : "opacity-50"}`}>
                  <td className="py-2 font-mono">{store.storeCode}</td>
                  <td>{store.storeName}{!store.isActive && " (inactive)"}</td>
                  <td className="text-right">{store.items}</td>
                  <td className="text-right">{store.inStock}</td>
                  <td className="text-right">{store.units}</td>
                  <td className="text-right text-gray-500">{store.updatedAt ? new Date(store.updatedAt).toLocaleString("en-IN") : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
