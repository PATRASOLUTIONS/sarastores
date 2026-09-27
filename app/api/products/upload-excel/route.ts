import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { COLLECTIONS } from "@/lib/db-service"
import * as XLSX from "xlsx"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"

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

function computePrice(manufacturerName?: string, priceFromExcel?: unknown): number {
  if (priceFromExcel && !isNaN(Number(priceFromExcel))) {
    return Number(priceFromExcel)
  }
  return manufacturerName && MANUFACTURER_BASE_PRICE[manufacturerName]
    ? MANUFACTURER_BASE_PRICE[manufacturerName]
    : 99900
}

function buildDescription(row: Record<string, unknown>): string {
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

interface ValidationError {
  row: number
  field: string
  message: string
}

interface DuplicateSKU {
  sku: string
  existingProduct: string
  newProduct: string
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const overwriteDuplicates = formData.get("overwriteDuplicates") === "true"

    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet)

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Excel file is empty" }, { status: 400 })
    }

    const errors: ValidationError[] = []
    const validRows: Record<string, unknown>[] = []

    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const normalized = extractCanonicalProductMetadata(row)

      if (!normalized.itemno) {
        errors.push({ row: rowNumber, field: "itemno", message: "Product SKU (itemno) is required" })
      }
      if (!normalized.name) {
        errors.push({ row: rowNumber, field: "Name", message: "Product Name is required" })
      }
      if (!normalized.description) {
        errors.push({ row: rowNumber, field: "Description", message: "Description is required" })
      }
      if (!normalized.categoryGroupName) {
        errors.push({ row: rowNumber, field: "Category/Group Name", message: "Category/Group Name is required" })
      }
      if (!normalized.subCategoryProdDesc) {
        errors.push({ row: rowNumber, field: "sub-category/PROD DESC", message: "sub-category/PROD DESC is required" })
      }
      if (!normalized.charDesc) {
        errors.push({ row: rowNumber, field: "CHAR DESC", message: "CHAR DESC is required" })
      }
      if (!normalized.manufacturerName) {
        errors.push({ row: rowNumber, field: "Manufacturer Name", message: "Manufacturer Name is required" })
      }

      if (row["In Stock"] !== undefined && row["In Stock"] !== null && row["In Stock"] !== "" && isNaN(Number(row["In Stock"]))) {
        errors.push({ row: rowNumber, field: "In Stock", message: "Stock must be a number" })
      }

      if (
        normalized.itemno &&
        normalized.name &&
        normalized.description &&
        normalized.categoryGroupName &&
        normalized.subCategoryProdDesc &&
        normalized.charDesc &&
        normalized.manufacturerName
      ) {
        validRows.push(row)
      }
    })

    if (errors.length > 0 && validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed. Please fix the errors and try again.",
          errors,
        },
        { status: 400 },
      )
    }

    const { db } = await connectToDatabase()

    const collections = await db.listCollections().toArray()
    const names = collections.map((c) => c.name)
    if (!names.includes(COLLECTIONS.CATEGORIES)) await db.createCollection(COLLECTIONS.CATEGORIES)
    if (!names.includes(COLLECTIONS.PRODUCTS)) await db.createCollection(COLLECTIONS.PRODUCTS)

    const categoriesCol = db.collection(COLLECTIONS.CATEGORIES)
    const productsCol = db.collection(COLLECTIONS.PRODUCTS)

    const totalProductsBefore = await productsCol.countDocuments()

    const skus = validRows.map((r) => extractCanonicalProductMetadata(r).itemno)
    const existingProducts = await productsCol.find({ sku: { $in: skus } }).toArray()

    const existingSKUMap = new Map(existingProducts.map((p: Record<string, unknown>) => [p.sku, p]))

    const duplicates: DuplicateSKU[] = []
    validRows.forEach((row) => {
      const sku = extractCanonicalProductMetadata(row).itemno
      if (existingSKUMap.has(sku)) {
        const existing = existingSKUMap.get(sku)
        duplicates.push({
          sku,
          existingProduct: String(existing?.name ?? ""),
          newProduct: extractCanonicalProductMetadata(row).name,
        })
      }
    })

    if (duplicates.length > 0 && !overwriteDuplicates) {
      return NextResponse.json({
        success: false,
        message: `Found ${duplicates.length} duplicate SKU(s). Please confirm to overwrite.`,
        duplicates,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    const categoryNames = new Set<string>()
    for (const r of validRows) {
      const group = (extractCanonicalProductMetadata(r).categoryGroupName || "Uncategorized") as string
      categoryNames.add(group.trim())
    }

    const existingCats = await categoriesCol.find({ name: { $in: Array.from(categoryNames) } }).toArray()
    const catMap = new Map<string, string>()
    existingCats.forEach((c: Record<string, unknown>) => catMap.set(String(c.name), String(c._id)))

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
      const insertedDocs = await categoriesCol.find({ _id: { $in: Object.values(ins.insertedIds) } }).toArray()
      insertedDocs.forEach((c: Record<string, unknown>) => catMap.set(String(c.name), String(c._id)))
    }

    let insertedCount = 0
    let updatedCount = 0

    for (const r of validRows) {
      const normalized = extractCanonicalProductMetadata(r)
      const name = normalized.name || "Unnamed Product"
      const categoryName = (normalized.categoryGroupName || "Uncategorized") as string
      const categoryId = catMap.get(categoryName) || null
      const manufacturerName = normalized.manufacturerName
      const stock = typeof r["In Stock"] === "number" ? r["In Stock"] : Number.parseInt(String(r["In Stock"] || "0"), 10)
      const sku = normalized.itemno
      const raw = buildSchemaSynchronizedRaw(r, normalized)

      const productData = {
        name,
        description: normalized.description || buildDescription(r),
        price: computePrice(manufacturerName, r["Price"]),
        mrp: r["MRP"] !== undefined && r["MRP"] !== null && r["MRP"] !== "" && !isNaN(Number(r["MRP"]))
          ? Number(r["MRP"])
          : undefined,
        image: "/modern-laptop-workspace.png",
        stock: Number.isFinite(stock) ? stock : 0,
        category: categoryId,
        featured: false,
        source: "excel",
        sku,
        manufacturerName: manufacturerName || undefined,
        color: r["Color"],
        capacity: r["Capacity Description"],
        features: r["Features"],
        groupName: normalized.categoryGroupName,
        itemCategory: r["ITEM CATEGORY"],
        ean: r["EAN Number"],
        active: (r["Active"] === undefined || r["Active"] === null)
          ? true
          : String(r["Active"]).trim().toLowerCase() === "yes",
        raw,
        updatedAt: new Date(),
      }

      if (existingSKUMap.has(sku) && overwriteDuplicates) {
        await productsCol.updateOne({ sku }, { $set: productData })
        updatedCount++
      } else if (!existingSKUMap.has(sku)) {
        await productsCol.insertOne({ ...productData, createdAt: new Date() })
        insertedCount++
      }
    }

    const totalProductsAfter = await productsCol.countDocuments()

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${insertedCount + updatedCount} products`,
      inserted: insertedCount,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
      debug: {
        totalBefore: totalProductsBefore,
        totalAfter: totalProductsAfter,
        change: totalProductsAfter - totalProductsBefore
      }
    })
  } catch (error) {
    console.error("Error uploading Excel:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to upload Excel file",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
