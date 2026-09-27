import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getCollection } from "@/lib/db-service"
import {
  buildSchemaSynchronizedRaw,
  extractCanonicalProductMetadata,
  normalizeProductForSchema,
} from "@/lib/product-schema"

interface PreviewRow {
  itemno: string
  name: string
  description: string
  categoryGroupName: string
  subCategoryProdDesc: string
  charDesc: string
  manufacturerName: string
  currentName: string
  status: string
  error: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const preview = formData.get("preview") === "true"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Excel file is empty" }, { status: 400 })
    }

    const collection = await getCollection("products")

    // PREVIEW MODE
    if (preview) {
      const updates: PreviewRow[] = []
      const skusToFind = new Set<string>()
      const allRows: ReturnType<typeof extractCanonicalProductMetadata>[] = []

      for (const row of data as Record<string, unknown>[]) {
        const rowData = extractCanonicalProductMetadata(row)
        const skuStr = rowData.itemno

        if (skuStr) {
          skusToFind.add(skuStr)
        }

        allRows.push(rowData)
      }

      const skuArray = Array.from(skusToFind)

      const products = await collection.find({
        $or: [
          { itemno: { $in: skuArray } },
          { sku: { $in: skuArray } },
          { "raw.itemno": { $in: skuArray } },
        ]
      }).toArray()

      const productsBySku = new Map<string, Record<string, unknown>>()
      for (const p of products) {
        const productSku = normalizeProductForSchema(p).itemno
        if (productSku) {
          productsBySku.set(String(productSku).trim(), p)
        }
      }

      for (const rowInfo of allRows) {
        const sku = rowInfo.itemno
        const product = sku ? productsBySku.get(sku) : null

        updates.push({
          itemno: rowInfo.itemno || "(empty)",
          name: rowInfo.name,
          description: rowInfo.description,
          categoryGroupName: rowInfo.categoryGroupName,
          subCategoryProdDesc: rowInfo.subCategoryProdDesc,
          charDesc: rowInfo.charDesc,
          manufacturerName: rowInfo.manufacturerName,
          currentName: (product?.name as string) || "",
          status: rowInfo.itemno && product ? "found" : "error",
          error: !rowInfo.itemno ? "Missing itemno" : (!product ? "Product not found" : "")
        })
      }

      return NextResponse.json({ preview: updates })
    }

    // UPDATE MODE
    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const row of data as Record<string, unknown>[]) {
      const normalized = extractCanonicalProductMetadata(row)

      if (!normalized.itemno) {
        failCount++
        errors.push("Row missing itemno")
        continue
      }

      const sku = normalized.itemno
      const {
        categoryGroupName,
        subCategoryProdDesc,
        charDesc,
        name,
        description,
        manufacturerName,
      } = normalized

      try {
        const rawUpdates = buildSchemaSynchronizedRaw({}, normalized)

        const hasRawUpdates = Object.keys(rawUpdates).length > 0
        const hasNameUpdate = !!name
        const hasDescriptionUpdate = !!description
        const hasManufacturerUpdate = !!manufacturerName

        if (!hasRawUpdates && !hasNameUpdate && !hasDescriptionUpdate && !hasManufacturerUpdate) {
          failCount++
          errors.push(`SKU ${sku}: No fields to update`)
          continue
        }

        const pipeline: Record<string, unknown>[] = [
          {
            $set: {
              raw: {
                $mergeObjects: [
                  { $ifNull: ["$raw", {}] },
                  rawUpdates
                ]
              },
              updatedAt: new Date()
            }
          }
        ]

        const firstStage = pipeline[0].$set as Record<string, unknown>
        if (name) firstStage.name = name
        if (description) firstStage.description = description
        if (categoryGroupName) {
          firstStage.brand = categoryGroupName
          firstStage.groupName = categoryGroupName
          firstStage.category = categoryGroupName
        }
        if (subCategoryProdDesc) {
          firstStage.subCategory = subCategoryProdDesc
          firstStage.prod_desc = subCategoryProdDesc
        }
        if (charDesc) {
          firstStage.characteristics = charDesc
          firstStage.char_desc = charDesc
        }
        if (manufacturerName) {
          firstStage.manufacturerName = manufacturerName
          firstStage.manufacturer_name = manufacturerName
        }

        const result = await collection.updateOne(
          {
            $or: [
              { itemno: sku },
              { sku },
              { "raw.itemno": sku },
            ]
          },
          pipeline as Parameters<typeof collection.updateOne>[1]
        )

        if (result.matchedCount === 0) {
          failCount++
          errors.push(`SKU ${sku}: Product not found`)
        } else {
          successCount++
        }
      } catch (err: unknown) {
        failCount++
        errors.push(`SKU ${sku}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failCount,
      errors: errors.slice(0, 20)
    })

  } catch (error: unknown) {
    console.error("Bulk metadata update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process metadata update" },
      { status: 500 }
    )
  }
}
