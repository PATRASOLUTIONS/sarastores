import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, getSession } from "@/lib/auth"
import { getCollection, createObjectId } from "@/lib/db-service"
import { getOrderAdminScope, orderWithinAdminScope } from "@/lib/order-access"
import { fulfillSoftwareOrder, SoftwareFulfillmentError } from "@/lib/software-fulfillment"
import { handleApiError } from "@/lib/api-error"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const scope = await getOrderAdminScope(await getSession())
    let objectId
    try { objectId = createObjectId(id) } catch {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
    }
    const order = await (await getCollection("orders")).findOne({ $and: [scope.filter, { _id: objectId }] })
    if (!order || !orderWithinAdminScope(scope, order)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    const data = await fulfillSoftwareOrder(id, scope.filter)
    return NextResponse.json({ success: true, message: "Order software licenses assigned", data })
  } catch (error) {
    if (error instanceof SoftwareFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return handleApiError(error, "Software fulfillment failed")
  }
}
