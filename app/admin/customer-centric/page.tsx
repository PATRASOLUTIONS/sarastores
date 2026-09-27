"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, useCallback } from "react"
import PROMO_TEMPLATES, { PromoTemplate } from "@/lib/promoTemplates"
import * as XLSX from "xlsx"
import toast from "react-hot-toast"
import {
  Mail, Eye, Send, Users, FileText, CheckCircle, Clock,
  Upload, ChevronDown, ChevronRight, ArrowLeft, ArrowRight,
  Trash2, Plus, RefreshCw, Search, Download, X, Loader2,
  BarChart3, Calendar, AlertCircle, Image as ImageIcon, Code
} from "lucide-react"
import dynamic from "next/dynamic"

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), { ssr: false })

type LocalTemplate = PromoTemplate & { image?: string; _id?: string }

interface Recip {
  id: string
  name?: string
  email?: string
  phone?: string
  selected?: boolean
  totalOrders?: number
  totalSpent?: number
  source?: string
  segments?: string[]
  tier?: string | null
  lifecycle?: string | null
}

interface SegmentOption {
  key: string
  label: string
  description: string
  intent: string
  count: number
}

interface SegmentGroup {
  group: string
  label: string
  segments: SegmentOption[]
}

interface LibraryTemplate {
  id: string
  name: string
  category: string
  segments: string[]
  occasion: string | null
  subject: string
  preheader: string
  recommended: boolean
  whatsapp: { templateName: string; bodyParams: string[]; preview: string }
}

interface CampaignHistory {
  _id: string
  templateName: string
  subject: string
  recipientCount: number
  sent: number
  failed: number
  segment: string
  sentAt: string
}

const STEPS = [
  { id: 1, label: "Pick Template", icon: FileText },
  { id: 2, label: "Edit Content", icon: Mail },
  { id: 3, label: "Choose Recipients", icon: Users },
  { id: 4, label: "Preview & Send", icon: Send },
]

