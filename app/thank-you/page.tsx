"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import OrderSuccess from "@/components/OrderSuccess"
import { apiFetch } from "@/lib/api-client"
import { OrderConfirmationSchema, type OrderConfirmation } from "@/lib/order-confirmation"

export default function ThankYouPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId") || ""
  const guestToken = searchParams.get("token")
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setOrder(null)
    setError("")
    if (!orderId) { setLoading(false); setError("No order number was provided."); return }
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const tokenQuery = guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""
        const response = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}${tokenQuery}`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view this order." :
          response.status === 404 ? "This order could not be found or does not belong to your account." : "Order details could not be loaded.")
        const result = OrderConfirmationSchema.safeParse(await response.json())
        if (!result.success) throw new Error("Order details are unavailable. Please retry.")
        if (!controller.signal.aborted) setOrder(result.data)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error("[Order confirmation] Load failed:", error)
        setError(error instanceof Error ? error.message : "Order details could not be loaded.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [orderId, guestToken, attempt])

  return <div className="flex min-h-screen flex-col bg-white"><Header /><main className="flex-grow">
    {loading ? <p role="status" className="section-container py-16 text-center">Loading your order details...</p> :
      order ? <OrderSuccess order={order} guestToken={guestToken} /> :
        <div role="alert" className="section-container py-16 text-center"><h1 className="text-xl font-semibold">Order details unavailable</h1>
          <p className="mt-3 text-sm text-gray-700">{error}</p>
          {orderId && <button type="button" className="mt-4 mr-4 text-blue-700 underline" onClick={() => setAttempt(value => value + 1)}>Retry order details</button>}
          <Link href="/dashboard/orders" className="text-blue-700 underline">View your orders</Link>
        </div>}
  </main><Footer /></div>
}
