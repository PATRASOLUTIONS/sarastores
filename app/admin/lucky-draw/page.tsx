"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import {
  Gift, Plus, Trash2, Upload, Link2, Copy, Play, Pause, CheckCircle2,
  Users, Trophy, RefreshCw, Store, Loader2, ExternalLink, Download,
} from "lucide-react"
import { apiFetch } from "@/lib/api-client"

type Prize = { name: string; icon: string; quantity: number | string }
type Campaign = {
  id: string
  name: string
  store: string
  storeId?: string | null
  prizes: Prize[]
  status: "draft" | "active" | "paused" | "completed"
  drawToken: string
  participantCount?: number
  winnerCount?: number
  createdAt: string
}
type Participant = { id: string; name: string; phone: string; email: string; wonAt?: string | null }
type Winner = {
  id: string
  participantName: string
  participantPhone: string
  participantEmail: string
  prize: string
  prizeIcon: string
  drawnAt: string
  emailSent?: boolean
}

const STATUS_STYLES: Record<Campaign["status"], string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
}

const EMPTY_PRIZE: Prize = { name: "", icon: "🎁", quantity: 1 }

export default function AdminLuckyDrawPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stores, setStores] = useState<{ id: string; shopName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ participants: Participant[]; winners: Winner[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState<{ name: string; store: string; storeId: string; prizes: Prize[] }>({
    name: "",
    store: "",
    storeId: "",
    prizes: [{ ...EMPTY_PRIZE }],
  })
  const [csv, setCsv] = useState("")
  const [replaceList, setReplaceList] = useState(false)

  const selected = useMemo(() => campaigns.find((c) => c.id === selectedId) || null, [campaigns, selectedId])

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/lucky-draw")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setCampaigns(data.campaigns || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStores = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/store-locations")
      const data = await res.json()
      const list = (data.stores || data || []).filter((s: any) => s.isActive !== false)
      setStores(list.map((s: any) => ({ id: s.id || s._id, shopName: s.shopName })))
    } catch {
      // store list is optional — a free-text store name still works
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/lucky-draw/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setDetail({ participants: data.participants || [], winners: data.winners || [] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load campaign")
    }
  }, [])

  useEffect(() => {
    loadCampaigns()
    loadStores()
  }, [loadCampaigns, loadStores])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  const createCampaign = async () => {
    if (!form.name.trim() || !form.store.trim()) {
      toast.error("Campaign name and store are required")
      return
    }
    const prizes = form.prizes.filter((p) => p.name.trim())
    if (prizes.length === 0) {
      toast.error("Add at least one prize")
      return
    }

    setBusy(true)
    try {
      const res = await apiFetch("/api/admin/lucky-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, storeId: form.storeId || null, prizes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create")
      toast.success("Campaign created")
      setForm({ name: "", store: "", storeId: "", prizes: [{ ...EMPTY_PRIZE }] })
      await loadCampaigns()
      setSelectedId(data.campaign.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create campaign")
    } finally {
      setBusy(false)
    }
  }

  const patchCampaign = async (id: string, body: Record<string, unknown>, message?: string) => {
    setBusy(true)
    try {
      const res = await apiFetch(`/api/admin/lucky-draw/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      if (message) toast.success(message)
      await loadCampaigns()
      if (selectedId === id) await loadDetail(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update campaign")
    } finally {
      setBusy(false)
    }
  }

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign along with its participants and winners?")) return
    setBusy(true)
    try {
      const res = await apiFetch(`/api/admin/lucky-draw/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Campaign deleted")
      if (selectedId === id) setSelectedId(null)
      await loadCampaigns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete campaign")
    } finally {
      setBusy(false)
    }
  }

  const uploadParticipants = async () => {
    if (!selectedId || !csv.trim()) {
      toast.error("Paste or upload a customer list first")
      return
    }
    setBusy(true)
    try {
      const res = await apiFetch(`/api/admin/lucky-draw/${selectedId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, replace: replaceList }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      toast.success(`${data.inserted} added · ${data.duplicates} duplicates · ${data.skipped} skipped`)
      setCsv("")
      await loadCampaigns()
      await loadDetail(selectedId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ""))
    reader.readAsText(file)
  }

  const drawUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/lucky-draw/draw/${token}` : ""

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(drawUrl(token))
      toast.success("Draw link copied")
    } catch {
      toast.error("Could not copy — select the link manually")
    }
  }

  const exportWinners = () => {
    if (!detail?.winners.length) return
    const header = "Name,Phone,Email,Prize,Drawn At,Email Sent"
    const rows = detail.winners.map((w) =>
      [w.participantName, w.participantPhone, w.participantEmail, w.prize,
        new Date(w.drawnAt).toLocaleString(), w.emailSent ? "yes" : "no"]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `winners-${selected?.name || "campaign"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updatePrize = (index: number, patch: Partial<Prize>) => {
    setForm((f) => ({ ...f, prizes: f.prizes.map((p, i) => (i === index ? { ...p, ...patch } : p)) }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="h-6 w-6 text-red-600" /> Lucky Draw
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a per-store draw, upload the customer list, then share the draw link.
          </p>
        </div>
        <button
          onClick={loadCampaigns}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ---------------- create ---------------- */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Plus className="h-4 w-4" /> New campaign
          </h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Campaign name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Diwali Mega Draw"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Store className="h-3 w-3 inline mr-1" /> Store
            </label>
            <select
              value={form.storeId}
              onChange={(e) => {
                const store = stores.find((s) => s.id === e.target.value)
                setForm((f) => ({ ...f, storeId: e.target.value, store: store?.shopName || f.store }))
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="">— Select a store —</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.shopName}</option>
              ))}
            </select>
            <input
              value={form.store}
              onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
              placeholder="or type a store name"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Prizes for this store</label>
              <button
                onClick={() => setForm((f) => ({ ...f, prizes: [...f.prizes, { ...EMPTY_PRIZE }] }))}
                className="text-xs text-red-600 hover:underline"
              >
                + Add prize
              </button>
            </div>
            <div className="space-y-2">
              {form.prizes.map((prize, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={prize.icon}
                    onChange={(e) => updatePrize(i, { icon: e.target.value })}
                    className="w-14 border rounded-lg px-2 py-2 text-center text-lg"
                    aria-label="Prize icon"
                  />
                  <input
                    value={prize.name}
                    onChange={(e) => updatePrize(i, { name: e.target.value })}
                    placeholder="Prize name"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={prize.quantity}
                    onChange={(e) => updatePrize(i, { quantity: e.target.value })}
                    className="w-20 border rounded-lg px-2 py-2 text-sm"
                    aria-label="Quantity"
                  />
                  {form.prizes.length > 1 && (
                    <button
                      onClick={() => setForm((f) => ({ ...f, prizes: f.prizes.filter((_, j) => j !== i) }))}
                      className="px-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={createCampaign}
            disabled={busy}
            className="w-full bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Create campaign"}
          </button>
        </div>

        {/* ---------------- list ---------------- */}
        <div className="xl:col-span-2 space-y-4">
          {campaigns.length === 0 && (
            <div className="bg-white rounded-xl border p-10 text-center text-gray-500">
              No campaigns yet. Create one to get started.
            </div>
          )}

          {campaigns.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-xl border p-5 transition ${selectedId === c.id ? "ring-2 ring-red-500" : "hover:border-gray-300"}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                    <Store className="h-3.5 w-3.5" /> {c.store}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.participantCount ?? 0} customers</span>
                    <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> {c.winnerCount ?? 0} winners</span>
                    <span className="inline-flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5" />
                      {c.prizes.reduce((s, p) => s + (Number(p.quantity) || 0), 0)} prizes left
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {c.status !== "active" ? (
                    <button
                      onClick={() => patchCampaign(c.id, { status: "active" }, "Draw is live")}
                      disabled={busy}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" /> Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => patchCampaign(c.id, { status: "paused" }, "Draw paused")}
                      disabled={busy}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  )}
                  <button
                    onClick={() => patchCampaign(c.id, { status: "completed" }, "Marked complete")}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Close
                  </button>
                  <button
                    onClick={() => deleteCampaign(c.id)}
                    disabled={busy}
                    className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {c.prizes.map((p, i) => (
                  <span key={i} className="text-xs bg-gray-50 border rounded-full px-2.5 py-1">
                    {p.icon} {p.name} × {p.quantity}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                <Link2 className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  readOnly
                  value={drawUrl(c.drawToken)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 bg-transparent text-xs text-gray-700 outline-none"
                />
                <button onClick={() => copyLink(c.drawToken)} className="p-1 text-gray-500 hover:text-red-600" title="Copy link">
                  <Copy className="h-4 w-4" />
                </button>
                <a href={drawUrl(c.drawToken)} target="_blank" rel="noreferrer" className="p-1 text-gray-500 hover:text-red-600" title="Open draw screen">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <button
                onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                className="mt-3 text-sm text-red-600 hover:underline"
              >
                {selectedId === c.id ? "Hide details" : "Manage customers & winners"}
              </button>

              {selectedId === c.id && (
                <div className="mt-4 border-t pt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                      <Upload className="h-4 w-4" /> Upload customer list
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">
                      CSV with a <code>name,phone,email</code> header, or paste rows directly.
                    </p>
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                      className="block w-full text-xs mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700"
                    />
                    <textarea
                      value={csv}
                      onChange={(e) => setCsv(e.target.value)}
                      rows={6}
                      placeholder={"name,phone,email\nRahul Kumar,9876543210,rahul@example.com"}
                      className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                      <input type="checkbox" checked={replaceList} onChange={(e) => setReplaceList(e.target.checked)} />
                      Replace the existing list
                    </label>
                    <button
                      onClick={uploadParticipants}
                      disabled={busy}
                      className="mt-2 w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-black disabled:opacity-50"
                    >
                      Upload customers
                    </button>

                    {detail && (
                      <p className="text-xs text-gray-500 mt-2">
                        {detail.participants.length} in list ·{" "}
                        {detail.participants.filter((p) => !p.wonAt).length} still eligible
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Trophy className="h-4 w-4" /> Winners
                      </h4>
                      {!!detail?.winners.length && (
                        <button onClick={exportWinners} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" /> Export CSV
                        </button>
                      )}
                    </div>
                    <div className="border rounded-lg divide-y max-h-72 overflow-auto">
                      {!detail?.winners.length && (
                        <p className="text-xs text-gray-500 p-4 text-center">No winners drawn yet.</p>
                      )}
                      {detail?.winners.map((w) => (
                        <div key={w.id} className="p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900">{w.participantName}</span>
                            <span className="text-gray-500">{w.prizeIcon} {w.prize}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1 text-gray-500">
                            <span>{w.participantEmail || w.participantPhone || "—"}</span>
                            <span className={w.emailSent ? "text-green-600" : "text-amber-600"}>
                              {w.emailSent ? "email sent" : "no email"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