export default function CustomerCentricIndex() {
  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  const [mounted, setMounted] = useState(false)

  // Template state
  const [templates, setTemplates] = useState<LocalTemplate[]>(PROMO_TEMPLATES as LocalTemplate[])
  const [selected, setSelected] = useState<LocalTemplate | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Editor state
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [attachImage, setAttachImage] = useState(true)
  const [templateName, setTemplateName] = useState("")
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [showRawHtml, setShowRawHtml] = useState(false)

  // Recipients state
  const [segment, setSegment] = useState("all")
  const [segmentGroups, setSegmentGroups] = useState<SegmentGroup[]>([])
  const [channel, setChannel] = useState<"email" | "whatsapp">("email")
  const [library, setLibrary] = useState<LibraryTemplate[]>([])
  const [libraryCategory, setLibraryCategory] = useState<string>("all")
  const [waPlan, setWaPlan] = useState<any>(null)
  const [loadingWaPlan, setLoadingWaPlan] = useState(false)
  const [users, setUsers] = useState<Recip[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectAll, setSelectAll] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Campaign state
  const [sending, setSending] = useState(false)
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Batch sending progress
  const [sendProgress, setSendProgress] = useState<{
    totalRecipients: number
    totalBatches: number
    currentBatch: number
    sent: number
    failed: number
    status: 'idle' | 'sending' | 'delaying' | 'complete'
    delaySeconds: number
    nextBatch: number
  } | null>(null)

  // Preview modal
  const [showPreview, setShowPreview] = useState(false)

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false)

  // ─── Load segment taxonomy with live counts ───────────────────────────
  const fetchSegments = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/segments")
      if (!res.ok) return
      const data = await res.json()
      setSegmentGroups(Array.isArray(data?.groups) ? data.groups : [])
    } catch (e) {
      console.error("Failed to load segments", e)
    }
  }, [])

  // ─── Load the built-in campaign library, ranked for the chosen audience ──
  const fetchLibrary = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/admin/marketing/templates?segment=${encodeURIComponent(segment)}`)
      if (!res.ok) return
      const data = await res.json()
      setLibrary(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      console.error("Failed to load campaign library", e)
    }
  }, [segment])

  // ─── Load templates from DB ───────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const res = await apiFetch("/api/admin/email-templates")
      if (!res.ok) return
      const data = await res.json().catch(() => [])
      const list: LocalTemplate[] = (data || []).map((t: any) => ({
        id: t.id || t._id || t.name || String(Math.random()),
        _id: t._id || t.id,
        name: t.name || "",
        subject: t.subject || "",
        html: t.html || "",
        image: t.image || "",
      }))
      if (list.length) {
        setTemplates(list)
      }
    } catch (e) {
      console.error("Failed to load templates", e)
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  // ─── Load campaign history ────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await apiFetch("/api/admin/campaign-history")
      if (res.ok) {
        const data = await res.json().catch(() => [])
        setCampaignHistory(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Failed to load history", e)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // ─── Load users for segment ───────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await apiFetch(`/api/admin/campaign-recipients?segment=${encodeURIComponent(segment)}&channel=${channel}&limit=500`)
      if (!res.ok) {
        setUsers([])
        return
      }
      const data = await res.json().catch(() => [])
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      const normalized: Recip[] = list.map((u: any) => ({
        id: u.id || u._id || u.userId || String(Math.random()),
        name: u.name || u.fullName || u.email,
        email: u.email || "",
        phone: u.phone || u.mobile || "",
        selected: false,
        totalOrders: u.totalOrders || 0,
        totalSpent: u.totalSpent || 0,
        source: u.source || "unknown",
        segments: Array.isArray(u.segments) ? u.segments : [],
        tier: u.tier ?? null,
        lifecycle: u.lifecycle ?? null,
      }))
      setUsers(normalized)
      setSelectAll(false)
    } catch (e) {
      console.error("Failed to fetch users", e)
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }, [segment, channel])

  useEffect(() => {
    fetchTemplates()
    fetchHistory()
    fetchSegments()
    setMounted(true)
  }, [fetchTemplates, fetchHistory, fetchSegments])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  const segmentLabel = useCallback(
    (key: string) => {
      for (const g of segmentGroups) {
        const hit = g.segments.find((s) => s.key === key)
        if (hit) return hit.label
      }
      return key.replace(/_/g, " ")
    },
    [segmentGroups],
  )

  useEffect(() => {
    if (currentStep === 3) fetchUsers()
  }, [currentStep, segment, channel, fetchUsers])

  // ─── Template selection ───────────────────────────────────────────────
  const selectTemplate = (t: LocalTemplate) => {
    setSelected(t)
    setSubject(t.subject)
    setHtml(t.html)
    setTemplateName(t.name)
    setImageUrl(t.image || "")
  }

  const createNewTemplate = () => {
    const blank: LocalTemplate = {
      id: "new-" + Date.now(),
      name: "New Template",
      subject: "Subject line for {{name}}",
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:30px"><h2 style="color:#111827;margin-top:0">Hello {{name}},</h2><p style="color:#374151;line-height:1.6">Write your message here...</p><p style="text-align:center;margin:24px 0"><a href="#" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Call to Action</a></p></div></body></html>`,
      image: "",
    }
    setSelected(blank)
    setSubject(blank.subject)
    setHtml(blank.html)
    setTemplateName(blank.name)
    setImageUrl("")
  }

  // ─── Save template ────────────────────────────────────────────────────
  const saveTemplate = async () => {
    if (!selected) return
    try {
      const payload = {
        name: templateName || selected.name,
        subject,
        html,
        image: imageUrl || "",
      }

      if (selected._id) {
        // Update existing
        const res = await apiFetch(`/api/admin/email-templates/${selected._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to update")
        toast.success("Template updated")
      } else {
        // Create new
        const res = await apiFetch("/api/admin/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Failed to create")
        toast.success("Template saved")
      }
      await fetchTemplates()
    } catch (e) {
      console.error(e)
      toast.error("Failed to save template")
    }
  }

  // ─── Delete template ──────────────────────────────────────────────────
  const deleteTemplate = async (t: LocalTemplate) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    try {
      const id = t._id || t.id
      const res = await apiFetch(`/api/admin/email-templates/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Template deleted")
      if (selected?.id === t.id) {
        setSelected(null)
        setSubject("")
        setHtml("")
        setTemplateName("")
      }
      await fetchTemplates()
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete template")
    }
  }

  // ─── Recipient management ─────────────────────────────────────────────
  const toggleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    setUsers((prev) => prev.map((u) => ({ ...u, selected: checked })))
  }

  const toggleUser = (id: string) => {
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u))
      setSelectAll(next.every((u) => u.selected))
      return next
    })
  }

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").includes(q)
    )
  })

  const selectedCount = users.filter((u) => u.selected).length

  // ─── Excel import ─────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingUsers(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheet = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheet]
      const json = XLSX.utils.sheet_to_json<any>(worksheet)

      const mapped = json
        .map((row: any, i: number) => {
          const email = row.Email || row.email || row.EMAIL || row["Email Address"] || ""
          const name = row.Name || row.name || row.NAME || row["First Name"] || row["Full Name"] || ""
          const phone = row.Phone || row.phone || row.Mobile || ""
          return { id: `excel-${Date.now()}-${i}`, name: name || "Customer", email, phone, selected: true }
        })
        .filter((u: any) => u.email)

      if (mapped.length === 0) {
        toast.error("No valid rows with an 'Email' column found")
        return
      }

      setUsers((prev) => [...mapped, ...prev])
      setSelectAll(true)
      toast.success(`Imported ${mapped.length} recipients`)
      setShowImportModal(false)
    } catch (err) {
      console.error("Excel parse error:", err)
      toast.error("Failed to parse the file")
    } finally {
      setLoadingUsers(false)
      e.target.value = ""
    }
  }

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        Name: "Naba",
        Email: "nabaratanpatra@gmail.com",
        Phone: "8332936831",
      },
      {
        Name: "Rahul Kumar",
        Email: "rahul@example.com",
        Phone: "9876543210",
      },
      {
        Name: "Priya Sharma",
        Email: "priya@example.com",
        Phone: "7890123456",
      },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Recipients")
    XLSX.writeFile(wb, "campaign-recipients-sample.xlsx")
    toast.success("Sample file downloaded")
  }

  // ─── Send campaign ────────────────────────────────────────────────────
  const sendCampaign = async (toAll: boolean = false) => {
    if (!selected) return toast.error("Please select a template")

    const recipients = toAll ? users : users.filter((u) => u.selected)
    if (recipients.length === 0) return toast.error("Please select at least one recipient")

    const confirmed = confirm(
      `Send "${templateName || selected.name}" to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}?\n\nEmails will be sent in batches of 50 with a 30-second delay between batches to avoid spam filters.`
    )
    if (!confirmed) return

    setSending(true)
    setSendProgress({
      totalRecipients: recipients.length,
      totalBatches: Math.ceil(recipients.length / 50),
      currentBatch: 0,
      sent: 0,
      failed: 0,
      status: "sending",
      delaySeconds: 30,
      nextBatch: 1,
    })

    try {
      const customUsers = recipients.filter((u) => u.id.startsWith("excel-"))
      const dbUserIds = recipients.filter((u) => !u.id.startsWith("excel-")).map((u) => u.id)

      const res = await apiFetch("/api/admin/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected._id || selected.id,
          subject,
          html,
          attachImage,
          userIds: dbUserIds,
          customUsers: customUsers.length > 0 ? customUsers : undefined,
          segment,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to send")
      }

      // Read streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)

              if (event.type === "start") {
                setSendProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        totalRecipients: event.totalRecipients,
                        totalBatches: event.totalBatches,
                      }
                    : prev
                )
              } else if (event.type === "batch_start") {
                setSendProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentBatch: event.batch,
                        status: "sending",
                      }
                    : prev
                )
              } else if (event.type === "batch_complete") {
                setSendProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        sent: event.sent,
                        failed: event.failed,
                      }
                    : prev
                )
              } else if (event.type === "batch_delay") {
                setSendProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: "delaying",
                        delaySeconds: event.delaySeconds,
                        nextBatch: event.nextBatch,
                      }
                    : prev
                )
              } else if (event.type === "complete") {
                setSendProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        sent: event.sent,
                        failed: event.failed,
                        status: "complete",
                      }
                    : prev
                )
                toast.success(`Campaign sent! ${event.sent} delivered, ${event.failed} failed`)
                await fetchHistory()
                setTimeout(() => {
                  setCurrentStep(1)
                  setSelected(null)
                  setSubject("")
                  setHtml("")
                  setTemplateName("")
                  setSendProgress(null)
                }, 2000)
              }
            } catch (e) {
              // ignore parse errors for incomplete lines
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to send campaign")
      setSendProgress(null)
    } finally {
      setSending(false)
    }
  }

  // ─── Live preview with personalization ────────────────────────────────
  const getPreviewHtml = (forName?: string) => {
    const name = forName || "Customer"
    return html.replace(/\{\{\s*name\s*\}\}/gi, name)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Mail className="h-6 w-6 text-blue-600" />
              Email Campaigns
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create, customize, and send promotional emails to your customers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchHistory()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ─── Step Indicator ────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => {
                      if (isCompleted || isActive) setCurrentStep(step.id)
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md"
                        : isCompleted
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-400 cursor-default"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isActive
                          ? "bg-white text-blue-600"
                          : isCompleted
                            ? "bg-green-500 text-white"
                            : "bg-gray-300 text-white"
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="h-5 w-5" /> : step.id}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className={`text-xs font-medium ${isActive ? "text-blue-100" : ""}`}>
                        Step {step.id}
                      </div>
                      <div className={`text-sm font-semibold ${isActive ? "" : ""}`}>{step.label}</div>
                    </div>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 mx-2">
                      <div
                        className={`h-0.5 ${
                          currentStep > step.id ? "bg-green-400" : "bg-gray-200"
                        }`}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            STEP 1: Pick Template
           ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 1 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Choose a Template</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setLoadingTemplates(true)
                    apiFetch("/api/admin/email-templates/seed", { method: "POST" }).then(async (r) => {
                      const d = await r.json().catch(() => ({}))
                      fetchTemplates()
                      toast.success(`Loaded ${d?.inserted ?? ""} built-in campaigns`)
                    })
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Load Defaults
                </button>
                <button
                  onClick={createNewTemplate}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Template
                </button>
              </div>
            </div>

            {/* Built-in campaign library, ranked for the currently chosen audience */}
            {library.length > 0 && (
              <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Campaign library · {library.length} ready-made campaigns
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ranked for <span className="font-medium">{segmentLabel(segment)}</span>. Recommended ones are written for this audience.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["all", "lifecycle", "festival", "promotion"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setLibraryCategory(c)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${
                          libraryCategory === c
                            ? "bg-gray-900 border-gray-900 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-auto pr-1">
                  {library
                    .filter((t) => libraryCategory === "all" || t.category === libraryCategory)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelected({ id: t.id, name: t.name, subject: t.subject, html: "" })
                          setTemplateName(t.name)
                          setSubject(t.subject)
                          apiFetch(`/api/admin/marketing/templates?includeHtml=true`).then(async (r) => {
                            const d = await r.json().catch(() => ({}))
                            const full = (d?.items || []).find((x: any) => x.id === t.id)
                            if (full?.html) {
                              setHtml(full.html)
                              setSelected({ id: t.id, name: t.name, subject: t.subject, html: full.html })
                            }
                            setCurrentStep(2)
                          })
                        }}
                        className="text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900 leading-snug">{t.name}</span>
                          {t.recommended && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold">
                              Match
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{t.preheader}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] capitalize">{t.category}</span>
                          {t.occasion && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">{t.occasion}</span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">
                            WA: {t.whatsapp.templateName}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      selectTemplate(t)
                      setCurrentStep(2)
                    }}
                    className={`group cursor-pointer bg-white rounded-xl border-2 transition-all hover:shadow-lg ${
                      selected?.id === t.id
                        ? "border-blue-500 shadow-md ring-2 ring-blue-100"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {/* Template Preview */}
                    <div className="h-48 overflow-hidden rounded-t-xl border-b border-gray-100 bg-gray-50 relative">
                      {mounted ? (
                        <div
                          className="transform scale-[0.35] origin-top-left w-[286%] h-[286%]"
                          dangerouslySetInnerHTML={{ __html: t.html }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                          <div className="text-xs font-medium text-gray-900 truncate">{t.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">
                            {(t.subject || "").replace(/\{\{name\}\}/g, "Customer")}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Template Actions */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {(t.subject || "").replace(/\{\{name\}\}/g, "Customer").slice(0, 50)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTemplate(t)
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 2: Edit Content
           ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 2 && selected && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Edit Content</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    onClick={saveTemplate}
                    className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Save Template
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g. Summer Sale 2026"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject Line
                    <span className="text-gray-400 font-normal ml-2">Use {"{{name}}"} for personalization</span>
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g. Special offer for you, {{name}}!"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Email Content</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRawHtml(!showRawHtml)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                      >
                        <Code className="h-3 w-3" />
                        {showRawHtml ? "Visual Editor" : "View HTML"}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(html)
                          toast.success("HTML copied to clipboard")
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy HTML
                      </button>
                    </div>
                  </div>
                  {showRawHtml ? (
                    <textarea
                      value={html}
                      onChange={(e) => setHtml(e.target.value)}
                      rows={18}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                    />
                  ) : (
                    <RichTextEditor
                      content={html}
                      onChange={setHtml}
                      placeholder="Write your email content here..."
                    />
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={attachImage}
                      onChange={(e) => setAttachImage(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Attach promotional image
                  </label>
                </div>

                {attachImage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="https://example.com/promo-image.jpg"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Live Preview */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-gray-500" />
                  Live Preview
                </h2>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Full Preview
                </button>
              </div>

              {/* Desktop Preview */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="bg-white rounded px-3 py-1 text-xs text-gray-500 inline-block">
                      Email Preview — {"{{name}}"} = &quot;Customer&quot;
                    </div>
                  </div>
                </div>
                <div
                  className="bg-white p-4 max-h-[500px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml("Customer") }}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Choose Recipients
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 3: Choose Recipients
           ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recipient List */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Select Recipients</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {users.length} total · {selectedCount} selected
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                  >
                    <Upload className="h-4 w-4" />
                    Import Excel
                  </button>
                  <button
                    onClick={fetchUsers}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Channel + Segment Filter + Search */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                  {(["email", "whatsapp"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        channel === c ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {c === "email" ? "Email" : "WhatsApp"}
                    </button>
                  ))}
                </div>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {segmentGroups.length === 0 ? (
                    <option value="all">All Customers</option>
                  ) : (
                    segmentGroups.map((g) => (
                      <optgroup key={g.group} label={g.label}>
                        {g.segments.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label} ({s.count})
                          </option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Quick segment chips — every customer is tagged into all that apply */}
              {segmentGroups.length > 0 && (
                <div className="mb-4 space-y-2">
                  {segmentGroups
                    .filter((g) => g.group === "lifecycle" || g.group === "tier" || g.group === "behaviour")
                    .map((g) => (
                      <div key={g.group} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-gray-400 w-24 shrink-0">{g.label}</span>
                        {g.segments.map((s) => (
                          <button
                            key={s.key}
                            title={s.description}
                            onClick={() => setSegment(s.key)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              segment === s.key
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                            }`}
                          >
                            {s.label} <span className="opacity-70">{s.count}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                </div>
              )}

              {/* Select All */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg mb-3">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select all ({filteredUsers.length} users)
                </span>
              </div>

              {/* User List */}
              <div className="border border-gray-200 rounded-lg max-h-[400px] overflow-auto">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No recipients found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your segment or search</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {filteredUsers.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={!!u.selected}
                            onChange={() => toggleUser(u.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                            {(u.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{u.name}</span>
                              {u.source === "both" && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">Registered + Orders</span>
                              )}
                              {u.source === "orders" && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">Order Customer</span>
                              )}
                              {u.source === "registered" && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">Registered</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                            {u.segments && u.segments.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {u.segments
                                  .filter((s) => s !== "all")
                                  .slice(0, 5)
                                  .map((s) => (
                                    <span
                                      key={s}
                                      className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium"
                                    >
                                      {segmentLabel(s)}
                                    </span>
                                  ))}
                                {u.segments.filter((s) => s !== "all").length > 5 && (
                                  <span className="text-[10px] text-gray-400">
                                    +{u.segments.filter((s) => s !== "all").length - 5}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {u.phone && <div className="text-xs text-gray-400">{u.phone}</div>}
                          {u.totalOrders ? (
                            <div className="text-[10px] text-gray-500">
                              {u.totalOrders} order{u.totalOrders > 1 ? "s" : ""} · ₹{(u.totalSpent || 0).toLocaleString("en-IN")}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="space-y-5">
              {/* WhatsApp dry-run plan */}
              {channel === "whatsapp" && (
                <div className="bg-white rounded-xl border border-emerald-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">WhatsApp campaign plan</h3>
                    <button
                      disabled={!selected || loadingWaPlan}
                      onClick={async () => {
                        if (!selected) return
                        setLoadingWaPlan(true)
                        try {
                          const res = await apiFetch("/api/admin/marketing/whatsapp", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              templateId: selected.id,
                              segment,
                              recipientIds: users.filter((u) => u.selected).map((u) => u.id),
                              requireConsent: true,
                            }),
                          })
                          setWaPlan(await res.json())
                        } finally {
                          setLoadingWaPlan(false)
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
                    >
                      {loadingWaPlan ? "Building…" : "Preview (dry run)"}
                    </button>
                  </div>
                  {!waPlan ? (
                    <p className="text-xs text-gray-500">
                      Builds the exact AskEva payloads without sending anything.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                          {waPlan.mode === "sent" ? "SENT" : "DRY RUN — nothing sent"}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        Template <code className="bg-gray-100 px-1 rounded">{waPlan.whatsappTemplateName}</code>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded bg-gray-50 p-2">
                          <div className="text-base font-semibold text-gray-900">{waPlan.totalAudience ?? 0}</div>
                          <div className="text-[10px] text-gray-500">audience</div>
                        </div>
                        <div className="rounded bg-emerald-50 p-2">
                          <div className="text-base font-semibold text-emerald-700">{waPlan.plannedTotal ?? 0}</div>
                          <div className="text-[10px] text-gray-500">will send</div>
                        </div>
                        <div className="rounded bg-red-50 p-2">
                          <div className="text-base font-semibold text-red-600">{waPlan.skipped?.length ?? 0}</div>
                          <div className="text-[10px] text-gray-500">skipped</div>
                        </div>
                      </div>
                      {waPlan.batches && (
                        <div className="text-gray-500">
                          {waPlan.batches.count} batch(es) of {waPlan.batches.size} · ~{waPlan.batches.estimatedMinutes} min
                        </div>
                      )}
                      {(waPlan.warnings ?? []).map((w: string, i: number) => (
                        <p key={i} className="text-amber-700 bg-amber-50 rounded px-2 py-1">{w}</p>
                      ))}
                      {waPlan.planned?.[0] && (
                        <div>
                          <div className="font-medium text-gray-700 mt-2 mb-1">Sample message</div>
                          <div className="rounded bg-[#dcf8c6] p-2 text-gray-800">{waPlan.planned[0].renderedPreview}</div>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-gray-500">View AskEva payload</summary>
                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-900 p-2 text-[10px] text-gray-100">
{JSON.stringify(waPlan.planned[0].payload, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Template */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Selected Template</h3>
                {selected ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{templateName}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[180px]">
                        {subject.replace(/\{\{name\}\}/g, "Customer")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No template selected</p>
                )}
              </div>

              {/* Segment Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Target Segment</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Segment</span>
                    <span className="font-medium capitalize">{segment.replace("-", " ")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Users</span>
                    <span className="font-medium">{users.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Selected</span>
                    <span className="font-medium text-blue-600">{selectedCount}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => setCurrentStep(4)}
                  disabled={selectedCount === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Preview & Send
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Edit Content
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STEP 4: Preview & Send
           ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Email Preview */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-gray-500" />
                  Final Preview
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs text-gray-500">
                    Subject: {subject.replace(/\{\{name\}\}/g, "Customer")}
                  </div>
                </div>
                <div
                  className="bg-white p-6 max-h-[500px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml("Customer") }}
                />
              </div>
            </div>

            {/* Send Summary */}
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Template</div>
                      <div className="text-sm font-medium">{templateName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Subject</div>
                      <div className="text-sm font-medium truncate max-w-[200px]">
                        {subject.replace(/\{\{name\}\}/g, "Customer")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <Users className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Recipients</div>
                      <div className="text-sm font-medium">{selectedCount} users</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Segment</div>
                      <div className="text-sm font-medium capitalize">{segment.replace("-", " ")}</div>
                    </div>
                  </div>
                  {attachImage && imageUrl && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-pink-600" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Attachment</div>
                        <div className="text-sm font-medium">Promotional image</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Ready to send?</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Each of the {selectedCount} selected recipients will receive a personalized email.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => sendCampaign(false)}
                disabled={sending || selectedCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-200"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending Campaign...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send to {selectedCount} Recipients
                  </>
                )}
              </button>

              {/* Batch Progress Display */}
              {sendProgress && sendProgress.status !== "idle" && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {sendProgress.status === "complete" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    )}
                    {sendProgress.status === "complete"
                      ? "Campaign Complete"
                      : sendProgress.status === "delaying"
                        ? "Waiting between batches..."
                        : "Sending in progress..."}
                  </h3>

                  {/* Overall Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {sendProgress.sent + sendProgress.failed} of {sendProgress.totalRecipients} processed
                      </span>
                      <span>
                        {sendProgress.totalRecipients > 0
                          ? Math.round(((sendProgress.sent + sendProgress.failed) / sendProgress.totalRecipients) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          sendProgress.status === "complete" ? "bg-green-500" : "bg-blue-600"
                        }`}
                        style={{
                          width: `${
                            sendProgress.totalRecipients > 0
                              ? Math.round(((sendProgress.sent + sendProgress.failed) / sendProgress.totalRecipients) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Batch Info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-green-50 rounded-lg p-2.5">
                      <div className="text-green-600 font-medium">Delivered</div>
                      <div className="text-green-800 text-lg font-bold">{sendProgress.sent}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2.5">
                      <div className="text-red-600 font-medium">Failed</div>
                      <div className="text-red-800 text-lg font-bold">{sendProgress.failed}</div>
                    </div>
                  </div>

                  {/* Batch Progress */}
                  <div className="text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Batch {sendProgress.currentBatch} of {sendProgress.totalBatches}</span>
                      <span className="text-gray-400">50 emails/batch</span>
                    </div>
                    {sendProgress.status === "delaying" && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-700">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        Waiting {sendProgress.delaySeconds}s before batch {sendProgress.nextBatch} to avoid spam filters...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setCurrentStep(3)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Change Recipients
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            Campaign History
           ═══════════════════════════════════════════════════════════════ */}
        {currentStep === 1 && campaignHistory.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Recent Campaigns
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Template</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Subject</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Recipients</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Sent</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Failed</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Segment</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaignHistory.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-gray-900">{c.templateName}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm text-gray-600 truncate max-w-[200px]">{c.subject}</div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-sm font-medium text-gray-900">{c.recipientCount}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle className="h-3 w-3" />
                          {c.sent}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {c.failed > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            {c.failed}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium capitalize">
                          {c.segment?.replace("-", " ") || "all"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm text-gray-600">
                          {new Date(c.sentAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Full Preview Modal ──────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPreview(false)} />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Full Email Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-gray-100">
              <div className="max-w-xl mx-auto bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 text-sm text-gray-600">
                  <strong>Subject:</strong> {subject.replace(/\{\{name\}\}/g, "Customer")}
                </div>
                <div
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml("Customer") }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Import Excel Modal ──────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowImportModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Import Recipients</h3>
                  <p className="text-xs text-gray-500">Upload an Excel or CSV file</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Download Sample */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Download className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">Download Sample Format</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Not sure how to format your file? Download our sample template with the correct columns.
                    </p>
                    <button
                      onClick={downloadSampleExcel}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Sample.xlsx
                    </button>
                  </div>
                </div>
              </div>

              {/* Format Info */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Required Columns</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded font-semibold">Name</span>
                    <span>Customer&apos;s full name</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded font-semibold">Email</span>
                    <span>Required — used to send the campaign</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-800">
                    <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded font-semibold">Phone</span>
                    <span>Optional — customer&apos;s phone number</span>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-8 text-center transition-colors hover:bg-blue-50/50">
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    .xlsx, .xls, or .csv files accepted
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
