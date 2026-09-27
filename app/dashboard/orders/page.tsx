"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/hooks/useCart"
import Link from "next/link"
import { ArrowRight, CheckCircle2, ChevronRight, Heart, Package, Search, Truck, XCircle } from "lucide-react"

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
  category?: string
}

interface Order {
  id: string
  /** Human-readable SARAECOM-xxxx reference; older rows may not have one. */
  orderId?: string
  createdAt: string
  status: string
  total: number
  subtotal?: number
  tax?: number
  shipping?: number
  items: OrderItem[]
  customer?: {
    name: string
    email: string
    phone?: string
    address?: string
  }
  paymentMethod?: string
}

interface Suggestion {
  id: string
  name: string
  price: number
  mrp?: number
  image?: string
  images?: string[]
  slug?: string
}

const TABS = [
  { id: "all", label: "All Orders" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "returned", label: "Returned" },
]

const PERIODS = [
  { id: "6m", label: "Last 6 Months", months: 6 },
  { id: "1y", label: "Last 1 Year", months: 12 },
  { id: "all", label: "All Time", months: 0 },
]

const TRACKER = ["Order Placed", "Packed", "Shipped", "Out for Delivery", "Delivered"]

const STATUS_STEP: Record<string, number> = {
  pending: 0,
  processing: 1,
  packed: 1,
  shipped: 2,
  "out for delivery": 3,
  delivered: 4,
}

const CLOSED_STATUSES = ["cancelled", "returned"]

const inr = (value: number) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const imageOf = (product: Suggestion) => product.image || product.images?.[0] || "/placeholder.svg"

