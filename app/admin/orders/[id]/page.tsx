"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, useRef } from "react"
import { use } from "react" // Add this import
import { ArrowLeft, Package, Truck, Check, X, Clock, User, Mail, MapPin, Phone, Calendar, Key } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"

interface OrderItem {
  id?: string
  productId: string
  name: string
  price: number
  quantity: number
  image?: string
  type?: 'product' | 'software'
  maxDevices?: number
  validityYears?: number
  licenseKey?: string
  packSize?: number
  // integration fields
  provider?: string
  kgenProductId?: string
  kgenVariantId?: string
}

interface Customer {
  name: string
  email: string
  address?: string | {
    line1: string;

    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  }
  phone?: string
}

interface Order {
  id: string
  orderId?: string
  userId: string
  items: OrderItem[]
  customer: Customer
  total: number
  subtotal: number
  tax: number
  shipping: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  paymentMethod: string
  paymentDetails?: {
    cardLast4?: string | number
    [key: string]: unknown
  }
  createdAt: string
  updatedAt: string
  trackingNumber?: string
  licenseKey?: string
  licenseAssignedAt?: string
  timeline?: Array<{ date: string; status: string; description?: string }>
  coupon?: {
    code: string
    name: string
    discount: number
  }
  cancellation?: {
    reason: string
    note: string
    date: string
    refundStatus?: 'pending' | 'processed' | 'declined'
  }
  // Partner fields
  source?: 'direct' | 'partner'
  partnerId?: string
  partnerName?: string
  partnerOrderId?: string
  commission?: number | {
    amount?: number
    rate?: number
  }
  razorpayPaymentDetails?: {
    razorpayOrderId?: string
    transactionId?: string
    method?: string
    amount?: number
  }
  paymentVerification?: {
    verified: boolean
    verifiedAt?: string
    verifiedBy?: string
  }
  notification?: { emailSent: boolean | null }
  licenseKeys?: string[]
}

interface ExternalQueueEntry {
  provider?: string
  queueId?: string
  externalOrderId?: string
  id?: string
  status?: string
  createdAt?: string
  note?: string
}

interface Voucher {
  voucherCode?: string
  code?: string
  voucher?: string
  voucherPin?: string
  expirationDate?: string
}

interface ExternalDetail {
  queueId?: string | null
  externalOrderId?: string | null
  error?: string
  data?: {
    id?: string
    response?: {
      data?: {
        lineItems?: LineItem[]
        vouchers?: Voucher[]
      }
    }
    [key: string]: unknown
  }
}

interface LineItem {
  vouchers?: Voucher[]
}


