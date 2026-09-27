"use client"

import { apiFetch } from "@/lib/api-client"
import { useState } from "react"
import * as XLSX from "xlsx"

type BulkRow = {
  orderId: string
  status: string
  trackingNumber?: string
  approved?: boolean // undefined = pending, true = approved, false = rejected
}

export default function BulkStatusUpload({ onComplete }: { onComplete?: (result: { success: BulkRow[];
 failed: { row: BulkRow; error: string }[] }) => void }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<BulkRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewCount, setPreviewCount] = useState(100) // Show all rows by default

  const normalizeRow = (r: Record<string, any>): BulkRow => {
    const keys = Object.keys(r)
    const findKey = (...candidates: string[]) =>
      keys.find((k) => candidates.map((c) => c.toLowerCase()).includes(k.toLowerCase()))

    const orderKey = findKey("order id", "orderid", "order", "id")
    const statusKey = findKey("status", "order status", "order_status")
    const trackingKey = findKey("tracking number", "tracking", "tracking_no", "tracking_number")

    return {
      orderId: orderKey ? String((r as any)[orderKey]).trim() : "",
      status: statusKey ? String((r as any)[statusKey]).trim() : "",
      trackingNumber: trackingKey ? String((r as any)[trackingKey]).trim() : "",
    }
  }

  const handleFile = async (file?: File) => {
    setError(null)
    setRows([])
    if (!file) return
    setFileName(file.name)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) {
        setError("No sheet found")
        return
      }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" })
      if (!json || json.length === 0) {
        setError("No data rows found")
        return
      }
      const normalized = json.map((r) => ({ ...normalizeRow(r), approved: undefined }))
      setRows(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file")
    }
  }

  const downloadTemplate = () => {
    const template = [
      { "Order ID": "67890abcdef12345", "Status": "shipped", "Tracking Number": "TRACK123456" },
      { "Order ID": "12345abcdef67890", "Status": "delivered", "Tracking Number": "" },
      { "Order ID": "abcdef1234567890", "Status": "processing", "Tracking Number": "" }
    ]
    
    const worksheet = XLSX.utils.json_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders")
    XLSX.writeFile(workbook, "bulk_order_update_template.xlsx")
  }

  const approveRow = (index: number) => {
    const newRows = [...rows]
    newRows[index].approved = true
    setRows(newRows)
  }

  const rejectRow = (index: number) => {
    const newRows = [...rows]
    newRows[index].approved = false
    setRows(newRows)
  }

  const approveAll = () => {
    const newRows = rows.map((r) => {
      const hasOrderId = r.orderId && r.orderId.trim() !== ""
      const hasStatus = r.status && r.status.trim() !== ""
      return { ...r, approved: hasOrderId && hasStatus ? true : r.approved }
    })
    setRows(newRows)
  }

  const rejectAll = () => {
    const newRows = rows.map((r) => ({ ...r, approved: false }))
    setRows(newRows)
  }

  const handleUpload = async () => {
    setError(null)
    
    // Only process approved rows
    const approvedRows = rows.filter((r) => r.approved === true)
    
    if (approvedRows.length === 0) {
      setError("No rows approved for upload. Please approve at least one row.")
      return
    }

    // Validate approved rows
    const invalidRows: string[] = []
    approvedRows.forEach((r, index) => {
      const originalIndex = rows.indexOf(r) + 1
      if (!r.orderId || r.orderId.trim() === "") {
        invalidRows.push(`Row ${originalIndex}: Missing Order ID`)
      }
      if (!r.status || r.status.trim() === "") {
        invalidRows.push(`Row ${originalIndex}: Missing Status`)
      }
    })

    if (invalidRows.length > 0) {
      setError(`Validation errors in approved rows:\n${invalidRows.join('\n')}`)
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch("/api/orders/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: approvedRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Bulk update failed")
      onComplete?.(data)
      
      // Show detailed results
      const successMsg = `✅ Successfully updated ${data.success.length} order(s)`
      const failedMsg = data.failed.length > 0 ? `\n❌ Failed to update ${data.failed.length} order(s)` : ''
      const emailMsg = `\n📧 Email notifications sent to customers`
      const rejectedCount = rows.filter(r => r.approved === false).length
      const rejectedMsg = rejectedCount > 0 ? `\n🚫 Rejected ${rejectedCount} order(s)` : ''
      alert(successMsg + failedMsg + emailMsg + rejectedMsg)
      
      // Remove successfully processed rows
      const remainingRows = rows.filter(r => r.approved !== true)
      setRows(remainingRows)
      if (remainingRows.length === 0) {
        setFileName(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Bulk Order Status Update</h2>
        <p className="text-sm text-gray-600">Upload an Excel file to update multiple order statuses at once. Customers will receive email notifications automatically.</p>
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files ? e.target.files[0] : undefined)}
              className="hidden"
            />
            <button
              onClick={(e) => {
                const input = (e.currentTarget.parentElement as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement
                input?.click()
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              📁 Choose Excel File
            </button>
            <span className="text-sm text-gray-600">{fileName ?? "No file selected"}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            ⬇️ Download Template
          </button>
          {rows.length > 0 && (
            <>
              <button
                onClick={approveAll}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                ✅ Approve All Valid
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                ❌ Reject All
              </button>
            </>
          )}
          <button
            onClick={handleUpload}
            disabled={loading || rows.filter(r => r.approved === true).length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? "⏳ Processing..." : `📤 Process Approved (${rows.filter(r => r.approved === true).length})`}
          </button>
          <button
            onClick={() => {
              setRows([])
              setFileName(null)
              setError(null)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Instructions:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Download the template Excel file to see the required format</li>
          <li>Fill in Order ID (required), Status (required), and Tracking Number (optional for shipped orders)</li>
          <li>Valid statuses: <span className="font-mono bg-blue-100 px-1 rounded">pending, processing, shipped, delivered, cancelled</span></li>
          <li><strong>Review each row</strong> and click <span className="text-green-700 font-semibold">✓ Approve</span> or <span className="text-red-700 font-semibold">✗ Reject</span></li>
          <li>Use <strong>Approve All Valid</strong> to approve all rows with complete data, or <strong>Reject All</strong> to reject everything</li>
          <li>Only <strong>approved rows</strong> will be processed and customers will receive email notifications</li>
          <li>Rejected rows will be skipped and can be corrected later</li>
        </ul>
      </div>

      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-900 mb-2">❌ Error:</h3>
          <div className="text-sm text-red-700 whitespace-pre-line">{error}</div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-600">
              Total: {rows.length} | 
              <span className="text-green-600 font-semibold"> Approved: {rows.filter(r => r.approved === true).length}</span> | 
              <span className="text-red-600 font-semibold"> Rejected: {rows.filter(r => r.approved === false).length}</span> | 
              <span className="text-gray-500"> Pending: {rows.filter(r => r.approved === undefined).length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 bg-gray-100">
                  <th className="px-2 py-2 border">#</th>
                  <th className="px-2 py-2 border">Order ID</th>
                  <th className="px-2 py-2 border">Status</th>
                  <th className="px-2 py-2 border">Tracking Number</th>
                  <th className="px-2 py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const hasOrderId = r.orderId && r.orderId.trim() !== ""
                  const hasStatus = r.status && r.status.trim() !== ""
                  const isValid = hasOrderId && hasStatus
                  
                  let rowBgColor = ""
                  if (r.approved === true) rowBgColor = "bg-green-50"
                  else if (r.approved === false) rowBgColor = "bg-red-50"
                  else if (!isValid) rowBgColor = "bg-yellow-50"
                  
                  return (
                    <tr key={i} className={rowBgColor}>
                      <td className="px-2 py-2 border text-gray-600">{i + 1}</td>
                      <td className={`px-2 py-2 border ${!hasOrderId ? "text-red-600 font-semibold" : ""}`}>
                        {r.orderId || <span className="text-red-500 italic">Missing</span>}
                      </td>
                      <td className={`px-2 py-2 border ${!hasStatus ? "text-red-600 font-semibold" : ""}`}>
                        {r.status || <span className="text-red-500 italic">Missing</span>}
                      </td>
                      <td className="px-2 py-2 border">{r.trackingNumber || "-"}</td>
                      <td className="px-2 py-2 border">
                        <div className="flex gap-1">
                          {r.approved !== true && (
                            <button
                              onClick={() => approveRow(i)}
                              disabled={!isValid}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!isValid ? "Cannot approve invalid row" : "Approve this row"}
                            >
                              ✓ Approve
                            </button>
                          )}
                          {r.approved !== false && (
                            <button
                              onClick={() => rejectRow(i)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                              title="Reject this row"
                            >
                              ✗ Reject
                            </button>
                          )}
                          {r.approved === true && (
                            <span className="text-green-600 font-semibold text-xs flex items-center gap-1">
                              ✓ Approved
                            </span>
                          )}
                          {r.approved === false && (
                            <span className="text-red-600 font-semibold text-xs flex items-center gap-1">
                              ✗ Rejected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}