"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import QRCode from "qrcode"
import { toast } from "react-hot-toast"
import {
  BarChart3, Users, Ticket, Package, Store, TrendingUp,
  Search, Download, RefreshCw, Eye, Trophy, AlertCircle,
  Copy, ExternalLink, Loader2, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle, Edit2, Save, ChevronDown, Plus, Trash2, Link, FileSpreadsheet, QrCode, ToggleLeft, ToggleRight, Settings, Image, Gift
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts"
import EmojiPicker from "emoji-picker-react"

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "inventory", label: "Prize Inventory", icon: Package },
  { id: "wheel-preview", label: "Wheel Preview", icon: Trophy },
  { id: "stores", label: "Store Tracking", icon: Store },
  { id: "analytics", label: "Traffic Analytics", icon: TrendingUp },
  { id: "export", label: "Export Data", icon: FileSpreadsheet },
]

export default function SpinWheelAdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <SpinWheelAdminContent />
    </Suspense>
  )
}

function SpinWheelAdminContent() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const searchParams = useSearchParams()
  const campaignSlug = searchParams.get("campaign") || "default"

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Spin the Wheel Campaign</h1>
        <p className="text-gray-500 text-sm mt-1">Campaign: {campaignSlug}</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200 hide-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id
                ? "text-blue-600 border-blue-600 bg-blue-50/50"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-x-hidden min-h-[500px]">
          {activeTab === "dashboard" && <DashboardTab campaignSlug={campaignSlug} />}
          {activeTab === "coupons" && <CouponsTab campaignSlug={campaignSlug} />}
          {activeTab === "inventory" && <InventoryTab campaignSlug={campaignSlug} />}
          {activeTab === "wheel-preview" && <WheelPreviewTab campaignSlug={campaignSlug} />}
          {activeTab === "stores" && <StoresTab campaignSlug={campaignSlug} />}
          {activeTab === "analytics" && <AnalyticsTab campaignSlug={campaignSlug} />}
          {activeTab === "export" && <ExportTab campaignSlug={campaignSlug} />}
        </div>
      </div>
    </div>
  )
}

