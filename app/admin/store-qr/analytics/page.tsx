"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import {
  BarChart3,
  TrendingUp,
  Store,
  QrCode,
  Download,
  RefreshCw,
  Eye,
  X,
  MapPin,
  MessageCircle,
  Instagram,
  Clock,
  ArrowLeft,
  Search,
  FileSpreadsheet,
  Calendar,
  Activity,
  Users,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import * as XLSX from "xlsx"
import Link from "next/link"

interface Overview {
  totalScans: number
  totalQRCodes: number
  activeQRCodes: number
  totalStores: number
  dateRange: string
}

interface DailyEntry {
  date: string
  scans: number
  google: number
  whatsapp: number
  instagram: number
}

interface MonthlyEntry {
  month: string
  scans: number
  google: number
  whatsapp: number
  instagram: number
}

interface TypeBreakdown {
  google_maps: number
  whatsapp: number
  instagram: number
}

interface TopStore {
  storeId: string
  storeName: string
  totalScans: number
  qrCount: number
  lastScanned: string | null
}

interface StoreDetail extends TopStore {
  dailyScans: Array<{ date: string; count: number }>
  types: {
    google_maps: any
    whatsapp: any
    instagram: any
  }
}

interface AnalyticsData {
  overview: Overview
  dailyData: DailyEntry[]
  monthlyData: MonthlyEntry[]
  typeBreakdown: TypeBreakdown
  topStores: TopStore[]
  storeDetails: StoreDetail[]
  allScans: Array<{
    timestamp: string
    storeName: string
    type: string
    ip: string
    userAgent: string
  }>
}

const TYPE_COLORS = {
  google_maps: "#4285F4",
  whatsapp: "#25D366",
  instagram: "#E4405F",
}

const TYPE_LABELS = {
  google_maps: "Google Review",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
}

const PIE_COLORS = ["#4285F4", "#25D366", "#E4405F"]

