import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"

// The collection is derived from the URL, so writes must be admin-only:
// otherwise this is an arbitrary-collection write primitive.
const ALLOWED_TYPES = new Set(["faq", "policies", "pages", "banners", "announcements"])

function resolveCollection(type: string): string | null {
  const name = type.replace(/-/g, "_")
  return ALLOWED_TYPES.has(name) ? name : null
}

export async function GET(request: NextRequest, context: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await context.params
    const collectionName = resolveCollection(type)
    if (!collectionName) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 404 })
    }

    const collection = await getCollection(collectionName)
    const items = await collection.find({ active: true }).toArray()

    return NextResponse.json({ success: true, [type]: items })
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ type: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { type } = await context.params
    const collectionName = resolveCollection(type)
    if (!collectionName) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 404 })
    }

    const data = await request.json()
    const collection = await getCollection(collectionName)

    const result = await collection.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({ success: true, id: result.insertedId })
  } catch (error) {
    console.error("Error creating content:", error)
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 })
  }
}
