import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { fulfillSoftwareOrder, SoftwareFulfillmentError } from "@/lib/software-fulfillment"
import { handleApiError } from "@/lib/api-error"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const data = await fulfillSoftwareOrder(id)
    return NextResponse.json({ success: true, message: "Order software licenses assigned", data })
  } catch (error) {
    if (error instanceof SoftwareFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return handleApiError(error, "Software fulfillment failed")
  }
}
