"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import AdminHeader from "@/components/AdminHeader"
import { CreditCard, Search, DollarSign, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "react-hot-toast"

interface Payment {
  _id: string
  razorpayOrderId: string
  razorpayPaymentId: string
  status: string
  method: string
  createdAt: string
  amount?: number
  orderDetails?: any[]
}

export default function PaymentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    // Mirror checkAdminAuthorization(): superadmin and dashboardAccess staff are
    // allowed by the API, so the page must not bounce them.
    const allowed =
      user && (user.role === "admin" || user.role === "superadmin" || user.dashboardAccess === true)
    if (user && !allowed) {
      router.push("/login")
      return
    }

    fetchPayments()
  }, [user, router])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const response = await apiFetch("/api/payments")
      const data = await response.json()

      if (data.success) {
        setPayments(data.payments)
      } else {
        toast.error("Failed to fetch payments")
      }
    } catch (error) {
      console.error("Error fetching payments:", error)
      toast.error("Failed to fetch payments")
    } finally {
      setLoading(false)
    }
  }

  const [activeTab, setActiveTab] = useState<"direct" | "instore">("direct")

  const filteredPayments = payments.filter((payment) => {
    // Search Filter
    const matchesSearch =
      payment.razorpayPaymentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.razorpayOrderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment._id.toLowerCase().includes(searchTerm.toLowerCase())

    // Status Filter
    const matchesStatus = filterStatus === "all" || payment.status === filterStatus

    // Tab Filter (Method based)
    // We assume 'instore', 'cash', 'pos' are in-store methods. Everything else is Direct/Online.
    const method = payment.method?.toLowerCase() || ""
    const isInstore = method === "cash" || method === "pos" || method.includes("store")

    // If Tab is Direct: Show if NOT instore
    // If Tab is Instore: Show if IS instore
    const matchesTab = activeTab === "direct" ? !isInstore : isInstore

    return matchesSearch && matchesStatus && matchesTab
  })

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredPayments.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage)

  const totalAmount = payments.reduce((sum, payment) => {
    const amount = payment.amount ?? payment.orderDetails?.[0]?.totalAmount ?? 0
    return sum + amount
  }, 0)

  const completedPayments = payments.filter((p) => p.status === "completed").length
  const pendingPayments = payments.filter((p) => p.status === "pending").length

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* <AdminHeader toggleSidebar={() => setSidebarOpen(!sidebarOpen)} /> */}

        <div className="max-w-7xl mx-auto w-full px-6 py-8 h-full overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              <div className="bg-maroon-600 rounded-lg p-2 text-white">
                <CreditCard className="h-8 w-8" />
              </div>
              Payment History
            </h1>
            <p className="text-gray-500 mt-2 ml-14">View and manage all payment transactions across channels.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
                <div className="bg-green-100 p-2.5 rounded-full text-green-600">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-auto">₹{totalAmount.toLocaleString("en-IN")}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Completed</p>
                <div className="bg-blue-100 p-2.5 rounded-full text-blue-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-auto">{completedPayments}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending</p>
                <div className="bg-yellow-100 p-2.5 rounded-full text-yellow-600">
                  <XCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-auto">{pendingPayments}</p>
            </div>
          </div>

          {/* TABS & FILTERS CONTAINER */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            {/* TABS */}
            <div className="border-b border-gray-200 px-6 pt-6 pb-0 flex gap-8">
              <button
                onClick={() => setActiveTab('direct')}
                className={`pb-4 text-sm font-semibold border-b-2 transition-all ${activeTab === 'direct'
                    ? 'border-maroon-600 text-maroon-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Direct Payment
              </button>
              <button
                onClick={() => setActiveTab('instore')}
                className={`pb-4 text-sm font-semibold border-b-2 transition-all ${activeTab === 'instore'
                    ? 'border-maroon-600 text-maroon-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                In-Store Purchase Payment
              </button>
            </div>

            {/* FILTERS TOOLBAR */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payment ID or Order ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500 bg-white min-w-[150px]"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-maroon-600 mx-auto"></div>
                  <p className="mt-4 text-sm text-gray-500">Syncing transactions...</p>
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                    {activeTab === 'direct' ? <CreditCard className="h-8 w-8" /> : <DollarSign className="h-8 w-8" />}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No {activeTab === 'direct' ? 'Direct' : 'In-Store'} Payments Found</h3>
                  <p className="text-gray-500 mt-1 max-w-sm mx-auto">
                    {activeTab === 'direct'
                      ? "There are no online payment records matching your criteria."
                      : "No in-store transactions have been recorded yet."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase font-semibold tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Payment ID</th>
                      <th className="px-6 py-4">Order Ref</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Method</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {currentItems.map((payment) => {
                      const order = payment.orderDetails?.[0]
                      const orderObjectId = order?._id || order?.id || payment._id
                      const amount = payment.amount ?? order?.totalAmount ?? 0

                      return (
                        <tr key={payment._id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-gray-600 select-all">{payment.razorpayPaymentId || "-"}</td>
                          <td className="px-6 py-4 font-mono text-gray-500 text-xs">{orderObjectId || "-"}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {amount > 0 ? `₹${amount.toLocaleString("en-IN")}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="capitalize px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                              {payment.method || "Unknown"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-0.5 inline-flex items-center gap-1.5 rounded-full text-xs font-medium border ${payment.status === "completed"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : payment.status === "pending"
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${payment.status === "completed" ? "bg-green-500" :
                                  payment.status === "pending" ? "bg-yellow-500" : "bg-red-500"
                                }`}></span>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {new Date(payment.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* PAGINATION */}
            {!loading && filteredPayments.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
