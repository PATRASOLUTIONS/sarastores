import { NextRequest, NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import {
  firstMobile, getStorePaymentWhatsAppSettings,
  STORE_PAYMENT_SETTINGS_COLLECTION, STORE_PAYMENT_WHATSAPP_SETTINGS_ID,
} from "@/lib/store-payment"
import { StorePaymentWhatsAppSettingsSchema } from "@/types/store-payment"

export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "private, no-store" }

async function listStores() {
  const stores = await (await getCollection("store_locations"))
    .find({ isActive: true }, { projection: { shopName: 1, city: 1, mobileNo: 1 } })
    .sort({ shopName: 1 }).toArray()
  return stores.map(store => ({
    id: store._id.toString(),
    name: String(store.shopName || "SARA store"),
    city: String(store.city || ""),
    listedPhone: firstMobile(store.mobileNo),
  }))
}

export async function GET() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const [settings, stores] = await Promise.all([getStorePaymentWhatsAppSettings(), listStores()])
    return NextResponse.json({
      settings, stores, templateConfigured: !!process.env.STORE_ORDER_WHATSAPP_TEMPLATE?.trim(),
    }, { headers })
  } catch (error) {
    return handleApiError(error, "Failed to load pay at store WhatsApp recipients")
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = StorePaymentWhatsAppSettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings" }, { status: 400, headers })
    }
    const result = await (await getCollection<{ _id: string }>(STORE_PAYMENT_SETTINGS_COLLECTION)).updateOne(
      { _id: STORE_PAYMENT_WHATSAPP_SETTINGS_ID },
      { $set: { ...parsed.data, updatedAt: new Date(), updatedBy: guard.user.id } },
      { upsert: true },
    )
    if (!result.acknowledged) throw new Error("WhatsApp recipient settings write was not acknowledged")
    return NextResponse.json(parsed.data, { headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers })
    return handleApiError(error, "Failed to save pay at store WhatsApp recipients")
  }
}
