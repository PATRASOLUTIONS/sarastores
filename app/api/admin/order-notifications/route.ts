import { NextRequest, NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { OrderNotificationSettingsSchema } from "@/lib/validation"
import { getOrderNotificationSettings, ORDER_NOTIFICATION_COLLECTION, ORDER_NOTIFICATION_SETTINGS_ID } from "@/lib/order-notifications"
import type { Document } from "mongodb"

const headers = { "Cache-Control": "private, no-store" }

export async function GET() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    return NextResponse.json(await getOrderNotificationSettings(), { headers })
  } catch (error) {
    return handleApiError(error, "Failed to load order notification settings")
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = OrderNotificationSettingsSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings" }, { status: 400, headers })
    const result = await (await getCollection<Document & { _id: string }>(ORDER_NOTIFICATION_COLLECTION)).updateOne(
      { _id: ORDER_NOTIFICATION_SETTINGS_ID },
      { $set: { ...parsed.data, updatedAt: new Date(), updatedBy: guard.user.id } },
      { upsert: true },
    )
    if (!result.acknowledged) throw new Error("Notification settings write was not acknowledged")
    return NextResponse.json(parsed.data, { headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers })
    return handleApiError(error, "Failed to save order notification settings")
  }
}
