"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Headphones,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { cleanProductName } from "@/utils/cleanProductName"
import { useSettingsData } from "@/hooks/useSettingsData"

const JOURNEY = [
  { label: "Order Placed", icon: CheckCircle2 },
  { label: "Payment Confirmed", icon: CreditCard },
  { label: "Packed", icon: Package },
  { label: "Shipped", icon: Truck },
  { label: "Out for Delivery", icon: MapPin },
  { label: "Delivered", icon: BadgeCheck },
]

const TRUST = [
  { icon: BadgeCheck, title: "100% Genuine Products", detail: "Direct from Brands" },
  { icon: CreditCard, title: "Easy EMI Options", detail: "All Major Banks" },
  { icon: Truck, title: "Free & Fast Delivery", detail: "Across Karnataka" },
  { icon: RefreshCw, title: "Hassle-Free Returns", detail: "Easy & Secure" },
  { icon: Headphones, title: "Expert Support", detail: "" },
]

/** Steps completed so far, inferred from the order status. */
function journeyIndex(status?: string): number {
  const s = String(status || "").toLowerCase()
  if (s.includes("deliver")) return 5
  if (s.includes("out for")) return 4
  if (s.includes("ship") || s.includes("dispatch")) return 3
  if (s.includes("pack")) return 2
  if (s.includes("confirm") || s.includes("paid") || s.includes("process")) return 1
  return 0
}

