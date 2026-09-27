import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { getCollection, COLLECTIONS } from "@/lib/db-service"

export const dynamic = "force-dynamic"

/**
 * The four classification lists the data-entry screens offer as dropdowns.
 *
 * Brands, categories and sub-categories have their own collections. CHAR DESC
 * does not — it is a free-text field on products — so its options are the
 * distinct values already in use, which keeps operators consistent without
 * needing a new collection.
 */

const CHAR_DESC_COLLECTION = COLLECTIONS.PRODUCTS
/** COLLECTIONS has no BRANDS entry; the live collection is `brands`. */
const BRANDS_COLLECTION = "brands"

type ListKey = "brands" | "categories" | "subCategories" | "charDescs"

async function readList(key: ListKey): Promise<string[]> {
  if (key === "charDescs") {
    const products = await getCollection(CHAR_DESC_COLLECTION)
    const values = await products.distinct("char_desc", { char_desc: { $nin: [null, ""] } })
    return values.map((v) => String(v).trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }

  const name =
    key === "brands"
      ? BRANDS_COLLECTION
      : key === "categories"
        ? COLLECTIONS.CATEGORIES
        : COLLECTIONS.SUB_CATEGORIES

  const collection = await getCollection(name)
  const docs = await collection.find({}, { projection: { name: 1 } }).toArray()
  return Array.from(new Set(docs.map((d: any) => String(d?.name ?? "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  )
}

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const [brands, categories, subCategories, charDescs] = await Promise.all([
      readList("brands"),
      readList("categories"),
      readList("subCategories"),
      readList("charDescs"),
    ])
    return NextResponse.json({ success: true, brands, categories, subCategories, charDescs })
  } catch (error) {
    return handleApiError(error, "Failed to load classification lists")
  }
}

/** Adds a value to one of the lists so an operator never leaves the page to create one. */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json().catch(() => ({}))
    const list = String(body?.list ?? "") as ListKey
    const value = String(body?.value ?? "").trim()

    if (!["brands", "categories", "subCategories", "charDescs"].includes(list)) {
      return NextResponse.json({ error: "Unknown list" }, { status: 400 })
    }
    if (!value || value.length > 120) {
      return NextResponse.json({ error: "Enter a value of 1–120 characters" }, { status: 400 })
    }

    // CHAR DESC has no collection; it becomes an option as soon as a product uses it.
    if (list === "charDescs") {
      return NextResponse.json({ success: true, value, stored: false })
    }

    const name =
      list === "brands"
        ? BRANDS_COLLECTION
        : list === "categories"
          ? COLLECTIONS.CATEGORIES
          : COLLECTIONS.SUB_CATEGORIES

    const collection = await getCollection(name)
    const existing = await collection.findOne({ name: { $regex: `^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } })
    if (existing) {
      return NextResponse.json({ success: true, value: String((existing as any).name), stored: false })
    }

    const doc: Record<string, unknown> = {
      name: value,
      active: true,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    if (list !== "brands") doc.image = "📦"
    if (list === "brands") doc.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    await collection.insertOne(doc)
    return NextResponse.json({ success: true, value, stored: true })
  } catch (error) {
    return handleApiError(error, "Failed to add the value")
  }
}
