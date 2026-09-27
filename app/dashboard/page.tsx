"use client"


import type React from "react"
import { apiFetch } from "@/lib/api-client"

import { useEffect, useState } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { useAuth } from "@/contexts/AuthContext"
import { useCart } from "@/hooks/useCart"
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Crown,
  Heart,
  Home,
  Lock,
  Mail,
  Package,
  Phone,
  Plus,
  Tag,
  Truck,
  User,
  XCircle,
} from "lucide-react"
import { toast } from "react-hot-toast"
import Link from "next/link"

interface RecentOrder {
  id: string
  /** Human-readable SARAECOM-xxxx reference; older rows may not have one. */
  orderId?: string
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
}

interface ViewedProduct {
  id: string
  name: string
  price: number
  mrp?: number
  image?: string
  images?: string[]
  slug?: string
}

const PERKS = [
  { icon: Package, label: "Track Orders Easily" },
  { icon: Heart, label: "Save Your Favourites" },
  { icon: Tag, label: "Get Exclusive Offers" },
  { icon: Crown, label: "Enjoy Member Benefits" },
]

const inr = (value: number) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const imageOf = (product: ViewedProduct) => product.image || product.images?.[0] || "/placeholder.svg"

function OrderStatusPill({ status }: { status: string }) {
  const value = (status || "pending").toLowerCase()
  const map: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    delivered: { label: "Delivered", className: "bg-green-50 text-green-700", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600", icon: XCircle },
    shipped: { label: "Shipped", className: "bg-[#E8F1FC] text-[#1560BD]", icon: Truck },
    processing: { label: "Processing", className: "bg-amber-50 text-amber-700", icon: Package },
  }
  const { label, className, icon: Icon } = map[value] || {
    label: value.charAt(0).toUpperCase() + value.slice(1),
    className: "bg-amber-50 text-amber-700",
    icon: Package,
  }

  return (
    <span className={`mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </span>
  )
}

function Detail({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1560BD]" strokeWidth={1.7} />
      <div className="min-w-0">
        <dt className="text-[11px] text-gray-500">{label}</dt>
        <dd className="truncate text-[13px] font-medium text-[#0F2557]">{value}</dd>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, updateProfile, isLoading } = useAuth()
  const { addToCart } = useCart()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [street, setStreet] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zip, setZip] = useState("")
  const [country, setCountry] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useSubmitLock()
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<ViewedProduct[]>([])
  const [showEditor, setShowEditor] = useState(false)
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
  })

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Initialize form with user data
        setName(user.name || "")
        setPhone(user.phone || "")
        setStreet(user.address?.street || "")
        setCity(user.address?.city || "")
        setState(user.address?.state || "")
        setZip(user.address?.zip || "")
        setCountry(user.address?.country || "")

        // Fetch user's recent orders
        fetchRecentOrders()
      }
      setIsPageLoading(false)
    }
  }, [user, isLoading])

  const fetchRecentOrders = async () => {
    if (!user) return

    try {
      const response = await apiFetch(`/api/orders?userId=${user.id}&limit=5`)
      if (response.ok) {
        const orders = await response.json()
        setRecentOrders(orders)

        // Calculate order statistics
        const stats = {
          totalOrders: orders.length,
          totalSpent: orders.reduce((sum: number, order: RecentOrder) => sum + order.total, 0),
          pendingOrders: orders.filter((order: RecentOrder) => order.status === "pending").length,
          deliveredOrders: orders.filter((order: RecentOrder) => order.status === "delivered").length,
        }
        setOrderStats(stats)
      }
    } catch (error) {
      console.error("Error fetching recent orders:", error)
    }
  }

  // Recently-viewed drives discovery on the dashboard; fall back to the live
  // catalogue so a brand-new account still sees something to buy.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    ;(async () => {
      try {
        const response = await apiFetch("/api/user/recently-viewed")
        if (response.ok) {
          const data = await response.json()
          const viewed = Array.isArray(data?.products) ? data.products : []
          if (viewed.length > 0) {
            if (!cancelled) setRecentlyViewed(viewed.slice(0, 5))
            return
          }
        }

        const fallback = await fetch("/api/products?fields=card&limit=5")
        if (!fallback.ok || cancelled) return
        const raw = await fallback.json()
        const list = Array.isArray(raw) ? raw : raw?.products || []
        if (!cancelled) setRecentlyViewed(list.slice(0, 5))
      } catch {
        // Discovery rail only — never block the dashboard on it.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  const handleAddToCart = (product: ViewedProduct) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock.acquire()) return
    setIsSubmitting(true)

    try {
      const success = await updateProfile({
        name,
        phone,
        address: {
          street,
          city,
          state,
          zip,
          country,
        },
      })

      if (success) {
        toast.success("Profile updated successfully")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("Failed to update profile")
    } finally {
      lock.release()
      setIsSubmitting(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-800"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">Please log in to access your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Welcome ───────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#DCEBFA] via-[#E9F2FC] to-[#F6FAFE] px-5 py-6 sm:px-7">
        <div className="relative z-10 max-w-[600px]">
          <h1 className="font-heading text-[24px] font-extrabold leading-tight text-[#0F2557] sm:text-[30px]">
            Welcome Back, {(user.name || "there").split(" ")[0]}!
          </h1>
          <p className="mt-1.5 text-[13px] text-slate-600 sm:text-[15px]">
            Good things happen when you shop with SARA.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PERKS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon className="h-6 w-6 text-[#0F2557]" strokeWidth={1.4} />
                <p className="mt-1.5 max-w-[112px] text-[11px] font-medium leading-tight text-[#0F2557]">{label}</p>
              </li>
            ))}
          </ul>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/account-welcome-bag.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-2 top-0 hidden h-full object-contain lg:block"
        />
      </section>

      {/* ── Recent orders ─────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h2 className="font-heading text-[16px] font-bold text-[#0F2557]">Recent Orders</h2>
          <Link
            href="/dashboard/orders"
            className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
          >
            View All Orders
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {recentOrders.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-300" strokeWidth={1.4} />
            <p className="mt-3 text-sm text-gray-600">You haven&apos;t placed an order yet.</p>
            <Link
              href="/products"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#1560BD] hover:underline"
            >
              Start Shopping
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-gray-100">
            {recentOrders.slice(0, 3).map((order) => {
              const lead = order.items?.[0]
              const extra = (order.items?.length || 0) - 1
              const settled = ["delivered", "cancelled"].includes((order.status || "").toLowerCase())
              return (
                <li key={order.id} className="border-b border-gray-100 p-4 last:border-b-0 lg:border-b-0">
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lead?.image || "/placeholder.svg"}
                      alt=""
                      className="h-[76px] w-[76px] flex-shrink-0 rounded-lg bg-gray-50 object-contain p-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#0F2557]">
                        {lead?.name || "Order"}
                        {extra > 0 && <span className="font-normal text-gray-500"> +{extra} more</span>}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-gray-500">Order #{order.orderId || order.id}</p>
                      <p className="text-[11px] text-gray-500">Placed on {formatDate(order.createdAt)}</p>
                      <p className="mt-1.5 font-heading text-[15px] font-bold text-[#0F2557]">{inr(order.total)}</p>
                      <OrderStatusPill status={order.status} />
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="mt-3 block rounded-lg border border-[#1560BD] py-2 text-center text-[12px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white"
                  >
                    {settled ? "View Details" : "Track Order"}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Recently viewed ──────────────────────────── */}
      {recentlyViewed.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="font-heading text-[16px] font-bold text-[#0F2557]">Recently Viewed</h2>
            <Link
              href="/products"
              className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          <ul className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3 lg:grid-cols-5">
            {recentlyViewed.map((product) => (
              <li key={product.id} className="relative bg-white p-3">
                <Heart className="absolute right-3 top-3 h-4 w-4 text-gray-300" strokeWidth={1.6} />
                <Link href={`/product/${product.slug || product.id}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageOf(product)} alt="" className="mx-auto h-24 w-full object-contain" />
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

      {/* ── Addresses + details ─────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="font-heading text-[16px] font-bold text-[#0F2557]">My Addresses</h2>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
            >
              Manage Addresses
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </header>
          <div className="space-y-3 p-4">
            {street || city ? (
              <div className="flex gap-3 rounded-lg border border-gray-200 p-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#F4F8FD] text-[#1560BD]">
                  <Home className="h-4 w-4" strokeWidth={1.7} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#0F2557]">
                    Home <span className="text-[11px] font-medium text-gray-500">(Default)</span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
                    {[street, city, state].filter(Boolean).join(", ")}
                    {zip ? ` - ${zip}` : ""}
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-[#F4F8FD] px-3 py-4 text-center text-[12px] text-slate-600">
                No delivery address saved yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#1560BD] py-2.5 text-[12px] font-semibold text-[#1560BD] transition-colors hover:bg-[#F4F8FD]"
            >
              {street || city ? "Update Address" : "Add New Address"}
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="font-heading text-[16px] font-bold text-[#0F2557]">My Details</h2>
            <button
              type="button"
              onClick={() => setShowEditor((open) => !open)}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-[#1560BD] hover:underline"
            >
              Edit Details
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </header>
          <dl className="grid gap-4 p-4 sm:grid-cols-2">
            <Detail icon={User} label="Name" value={user.name || "—"} />
            <Detail icon={Mail} label="Email" value={user.email} />
            <Detail icon={Phone} label="Phone Number" value={user.phone || "Not added"} />
            <Detail icon={Calendar} label="Member Since" value={formatDate(user.createdAt || "") || "—"} />
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <Detail icon={Lock} label="Password" value="••••••••" />
              <Link href="/dashboard/settings" className="text-[12px] font-semibold text-[#1560BD] hover:underline">
                Change Password
              </Link>
            </div>
          </dl>
        </section>
      </div>

      {/* ── Membership ─────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl bg-[#DCEBFA] px-5 py-5">
        <div className="relative z-10 flex flex-wrap items-center gap-4">
          <Crown className="h-8 w-8 flex-shrink-0 text-[#F5A623]" fill="#F5A623" strokeWidth={1.2} />
          <div className="min-w-[200px] flex-1">
            <p className="font-heading text-[17px] font-bold text-[#0F2557]">Be a SARA Member</p>
            <p className="mt-0.5 text-[12px] text-slate-600">
              Get early access to sales, exclusive offers, reward points and more!
            </p>
          </div>
          <Link
            href="/rewards"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1560BD] px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Join Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/account-member-gifts.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-3 hidden h-full object-contain lg:block"
        />
      </section>

      {/* Profile Information */}
      {showEditor && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h2 className="font-heading text-[16px] font-bold text-[#0F2557]">Edit Details</h2>
          <button
            type="button"
            onClick={() => setShowEditor(false)}
            className="text-[12px] font-semibold text-[#1560BD] hover:underline"
          >
            Close
          </button>
        </div>

        <div className="p-4 md:p-6">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            <div className="w-full lg:w-1/3">
              <div className="flex flex-col items-center p-4 md:p-6 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-[#E8F1FC] rounded-full flex items-center justify-center mb-4">
                  <User className="h-10 w-10 md:h-12 md:w-12 text-[#1560BD]" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-center">{user.name}</h3>
                <p className="text-gray-600 text-center text-sm md:text-base">{user.email}</p>
                <p className="text-gray-600 mt-2 text-center text-sm md:text-base">
                  Member since {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="w-full lg:w-2/3">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={user.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                  </div>

                  <div className="col-span-2 mt-4">
                    <h3 className="font-medium text-gray-900 mb-2">Address Information</h3>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP/Postal Code
                    </label>
                    <input
                      type="text"
                      id="zip"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-[#1560BD] text-white rounded-md hover:bg-[#0F2557] transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
