"use client"

import { apiFetch } from "@/lib/api-client"
import QRCode from "qrcode"
import { generateA5Pamphlet, generateSinglePamphlet } from "@/lib/qr-pamphlet"
import type { QRType } from "@/lib/qr-pamphlet"
import { useState, useEffect, useCallback } from "react"
import { toast } from "react-hot-toast"
import Link from "next/link"
import {
  QrCode,
  Plus,
  Trash2,
  Edit,
  X,
  Save,
  Download,
  MapPin,
  MessageCircle,
  Instagram,
  BarChart3,
  Eye,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Store,
  Smartphone,
  TrendingUp,
  Activity,
  Layers,
  FileDown,
  Loader2,
} from "lucide-react"

interface StoreLocation {
  id: string
  shopName: string
  locationDescription: string
  googleMapLocation: string
  mobileNo: string
  shopTiming: string
  shopImage: string
  emailId: string
  isActive: boolean
}

interface QRCodeItem {
  id: string
  storeId: string
  storeName: string
  type: "google_maps" | "whatsapp" | "instagram"
  label: string
  targetUrl: string
  qrDataUrl?: string
  scanCount: number
  lastScannedAt: string | null
  scanHistory: ScanEntry[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ScanEntry {
  timestamp: string
  userAgent: string
  referer: string
  ip: string
}

const DEFAULT_URLS: Record<string, string> = {
  whatsapp: "https://whatsapp.com/channel/0029Va6Q9GO35fLwtGQiLr0u",
  instagram: "https://www.instagram.com/saramobilesandelectronics/",
}

const QR_TYPES = [
  { value: "google_maps", label: "Google Maps Review", icon: MapPin, color: "#4285F4", placeholder: "https://maps.app.goo.gl/..." },
  { value: "whatsapp", label: "WhatsApp Channel", icon: MessageCircle, color: "#25D366", placeholder: "https://whatsapp.com/channel/...", fixed: true },
  { value: "instagram", label: "Instagram Profile", icon: Instagram, color: "#E4405F", placeholder: "https://instagram.com/...", fixed: true },
]

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  google_maps: { icon: MapPin, color: "#4285F4", bg: "bg-blue-50", label: "Google Maps" },
  whatsapp: { icon: MessageCircle, color: "#25D366", bg: "bg-green-50", label: "WhatsApp" },
  instagram: { icon: Instagram, color: "#E4405F", bg: "bg-pink-50", label: "Instagram" },
}

export default function StoreQRPage() {
  const [stores, setStores] = useState<StoreLocation[]>([])
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [selectedQR, setSelectedQR] = useState<QRCodeItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStore, setFilterStore] = useState("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkStores, setBulkStores] = useState<string[]>([])
  const [bulkSelectAll, setBulkSelectAll] = useState(true)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, storeName: "" })
  const [pamphletGenerating, setPamphletGenerating] = useState(false)

  const [createForm, setCreateForm] = useState({
    storeId: "",
    type: "google_maps" as string,
    label: "",
    targetUrl: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [storesRes, qrRes] = await Promise.all([
        apiFetch("/api/admin/store-locations"),
        apiFetch("/api/admin/store-qr"),
      ])
      const storesData = await storesRes.json()
      const qrData = await qrRes.json()
      if (storesData.success) setStores(storesData.stores || [])
      if (qrData.success) setQrCodes(qrData.qrCodes || [])
    } catch {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!createForm.storeId || !createForm.targetUrl) {
      toast.error("Please select a store and enter a URL")
      return
    }
    try {
      const store = stores.find((s) => s.id === createForm.storeId)
      const res = await apiFetch("/api/admin/store-qr", {
        method: "POST",
        json: { ...createForm, storeName: store?.shopName || "" },
      })
      const data = await res.json()
      if (data.success) {
        toast.success("QR code created successfully")
        setShowCreateModal(false)
        setCreateForm({ storeId: "", type: "google_maps", label: "", targetUrl: "" })
        fetchData()
      } else {
        toast.error(data.message || "Failed to create QR code")
      }
    } catch {
      toast.error("Failed to create QR code")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this QR code?")) return
    try {
      const res = await apiFetch(`/api/admin/store-qr/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast.success("QR code deleted")
        fetchData()
      } else {
        toast.error(data.message || "Failed to delete")
      }
    } catch {
      toast.error("Failed to delete QR code")
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    try {
      const res = await apiFetch(`/api/admin/store-qr/${id}`, {
        method: "PUT",
        json: { isActive: !current },
      })
      const data = await res.json()
      if (data.success) {
        toast.success(current ? "QR code deactivated" : "QR code activated")
        fetchData()
      }
    } catch {
      toast.error("Failed to update")
    }
  }

  async function downloadQR(qr: QRCodeItem) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sarastores.com"
      const scanUrl = `${siteUrl}/api/store-qr/scan/${qr.id}`
      const dataUrl = await QRCode.toDataURL(scanUrl, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      })
      const link = document.createElement("a")
      const base64 = dataUrl.split(",")[1]
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: "image/png" })
      const blobUrl = URL.createObjectURL(blob)
      link.href = blobUrl
      link.download = `QR-${qr.storeName.replace(/[^a-zA-Z0-9]/g, "_")}-${qr.type}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      toast.success("QR code downloaded")
    } catch {
      toast.error("Failed to generate QR code for download")
    }
  }

  function copyScanLink(qr: QRCodeItem) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sarastores.com"
    const scanUrl = `${siteUrl}/api/store-qr/scan/${qr.id}`
    navigator.clipboard.writeText(scanUrl)
    setCopiedId(qr.id)
    toast.success("Scan link copied!")
    setTimeout(() => setCopiedId(null), 2000)
  }

  function openAnalytics(qr: QRCodeItem) {
    setSelectedQR(qr)
    setShowAnalyticsModal(true)
  }

  async function handleBulkGenerate() {
    const ids = bulkSelectAll
      ? stores.filter((s) => s.isActive).map((s) => s.id)
      : bulkStores

    if (ids.length === 0) {
      toast.error("Please select at least one store")
      return
    }

    setBulkGenerating(true)
    setBulkProgress({ current: 0, total: ids.length, storeName: "" })

    try {
      const res = await apiFetch("/api/admin/store-qr/bulk", {
        method: "POST",
        json: { storeIds: ids },
      })
      const data = await res.json()
      if (data.success) {
        toast.success(
          `Created ${data.summary.totalCreated} QR codes across ${data.summary.storesProcessed} stores`
        )
        if (data.summary.totalSkipped > 0) {
          toast(`Skipped ${data.summary.totalSkipped} (already exist or no URL)`, {
            icon: "⚠️",
          })
        }
        setShowBulkModal(false)
        setBulkStores([])
        fetchData()
      } else {
        toast.error(data.message || "Failed to generate QR codes")
      }
    } catch {
      toast.error("Failed to generate QR codes in bulk")
    } finally {
      setBulkGenerating(false)
      setBulkProgress({ current: 0, total: 0, storeName: "" })
    }
  }

  async function downloadA5Pamphlet(type?: QRType) {
    const storeId = filterStore
    if (storeId === "all") {
      toast.error("Please select a specific store from the filter to download its pamphlet")
      return
    }

    const store = stores.find((s) => s.id === storeId)
    if (!store) {
      toast.error("Store not found")
      return
    }

    const storeQRs = qrCodes.filter((qr) => qr.storeId === storeId && qr.isActive)
    if (storeQRs.length === 0) {
      toast.error("No active QR codes found for this store. Generate QR codes first.")
      return
    }

    setPamphletGenerating(true)
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sarastores.com"
      const qrData = storeQRs.map((qr) => ({
        type: qr.type,
        scanUrl: `${siteUrl}/api/store-qr/scan/${qr.id}`,
        targetUrl: qr.targetUrl,
      }))

      if (type) {
        // Download single type
        const qr = qrData.find((q) => q.type === type)
        if (!qr) {
          toast.error(`No ${type} QR code found for this store`)
          return
        }
        await generateSinglePamphlet({
          storeName: store.shopName,
          storeAddress: store.locationDescription,
          storeTiming: store.shopTiming,
          type: qr.type,
          scanUrl: qr.scanUrl,
        })
        toast.success("Pamphlet downloaded!")
      } else {
        // Download all 3
        const types: QRType[] = ["google_maps", "whatsapp", "instagram"]
        const finalQRs = types.map((t) => {
          const existing = qrData.find((q) => q.type === t)
          return existing || { type: t, scanUrl: "", targetUrl: "" }
        })
        await generateA5Pamphlet({
          storeName: store.shopName,
          storeAddress: store.locationDescription,
          storeTiming: store.shopTiming,
          qrCodes: finalQRs,
        })
        toast.success("All 3 pamphlets downloaded!")
      }
    } catch {
      toast.error("Failed to generate pamphlet")
    } finally {
      setPamphletGenerating(false)
    }
  }

  const filteredQR = qrCodes.filter((qr) => {
    const matchesSearch =
      qr.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qr.label.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStore = filterStore === "all" || qr.storeId === filterStore
    return matchesSearch && matchesStore
  })

  const totalScans = qrCodes.reduce((sum, qr) => sum + qr.scanCount, 0)
  const activeCount = qrCodes.filter((qr) => qr.isActive).length
  const storeCount = new Set(qrCodes.map((qr) => qr.storeId)).size

  const selectedType = QR_TYPES.find((t) => t.value === createForm.type)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <QrCode className="h-7 w-7 text-blue-600" />
              Store QR Codes
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Generate QR codes for Google Maps, WhatsApp & Instagram — track scans per store
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/store-qr/analytics"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Link>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
            >
              <Layers className="h-4 w-4" />
              Bulk Generate (All Stores)
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Generate QR Code
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <QrCode className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{qrCodes.length}</p>
              <p className="text-xs text-gray-500">Total QR Codes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalScans.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Scans</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs text-gray-500">Active QR Codes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Store className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{storeCount}</p>
              <p className="text-xs text-gray-500">Stores with QR Codes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by store name or label..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shopName}
              </option>
            ))}
          </select>
        </div>

        {/* Pamphlet Download Row - only when a store is selected */}
        {filterStore !== "all" && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <FileDown className="h-3.5 w-3.5" />
                <span className="font-medium">Download A5 Pamphlet:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadA5Pamphlet("google_maps")}
                  disabled={pamphletGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium border border-blue-200 disabled:opacity-50"
                >
                  {pamphletGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                  Google Review
                </button>
                <button
                  onClick={() => downloadA5Pamphlet("whatsapp")}
                  disabled={pamphletGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-xs font-medium border border-green-200 disabled:opacity-50"
                >
                  {pamphletGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                  WhatsApp
                </button>
                <button
                  onClick={() => downloadA5Pamphlet("instagram")}
                  disabled={pamphletGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 text-xs font-medium border border-pink-200 disabled:opacity-50"
                >
                  {pamphletGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Instagram className="h-3 w-3" />}
                  Instagram
                </button>
                <div className="w-px bg-gray-200 self-stretch" />
                <button
                  onClick={() => downloadA5Pamphlet()}
                  disabled={pamphletGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium disabled:opacity-50"
                >
                  {pamphletGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                  Download All 3
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Codes Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredQR.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No QR codes found</p>
          <p className="text-sm text-gray-400 mt-1">
            {qrCodes.length === 0
              ? "Click 'Generate QR Code' to create your first one"
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQR.map((qr) => {
            const config = TYPE_CONFIG[qr.type]
            const Icon = config.icon
            return (
              <div
                key={qr.id}
                className={`bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow ${
                  !qr.isActive ? "opacity-60" : ""
                }`}
              >
                {/* Type Badge */}
                <div className="px-4 py-3 border-b" style={{ backgroundColor: `${config.color}10` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: config.color }}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{config.label}</span>
                        <p className="text-xs text-gray-500">{qr.storeName}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(qr.id, qr.isActive)}
                      className="text-gray-400 hover:text-gray-600"
                      title={qr.isActive ? "Deactivate" : "Activate"}
                    >
                      {qr.isActive ? (
                        <ToggleRight className="h-6 w-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* QR Code Preview */}
                <div className="p-4">
                  {qr.qrDataUrl ? (
                    <div className="flex justify-center mb-3">
                      <img
                        src={qr.qrDataUrl}
                        alt={`QR - ${config.label}`}
                        className="w-36 h-36 border border-gray-100 rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="w-36 h-36 mx-auto mb-3 bg-gray-100 rounded-lg flex items-center justify-center">
                      <QrCode className="h-10 w-10 text-gray-300" />
                    </div>
                  )}

                  {/* Label */}
                  {qr.label && (
                    <p className="text-xs text-gray-500 text-center mb-2 truncate">"{qr.label}"</p>
                  )}

                  {/* Scan Stats */}
                  <div className="flex items-center justify-center gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1 text-blue-600">
                      <BarChart3 className="h-4 w-4" />
                      <span className="font-semibold">{qr.scanCount.toLocaleString()}</span>
                      <span className="text-gray-400">scans</span>
                    </div>
                    {qr.lastScannedAt && (
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        <Clock className="h-3 w-3" />
                        {new Date(qr.lastScannedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Target URL */}
                  <div className="bg-gray-50 rounded-lg p-2 mb-3">
                    <p className="text-xs text-gray-500 truncate" title={qr.targetUrl}>
                      {qr.targetUrl}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadQR(qr)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                    <button
                      onClick={() => copyScanLink(qr)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-xs font-medium"
                    >
                      {copiedId === qr.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedId === qr.id ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      onClick={() => openAnalytics(qr)}
                      className="px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-xs font-medium"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(qr.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create QR Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Generate QR Code</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Store Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Store *</label>
                <select
                  value={createForm.storeId}
                  onChange={(e) => setCreateForm({ ...createForm, storeId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a store...</option>
                  {stores
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shopName} — {s.locationDescription?.substring(0, 40)}
                      </option>
                    ))}
                </select>
              </div>

              {/* QR Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QR Code Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {QR_TYPES.map((t) => {
                    const Icon = t.icon
                    const isSelected = createForm.type === t.value
                    return (
                      <button
                        key={t.value}
                        onClick={() => setCreateForm({ ...createForm, type: t.value, targetUrl: DEFAULT_URLS[t.value] || "" })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${t.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: t.color }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={createForm.label}
                  onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
                  placeholder="e.g. Main entrance counter, Billing desk"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Target URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedType?.label} URL *
                </label>
                <input
                  type="url"
                  value={createForm.targetUrl}
                  onChange={(e) => setCreateForm({ ...createForm, targetUrl: e.target.value })}
                  placeholder={selectedType?.placeholder}
                  readOnly={!!QR_TYPES.find((t) => t.value === createForm.type && (t as any).fixed)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent read-only:bg-gray-50 read-only:text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {QR_TYPES.find((t) => t.value === createForm.type && (t as any).fixed)
                    ? "This link is common for all stores and cannot be changed"
                    : "When someone scans the QR, they'll be redirected to this URL"}
                </p>
              </div>

              {/* Preview */}
              {createForm.storeId && createForm.targetUrl && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">PREVIEW</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${selectedType?.color}15` }}
                    >
                      {selectedType && <selectedType.icon className="h-6 w-6" style={{ color: selectedType.color }} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {stores.find((s) => s.id === createForm.storeId)?.shopName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Scan → redirects to {createForm.targetUrl.substring(0, 50)}...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <QrCode className="h-4 w-4" />
                Generate QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Layers className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Bulk Generate QR Codes</h2>
                  <p className="text-xs text-gray-500">
                    Create 3 QR codes (Google Maps, WhatsApp, Instagram) per store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {bulkGenerating ? (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 text-emerald-600 mx-auto mb-4 animate-spin" />
                  <p className="text-lg font-semibold text-gray-900">Generating QR Codes...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Processing {bulkProgress.total} stores
                  </p>
                  <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          bulkProgress.total > 0
                            ? (bulkProgress.current / bulkProgress.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    This may take a few minutes for 70+ stores
                  </p>
                </div>
              ) : (
                <>
                  {/* Select All Toggle */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={bulkSelectAll}
                        onChange={(e) => {
                          setBulkSelectAll(e.target.checked)
                          if (e.target.checked) setBulkStores([])
                        }}
                        className="h-4 w-4 text-emerald-600 rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          All Active Stores ({stores.filter((s) => s.isActive).length})
                        </p>
                        <p className="text-xs text-gray-500">
                          Creates 3 QR codes per store = up to{" "}
                          {stores.filter((s) => s.isActive).length * 3} QR codes
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Store list (when not select all) */}
                  {!bulkSelectAll && (
                    <div className="max-h-64 overflow-y-auto border rounded-xl mb-4">
                      {stores
                        .filter((s) => s.isActive)
                        .map((store) => {
                          const existingCount = qrCodes.filter(
                            (qr) => qr.storeId === store.id
                          ).length
                          const hasAll = existingCount >= 3
                          return (
                            <label
                              key={store.id}
                              className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-gray-50 ${
                                hasAll ? "opacity-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={bulkStores.includes(store.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setBulkStores([...bulkStores, store.id])
                                  } else {
                                    setBulkStores(bulkStores.filter((id) => id !== store.id))
                                  }
                                }}
                                disabled={hasAll}
                                className="h-4 w-4 text-emerald-600 rounded"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {store.shopName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {store.locationDescription?.substring(0, 50)}
                                </p>
                              </div>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  hasAll
                                    ? "bg-green-100 text-green-700"
                                    : existingCount > 0
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {existingCount}/3 QR codes
                              </span>
                            </label>
                          )
                        })}
                    </div>
                  )}

                  {/* Info box */}
                  <div className="bg-blue-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-800 font-medium mb-1">What gets created:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> Google Maps — links to the store&apos;s Google Maps location
                      </li>
                      <li className="flex items-center gap-2">
                        <MessageCircle className="h-3 w-3" /> WhatsApp — links to Sara Electronics WhatsApp channel
                      </li>
                      <li className="flex items-center gap-2">
                        <Instagram className="h-3 w-3" /> Instagram — links to Sara Electronics Instagram profile
                      </li>
                    </ul>
                    <p className="text-xs text-blue-600 mt-2">
                      Stores that already have a QR code for a type will be skipped for that type.
                    </p>
                  </div>
                </>
              )}
            </div>

            {!bulkGenerating && (
              <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkGenerate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                  <Layers className="h-4 w-4" />
                  Generate QR Codes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && selectedQR && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Scan Analytics</h2>
                  <p className="text-xs text-gray-500">
                    {TYPE_CONFIG[selectedQR.type]?.label} — {selectedQR.storeName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-70px)]">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{selectedQR.scanCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Scans</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {selectedQR.scanHistory.length > 0
                      ? Math.round(
                          selectedQR.scanCount /
                            Math.max(
                              1,
                              (Date.now() -
                                new Date(selectedQR.createdAt).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                        )
                      : 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Avg. Scans/Day</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-lg font-bold text-purple-600">
                    {selectedQR.lastScannedAt
                      ? new Date(selectedQR.lastScannedAt).toLocaleDateString()
                      : "Never"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Last Scanned</p>
                </div>
              </div>

              {/* Scan History Table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Recent Scans ({selectedQR.scanHistory.length})
                </h3>
                {selectedQR.scanHistory.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-8 text-center">
                    <Smartphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No scans recorded yet</p>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Timestamp</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">IP Address</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Device</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedQR.scanHistory
                          .slice()
                          .reverse()
                          .slice(0, 50)
                          .map((scan, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-700">
                                {new Date(scan.timestamp).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-gray-500 font-mono text-xs">{scan.ip}</td>
                              <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-[200px]">
                                {scan.userAgent.substring(0, 60)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Scan Link */}
              <div className="mt-4 bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">SCAN URL (share this link or embed in QR)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white px-3 py-2 rounded-lg border text-gray-700 overflow-x-auto">
                    {process.env.NEXT_PUBLIC_SITE_URL || "https://sarastores.com"}/api/store-qr/scan/{selectedQR.id}
                  </code>
                  <button
                    onClick={() => copyScanLink(selectedQR)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 whitespace-nowrap"
                  >
                    {copiedId === selectedQR.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