function statusMeta(status: string) {
  const value = (status || "pending").toLowerCase()
  if (value === "delivered") return { label: "Delivered", tone: "text-green-700", icon: CheckCircle2 }
  if (value === "returned") return { label: "Returned", tone: "text-green-700", icon: CheckCircle2 }
  if (value === "cancelled") return { label: "Cancelled", tone: "text-red-600", icon: XCircle }
  if (value === "out for delivery") return { label: "Out for Delivery", tone: "text-green-700", icon: Truck }
  if (value === "shipped") return { label: "Shipped", tone: "text-[#1560BD]", icon: Truck }
  return { label: value.charAt(0).toUpperCase() + value.slice(1), tone: "text-amber-600", icon: Package }
}

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { addToCart } = useCart()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [period, setPeriod] = useState("6m")
  const [recommended, setRecommended] = useState<Suggestion[]>([])

  useEffect(() => {
    const fetchOrders = async () => {
      // Auth still hydrating: keep the skeleton rather than flashing "no orders".
      if (authLoading) return
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        const response = await apiFetch(`/api/orders?userId=${user.id}`)
        if (!response.ok) {
          throw new Error("Failed to fetch orders")
        }
        const data = await response.json()
        setOrders(data)
        setFilteredOrders(data)
      } catch (error) {
        console.error("Error fetching orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [user, authLoading])

  useEffect(() => {
    let filtered = [...orders]

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.orderId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.items.some((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => (order.status || "").toLowerCase() === statusFilter)
    }

    const months = PERIODS.find((option) => option.id === period)?.months || 0
    if (months > 0) {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      filtered = filtered.filter((order) => new Date(order.createdAt) >= cutoff)
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter, period])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch("/api/products?fields=card&limit=6")
        if (!response.ok || cancelled) return
        const raw = await response.json()
        const list = Array.isArray(raw) ? raw : raw?.products || []
        setRecommended(list.slice(0, 6))
      } catch {
        // Recommendations are optional merchandising — never block the page.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleBuyAgain = (order: Order) => {
    order.items.forEach((item) => {
      addToCart({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        image: item.image || "/placeholder.svg",
        quantity: item.quantity || 1,
        color: null,
        size: null,
      })
    })
  }

  const handleAddToCart = (product: Suggestion) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: imageOf(product),
      quantity: 1,
      color: null,
      size: null,
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
          <div className="h-24 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Heading, search, tabs ───────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="font-heading text-[20px] font-bold text-[#0F2557]">My Orders</h1>
            <p className="mt-0.5 text-[12px] text-slate-600">
              Track, return or buy again from your previous orders.
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[190px] flex-1 sm:max-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search your orders..."
                aria-label="Search your orders"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[#1560BD]"
              />
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Filter orders by period"
              className="rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none transition-colors focus:border-[#1560BD]"
            >
              {PERIODS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto border-t border-gray-100 px-5">
          {TABS.map((tab) => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 py-3 text-[13px] transition-colors ${
                  active
                    ? "border-[#1560BD] font-semibold text-[#1560BD]"
                    : "border-transparent text-gray-500 hover:text-[#0F2557]"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Orders ──────────────────────────────────────────── */}
      {filteredOrders.length === 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-14 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Package className="h-9 w-9 text-gray-400" strokeWidth={1.4} />
          </span>
          <h2 className="mt-5 font-heading text-[17px] font-bold text-[#0F2557]">
            {orders.length === 0 ? "No orders yet" : "No orders found"}
          </h2>
          <p className="mt-1.5 text-[13px] text-slate-600">
            {orders.length === 0
              ? "Your orders will appear here once you place one."
              : "Try a different search, status or time period."}
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#1560BD] px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Start Shopping
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const status = (order.status || "pending").toLowerCase()
            const meta = statusMeta(order.status)
            const StatusIcon = meta.icon
            const closed = CLOSED_STATUSES.includes(status)
            const step = STATUS_STEP[status] ?? 0
            const complete = closed || step >= 4

            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <header className="grid gap-3 border-b border-gray-100 bg-[#FAFCFE] px-5 py-3.5 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto] sm:items-center sm:gap-5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#0F2557]">Order No: {order.orderId || order.id}</p>
                    <p className="text-[11px] text-gray-500">Placed on {formatDate(order.createdAt)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[11px] text-gray-500">Total Amount</p>
                    <p className="font-heading text-[15px] font-bold text-[#0F2557]">{inr(order.total)}</p>
                  </div>
                  <p className={`flex items-center gap-1.5 text-[13px] font-semibold ${meta.tone}`}>
                    <StatusIcon className="h-4 w-4" strokeWidth={2} />
                    {meta.label}
                  </p>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="rounded-lg border border-[#1560BD] px-4 py-2 text-center text-[12px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white"
                  >
                    {complete ? "View Details" : "Track Order"}
                  </Link>
                </header>

                <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                  <ul className="space-y-3">
                    {order.items.slice(0, 3).map((item) => (
                      <li key={`${order.id}-${item.id}`} className="flex gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-50 object-contain p-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[#0F2557]">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">Qty: {item.quantity}</p>
                          <p className="text-[13px] font-bold text-[#0F2557]">{inr(item.price * item.quantity)}</p>
                        </div>
                      </li>
                    ))}
                    {order.items.length > 3 && (
                      <li className="text-[12px] text-gray-500">+{order.items.length - 3} more item(s)</li>
                    )}
                  </ul>

                  {!closed && (
                    <ol className="flex items-start gap-1 self-start rounded-lg bg-[#F7FAFE] px-3 py-4">
                      {TRACKER.map((label, index) => {
                        const done = index <= step
                        return (
                          <li key={label} className="relative flex-1 text-center">
                            {index > 0 && (
                              <span
                                aria-hidden
                                className={`absolute -left-1/2 top-[8px] h-0.5 w-full ${
                                  index <= step ? "bg-green-500" : "bg-gray-200"
                                }`}
                              />
                            )}
                            <span
                              className={`relative z-10 mx-auto flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                                done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                              }`}
                            >
                              <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                            </span>
                            <p
                              className={`mt-1.5 text-[10px] leading-tight ${
                                done ? "font-semibold text-[#0F2557]" : "text-gray-400"
                              }`}
                            >
                              {label}
                            </p>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#F7FAFE] px-5 py-3">
                  <p className="flex items-center gap-2 text-[12px] text-slate-600">
                    {!complete && <Truck className="h-4 w-4 text-[#1560BD]" strokeWidth={1.8} />}
                    {status === "cancelled"
                      ? "This order was cancelled."
                      : status === "returned"
                        ? "Return completed."
                        : step >= 4
                          ? "Delivered — thanks for shopping with SARA."
                          : "Your order is on its way. We'll notify you before delivery."}
                  </p>
                  <div className="flex items-center gap-3">
                    {complete && (
                      <button
                        type="button"
                        onClick={() => handleBuyAgain(order)}
                        className="rounded-lg bg-[#1560BD] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#0F2557]"
                      >
                        Buy Again
                      </button>
                    )}
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
                    >
                      View Details
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {/* ── Upgrade band ────────────────────────────────────── */}
      <section className="grid gap-4 rounded-xl bg-[#DCEBFA] px-5 py-5 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="font-heading text-[17px] font-bold text-[#0F2557]">Upgrade to something new!</p>
          <p className="mt-0.5 text-[12px] text-slate-600">Get the latest gadgets with exciting offers.</p>
          <Link
            href="/offers"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1560BD] px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Explore Best Deals
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Easy EMI", subtitle: "All Major Banks" },
            { title: "Free Delivery", subtitle: "Across Karnataka" },
            { title: "100% Genuine", subtitle: "Direct from Brands" },
          ].map(({ title, subtitle }) => (
            <li key={title} className="rounded-lg bg-white/70 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#0F2557]">{title}</p>
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Recommended ─────────────────────────────────────── */}
      {recommended.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="font-heading text-[16px] font-bold text-[#0F2557]">Recommended for You</h2>
            <Link
              href="/products"
              className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          <ul className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3 lg:grid-cols-6">
            {recommended.map((product) => (
              <li key={product.id} className="relative bg-white p-3">
                <Heart className="absolute right-3 top-3 h-4 w-4 text-gray-300" strokeWidth={1.6} />
                <Link href={`/product/${product.slug || product.id}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageOf(product)} alt="" className="mx-auto h-20 w-full object-contain" />
                  <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-[#0F2557]">
                    {product.name}
                  </p>
                </Link>
                <p className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-heading text-[13px] font-bold text-[#0F2557]">{inr(product.price)}</span>
                  {!!product.mrp && product.mrp > product.price && (
                    <span className="text-[11px] text-gray-400 line-through">{inr(product.mrp)}</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => handleAddToCart(product)}
                  className="mt-2 w-full rounded-lg border border-[#1560BD] py-1.5 text-[11px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white"
                >
                  Add to Cart
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
