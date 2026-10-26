import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { CreateGiftSchema } from "@/lib/gift-validation"
import { handleApiError } from "@/lib/api-error"

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const gifts = await (await getCollection("gift_items")).find({}).sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ success: true, gifts: normalizeId(gifts) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return handleApiError(error, "Could not load gifts") }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = CreateGiftSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    // A string SKU _id provides atomic uniqueness without a live index migration.
    const gift = { ...parsed.data, _id: parsed.data.sku, createdAt: new Date(), updatedAt: new Date() }
    await (await getCollection<{ _id: string; [key: string]: unknown }>("gift_items")).insertOne(gift)
    return NextResponse.json({ success: true, gift: normalizeId(gift) }, { status: 201 })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "A gift with this SKU already exists" }, { status: 409 })
    return handleApiError(error, "Could not save gift")
  }
}
