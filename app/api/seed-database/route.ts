import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { COLLECTIONS } from "@/lib/db-service"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"
import { checkAdminAuthorization } from "@/lib/auth"

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

function buildDescription(row: any) {
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
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const auth = await checkAdminAuthorization()
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { db } = await connectToDatabase()

    // Fetch the imported JSON (Excel data) from public folder
    const dataUrl = new URL("/data/realistic-laptop-master-data.json", request.url)
    const dataRes = await fetch(dataUrl)
    if (!dataRes.ok) {
      return NextResponse.json(
        { success: false, message: "Failed to load JSON data from public/data." },
        { status: 500 },
      )
    }
    const rows: any[] = await dataRes.json()

    // Ensure collections exist
    const collections = await db.listCollections().toArray()
    const names = collections.map((c) => c.name)
    if (!names.includes(COLLECTIONS.CATEGORIES)) await db.createCollection(COLLECTIONS.CATEGORIES)
    if (!names.includes(COLLECTIONS.PRODUCTS)) await db.createCollection(COLLECTIONS.PRODUCTS)

    const categoriesCol = db.collection(COLLECTIONS.CATEGORIES)
    const productsCol = db.collection(COLLECTIONS.PRODUCTS)

    // Derive unique category names from canonical category field
    const categoryNames = new Set<string>()
    for (const r of rows) {
      const normalized = extractCanonicalProductMetadata(r)
      const group = (normalized.categoryGroupName || "Uncategorized") as string
      categoryNames.add(group.trim())
    }

    // Fetch existing categories
    const existingCats = await categoriesCol.find({ name: { $in: Array.from(categoryNames) } }).toArray()
    const catMap = new Map<string, string>()
    existingCats.forEach((c: any) => catMap.set(c.name, c._id.toString()))

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
      const ins = await categoriesCol.insertMany(insertPayload)
      // refetch inserted docs
      const insertedDocs = await categoriesCol.find({ _id: { $in: Object.values(ins.insertedIds) } }).toArray()
      insertedDocs.forEach((c: any) => catMap.set(c.name, c._id.toString()))
    }

    // Optional: remove previously imported products to avoid duplicates
    await productsCol.deleteMany({ source: "excel" })

    // Map rows to products
    const productDocs = rows.map((r) => {
      const normalized = extractCanonicalProductMetadata(r)
      const name = (normalized.name || "Unnamed Product") as string
      const categoryName = (normalized.categoryGroupName || "Uncategorized") as string
      const categoryId = catMap.get(categoryName) || null
      const manufacturerName = normalized.manufacturerName
      const stock = typeof r["In Stock"] === "number" ? r["In Stock"] : Number.parseInt(r["In Stock"] || "0", 10)
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
    const insertResult = await productsCol.insertMany(productDocs)

    return NextResponse.json({
      success: true,
      message: "Database seeded from Excel JSON successfully",
      categories: { insertedOrUpserted: categoryNames.size },
      products: { inserted: insertResult.insertedCount },
    })
  } catch (error) {
    console.error("Error seeding from Excel JSON:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to seed from Excel JSON",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