function formatDate(value?: string | Date) {
  const d = value ? new Date(value) : new Date()
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function ThankYouPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams?.get("orderId") || ""
  const { data: settings } = useSettingsData()

  const [order, setOrder] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])

  useEffect(() => {
    if (!orderId) return
    try {
      const saved = JSON.parse(localStorage.getItem("orders") || "[]")
      const found = saved.find((o: any) => o.id === orderId)
      if (found) {
        setOrder(found)
        return
      }
    } catch {
      /* localStorage is a convenience only */
    }

    fetch(`/api/orders/${orderId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setOrder(data))
      .catch(() => {})
  }, [orderId])

  useEffect(() => {
    fetch("/api/products?fields=card")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setSuggestions(d.filter((p: any) => p.image && p.price > 0).slice(0, 5)))
      .catch(() => {})
  }, [])

  const items: any[] = Array.isArray(order?.items) ? order.items : []
  const step = journeyIndex(order?.status)
  const phone = settings?.storePhone || "1800 123 7272"
  const customerName = order?.customer?.name || order?.shippingAddress?.name || order?.name || "there"
  const customerEmail = order?.customer?.email || order?.email || ""
  const customerPhone = order?.customer?.phone || order?.shippingAddress?.phone || ""
  const address = order?.shippingAddress || order?.address

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="flex-grow">
        <div className="section-container space-y-5 py-5">
          {/* ── Confirmation banner ──────────────────────────────── */}
          <section className="grid gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#E9F1FB] to-[#F7FBFF] px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:px-9">
            <div>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0F8A3C] text-white">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h1 className="mt-4 font-heading text-2xl font-extrabold text-[#0F2557] md:text-[32px]">
                Thank you, {customerName}!
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-700">Your order has been placed successfully.</p>
              {(customerEmail || customerPhone) && (
                <p className="mt-1 text-[13px] text-slate-500">
                  A confirmation has been sent to {[customerEmail, customerPhone].filter(Boolean).join(" and ")}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Order Number</p>
              <p className="mt-1 font-heading text-lg font-bold text-[#0F2557]">{orderId || "—"}</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Placed on</p>
              <p className="mt-1 text-[13px] font-medium text-slate-700">{formatDate(order?.createdAt)}</p>

              <Link
                href={orderId ? `/track?orderId=${encodeURIComponent(orderId)}` : "/track"}
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1560BD] text-[13px] font-semibold text-white hover:bg-[#0D4C99]"
              >
                Track Order
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
              >
                Continue Shopping
              </Link>
            </div>
          </section>

          {/* ── Summary + delivery ───────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5" aria-labelledby="order-summary">
              <h2 id="order-summary" className="font-heading text-base font-bold text-gray-900">
                Order Summary{items.length > 0 ? ` (${items.length} item${items.length === 1 ? "" : "s"})` : ""}
              </h2>

              {items.length === 0 ? (
                <p className="mt-4 text-[13px] text-gray-500">
                  Your order details will appear here once they finish syncing.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <li key={`${item.id}-${i}`} className="flex items-center gap-3 py-3">
                      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt=""
                          aria-hidden
                          className="h-full w-full object-contain p-1"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] font-medium leading-tight text-gray-800">
                          {cleanProductName(item.name)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-[13px] font-bold text-gray-900">
                        ₹{(Number(item.price) * Number(item.quantity || 1)).toLocaleString("en-IN")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {order && (
                <dl className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-[13px]">
                  <div className="flex justify-between text-gray-600">
                    <dt>Subtotal</dt>
                    <dd>₹{Number(order.subtotal ?? 0).toLocaleString("en-IN")}</dd>
                  </div>
                  {order.coupon?.discount ? (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Coupon ({order.coupon.code})</dt>
                      <dd>−₹{Number(order.coupon.discount).toLocaleString("en-IN")}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-gray-600">
                    <dt>Delivery</dt>
                    <dd>
                      {Number(order.shipping ?? 0) === 0
                        ? "FREE"
                        : `₹${Number(order.shipping).toLocaleString("en-IN")}`}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-gray-900">
                    <dt>Total Paid</dt>
                    <dd>₹{Number(order.total ?? 0).toLocaleString("en-IN")}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5" aria-labelledby="delivery-details">
              <h2 id="delivery-details" className="font-heading text-base font-bold text-gray-900">
                Delivery Details
              </h2>

              <div className="mt-4 space-y-4 text-[13px]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Delivery Address</p>
                  {address ? (
                    <p className="mt-1 leading-relaxed text-gray-700">
                      {[
                        address.name,
                        address.line1 || address.street,
                        address.line2,
                        address.city,
                        address.state,
                        address.pincode || address.zip,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-gray-500">As provided at checkout.</p>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Delivery Method</p>
                  <p className="mt-1 text-gray-700">
                    {order?.deliveryMethod || "Home Delivery — free standard installation on eligible products"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Payment Method</p>
                  <p className="mt-1 text-gray-700">{order?.paymentMethod || order?.payment?.method || "Prepaid"}</p>
                </div>
              </div>
            </section>
          </div>

          {/* ── Journey ──────────────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white p-5" aria-labelledby="order-journey">
            <h2 id="order-journey" className="font-heading text-base font-bold text-gray-900">
              Order Journey
            </h2>
            <ol className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              {JOURNEY.map(({ label, icon: Icon }, i) => {
                const done = i <= step
                return (
                  <li key={label} className="flex flex-col items-center text-center">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        done ? "bg-[#0F8A3C] text-white" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={`mt-2 text-[11px] font-semibold leading-tight ${
                        done ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* ── WhatsApp updates ─────────────────────────────────── */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-emerald-900">Get real-time updates on WhatsApp</p>
                <p className="text-[11px] text-emerald-700">Delivery slots, engineer visits and invoices.</p>
              </div>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hi SARA, please send updates for order ${orderId}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[#25D366] px-4 py-2 text-[13px] font-semibold text-white hover:brightness-95"
            >
              Enable Updates
            </a>
          </section>

          {/* ── Suggestions ──────────────────────────────────────── */}
          {suggestions.length > 0 && (
            <section aria-labelledby="you-might-like">
              <h2 id="you-might-like" className="font-heading text-base font-bold text-gray-900">
                You Might Also Like
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {suggestions.map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug || p.id}`}
                    className="group flex flex-col rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
                  >
                    <span className="flex h-28 items-center justify-center rounded-t-lg bg-gray-50 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" aria-hidden className="h-full w-full object-contain" />
                    </span>
                    <span className="flex flex-1 flex-col p-3 text-center">
                      <span className="line-clamp-2 text-[12px] leading-tight text-gray-700">
                        {cleanProductName(p.name)}
                      </span>
                      <span className="mt-1.5 text-[13px] font-bold text-gray-900">
                        ₹{Number(p.price).toLocaleString("en-IN")}
                      </span>
                      <span className="mt-auto pt-2 text-[12px] font-semibold text-[#1560BD]">View Details</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Trust strip ──────────────────────────────────────── */}
          <section aria-label="Why shop at SARA">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TRUST.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#1560BD]">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-tight text-gray-900">{title}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{detail || phone}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
