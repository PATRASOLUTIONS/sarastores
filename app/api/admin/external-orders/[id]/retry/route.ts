import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { manageQueuedExternalOrder, FulfillmentError } from "@/lib/external-fulfillment"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const result = await manageQueuedExternalOrder(id, "retry", guard.userId)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof FulfillmentError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(error, "External fulfillment retry check failed")
  }
}
