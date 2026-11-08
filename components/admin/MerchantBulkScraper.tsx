"use client"

import { useEffect, useRef, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { MAX_SCRAPER_IMPORT_BYTES, scraperColumnField, scraperItemNumberKey, sheetCellLink, validateScraperRows, type ScraperImportRow } from "@/lib/scrapers/bulk-import"
import type { MerchantEnrichment } from "@/lib/scrapers/merchant-enrichment"
import { merchantSheetCsv, merchantSheetRow } from "@/lib/scrapers/merchant-sheet"

interface QueueItem { row: ScraperImportRow; status: string; message?: string; enrichment?: MerchantEnrichment; sara?: Record<string, unknown> }
export default function MerchantBulkScraper() {
  const [items, setItems] = useState<QueueItem[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [page, setPage] = useState(0), [filename, setFilename] = useState("")
  const stop = useRef(false)
  useEffect(() => () => { stop.current = true }, [])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])
  const upload = async (file: File) => {
    if (busy) return
    setBusy(true); setError(""); setItems([]); setPage(0)
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name) || file.size > MAX_SCRAPER_IMPORT_BYTES) throw new Error("Use Excel files up to 3 MB and 500 rows.")
      const XLSX = await import("xlsx"), book = XLSX.read(await file.arrayBuffer(), { type: "array", sheetRows: 502 })
      const sheet = book.Sheets[book.SheetNames[0]]
      if (!sheet || sheet["!fullref"]) throw new Error("Use a first worksheet with at most 500 product rows.")
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")
      for (const row of rows) for (let c = range.s.c; c <= range.e.c; c++) {
        const header = String(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v || "")
        if (scraperColumnField(header) !== "url") continue
        const index = typeof row.__rowNum__ === "number" ? row.__rowNum__ : null
        if (index === null) continue
        const link = sheetCellLink(sheet[XLSX.utils.encode_cell({ r: index, c })])
        if (link) row[header] = link
      }
      const validation = validateScraperRows(rows)
      if (validation.error || validation.issues.length) throw new Error(validation.error || `Row ${validation.issues[0].row}: ${validation.issues[0].message}`)
      const keys = validation.rows.map(row => scraperItemNumberKey(row.itemno)), saved = new Map<string, MerchantEnrichment>(), catalogue = new Map<string, Record<string, unknown>>()
      for (let offset = 0; offset < keys.length; offset += 50) {
        const query = new URLSearchParams()
        keys.slice(offset, offset + 50).forEach(key => query.append("itemno", key))
        const response = await apiFetch(`/api/scrape/merchant?${query}`, { cache: "no-store" }), body = await response.json()
        if (!response.ok) throw new Error(body.error || "Could not check saved items")
        for (const item of body.saved as MerchantEnrichment[]) saved.set(item.itemno, item)
        for (const [key, value] of Object.entries(body.catalogue || {})) catalogue.set(key, value as Record<string, unknown>)
      }
      const seen = new Set<string>()
      setItems(validation.rows.map(row => {
        const key = scraperItemNumberKey(row.itemno), duplicate = seen.has(key)
        seen.add(key)
        return saved.has(key) ? { row, status: "saved", message: "Already saved; no fetch", enrichment: saved.get(key), sara: catalogue.get(key) }
          : duplicate ? { row, status: "duplicate", message: "Repeated item number; skipped" } : { row, status: "pending" }
      }))
      setFilename(file.name)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read workbook") }
    finally { setBusy(false) }
  }
  const run = async () => {
    if (busy) return
    setBusy(true); setError(""); stop.current = false
    const update = (index: number, values: Partial<QueueItem>) => setItems(current => current.map((item, i) => i === index ? { ...item, ...values } : item))
    try {
      for (let i = 0; i < items.length && !stop.current; i++) {
        if (!["pending", "failed"].includes(items[i].status)) continue
        update(i, { status: "fetching", message: "Fetching source page and saving evidence" })
        try {
          const response = await apiFetch("/api/scrape/merchant", { method: "POST", json: { row: items[i].row, mode: "store" } })
          const body = await response.json()
          if (!response.ok || !body.enrichment) throw new Error(body.error || "Source extraction failed")
          update(i, { status: "saved", message: body.skipped ? "Already saved; no fetch" : "Saved; identifiers need review", enrichment: body.enrichment,
            sara: body.catalogue || undefined })
        } catch (cause) { update(i, { status: "failed", message: cause instanceof Error ? cause.message : "Source extraction failed" }) }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } finally { setBusy(false) }
  }
  const download = (json = false) => {
    const saved = items.filter(item => item.enrichment)
    const content = json ? JSON.stringify(saved.map(item => item.enrichment), null, 2)
      : merchantSheetCsv(saved.map(item => merchantSheetRow(item.enrichment!, item.sara)))
    const url = URL.createObjectURL(new Blob([content], { type: json ? "application/json" : "text/csv;charset=utf-8" }))
    const link = document.createElement("a"); link.href = url; link.download = `sara-merchant-enrichment.${json ? "json" : "csv"}`; link.click(); URL.revokeObjectURL(url)
  }
  const saved = items.filter(item => item.enrichment).length
  return <section className="space-y-4 rounded-xl border border-blue-200 bg-white p-5">
    <h2 className="text-xl font-bold">Merchant product enrichment</h2>
    <p className="text-sm text-gray-600">Upload item numbers and retailer/manufacturer product links. Run saves source details once, including items already in Products. Saved item numbers are skipped on later uploads. Sara prices, stock and Google listings are updated through their existing reviewed workflows.</p>
    <div className="flex flex-wrap gap-3"><a href="/templates/merchant-bulk-scraper-template.xlsx" download className="rounded-lg border px-3 py-2 text-sm">Download Merchant Excel template</a>
      <label className="rounded-lg border px-3 py-2 text-sm">Upload Excel <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file) }} /></label>
      <button type="button" disabled={busy || !items.some(item => ["pending", "failed"].includes(item.status))} onClick={() => void run()} className="rounded-lg bg-blue-900 px-3 py-2 text-sm text-white disabled:opacity-50">Run and save source details</button>
      {busy && <button type="button" onClick={() => { stop.current = true }} className="rounded-lg border px-3 py-2 text-sm">Stop after current item</button>}
      {!!saved && <><button type="button" onClick={() => download()} className="text-sm text-blue-800 underline">Download Merchant review CSV</button><button type="button" onClick={() => download(true)} className="text-sm text-blue-800 underline">Download all source evidence</button></>}
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!!items.length && <><p role="status" className="text-sm">{filename}: {saved} saved, {items.filter(item => item.status === "failed").length} failed, {items.filter(item => item.status === "pending").length} pending.</p>
      <p className="text-xs text-gray-600">GTIN columns are text. A valid checksum does not prove the exact variant. Review identifiers, source and image usage before updating Products. Blank Sara price/stock cells mean unavailable catalogue data.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Item number</th><th className="p-2">Result</th><th className="p-2">GTIN / MPN</th><th className="p-2">Details</th></tr></thead><tbody>{items.slice(page * 25, page * 25 + 25).map((item, i) => <tr key={`${page}-${i}`} className="border-t"><td className="p-2">{item.row.itemno}</td><td className="p-2">{item.status}</td><td className="p-2">{item.enrichment?.gtin || "Missing GTIN"}<br />{item.enrichment?.mpn || "Missing MPN"}</td><td className="p-2">{item.message}{item.enrichment && <details><summary className="cursor-pointer text-blue-800">Review source facts</summary><pre className="max-h-72 max-w-xl overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(item.enrichment, null, 2)}</pre></details>}</td></tr>)}</tbody></table></div>
      <div className="flex gap-3"><button type="button" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(items.length / 25)}</span><button type="button" disabled={(page + 1) * 25 >= items.length} onClick={() => setPage(page + 1)}>Next</button></div></>}
  </section>
}
