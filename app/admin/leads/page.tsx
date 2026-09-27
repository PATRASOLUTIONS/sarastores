"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, useCallback } from "react"
import {
    Search,
    Filter,
    Download,
    Trash2,
    Eye,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Users,
    Phone,
    Mail,
    MapPin,
    Tag,
    Clock,
    X,
    RefreshCw,
    Loader2,
    FileSpreadsheet,
    ArrowUpDown,
    Settings,
    Globe,
    FileText,
} from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

interface Lead {
    _id: string
    name: string
    phone: string
    email: string
    pincode: string
    category: string
    source: string
    status: string
    createdAt: string
    updatedAt: string
}

interface Pagination {
    total: number
    page: number
    limit: number
    totalPages: number
}

const STATUS_OPTIONS = [
    { value: "all", label: "All", color: "bg-gray-100 text-gray-700" },
    { value: "new", label: "New", color: "bg-blue-100 text-blue-700" },
    { value: "contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-700" },
    { value: "interested", label: "Interested", color: "bg-purple-100 text-purple-700" },
    { value: "converted", label: "Converted", color: "bg-green-100 text-green-700" },
    { value: "closed", label: "Closed", color: "bg-red-100 text-red-700" },
]

const getStatusColor = (status: string) => {
    const found = STATUS_OPTIONS.find(s => s.value === status)
    return found?.color || "bg-gray-100 text-gray-700"
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function AdminLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [sortOrder, setSortOrder] = useState("latest")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [categories, setCategories] = useState<string[]>([])
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [whatsappNumber, setWhatsappNumber] = useState("")
    const [whatsappTemplate, setWhatsappTemplate] = useState("Hello {name}, thank you for participating in our Lucky Draw!")
    const [exporting, setExporting] = useState(false)
    const [sourceFilter, setSourceFilter] = useState("all")
    const [allSources, setAllSources] = useState<string[]>([])

    // Fetch distinct source pages
    useEffect(() => {
        const fetchSources = async () => {
            try {
                const res = await apiFetch("/api/leads?limit=1000")
                const data = await res.json()
                if (data.success && data.leads) {
                    const sources = Array.from(new Set(data.leads.map((l: Lead) => l.source).filter(Boolean))) as string[]
                    setAllSources(sources.sort())
                }
            } catch (e) { console.error("[leads] fetch error", e) }
        }
        fetchSources()
    }, [])

    // Fetch settings for categories and WhatsApp config
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await apiFetch("/api/leads/settings")
                const data = await res.json()
                if (data.success && data.settings) {
                    setCategories(data.settings.categories || [])
                    setWhatsappNumber(data.settings.whatsappNumber || "")
                    setWhatsappTemplate(data.settings.whatsappTemplate || "Hello {name}, thank you for participating in our Lucky Draw!")
                }
            } catch (e) { console.error("[leads] fetch error", e) }
        }
        fetchSettings()
    }, [])

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set("search", search)
            if (statusFilter !== "all") params.set("status", statusFilter)
            if (categoryFilter !== "all") params.set("category", categoryFilter)
            if (sourceFilter !== "all") params.set("source", sourceFilter)
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)
            params.set("sort", sortOrder)
            params.set("page", String(pagination.page))
            params.set("limit", String(pagination.limit))

            const res = await apiFetch(`/api/leads?${params.toString()}`)
            const data = await res.json()

            if (data.success) {
                setLeads(data.leads)
                setPagination(data.pagination)
            } else {
                toast.error("Failed to fetch leads")
            }
        } catch {
            toast.error("Failed to fetch leads")
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, categoryFilter, sourceFilter, startDate, endDate, sortOrder, pagination.page, pagination.limit])

    useEffect(() => {
        fetchLeads()
    }, [fetchLeads])

    // Debounced search
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
    const handleSearchChange = (val: string) => {
        setSearch(val)
        if (searchTimeout) clearTimeout(searchTimeout)
        const t = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }))
        }, 400)
        setSearchTimeout(t)
    }

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        try {
            const res = await apiFetch("/api/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: leadId, status: newStatus }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Status updated")
                setLeads(prev =>
                    prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l)
                )
            } else {
                toast.error(data.error || "Failed to update status")
            }
        } catch (e) {
            console.error("[leads] status update error", e)
            toast.error("Failed to update status")
        }
    }

    const handleDelete = async (leadId: string) => {
        if (!confirm("Are you sure you want to delete this lead?")) return
        try {
            const res = await apiFetch(`/api/leads?id=${leadId}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("Lead deleted")
                fetchLeads()
            } else {
                toast.error(data.error || "Failed to delete")
            }
        } catch {
            toast.error("Failed to delete lead")
        }
    }

    const handleWhatsApp = (lead: Lead) => {
        const phone = whatsappNumber || lead.phone
        const message = whatsappTemplate.replace("{name}", lead.name)
        const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
        window.open(url, "_blank")
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set("search", search)
            if (statusFilter !== "all") params.set("status", statusFilter)
            if (categoryFilter !== "all") params.set("category", categoryFilter)
            if (sourceFilter !== "all") params.set("source", sourceFilter)
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)
            params.set("sort", sortOrder)

            const res = await apiFetch(`/api/leads/export?${params.toString()}`)
            if (!res.ok) throw new Error("Export failed")

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success("Export downloaded successfully")
        } catch {
            toast.error("Failed to export leads")
        } finally {
            setExporting(false)
        }
    }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-"
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    // Count leads by status
    const statusCounts = leads.reduce((acc: Record<string, number>, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1
        return acc
    }, {})

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="h-6 w-6 text-blue-600" />
                        Lead Management
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {pagination.total} total leads captured
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/leads/settings"
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                    <button
                        onClick={fetchLeads}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                        Export to Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                {/* Search & Basic Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={categoryFilter}
                        onChange={e => { setCategoryFilter(e.target.value);
 setPagination(p => ({ ...p, page: 1 })) }}
                    >
                        <option value="all">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <select
                        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={sourceFilter}
                        onChange={e => { setSourceFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                    >
                        <option value="all">All Source Pages</option>
                        {allSources.map(src => (
                            <option key={src} value={src}>{src}</option>
                        ))}
                    </select>
                    <select
                        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value)}
                    >
                        <option value="latest">Latest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>

                {/* Date Range */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <input
                            type="date"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                        />
                        <span className="text-gray-400">to</span>
                        <input
                            type="date"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={() => { setStartDate(""); setEndDate(""); setPagination(p => ({ ...p, page: 1 })) }}
                            className="text-sm text-red-500 hover:text-red-700"
                        >
                            Clear dates
                        </button>
                    )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(s => (
                        <button
                            key={s.value}
                            onClick={() => { setStatusFilter(s.value); setPagination(p => ({ ...p, page: 1 })) }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                statusFilter === s.value
                                    ? s.color + " ring-2 ring-offset-1 ring-blue-400"
                                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                            }`}
                        >
                            {s.label}
                            {s.value !== "all" && statusCounts[s.value] ? (
                                <span className="ml-1.5 text-xs">({statusCounts[s.value]})</span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-gray-500">Loading leads...</span>
                    </div>
                ) : leads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Users className="h-12 w-12 mb-4" />
                        <p className="text-lg font-medium">No leads found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Email</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Pincode</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Category</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                                        <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Source Page</span>
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Date</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leads.map(lead => (
                                    <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <a href={`tel:${lead.phone}`} className="hover:text-blue-600">{lead.phone}</a>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                                            {lead.email ? (
                                                <a href={`mailto:${lead.email}`} className="hover:text-blue-600">{lead.email}</a>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{lead.pincode || "-"}</td>
                                        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{lead.category || "-"}</td>
                                        <td className="px-4 py-3">
                                            {lead.source ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                                    <FileText className="h-3 w-3" />
                                                    {lead.source}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={lead.status}
                                                onChange={e => handleStatusChange(lead._id, e.target.value)}
                                                className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(lead.status)}`}
                                            >
                                                {STATUS_OPTIONS.filter(s => s.value !== "all").map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                                            {formatDate(lead.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => { setSelectedLead(lead); setShowDetailModal(true) }}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleWhatsApp(lead)}
                                                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="Send WhatsApp"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(lead._id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>Rows per page:</span>
                            <select
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                                value={pagination.limit}
                                onChange={e => setPagination(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
                            >
                                {PAGE_SIZES.map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                            <span>
                                Showing {((pagination.page - 1) * pagination.limit) + 1}-
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                                disabled={pagination.page <= 1}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-sm text-gray-600 px-2">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                                disabled={pagination.page >= pagination.totalPages}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDetailModal(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-lg font-semibold text-gray-900">Lead Details</h3>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Users className="h-3 w-3" /> Name</p>
                                    <p className="font-medium text-gray-900">{selectedLead.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Phone className="h-3 w-3" /> Phone</p>
                                    <p className="font-medium text-gray-900">{selectedLead.phone}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Mail className="h-3 w-3" /> Email</p>
                                    <p className="font-medium text-gray-900">{selectedLead.email || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin className="h-3 w-3" /> Pincode</p>
                                    <p className="font-medium text-gray-900">{selectedLead.pincode || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Tag className="h-3 w-3" /> Category</p>
                                    <p className="font-medium text-gray-900">{selectedLead.category || "-"}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Globe className="h-3 w-3" /> Source Page</p>
                                    {selectedLead.source ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                                            <FileText className="h-3.5 w-3.5" />
                                            {selectedLead.source}
                                        </span>
                                    ) : (
                                        <p className="font-medium text-gray-400">Not recorded</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Filter className="h-3 w-3" /> Status</p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedLead.status)}`}>
                                        {selectedLead.status.charAt(0).toUpperCase() + selectedLead.status.slice(1)}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Clock className="h-3 w-3" /> Date</p>
                                    <p className="font-medium text-gray-900 text-sm">{formatDate(selectedLead.createdAt)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                            <button
                                onClick={() => handleWhatsApp(selectedLead)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                                <MessageSquare className="h-4 w-4" />
                                Send WhatsApp
                            </button>
                            <button
                                onClick={() => { handleDelete(selectedLead._id); setShowDetailModal(false) }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
