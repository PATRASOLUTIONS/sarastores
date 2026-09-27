import { type NextRequest, NextResponse } from "next/server"
import { getCollection, createObjectId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

/** Marks a queued fulfilment entry cancelled so the worker stops retrying it. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const collection = await getCollection("external_orders")

    let doc: any = null
    try {
      doc = await collection.findOne({ _id: createObjectId(id) })
    } catch {
      doc = null
    }
    if (!doc) doc = await collection.findOne({ _id: id as any })
    if (!doc) return NextResponse.json({ error: "External order not found" }, { status: 404 })

    if (doc.status === "placed") {
      return NextResponse.json({ error: "Already placed with the provider — cannot cancel" }, { status: 409 })
    }
    if (doc.status === "cancelled") {
      return NextResponse.json({ success: true, message: "Already cancelled" })
    }

    await collection.updateOne(
      { _id: doc._id },
      { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: guard.userId, updatedAt: new Date() } },
    )

    const updated = await collection.findOne({ _id: doc._id })
    return NextResponse.json({
      success: true,
      message: "External order cancelled",
      item: { ...updated, id: updated?._id?.toString?.() },
    })
  } catch (error) {
    console.error("[admin/external-orders][cancel]", error)
    return NextResponse.json({ error: "Cancel failed" }, { status: 500 })
  }
}
