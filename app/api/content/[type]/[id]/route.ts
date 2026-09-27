import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { ObjectId } from "mongodb"

// The collection is derived from the URL, so it must be allow-listed and
// admin-only — otherwise this edits or deletes documents in any collection.
const ALLOWED_TYPES = new Set(["faq", "policies", "pages", "banners", "announcements"])

function resolveCollection(type: string): string | null {
  const name = type.replace(/-/g, "_")
  return ALLOWED_TYPES.has(name) ? name : null
}

export async function PUT(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { type, id } = await context.params
    const collectionName = resolveCollection(type)
    if (!collectionName) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 404 })
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const data = await request.json()
    const collection = await getCollection(collectionName)
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating content:", error)
    return NextResponse.json({ error: "Failed to update content" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { type, id } = await context.params
    const collectionName = resolveCollection(type)
    if (!collectionName) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 404 })
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const collection = await getCollection(collectionName)
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting content:", error)
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 })
  }
}
