"use client"

import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { toast } from "react-hot-toast"
import { apiFetch, apiFetchJson } from "@/lib/api-client"
import { SaraCareConfigSchema, emptySaraCareConfig, saraCareDurationLabel, type SaraCareConfig } from "@/lib/sara-care-types"

const ResponseSchema = z.object({ config: SaraCareConfigSchema, total: z.number(), rows: z.array(z.object({
  itemno: z.string(), name: z.string(), plans: z.array(z.object({ years: z.number(), code: z.string(), percentage: z.number().optional(), value: z.number().optional() })),
})) })
const UploadSchema = z.object({ products: z.number(), plans: z.number(), omittedRows: z.number() })
const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"

export default function SaraCareAdminPage() {
  const [config, setConfig] = useState<SaraCareConfig>(emptySaraCareConfig)
  const [rows, setRows] = useState<z.infer<typeof ResponseSchema>["rows"]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<"percentage" | "value">("percentage")
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError("")
    const timer = setTimeout(() => {
      void apiFetchJson(`/api/admin/sara-care?page=${page}&search=${encodeURIComponent(search)}`, { signal: controller.signal }, value => ResponseSchema.parse(value))
        .then(data => { if (!controller.signal.aborted) { setRows(data.rows); setTotal(data.total) } })
        .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load plans") })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [page, search, refresh])
  useEffect(() => {
    const controller = new AbortController()
    void apiFetchJson("/api/admin/sara-care", { signal: controller.signal }, value => ResponseSchema.parse(value))
      .then(data => { if (!controller.signal.aborted) { setConfig(data.config); setMode(data.config.pricingMode) } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load settings") })
    return () => controller.abort()
  }, [refresh])
  const upload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData(); body.append("file", file); body.append("pricingMode", mode); body.append("basis", config.basis)
      const result = await apiFetchJson("/api/admin/sara-care", { method: "POST", body }, value => UploadSchema.parse(value))
      toast.success(`Replaced plans: ${result.products.toLocaleString()} products, ${result.plans.toLocaleString()} plans. ${result.omittedRows} rows without plans skipped.`)
      setFile(null); if (fileInput.current) fileInput.current.value = ""
      setPage(0); setRefresh(value => value + 1)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed") }
    finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true)
    try {
      await apiFetchJson("/api/admin/sara-care", { method: "PUT", json: { enabled: config.enabled, terms: config.terms, coverageStarts: config.coverageStarts, basis: config.basis } })
      toast.success("Sara Care pricing and coverage settings saved"); setRefresh(value => value + 1)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save") }
    finally { setBusy(false) }
  }
  const download = async () => {
    setBusy(true)
    try {
      const response = await apiFetch("/api/admin/sara-care?format=xlsx")
      if (!response.ok) throw new Error("Could not download the format")
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "sara-care-format.xlsx"; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Download failed") }
    finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div><h1 className="text-2xl font-bold text-maroon-800">Sara Care</h1><p className="mt-2 text-sm text-gray-600">Manage protection plans for each product by its T item code. Products without an uploaded plan have no Sara Care option.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error} <button type="button" className="underline" onClick={() => setRefresh(value => value + 1)}>Reload</button></p>}
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Upload product plan master</h2><button type="button" disabled={busy} onClick={() => void download()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Download Excel format</button></div>
      <p className="text-sm text-gray-600">Only the first worksheet is imported. Every successful upload clears the previous master and replaces it completely. A rejected upload keeps the previous data.</p>
      <p className="text-sm text-gray-600">Columns: T ITEM CODES, 6 Months, T CODE 6Months, 1 YEAR, T CODE 1YEAR, 2 YEAR, T CODE 2 YEAR, 3 YEAR VALUE, T CODE 3YEAR.</p>
      <p className="text-sm text-gray-600">Leave both cells blank for unavailable durations. Add pairs such as 5 YEAR and T CODE 5YEAR for future plans. Extra description and product columns are allowed. Keep item codes as text to preserve leading zeros.</p>
      <label className="block text-sm">Pricing for this upload<select className={`${inputClass} mt-1`} value={mode} disabled={busy} onChange={event => setMode(event.target.value as typeof mode)}><option value="percentage">Percentage of selected price basis</option><option value="value">Uploaded fixed VALUE amount</option></select></label>
      <p className="text-xs text-gray-500">Percentage mode accepts Excel percentages (8%) or plain percentage numbers (8). VALUE mode uses the trailing calculated VALUE columns in your example, or rupee amounts in the duration columns of the download format. Plan prices include GST.</p>
      <input ref={fileInput} aria-label="Sara Care Excel file" type="file" accept=".xlsx,.xls" disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
      <button type="button" disabled={busy || !file} onClick={() => void upload()} className="rounded-lg bg-maroon-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : "Upload and replace plans"}</button>
      {config.importId && <p className="text-sm text-gray-600">Saved: {config.importedFile} · {config.importedProducts.toLocaleString()} products · {config.importedPlans.toLocaleString()} plans · {config.pricingMode === "percentage" ? `Percentage of ${config.basis === "mrp" ? "MRP" : "selling price"}` : "Fixed VALUE pricing"}</p>}
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-semibold">Pricing and coverage settings</h2>
      <label className="block text-sm">Sara Care price basis<select className={`${inputClass} mt-1`} value={config.basis} disabled={busy} onChange={event => setConfig(value => ({ ...value, basis: event.target.value as SaraCareConfig["basis"] }))}><option value="price">Product selling price</option><option value="mrp">Product MRP</option></select></label>
      <p className="text-xs text-gray-500">Percentage plans use this amount from the current product record. Save settings to apply a change to existing plans, or upload a sheet with the selected basis. With MRP selected, percentage plans are unavailable for products without a valid MRP. Uploaded fixed VALUE prices stay fixed.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.enabled} disabled={busy || !config.importedPlans} onChange={event => setConfig(value => ({ ...value, enabled: event.target.checked }))} />Enable Sara Care for products in the uploaded master</label>
      <label className="block text-sm">Coverage begins<select className={`${inputClass} mt-1`} value={config.coverageStarts} disabled={busy} onChange={event => setConfig(value => ({ ...value, coverageStarts: event.target.value as SaraCareConfig["coverageStarts"] }))}><option value="delivery">On delivery / collection</option><option value="purchase">On purchase after payment</option></select></label>
      <label className="block text-sm">Coverage terms and exclusions<textarea className={`${inputClass} mt-1 min-h-40`} value={config.terms} disabled={busy} onChange={event => setConfig(value => ({ ...value, terms: event.target.value }))} placeholder="Enter the coverage terms (at least 20 characters before enabling)." /></label>
      <button type="button" disabled={busy || !config.importId} onClick={() => void save()} className="rounded-lg bg-maroon-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Save pricing and coverage settings</button>
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-semibold">Uploaded product plans</h2>
      <input aria-label="Search uploaded plans" className={inputClass} placeholder="Search item code or description" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} />
      {loading ? <p role="status" className="text-sm text-gray-500">Loading plans…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Item code</th><th className="p-2">Description</th><th className="p-2">Available plans</th></tr></thead><tbody>{rows.map(row => <tr key={row.itemno} className="border-b"><td className="p-2 align-top font-medium">{row.itemno}</td><td className="p-2 align-top">{row.name || "—"}</td><td className="p-2">{row.plans.map(plan => <p key={plan.years}>{saraCareDurationLabel(plan.years)} · {plan.percentage !== undefined ? `${plan.percentage}%` : `₹${plan.value?.toLocaleString("en-IN")}`} · {plan.code}</p>)}</td></tr>)}</tbody></table>{!rows.length && <p className="py-5 text-sm text-gray-500">No uploaded plans found.</p>}</div>}
      <div className="flex items-center justify-between gap-3 text-sm"><button type="button" disabled={!page || loading} onClick={() => setPage(value => value - 1)} className="disabled:opacity-50">Previous</button><span>{total.toLocaleString()} products · Page {page + 1} of {Math.max(1, Math.ceil(total / 100))}</span><button type="button" disabled={(page + 1) * 100 >= total || loading} onClick={() => setPage(value => value + 1)} className="disabled:opacity-50">Next</button></div>
    </section>
  </div>
}
