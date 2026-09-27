"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect, useCallback } from "react"
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Loader2,
  DollarSign,
  Wallet,
  Users,
  IndianRupee,
  BadgeCheck,
  Hourglass,
} from "lucide-react"
import Link from "next/link"
import { toast } from "react-hot-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommissionOrder {
  orderId: string
  internalOrderId: string | null
  partnerOrderId: string | null
  createdAt: string
  orderTotal: number
  subtotal: number
  commissionRate: number
  commissionAmount: number
  commissionStatus: "pending" | "credited" | "adjusted"
  orderStatus: string
  customer: { name: string;
 email: string }
  items: { name: string; quantity: number; price: number }[]
}

interface PartnerCommissionGroup {
  partnerId: string
  partnerName: string
  partnerEmail: string
  tier: string
  commissionRate: number
  totalPending: number
  totalCredited: number
  orders: CommissionOrder[]
}

interface CommissionSummary {
  totalPendingCommission: number
  totalPaidCommission: number
  partnersWithPending: number
  partnersTotal: number
}

interface Payout {
  id: string
  partnerId: string
  partnerName?: string
  partner?: { id: string; name: string; email: string }
  walletId: string
  amount: number
  status: "pending_approval" | "approved" | "processing" | "completed" | "failed" | "rejected"
  bankAccount: { bankName: string; accountNumber: string; ifsc: string }
  notes?: string
  requestedAt: string
  approvedAt?: string
  completedAt?: string
  rejectedAt?: string
  rejectionReason?: string
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────

function PayModal({
  partner,
  selectedOrders,
  onClose,
  onPaid,
}: {
  partner: PartnerCommissionGroup
  selectedOrders: CommissionOrder[]
  onClose: () => void
  onPaid: (partnerIds: string[], orderIds: string[]) => void
}) {
  const [transactionId, setTransactionId] = useState("")
  const [notes, setNotes] = useState("")
  const [paying, setPaying] = useState(false)

  const totalAmount = selectedOrders.reduce((s, o) => s + o.commissionAmount, 0)

  const handlePay = async () => {
    setPaying(true)
    try {
      const orderIds = selectedOrders.map((o) => o.orderId)
      const res = await apiFetch("/api/admin/partner-commissions/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: partner.partnerId,
          orderIds,
          transactionId: transactionId.trim() || null,
          notes: notes.trim() || null,
          totalAmount,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Commission of ₹${totalAmount.toLocaleString("en-IN")} marked as paid for ${partner.partnerName}`)
        onPaid([partner.partnerId], orderIds)
        onClose()
      } else {
        toast.error(data.error?.message || "Failed to mark as paid")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900">Pay Commission</h3>
          <p className="text-sm text-gray-500 mt-1">
            Marking {selectedOrders.length} order{selectedOrders.length !== 1 ? "s" : ""} as paid for{" "}
            <span className="font-semibold text-gray-800">{partner.partnerName}</span>
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700 font-medium">Total Commission to Pay</p>
            <p className="text-2xl font-bold text-green-800 mt-1">₹{totalAmount.toLocaleString("en-IN")}</p>
            <p className="text-xs text-green-600 mt-1">across {selectedOrders.length} order(s)</p>
          </div>

          <div className="max-h-40 overflow-y-auto border rounded-lg divide-y text-sm">
            {selectedOrders.map((o) => (
              <div key={o.orderId} className="flex justify-between items-center px-3 py-2">
                <span className="text-gray-600 font-mono text-xs">{o.internalOrderId || o.orderId.slice(0, 12) + "..."}</span>
                <span className="font-semibold text-gray-900">₹{o.commissionAmount.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction / UTR Reference <span className="text-gray-400">(optional)</span>
            </label>
            <input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. UTR123456789"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for this payment..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={paying}
            className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Partner Row (accordion) ────────────────────────────────────────────────

function PartnerRow({
  group,
  onPaid,
  defaultExpanded = false,
}: {
  group: PartnerCommissionGroup
  onPaid: (partnerIds: string[], orderIds: string[]) => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [filter, setFilter] = useState<"all" | "pending" | "credited">("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [payModal, setPayModal] = useState<CommissionOrder[] | null>(null)

  const displayOrders = group.orders.filter(
    (o) => filter === "all" || o.commissionStatus === filter
  )

  const pendingOrders = group.orders.filter((o) => o.commissionStatus === "pending")
  const allPendingSelected =
    pendingOrders.length > 0 && pendingOrders.every((o) => selectedIds.has(o.orderId))

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(orderId) ? next.delete(orderId) : next.add(orderId)
      return next
    })
  }

  const toggleAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingOrders.map((o) => o.orderId)))
    }
  }

  const selectedPendingOrders = group.orders.filter(
    (o) => selectedIds.has(o.orderId) && o.commissionStatus === "pending"
  )

  const tierColors: Record<string, string> = {
    starter: "bg-gray-100 text-gray-700",
    growth: "bg-blue-100 text-blue-700",
    professional: "bg-purple-100 text-purple-700",
    enterprise: "bg-orange-100 text-orange-700",
  }

  const commissionStatusBadge = (s: string) => {
    if (s === "credited") return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Paid</span>
    if (s === "adjusted") return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">Adjusted</span>
    return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">Pending</span>
  }

  const orderStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-blue-100 text-blue-700",
      processing: "bg-blue-100 text-blue-700",
      shipped: "bg-purple-100 text-purple-700",
      delivered: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
      returned: "bg-gray-100 text-gray-700",
    }
    return (
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${map[s] || "bg-gray-100 text-gray-700"}`}>
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    )
  }

  return (
    <>
      <div className="bg-white border rounded-xl overflow-hidden mb-3 shadow-sm">
        {/* Partner header */}
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-purple-700 font-bold text-sm">{group.partnerName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">{group.partnerName}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tierColors[group.tier] || tierColors.starter}`}>
                  {group.tier}
                </span>
                <span className="text-xs text-gray-500">{group.commissionRate}% commission</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{group.partnerEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 ml-4 flex-shrink-0">
            {group.totalPending > 0 && (
              <div className="text-right">
                <p className="text-xs text-orange-500 font-medium">Pending</p>
                <p className="text-base font-bold text-orange-600">₹{group.totalPending.toLocaleString("en-IN")}</p>
              </div>
            )}
            {group.totalCredited > 0 && (
              <div className="text-right">
                <p className="text-xs text-green-500 font-medium">Paid</p>
                <p className="text-base font-bold text-green-600">₹{group.totalCredited.toLocaleString("en-IN")}</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-400">{group.orders.length} orders</p>
            </div>
            {group.totalPending > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPayModal(pendingOrders)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                <IndianRupee className="h-3.5 w-3.5" />
                Pay All Pending
              </button>
            )}
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Expanded order table */}
        {expanded && (
          <div className="border-t">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b gap-3 flex-wrap">
              <div className="flex gap-1">
                {(["all", "pending", "credited"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                      filter === f
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {f === "all" ? "All" : f === "pending" ? "Pending" : "Paid"}
                    {f === "pending" && group.totalPending > 0 && (
                      <span className="ml-1 bg-orange-200 text-orange-700 rounded-full px-1">{pendingOrders.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {selectedPendingOrders.length > 0 && (
                <button
                  onClick={() => setPayModal(selectedPendingOrders)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700"
                >
                  <IndianRupee className="h-3 w-3" />
                  Pay Selected ({selectedPendingOrders.length}) — ₹
                  {selectedPendingOrders.reduce((s, o) => s + o.commissionAmount, 0).toLocaleString("en-IN")}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left w-8">
                      {pendingOrders.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          onChange={toggleAllPending}
                          title="Select all pending"
                          className="rounded"
                        />
                      )}
                    </th>
                    <th className="px-4 py-2 text-left">Order ID</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-right">Order Total</th>
                    <th className="px-4 py-2 text-right">Comm. Rate</th>
                    <th className="px-4 py-2 text-right">Commission</th>
                    <th className="px-4 py-2 text-center">Order Status</th>
                    <th className="px-4 py-2 text-center">Comm. Status</th>
                    <th className="px-4 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-center text-gray-400 text-sm">
                        No orders match this filter
                      </td>
                    </tr>
                  ) : (
                    displayOrders.map((order) => (
                      <tr
                        key={order.orderId}
                        className={`hover:bg-gray-50 transition-colors ${
                          selectedIds.has(order.orderId) ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          {order.commissionStatus === "pending" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.orderId)}
                              onChange={() => toggleSelect(order.orderId)}
                              className="rounded"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-700">
                            {order.internalOrderId || order.orderId.slice(0, 12) + "…"}
                          </span>
                          {order.partnerOrderId && (
                            <p className="text-[10px] text-gray-400 mt-0.5">Ref: {order.partnerOrderId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800 font-medium">{order.customer.name}</p>
                          <p className="text-xs text-gray-400">{order.customer.email}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          ₹{order.orderTotal.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{order.commissionRate}%</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          ₹{order.commissionAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-center">{orderStatusBadge(order.orderStatus)}</td>
                        <td className="px-4 py-3 text-center">{commissionStatusBadge(order.commissionStatus)}</td>
                        <td className="px-4 py-3 text-center">
                          {order.commissionStatus === "pending" ? (
                            <button
                              onClick={() => setPayModal([order])}
                              className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                            >
                              Pay
                            </button>
                          ) : (
                            <BadgeCheck className="h-4 w-4 text-green-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {payModal && (
        <PayModal
          partner={group}
          selectedOrders={payModal}
          onClose={() => setPayModal(null)}
          onPaid={(pIds, oIds) => {
            setSelectedIds(new Set())
            onPaid(pIds, oIds)
          }}
        />
      )}
    </>
  )
}

// ─── Tab 1: Commissions ──────────────────────────────────────────────────────

function CommissionsTab() {
  const [groups, setGroups] = useState<PartnerCommissionGroup[]>([])
  const [summary, setSummary] = useState<CommissionSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "credited">("all")
  const [searchTerm, setSearchTerm] = useState("")

  const fetchCommissions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log("[Partner Payouts] Fetching commissions...")
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      params.append("t", Date.now().toString())
      const res = await apiFetch(`/api/admin/partner-commissions?${params}`, { cache: 'no-store' })
      console.log("[Partner Payouts] Commission response status:", res.status)
      const data = await res.json()
      console.log("[Partner Payouts] Commission data:", data)
      if (data.success) {
        setGroups(data.data.partners)
        setSummary(data.data.summary)
      } else {
        const msg = data.error?.message || "Failed to load commissions"
        setError(msg)
        toast.error(msg)
      }
    } catch (err: any) {
      const msg = err?.message || "Network error — could not reach server"
      setError(msg)
      toast.error("Failed to load commissions")
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchCommissions()
  }, [fetchCommissions])

  const handlePaid = (_partnerIds: string[], _orderIds: string[]) => {
    fetchCommissions()
  }

  const filteredGroups = groups.filter(
    (g) =>
      g.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.partnerEmail.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pending Commission</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{fmt(summary.totalPendingCommission)}</p>
              </div>
              <div className="p-2.5 bg-orange-100 rounded-full">
                <Hourglass className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Paid</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{fmt(summary.totalPaidCommission)}</p>
              </div>
              <div className="p-2.5 bg-green-100 rounded-full">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Partners Pending</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.partnersWithPending}</p>
              </div>
              <div className="p-2.5 bg-yellow-100 rounded-full">
                <Users className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Partners</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.partnersTotal}</p>
              </div>
              <div className="p-2.5 bg-purple-100 rounded-full">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search partner name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "credited"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${
                statusFilter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f === "all" ? "All Orders" : f === "pending" ? "Pending Only" : "Paid Only"}
            </button>
          ))}
          <button
            onClick={fetchCommissions}
            className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 text-red-500 border border-red-200 rounded-xl bg-red-50 p-6">
          <AlertCircle className="h-10 w-10 mb-2 opacity-70" />
          <p className="text-sm font-semibold">Failed to load commission data</p>
          <p className="text-xs text-red-400 mt-1 text-center max-w-sm">{error}</p>
          <button
            onClick={fetchCommissions}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 border rounded-xl bg-white">
          <IndianRupee className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm font-semibold">No commission data found</p>
          <p className="text-xs mt-1">
            {groups.length > 0
              ? `${groups.length} partner(s) found but none match your search`
              : "No partner orders exist yet"}
          </p>
        </div>
      ) : (
        <div>
          {filteredGroups.some((g) => g.totalPending > 0) && (
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-orange-600 uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
                <Hourglass className="h-3.5 w-3.5" /> Pending Commission
              </h3>
              {filteredGroups
                .filter((g) => g.totalPending > 0)
                .map((group) => (
                  <PartnerRow key={group.partnerId} group={group} onPaid={handlePaid} defaultExpanded={filteredGroups.length <= 3} />
                ))}
            </div>
          )}
          {filteredGroups.some((g) => g.totalPending === 0 && g.totalCredited > 0) && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5" /> All Commissions Paid
              </h3>
              {filteredGroups
                .filter((g) => g.totalPending === 0 && g.totalCredited > 0)
                .map((group) => (
                  <PartnerRow key={group.partnerId} group={group} onPaid={handlePaid} defaultExpanded={filteredGroups.length <= 3} />
                ))}
            </div>
          )}
          {filteredGroups.some((g) => g.totalPending === 0 && g.totalCredited === 0) && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">No Commission Set</h3>
              {filteredGroups
                .filter((g) => g.totalPending === 0 && g.totalCredited === 0)
                .map((group) => (
                  <PartnerRow key={group.partnerId} group={group} onPaid={handlePaid} defaultExpanded={filteredGroups.length <= 3} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Payout Requests (existing flow) ──────────────────────────────────

function PayoutRequestsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending_approval")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const itemsPerPage = 10

  const fetchPayouts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: itemsPerPage.toString() })
      if (statusFilter !== "all") params.append("status", statusFilter)
      params.append("t", Date.now().toString())
      const res = await apiFetch(`/api/admin/payouts?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        const list = (data.data.payouts || []).map((p: Payout & { partner?: { name: string } }) => ({
          ...p,
          partnerName: p.partner?.name || p.partnerName || p.partnerId?.slice(0, 8),
        }))
        setPayouts(list)
        setTotalPages(data.data.pagination?.totalPages || 1)
      } else {
        toast.error(data.error?.message || "Failed to fetch payouts")
      }
    } catch {
      toast.error("Failed to fetch payouts")
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, statusFilter])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  const handleApprove = async (payoutId: string) => {
    setProcessingId(payoutId)
    try {
      const res = await apiFetch(`/api/admin/payouts/${payoutId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Approved by admin" }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Payout approved")
        fetchPayouts()
      } else {
        toast.error(data.error?.message || "Failed to approve")
      }
    } catch {
      toast.error("Failed to approve payout")
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!showRejectModal || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    setProcessingId(showRejectModal)
    try {
      const res = await apiFetch(`/api/admin/payouts/${showRejectModal}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Payout rejected")
        fetchPayouts()
        setShowRejectModal(null)
        setRejectReason("")
      } else {
        toast.error(data.error?.message || "Failed to reject")
      }
    } catch {
      toast.error("Failed to reject payout")
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
      pending_approval: { cls: "bg-yellow-100 text-yellow-800", label: "Pending Approval", icon: <Clock className="h-3 w-3" /> },
      approved: { cls: "bg-blue-100 text-blue-800", label: "Approved", icon: <CheckCircle className="h-3 w-3" /> },
      processing: { cls: "bg-purple-100 text-purple-800", label: "Processing", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { cls: "bg-green-100 text-green-800", label: "Completed", icon: <CheckCircle className="h-3 w-3" /> },
      failed: { cls: "bg-red-100 text-red-800", label: "Failed", icon: <AlertCircle className="h-3 w-3" /> },
      rejected: { cls: "bg-gray-100 text-gray-800", label: "Rejected", icon: <XCircle className="h-3 w-3" /> },
    }
    const s = map[status] || map.pending_approval
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.cls}`}>
        {s.icon} {s.label}
      </span>
    )
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n)

  const filtered = payouts.filter(
    (p) =>
      (p.partnerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.bankAccount?.bankName || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pendingPayouts = filtered.filter((p) => p.status === "pending_approval")
  const historyPayouts = filtered.filter((p) => p.status !== "pending_approval")

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by partner, payout ID or bank..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
          className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
        <button onClick={fetchPayouts} className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 border rounded-xl bg-white">
          <CreditCard className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No payout requests found</p>
        </div>
      ) : (
        <>
          {pendingPayouts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Pending Approval ({pendingPayouts.length})
              </h3>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Payout ID</th>
                      <th className="px-4 py-3 text-left">Partner</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Bank</th>
                      <th className="px-4 py-3 text-left">Requested</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingPayouts.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{p.id.slice(0, 8)}…</code>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/partners/${p.partnerId}`} className="text-blue-600 hover:underline font-medium">
                            {p.partnerName || p.partnerId.slice(0, 8) + "…"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(p.amount)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{p.bankAccount?.bankName}</p>
                          <p className="text-xs text-gray-400 font-mono">{p.bankAccount?.accountNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(p.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(p.id)}
                              disabled={processingId === p.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {processingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                              Approve
                            </button>
                            <button
                              onClick={() => setShowRejectModal(p.id)}
                              disabled={processingId === p.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </button>
                            <Link href={`/admin/partners/${p.partnerId}`} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {historyPayouts.length > 0 && (
            <div className={pendingPayouts.length > 0 ? "mt-6" : ""}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Payout History ({historyPayouts.length})
              </h3>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Payout ID</th>
                      <th className="px-4 py-3 text-left">Partner</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Bank</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyPayouts.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{p.id.slice(0, 8)}…</code>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/partners/${p.partnerId}`} className="text-blue-600 hover:underline font-medium">
                            {p.partnerName || p.partnerId.slice(0, 8) + "…"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(p.amount)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{p.bankAccount?.bankName}</p>
                          <p className="text-xs text-gray-400 font-mono">{p.bankAccount?.accountNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(p.completedAt || p.rejectedAt || p.requestedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link href={`/admin/partners/${p.partnerId}`} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 inline-flex">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Payout</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason — the partner will be notified and funds returned to their wallet.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={3}
              className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowRejectModal(null); setRejectReason("") }} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processingId !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {processingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reject Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PartnerPayoutsPage() {
  const [activeTab, setActiveTab] = useState<"commissions" | "payouts">("commissions")

  useEffect(() => {
    console.log("------------------------------------------")
    console.log("!!! PARTNER PAYOUTS PAGE - VERSION 1.0 !!!")
    console.log("------------------------------------------")
  }, [])

  const tabs = [
    { id: "commissions" as const, label: "Commission Breakdown", icon: IndianRupee },
    { id: "payouts" as const, label: "Payout Requests", icon: Wallet },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Payouts & Commissions</h1>
        <p className="text-gray-500 mt-1 text-sm">
          View per-order commissions, pay partners directly, and manage payout requests.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab === "commissions" ? <CommissionsTab /> : <PayoutRequestsTab />}
    </div>
  )
}
