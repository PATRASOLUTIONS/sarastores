"use client"

import { useEffect, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { z } from "zod"
import { toast } from "react-hot-toast"
import { Download, Upload, Trash2, X } from "lucide-react"
import { apiFetch, apiFetchJson } from "@/lib/api-client"
import { PincodeEntrySchema, PincodeRestrictionsResponseSchema } from "@/lib/validation"
import { normalizePincodeEntry, type PincodeEntry, type PincodeListType, type PincodeMode } from "@/lib/pincode-policy"

const MODES: { value: PincodeMode; label: string; description: string }[] = [
  { value: "blocked", label: "Blocked List", description: "Block listed pincodes. Keep the current Bangalore/Mysore delivery area." },
  { value: "allowed", label: "Allowed List", description: "Only listed pincodes can order within the current delivery area." },
  { value: "both", label: "Both Lists", description: "Require the allowed list and exclude the blocked list." },
  { value: "all", label: "Allow all pincodes", description: "Deliver across India. Ignore both lists and the Bangalore/Mysore restriction." },
]
const LISTS: PincodeListType[] = ["blocked", "allowed"]
const PAGE_SIZE = 100
const emptyDraft = () => ({ pincode: "", name: "", state: "" })
const successSchema = z.object({ success: z.literal(true) })
const importSchema = successSchema.extend({ imported: z.number().int().positive(), duplicateRows: z.number().int().nonnegative() })

export default function BlockedPincodesPage() {
  const [lists, setLists] = useState<Record<PincodeListType, PincodeEntry[]>>({ blocked: [], allowed: [] })
  const [mode, setMode] = useState<PincodeMode>("blocked")
  const [drafts, setDrafts] = useState({ blocked: emptyDraft(), allowed: emptyDraft() })
  const [selected, setSelected] = useState<Record<PincodeListType, string[]>>({ blocked: [], allowed: [] })
  const [search, setSearch] = useState({ blocked: "", allowed: "" })
  const [pages, setPages] = useState({ blocked: 0, allowed: 0 })
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busy, setBusy] = useState(false)
  const [uploadList, setUploadList] = useState<PincodeListType | null>(null)
  const mutation = useRef(false)
  const busyControls = loading || loadFailed || busy

  async function fetchPincodes() {
    setLoading(true)
    try {
      const data = await apiFetchJson("/api/blocked-pincodes", {}, value => PincodeRestrictionsResponseSchema.parse(value))
      setLists({
        blocked: data.blockedPincodes.map(normalizePincodeEntry),
        allowed: data.allowedPincodes.map(normalizePincodeEntry),
      })
      setMode(data.mode)
      setSelected({ blocked: [], allowed: [] })
      setPages({ blocked: 0, allowed: 0 })
      setLoadFailed(false)
    } catch (cause) {
      console.error("[Pincode Management] Load failed:", cause)
      setLoadFailed(true)
      setError("Pincodes could not be loaded. Retry before changing settings.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchPincodes() }, [])

  async function mutate(action: () => Promise<string>) {
    if (mutation.current || busyControls) return
    mutation.current = true
    setBusy(true)
    setError("")
    setSuccess("")
    try {
      const message = await action()
      setSuccess(message)
      toast.success(message)
      await fetchPincodes()
    } catch (cause) {
      console.error("[Pincode Management] Change failed:", cause)
      const message = cause instanceof Error ? cause.message : "Pincode settings could not be updated."
      setError(message)
      toast.error(message)
    } finally {
      mutation.current = false
      setBusy(false)
    }
  }

  function updateMode(next: PincodeMode) {
    if (next === mode) return
    if (next === "all" && !window.confirm("Allow delivery to all valid Indian pincodes, including outside Bangalore and Mysore? Saved allowed and blocked lists will be kept but ignored.")) return
    void mutate(async () => {
      await apiFetchJson("/api/blocked-pincodes", { method: "POST", json: { mode: next } }, value => successSchema.parse(value))
      return `Delivery mode changed to ${MODES.find(item => item.value === next)?.label}.`
    })
  }

  function addPincode(listType: PincodeListType) {
    const parsed = PincodeEntrySchema.safeParse({ ...drafts[listType], pincode: drafts[listType].pincode.trim() })
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    void mutate(async () => {
      await apiFetchJson("/api/blocked-pincodes", { method: "POST", json: { ...parsed.data, listType } }, value => successSchema.parse(value))
      setDrafts(previous => ({ ...previous, [listType]: emptyDraft() }))
      return `${parsed.data.pincode} saved to the ${listType} list.`
    })
  }

  function removePincodes(listType: PincodeListType, pincodes: string[] | "all") {
    if (pincodes !== "all" && !pincodes.length) return
    const clear = pincodes === "all"
    if ((clear || pincodes.length > 1) && !window.confirm(clear
      ? `Remove every pincode from the ${listType} list? This cannot be undone. The active delivery mode will not change.`
      : `Remove ${pincodes.length} selected pincodes from the ${listType} list?`)) return
    void mutate(async () => {
      await apiFetchJson("/api/blocked-pincodes", {
        method: "DELETE", json: clear ? { clear: true, listType } : { pincodes, listType },
      }, value => successSchema.parse(value))
      return clear ? `The ${listType} list was cleared.` : `${pincodes.length} pincode(s) removed from the ${listType} list.`
    })
  }

  function downloadTemplate() {
    try {
      const sheet = XLSX.utils.json_to_sheet([
        { Pincode: "110001", Name: "Connaught Place", State: "Delhi" },
        { Pincode: "400001", Name: "Fort", State: "Maharashtra" },
        { Pincode: "560001", Name: "Bangalore GPO", State: "Karnataka" },
      ])
      sheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 24 }]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Pincodes")
      XLSX.writeFile(workbook, "pincodes_import_template.xlsx")
    } catch (cause) {
      console.error("[Pincode Management] Template failed:", cause)
      toast.error("The Excel template could not be downloaded.")
    }
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    const listType = uploadList
    if (!file || !listType) return
    if (!/\.xlsx?$/i.test(file.name) || file.size > 3 * 1024 * 1024) {
      setError("Choose an .xlsx or .xls file no larger than 3 MB.")
      input.value = ""
      return
    }
    await mutate(async () => {
      const form = new FormData()
      form.set("file", file)
      form.set("listType", listType)
      const response = await apiFetch("/api/blocked-pincodes/import", { method: "POST", body: form })
      const body: unknown = await response.json()
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(body)
        throw new Error(failure.success ? failure.data.error : "The Excel import failed. Nothing was imported.")
      }
      const result = importSchema.parse(body)
      setUploadList(null)
      return `Imported ${result.imported} unique pincodes into the ${listType} list. ${result.duplicateRows} duplicate row(s) merged.`
    })
    input.value = ""
  }

  return <div className="mx-auto max-w-6xl p-6 md:p-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold">Pincode Management</h1>
      <button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded border px-4 py-2">
        <Download size={18} /> Download Excel format
      </button>
    </div>
    {error && <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-800">
      {error} {loadFailed && <button type="button" className="underline" disabled={loading} onClick={() => { setError(""); void fetchPincodes() }}>Retry</button>}
    </div>}
    {success && <p role="status" className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-green-800">{success}</p>}
    {loading && <p role="status" className="mb-4">Loading pincode settings...</p>}

    <fieldset disabled={busyControls} className="mb-8 rounded-lg bg-white p-6 shadow">
      <legend className="px-2 text-xl font-semibold">Active delivery mode</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {MODES.map(option => <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded border p-3">
          <input type="radio" name="pincodeMode" value={option.value} checked={mode === option.value} onChange={() => updateMode(option.value)} className="mt-1" />
          <span><strong className="block">{option.label}</strong><span className="text-sm text-slate-600">{option.description}</span></span>
        </label>)}
      </div>
      <p className="mt-4 text-sm text-slate-600">Changing modes never deletes your saved lists. Imports do not change the active mode.</p>
      {mode === "all" && <p className="mt-3 font-medium text-green-800">All valid Indian pincodes are currently allowed, even entries in the blocked list.</p>}
      {!loading && !loadFailed && (mode === "allowed" || mode === "both") && !lists.allowed.length &&
        <p role="status" className="mt-3 font-medium text-amber-800">The allowed list is empty, so delivery is unavailable in this mode. Add pincodes or choose Allow all pincodes.</p>}
    </fieldset>

    <div className="grid gap-6 md:grid-cols-2">
      {LISTS.map(listType => {
        const label = listType === "allowed" ? "Allowed" : "Blocked"
        const query = search[listType].trim().toLowerCase()
        const matches = lists[listType].filter(entry => [entry.pincode, entry.name, entry.state].some(value => value.toLowerCase().includes(query)))
        const page = pages[listType]
        const entries = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        const selectedCodes = selected[listType]
        return <section key={listType} aria-label={`${label} Pincodes`} className="rounded-lg bg-white p-5 shadow">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{label} Pincodes ({lists[listType].length})</h2>
            <button type="button" disabled={busyControls} onClick={() => { setError(""); setUploadList(listType) }}
              className="flex items-center gap-2 rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"><Upload size={16} /> Import Excel</button>
          </header>
          <fieldset disabled={busyControls} className="mb-4 space-y-2">
            {(["pincode", "name", "state"] as const).map(field => <label key={field} className="block text-sm">
              {field === "pincode" ? "Pincode (required)" : field === "name" ? "Area / locality (optional)" : "State (optional)"}
              <input aria-label={`${label} ${field}`} value={drafts[listType][field]} maxLength={field === "pincode" ? 6 : field === "name" ? 200 : 100}
                inputMode={field === "pincode" ? "numeric" : undefined}
                onChange={event => setDrafts(previous => ({ ...previous, [listType]: { ...previous[listType], [field]: event.target.value } }))}
                className="mt-1 w-full rounded border px-3 py-2" />
            </label>)}
            <button type="button" onClick={() => addPincode(listType)} className="w-full rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50">Add to {label} List</button>
          </fieldset>
          <label className="mb-3 block text-sm">Search {listType} pincodes
            <input type="search" value={search[listType]} onChange={event => {
              setSearch(previous => ({ ...previous, [listType]: event.target.value }))
              setPages(previous => ({ ...previous, [listType]: 0 }))
            }}
              className="mt-1 w-full rounded border px-3 py-2" placeholder="Pincode, area or state" />
          </label>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" disabled={busyControls || !entries.length}
              checked={entries.length > 0 && entries.every(entry => selectedCodes.includes(entry.pincode))}
              onChange={event => setSelected(previous => ({ ...previous, [listType]: event.target.checked
                ? [...new Set([...previous[listType], ...entries.map(entry => entry.pincode)])]
                : previous[listType].filter(pin => !entries.some(entry => entry.pincode === pin)) }))} /> Select shown</label>
            <button type="button" disabled={busyControls || !selectedCodes.length} onClick={() => removePincodes(listType, selectedCodes)}
              className="text-red-700 underline disabled:opacity-40">Remove selected ({selectedCodes.length})</button>
            <button type="button" disabled={busyControls || !lists[listType].length} onClick={() => removePincodes(listType, "all")}
              className="text-red-700 underline disabled:opacity-40">Clear {listType} list</button>
          </div>
          <ul className="max-h-96 divide-y overflow-y-auto">
            {entries.map(entry => <li key={entry.pincode} className="flex items-start gap-3 py-3">
              <input type="checkbox" aria-label={`Select ${entry.pincode} in ${listType} list`} disabled={busyControls}
                checked={selectedCodes.includes(entry.pincode)}
                onChange={event => setSelected(previous => ({ ...previous, [listType]: event.target.checked
                  ? [...previous[listType], entry.pincode] : previous[listType].filter(pin => pin !== entry.pincode) }))} className="mt-1" />
              <div className="min-w-0 flex-1"><strong className="font-mono">{entry.pincode}</strong>
                {entry.name && <p className="text-sm text-slate-700">{entry.name}</p>}
                {entry.state && <p className="text-xs text-slate-500">{entry.state}</p>}</div>
              <button type="button" disabled={busyControls} onClick={() => removePincodes(listType, [entry.pincode])}
                aria-label={`Remove ${entry.pincode} from ${listType} list`} className="flex items-center gap-1 text-sm text-red-700 disabled:opacity-40"><Trash2 size={14} /> Remove</button>
            </li>)}
            {!entries.length && <li className="py-6 text-center text-slate-500">{query ? "No matching pincodes" : `No ${listType} pincodes`}</li>}
          </ul>
          {matches.length > PAGE_SIZE && <nav aria-label={`${label} pincode pages`} className="mt-3 flex items-center justify-between gap-3 text-sm">
            <button type="button" disabled={busyControls || page === 0}
              onClick={() => setPages(previous => ({ ...previous, [listType]: page - 1 }))} className="underline disabled:opacity-40">Previous</button>
            <span>{page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, matches.length)} of {matches.length}</span>
            <button type="button" disabled={busyControls || (page + 1) * PAGE_SIZE >= matches.length}
              onClick={() => setPages(previous => ({ ...previous, [listType]: page + 1 }))} className="underline disabled:opacity-40">Next</button>
          </nav>}
        </section>
      })}
    </div>

    {uploadList && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="pincode-import-heading" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="pincode-import-heading" className="text-xl font-semibold">Import {uploadList} pincodes</h2>
          <button type="button" disabled={busy} aria-label="Close Excel import" onClick={() => setUploadList(null)}><X size={22} /></button>
        </header>
        <p className="mb-3 text-sm text-slate-600">First worksheet, headers in row 1. Pincode is required; Name and State are optional.</p>
        <table className="mb-4 w-full border-collapse text-sm">
          <thead><tr>{["Pincode", "Name", "State"].map(header => <th key={header} className="border p-2 text-left">{header}</th>)}</tr></thead>
          <tbody><tr><td className="border p-2">560001</td><td className="border p-2">Bangalore GPO</td><td className="border p-2">Karnataka</td></tr></tbody>
        </table>
        <button type="button" onClick={downloadTemplate} className="mb-4 flex items-center gap-2 text-blue-700 underline"><Download size={16} /> Download Excel format</button>
        <p className="mb-4 text-sm text-slate-600">Use six-digit pincodes as text or whole numbers. Up to 20,000 data rows and 3 MB. Existing entries are updated, not duplicated; the last duplicate row wins. If any row is invalid, nothing is imported. Lists and delivery mode are never replaced by an import.</p>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        <label className="block text-sm font-medium">Excel file (.xlsx or .xls)
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={event => void importFile(event)}
            className="mt-2 block w-full rounded border p-2" />
        </label>
        {busy && <p role="status" className="mt-3">Importing pincodes...</p>}
      </section>
    </div>}
  </div>
}