export default function StoreQRAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState("30d")
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeChart, setActiveChart] = useState<"daily" | "monthly">("daily")

  useEffect(() => {
    fetchAnalytics()
  }, [range])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/store-qr/analytics?range=${range}`)
      const json = await res.json()
      if (json.success) {
        setData(json)
      } else {
        toast.error("Failed to load analytics")
      }
    } catch {
      toast.error("Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  function downloadExcel() {
    if (!data) return

    const wb = XLSX.utils.book_new()

    // Sheet 1: Overview
    const overviewData = [
      { Metric: "Total Scans", Value: data.overview.totalScans },
      { Metric: "Total QR Codes", Value: data.overview.totalQRCodes },
      { Metric: "Active QR Codes", Value: data.overview.activeQRCodes },
      { Metric: "Stores with QR Codes", Value: data.overview.totalStores },
      { Metric: "Google Review Scans", Value: data.typeBreakdown.google_maps },
      { Metric: "WhatsApp Scans", Value: data.typeBreakdown.whatsapp },
      { Metric: "Instagram Scans", Value: data.typeBreakdown.instagram },
      { Metric: "Date Range", Value: data.overview.dateRange },
      { Metric: "Report Generated", Value: new Date().toLocaleString() },
    ]
    const wsOverview = XLSX.utils.json_to_sheet(overviewData)
    wsOverview["!cols"] = [{ wch: 25 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsOverview, "Overview")

    // Sheet 2: Daily Data
    if (data.dailyData.length > 0) {
      const dailyExport = data.dailyData.map((d) => ({
        Date: d.date,
        Total: d.scans,
        Google: d.google,
        WhatsApp: d.whatsapp,
        Instagram: d.instagram,
      }))
      const wsDaily = XLSX.utils.json_to_sheet(dailyExport)
      wsDaily["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Data")
    }

    // Sheet 3: Monthly Data
    if (data.monthlyData.length > 0) {
      const monthlyExport = data.monthlyData.map((m) => ({
        Month: m.month,
        Total: m.scans,
        Google: m.google,
        WhatsApp: m.whatsapp,
        Instagram: m.instagram,
      }))
      const wsMonthly = XLSX.utils.json_to_sheet(monthlyExport)
      XLSX.utils.book_append_sheet(wb, wsMonthly, "Monthly Data")
    }

    // Sheet 4: Store Rankings
    const storeExport = data.topStores.map((s, i) => ({
      Rank: i + 1,
      "Store Name": s.storeName,
      "Total Scans": s.totalScans,
      "QR Codes": s.qrCount,
      "Last Scanned": s.lastScanned ? new Date(s.lastScanned).toLocaleString() : "Never",
    }))
    const wsStores = XLSX.utils.json_to_sheet(storeExport)
    wsStores["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, wsStores, "Store Rankings")

    // Sheet 5: All Scan Records
    if (data.allScans.length > 0) {
      const scanExport = data.allScans.map((s) => ({
        Timestamp: new Date(s.timestamp).toLocaleString(),
        Store: s.storeName,
        Type: TYPE_LABELS[s.type as keyof typeof TYPE_LABELS] || s.type,
        "IP Address": s.ip,
        Device: s.userAgent?.substring(0, 80) || "",
      }))
      const wsScans = XLSX.utils.json_to_sheet(scanExport)
      wsScans["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 15 }, { wch: 16 }, { wch: 80 }]
      XLSX.utils.book_append_sheet(wb, wsScans, "All Scans")
    }

    const filename = `QR_Analytics_${range}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success("Report downloaded!")
  }

  const filteredStores =
    data?.storeDetails.filter((s) =>
      s.storeName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/store-qr"
              className="p-2 hover:bg-white rounded-lg border transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-blue-600" />
                QR Code Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Complete scan analytics across all stores
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={downloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download Excel
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
          {[
            { value: "7d", label: "7 Days" },
            { value: "30d", label: "30 Days" },
            { value: "90d", label: "90 Days" },
            { value: "1y", label: "1 Year" },
            { value: "all", label: "All Time" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No data available</p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.overview.totalScans.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total Scans</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <QrCode className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.overview.totalQRCodes}
                  </p>
                  <p className="text-xs text-gray-500">
                    QR Codes ({data.overview.activeQRCodes} active)
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Store className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.overview.totalStores}
                  </p>
                  <p className="text-xs text-gray-500">Stores</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.overview.totalStores > 0
                      ? Math.round(data.overview.totalScans / data.overview.totalStores)
                      : 0}
                  </p>
                  <p className="text-xs text-gray-500">Avg. Scans/Store</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Scan Trends</h2>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveChart("daily")}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${
                      activeChart === "daily"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setActiveChart("monthly")}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${
                      activeChart === "monthly"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {activeChart === "daily" ? (
                  <LineChart data={data.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="scans"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      name="Total"
                    />
                    <Line
                      type="monotone"
                      dataKey="google"
                      stroke="#4285F4"
                      strokeWidth={1.5}
                      dot={false}
                      name="Google"
                    />
                    <Line
                      type="monotone"
                      dataKey="whatsapp"
                      stroke="#25D366"
                      strokeWidth={1.5}
                      dot={false}
                      name="WhatsApp"
                    />
                    <Line
                      type="monotone"
                      dataKey="instagram"
                      stroke="#E4405F"
                      strokeWidth={1.5}
                      dot={false}
                      name="Instagram"
                    />
                  </LineChart>
                ) : (
                  <BarChart data={data.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="google"
                      fill="#4285F4"
                      name="Google"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="whatsapp"
                      fill="#25D366"
                      name="WhatsApp"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="instagram"
                      fill="#E4405F"
                      name="Instagram"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Type Breakdown Pie */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Platform Breakdown
              </h2>
              {data.overview.totalScans > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Google Review", value: data.typeBreakdown.google_maps },
                          { name: "WhatsApp", value: data.typeBreakdown.whatsapp },
                          { name: "Instagram", value: data.typeBreakdown.instagram },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {PIE_COLORS.map((color, index) => (
                          <Cell key={index} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {(["google_maps", "whatsapp", "instagram"] as const).map((type) => {
                      const count = data.typeBreakdown[type]
                      const pct = data.overview.totalScans > 0
                        ? Math.round((count / data.overview.totalScans) * 100)
                        : 0
                      const icons = {
                        google_maps: MapPin,
                        whatsapp: MessageCircle,
                        instagram: Instagram,
                      }
                      const Icon = icons[type]
                      return (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: TYPE_COLORS[type] }}
                            />
                            <Icon className="h-3.5 w-3.5" style={{ color: TYPE_COLORS[type] }} />
                            <span className="text-xs text-gray-600">
                              {TYPE_LABELS[type]}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-gray-900">
                              {count.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">
                              ({pct}%)
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No scan data yet
                </div>
              )}
            </div>
          </div>

          {/* Top Stores Bar Chart */}
          {data.topStores.length > 0 && (
            <div className="bg-white rounded-xl border p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Top Stores by Scans (Top 15)
              </h2>
              <ResponsiveContainer width="100%" height={Math.max(200, data.topStores.slice(0, 15).length * 36)}>
                <BarChart
                  data={data.topStores.slice(0, 15)}
                  layout="vertical"
                  margin={{ left: 120 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="storeName"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar dataKey="totalScans" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Store Details Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  Store Details ({filteredStores.length} stores)
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stores..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {filteredStores.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Store className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p>No stores found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                        #
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                        Store Name
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                        Total Scans
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                        QR Codes
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                        Last Scanned
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredStores.map((store, idx) => (
                      <tr key={store.storeId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {store.storeName}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-blue-600">
                            {store.totalScans.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{store.qrCount}/3</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {store.lastScanned
                            ? new Date(store.lastScanned).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedStore(store)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium"
                          >
                            <Eye className="h-3 w-3" />
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Store Detail Modal */}
      {selectedStore && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedStore.storeName}
                </h2>
                <p className="text-xs text-gray-500">
                  {selectedStore.totalScans.toLocaleString()} total scans · {selectedStore.qrCount} QR codes
                </p>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-70px)]">
              {/* QR Type Status */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(["google_maps", "whatsapp", "instagram"] as const).map((type) => {
                  const qr = selectedStore.types[type]
                  const icons = { google_maps: MapPin, whatsapp: MessageCircle, instagram: Instagram }
                  const Icon = icons[type]
                  return (
                    <div
                      key={type}
                      className={`rounded-xl p-3 text-center border ${
                        qr?.isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <Icon
                        className="h-5 w-5 mx-auto mb-1"
                        style={{ color: TYPE_COLORS[type] }}
                      />
                      <p className="text-xs font-medium text-gray-700">{TYPE_LABELS[type]}</p>
                      <p className="text-lg font-bold" style={{ color: TYPE_COLORS[type] }}>
                        {qr?.scanCount?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-gray-400">scans</p>
                    </div>
                  )
                })}
              </div>

              {/* Store mini chart */}
              {selectedStore.dailyScans.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Daily Scans for this Store
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={selectedStore.dailyScans.slice(-30)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* QR Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">QR Code Details</h3>
                <div className="space-y-2">
                  {(["google_maps", "whatsapp", "instagram"] as const).map((type) => {
                    const qr = selectedStore.types[type]
                    if (!qr) return null
                    return (
                      <div
                        key={type}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${TYPE_COLORS[type]}20` }}
                        >
                          {type === "google_maps" && (
                            <MapPin className="h-4 w-4" style={{ color: TYPE_COLORS[type] }} />
                          )}
                          {type === "whatsapp" && (
                            <MessageCircle className="h-4 w-4" style={{ color: TYPE_COLORS[type] }} />
                          )}
                          {type === "instagram" && (
                            <Instagram className="h-4 w-4" style={{ color: TYPE_COLORS[type] }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {TYPE_LABELS[type]}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {qr.targetUrl}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: TYPE_COLORS[type] }}>
                            {qr.scanCount?.toLocaleString() || 0} scans
                          </p>
                          {qr.lastScannedAt && (
                            <p className="text-xs text-gray-400">
                              Last: {new Date(qr.lastScannedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
