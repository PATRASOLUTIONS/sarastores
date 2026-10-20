import { NextRequest, NextResponse } from "next/server"
import type { AnyBulkWriteOperation, Document } from "mongodb"
import * as XLSX from "xlsx"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import {
  extractMetadataSheetRow,
  metadataDocumentUpdates,
  metadataRowHasUpdates,
  metadataSheetRowFromProduct,
} from "@/lib/product-metadata-sheet"

interface PreviewRow {
  itemno: string
  name: string
  division: string
  category: string
  segment: string
  brand: string
  currentName: string
  status: string
  error: string
}

/** Match on any of the three places a SKU has historically been stored. */
const skuFilter = (sku: string) => ({
  $or: [{ itemno: sku }, { sku }, { "raw.itemno": sku }],
})

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

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
    const rows = (data as Record<string, unknown>[]).map(extractMetadataSheetRow)

    // PREVIEW MODE
    if (preview) {
      const skuArray = Array.from(new Set(rows.map(row => row.itemno).filter(Boolean)))

      const products = await collection
        .find({
          $or: [
            { itemno: { $in: skuArray } },
            { sku: { $in: skuArray } },
            { "raw.itemno": { $in: skuArray } },
          ],
        })
        .toArray()

      /*
       * Index under every SKU the update's filter would match on, not just the
       * one the sheet would display. A product carrying both `sku` and a
       * different `itemno` otherwise previews as "Product not found" and then
       * updates anyway, so the preview understates what the upload will do.
       */
      const productsBySku = new Map<string, Record<string, unknown>>()
      for (const product of products) {
        const raw = product.raw as Record<string, unknown> | undefined
        for (const candidate of [product.itemno, product.sku, raw?.itemno]) {
          const key = String(candidate ?? "").trim()
          if (key && !productsBySku.has(key)) productsBySku.set(key, product)
        }
      }

      const updates: PreviewRow[] = rows.map(row => {
        const product = row.itemno ? productsBySku.get(row.itemno) : null
        const changes = metadataRowHasUpdates(row)

        return {
          itemno: row.itemno || "(empty)",
          name: row.name,
          division: row.division,
          category: row.category,
          segment: row.segment,
          brand: row.brand,
          currentName: (product?.name as string) || "",
          status: row.itemno && product && changes ? "found" : "error",
          error: !row.itemno
            ? "Missing itemno"
            : !product
              ? "Product not found"
              : !changes
                ? "No fields to update"
                : "",
        }
      })

      return NextResponse.json({ preview: updates })
    }

    // UPDATE MODE
    const errors: string[] = []
    const operations: AnyBulkWriteOperation<Document>[] = []
    const orderedSkus: string[] = []

    for (const row of rows) {
      if (!row.itemno) {
        errors.push("Row missing itemno")
        continue
      }

      if (!metadataRowHasUpdates(row)) {
        errors.push(`SKU ${row.itemno}: No fields to update`)
        continue
      }

      const updates = metadataDocumentUpdates(row)
      orderedSkus.push(row.itemno)
      operations.push({
        updateOne: {
          filter: skuFilter(row.itemno),
          /*
           * Nothing is mirrored into `raw`. The sheet now pre-fills from the
           * real document fields, so `raw` no longer has to carry the
           * operator's edits for the next download to show them — and a
           * `Category` key written there would be read back by the alias list
           * in `lib/product-schema.ts` as the old top-level category, which
           * would corrupt the round trip one level up the hierarchy.
           */
          update: { $set: { ...updates, updatedAt: new Date() } },
        },
      })
    }

    let successCount = 0

    if (operations.length > 0) {
      /*
       * One round trip instead of one per row. A full catalogue sheet runs to
       * a few thousand rows, and sequential updates against a hosted cluster
       * took long enough to time out the request.
       *
       * Unordered so a row that matches nothing does not stop the rest, and
       * chunked so a large sheet cannot exceed the driver's batch limits.
       */
      const CHUNK = 500
      for (let start = 0; start < operations.length; start += CHUNK) {
        const chunk = operations.slice(start, start + CHUNK)
        const result = await collection.bulkWrite(chunk, { ordered: false })
        successCount += result.matchedCount

        if (result.matchedCount < chunk.length) {
          // bulkWrite does not say which operations matched nothing, so re-check
          // just this chunk's SKUs to name the missing ones for the operator.
          const skus = orderedSkus.slice(start, start + chunk.length)
          const found = await collection
            .find({ $or: skus.map(skuFilter) }, { projection: { itemno: 1, sku: 1, "raw.itemno": 1 } })
            .toArray()
          // Same reasoning as the preview index: a product can be matched by
          // any of the three SKU fields, so all three have to count as present.
          const present = new Set<string>()
          for (const product of found) {
            const raw = product.raw as Record<string, unknown> | undefined
            for (const candidate of [product.itemno, product.sku, raw?.itemno]) {
              const key = String(candidate ?? "").trim()
              if (key) present.add(key)
            }
          }
          for (const sku of skus) {
            if (!present.has(sku)) errors.push(`SKU ${sku}: Product not found`)
          }
        }
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: rows.length - successCount,
      errors: errors.slice(0, 20),
    })
  } catch (error: unknown) {
    console.error("Bulk metadata update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process metadata update" },
      { status: 500 },
    )
  }
}
