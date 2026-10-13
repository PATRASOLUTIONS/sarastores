import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth"
import { getFulfillmentOrder, queueExternalOrder, FulfillmentError } from "@/lib/external-fulfillment"
import { handleApiError } from "@/lib/api-error"

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const parsed = z.object({ orderId: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    const order = await getFulfillmentOrder(parsed.data.orderId)
    if (order.userId !== guard.user.id && guard.user.role !== "admin" && guard.user.role !== "superadmin") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, ...(await queueExternalOrder(order._id.toString())) })
  } catch (error) {
    if (error instanceof FulfillmentError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(error, "External order queue failed")
  }
}