/* ==================== TAB 1: DASHBOARD ==================== */
function DashboardTab({ campaignSlug }: { campaignSlug: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/dashboard?campaignId=${campaignSlug}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [campaignSlug])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingState />
  if (!data) return <ErrorState onRetry={fetchData} />

  const kpis = [
    { label: "Total Visitors", value: data.totalVisitors, icon: Eye, color: "bg-blue-500" },
    { label: "Total Participants", value: data.totalParticipants, icon: Users, color: "bg-purple-500" },
    { label: "OTP Verified Users", value: data.otpVerifiedCount || 0, icon: CheckCircle2, color: "bg-emerald-500" },
    { label: "Spins Completed", value: data.totalSpins, icon: Trophy, color: "bg-amber-500" },
  ]

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5 scale-150 transform rotate-12">
              <kpi.icon className="w-24 h-24" />
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className={`w-10 h-10 ${kpi.color} rounded-lg flex items-center justify-center shadow-lg shadow-${kpi.color.replace('bg-', '')}/30`}>
                <kpi.icon className="w-5 h-5 text-white" />
              </div>
              <RefreshCw onClick={fetchData} className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-pointer transition-transform hover:rotate-180" />
            </div>
            <p className="text-3xl font-bold text-gray-900 relative z-10">{kpi.value.toLocaleString()}</p>
            <p className="text-xs font-medium text-gray-500 mt-1 relative z-10 uppercase tracking-wider">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Prize Distribution</h3>
          {data.prizeDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.prizeDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="prize" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No spin data yet" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Performing Stores</h3>
          {data.storePerformance?.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {data.storePerformance.slice(0, 5).map((store: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                      #{i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{store.store}</p>
                      <p className="text-xs text-gray-500">{store.visits} visits</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 text-sm">{store.participants} conversions</p>
                    <p className="text-xs text-green-600 font-medium">{store.conversionRate}% rate</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No store data yet" />
          )}
        </div>
      </div>

      {/* Participants Table Merged */}
      <div className="pt-8 mt-8 border-t border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Recent Participants
        </h2>
        <ParticipantsTab campaignSlug={campaignSlug} />
      </div>
    </div>
  )
}

/* ==================== TAB 2: PARTICIPANTS ==================== */
function ParticipantsTab({ campaignSlug }: { campaignSlug: string }) {
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [prizeFilter, setPrizeFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("campaignId", campaignSlug)
      if (search) params.set("search", search)
      if (prizeFilter) params.set("prize", prizeFilter)
      params.set("page", page.toString())
      params.set("limit", "15")
      const res = await apiFetch(`/api/spin-wheel/admin/participants?${params}`)
      const json = await res.json()
      setParticipants(json.participants || [])
      setTotalPages(json.totalPages || 1)
      setTotal(json.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, prizeFilter, page, campaignSlug])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value);
 setPage(1) }}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={prizeFilter}
          onChange={e => { setPrizeFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All Prizes</option>
          <option value="TV">TV</option>
          <option value="SPEAKER">Speaker</option>
          <option value="₹500 VOUCHER">₹500 Voucher</option>
          <option value="HOME THEATRE">Home Theatre</option>
          <option value="SAMSUNG PHONE">Samsung Phone</option>
          <option value="SOUNDBAR">Soundbar</option>
          <option value="BETTER LUCK NEXT TIME">Better Luck</option>
        </select>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-md">{total} total</span>
      </div>

      {/* Table */}
      {loading ? <LoadingState /> : (
        <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">OTP</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">Prize Won</th>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participants.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No participants found</td></tr>
              ) : participants.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{p.phone}</div>
                    <div className="text-gray-400 text-xs">{p.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono tracking-wider font-bold">
                    {p.otpCode || p.otp || (
                      <span className="text-gray-300 text-xs italic tracking-normal">No OTP</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.otpVerified ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> OTP Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <AlertCircle className="w-3.5 h-3.5" /> Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.prize || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{p.store || "-"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Prev</button>
          <span className="text-sm font-medium text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

/* ==================== TAB 3: COUPONS ==================== */
function CouponsTab({ campaignSlug }: { campaignSlug: string }) {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [prizeFilter, setPrizeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("campaignId", campaignSlug)
      if (prizeFilter) params.set("prize", prizeFilter)
      if (statusFilter) params.set("status", statusFilter)
      const res = await apiFetch(`/api/spin-wheel/admin/coupons?${params}`)
      const json = await res.json()
      setCoupons(json.coupons || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [prizeFilter, statusFilter, campaignSlug])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={prizeFilter} onChange={e => setPrizeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">All Prizes</option>
          <option value="TV">TV</option>
          <option value="SPEAKER">Speaker</option>
          <option value="₹500 VOUCHER">₹500 Voucher</option>
          <option value="HOME THEATRE">Home Theatre</option>
          <option value="SAMSUNG PHONE">Samsung Phone</option>
          <option value="SOUNDBAR">Soundbar</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">All Status</option>
          <option value="issued">Issued</option>
          <option value="redeemed">Redeemed</option>
        </select>
      </div>

      {loading ? <LoadingState /> : (
        <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Coupon Code</th>
                <th className="px-4 py-3 font-medium">Prize</th>
                <th className="px-4 py-3 font-medium">Winner</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Date Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No coupons found</td></tr>
              ) : coupons.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{c.couponCode}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium border border-purple-200">{c.prize}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{c.participantName}</td>
                  <td className="px-4 py-3 text-gray-600">{c.participantPhone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.store}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ==================== TAB 4: ADVANCED INVENTORY ==================== */
function InventoryTab({ campaignSlug }: { campaignSlug: string }) {
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [couponCodes, setCouponCodes] = useState<Record<string, any[]>>({})

  // Editor State
  const [editingItem, setEditingItem] = useState<any>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [codeInputValue, setCodeInputValue] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, codesRes] = await Promise.all([
        apiFetch(`/api/spin-wheel/admin/inventory?campaignId=${campaignSlug}`),
        apiFetch(`/api/spin-wheel/admin/coupon-codes?campaignId=${campaignSlug}`)
      ])
      const invJson = await invRes.json()
      const codesJson = await codesRes.json()
      setInventory(invJson.inventory || [])
      setCouponCodes(codesJson.couponCodes || {})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [campaignSlug])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveInventory = async () => {
    if (!editingItem) return
    setSaveLoading(true)
    try {
      // 1. Save Inventory Item
      const method = editingItem.isNew ? "POST" : "PUT"
      const res = await apiFetch(`/api/spin-wheel/admin/inventory?campaignId=${campaignSlug}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prizeName: editingItem.prizeName,
          emoji: editingItem.emoji,
          productImage: editingItem.productImage || "",
          isActive: editingItem.isActive,
          weightMultiplier: Number(editingItem.weightMultiplier),
          dateRanges: editingItem.dateRanges || [],
          timeSlots: editingItem.timeSlots || []
        })
      })

      // 2. Upload Codes if any
      if (codeInputValue.trim().length > 0) {
        const codes = codeInputValue.split(/[\n,]+/).map(c => c.trim()).filter(c => c.length > 0)
        await apiFetch(`/api/spin-wheel/admin/coupon-codes?campaignId=${campaignSlug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prizeName: editingItem.prizeName, codes })
        })
      }

      if (res.ok) {
        toast.success(`✅ Prize "${editingItem.prizeName}" saved successfully!`)
        setEditingItem(null)
        setCodeInputValue("")
        fetchData()
      } else {
        toast.error("❌ Failed to save prize configuration")
      }
    } catch (err) {
      console.error("Save failed", err)
      toast.error("❌ Error saving prize configuration")
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDeleteCode = async (code: string) => {
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/coupon-codes?code=${code}&campaignId=${campaignSlug}`, { method: "DELETE" })
      if (res.ok) fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeletePrize = async () => {
    if (!editingItem?.prizeName || editingItem.isNew) {
      toast.error("Cannot delete new prizes")
      return
    }

    setSaveLoading(true)
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/inventory?prizeName=${encodeURIComponent(editingItem.prizeName)}&campaignId=${campaignSlug}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Prize deleted successfully!")
        setEditingItem(null)
        setCodeInputValue("")
        fetchData()
      } else {
        toast.error(data.error || "Failed to delete prize")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error deleting prize")
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Advanced Prize Configuration</h3>
          <p className="text-sm text-gray-500">Manage time slots, dates, weights, and strictly controlled coupon codes.</p>
        </div>
        <button
          onClick={() => setEditingItem({ prizeName: "", isNew: true, emoji: "🎁", productImage: "", weightMultiplier: 1, isActive: true, total: 0, timeSlots: [], dateRanges: [] })}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add New Prize
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {inventory.map((item: any) => {
          const codes = couponCodes[item.prizeName] || []
          const availableCount = codes.filter((c: any) => !c.isUsed).length
          const usedCount = codes.length - availableCount
          const isBetterLuck = item.prizeName === "BETTER LUCK NEXT TIME"

          return (
            <div key={item.id} className={`rounded-xl border ${item.isActive ? 'border-blue-200 bg-white shadow-sm' : 'border-gray-200 bg-gray-50 grayscale hover:grayscale-0 transition-all'}`}>
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl overflow-hidden">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.prizeName} className="w-full h-full object-cover" />
                    ) : (
                      item.emoji || "🎁"
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm leading-tight">{item.prizeName}</h4>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {item.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setEditingItem(item)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {!isBetterLuck && (
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className="text-2xl font-black text-gray-900">{availableCount}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Avail Codes</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className="text-2xl font-black text-gray-900">{usedCount}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Claimed</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50/50 text-xs text-gray-500 space-y-2 border-t border-gray-100">
                <div className="flex justify-between">
                  <span>Weight Multiplier:</span>
                  <span className="font-medium text-gray-900">{item.weightMultiplier || 1}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Date Limits:</span>
                  <span className="font-medium text-gray-900">
                    {item.dateRanges?.length > 0 ? `${item.dateRanges.length} active ranges` : "None (Always active)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time Slots:</span>
                  <span className="font-medium text-gray-900">
                    {item.timeSlots?.length > 0 ? item.timeSlots.map((ts: any) => `${ts.startTime}-${ts.endTime}`).join(", ") : "None (24/7)"}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 z-10">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" /> Let's Configure "{editingItem.prizeName}"
              </h3>
              <button onClick={() => { setEditingItem(null); setCodeInputValue("") }} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Settings */}
              {editingItem.isNew ? (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prize Name</label>
                  <input
                    type="text"
                    value={editingItem.prizeName}
                    onChange={e => setEditingItem({ ...editingItem, prizeName: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. LAPTOP"
                  />
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Prize Display Icon</label>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2">Emoji Icon</label>
                        <input
                          type="text"
                          value={editingItem.emoji || ""}
                          onChange={e => setEditingItem({ ...editingItem, emoji: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="e.g. 📱"
                        />
                      </div>
                      <div className="border border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
                        <label className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-2">
                          <Image className="w-4 h-4" /> Upload Image
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              toast("Please remove the background of the image", { icon: "⚠️" })
                              const reader = new FileReader()
                              reader.onload = () => {
                                setEditingItem({ ...editingItem, productImage: reader.result as string })
                                toast.success("Image uploaded! Please ensure background is removed.")
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                          className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white cursor-pointer"
                        />
                        <p className="text-[10px] text-amber-700 mt-2 font-medium">💡 Please remove the background of the image before uploading</p>
                        {editingItem.productImage && (
                          <div className="mt-3 flex items-center gap-2">
                            <img src={editingItem.productImage} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-amber-200" />
                            <button
                              onClick={() => setEditingItem({ ...editingItem, productImage: "" })}
                              className="p-1 text-red-500 hover:bg-red-50 rounded text-xs font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Weight Multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingItem.weightMultiplier || 1}
                      onChange={e => setEditingItem({ ...editingItem, weightMultiplier: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Higher number = higher drop rate. Normal is 1.</p>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prize Status</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      value=""
                      className="sr-only peer"
                      checked={editingItem.isActive ?? true}
                      onChange={e => setEditingItem({ ...editingItem, isActive: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">{editingItem.isActive ? 'Active' : 'Disabled'}</span>
                  </label>
                </div>
              </div>

              {/* Date Ranges Array */}
              <div className="border border-purple-100 bg-purple-50/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-purple-800 uppercase tracking-wider">Date Specific Availability</label>
                  <button onClick={() => setEditingItem({ ...editingItem, dateRanges: [...(editingItem.dateRanges || []), { startDate: new Date().toISOString().split("T")[0], endDate: new Date().toISOString().split("T")[0] }] })} className="text-xs text-purple-600 font-bold hover:underline">
                    + Add Date Range
                  </button>
                </div>
                {(!editingItem.dateRanges || editingItem.dateRanges.length === 0) ? (
                  <p className="text-xs text-gray-500 italic">Leaves active all dates</p>
                ) : (
                  <div className="space-y-2">
                    {editingItem.dateRanges.map((dr: any, i: number) => (
                      <div key={i} className="flex flex-wrap gap-2 items-center">
                        <input type="date" value={dr.startDate} onChange={e => {
                          const newRanges = [...editingItem.dateRanges]; newRanges[i].startDate = e.target.value; setEditingItem({ ...editingItem, dateRanges: newRanges })
                        }} className="px-2 py-1 border rounded text-sm bg-white" />
                        <span className="text-gray-400">to</span>
                        <input type="date" value={dr.endDate} onChange={e => {
                          const newRanges = [...editingItem.dateRanges]; newRanges[i].endDate = e.target.value; setEditingItem({ ...editingItem, dateRanges: newRanges })
                        }} className="px-2 py-1 border rounded text-sm bg-white" />
                        <button onClick={() => {
                          const newRanges = editingItem.dateRanges.filter((_: any, idx: number) => idx !== i); setEditingItem({ ...editingItem, dateRanges: newRanges })
                        }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Slots Array */}
              <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider">Time Specific Availability (HH:MM)</label>
                  <button onClick={() => setEditingItem({ ...editingItem, timeSlots: [...(editingItem.timeSlots || []), { startTime: "09:00", endTime: "18:00" }] })} className="text-xs text-blue-600 font-bold hover:underline">
                    + Add Slot
                  </button>
                </div>
                {(!editingItem.timeSlots || editingItem.timeSlots.length === 0) ? (
                  <p className="text-xs text-gray-500 italic">Leaves active 24/7</p>
                ) : (
                  <div className="space-y-2">
                    {editingItem.timeSlots.map((ts: any, i: number) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="time" value={ts.startTime} onChange={e => {
                          const newSlots = [...editingItem.timeSlots]; newSlots[i].startTime = e.target.value; setEditingItem({ ...editingItem, timeSlots: newSlots })
                        }} className="px-2 py-1 border rounded text-sm" />
                        <span className="text-gray-400">to</span>
                        <input type="time" value={ts.endTime} onChange={e => {
                          const newSlots = [...editingItem.timeSlots]; newSlots[i].endTime = e.target.value; setEditingItem({ ...editingItem, timeSlots: newSlots })
                        }} className="px-2 py-1 border rounded text-sm" />
                        <button onClick={() => {
                          const newSlots = editingItem.timeSlots.filter((_: any, idx: number) => idx !== i); setEditingItem({ ...editingItem, timeSlots: newSlots })
                        }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk Add Coupons */}
              {editingItem.prizeName !== "BETTER LUCK NEXT TIME" && (
                <div className="border border-green-200 bg-green-50/50 rounded-xl p-4">
                  <label className="block text-xs font-bold text-green-800 uppercase tracking-wider mb-2">Upload New Coupon Codes</label>
                  <p className="text-[10px] text-green-700 mb-2">Prizes drop ONLY if there is an unused code available. Paste codes below separated by commas or new lines.</p>
                  <textarea
                    rows={4}
                    value={codeInputValue}
                    onChange={(e) => setCodeInputValue(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm bg-white focus:ring-green-500 focus:border-green-500"
                    placeholder="XYZ123, ABC987\nNEWLINECODE456"
                  />

                  {/* Current Available Codes List */}
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between">
                      <span>Currently Available Codes</span>
                      <span className="text-blue-600">{couponCodes[editingItem.prizeName]?.filter((x: any) => !x.isUsed).length || 0} active</span>
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar border border-gray-100 rounded-lg p-2 bg-white">
                      {couponCodes[editingItem.prizeName]?.filter((x: any) => !x.isUsed).map((c: any) => (
                        <div key={c.code} className="flex justify-between items-center text-xs py-1 hover:bg-gray-50 px-2 rounded">
                          <span className="font-mono">{c.code}</span>
                          <button onClick={() => handleDeleteCode(c.code)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      {(!couponCodes[editingItem.prizeName] || couponCodes[editingItem.prizeName].filter((x: any) => !x.isUsed).length === 0) && (
                        <p className="text-xs text-gray-400 text-center py-2">No active codes. This prize will not be randomly picked.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center rounded-b-2xl border-t border-gray-200 relative z-10">
              {!editingItem.isNew && (
                <button
                  onClick={handleDeletePrize}
                  disabled={saveLoading}
                  className="px-5 py-2.5 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors text-sm border border-red-200"
                >
                  <Trash2 className="w-4 h-4 inline mr-2" />
                  Delete Prize
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => { setEditingItem(null); setCodeInputValue("") }}
                  className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInventory}
                  disabled={saveLoading}
                  className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
                >
                  {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== TAB 4: WHEEL PREVIEW ==================== */
function WheelPreviewTab({ campaignSlug }: { campaignSlug: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [preloadedImages, setPreloadedImages] = useState<{ [key: number]: HTMLImageElement }>({})
  const [rotation, setRotation] = useState(0)

  const wheelItems = inventory.length
    ? inventory
    : [{ prizeName: "NO ACTIVE PRIZES", emoji: "🎁", productImage: null, isActive: true }]

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/inventory?campaignId=${campaignSlug}`)
      const json = await res.json()
      const active = json.inventory?.filter((p: any) => p.isActive) || []
      setInventory(active)

      // Preload images
      const images: { [key: number]: HTMLImageElement } = {}
      let loaded = 0
      let toLoad = 0

      active.forEach((item: any, idx: number) => {
        if (item.productImage) {
          toLoad++
          const img = new window.Image()
          img.crossOrigin = "anonymous"
          img.src = item.productImage
          img.onload = () => {
            images[idx] = img
            loaded++
            if (loaded === toLoad) {
              setPreloadedImages({ ...images })
            }
          }
          img.onerror = () => {
            loaded++
            if (loaded === toLoad) {
              setPreloadedImages({ ...images })
            }
          }
        }
      })
      if (toLoad === 0) {
        setPreloadedImages({})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [campaignSlug])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // Draw wheel function
  const drawWheel = useCallback((rot: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = canvas.width
    const center = size / 2
    const radius = center - 15
    const segments = wheelItems.length
    const arc = (2 * Math.PI) / segments
    const rotRad = (rot * Math.PI) / 180

    ctx.clearRect(0, 0, size, size)

    // Outer rim
    ctx.save()
    ctx.beginPath()
    ctx.arc(center, center, radius + 10, 0, 2 * Math.PI)
    const rimGrad = ctx.createLinearGradient(center, 0, center, size)
    rimGrad.addColorStop(0, "#e8e8e8")
    rimGrad.addColorStop(0.5, "#f8f8f8")
    rimGrad.addColorStop(1, "#d4d4d4")
    ctx.fillStyle = rimGrad
    ctx.fill()
    ctx.shadowColor = "rgba(0,0,0,0.15)"
    ctx.shadowBlur = 12
    ctx.strokeStyle = "#c0c0c0"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // Rotation wrapper
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(rotRad)
    ctx.translate(-center, -center)

    // Draw each segment
    for (let i = 0; i < segments; i++) {
      const startAngle = i * arc - Math.PI / 2
      const endAngle = startAngle + arc
      const midAngle = startAngle + arc / 2
      const item = wheelItems[i]

      // Wedge background
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f3f4f6"
      ctx.fill()
      ctx.strokeStyle = "#d1d5db"
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()

      // Content: image/icon + text
      ctx.save()
      ctx.translate(center, center)
      ctx.rotate(midAngle)

      const imgSize = Math.min(44, radius * 0.22)
      const imgDist = radius * 0.46

      // Draw image or emoji icon
      if (item.productImage && preloadedImages[i]) {
        ctx.save()
        ctx.translate(imgDist, 0)
        // Keep upright regardless of wheel rotation
        ctx.rotate(-midAngle - rotRad)
        const halfImg = imgSize / 2
        ctx.beginPath()
        ctx.arc(0, 0, halfImg + 2, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fillStyle = "#fff"
        ctx.fill()
        ctx.strokeStyle = "#e5e7eb"
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, halfImg, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(preloadedImages[i], -halfImg, -halfImg, imgSize, imgSize)
        ctx.restore()
      } else {
        ctx.save()
        ctx.translate(imgDist, 0)
        // Keep upright regardless of wheel rotation
        ctx.rotate(-midAngle - rotRad)
        const emojiFontSize = Math.min(28, radius * 0.14)
        ctx.font = `${emojiFontSize}px 'Inter', system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(item.emoji || "🎁", 0, 0)
        ctx.restore()
      }

      // Draw text label
      ctx.save()
      const textDist = radius * 0.8
      ctx.translate(textDist, 0)
      // Keep upright regardless of wheel rotation
      ctx.rotate(-midAngle - rotRad)

      const rawName = ((item.prizeName === "BETTER LUCK NEXT TIME" ? "BETTER LUCK\nNEXT TIME" : item.prizeName) || "").trim()
      const forcedLines = rawName.split("\n").map((l: string) => l.trim()).filter(Boolean)
      const maxTextWidth = 2 * textDist * Math.sin(arc / 2) * 0.9

      const wrapOneLine = (input: string) => {
        const words = input.split(/\s+/).filter(Boolean)
        if (words.length <= 1) return [input]

        const lines: string[] = []
        let current = ""

        for (const w of words) {
          const test = current ? `${current} ${w}` : w
          if (ctx.measureText(test).width <= maxTextWidth) {
            current = test
          } else {
            if (current) lines.push(current)
            current = w
          }
        }
        if (current) lines.push(current)
        return lines
      }

      let fontSize = Math.min(13, radius * 0.07)
      if (segments > 8) fontSize = Math.min(12, radius * 0.058)

      let nameLines: string[] = []
      for (let attempt = 0; attempt < 6; attempt++) {
        ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`
        nameLines = []
        for (const fl of (forcedLines.length ? forcedLines : [rawName])) {
          nameLines.push(...wrapOneLine(fl))
        }

        const tooManyLines = nameLines.length > 3
        const anyTooWide = nameLines.some((l: string) => ctx.measureText(l).width > maxTextWidth)
        if (!tooManyLines && !anyTooWide) break
        fontSize *= 0.9
      }

      if (nameLines.length > 3) {
        nameLines = nameLines.slice(0, 3)
        const last = nameLines[2]
        const ellipsis = "…"
        ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`
        let trimmed = last
        while (trimmed.length > 1 && ctx.measureText(`${trimmed}${ellipsis}`).width > maxTextWidth) {
          trimmed = trimmed.slice(0, -1)
        }
        nameLines[2] = `${trimmed}${ellipsis}`
      }

      ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`
      ctx.fillStyle = "#111827"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const lineHeight = fontSize * 1.25
      const totalHeight = nameLines.length * lineHeight
      const startY = -totalHeight / 2 + lineHeight / 2

      nameLines.forEach((line: string, li: number) => {
        ctx.fillText(line, 0, startY + li * lineHeight)
      })
      ctx.restore()
      ctx.restore()
    }

    // Center hub
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.1)"
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(center, center, 42, 0, 2 * Math.PI)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.strokeStyle = "#d1d5db"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.arc(center, center, 16, 0, 2 * Math.PI)
    const dotGrad = ctx.createRadialGradient(center, center, 0, center, center, 16)
    dotGrad.addColorStop(0, "#374151")
    dotGrad.addColorStop(1, "#111827")
    ctx.fillStyle = dotGrad
    ctx.fill()
    ctx.restore()

    ctx.restore()

    // Pointer triangle at top
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(center - 16, -2)
    ctx.lineTo(center + 16, -2)
    ctx.lineTo(center, 28)
    ctx.closePath()
    const ptrGrad = ctx.createLinearGradient(center, -2, center, 28)
    ptrGrad.addColorStop(0, "#1f2937")
    ptrGrad.addColorStop(1, "#111827")
    ctx.fillStyle = ptrGrad
    ctx.shadowColor = "rgba(0,0,0,0.3)"
    ctx.shadowBlur = 4
    ctx.fill()
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }, [wheelItems, preloadedImages])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && !loading) {
      const size = Math.min(420, window.innerWidth - 40)
      canvas.width = size
      canvas.height = size
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      drawWheel(rotation)
    }
  }, [drawWheel, loading, rotation])

  if (loading) return <LoadingState />

  const activePrizes = inventory.filter(p => p.isActive)
  const totalCodeCount = activePrizes.reduce((sum: number, p: any) => sum + (p.total || 0), 0)

  return (
    <div className="space-y-8">
      {/* Main Wheel Preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-600" />
          Spin Wheel Live Preview
        </h3>
        
        <div className="flex flex-col items-center gap-6">
          {/* Canvas */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <canvas
              ref={canvasRef}
              className="mx-auto"
            />
          </div>

          {/* Rotation Control */}
          <div className="w-full max-w-xs">
            <label className="text-sm font-medium text-gray-600 mb-2 block">Preview Rotation</label>
            <input
              type="range"
              min="0"
              max="360"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0°</span>
              <span className="font-bold text-gray-900">{rotation}°</span>
              <span>360°</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prize Configuration Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Prizes Count */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-blue-900">Active Prizes</h4>
            <Gift className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{activePrizes.length}</p>
          <p className="text-xs text-blue-700 mt-1">Currently spinning</p>
        </div>

        {/* Total Segments */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-purple-900">Segments</h4>
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-900">{inventory.length}</p>
          <p className="text-xs text-purple-700 mt-1">Total segments on wheel</p>
        </div>

        {/* Total Coupons */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-emerald-900">Total Coupons</h4>
            <Ticket className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-emerald-900">{totalCodeCount}</p>
          <p className="text-xs text-emerald-700 mt-1">Codes available</p>
        </div>
      </div>

      {/* Prize Details Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-600" />
            Prize Configuration
          </h3>
        </div>
        
        {activePrizes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No active prizes configured</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left font-medium text-gray-600">#</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Prize Name</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Icon</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Weight</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Date Ranges</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Time Slots</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activePrizes.map((prize: any, idx: number) => (
                  <tr key={prize.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 font-bold text-gray-900">
                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">
                        {idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-900 font-medium">{prize.prizeName}</td>
                    <td className="px-6 py-3">
                      <span className="text-2xl">{prize.emoji || prize.productImage ? "📦" : "🎁"}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        {prize.weightMultiplier || 1}x
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {prize.dateRanges?.length > 0 ? (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md">
                          {prize.dateRanges.length} range{prize.dateRanges.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">All dates</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {prize.timeSlots?.length > 0 ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                          {prize.timeSlots.length} slot{prize.timeSlots.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">24/7</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Preview Tips</p>
          <ul className="space-y-1 text-xs text-blue-700">
            <li>• Use the rotation slider to rotate the wheel and preview different prize positions</li>
            <li>• Only <strong>Active</strong> prizes appear on the wheel</li>
            <li>• Prizes with no available coupons will not be selected during spins</li>
            <li>• Date ranges and time slots control when prizes are available</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ==================== TAB 5: STORE TRACKING & QR ==================== */
function StoresTab({ campaignSlug }: { campaignSlug: string }) {
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [customStoreName, setCustomStoreName] = useState("")
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)

  // Tracking modal QR states
  const [showQrModal, setShowQrModal] = useState<{ url: string, store: string } | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("")

  const spinBase = campaignSlug === "default" ? "/spin" : `/spin/${campaignSlug}`

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/stores?campaignId=${campaignSlug}`)
      const json = await res.json()
      setStores(json.stores || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [campaignSlug])

  useEffect(() => { fetchData() }, [fetchData])

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleGenerateLink = () => {
    if (!customStoreName.trim()) return
    const slug = customStoreName.trim().toLowerCase().replace(/\s+/g, "-")
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}${spinBase}?store=${encodeURIComponent(slug)}`
    setGeneratedUrl(url)
  }

  const generateQRCode = async (url: string, storeName: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a', // slate-900
          light: '#ffffff'
        }
      })
      setQrCodeDataUrl(dataUrl)
      setShowQrModal({ url, store: storeName })
    } catch (err) {
      console.error("QR Generation failed", err)
    }
  }

  const downloadQR = () => {
    if (!showQrModal || !qrCodeDataUrl) return
    const link = document.createElement('a')
    link.href = qrCodeDataUrl
    link.download = `QR_Store_${showQrModal.store.replace(/\s+/g, '_')}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-6 shadow-sm">
        <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2 text-lg">
          <QrCode className="w-5 h-5 text-indigo-600" /> Print-Ready Store Trackers
        </h3>
        <p className="text-sm text-indigo-700/80 mb-5">
          Generate unique URL links and QR codes for your offline stores. Print the exact QR code so customers scanning them inside the store are tracked to that exact location.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={customStoreName}
            onChange={e => setCustomStoreName(e.target.value)}
            placeholder="Type store name (e.g. Phoenix Mall Branch)"
            className="flex-1 px-4 py-3 border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm"
            onKeyDown={e => e.key === 'Enter' && handleGenerateLink()}
          />
          <button
            onClick={handleGenerateLink}
            disabled={!customStoreName.trim()}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md shadow-indigo-600/20"
          >
            Create Link
          </button>
        </div>

        {generatedUrl && (
          <div className="mt-6 bg-white rounded-xl border border-indigo-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="overflow-hidden w-full">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Generated Tracking Link Data</p>
              <code className="text-sm font-mono text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg block truncate">
                {generatedUrl}
              </code>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => copyUrl(generatedUrl, 'generated')} className="flex-1 sm:flex-none px-4 py-2 border border-indigo-200 text-indigo-700 font-medium rounded-lg hover:bg-indigo-50">
                {copied === 'generated' ? 'Copied' : 'Copy'}
              </button>
              <button onClick={() => generateQRCode(generatedUrl, customStoreName)} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                <QrCode className="w-4 h-4" /> Get QR
              </button>
            </div>
          </div>
        )}
      </div>

      {stores.length > 0 ? (
        <div className="overflow-x-auto border border-gray-100 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Scans/Visits</th>
                <th className="px-4 py-3 font-medium">Registrations</th>
                <th className="px-4 py-3 font-medium">Conversion</th>
                <th className="px-4 py-3 font-medium">Tools</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((store: any) => (
                <tr key={store.store} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold text-gray-900">{store.store}</td>
                  <td className="px-4 py-3 text-gray-600">{store.visits} scans</td>
                  <td className="px-4 py-4 text-gray-600">{store.participants} registered</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${parseFloat(store.conversionRate) > 50 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-700"}`}>
                      {store.conversionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => generateQRCode(store.url, store.store)}
                      className="p-1.5 text-indigo-600 bg-indigo-50 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                      title="View QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        copyUrl(store.url, store.store)
                        toast.success("📋 Link copied to clipboard!")
                      }}
                      className="p-1.5 text-gray-600 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                      title="Copy Link URL"
                    >
                      <Link className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No store data yet. Generate store URLs above to start tracking!" />
      )}

      {/* QR Code Modal for Viewing & Download */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl relative border border-gray-200">
            <button onClick={() => setShowQrModal(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><XCircle className="w-5 h-5 text-gray-600" /></button>

            <h3 className="text-xl font-bold text-gray-900 mb-1">{showQrModal.store}</h3>
            <p className="text-xs text-gray-500 mb-6 px-4">Print this and display it at the billing counter.</p>

            <div className="border border-gray-200 p-2 rounded-2xl mx-auto inline-block bg-white shadow-sm mb-6">
              <img src={qrCodeDataUrl} alt={`${showQrModal.store} QR Code`} className="w-48 h-48" />
            </div>

            <div className="text-left bg-gray-50 p-3 rounded-xl border border-gray-100 mb-6 truncate">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Encoded URL</p>
              <code className="text-xs text-indigo-600">{showQrModal.url}</code>
            </div>

            <button onClick={downloadQR} className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all shadow-lg flex justify-center items-center gap-2">
              <Download className="w-4 h-4" /> Download High-Res PNG
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== TAB 6: TRAFFIC ANALYTICS ==================== */
function AnalyticsTab({ campaignSlug }: { campaignSlug: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/spin-wheel/admin/analytics?campaignId=${campaignSlug}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [campaignSlug])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingState />
  if (!data) return <ErrorState onRetry={fetchData} />

  const summaryCards = [
    { label: "Total Page Visits", value: data.summary.totalVisits, icon: Eye, color: "text-blue-600 bg-blue-100" },
    { label: "Registrations", value: data.summary.totalRegistrations, icon: Users, color: "text-purple-600 bg-purple-100" },
    { label: "Drop-off Rate", value: `${data.summary.dropOffRate}%`, icon: ArrowDownRight, color: "text-red-600 bg-red-100" },
    { label: "Spin Success", value: `${data.summary.spinSuccessRate}%`, icon: ArrowUpRight, color: "text-green-600 bg-green-100" },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Traffic Graph */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Daily Traffic</h3>
        {data.dailyData?.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data.dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Visits" />
              <Line type="monotone" dataKey="registrations" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Registrations" />
              <Line type="monotone" dataKey="spins" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Spins" />
              <Line type="monotone" dataKey="winners" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Winners" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No traffic data yet" />
        )}
      </div>
    </div>
  )
}

/* ==================== TAB 7: EXPORT DATA ==================== */
function ExportTab({ campaignSlug }: { campaignSlug: string }) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await apiFetch(`${origin}/api/spin-wheel/admin/export?campaignId=${campaignSlug}`)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error("Export API Error:", errorBody)
        throw new Error(`Export failed with status ${response.status}: ${errorBody || response.statusText}`)
      }

      // Get the blob
      const blob = await response.blob()

      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob)

      // Create a temporary anchor element and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = `Spin-Wheel-Report-${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(link)
      link.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)

      toast.success("✅ Excel file downloaded successfully!")
    } catch (e) {
      console.error(e)
      toast.error("❌ Failed to export Excel file. Try again.")
    } finally {
      setTimeout(() => setIsExporting(false), 1000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 text-center">
      <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border-8 border-green-100">
        <FileSpreadsheet className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Download Campaign Report</h2>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Get a full comprehensive Excel (.xlsx) file containing all your campaign data across multiple neatly organized sheets.
      </p>

      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-left max-w-md mx-auto mb-8 shadow-sm">
        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Included Sheets:</h4>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> <strong>Participants:</strong> All details including OTP verified status.</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> <strong>Coupons:</strong> Codes, statuses, user claim links.</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> <strong>Stores:</strong> Scan counts and conversation metrics per store.</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> <strong>Prize Summary:</strong> Stock tracking and drop rates.</li>
        </ul>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="px-8 py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-3 mx-auto w-full max-w-md text-lg"
      >
        {isExporting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
        {isExporting ? "Generating Excel File..." : "Export All Data (Excel)"}
      </button>
    </div>
  )
}

/* ==================== SHARED COMPONENTS ==================== */
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400 font-medium animate-pulse">Loading dashboard data...</p>
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-20 max-w-sm mx-auto">
      <div className="w-16 h-16 bg-red-50 rounded-full flex justify-center items-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-gray-900 font-bold mb-2">Data Load Failed</h3>
      <p className="text-gray-500 text-sm mb-6">We couldn't reach the server right now. It might be a network issue.</p>
      <button onClick={onRetry} className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors">
        Try Again
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex justify-center items-center mx-auto mb-3">
        <Package className="w-8 h-8 text-gray-300" />
      </div>
      <p className="text-gray-400 font-medium text-sm">{message}</p>
    </div>
  )
}
