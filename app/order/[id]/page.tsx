"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle, Package, Truck } from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { cleanProductName } from "@/utils/cleanProductName"

/**
 * Order view reachable without a session.
 *
 * A guest order is only readable with the capability token minted at checkout,
 * which arrives in the `token` query parameter and is also cached in
 * localStorage so the page survives a refresh without the query string.
 * Signed-in shoppers reach the same page and are authorised by their session.
 */
export default function OrderPage() {
  return (
    <Suspense fallback={null}>
      <OrderView />
    </Suspense>
  )
}

function OrderView() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const orderId = params?.id

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    let token = searchParams.get("token")
    if (!token) {
      try {
        token = localStorage.getItem(`guest_order_${orderId}`)
      } catch {
        token = null
      }
    } else {
      try {
        localStorage.setItem(`guest_order_${orderId}`, token)
      } catch {
        // Non-fatal: the link in the address bar still works.
      }
    }

    let cancelled = false
    ;(async () => {
      try {
        const url = token
          ? `/api/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`
          : `/api/orders/${encodeURIComponent(orderId)}`
        const res = await fetch(url)

        if (cancelled) return

        if (!res.ok) {
          setError(
            res.status === 404
              ? "We couldn't find that order. Check the link, or sign in if you placed it with an account."
              : "Please sign in to view this order.",
          )
          return
        }

        setOrder(await res.json())
      } catch {
        if (!cancelled) setError("Something went wrong loading this order.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orderId, searchParams])

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />

      <main className="container mx-auto flex-grow px-4 py-10">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <p className="text-gray-600">Loading order…</p>
          ) : error ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <p className="flex items-start gap-2 text-gray-700">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                {error}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Sign in
                </Link>
                <Link
                  href="/track"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Track an order
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">
                      Order {order.orderId || order.id}
                    </h1>
                    <p className="mt-1 text-sm capitalize text-gray-600">
                      Status: {order.status || "pending"} · Placed{" "}
                      {order.date ? new Date(order.date).toLocaleDateString("en-IN") : "recently"}
                    </p>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-gray-700">Total</dt>
                    <dd className="mt-1 text-lg font-bold text-gray-900">
                      ₹{Number(order.total || 0).toLocaleString("en-IN")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-700">Payment</dt>
                    <dd className="mt-1 capitalize text-gray-700">{order.paymentMethod || "—"}</dd>
                  </div>
                  {order.fulfilment?.method === "pickup" ? (
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-gray-700">Collect from</dt>
                      <dd className="mt-1 text-gray-700">
                        {order.fulfilment.storeName}
                        {order.fulfilment.storeAddress ? `, ${order.fulfilment.storeAddress}` : ""}
                      </dd>
                    </div>
                  ) : (
                    order.shippingAddress && (
                      <div className="sm:col-span-2">
                        <dt className="font-semibold text-gray-700">Delivering to</dt>
                        <dd className="mt-1 text-gray-700">
                          {[
                            order.shippingAddress.name,
                            order.shippingAddress.street,
                            order.shippingAddress.city,
                            order.shippingAddress.state,
                            order.shippingAddress.zip,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
              </div>

              {Array.isArray(order.items) && order.items.length > 0 && (
                <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Package className="h-5 w-5 text-brand-primary" />
                    Items
                  </h2>
                  <ul className="mt-4 divide-y divide-gray-100">
                    {order.items.map((item: any, index: number) => (
                      <li key={index} className="flex items-center justify-between gap-4 py-3">
                        <span className="text-sm text-gray-800">
                          {cleanProductName(item.name || "Item")}
                          <span className="block text-xs text-gray-500">Qty {item.quantity || 1}</span>
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          ₹{Number((item.price || 0) * (item.quantity || 1)).toLocaleString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/track"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Truck className="h-4 w-4" />
                  Track this order
                </Link>
                <Link
                  href="/products"
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Continue shopping
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
