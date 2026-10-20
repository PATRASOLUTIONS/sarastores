"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"
import { MAX_SCRAPER_IMPORT_BYTES, scraperColumnField, sheetCellLink, validateScraperRows, SCRAPER_TEMPLATE, type ScraperImportRow } from "@/lib/scrapers/bulk-import"
import type { ScrapedProduct } from "@/lib/scrapers/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface QueueItem {
  row: ScraperImportRow
  status: "pending" | "running" | "success" | "error"
  message?: string
}

interface ImportSheet {
  fileName: string
  columns: string[]
  rows: Record<string, string>[]
  rowNumbers: number[]
}

export default function BulkScraperImport({ fetchProduct, supportedUrl }: {
  fetchProduct: (url: string) => Promise<ScrapedProduct>
  supportedUrl: (url: string) => boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const [reading, setReading] = useState(false)
  const [page, setPage] = useState(1)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [sheet, setSheet] = useState<ImportSheet | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPage, setEditorPage] = useState(1)
  const stop = useRef(false)
  const inFlight = useRef(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const sheetValidation = useMemo(
    () => sheet ? validateScraperRows(sheet.rows, supportedUrl, sheet.rowNumbers) : null,
    [sheet, supportedUrl],
  )
  useEffect(() => {
    if (!running) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [running])
  useEffect(() => () => { stop.current = true }, [])

  const template = async () => {
    try {
      const XLSX = await import("xlsx")
      const book = XLSX.utils.book_new()
      const sheet = XLSX.utils.json_to_sheet(SCRAPER_TEMPLATE)
      sheet["!cols"] = [20, 65].map(wch => ({ wch }))
      XLSX.utils.book_append_sheet(book, sheet, "Scraper")
      XLSX.writeFile(book, "bulk-scraper-template.xlsx")
    } catch (cause) {
      console.error("[Bulk Scraper] Template failed", cause)
      toast.error("Could not download the Excel template")
    }
  }
  const prepareSheet = (data: ImportSheet) => {
    const validation = validateScraperRows(data.rows, supportedUrl, data.rowNumbers)
    if (validation.error) {
      setError(validation.error)
      setSheet(null)
      return
    }
    const first = validation.issues[0]
    if (first) {
      setItems([])
      setError(`Row ${first.row}: ${first.message}`)
      setEditorPage(Math.floor(data.rowNumbers.indexOf(first.row) / 25) + 1)
      setEditorOpen(true)
      return
    }
    setItems(validation.rows.map(row => ({ row, status: "pending" })))
    setPage(1)
    setFileName(data.fileName)
    setError("")
    setEditorOpen(false)
  }
  const upload = async (file: File) => {
    setReading(true)
    setError("")
    setItems([])
    setFileName("")
    setSheet(null)
    setEditorOpen(false)
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Choose an Excel .xlsx or .xls file")
      if (file.size > MAX_SCRAPER_IMPORT_BYTES) throw new Error("File exceeds 3 MB")
      const XLSX = await import("xlsx")
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", sheetRows: 502 })
      const sheet = book.Sheets[book.SheetNames[0]]
      if (!sheet) throw new Error("Spreadsheet has no worksheet")
      if (sheet["!fullref"]) throw new Error("Spreadsheet exceeds 500 rows; remove extra rows before uploading")
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null
      if (range) {
        const headers = new Map<number, string>()
        for (let column = range.s.c; column <= range.e.c; column++) {
          const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })]
          headers.set(column, String(header?.v ?? ""))
        }
        for (const row of data) {
          const excelRow = typeof row.__rowNum__ === "number" ? row.__rowNum__ : null
          if (excelRow == null) continue
          for (const [column, header] of headers) {
            if (scraperColumnField(header) !== "url") continue
            const cell = sheet[XLSX.utils.encode_cell({ r: excelRow, c: column })]
            const link = sheetCellLink(cell)
            const current = String(row[header] ?? "")
            if (link && !/^https?:\/\//i.test(current.trim())) row[header] = link
          }
        }
      }
      const columns = Array.from(new Set(data.flatMap(row => Object.keys(row))))
      const present = new Set(columns.map(scraperColumnField))
      for (const column of Object.keys(SCRAPER_TEMPLATE[0])) {
        if (!present.has(scraperColumnField(column))) columns.push(column)
      }
      const editable: ImportSheet = {
        fileName: file.name,
        columns,
        rows: data.map(row => Object.fromEntries(columns.map(column => [column, String(row[column] ?? "")]))),
        rowNumbers: data.map((row, index) => typeof row.__rowNum__ === "number" ? row.__rowNum__ + 1 : index + 2),
      }
      setSheet(editable)
      prepareSheet(editable)
    } catch (cause) {
      console.warn("[Bulk Scraper] Invalid spreadsheet", cause)
      setError(cause instanceof Error ? cause.message : "Could not read spreadsheet")
    } finally {
      setReading(false)
    }
  }
  const run = async () => {
    if (inFlight.current) return
    if (!window.confirm("Run scraper for all pending/failed items, auto-approve specifications and publish them to Products? Existing prices and stock are preserved; new products start with zero stock.")) return
    inFlight.current = true
    stop.current = false
    setRunning(true)
    const update = (index: number, status: QueueItem["status"], message?: string) =>
      setItems(current => current.map((item, i) => i === index ? { ...item, status, message } : item))
    let published = items.filter(item => item.status === "success").length
    try {
      for (let i = 0; i < items.length; i++) {
        if (stop.current) break
        if (items[i].status === "success") continue
        update(i, "running", "Scraping and publishing...")
        try {
          const product = await fetchProduct(items[i].row.url)
          const response = await apiFetch("/api/scrape/publish", {
            method: "POST", json: { row: items[i].row, product },
          })
          const body = await response.json()
          if (!response.ok || !body.success) throw new Error(body.error || "Could not publish product")
          update(i, "success", "Published; specifications approved")
          published++
        } catch (cause) {
          console.error("[Bulk Scraper] Item failed", { itemno: items[i].row.itemno, cause })
          update(i, "error", cause instanceof Error ? cause.message : "Scrape failed")
        }
      }
      if (published === items.length) {
        toast.success(`Published ${published} products and approved their specifications`)
        router.push("/admin/products")
      }
    } finally {
      inFlight.current = false
      setRunning(false)
    }
  }
  const remaining = items.filter(item => item.status !== "success").length
  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-bold">Bulk import from Excel</h2>
      <p className="text-sm text-gray-600">
        Upload only <strong>itemno</strong> and <strong>product link</strong>.
        Up to 500 rows / 3 MB. Upload only prepares the queue; Run Scraper processes every item and automatically approves its specifications.
        Scraped values create the initial record; update name, division, category, segment and brand later from Products → Metadata Update.
        Existing prices and stock are preserved; new products start with zero stock. You will be taken to Products when all rows succeed.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={template} className="rounded-lg border px-4 py-2 text-sm font-semibold">Download Excel template</button>
        <label className="rounded-lg border px-4 py-2 text-sm font-semibold">
          {reading ? "Reading..." : "Upload Excel"}
          <input type="file" accept=".xlsx,.xls" disabled={running || reading} className="ml-3 text-sm" onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void upload(file)
          }} />
        </label>
        {sheet && items.every(item => item.status === "pending") && <button type="button" disabled={running || reading} onClick={() => setEditorOpen(true)} className="rounded-lg border px-4 py-2 text-sm font-semibold">
          Edit uploaded sheet
        </button>}
        <button type="button" disabled={running || reading || editorOpen || !remaining} onClick={run} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {running ? "Running..." : items.some(item => item.status === "error") ? "Retry failed / run pending" : "Run Scraper"}
        </button>
        {running && <button type="button" onClick={() => { stop.current = true }} className="rounded-lg border px-4 py-2 text-sm">Stop after current item</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {editorOpen && sheet && sheetValidation && <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          ref={editorRef}
          onOpenAutoFocus={event => {
            const invalid = editorRef.current?.querySelector<HTMLTextAreaElement>('textarea[aria-invalid="true"]')
            if (invalid) {
              event.preventDefault()
              invalid.focus()
            }
          }}
          className="flex h-[90vh] max-w-[96vw] flex-col bg-white"
        >
          <DialogHeader>
            <DialogTitle>Edit uploaded Excel sheet</DialogTitle>
            <DialogDescription>
              {sheet.fileName}: all {sheet.rows.length} rows and uploaded columns are available below.
              Correct the highlighted cells, then validate the entire sheet. Missing template columns are added as editable blank cells.
            </DialogDescription>
          </DialogHeader>
          <div aria-live="polite" className="shrink-0 text-sm">
            {sheetValidation.issues.length ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
              <p className="font-semibold">{sheetValidation.issues.length} issues found. Select an issue to open its row.</p>
              <ul className="mt-2 max-h-24 space-y-1 overflow-auto">
                {sheetValidation.issues.map((issue, index) => <li key={`${issue.row}-${issue.field}-${index}`}>
                  <button type="button" onClick={() => setEditorPage(Math.floor(sheet.rowNumbers.indexOf(issue.row) / 25) + 1)} className="break-all text-left underline">
                    Row {issue.row} ({issue.column || issue.field}): {issue.message}
                  </button>
                </li>)}
              </ul>
            </div> : <p className="text-green-700">All rows are valid. Select Validate &amp; use sheet to prepare the scraper queue.</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100"><tr>
                <th scope="col" className="border-b p-2">Excel row</th>
                {sheet.columns.map(column => <th scope="col" key={column} className="border-b p-2">{column}</th>)}
              </tr></thead>
              <tbody>{sheet.rows.slice((editorPage - 1) * 25, editorPage * 25).map((row, offset) => {
                const index = (editorPage - 1) * 25 + offset
                const rowNumber = sheet.rowNumbers[index]
                const rowIssues = sheetValidation.issues.filter(issue => issue.row === rowNumber)
                return <tr key={rowNumber} className={rowIssues.length ? "bg-red-50" : ""}>
                  <th scope="row" className="border-b p-2 align-top">{rowNumber}</th>
                  {sheet.columns.map((column, columnIndex) => {
                    const issues = rowIssues.filter(issue => issue.column === column)
                    const errorId = `scraper-sheet-${index}-${columnIndex}-error`
                    return <td key={column} className="border-b p-2 align-top">
                      <textarea
                        aria-label={`Row ${rowNumber}, ${column}`}
                        aria-invalid={issues.length > 0}
                        aria-describedby={issues.length ? errorId : undefined}
                        value={row[column]}
                        rows={3}
                        onChange={event => {
                          const value = event.target.value
                          setSheet(current => current ? { ...current, rows: current.rows.map((values, i) => i === index ? { ...values, [column]: value } : values) } : current)
                          setItems([])
                          setError("Sheet edited. Validate & use sheet before running the scraper.")
                        }}
                        className={`w-full min-w-[220px] resize-y rounded border bg-white p-2 ${issues.length ? "border-red-500" : "border-gray-300"}`}
                      />
                      {!!issues.length && <p id={errorId} className="mt-1 max-w-sm break-all text-xs text-red-700">{issues.map(issue => issue.message).join("; ")}</p>}
                    </td>
                  })}
                </tr>
              })}</tbody>
            </table>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <button type="button" disabled={editorPage === 1} onClick={() => setEditorPage(editorPage - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous sheet page</button>
              Page {editorPage} / {Math.max(1, Math.ceil(sheet.rows.length / 25))}
              <button type="button" disabled={editorPage * 25 >= sheet.rows.length} onClick={() => setEditorPage(editorPage + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next sheet page</button>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border px-4 py-2">Close editor</button>
              <button type="button" onClick={() => prepareSheet(sheet)} className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white">Validate &amp; use sheet</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>}
      {!!items.length && <>
        <p aria-live="polite" className="text-sm">
          {fileName}: {items.filter(item => item.status === "success").length} published, {items.filter(item => item.status === "error").length} failed, {items.filter(item => item.status === "pending").length} pending.
          {running && " Keep this page open until processing finishes."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th className="p-2">Item number</th><th className="p-2">Product link</th><th className="p-2">Status</th><th className="p-2">Result</th></tr></thead>
            <tbody>{items.slice((page - 1) * 25, page * 25).map(item => <tr key={item.row.itemno} className="border-t">
              <td className="p-2">{item.row.itemno}</td><td className="max-w-xs truncate p-2" title={item.row.url}>{item.row.url}</td><td className="p-2">{item.status}</td>
              <td className={`p-2 ${item.status === "error" ? "text-red-700" : ""}`}>{item.message || "Ready"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>
          Page {page} / {Math.ceil(items.length / 25)}
          <button type="button" disabled={page * 25 >= items.length} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
          <Link href="/admin/products" className="font-semibold underline">Go to Products</Link>
          <Link href="/admin/product-specifications" className="underline">Product specifications</Link>
        </div>
      </>}
    </section>
  )
}
