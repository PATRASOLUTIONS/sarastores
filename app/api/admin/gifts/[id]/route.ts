import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { CreateGiftSchema, GiftSkuSchema } from "@/lib/gift-validation"
import { handleApiError } from "@/lib/api-error"

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const parsed = CreateGiftSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    if (parsed.data.sku !== id) return NextResponse.json({ error: "Gift SKU cannot be changed. Create a new gift instead." }, { status: 400 })
    const gift = await (await getCollection<{ _id: string; [key: string]: unknown }>("gift_items")).findOneAndUpdate({ _id: id },
      { $set: { ...parsed.data, updatedAt: new Date() } }, { returnDocument: "after" })
    if (!gift) return NextResponse.json({ error: "Gift not found" }, { status: 404 })
    return NextResponse.json({ success: true, gift: normalizeId(gift) })
  } catch (error) { return handleApiError(error, "Could not update gift") }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    if (!GiftSkuSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid gift SKU" }, { status: 400 })
    const result = await (await getCollection<{ _id: string; [key: string]: unknown }>("gift_items")).updateOne({ _id: id }, { $set: { active: false, updatedAt: new Date() } })
    if (!result.matchedCount) return NextResponse.json({ error: "Gift not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error, "Could not archive gift") }
}