export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params) // ✅ unwrap the params
  const id = unwrappedParams.id
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isAssigningLicense, setIsAssigningLicense] = useState(false)
  const [isRetryingExternal, setIsRetryingExternal] = useState(false)
  const [retryResult, setRetryResult] = useState<Record<string, unknown> | null>(null)
  const [externalDetails, setExternalDetails] = useState<ExternalDetail[]>([])
  const [placedVouchers, setPlacedVouchers] = useState<Voucher[] | null>(null)
  const [showPlacedModal, setShowPlacedModal] = useState(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [trackingInput, setTrackingInput] = useState("")
  const pendingStatusRef = useRef<{ status: Order["status"] } | null>(null)
  // When a license is assigned, hide the License Information card after the user clicks anywhere once
  const [licenseInfoDismissed, setLicenseInfoDismissed] = useState(false)
  const { user, isLoading: authLoading, canAccessAdmin } = useAuth()
  const lastAutoDeliveredRef = useRef<string | null>(null)

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiFetch(`/api/orders/${id}`) // Use unwrapped id
        if (!response.ok) {
          throw new Error("Failed to fetch order")
        }
        const data = await response.json()
        console.log("-----------------------------------------")
        console.log("!!! ADMIN ORDER DETAIL - VERSION 2.4 !!!")
        console.log("Order Data ID:", data.id)
        console.log("Customer Address Type:", typeof data.customer?.address)
        console.log("-----------------------------------------")
        setOrder(data)
      } catch (err) {
        console.error("Error fetching order:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")

        // Fallback to mock data
        setOrder({
          id: id, // Use unwrapped id
          userId: "user123",
          items: [
            {
              productId: "product1",
              name: "Smartphone X",
              price: 15000,
              quantity: 1,
              image: "/placeholder.svg?height=80&width=80",
            },
            {
              productId: "product2",
              name: "Wireless Earbuds",
              price: 2500,
              quantity: 2,
              image: "/placeholder.svg?height=80&width=80",
            },
          ],
          customer: {
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St, Mumbai, India",
            phone: "+91 9876543210",
          },
          total: 10000,
          subtotal: 16949.15,
          tax: 3050.85,
          shipping: 0,
          status: "processing",
          paymentMethod: "Credit Card",
          paymentDetails: {
            cardLast4: "4242",
          },
          createdAt: "2023-04-15T10:30:00Z",
          updatedAt: "2023-04-15T10:30:00Z",
          trackingNumber: "1234567890",
          coupon: {
            code: "GOA3",
            name: "goa3",
            discount: 10000
          }
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()
  }, [id]) // Use unwrapped id in dependency array

  // When order loads and contains externalQueue entries for exlr8, fetch external_orders docs for details (vouchers, raw response)
  useEffect(() => {
    const loadExternalDetails = async () => {
      if (!order) return
      const entries = ((order as unknown as Record<string, unknown>).externalQueue as ExternalQueueEntry[] || []).filter((q) => q.provider === 'exlr8')
      if (entries.length === 0) {
        setExternalDetails([])
        return
      }

      const results: ExternalDetail[] = []
      for (const q of entries) {
        try {
          // prefer externalOrderId, fall back to queueId
          const idToFetch = q.externalOrderId || q.queueId || q.id
          if (!idToFetch) continue
          const resp = await apiFetch(`/api/integrations/exlr8/external/${encodeURIComponent(idToFetch)}`)
          if (!resp.ok) {
            // try by queue id if externalOrderId lookup failed and we had both
            const text = await resp.text().catch(() => null)
            results.push({ queueId: q.queueId || null, error: text || `Status ${resp.status}` })
            continue
          }
          const data = await resp.json().catch(() => null)
          results.push({ queueId: q.queueId || null, externalOrderId: q.externalOrderId || null, data })
        } catch (e) {
          results.push({ queueId: q.queueId || null, error: String(e) })
        }
      }

      setExternalDetails(results)
    }

    loadExternalDetails()
  }, [order])

  // If a license key is present on the order, automatically set status to 'delivered'
  useEffect(() => {
    const tryAutoDeliver = async () => {
      if (!order) return
      if (!order.licenseKey) return
      if (order.status === 'delivered') return
      if (lastAutoDeliveredRef.current === order.id) return

      try {
        // Update order status to delivered
        const resp = await apiFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'delivered' })
        })

        if (resp.ok) {
          const updated = await resp.json()
          setOrder(updated)
          toast.success('Order status updated to Delivered (license present)')
          lastAutoDeliveredRef.current = order.id
        } else {
          console.warn('Auto-deliver request failed', await resp.text())
        }
      } catch (err) {
        console.error('Failed to auto-set order to delivered:', err)
      }
    }

    tryAutoDeliver()
  }, [order])

  // When a license exists on the order, show the License Information card until the user clicks once.
  useEffect(() => {
    if (!order?.licenseKey) return

    // Reset dismissed when a new license appears
    setLicenseInfoDismissed(false)

    const handleFirstClick = () => {
      setLicenseInfoDismissed(true)
      document.removeEventListener('click', handleFirstClick)
    }

    // Listen for the next click anywhere on the page (once)
    document.addEventListener('click', handleFirstClick)

    return () => {
      document.removeEventListener('click', handleFirstClick)
    }
  }, [order?.licenseKey])

  const handleStatusChange = async (newStatus: Order["status"]) => {
    if (!order) return

    setIsSaving(true)
    setError(null)

    // Handle cancellation separately
    if (newStatus === "cancelled") {
      setIsCancelling(true)
      setIsSaving(false)
      return
    }

    try {
      const updateData: Record<string, unknown> = { status: newStatus }

      // If shipping, get tracking number via modal
      if (newStatus === "shipped") {
        pendingStatusRef.current = { status: newStatus }
        setShowTrackingModal(true)
        setTrackingInput("")
        setIsSaving(false)
        return
      }

      // First update the order
      const response = await apiFetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) throw new Error("Failed to update order status")

      const updatedOrder = await response.json()
      setOrder(updatedOrder)

      toast.success(`Order status updated to ${newStatus}`)
      if (updatedOrder.notification?.emailSent === true) toast.success(`Email notification sent to ${order.customer.email}`)
      if (updatedOrder.notification?.emailSent === false) toast.error("Order updated but email notification failed")
    } catch (err) {
      console.error("Error updating order:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const submitTracking = async () => {
    if (!pendingStatusRef.current || !order) return
    const trackingNumber = trackingInput.trim()
    if (!trackingNumber) return

    setShowTrackingModal(false)
    setIsSaving(true)

    try {
      const updateData = { status: pendingStatusRef.current.status, trackingNumber }
      const response = await apiFetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })
      if (!response.ok) throw new Error("Failed to update order status")
      const updatedOrder = await response.json()
      setOrder(updatedOrder)
      toast.success(`Order marked as shipped with tracking number!`)
      if (updatedOrder.notification?.emailSent === true) toast.success(`Shipping email sent to ${order.customer.email}`)
      if (updatedOrder.notification?.emailSent === false) toast.error("Order shipped but email notification failed")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSaving(false)
      pendingStatusRef.current = null
      setTrackingInput("")
    }
  }

  const handleVerifyPayment = async () => {
    if (!order || order.source !== 'partner') return

    const isVerified = order.paymentVerification?.verified
    const method = isVerified ? 'DELETE' : 'POST'

    try {
      const response = await apiFetch(`/api/admin/partners/orders/${order.id}/verify-payment`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) throw new Error('Failed to update payment verification')

      const updated = await response.json()
      setOrder(prev => prev ? ({
        ...prev,
        paymentVerification: updated.paymentVerification
      }) : null)

      toast.success(isVerified ? 'Payment unverified' : 'Payment verified successfully')
    } catch (err) {
      console.error('Error verifying payment:', err)
      toast.error('Failed to update verification status')
    }
  }

  const handleCancellation = async (reason: string, note: string) => {
    setIsSaving(true)

    try {
      const response = await apiFetch(`/api/orders/${order?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation: {
            reason,
            note,
            date: new Date().toISOString(),
            refundStatus: 'pending'
          }
        })
      })

      if (!response.ok) throw new Error("Failed to cancel order")

      const updatedOrder = await response.json()
      setOrder(updatedOrder)
      setIsCancelling(false)

      toast.success('Order cancelled successfully')
      if (updatedOrder.notification?.emailSent === true) toast.success(`Cancellation email sent to ${order?.customer.email}`)
      if (updatedOrder.notification?.emailSent === false) toast.error("Order cancelled but email notification failed")
    } catch (err) {
      console.error("Error cancelling order:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualLicenseAssignment = async (softwareId: string, validity: number, maxDevices: number, orderId?: string, quantity: number = 1) => {
    setIsAssigningLicense(true)

    try {
      console.log('🔑 Assigning license:', {
        orderId: orderId || id,
        softwareId,
        validity,
        maxDevices
      })

      const targetOrderId = orderId || id
      const response = await apiFetch(`/api/orders/${targetOrderId}/assign-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          softwareId,
          validity,
          maxDevices
          , orderId: targetOrderId,
          quantity
        })
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.details || 'Failed to assign license'
        throw new Error(errorMessage)
      }

      // Immediately update order state with returned license key so UI reflects assignment without waiting
      // support multiple assigned keys
      const assignedKeys: string[] = data?.data?.licenseKeys || data?.licenseKeys || (data?.data?.licenseKey ? [data.data.licenseKey] : (data?.licenseKey ? [data.licenseKey] : []))
      const emailResults = data?.data?.results || data?.results || null

      if (assignedKeys && assignedKeys.length > 0) {
        setOrder((prev) => {
          if (!prev) return prev
          const newOrder = { ...prev }
          newOrder.licenseKeys = (newOrder.licenseKeys || []).concat(assignedKeys)
          if (!newOrder.licenseKey) newOrder.licenseKey = assignedKeys[0]
          newOrder.licenseAssignedAt = new Date().toISOString()
          newOrder.timeline = Array.isArray(newOrder.timeline) ? newOrder.timeline.concat({ date: new Date().toISOString(), status: 'License Assigned', description: `Assigned ${assignedKeys.length} license(s)` }) : newOrder.timeline
          return newOrder
        })
      }

      setShowLicenseModal(false)
      toast.success(`Assigned ${assignedKeys ? assignedKeys.length : 0} license(s) and sent email(s)`)

      if (data.warning) {
        toast.error(data.warning, { duration: 5000 })
      }

      // Refresh order from server to pick up any other fields the API updated
      try {
        const orderResponse = await apiFetch(`/api/orders/${id}`)
        if (orderResponse.ok) {
          const updatedOrder = await orderResponse.json()
          setOrder(updatedOrder)
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh order after license assignment', refreshErr)
      }
    } catch (err) {
      console.error('Error assigning license:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to assign license')
    } finally {
      setIsAssigningLicense(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />
      case "processing":
        return <Package className="h-5 w-5 text-blue-500" />
      case "shipped":
        return <Truck className="h-5 w-5 text-purple-500" />
      case "delivered":
        return <Check className="h-5 w-5 text-green-500" />
      case "cancelled":
        return <X className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "shipped":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const CancellationModal = ({
    isOpen,
    onClose,
    onSubmit,
    isProcessing
  }: {
    isOpen: boolean
    onClose: () => void
    onSubmit: (reason: string, note: string) => void
    isProcessing: boolean
  }) => {
    const [reason, setReason] = useState('')
    const [note, setNote] = useState('')

    return (
      <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative z-10 mx-auto mt-20 max-w-lg bg-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Cancel Order</h3>

          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full mb-4 p-2 border rounded"
          >
            <option value="">Select a reason</option>
            <option value="customer_request">Customer Request</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="pricing_error">Pricing Error</option>
            <option value="fraudulent_order">Fraudulent Order</option>
            <option value="other">Other</option>
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional notes about cancellation..."
            className="w-full mb-4 p-2 border rounded h-32"
          />

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(reason, note)}
              disabled={!reason || isProcessing}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const LicenseAssignmentModal = ({
    isOpen,
    onClose,
    onSubmit,
    isProcessing,
    softwareItems,
    orderId
  }: {
    isOpen: boolean
    onClose: () => void
    onSubmit: (softwareId: string, validity: number, maxDevices: number, orderId?: string, quantity?: number) => void
    isProcessing: boolean
    softwareItems: OrderItem[]
    orderId?: string
  }) => {
    // Auto-populate from first software item
    const firstSoftware = softwareItems[0]
    const [softwareId, setSoftwareId] = useState('')
    const [validity, setValidity] = useState(365)
    const [maxDevices, setMaxDevices] = useState(1)
    const [quantity, setQuantity] = useState(1)

    // Update when modal opens with new items
    useEffect(() => {
      if (isOpen && firstSoftware) {
        // Support both `productId` and legacy `id` fields in order items
        const candidateId = firstSoftware.productId || ''
        setSoftwareId(candidateId)
        setValidity(firstSoftware.validityYears ? firstSoftware.validityYears * 365 : (firstSoftware.validityYears ? firstSoftware.validityYears : 365))
        setMaxDevices(firstSoftware.maxDevices || 1)
      }
    }, [isOpen, firstSoftware])

    return (
      <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
        <div className="relative z-10 mx-auto mt-20 max-w-lg bg-white rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Key className="h-6 w-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold">Manually Assign License Key</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: inputs */}
            <div>
              {/* Display Order ID for clarity and quick copy */}
              <div className="mb-3 text-sm text-gray-700 flex items-center justify-between">
                <div className="flex items-center">
                  <span className="font-medium">Order ID:</span>
                  <span className="font-mono ml-2 text-sm text-gray-900">{order?.orderId || id || '—'}</span>
                </div>
                {(order?.orderId || id) && (
                  <button
                    onClick={() => {
                      try {
                        navigator.clipboard?.writeText(order?.orderId || id || '')
                        toast.success('Order ID copied to clipboard')
                      } catch (e) {
                        // fallback: prompt copy
                        prompt('Order ID', order?.orderId || id || '')
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                    type="button"
                  >
                    Copy
                  </button>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Software Product
                </label>
                <select
                  value={softwareId}
                  onChange={(e) => setSoftwareId(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select software product</option>
                  {softwareItems.map((item, index) => (
                    <option key={index} value={item.productId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Validity (Days)
                </label>
                <select
                  value={validity}
                  onChange={(e) => setValidity(parseInt(e.target.value))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-purple-500"
                >
                  <option value="30">30 days (1 month)</option>
                  <option value="90">90 days (3 months)</option>
                  <option value="180">180 days (6 months)</option>
                  <option value="365">365 days (1 year)</option>
                  <option value="730">730 days (2 years)</option>
                  <option value="1095">1095 days (3 years)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  License validity period
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Devices
                </label>
                <select
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(parseInt(e.target.value))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-purple-500"
                >
                  <option value="1">1 Device</option>
                  <option value="2">2 Devices</option>
                  <option value="3">3 Devices</option>
                  <option value="5">5 Devices</option>
                  <option value="10">10 Devices</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of devices
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1')))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Number of license keys to assign (defaults to 1)</p>
              </div>
            </div>

            {/* Right: auto-populated summary */}
            <div>
              <div className="bg-blue-50 p-3 rounded-lg h-full">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>📋 Auto-populated from order:</strong>
                </p>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>• Software: {firstSoftware?.name || 'Not selected'}</p>
                  <p>• Validity: {validity} days ({validity === 365 ? '1 year' : validity === 730 ? '2 years' : validity === 1095 ? '3 years' : `${Math.round(validity / 30)} months`})</p>
                  <p>• Max Devices: {maxDevices}</p>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  This will assign a license from <code className="bg-blue-100 px-1 rounded">license_keys</code> collection and email the customer.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(softwareId, validity, maxDevices, id, quantity)}
              disabled={!softwareId || isProcessing}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Assigning...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Assign License
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
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
      <div className="flex items-center mb-6">
        <Link href="/admin/orders">
          <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </button>
        </Link>
        <h1 className="text-2xl font-semibold">Order Details</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono border border-blue-200 uppercase tracking-tighter">
            LIVE v2.4
          </span>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-mono border border-indigo-200 uppercase tracking-tighter">
            {order?.source === 'partner' ? '🤝 PARTNER' : '📦 DIRECT'}
          </span>
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
      ) : order ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Order #{order.orderId || order.id}</h2>
                  {order.source === 'partner' && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded flex items-center gap-1 border border-indigo-200">
                      🤝 PARTNER
                    </span>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full border ${getStatusColor(order.status)} flex items-center`}>
                  {getStatusIcon(order.status)}
                  <span className="ml-2 font-medium">
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between mb-4 text-sm text-gray-500">
                <div className="flex items-center mb-2 md:mb-0">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>Placed on: {formatDate(order.createdAt)}</span>
                </div>
                <div>
                  <span>Payment Method: {order.paymentMethod}</span>
                  {order.paymentDetails?.cardLast4 && <span> (Card ending in {order.paymentDetails.cardLast4})</span>}
                </div>
              </div>

              {order.orderId && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-blue-800">Order ID:</span>
                      <span className="text-lg font-bold text-blue-900 font-mono">{order.orderId}</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(order.orderId || '')
                        toast.success('Order ID copied!')
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                      type="button"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Internal ref: {order.id}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Order Items</h3>
                <div className="space-y-4">
                  {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                    order.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                            <img
                              src={item.image || "/placeholder.svg?height=80&width=80"}
                              alt={item.name}
                              className="h-full w-full object-cover object-center"
                              onError={(e) => {
                                ; (e.target as HTMLImageElement).src = "/placeholder.svg?height=80&width=80"
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              ₹{item.price.toFixed(2)} × {item.quantity}
                              {item.type === 'software' && (
                                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                  <p className="flex items-center gap-1">
                                    <span className="font-medium">Type:</span> Software License
                                  </p>
                                  {item.packSize && (
                                    <p className="flex items-center gap-1">
                                      <span className="font-medium">Licenses:</span> {item.packSize} User(s)
                                    </p>
                                  )}
                                  {item.maxDevices && (
                                    <p className="flex items-center gap-1">
                                      <span className="font-medium">Max Devices:</span> {item.maxDevices}
                                    </p>
                                  )}
                                  {item.validityYears && (
                                    <p className="flex items-center gap-1">
                                      <span className="font-medium">Validity:</span> {item.validityYears} Year(s)
                                    </p>
                                  )}
                                  {item.licenseKey && (
                                    <p className="flex items-center gap-1">
                                      <span className="font-medium">License Key:</span>
                                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                        {item.licenseKey}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No items found in this order.</p>
                    </div>
                  )}
                </div>
              </div>

              {(order.status === "shipped" || order.status === "delivered") && order.trackingNumber && (
                <div className="border-t mt-6 pt-4">
                  <h3 className="font-medium mb-2">Tracking Information</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">Tracking Number:</p>
                    <p className="text-lg font-mono font-semibold text-blue-600">{order.trackingNumber}</p>
                  </div>
                </div>
              )}

              <div className="border-t mt-6 pt-4">
                {/* Coupon Information - More Prominent Display */}
                {order.coupon && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-green-600 font-bold text-sm">🎟️</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-800">Coupon Applied</h4>
                          <p className="text-sm text-green-600">{order.coupon.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Code: <span className="font-mono font-medium">{order.coupon.code}</span></div>
                        <div className="text-lg font-bold text-green-600">-₹{order.coupon.discount.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Coupon Impact Summary */}
                {order.coupon && (
                  <div className="border-t mt-6 pt-6 mb-6">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-green-800 flex items-center">
                            <span className="mr-2">💰</span>
                            You Saved with this Coupon!
                          </h4>
                          <p className="text-sm text-green-600 mt-1">
                            Applied <strong>{order.coupon.name}</strong> ({order.coupon.code})
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            ₹{order.coupon.discount.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-green-500 uppercase font-semibold">
                            Discount Applied
                          </div>
                        </div>
                      </div>

                      {/* Savings Breakdown */}
                      <div className="mt-4 pt-3 border-t border-green-200">
                        <div className="text-xs text-green-600 mb-2 font-medium">Order Calculation:</div>
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div className="text-center">
                            <div className="text-gray-600">Subtotal</div>
                            <div className="font-semibold text-green-700">₹{order.subtotal.toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600">Tax (GST)</div>
                            <div className="font-semibold text-green-700">₹{order.source === 'partner' ? '0.00' : order.tax.toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600 text-[10px]">Before Discount</div>
                            <div className="font-semibold text-green-700">₹{order.source === 'partner' ? order.subtotal.toFixed(2) : (order.subtotal + order.tax).toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-600">Coupon</div>
                            <div className="font-semibold text-green-700">-₹{order.coupon.discount.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-green-200">
                          <div className="text-center">
                            <div className="text-gray-600">Final Total</div>
                            <div className="font-bold text-green-700 text-base">₹{order.source === 'partner' ? (order.subtotal - order.coupon.discount).toFixed(2) : order.total.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{order.subtotal.toFixed(2)}</span>
                  </div>
                  {order.coupon && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Coupon ({order.coupon.code})</span>
                      <span>-₹{order.coupon.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span>{order.shipping === 0 ? 'Free' : `₹${order.shipping.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (GST) {order.source === 'partner' && <span className="text-[10px] text-gray-400 font-normal ml-1">(No extra tax)</span>}</span>
                    <span>₹{order.source === 'partner' ? '0.00' : order.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg mt-4 pt-4 border-t border-gray-200">
                    <span>Total</span>
                    <span>₹{order.source === 'partner' ? (order.subtotal - (order.coupon?.discount || 0) + order.shipping).toFixed(2) : order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Update Order Status</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStatusChange("pending")}
                  disabled={order.status === "pending" || isSaving}
                  className={`px-4 py-2 rounded-lg flex items-center ${order.status === "pending"
                    ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                    : "bg-gray-100 hover:bg-yellow-50 text-gray-800 hover:text-yellow-800"
                    }`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pending
                </button>
                <button
                  onClick={() => handleStatusChange("processing")}
                  disabled={order.status === "processing" || isSaving}
                  className={`px-4 py-2 rounded-lg flex items-center ${order.status === "processing"
                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                    : "bg-gray-100 hover:bg-blue-50 text-gray-800 hover:text-blue-800"
                    }`}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Processing
                </button>
                <button
                  onClick={() => handleStatusChange("shipped")}
                  disabled={order.status === "shipped" || isSaving}
                  className={`px-4 py-2 rounded-lg flex items-center ${order.status === "shipped"
                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                    : "bg-gray-100 hover:bg-purple-50 text-gray-800 hover:text-purple-800"
                    }`}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Shipped
                </button>
                <button
                  onClick={() => handleStatusChange("delivered")}
                  disabled={order.status === "delivered" || isSaving}
                  className={`px-4 py-2 rounded-lg flex items-center ${order.status === "delivered"
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-gray-100 hover:bg-green-50 text-gray-800 hover:text-green-800"
                    }`}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Delivered
                </button>
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={order.status === "cancelled" || isSaving}
                  className={`px-4 py-2 rounded-lg flex items-center ${order.status === "cancelled"
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : "bg-gray-100 hover:bg-red-50 text-gray-800 hover:text-red-800"
                    }`}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelled
                </button>
              </div>
              {isSaving && (
                <div className="mt-4 text-sm text-gray-500 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                  Updating order status...
                </div>
              )}
            </div>

            {/* Manual License Assignment Section - hide when already delivered or if order was fulfilled by external provider (exlr8) */}
            {order.items.some(item => item.type === 'software') && order.status !== 'delivered' && !((Array.isArray((order as unknown as Record<string, unknown>).externalQueue) && ((order as unknown as Record<string, unknown>).externalQueue as ExternalQueueEntry[]).some((q) => q.provider === 'exlr8')) || order.items.some((it) => it.provider === 'exlr8')) && !(order.licenseKeys && order.licenseKeys.length > 0) && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Key className="h-5 w-5 mr-2 text-purple-600" />
                  Manual License Assignment
                </h3>
                {(order.licenseKeys && order.licenseKeys.length > 0) || order.licenseKey ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800 mb-2"><strong>✅ License key already assigned</strong></p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">License Key(s)</p>
                        <div className="space-y-1">
                          {order.licenseKeys && order.licenseKeys.length > 0 ? (
                            order.licenseKeys.map((k, idx) => (
                              <p key={idx} className="font-mono font-semibold text-green-700 bg-white px-3 py-1 rounded border border-green-200">{k}</p>
                            ))
                          ) : (
                            <p className="font-mono font-semibold text-green-700">{order.licenseKey}</p>
                          )}
                        </div>
                        {order.licenseAssignedAt && (
                          <p className="text-xs text-gray-500 mt-1">Assigned: {formatDate(order.licenseAssignedAt)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(order.licenseKey || '')
                            toast.success('License key copied to clipboard')
                          }}
                          className="px-3 py-2 bg-white border rounded text-sm font-medium"
                        >
                          Copy Key
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800">
                        <strong>⚠️ No license key assigned yet.</strong>
                        <br />
                        This order contains software items but no license has been assigned.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowLicenseModal(true)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Assign License Key
                    </button>
                  </>
                )}
              </div>
            )}

            {/* If this order was placed via exlr8 (integration), show external provider response / status instead of manual license assignment */}
            {((Array.isArray((order as unknown as Record<string, unknown>).externalQueue) && ((order as unknown as Record<string, unknown>).externalQueue as ExternalQueueEntry[]).some((q) => q.provider === 'exlr8')) || order.items.some((it) => it.provider === 'exlr8')) && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Key className="h-5 w-5 mr-2 text-indigo-600" />
                  External Provider (eXlr8) Response
                </h3>
                <div className="space-y-3">
                  {(((order as unknown as Record<string, unknown>).externalQueue as ExternalQueueEntry[]) || []).filter((q) => q.provider === 'exlr8').map((q, idx) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm text-gray-600">Queue ID</div>
                          <div className="font-mono text-sm text-gray-900">{q.queueId || q.id || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Status</div>
                          <div className="font-medium">{(q.status || 'queued').toString()}</div>
                        </div>
                      </div>
                      {q.externalOrderId && (
                        <div className="mt-2 text-sm text-gray-700">External Order ID: <span className="font-mono">{q.externalOrderId}</span></div>
                      )}
                      {q.createdAt && (
                        <div className="mt-1 text-xs text-gray-500">Queued at: {new Date(q.createdAt).toLocaleString()}</div>
                      )}
                      {q.note && (
                        <div className="mt-2 text-sm text-gray-700">Note: {q.note}</div>
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2">
                    { /* hide action buttons when vouchers exist */}
                    {!(placedVouchers && placedVouchers.length > 0) && !(externalDetails && externalDetails.some((ed) => {
                      const response = ed.data?.response as Record<string, unknown> | undefined
                      const responseData = response?.data as Record<string, unknown> | undefined
                      const lineItems = (responseData?.lineItems || []) as LineItem[]
                      const vouchers = lineItems.flatMap((li) => li.vouchers || []).concat(((responseData?.vouchers || []) as Voucher[]))
                      return Array.isArray(vouchers) && vouchers.length > 0
                    })) && (
                        <>
                          <button
                            onClick={async () => {
                              if (!order) return
                              setIsRetryingExternal(true)
                              setRetryResult(null)
                              setPlacedVouchers(null)
                              try {
                                // Build explicit items payload including kgen ids when available
                                const integrationItems = (order.items || []).map((it) => ({
                                  productId: it.productId || it.id,
                                  quantity: it.quantity || 1,
                                  kgenProductId: it.kgenProductId || null,
                                  kgenVariantId: it.kgenVariantId || null,
                                  provider: it.provider || null
                                })).filter((i) => i.provider === 'exlr8' || i.kgenProductId || i.kgenVariantId)

                                if (integrationItems.length === 0) {
                                  toast.error('No eXlr8/KGen items found on this order')
                                  setIsRetryingExternal(false)
                                  return
                                }

                                const resp = await apiFetch('/api/integrations/exlr8/place-order', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ orderId: order.id, userId: order.userId, items: integrationItems })
                                })

                                const data = await resp.json().catch(() => null)
                                setRetryResult(data)

                                if (resp.ok) {
                                  // extract vouchers if upstream returned them directly
                                  const responseLineItems = data?.data?.lineItems as LineItem[] | undefined
                                  const vouchers: Voucher[] = responseLineItems ? responseLineItems.flatMap((li) => li.vouchers || []) : ((data?.data?.vouchers || data?.vouchers || []) as Voucher[])
                                  if (vouchers && vouchers.length > 0) {
                                    setPlacedVouchers(vouchers)
                                    setShowPlacedModal(true)
                                    // update local order state immediately so UI reflects delivered status
                                    setOrder((prev) => prev ? ({ ...prev, status: 'delivered', vouchers }) : prev)
                                    try {
                                      const text = vouchers.map((v, idx) => `${idx + 1}. ${v.voucherCode || v.code || v.voucher || ''}${v.voucherPin ? ' | PIN: ' + v.voucherPin : ''}`).join('\n')
                                      await navigator.clipboard?.writeText(text)
                                      toast.success('Vouchers copied to clipboard')
                                    } catch (e) {
                                      // ignore clipboard errors
                                    }
                                  }

                                  toast.success('Place-order request submitted — check external queue')
                                } else {
                                  // If upstream indicates the external order already exists, surface a friendly message
                                  if ((data as Record<string, unknown>)?.errCode === 'CONFLICT' || (typeof data?.error === 'string' && data.error.toLowerCase().includes('externalrefid'))) {
                                    toast.success('Voucher(s) already assigned by external provider — check External Provider response')
                                  } else {
                                    toast.error(data?.error || data?.message || 'Place-order failed')
                                  }
                                }

                                // Refresh order to pick up new externalQueue entries
                                try {
                                  const updated = await (await apiFetch(`/api/orders/${order.id}`)).json()
                                  setOrder(updated)
                                } catch (e) {
                                  console.warn('Failed to refresh order after place-order', e)
                                }
                              } catch (err) {
                                console.error('Place-order failed', err)
                                toast.error('Place-order failed: ' + (err instanceof Error ? err.message : String(err)))
                              } finally {
                                setIsRetryingExternal(false)
                              }
                            }}
                            disabled={isRetryingExternal}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          >
                            {isRetryingExternal ? 'Placing…' : 'Place to eXlr8 (KGen IDs)'}
                          </button>

                          <button
                            onClick={async () => {
                              if (!order) return
                              setIsRetryingExternal(true)
                              setRetryResult(null)
                              try {
                                const resp = await apiFetch('/api/integrations/exlr8/place-order', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ orderId: order.id, userId: order.userId, items: order.items })
                                })
                                const data = await resp.json().catch(() => null)
                                setRetryResult(data)
                                if (resp.ok) {
                                  toast.success('Retry request submitted — check external queue')
                                } else {
                                  if ((data as Record<string, unknown>)?.errCode === 'CONFLICT' || (typeof data?.error === 'string' && data.error.toLowerCase().includes('externalrefid'))) {
                                    toast.success('Voucher(s) already assigned by external provider — check External Provider response')
                                  } else {
                                    toast.error(data?.error || data?.message || 'Retry failed')
                                  }
                                }

                                // Refresh order to pick up new externalQueue entries
                                try {
                                  const updated = await (await apiFetch(`/api/orders/${order.id}`)).json()
                                  setOrder(updated)
                                } catch (e) {
                                  console.warn('Failed to refresh order after retry', e)
                                }
                              } catch (err) {
                                console.error('Retry failed', err)
                                toast.error('Retry failed: ' + (err instanceof Error ? err.message : String(err)))
                              } finally {
                                setIsRetryingExternal(false)
                              }
                            }}
                            disabled={isRetryingExternal}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                          >
                            {isRetryingExternal ? 'Retrying…' : 'Retry External Order'}
                          </button>

                          <button
                            onClick={() => {
                              try {
                                const qids = (((order as unknown as Record<string, unknown>).externalQueue as ExternalQueueEntry[]) || []).filter((q) => q.provider === 'exlr8').map((q) => q.queueId || q.id).filter(Boolean).join('\n')
                                navigator.clipboard?.writeText(qids || '')
                                toast.success('Copied external queue IDs to clipboard')
                              } catch (e) {
                                prompt('Queue IDs', (((order as unknown as Record<string, unknown>).externalQueue as ExternalQueueEntry[]) || []).map((q) => q.queueId || q.id).join('\n'))
                              }
                            }}
                            className="px-3 py-2 bg-white border rounded text-sm"
                          >
                            Copy Queue IDs
                          </button>
                        </>
                      )}
                    {(placedVouchers && placedVouchers.length > 0) || (externalDetails && externalDetails.some((ed) => {
                      const response = ed.data?.response as Record<string, unknown> | undefined
                      const responseData = response?.data as Record<string, unknown> | undefined
                      const lineItems = (responseData?.lineItems || []) as LineItem[]
                      const vouchers = lineItems.flatMap((li) => li.vouchers || []).concat(((responseData?.vouchers || []) as Voucher[]))
                      return Array.isArray(vouchers) && vouchers.length > 0
                    })) && (
                        <div className="px-3 py-2 rounded text-sm bg-green-50 border border-green-200">Vouchers attached — delivered</div>
                      )}
                  </div>

                  {/* Show small list of fetched external details (vouchers etc.) */}
                  {externalDetails && externalDetails.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {externalDetails.map((ed, i) => (
                        <div key={i} className="p-3 border rounded bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">Queue: <span className="font-mono">{ed.queueId || ed.data?.id || '—'}</span></div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  try {
                                    navigator.clipboard?.writeText(JSON.stringify(ed.data?.response || ed.data || ed, null, 2))
                                    toast.success('Copied external response')
                                  } catch (e) {
                                    prompt('External response', JSON.stringify(ed.data?.response || ed.data || ed, null, 2))
                                  }
                                }}
                                className="px-2 py-1 bg-white border rounded text-sm"
                              >
                                Copy Response
                              </button>
                              <button
                                onClick={() => {
                                  // open vouchers in a simple prompt modal for quick access
                                  const edResponse = ed.data?.response as Record<string, unknown> | undefined
                                  const edResponseData = edResponse?.data as Record<string, unknown> | undefined
                                  const edLineItems = (edResponseData?.lineItems || []) as LineItem[]
                                  const vouchers: Voucher[] = edLineItems.flatMap((li) => li.vouchers || []) || ((edResponseData?.vouchers || []) as Voucher[])
                                  if (!vouchers || vouchers.length === 0) {
                                    toast('No vouchers found for this external order')
                                    return
                                  }
                                  const text = vouchers.map((v, idx) => `${idx + 1}. ${v.voucherCode || v.code || v.voucher || ''} ${v.voucherPin ? ' | PIN: ' + v.voucherPin : ''} ${v.expirationDate ? ' | exp: ' + v.expirationDate : ''}`).join('\n')
                                  // try clipboard first
                                  try { navigator.clipboard?.writeText(text); toast.success('Vouchers copied to clipboard') } catch (e) { prompt('Vouchers', text) }
                                }}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                              >
                                Copy Vouchers
                              </button>
                            </div>
                          </div>

                          {/* render vouchers summary if available */}
                          {((ed.data?.response?.data?.lineItems) || ed.data?.response?.data?.vouchers) && (
                            <div className="mt-2 text-sm text-gray-700">
                              <div className="font-medium">Vouchers</div>
                              <ul className="mt-1 list-disc list-inside text-xs">
                                {(() => {
                                  const edResp = ((ed.data?.response as Record<string, unknown>)?.data as Record<string, unknown>)
                                  const lineItems = (edResp?.lineItems || []) as LineItem[]
                                  const vouchersFromItems = lineItems.flatMap((li) => li.vouchers || [])
                                  const vouchersDirect = (edResp?.vouchers || []) as Voucher[]
                                  const allVouchers = [...vouchersFromItems, ...vouchersDirect]
                                  return allVouchers.map((v, idx) => (
                                    <li key={idx} className="py-0.5">{v.voucherCode || v.code || '—'} {v.voucherPin ? <span className="font-mono ml-2">{v.voucherPin}</span> : null}</li>
                                  ))
                                })()}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">If you need more details (raw response, vouchers), check the <code className="font-mono">external_orders</code> collection or use the webhook logs.</div>
                </div>
              </div>
            )}

            {/* Show assigned license if exists (hidden after user dismisses) */}
            {((order.licenseKeys && order.licenseKeys.length > 0) || order.licenseKey) && !licenseInfoDismissed && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Key className="h-5 w-5 mr-2 text-green-600" />
                  License Information
                </h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">License Key(s):</p>
                      <div className="space-y-1">
                        {order.licenseKeys && order.licenseKeys.length > 0 ? (
                          order.licenseKeys.map((k, idx) => (
                            <p key={idx} className="font-mono font-semibold text-green-700 bg-white px-3 py-1 rounded border border-green-200">{k}</p>
                          ))
                        ) : (
                          <p className="font-mono font-semibold text-green-700 bg-white px-3 py-2 rounded border border-green-200">{order.licenseKey}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={() => {
                          try {
                            const text = order.licenseKeys && order.licenseKeys.length > 0 ? order.licenseKeys.join('\n') : (order.licenseKey || '')
                            navigator.clipboard?.writeText(text)
                            toast.success('License key(s) copied to clipboard')
                          } catch (e) {
                            // fallback for older browsers
                            prompt('License Key(s)', order.licenseKeys && order.licenseKeys.length > 0 ? order.licenseKeys.join('\n') : (order.licenseKey || ''))
                          }
                        }}
                        className="px-3 py-2 bg-white border rounded text-sm font-medium"
                      >
                        Copy Key(s)
                      </button>
                    </div>
                  </div>
                  {order.licenseAssignedAt && (
                    <p className="text-xs text-gray-500 mt-1">Assigned: {formatDate(order.licenseAssignedAt)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <User className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-gray-900">{order.customer.name}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900">{order.customer.email}</p>
                  </div>
                </div>

                {order.customer.phone && (
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="text-gray-900">{order.customer.phone}</p>
                    </div>
                  </div>
                )}

                {order.customer.address && (
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Shipping Address</p>
                      <div className="text-gray-900 leading-relaxed">
                        {typeof order.customer.address === 'object' && order.customer.address !== null ? (
                          <div className="flex flex-col">
                            {order.customer.address.line1 && <span>{order.customer.address.line1}</span>}
                            {order.customer.address.line2 && <span>{order.customer.address.line2}</span>}
                            <span>
                              {order.customer.address.city || ''}
                              {order.customer.address.city && order.customer.address.state ? ', ' : ''}
                              {order.customer.address.state || ''}
                              {order.customer.address.pincode ? ` - ${order.customer.address.pincode}` : ''}
                            </span>
                            {order.customer.address.country && <span className="text-xs uppercase text-gray-400 mt-1 font-semibold tracking-wider">{order.customer.address.country}</span>}
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{String(order.customer.address || '—')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Coupon Usage Information */}
              {order.coupon && (
                <div className="mt-6 pt-4 border-t">
                  <h3 className="font-medium mb-3 text-green-600 flex items-center">
                    <span className="mr-2">🎟️</span>
                    Coupon Usage Details
                  </h3>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Coupon Code:</span>
                        <div className="font-mono font-semibold text-green-700">{order.coupon.code}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Discount Amount:</span>
                        <div className="font-semibold text-green-700">₹{order.coupon.discount.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Campaign Name:</span>
                        <div className="font-medium text-gray-900">{order.coupon.name}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Applied On:</span>
                        <div className="text-gray-900">{formatDate(order.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <Link href={`/admin/customers/${order.userId}`}>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    View Customer Profile
                  </button>
                </Link>
              </div>
            </div>

            {order.source === 'partner' && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Partner Information</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Partner Name</p>
                    <p className="text-gray-900 font-medium">{order.partnerName || 'Unknown Partner'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Partner Order ID</p>
                    <p className="text-gray-900 font-mono">{order.partnerOrderId || '—'}</p>
                  </div>
                  {order.source === 'partner' && (
                    <div className="pt-2">
                      <p className="text-sm text-gray-500">Commission Details</p>
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 mt-1">
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="text-emerald-700">Earnings:</span>
                          <span className="font-bold text-emerald-600">
                            ₹{typeof order.commission === 'object'
                              ? order.commission.amount?.toFixed(2) || '0.00'
                              : (typeof order.commission === 'number' ? order.commission.toFixed(2) : '0.00')
                            }
                          </span>
                        </div>
                        {typeof order.commission === 'object' && order.commission.rate !== undefined && (
                          <div className="flex justify-between items-center text-[10px] text-emerald-500 uppercase tracking-wider font-semibold">
                            <span>Rate:</span>
                            <span>{order.commission.rate}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {order.source === 'partner' && order.paymentMethod === 'prepaid' && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Payment Verification</h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-wider">Razorpay Details</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Order ID:</span>
                        <span className="font-mono text-gray-900 font-medium">{order.razorpayPaymentDetails?.razorpayOrderId || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Transaction ID:</span>
                        <span className="font-mono text-gray-900 font-medium">{order.razorpayPaymentDetails?.transactionId || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">Verification Status</p>
                      <p className="text-xs text-indigo-600">
                        {order.paymentVerification?.verified
                          ? `Verified by ${order.paymentVerification.verifiedBy || 'Admin'} on ${new Date(order.paymentVerification.verifiedAt!).toLocaleDateString()}`
                          : 'Awaiting verification'}
                      </p>
                    </div>
                    <button
                      onClick={handleVerifyPayment}
                      className={`px-4 py-2 text-xs font-bold rounded-full border shadow-sm transition-all ${order.paymentVerification?.verified
                        ? 'bg-green-100 text-green-800 border-green-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                        : 'bg-red-100 text-red-800 border-red-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                        }`}
                    >
                      {order.paymentVerification?.verified ? '✓ VERIFIED' : '✗ UNVERIFIED'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Order not found.</p>
        </div>
      )}

      {/* Cancellation modal */}
      <CancellationModal
        isOpen={isCancelling}
        onClose={() => setIsCancelling(false)}
        onSubmit={handleCancellation}
        isProcessing={isSaving}
      />

      {/* License Assignment Modal */}
      {order && (
        <LicenseAssignmentModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
          onSubmit={handleManualLicenseAssignment}
          isProcessing={isAssigningLicense}
          softwareItems={order.items.filter(item => item.type === 'software')}
          orderId={id}
        />
      )}

      {/* Placed Vouchers Modal - shows vouchers returned immediately from place-order */}
      {showPlacedModal && placedVouchers && (
        <div className={`fixed inset-0 z-50 block`}>
          <div className="absolute inset-0 bg-black opacity-50" onClick={() => setShowPlacedModal(false)}></div>
          <div className="relative z-10 mx-auto mt-20 max-w-lg bg-white rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Vouchers (from eXlr8)</h3>
            <div className="mb-4 text-sm text-gray-700">
              <p>These vouchers were returned by the upstream provider. They have been copied to your clipboard.</p>
            </div>
            <div className="mb-4 max-h-64 overflow-auto border rounded p-3 bg-gray-50">
              <ul className="text-sm font-mono">
                {placedVouchers.map((v, i) => (
                  <li key={i} className="py-1">{i + 1}. {v.voucherCode || v.code || v.voucher || '—'}{v.voucherPin ? <span className="ml-2 font-mono">PIN: {v.voucherPin}</span> : null}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { try { navigator.clipboard?.writeText(placedVouchers.map((v, i) => `${i + 1}. ${v.voucherCode || v.code || v.voucher || ''}${v.voucherPin ? ' | PIN: ' + v.voucherPin : ''}`).join('\n')); toast.success('Copied'); } catch (e) { } }} className="px-3 py-2 bg-white border rounded">Copy</button>
              <button onClick={() => setShowPlacedModal(false)} className="px-3 py-2 bg-blue-600 text-white rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {order?.status === "cancelled" && order?.cancellation && (
        <div className="border-t mt-6 pt-4">
          <h3 className="font-medium mb-3 text-red-600">Cancellation Details</h3>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="mb-2">
              <span className="text-sm text-gray-600">Reason:</span>
              <p className="font-medium">{order.cancellation.reason}</p>
            </div>
            <div className="mb-2">
              <span className="text-sm text-gray-600">Note:</span>
              <p className="text-gray-800">{order.cancellation.note}</p>
            </div>
            <div className="mb-2">
              <span className="text-sm text-gray-600">Date:</span>
              <p className="text-gray-800">{formatDate(order.cancellation.date)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Refund Status:</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-sm ${order.cancellation.refundStatus === 'processed'
                ? 'bg-green-100 text-green-800'
                : order.cancellation.refundStatus === 'declined'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
                }`}>
                {order.cancellation.refundStatus?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Number Modal */}
      {showTrackingModal && (
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
                  onClick={() => { setShowTrackingModal(false); setTrackingInput(""); pendingStatusRef.current = null }}
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
