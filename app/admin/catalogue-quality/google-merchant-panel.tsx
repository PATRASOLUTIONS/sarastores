"use client"

import { useState } from "react"
import { apiFetch } from "@/lib/api-client"
import type { MerchantPreviewItem } from "@/lib/google-merchant-products"
import type { MerchantSubmissionResult } from "@/lib/google-merchant-api"

interface Preview {
  items: MerchantPreviewItem[]; total: number; offset: number; batchSize: number; nextOffset: number | null;
  accountId: string; dataSourceId: string; feedLabel: string; missing: string[]; token: string | null;
}
export default function GoogleMerchantPanel() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState("")
  const [results, setResults] = useState<MerchantSubmissionResult[] | null>(null)
  const load = async (offset = 0) => {
    if (busy) return
    setBusy(true); setError(""); setConfirmed(false); setResults(null); setPreview(null)
    try {
      const response = await apiFetch(`/api/admin/google-merchant?offset=${offset}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Merchant preview failed")
      setPreview(data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Merchant preview failed") }
    finally { setBusy(false) }
  }
  const submit = async () => {
    if (busy || !confirmed || !preview?.token || results) return
    setBusy(true); setError("")
    const token = preview.token
    // Consume the local preview before sending; an interrupted request must not be silently retried.
    setPreview({ ...preview, token: null }); setConfirmed(false)
    try {
      const response = await apiFetch("/api/admin/google-merchant", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, confirmed: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Submission could not be confirmed. Check Merchant Center before retrying.")
      setResults(data.results)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Submission could not be confirmed. Check Merchant Center before retrying.") }
    finally { setBusy(false) }
  }
  const ready = preview?.items.filter(item => item.input) || []
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ accountId: preview?.accountId,
      dataSourceId: preview?.dataSourceId, inputs: ready.map(item => item.input) }, null, 2)], { type: "application/json" }))
    const link = document.createElement("a"); link.href = url; link.download = "sara-google-merchant-preview.json"; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="space-y-4 rounded-xl border border-blue-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-gray-900">Google Merchant Center</h2><p className="mt-1 text-sm text-gray-600">Start with active, in-stock products. Review product data in batches of five before sending it to Google for India in English.</p></div><a href="https://merchants.google.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-800 underline">Open Merchant Center</a></div>
    <p className="text-sm text-gray-600">Configure an online primary API data source, verify your website, and review shipping and returns in Merchant Center. Submitting product data starts Google’s processing; it does not guarantee listing approval.</p>
    <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Preview active, in-stock products"}</button>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {preview && <>
      <p aria-live="polite" className="text-sm text-gray-700">{preview.total} active, in-stock catalogue items · {ready.length} ready in this batch · {preview.items.length - ready.length} need attention.</p>
      <p className="text-sm text-gray-600">Account: {preview.accountId || "Not configured"} · API data source: {preview.dataSourceId || "Not configured"} · Feed label: {preview.feedLabel}</p>
      {!!preview.missing.length && <details className="rounded-lg border border-amber-200 bg-amber-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-amber-900">Server setup required before sending</summary><p className="mt-2 text-sm text-amber-900">Ask your site administrator to configure these settings using the Merchant integration guide. Keep credentials out of this page and chat.</p><ul className="mt-2 list-disc pl-5 text-xs text-amber-900">{preview.missing.map(name => <li key={name}>{name}</li>)}</ul></details>}
      <div className="space-y-3">{preview.items.map(item => <article key={item.id} className={`rounded-lg border p-4 ${item.input ? "border-green-200" : "border-amber-200"}`}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-gray-900">{item.title || "Missing product name"}</h3><span className="text-sm">₹{item.price.toLocaleString("en-IN")} · Stock {item.stock}</span></div><p className="mt-1 text-xs text-gray-600">Product ID: {item.offerId} · {item.input ? "Ready for review" : "Needs attention"}</p>{!!item.errors.length && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{item.errors.map(message => <li key={message}>{message}</li>)}</ul>}{item.input && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-blue-800">Review exact data sent to Google</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-xs">{JSON.stringify(item.input, null, 2)}</pre></details>}</article>)}</div>
      {!preview.items.length && <p className="text-sm text-gray-600">No active, in-stock products found for this page.</p>}
      {!!ready.length && <div className="space-y-3 rounded-lg bg-blue-50 p-4"><button type="button" onClick={download} className="text-sm font-semibold text-blue-800 underline">Download batch preview</button><label className="flex items-start gap-2 text-sm text-blue-950"><input type="checkbox" checked={confirmed} disabled={busy || !preview.token || !!results} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /><span>I reviewed these {ready.length} products, their identifiers, photos, prices and stock, and approve sending them to account {preview.accountId || "shown above"}. My Merchant shipping and return settings are accurate.</span></label><button type="button" onClick={() => void submit()} disabled={busy || !confirmed || !preview.token || !!results} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send {ready.length} reviewed products to Google</button></div>}
      {results && <div role="status" className="rounded-lg border bg-gray-50 p-4"><h3 className="font-semibold">Submission results</h3><ul className="mt-2 space-y-2 text-sm">{results.map(result => <li key={result.offerId}><strong>{result.offerId}: {result.status}</strong> — {result.message}</li>)}</ul></div>}
      <div className="flex items-center justify-between gap-3"><button type="button" disabled={busy || preview.offset === 0} onClick={() => void load(Math.max(0, preview.offset - preview.batchSize))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Previous batch</button><span className="text-sm text-gray-600">Batch {Math.floor(preview.offset / preview.batchSize) + 1}</span><button type="button" disabled={busy || preview.nextOffset === null} onClick={() => void load(preview.nextOffset!)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Next batch</button></div>
    </>}
  </section>
}
