"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Database, Eye, Loader2, Pause, Play, RefreshCw, ShieldCheck } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import type { ClonePreview, CloneState } from "@/lib/database-clone"
import DatabaseSizePanel from "./database-size-panel"

type Status = { configured: boolean; writesEnabled: boolean; message: string; state: CloneState | null }
const confirmationText = "CLONE e-commerce-bytewise TO sara_clone"
const bytes = (value: number) => value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GB` : `${(value / 1024 ** 2).toFixed(1)} MB`
const date = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
const button = "inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
const primary = "inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"

export default function DatabaseCloneClient() {
  const [status, setStatus] = useState<Status | null>(null)
  const [preview, setPreview] = useState<ClonePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [acceptLogical, setAcceptLogical] = useState(false)
  const [acceptCapacity, setAcceptCapacity] = useState(false)
  const pause = useRef(false)
  const active = useRef(false)
  const mounted = useRef(true)

  const loadStatus = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/database-clone", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Clone status could not be loaded")
      if (mounted.current) { setStatus(data); setError("") }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Clone status could not be loaded") }
    finally { if (mounted.current) setLoading(false) }
  }, [])

  useEffect(() => {
    mounted.current = true
    void loadStatus()
    return () => { mounted.current = false; pause.current = true }
  }, [loadStatus])

  const requestPreview = async () => {
    if (active.current) return
    active.current = true; setBusy(true); setError(""); setPreview(null)
    setConfirmation(""); setAcceptLogical(false); setAcceptCapacity(false)
    try {
      const response = await apiFetch("/api/admin/database-clone/preview", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Clone preview failed")
      if (mounted.current) setPreview(data)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Clone preview failed") }
    finally { active.current = false; if (mounted.current) setBusy(false) }
  }

  const run = async (start: boolean) => {
    if (active.current || !status?.writesEnabled) return
    if (start && (!preview || confirmation !== confirmationText || !acceptLogical || !acceptCapacity)) return
    let current = status.state
    if (!start && current?.status !== "running") return
    active.current = true; pause.current = false; setRunning(true); setError("")
    const update = (next: CloneState) => {
      current = next
      if (mounted.current) setStatus(value => value ? { ...value, state: next } : value)
    }
    try {
      if (start && preview) {
        const response = await apiFetch("/api/admin/database-clone", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", approvalToken: preview.approvalToken, confirmation, acceptLogicalCopy: true }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Clone could not be started")
        update(data.state)
        if (mounted.current) setPreview(null)
      }
      // Bounded requests are awaited in sequence. Closing the page stops further requests.
      while (current?.status === "running" && !pause.current && mounted.current) {
        const response = await apiFetch("/api/admin/database-clone", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "advance", runId: current.runId }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Clone batch interrupted")
        update(data.state)
      }
    } catch (cause) {
      if (mounted.current) { await loadStatus(); setError(cause instanceof Error ? cause.message : "Clone request interrupted") }
    } finally { active.current = false; if (mounted.current) setRunning(false) }
  }

  const state = status?.state
  const percent = state?.status === "verified" ? 100 : state?.total ? Math.min(99, Math.round((state.copied + state.verified) / (state.total * 2) * 100)) : 0
  const canStart = preview && status?.writesEnabled && confirmation === confirmationText && acceptLogical && acceptCapacity && !busy && !running

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Database protection</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Manual database clone</h1><p className="mt-2 text-sm text-gray-600">Preview, approve and verify an independent copy. Runs only when an administrator requests it.</p></div>
      <div className="flex flex-wrap gap-2">{!status?.state && <button type="button" onClick={requestPreview} disabled={loading || !status?.configured || busy || running} title="Review the read-only preview, then explicitly approve the database copy" className={primary}><Database className="h-4 w-4" />Create clone</button>}<button type="button" onClick={() => void loadStatus()} disabled={busy || running} className={button}><RefreshCw className="h-4 w-4" />Refresh status</button></div>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {[{ title: "Production source", value: "e-commerce-bytewise", detail: "Read-only dedicated account", icon: ShieldCheck }, { title: "Independent destination", value: "sara_clone", detail: "Existing data is never overwritten", icon: Database }, { title: "Execution", value: "Manual only", detail: "No schedule or automatic deletion", icon: Play }].map(item => <div key={item.title} className="rounded-xl border bg-white p-5"><item.icon className="mb-3 h-5 w-5 text-blue-700" /><p className="text-xs font-medium text-gray-500">{item.title}</p><p className="mt-1 break-words text-lg font-bold text-gray-900">{item.value}</p><p className="mt-2 text-xs text-gray-600">{item.detail}</p></div>)}
    </div>
    <DatabaseSizePanel />
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Cloning uses existing Vercel execution and MongoDB storage/traffic. No paid service is added, but usage can exceed your included allowances. Check the preview and destination capacity before approving.</p></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && <div role="status" className="flex items-center gap-2 rounded-xl border bg-white p-6 text-sm"><Loader2 className="h-5 w-5 animate-spin" />Loading configuration…</div>}
    {!loading && status && <>
      {!status.configured && <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">Setup required</h2><p className="mt-2 text-sm text-gray-600">{status.message}</p><p className="mt-3 text-sm text-gray-600">Configure server-only <code>DATABASE_CLONE_SOURCE_URI</code>, <code>DATABASE_CLONE_TARGET_URI</code> and <code>DATABASE_CLONE_APPROVAL_SECRET</code> in Vercel. The source account must have only <strong>read</strong> on e-commerce-bytewise; the destination account must have only <strong>readWrite</strong> on sara_clone. Shared administrator credentials are refused.</p><p className="mt-3 text-sm text-gray-600">Do not change the application’s production connection. No database is contacted while clone configuration is missing.</p></section>}
      {status.configured && !state && <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">Start with a read-only preview</h2><p className="mt-2 text-sm text-gray-600">{status.message} Preview checks permissions, collection support, counts and estimated storage. It does not create collections or copy records.</p><button type="button" onClick={requestPreview} disabled={busy || running} className={`mt-4 ${primary}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Preview clone</button></section>}
      {status.configured && !status.writesEnabled && <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Preview mode: database writes are disabled. After reviewing the preview, an operator can enable <code>DATABASE_CLONE_WRITES_ENABLED=true</code>. Explicit confirmation is still required to start a clone.</p>}
      {preview && <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">Review the clone operation</h2><p className="mt-2 text-sm text-gray-600">{preview.source.database} → {preview.target.database}. Approval expires after five minutes; source inventory changes require a fresh preview.</p>
        <div className="my-4 grid gap-3 sm:grid-cols-3">{[["Collections", preview.collections.length], ["Documents", preview.documents.toLocaleString("en-IN")], ["Estimated space with headroom", bytes(preview.estimate.requiredDestinationBytes)]].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div>
        <div className="max-h-64 overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-gray-50"><tr><th className="p-3">Collection</th><th className="p-3 text-right">Documents</th><th className="p-3 text-right">Indexes</th></tr></thead><tbody>{preview.collections.map(item => <tr key={item.name} className="border-t"><td className="p-3">{item.name}</td><td className="p-3 text-right">{item.count.toLocaleString("en-IN")}</td><td className="p-3 text-right">{item.indexes}</td></tr>)}</tbody></table></div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-600">{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        <div className="mt-5 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold text-blue-950">Explicit approval</h3>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acceptLogical} onChange={event => setAcceptLogical(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />I approve a live logical copy, with its consistency limitations, into the empty sara_clone destination.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acceptCapacity} onChange={event => setAcceptCapacity(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />I have checked destination space and usage allowances. I understand this consumes storage and execution.</label>
          <label className="block text-sm font-medium">Type <span className="font-mono text-xs">{confirmationText}</span><input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" className="mt-2 block w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
          <button type="button" onClick={() => void run(true)} disabled={!canStart} className={primary}><Database className="h-4 w-4" />Clone database</button>
        </div>
      </section>}
      {state && <section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold">{state.status === "verified" && <CheckCircle2 className="h-5 w-5 text-green-700" />}{state.status === "verified" ? "Clone verified" : state.status === "failed" ? "Clone stopped — verification required" : running ? "Copying and verifying" : "Clone ready to resume"}</h2><p className="mt-2 text-sm text-gray-600">Started {date(state.createdAt)} IST. Last checkpoint {date(state.updatedAt)} IST.</p></div>{state.status === "running" && (running ? <button type="button" onClick={() => { pause.current = true }} className={button}><Pause className="h-4 w-4" />Pause after this batch</button> : <button type="button" disabled={!status.writesEnabled} onClick={() => void run(false)} className={primary}><Play className="h-4 w-4" />Resume clone</button>)}</div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Clone copy and verification progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div style={{ width: `${percent}%` }} className="h-full bg-blue-700" /></div><p aria-live="polite" className="mt-2 text-sm text-gray-600">{state.copied.toLocaleString("en-IN")} copied · {state.verified.toLocaleString("en-IN")} verified · {state.total.toLocaleString("en-IN")} expected</p>
        {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}<p className="mt-3 text-xs text-gray-500">{state.consistency}. Original TTL definitions are retained in the manifest; expiration is disabled on the clone. No application connections are switched.</p>
        <div className="mt-4 max-h-80 overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-gray-50"><tr><th className="p-3">Collection</th><th className="p-3">Phase</th><th className="p-3 text-right">Copied</th><th className="p-3 text-right">Verified</th></tr></thead><tbody>{state.collections.map(item => <tr key={item.name} className="border-t"><td className="p-3">{item.name}</td><td className="p-3 capitalize">{item.phase}</td><td className="p-3 text-right">{item.copied} / {item.count}</td><td className="p-3 text-right">{item.verified}</td></tr>)}</tbody></table></div>
      </section>}
      {state?.status === "verified" && <Link href="/admin/catalogue-quality" className="inline-flex rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-blue-900">View catalogue quality</Link>}
    </>}
  </div>
}
