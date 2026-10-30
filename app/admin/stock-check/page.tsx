"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import * as XLSX from "xlsx"
import { toast } from "react-hot-toast"
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Search, Upload } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { parseStoreStockRows, readStoreStockSpreadsheet, skippedStockWorkbook } from "@/lib/store-stock-import"
import type { StockChange, SkippedStockRecord } from "@/lib/store-stock-preview"
import type { StoreStockUploadRow } from "@/lib/store-stock"

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
  preview: boolean
  validRows: number
  changes: StockChange[]
  totalChanges: number
  previewPage: number
  pageSize: number
  previewToken: string
  skippedRecords: SkippedStockRecord[]
  preservedStores: string[]
  preservedStoreCount: number
  saved: number
  stores: number
  zeroedItems: number
  productsUpdated: number
  unknownStores: string[]
  unknownStoreCount: number
  unknownItems: string[]
  unknownItemCount: number
  skippedRows: number
  blankRows: number
}
interface PendingUpload { rows: StoreStockUploadRow[]; replaceStores: boolean; blankRows: number }

interface ItemLookup {
  product: { name: string; sku: string; stock: number } | null
  rows: { storeCode: string; storeName: string; quantity: number; updatedAt: string }[]
}

export default function StockCheckPage() {
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [previewStale, setPreviewStale] = useState(false)
  const [itemCode, setItemCode] = useState("")
  const [lookup, setLookup] = useState<ItemLookup | null>(null)
  const [searching, setSearching] = useState(false)
  const [lookupCode, setLookupCode] = useState("")
  const uploadInFlight = useRef(false)
  const lookupRequest = useRef(0)
  const [sheetUrl, setSheetUrl] = useState("")
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
      { "Item No.": "T000946", "Quantity": 5, "Store Code": "BLR001" },
      { "Item No.": "T000909", "Quantity": 2, "Store Code": "BLR001" },
      { "Item No.": "T000946", "Quantity": 3, "Store Code": "BLR002" },
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
        "Item No.": row.itemCode, "Quantity": row.quantity, "Store Code": row.storeCode, "Store Name": row.storeName,
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

  const importRows = async (sheet: Record<string, unknown>[], toastId: string) => {
    const { rows, blankRows } = parseStoreStockRows(sheet)
    const pending = { rows, blankRows, replaceStores: false }
    setPendingUpload(pending)
    const data = await fetchStockPreview(pending)
    setResult({ ...data, blankRows })
    setPreviewStale(false)
    toast.success(`${data.validRows} row(s) ready to save; ${data.skippedRows} unknown row(s) skipped`, { id: toastId })
  }
  const fetchStockPreview = async (pending: PendingUpload, page = 0, token?: string): Promise<Omit<UploadResult, "blankRows">> => {
    const res = await apiFetch("/api/admin/store-stock", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: pending.rows, replaceStores: pending.replaceStores, preview: true, previewPage: page,
        ...(token ? { previewToken: token } : {}) }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      if (res.status === 409) setPreviewStale(true)
      throw new Error(data.message || data.error || "Stock preview failed")
    }
    return data
  }
  const refreshPreview = async (page = 0, checkToken = false) => {
    if (!pendingUpload || uploadInFlight.current) return
    uploadInFlight.current = true
    setUploading(true)
    try {
      const data = await fetchStockPreview(pendingUpload, page, checkToken ? result?.previewToken : undefined)
      setResult({ ...data, blankRows: pendingUpload.blankRows })
      setPreviewStale(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Preview could not be refreshed") }
    finally { uploadInFlight.current = false; setUploading(false) }
  }
  const applyPreview = async () => {
    if (!pendingUpload || !result?.preview || !result.validRows || previewStale || uploadInFlight.current) return
    uploadInFlight.current = true
    setUploading(true)
    const toastId = toast.loading("Applying stock changes...")
    try {
      const res = await apiFetch("/api/admin/store-stock", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: pendingUpload.rows, replaceStores: pendingUpload.replaceStores, previewToken: result.previewToken }) })
      const data = await res.json()
      if (!res.ok || !data.success) {
        if (res.status === 409) setPreviewStale(true)
        throw new Error(data.message || data.error || "Stock changes could not be applied")
      }
      setResult({ ...data, blankRows: pendingUpload.blankRows })
      toast.success(`Saved ${data.saved} rows for ${data.stores} store(s)`, { id: toastId })
      await loadSummary()
      if (lookupCode) await loadItemLookup(lookupCode)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Stock changes could not be applied", { id: toastId }) }
    finally { uploadInFlight.current = false; setUploading(false) }
  }
  const downloadSkipped = () => {
    if (!pendingUpload || !result?.skippedRecords.length) return
    const workbook = skippedStockWorkbook(pendingUpload.rows, result.skippedRecords)
    XLSX.writeFile(workbook, `skipped_stock_rows_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (uploadInFlight.current) return
    uploadInFlight.current = true
    setUploading(true)
    setResult(null)
    setPendingUpload(null)
    setPreviewStale(false)
    const toastId = toast.loading("Processing file...")
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Choose an Excel .xlsx or .xls file")
      if (file.size > 10 * 1024 * 1024) throw new Error("File exceeds 10 MB")
      await importRows(readStoreStockSpreadsheet(await file.arrayBuffer()), toastId)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Failed to process Excel file", { id: toastId })
    } finally {
      uploadInFlight.current = false
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleGoogleSheet = async (event: FormEvent) => {
    event.preventDefault()
    const sheetId = sheetUrl.trim()
    if (!sheetId) return
    if (uploadInFlight.current) return
    uploadInFlight.current = true
    setUploading(true)
    setResult(null)
    setPendingUpload(null)
    setPreviewStale(false)
    const toastId = toast.loading("Fetching Google Sheet...")
    try {
      const res = await apiFetch("/api/admin/store-stock/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId }),
      })
      const data = await res.json()
      if (!data.success) { toast.error(data.message || data.error || "Failed to fetch Google Sheet", { id: toastId }); return }
      await importRows(data.rows, toastId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import Google Sheet", { id: toastId })
    } finally {
      uploadInFlight.current = false
      setUploading(false)
    }
  }

  const loadItemLookup = async (code: string) => {
    const requestId = ++lookupRequest.current
    setSearching(true)
    try {
      const res = await apiFetch(`/api/admin/store-stock?itemCode=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || data.error)
      if (requestId !== lookupRequest.current) return
      setLookupCode(code)
      setLookup({ product: data.product, rows: data.rows })
    } catch {
      toast.error("Failed to look up the item")
    } finally {
      if (requestId === lookupRequest.current) setSearching(false)
    }
  }
  const search = async (event: FormEvent) => {
    event.preventDefault()
    const code = itemCode.trim()
    if (code) await loadItemLookup(code)
  }

  const missingCodes = stores.length === 0

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Stock Check</h1>
        <p className="text-gray-600">Upload Excel or paste a Google Sheets link to update stock for matching item numbers already on the platform. A product&apos;s website stock is the total across all stores.</p>
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
        <form onSubmit={handleGoogleSheet} className="mt-4 flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <FileSpreadsheet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="Google Sheet URL or ID"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={uploading || !sheetUrl.trim()} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${uploading ? "animate-spin" : ""}`} />Import from Google Sheet
          </button>
        </form>
        <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
          <p className="mb-1 font-medium">Columns: Item No., Store Code, Quantity</p>
          <p>Item No. (or itemno) matches an existing catalogue item number or SKU. Store Code comes from Store Locations. Column names can use spaces, underscores or uppercase letters. Keep item numbers and store codes as text to preserve leading zeros.</p>
          <p>Upload the full sheet with up to 50,000 rows (10 MB). Only matching items at known stores are updated; items absent from the sheet keep their stock. No products are created.</p>
          <p>For Google Sheets, share as &quot;Anyone with the link can view&quot; or publish to the web, then paste the link to the stock tab.</p>
          <p>Unknown item or store codes are skipped and can be downloaded in Excel. Review the previous and new stock quantities before applying valid rows.</p>
          <p className="mt-1 flex items-start gap-1 font-medium text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Only matching item/store quantities from the sheet are updated. Other items and stores keep their stock.
          </p>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border p-4 text-sm">
            <h2 className="text-lg font-semibold text-gray-900">{result.preview ? "Stock change preview" : "Stock changes saved"}</h2>
            <p className="mt-1 text-gray-700">{result.preview ? `${result.validRows} valid row(s) ready to save` : `${result.saved} row(s) saved`} for {result.stores} store(s). {result.skippedRows} unknown row(s) skipped.</p>
            {result.blankRows > 0 && <p className="mt-1 text-gray-600">{result.blankRows} completely blank row(s) ignored.</p>}
            {result.zeroedItems > 0 && <p className="mt-1 text-amber-800">{result.zeroedItems} omitted item/store stock row(s) {result.preview ? "will be set" : "set"} to zero by full replacement.</p>}
            {result.preservedStoreCount > 0 && <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">Omitted items are kept for {result.preservedStores.join(", ")}{result.preservedStoreCount > result.preservedStores.length ? " and other stores" : ""} because some rows for those stores were unknown. Only their valid listed rows are updated.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {result.skippedRows > 0 && <button type="button" onClick={downloadSkipped} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-medium text-amber-900"><Download size={16} />Download skipped rows ({result.skippedRows})</button>}
              {result.preview && <>
                <button type="button" onClick={() => void applyPreview()} disabled={uploading || previewStale || !result.validRows} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">{uploading ? "Processing..." : `Apply ${result.validRows} valid row(s)`}</button>
                <button type="button" onClick={() => void refreshPreview()} disabled={uploading} className="rounded-lg border px-3 py-2 disabled:opacity-50">Refresh preview</button>
                <button type="button" disabled={uploading} onClick={() => { setResult(null); setPendingUpload(null); setPreviewStale(false) }} className="rounded-lg border px-3 py-2 disabled:opacity-50">Cancel preview</button>
              </>}
            </div>
            {previewStale && <p role="alert" className="mt-2 text-amber-800">Stock changed since this preview. Refresh it to review the latest quantities before applying.</p>}
            {result.changes.length > 0 ? <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="border-b bg-gray-50 text-xs text-gray-600"><tr>
                    <th className="p-2">Item No.</th><th className="p-2">Product</th><th className="p-2">Store Code</th><th className="p-2">Store</th>
                    <th className="p-2 text-right">Previous overall stock</th><th className="p-2 text-right">New overall stock</th>
                    <th className="p-2 text-right">Previous store stock</th><th className="p-2 text-right">New store stock</th>
                  </tr></thead>
                  <tbody>{result.changes.map(row => <tr key={`${row.storeCode}:${row.sku}`} className="border-b last:border-0">
                    <td className="p-2 font-mono">{row.itemCode}{row.source === "omitted" && <span className="mt-1 block font-sans text-xs text-amber-800">Omitted: set to zero</span>}</td>
                    <td className="p-2">{row.productName || "-"}</td><td className="p-2 font-mono">{row.storeCode}</td><td className="p-2">{row.storeName}</td>
                    <td className="p-2 text-right">{row.previousOverallStock.toLocaleString("en-IN")}</td><td className="p-2 text-right font-semibold text-blue-700">{row.currentOverallStock.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right">{row.previousStoreStock.toLocaleString("en-IN")}</td><td className="p-2 text-right font-semibold text-blue-700">{row.currentStoreStock.toLocaleString("en-IN")}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
                <span>Showing {result.previewPage * result.pageSize + 1} to {Math.min((result.previewPage + 1) * result.pageSize, result.totalChanges)} of {result.totalChanges} item/store changes. Overall totals include all stores for each item.</span>
                {result.preview && result.totalChanges > result.pageSize && <div className="flex gap-2">
                  <button type="button" disabled={uploading || result.previewPage === 0} onClick={() => void refreshPreview(result.previewPage - 1, true)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
                  <button type="button" disabled={uploading || (result.previewPage + 1) * result.pageSize >= result.totalChanges} onClick={() => void refreshPreview(result.previewPage + 1, true)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
                </div>}
              </div>
            </> : <p className="mt-3 text-gray-600">No known item/store rows to update. Download the skipped rows to correct their codes.</p>}
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
            <p className="mb-2 text-sm text-gray-700">Item {lookupCode}: cumulative uploaded stock <strong>{lookup.rows.reduce((total, row) => total + row.quantity, 0)}</strong>.</p>
            {lookup.product && lookup.product.stock !== lookup.rows.reduce((total, row) => total + row.quantity, 0) && <p role="alert" className="mb-2 rounded bg-amber-50 p-2 text-sm text-amber-900">
              The product stock differs from its uploaded total. Upload the current quantities for this item to recalculate its total.
            </p>}
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
