"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import {
    Phone,
    Mail,
    User,
    Trash2,
    Clock,
    CheckCircle,
    Archive,
    MessageSquare,
    RefreshCw,
    Search,
} from "lucide-react"

interface ContactInquiry {
    _id: string
    name: string
    email: string
    phone: string
    status: "new" | "contacted" | "resolved" | "archived"
    createdAt: string
    updatedAt: string
}

const STATUS_COLORS: Record<string, string> = {
    new: "bg-blue-100 text-blue-800",
    contacted: "bg-yellow-100 text-yellow-800",
    resolved: "bg-green-100 text-green-800",
    archived: "bg-gray-100 text-gray-800",
}

const STATUS_LABELS: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    resolved: "Resolved",
    archived: "Archived",
}

export default function ContactInquiriesPage() {
    const [inquiries, setInquiries] = useState<ContactInquiry[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [updating, setUpdating] = useState<string | null>(null)

    useEffect(() => {
        fetchInquiries()
    }, [])

    const fetchInquiries = async () => {
        try {
            setLoading(true)
            const response = await apiFetch("/api/contact-inquiries")
            const data = await response.json()
            if (data.success) {
                setInquiries(data.inquiries)
            } else {
                toast.error("Failed to fetch inquiries")
            }
        } catch (error) {
            console.error("Error fetching inquiries:", error)
            toast.error("An error occurred while fetching inquiries")
        } finally {
            setLoading(false)
        }
    }

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            setUpdating(id)
            const response = await apiFetch("/api/contact-inquiries", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: newStatus }),
            })

            const data = await response.json()
            if (data.success) {
                toast.success("Status updated successfully")
                fetchInquiries()
            } else {
                toast.error(data.error || "Failed to update status")
            }
        } catch (error) {
            console.error("Error updating status:", error)
            toast.error("An error occurred")
        } finally {
            setUpdating(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this inquiry?")) return

        try {
            const response = await apiFetch(`/api/contact-inquiries?id=${id}`, {
                method: "DELETE",
            })

            const data = await response.json()
            if (data.success) {
                toast.success("Inquiry deleted successfully")
                fetchInquiries()
            } else {
                toast.error(data.error || "Failed to delete inquiry")
            }
        } catch (error) {
            console.error("Error deleting inquiry:", error)
            toast.error("An error occurred")
        }
    }

    const filteredInquiries = inquiries.filter((inquiry) => {
        const matchesStatus = statusFilter === "all" || inquiry.status === statusFilter
        const matchesSearch =
            inquiry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inquiry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inquiry.phone.includes(searchQuery)
        return matchesStatus && matchesSearch
    })

    const getStatusCount = (status: string) => {
        return inquiries.filter((i) => i.status === status).length
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600">Loading contact inquiries...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                    Contact Inquiries
                </h1>
                <p className="text-gray-600 mt-2">
                    Manage contact form submissions from Sara Mobiles and Electronics customers
                </p>
            </div>

            {/* Status Filter Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <button
                    onClick={() => setStatusFilter("all")}
                    className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "all"
                            ? "border-blue-500 bg-blue-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <div className="text-2xl font-bold text-gray-900">{inquiries.length}</div>
                    <div className="text-sm text-gray-600">All Inquiries</div>
                </button>

                {["new", "contacted", "resolved", "archived"].map((status) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`p-4 rounded-xl border-2 transition-all ${statusFilter === status
                                ? "border-blue-500 bg-blue-50 shadow-md"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                    >
                        <div className="text-2xl font-bold text-gray-900">{getStatusCount(status)}</div>
                        <div className="text-sm text-gray-600">{STATUS_LABELS[status]}</div>
                    </button>
                ))}
            </div>

            {/* Search and Refresh */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <button
                    onClick={fetchInquiries}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                >
                    <RefreshCw className="h-5 w-5" />
                    Refresh
                </button>
            </div>

            {/* Inquiries Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Customer Details
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Contact Info
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredInquiries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500 text-lg">No inquiries found</p>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {statusFilter !== "all"
                                                ? "Try changing the filter or search criteria"
                                                : "Contact inquiries will appear here when customers submit the form"}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInquiries.map((inquiry) => (
                                    <tr key={inquiry._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                    {inquiry.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{inquiry.name}</div>
                                                    <div className="text-sm text-gray-500">Customer</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Mail className="h-4 w-4 text-gray-400" />
                                                    <a href={`mailto:${inquiry.email}`} className="hover:text-blue-600">
                                                        {inquiry.email}
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Phone className="h-4 w-4 text-gray-400" />
                                                    <a href={`tel:${inquiry.phone}`} className="hover:text-blue-600">
                                                        {inquiry.phone}
                                                    </a>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={inquiry.status}
                                                onChange={(e) => handleStatusUpdate(inquiry._id, e.target.value)}
                                                disabled={updating === inquiry._id}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[inquiry.status]} ${updating === inquiry._id ? "opacity-50" : ""
                                                    }`}
                                            >
                                                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900">
                                                {new Date(inquiry.createdAt).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(inquiry.createdAt).toLocaleTimeString("en-IN", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={`tel:${inquiry.phone}`}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="Call"
                                                >
                                                    <Phone className="h-5 w-5" />
                                                </a>
                                                <a
                                                    href={`mailto:${inquiry.email}`}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Email"
                                                >
                                                    <Mail className="h-5 w-5" />
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(inquiry._id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary Stats */}
            {inquiries.length > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-gray-600">
                                {getStatusCount("new")} new inquiries pending response
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-gray-600">{getStatusCount("contacted")} in progress</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600">{getStatusCount("resolved")} resolved</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
