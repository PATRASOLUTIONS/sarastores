import { NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getRazorpayClient } from "@/lib/razorpay"
import { checkAdminAuthorization } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 })
    }

    const paymentsCollection = await getCollection("payments")

    // Get all payments with order details
    const payments = await paymentsCollection
      .aggregate([
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "orderId",
            as: "orderDetails",
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ])
      .toArray()

    // For any payment missing an amount, try to fetch details from Razorpay
    for (const p of payments) {
      try {
          if ((p.amount === undefined || p.amount === null) && p.razorpayPaymentId) {
          try {
            const rp = getRazorpayClient()
            const fetched = await rp.payments.fetch(p.razorpayPaymentId)
            // Razorpay returns amount in the smallest currency unit (paise); convert to rupees
            if (typeof fetched.amount === "number") {
              p.amount = fetched.amount / 100
            }

            // copy a few useful fields if missing
            if (!p.method && fetched.method) p.method = fetched.method
            if (!p.status && fetched.status) p.status = fetched.status
            if (!p.createdAt && fetched.created_at) p.createdAt = new Date(fetched.created_at * 1000)
          } catch (err) {
            console.error(
              `Failed to fetch Razorpay payment ${p.razorpayPaymentId}:`,
              err instanceof Error ? err.message : err
            )
          }
          
        }
      } catch (err) {
        console.error(`Failed to fetch Razorpay payment ${p.razorpayPaymentId}:`, err instanceof Error ? err.message : err)
        // continue without failing the whole request
      }
    }

    return NextResponse.json({ success: true, payments: payments.map(payment => ({
      ...normalizeId(payment),
      orderDetails: normalizeId(payment.orderDetails),
    })) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}
