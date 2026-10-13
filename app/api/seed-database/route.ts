import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { COLLECTIONS } from "@/lib/db-service"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"
import { checkAdminAuthorization } from "@/lib/auth"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { SeedCatalogueSchema, SeedDatabaseRequestSchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"

// Helper to compute a realistic price by manufacturer fallback
const MANUFACTURER_BASE_PRICE: Record<string, number> = {
  Apple: 109900,
  Dell: 129900,
  HP: 119900,
  Lenovo: 139900,
  Asus: 109900,
  Acer: 89900,
  MSI: 94900,
  Samsung: 124900,
  Microsoft: 129900,
}

function computePrice(manufacturerName?: string) {
  const base = manufacturerName && MANUFACTURER_BASE_PRICE[manufacturerName] ? MANUFACTURER_BASE_PRICE[manufacturerName] : 99900
  return base
}

function buildDescription(row: Record<string, string | number | boolean | null>) {
  const normalized = extractCanonicalProductMetadata(row)
  const parts = [
    normalized.subCategoryProdDesc,
    normalized.charDesc,
    row["Features"] ? `Features: ${row["Features"]}` : "",
    row["Capacity Description"] ? `Capacity: ${row["Capacity Description"]}` : "",
    normalized.manufacturerName ? `Manufacturer: ${normalized.manufacturerName}` : "",
  ]
  return parts.filter(Boolean).join(". ")
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const text = await request.text()
    const input = SeedDatabaseRequestSchema.safeParse(text ? JSON.parse(text) : {})
    if (!input.success) return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 })
    const rows = SeedCatalogueSchema.parse(JSON.parse(
      await readFile(path.join(process.cwd(), "lib", "seed-data", "realistic-laptop-master-data.json"), "utf8"),
    ))
    if (!input.data.apply) {
      return NextResponse.json({ success: true, dryRun: true, products: { planned: rows.length }, message: "Preview only. Explicit apply replaces source='excel' products." })
    }
    const { client, db } = await connectToDatabase()
    const session = client.startSession()
    try {
      const summary = await session.withTransaction(async () => {

    // Ensure collections exist
    const categoriesCol = db.collection<{ name: string; description: string; image: string; createdAt: Date; updatedAt: Date }>(COLLECTIONS.CATEGORIES)
    const productsCol = db.collection(COLLECTIONS.PRODUCTS)

    // Derive unique category names from canonical category field
    const categoryNames = new Set<string>()
    for (const r of rows) {
      const normalized = extractCanonicalProductMetadata(r)
      const group = normalized.categoryGroupName || "Uncategorized"
      categoryNames.add(group.trim())
    }

    // Fetch existing categories
    const existingCats = await categoriesCol.find({ name: { $in: Array.from(categoryNames) } }, { session }).toArray()
    const catMap = new Map<string, string>()
    existingCats.forEach((c) => catMap.set(c.name, c._id.toString()))

    // Insert missing categories
    const missing = Array.from(categoryNames).filter((name) => !catMap.has(name))
    if (missing.length > 0) {
      const insertPayload = missing.map((name) => ({
        name,
        description: "",
        image: "/placeholder.svg?height=200&width=200",
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
      const ins = await categoriesCol.insertMany(insertPayload, { session })
      if (ins.insertedCount !== insertPayload.length) throw new Error("Seed category insertion was incomplete")
      // refetch inserted docs
      const insertedDocs = await categoriesCol.find({ _id: { $in: Object.values(ins.insertedIds) } }, { session }).toArray()
      if (insertedDocs.length !== insertPayload.length) throw new Error("Seed categories could not be reloaded")
      insertedDocs.forEach((c) => catMap.set(c.name, c._id.toString()))
    }

    // Optional: remove previously imported products to avoid duplicates
    const deleted = await productsCol.deleteMany({ source: "excel" }, { session })
    if (!deleted.acknowledged) throw new Error("Seed product replacement was not acknowledged")

    // Map rows to products
    const productDocs = rows.map((r) => {
      const normalized = extractCanonicalProductMetadata(r)
      const name = normalized.name || "Unnamed Product"
      const categoryName = normalized.categoryGroupName || "Uncategorized"
      const categoryId = catMap.get(categoryName) || null
      const manufacturerName = normalized.manufacturerName
      const stock = Number(r["In Stock"] ?? 0)
      const raw = buildSchemaSynchronizedRaw(r, normalized)

      return {
        // base fields used by UI
        name,
        description: normalized.description || buildDescription(r),
        price: computePrice(manufacturerName),
        // MRP: explicit field in JSON if available; otherwise leave undefined
        mrp: r["MRP"] !== undefined && r["MRP"] !== null && r["MRP"] !== "" && !isNaN(Number(r["MRP"]))
          ? Number(r["MRP"]) : undefined,
        image: "/modern-laptop-workspace.png",
        stock: Number.isFinite(stock) ? stock : 0,
        category: categoryId, // reference to categories collection
        featured: false,

        // helpful metadata
        source: "excel",
        sku: normalized.itemno,
        itemno: normalized.itemno,
        // Only store canonical manufacturerName
        manufacturerName: manufacturerName || undefined,
        manufacturer_name: manufacturerName || undefined,
        color: r["Color"],
        capacity: r["Capacity Description"],
        features: r["Features"],
        groupName: normalized.categoryGroupName,
        itemCategory: r["ITEM CATEGORY"],
        subCategory: normalized.subCategoryProdDesc,
        prod_desc: normalized.subCategoryProdDesc,
        char_desc: normalized.charDesc,
        ean: r["EAN Number"],
        // Default to active=true when the seed row doesn't include an Active value
        active: (r["Active"] === undefined || r["Active"] === null)
          ? true
          : String(r["Active"]).trim().toLowerCase() === "yes",
        raw, // keep synchronized canonical row for auditing/debug

        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    // Insert products
    const insertResult = await productsCol.insertMany(productDocs, { session })
    if (insertResult.insertedCount !== productDocs.length) throw new Error("Seed product insertion was incomplete")

    return {
      success: true,
      message: "Database seeded from Excel JSON successfully",
      categories: { insertedOrUpserted: categoryNames.size },
      products: { inserted: insertResult.insertedCount },
    }
      })
      return NextResponse.json(summary)
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON data" }, { status: 400 })
    return handleApiError(error, "Failed to seed catalogue")
  }
}
