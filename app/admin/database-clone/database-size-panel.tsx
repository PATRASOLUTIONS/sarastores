"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Database, Loader2, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { formatDatabaseBytes } from "@/lib/database-size"
import type { CloneDatabaseSizes } from "@/lib/database-clone"

export default function DatabaseSizePanel() {
  const [sizes, setSizes] = useState<CloneDatabaseSizes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const active = useRef(false)
  const mounted = useRef(true)
  const load = useCallback(async () => {
    if (active.current) return
    active.current = true; setLoading(true); setError("")
    try {
      const response = await apiFetch("/api/admin/database-clone/size", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Database size could not be loaded")
      if (mounted.current) setSizes(data)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Database size could not be loaded")
    } finally { active.current = false; if (mounted.current) setLoading(false) }
  }, [])
  useEffect(() => {
    mounted.current = true; void load()
    return () => { mounted.current = false }
  }, [load])

  return <section className="rounded-xl border bg-white p-5" aria-label="Database sizes">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Database className="h-5 w-5 text-blue-700" />Database size</h2><p className="mt-1 text-xs text-gray-600">Production and destination database statistics. Refresh manually for updated figures.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{loading ? "Reading sizes…" : "Refresh sizes"}</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}{sizes?.measuredAt && " Previously measured figures below have not been refreshed."}</p>}
    {loading && !sizes && <p role="status" className="mt-4 text-sm text-gray-600">Reading database storage statistics without scanning or modifying documents.</p>}
    {sizes && !sizes.configured && <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Size unavailable until the dedicated clone connections are configured. {sizes.message}</p>}
    {sizes?.configured && <>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{[{ label: "Production source", size: sizes.source }, { label: "Clone destination", size: sizes.target }].map(({ label, size }) => size && <article key={label} className="rounded-lg border bg-gray-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><h3 className="mt-1 break-words font-semibold text-gray-900">{size.database}</h3>
        <p className="mt-3 text-3xl font-bold text-blue-950">{formatDatabaseBytes(size.allocatedBytes)}</p><p className="mt-1 text-xs text-gray-600">Allocated storage including indexes</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><dt className="text-gray-600">Logical document data</dt><dd className="text-right font-semibold">{formatDatabaseBytes(size.dataBytes)}</dd><dt className="text-gray-600">Document storage</dt><dd className="text-right font-semibold">{formatDatabaseBytes(size.storageBytes)}</dd><dt className="text-gray-600">Indexes</dt><dd className="text-right font-semibold">{formatDatabaseBytes(size.indexBytes)}</dd><dt className="text-gray-600">Collections</dt><dd className="text-right font-semibold">{size.collections?.toLocaleString("en-IN") ?? "Unavailable"}</dd><dt className="text-gray-600">Documents</dt><dd className="text-right font-semibold">{size.documents?.toLocaleString("en-IN") ?? "Unavailable"}</dd></dl>
      </article>)}</div>
      <p className="mt-3 text-xs text-gray-500">{sizes.measuredAt && <>Measured {new Date(sizes.measuredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. </>}These figures cover only the named databases, not the entire clusters. Logical data can exceed compressed storage. Free capacity and charges must be checked in Atlas. Destination totals include clone control metadata and may change while copying.</p>
    </>}
  </section>
}
