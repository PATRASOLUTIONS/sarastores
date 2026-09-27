import { type NextRequest, NextResponse } from "next/server"
import { getCollection, createObjectId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

async function findQueueEntry(id: string) {
  const collection = await getCollection("external_orders")
  let doc: any = null
  try {
    doc = await collection.findOne({ _id: createObjectId(id) })
  } catch {
    doc = null
  }
  if (!doc) doc = await collection.findOne({ _id: id as any })
  return { collection, doc }
}

/** Re-attempts placement with the provider by putting the entry back in the queue. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const { collection, doc } = await findQueueEntry(id)
    if (!doc) return NextResponse.json({ error: "External order not found" }, { status: 404 })

    if (doc.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled entries cannot be retried" }, { status: 409 })
    }

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: { status: "queued", updatedAt: new Date(), lastRetryBy: guard.userId, lastRetryAt: new Date() },
        $inc: { attempts: 1 },
      },
    )

    const updated = await collection.findOne({ _id: doc._id })
    return NextResponse.json({
      success: true,
      message: "Queued for another placement attempt",
      item: { ...updated, id: updated?._id?.toString?.() },
    })
  } catch (error) {
    console.error("[admin/external-orders][retry]", error)
    return NextResponse.json({ error: "Retry failed" }, { status: 500 })
  }
}
