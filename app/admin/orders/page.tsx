"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { Search, ArrowUpDown, Eye, Edit } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import * as XLSX from "xlsx"
import { products } from "@/lib/mock-data"
import BulkStatusUpload from "../orders/bulk-update/page"
import PaymentBadge from "@/app/components/PaymentBadge"

interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
  type?: 'product' | 'software'
}

interface Customer {
  name: string
  email: string
  address?: string
}

interface Order {
  id: string
  orderId?: string
  userId: string
  items: OrderItem[]
  customer: Customer
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  createdAt: string
  updatedAt: string
  trackingNumber?: string
  subtotal?: number
  paymentMethod?: string
  paymentDetails?: {
    transactionId?: string
    paymentId?: string
    verifiedEmail?: string
    employeeId?: string
  }
  source?: 'direct' | 'partner'
  partnerName?: string
  partnerId?: string
  razorpayPaymentDetails?: {
    razorpayOrderId?: string
    transactionId?: string
    method?: string
    amount?: number
  }
  commission?: {
    rate?: number
    amount?: number
    status?: string
  }
  paymentVerification?: {
    verified: boolean
    verifiedAt?: string
    verifiedBy?: string
  }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<keyof Order>("createdAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [trackingModal, setTrackingModal] = useState<{ orderId: string; status: Order["status"] } | null>(null)
  const [trackingInput, setTrackingInput] = useState("")
  const [itemsPerPage] = useState(10)
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()

  useEffect(() => {
    const fetchOrders = async () => {
      console.log("-----------------------------------------")
      console.log("!!! ADMIN ORDERS PAGE - VERSION 2.4 !!!")
      console.log("-----------------------------------------")
      setIsLoading(true)
      setError(null)

      try {
        console.log("[Admin Orders] 📡 Fetching /api/orders...")
        const response = await apiFetch(`/api/orders?t=${Date.now()}`, { cache: 'no-store' })
        console.log("[Admin Orders] 📥 Response status:", response.status)

        if (!response.ok) {
          console.error("[Admin Orders] ❌ Fetch failed with status:", response.status)
          throw new Error("Failed to fetch orders")
        }

        // Safely parse JSON — response may be empty which causes response.json() to throw.
        let data: any = []
        try {
          const text = await response.text()
          console.log("[Admin Orders] 📄 Response text length:", text.length)
          data = text ? JSON.parse(text) : []
          console.log("[Admin Orders] ✅ Orders fetched:", data.length, "orders")
          console.log("[Admin Orders] 📊 First 2 orders:", data.slice(0, 2))
        } catch (parseErr) {
          console.warn("[Admin Orders] ⚠️ Failed to parse JSON, using empty array", parseErr)
          data = []
        }
        setOrders(data)

        // After fetching, attempt to auto-assign licenses for new orders that need it
        try {
          // process in background without blocking UI
          setTimeout(() => {
            processNewOrders(data)
          }, 200)
        } catch (procErr) {
          console.warn('[Admin Orders] Failed to start auto-assign process', procErr)
        }
      } catch (err) {
        console.error("[Admin Orders] ❌ Error fetching orders:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setIsLoading(false)
        console.log("[Admin Orders] 🏁 fetchOrders completed")
      }
    }

    fetchOrders()
  }, [])

  // Check orders and call assign-license for orders with software items whose provider is null
  const processNewOrders = async (ordersToProcess: Order[]) => {
    if (!ordersToProcess || !Array.isArray(ordersToProcess)) return

    try {
      const processedRaw = localStorage.getItem('assignLicenseProcessed')
      const processed: Set<string> = new Set(processedRaw ? JSON.parse(processedRaw) : [])

      for (const order of ordersToProcess) {
        if (processed.has(order.id)) continue

        // find software items that are not from an external provider
        const softwareItems = (order.items || []).filter(it => (it as any).type === 'software' && !(it as any).provider)
        if (softwareItems.length === 0) continue

        // Skip if order already has licenseKeys sufficient for requested quantities
        const existingKeys = (order as any).licenseKeys || []
        const totalRequested = softwareItems.reduce((s, it) => s + (Number((it as any).quantity) || 1), 0)
        if (existingKeys.length >= totalRequested) {
          // mark processed so we don't check again
          processed.add(order.id)
          continue
        }

        console.log('[Admin Orders] Auto-assigning licenses for order', order.id)

        for (const item of softwareItems) {
          try {
            const payload: any = {
              softwareId: (item as any).kgenProductId || (item as any).id,
              validity: (item as any).validity || undefined,
              validityYears: (item as any).validityYears || undefined,
              maxDevices: (item as any).maxDevices || 1,
              quantity: Number((item as any).quantity || 1)
            }

            const resp = await apiFetch(`/api/orders/${order.id}/assign-license`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })

            const jr = await resp.json().catch(() => null)
            console.log('[Admin Orders] assign-license result for', order.id, jr)

            if (resp.ok && jr && jr.data && Array.isArray(jr.data.licenseKeys) && jr.data.licenseKeys.length > 0) {
              // refresh the single order from server so we pick up status/timeline changes
              try {
                const updatedResp = await apiFetch(`/api/orders/${order.id}`)
                if (updatedResp.ok) {
                  const updatedOrder = await updatedResp.json().catch(() => null)
                  if (updatedOrder) {
                    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o))
                  }
                } else {
                  // fallback: append licenseKeys locally
                  setOrders(prev => prev.map(o => o.id === order.id ? { ...o, licenseKeys: ((o as any).licenseKeys || []).concat(jr.data.licenseKeys) } as any : o))
                }
              } catch (refreshErr) {
                console.warn('[Admin Orders] Failed to refresh order after assign-license', refreshErr)
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, licenseKeys: ((o as any).licenseKeys || []).concat(jr.data.licenseKeys) } as any : o))
              }
            }
          } catch (e) {
            console.warn('[Admin Orders] assign-license failed for order', order.id, e)
          }
        }

        // mark processed for now to avoid repeated attempts
        processed.add(order.id)
      }

      localStorage.setItem('assignLicenseProcessed', JSON.stringify(Array.from(processed)))
    } catch (e) {
      console.warn('[Admin Orders] processNewOrders error', e)
    }
  }

  const handleSort = (field: keyof Order) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: Order["status"]) => {
    console.log("[Admin Orders] 🔄 Status change requested - Order ID:", orderId, "New Status:", newStatus)

    if (newStatus === "shipped") {
      console.log("[Admin Orders] 🚚 Shipped status requires tracking number")
      setTrackingModal({ orderId, status: newStatus })
      setTrackingInput("")
      return
    }

    try {
      console.log("[Admin Orders] 📡 Sending PUT request to /api/orders/", orderId)
      const response = await apiFetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })
      console.log("[Admin Orders] 📥 Response status:", response.status)

      if (!response.ok) {
        console.error("[Admin Orders] ❌ Update failed with status:", response.status)
        throw new Error("Failed to update order status")
      }

      console.log("[Admin Orders] ✅ Order status updated successfully")
      // Update order in state
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date().toISOString() } : order,
        ),
      )

      toast.success("Order status updated! Customer will receive an email notification.")

      // Also update in localStorage as fallback
      try {
        console.log("[Admin Orders] 💾 Updating localStorage...")
        const storedOrders = localStorage.getItem("orders")
        if (storedOrders) {
          const orders = JSON.parse(storedOrders)
          const updatedOrders = orders.map((order: Order) =>
            order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date().toISOString() } : order,
          )
          localStorage.setItem("orders", JSON.stringify(updatedOrders))
          console.log("[Admin Orders] ✅ localStorage updated")
        }
      } catch (localError) {
        console.error("Error updating localStorage:", localError)
      }
    } catch (err) {
      console.error("Error updating order status:", err)
      toast.error(err instanceof Error ? err.message : "An unknown error occurred")
    }
  }

  const submitTracking = async () => {
    if (!trackingModal) return
    const trackingNumber = trackingInput.trim()
    if (!trackingNumber) return

    const { orderId, status } = trackingModal
    console.log("[Admin Orders] 📝 Tracking number provided:", trackingNumber)

    try {
      const response = await apiFetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, trackingNumber }),
      })

      if (!response.ok) throw new Error("Failed to update order status")

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status, trackingNumber, updatedAt: new Date().toISOString() }
            : o
        )
      )
      setTrackingModal(null)
      setTrackingInput("")
      toast.success("Order marked as shipped with tracking number!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unknown error occurred")
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.orderId && order.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.partnerName && order.partnerName.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesSource = sourceFilter === "all" || (order.source || 'direct') === sourceFilter

    return matchesSearch && matchesStatus && matchesSource
  })

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const valA = a[sortField];

    const valB = b[sortField];

    if (sortField === "createdAt" || sortField === "updatedAt") {
      const dateA = new Date(valA as string).getTime()
      const dateB = new Date(valB as string).getTime()
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA
    }

    if (valA === undefined || valB === undefined) return 0;

    if (valA < valB) {
      return sortDirection === "asc" ? -1 : 1
    }
    if (valA > valB) {
      return sortDirection === "asc" ? 1 : -1
    }
    return 0
  })

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentOrders = sortedOrders.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "shipped":
        return "bg-purple-100 text-purple-800"
      case "delivered":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPurchaseType = (items: OrderItem[]) => {
    const hasSoftware = items.some(item => item.type === 'software')
    const hasHardware = items.some(item => item.type !== 'software')

    if (hasSoftware && hasHardware) return 'Both'
    if (hasSoftware) return 'Software'
    return 'Hardware'
  }

  const getPurchaseTypeBadge = (type: string) => {
    switch (type) {
      case 'Software':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Hardware':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Both':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  // Export logic
  const handleExport = () => {
    console.log("[Admin Orders] 📤 Export requested")
    console.log("[Admin Orders] 📅 Date range - From:", fromDate || "N/A", "To:", toDate || "N/A")
    console.log("[Admin Orders] 📊 Total orders before filter:", sortedOrders.length)

    // Filter orders by date range
    const filtered = sortedOrders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      const from = fromDate ? new Date(fromDate) : null
      const to = toDate ? new Date(toDate) : null
      if (from && orderDate < from) return false
      if (to && orderDate > to) return false
      return true
    })

    console.log("[Admin Orders] ✅ Filtered orders:", filtered.length)

    // Define all columns as requested
    const columns = [
      "Object Type", "Type", "Branch", "Branch Name", "InvNo", "InvDate", "Payment Type", "So Number", "So Date",
      "Customer/Vendor Code", "CustomerName", "Mobile No", "Customer GroupName", "Row Number", "Item No.", "ItemName",
      "Warehouse Code", "Quantity", "Brand Name", "Item Group Name", "Serial Number", "Purchase Date", "MOP", "MOP1",
      "MOP2", "Account Code", "AcctName", "Tax Code", "IGST Rate", "IGST Tax value", "SGST+CGST Rate",
      "SGST + CGST Tax value", "Total tax", "DocTotal", "Incentive", "last purchase price", "Sales Employee Name",
      "SalesValue", "GrossSalesValue", "NLC Price", "NLC GP", "NLC GP%", "ItemCost", "ItemCost GP", "ItemCost GP%",
      "SellOutValue", "SellInValue", "PriceDropValue", "SlabAmount", "NNLC Value"
    ]

    // Prepare rows for Excel
    const rows: any[] = []
    filtered.forEach((order) => {
      order.items.forEach((item, idx) => {
        rows.push({
          "Object Type": "",
          "Type": "Sales",
          "Branch": "SYONWH",
          "Branch Name": "Sara Mobiles and Electronics  Online WareHouse",
          "InvNo": order.id,
          "InvDate": new Date(order.createdAt).toLocaleDateString(),
          "Payment Type": "others",
          "So Number": "",
          "So Date": "",
          "Customer/Vendor Code": "",
          "CustomerName": order.customer?.name || "",
          "Mobile No": (order.customer as any)?.phone || "",
          "Customer GroupName": "",
          "Row Number": idx + 1,
          "Item No.": item.productId || "",
          "ItemName": item.name || "",
          "Warehouse Code": "",
          "Quantity": item.quantity,
          "Brand Name": "",
          "Item Group Name": "",
          "Serial Number": "",
          "Purchase Date": new Date(order.createdAt).toLocaleDateString(),
          "MOP": order.subtotal || "",
          "MOP1": item.price || "",
          "MOP2": "",
          "Account Code": "",
          "AcctName": "",
          "Tax Code": "GST-18",
          "IGST Rate": "",
          "IGST Tax value": "",
          "SGST+CGST Rate": "",
          "SGST + CGST Tax value": "",
          "Total tax": (order as any).tax || "",
          "DocTotal": order.total || "",
          "Incentive": "",
          "last purchase price": "",
          "Sales Employee Name": "",
          "SalesValue": "",
          "GrossSalesValue": "",
          "NLC Price": "",
          "NLC GP": "",
          "NLC GP%": "",
          "ItemCost": "",
          "ItemCost GP": "",
          "ItemCost GP%": "",
          "SellOutValue": "",
          "SellInValue": "",
          "PriceDropValue": "",
          "SlabAmount": "",
          "NNLC Value": ""
        })
      })
    })

    console.log("[Admin Orders] 📝 Preparing Excel data - Total rows:", rows.length)

    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(rows, { header: columns })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report")

    const filename = `sales_report_${fromDate || "all"}_to_${toDate || "all"}.xlsx`
    console.log("[Admin Orders] 💾 Exporting file:", filename)

    // Export to Excel
    XLSX.writeFile(wb, filename)
    console.log("[Admin Orders] ✅ Export completed successfully")
  }

  // Download an Excel template for bulk status upload
  const handleDownloadTemplate = () => {
    console.log("[Admin Orders] 📥 Template download requested")
    const columns = ["Order ID", "Status", "Tracking Number"]
    const example = [
      { "Order ID": "order_12345", Status: "shipped", "Tracking Number": "TRACK123456" },
    ]
    const ws = XLSX.utils.json_to_sheet(example, { header: columns })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    XLSX.writeFile(wb, "bulk_status_template.xlsx")
  }

  if (authLoading) return null

  if (!user || !canAccessAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <div className="text-xs text-gray-500 mt-1 flex gap-3">
            <span>Total: <span className="font-bold text-gray-700">{orders.length}</span></span>
            <span>Direct: <span className="font-bold text-blue-600">{orders.filter(o => o.source !== 'partner').length}</span></span>
            <span>Partner: <span className="font-bold text-purple-600">{orders.filter(o => o.source === 'partner').length}</span></span>
          </div>
        </div>
        {/* Export controls */}
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            placeholder="From"
          />
          <span className="mx-1">to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            placeholder="To"
          />
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            Export Sales Report
          </button>
        </div>
      </div>

      {/* Bulk status upload */}
      <div className="mb-4 flex items-start gap-3">
        <BulkStatusUpload
          onComplete={(result) => {
            setOrders((prev) => {
              return prev.map((o) => {
                const match = result.success.find((r) => r.orderId === o.id)
                if (!match) return o
                return {
                  ...o,
                  status: match.status as Order["status"],
                  trackingNumber: match.trackingNumber || o.trackingNumber,
                  updatedAt: new Date().toISOString(),
                }
              })
            })
          }}
        />
        {/* <div className="mt-2">
          <button
            onClick={handleDownloadTemplate}
            className="ml-2 px-3 py-1 bg-slate-600 text-white rounded text-sm"
          >
            Download template
          </button>
        </div> */}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-4 md:space-y-0">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md pl-10"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Sources</option>
              <option value="direct">Direct Orders</option>
              <option value="partner">Partner Orders</option>
            </select>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mb-1">
                🚀 LIVE SYSTEM v2.4
              </span>
              <span className="text-xs text-gray-500 font-mono">
                Total: {orders.length} |
                Direct: {orders.filter(o => o.source !== 'partner').length} |
                Partner: {orders.filter(o => o.source === 'partner').length}
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto border rounded-lg shadow-sm">
            <table className="min-w-[1300px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("id")}
                  >
                    <div className="flex items-center">
                      Order ID
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Source
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Verified
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("customer")}
                  >
                    <div className="flex items-center">
                      Customer
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("total")}
                  >
                    <div className="flex items-center">
                      Total
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      Status
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center">
                      Date
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchase Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Details
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900" title={order.orderId || order.id}>
                          #{order.orderId || (order.id.length > 10 ? `${order.id.substring(0, 4)}...${order.id.slice(-4)}` : order.id)}
                        </div>
                        {order.source === 'partner' && order.partnerName && (
                          <div className="mt-1">
                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-purple-100 text-purple-700 border border-purple-200">
                              via {order.partnerName}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {order.source === 'partner' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            🤝 Partner
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                            Direct
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {order.source === 'partner' ? (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={async () => {
                                const orderId = (order as any).orderId || order.id
                                const isVerified = order.paymentVerification?.verified
                                try {
                                  const res = await apiFetch(
                                    `/api/admin/partners/orders/${orderId}/verify-payment`,
                                    {
                                      method: isVerified ? 'DELETE' : 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ verifiedBy: 'Admin' }),
                                    }
                                  )
                                  const data = await res.json()
                                  if (data.success) {
                                    setOrders(prev => prev.map(o =>
                                      o.id === order.id
                                        ? {
                                          ...o,
                                          paymentVerification: isVerified
                                            ? { verified: false }
                                            : { verified: true, verifiedAt: new Date().toISOString(), verifiedBy: 'Admin' },
                                        }
                                        : o
                                    ))
                                  }
                                } catch (err) {
                                  console.error('Verify payment error:', err)
                                }
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${order.paymentVerification?.verified
                                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                : 'bg-red-100 text-red-800 border-red-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                                }`}
                            >
                              {order.paymentVerification?.verified ? '✓ YES' : '✗ NO'}
                            </button>
                            {order.paymentVerification?.verified && order.paymentVerification?.verifiedBy && (
                              <div className="text-[10px] text-gray-500">
                                by {order.paymentVerification.verifiedBy}
                                {order.paymentVerification.verifiedAt && (
                                  <> at {new Date(order.paymentVerification.verifiedAt).toLocaleDateString('en-IN')}</>)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.customer.name}</div>
                        <div className="text-sm text-gray-500">{order.customer.email}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {order.source === 'partner' ? (
                          (() => {
                            const commissionAmt = order.commission?.amount || 0
                            const netAmount = order.total - commissionAmt
                            return (
                              <>
                                <div className="text-sm font-semibold text-gray-900">₹{netAmount.toLocaleString('en-IN')}</div>
                                {/* <div className="text-xs text-gray-500 mt-0.5">
                                  commission: ₹{commissionAmt.toLocaleString('en-IN')}
                                </div> */}
                              </>
                            )
                          })()
                        ) : (
                          <div className="text-sm font-semibold text-gray-900">₹{order.total.toLocaleString('en-IN')}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as Order["status"])}
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(order.createdAt)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getPurchaseTypeBadge(getPurchaseType(order.items))}`}>
                          {getPurchaseType(order.items)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-2">
                          {/* Payment Method Badge */}
                          <div className="flex items-center">
                            <PaymentBadge method={order.paymentMethod ?? 'unknown'} />
                          </div>

                          {/* In-store Purchase Details */}
                          {order.paymentMethod === 'instore' && (
                            <div className="bg-purple-50 p-2 rounded-md border border-purple-100">
                              <div className="flex flex-col space-y-1">
                                <div className="text-gray-700 text-[11px] flex items-center">
                                  <span className="font-medium min-w-20">Emp ID:</span>
                                  <span className="ml-1">{order.paymentDetails?.employeeId}</span>
                                </div>
                                {order.paymentDetails?.verifiedEmail && (
                                  <div className="text-gray-700 text-[11px] flex items-center">
                                    <span className="font-medium min-w-20">Email:</span>
                                    <span className="ml-1 text-purple-600 truncate max-w-[120px]">{order.paymentDetails.verifiedEmail}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Razorpay Online Payment Details (Direct) */}
                          {order.paymentMethod === 'razorpay' && order.paymentDetails && (
                            <div className="bg-blue-50 p-2 rounded-md border border-blue-100">
                              <div className="flex flex-col space-y-1">
                                {(order.paymentDetails as any).razorpayOrderId && (
                                  <div className="text-[10px] text-gray-700 flex items-center">
                                    <span className="font-medium min-w-20">RZP Order:</span>
                                    <span className="ml-1 font-mono text-blue-700">
                                      {(order.paymentDetails as any).razorpayOrderId}
                                    </span>
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-700 flex items-center">
                                  <span className="font-medium min-w-20">Txn ID:</span>
                                  <span className="ml-1 text-blue-600 font-mono">
                                    {order.paymentDetails.transactionId || order.paymentDetails.paymentId}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Partner Razorpay Details (Prepaid) */}
                          {order.source === 'partner' && order.razorpayPaymentDetails && (
                            <div className="bg-indigo-50 p-2 rounded-md border border-indigo-100 shadow-sm">
                              <div className="flex flex-col space-y-1">
                                <div className="text-[10px] text-gray-600 flex items-center">
                                  <span className="font-medium min-w-20">RZP Order:</span>
                                  <span className="ml-1 font-mono text-gray-800 font-bold">{order.razorpayPaymentDetails.razorpayOrderId || '—'}</span>
                                </div>
                                <div className="text-[10px] text-gray-600 flex items-center">
                                  <span className="font-medium min-w-20">Txn ID:</span>
                                  <span className="ml-1 font-mono text-indigo-700 font-bold">{order.razorpayPaymentDetails.transactionId || '—'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/orders/${order.id}`}>
                          <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                            <Eye className="h-4 w-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedOrders.length)} of{" "}
            {sortedOrders.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {[...Array(totalPages)].map((_, index) => (
              <button
                key={index + 1}
                onClick={() => handlePageChange(index + 1)}
                className={`px-3 py-1 border rounded-md text-sm ${currentPage === index + 1
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-50"
                  }`}
              >
                {index + 1}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Tracking Number Modal */}
      {trackingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Tracking Number</h2>
              <p className="text-sm text-gray-500 mb-4">
                Provide the tracking number to mark this order as shipped.
              </p>
              <input
                type="text"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="e.g. TRK-123456789"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") submitTracking() }}
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setTrackingModal(null); setTrackingInput("") }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={submitTracking}
                  disabled={!trackingInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm &amp; Ship
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
