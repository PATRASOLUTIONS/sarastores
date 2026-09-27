"use client"


import { apiFetch } from "@/lib/api-client"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Store, Package, ShoppingBag, Calendar, User, Download, ArrowLeft, ChevronRight } from "lucide-react"
import { toast } from "react-hot-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface InstoreOrder {
  id: string
  total: number
  status: string
  createdAt: string
  items: {
    id: string
    name: string
    price: number
    quantity: number
    image?: string
  }[]
  paymentMethod?: string
  paymentDetails?: {
    employeeId?: string
    verifiedEmail?: string
    verifiedAt?: string
  }
  customer?: {
    name?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  shippingAddress?: {
    name?: string
    street?: string
    city?: string
    state?: string
    zip?: string
  }
}

export default function InstorePurchasesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [instoreOrders, setInstoreOrders] = useState<InstoreOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalProcessed: 0,
    totalAmount: 0,
    thisMonth: 0,
    thisWeek: 0,
  })
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "processing" | "delivered">("all")

  useEffect(() => {
    if (user?.email) {
      fetchInstorePurchases()
    }
  }, [user])

  const fetchInstorePurchases = async () => {
    if (!user || !user.email) return

    setIsLoading(true)
    try {
      const response = await apiFetch(`/api/orders?employeeId=${encodeURIComponent(user.email)}`)
      if (response.ok) {
        const orders = await response.json()
        // Filter to only show in-store purchases
        const instoreOnly = orders.filter((order: InstoreOrder) => 
          order.paymentMethod === 'instore' || 
          order.paymentDetails?.verifiedEmail === user.email
        )
        setInstoreOrders(instoreOnly)

        // Calculate statistics
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))

        const thisMonthOrders = instoreOnly.filter((order: InstoreOrder) => 
          new Date(order.createdAt) >= startOfMonth
        )
        const thisWeekOrders = instoreOnly.filter((order: InstoreOrder) => 
          new Date(order.createdAt) >= startOfWeek
        )

        setStats({
          totalProcessed: instoreOnly.length,
          totalAmount: instoreOnly.reduce((sum: number, order: InstoreOrder) => sum + order.total, 0),
          thisMonth: thisMonthOrders.length,
          thisWeek: thisWeekOrders.length,
        })
      } else {
        toast.error("Failed to fetch in-store purchases")
      }
    } catch (error) {
      console.error("Error fetching in-store purchases:", error)
      toast.error("Error loading in-store purchases")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOrders = filter === "all" 
    ? instoreOrders 
    : instoreOrders.filter(order => order.status === filter)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "confirmed":
        return "bg-purple-100 text-purple-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-800 mb-4"></div>
          <p className="text-gray-600">Loading in-store purchases...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">Please log in to view in-store purchases.</p>
        </div>
      </div>
    )
  }

  if (instoreOrders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Store className="h-6 w-6 text-purple-600" />
                In-Store Purchases
              </h1>
              <p className="text-gray-600 text-sm mt-1">Orders you've processed as a store employee</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No In-Store Purchases Yet</h2>
          <p className="text-gray-600 mb-4">
            You haven't processed any in-store purchases yet.
          </p>
          <p className="text-sm text-gray-500">
            In-store purchases you process will appear here for tracking and reference.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6 text-purple-600" />
              In-Store Purchases
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Orders processed by {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <Package className="h-8 w-8 text-purple-600" />
            <span className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
              All Time
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-900">{stats.totalProcessed}</p>
          <p className="text-sm text-purple-700">Total Orders Processed</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="h-8 w-8 text-blue-600" />
            <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">
              Revenue
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-900">₹{stats.totalAmount.toLocaleString("en-IN")}</p>
          <p className="text-sm text-blue-700">Total Sales Amount</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="h-8 w-8 text-green-600" />
            <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">
              This Month
            </span>
          </div>
          <p className="text-2xl font-bold text-green-900">{stats.thisMonth}</p>
          <p className="text-sm text-green-700">Orders This Month</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="h-8 w-8 text-orange-600" />
            <span className="text-xs font-medium text-orange-600 bg-orange-200 px-2 py-1 rounded-full">
              This Week
            </span>
          </div>
          <p className="text-2xl font-bold text-orange-900">{stats.thisWeek}</p>
          <p className="text-sm text-orange-700">Orders This Week</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All ({instoreOrders.length})
          </button>
          <button
            onClick={() => setFilter("confirmed")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "confirmed"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Confirmed ({instoreOrders.filter(o => o.status === "confirmed").length})
          </button>
          <button
            onClick={() => setFilter("processing")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "processing"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Processing ({instoreOrders.filter(o => o.status === "processing").length})
          </button>
          <button
            onClick={() => setFilter("delivered")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === "delivered"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Delivered ({instoreOrders.filter(o => o.status === "delivered").length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-gradient-to-r from-brand-primary-subtle to-brand-primary-light px-6 py-4 border-b">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-semibold text-lg">Order #{order.id}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-900">₹{order.total.toLocaleString("en-IN")}</p>
                      <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Customer Information */}
                <div className="mb-4 pb-4 border-b">
                  <div className="flex items-start gap-2 mb-2">
                    <User className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">Customer Details</p>
                      {order.customer && (
                        <div className="mt-1 text-sm text-gray-600">
                          <p className="font-medium">
                            {order.customer.name || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'N/A'}
                          </p>
                          {order.customer.email && <p>{order.customer.email}</p>}
                          {order.customer.phone && <p>{order.customer.phone}</p>}
                        </div>
                      )}
                      {order.shippingAddress && (
                        <p className="mt-1 text-xs text-gray-500">
                          {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
                        </p>
                      )}
                    </div>
                  </div>
                  {order.paymentDetails?.employeeId && (
                    <p className="text-xs text-purple-600 mt-2">
                      <span className="font-medium">Employee ID:</span> {order.paymentDetails.employeeId}
                    </p>
                  )}
                </div>

                {/* Order Items */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Order Items ({order.items.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {order.items.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                        <div className="w-16 h-16 bg-white rounded overflow-hidden flex-shrink-0 border">
                          <img
                            src={item.image || "/placeholder.svg?height=64&width=64"}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-600">
                            ₹{item.price.toLocaleString("en-IN")} × {item.quantity}
                          </p>
                          <p className="text-sm font-semibold text-purple-700">
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {/* <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Link
                    href={`/dashboard/orders`}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    View Full Details
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <a
                    href={`/api/orders/${order.id}/invoice`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
                  >
                    <Download className="h-4 w-4" />
                    Download Invoice
                  </a>
                </div> */}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
