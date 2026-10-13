import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { extractCanonicalProductMetadata } from "@/lib/product-schema"
import { buildSpecificationPatch, SPECIFICATIONS_COLLECTION } from "@/lib/product-specification-schema"
import { z } from "zod"
import { SpecificationUpdateSchema } from "@/lib/validation"

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch (error) {
      console.warn("Invalid specifications upload JSON:", error)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = z.object({ specifications: z.array(z.record(z.unknown())).min(1).max(5000) }).safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Provide between 1 and 5,000 specification rows" }, { status: 400 })
    const { specifications } = parsed.data

    if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Received specifications upload request", { count: specifications?.length })

    if (!specifications || !Array.isArray(specifications)) {
      return NextResponse.json({ error: "Invalid specifications data" }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const productsCollection = db.collection("products")
    const specsCollection = db.collection(SPECIFICATIONS_COLLECTION)
    await specsCollection.createIndex({ sku: 1 }, { unique: true, name: "sku_unique" })

    let success = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const spec of specifications) {
      try {
        const {
          sku,
          technical_details,
          from_manufacturer,
          images,
          specification_images,
          gallery_images,
          name,
          description,
          overview,
          included_components,
          features,
          reviews,
          mrp,
          category,
          subCategory,
          prod_desc,
          group_name,
          char_desc,
          manufacturer_name,
          ...otherFields
        } = spec

        const canonicalSku = extractCanonicalProductMetadata({ itemno: sku, SKU: sku }).itemno

        if (!canonicalSku) {
          skipped++
          errors.push(`Row skipped: Missing SKU`)
          continue
        }
        const existing = await specsCollection.findOne({ sku: canonicalSku })
        if (existing?.locked === true) {
          skipped++
          errors.push(`SKU ${canonicalSku} is locked`)
          continue
        }
        const parsedMrp = mrp === undefined || mrp === null || mrp === "" ? null
          : Number(typeof mrp === "string" ? mrp.replace(/[₹,\s]/g, "") : mrp)
        if (parsedMrp !== null && (!Number.isFinite(parsedMrp) || parsedMrp < 0 || parsedMrp > 10000000)) {
          failed++
          errors.push(`SKU ${canonicalSku} has invalid MRP`)
          continue
        }

        // Find product by canonical itemno to validate and get product_id/name
        const product = await productsCollection.findOne({
          $or: [
            { itemno: canonicalSku },
            { sku: canonicalSku },
            { "raw.itemno": canonicalSku }
          ]
        })

        if (!product) {
          skipped++
          errors.push(`SKU ${canonicalSku} not found in database`)
          continue
        }

        const doc = buildSpecificationPatch({
          sku: canonicalSku,
          product_id: product._id.toString(),
          name: name || product.name,
          technical_details,
          from_manufacturer,
          gallery_images,
          specification_images: specification_images ?? images,
          description,
          overview,
          included_components,
          features,
          reviews,
          mrp: parsedMrp,
          category,
          subCategory,
          prod_desc,
          group_name,
          char_desc,
          manufacturer_name,
        })

        if (!doc) {
          skipped++
          errors.push(`Row skipped: Missing SKU`)
          continue
        }

        // Unrecognised spreadsheet columns become extra technical details.
        const extras: Record<string, string> = {}
        Object.keys(otherFields).forEach((key) => {
          const value = otherFields[key]
          if (value !== undefined && value !== null && value !== "") {
            extras[key] = String(value)
          }
        })
        if (Object.keys(extras).length > 0) {
          doc.technical_details = { ...extras, ...(doc.technical_details ?? {}) }
        }

        // A spec edited here has diverged from the product record again.
        doc.isSynced = false
        const { sku: documentSku, updatedAt, ...fields } = doc
        const validated = SpecificationUpdateSchema.safeParse(fields)
        if (!validated.success) {
          failed++
          errors.push(`SKU ${canonicalSku}: ${validated.error.issues[0]?.message || "Invalid specification fields"}`)
          continue
        }

        const result = await specsCollection.updateOne(
          { sku: documentSku, locked: { $ne: true } },
          {
            $set: { sku: documentSku, updatedAt, ...validated.data },
          },
          { upsert: true },
        )

        const upserted = result.acknowledged && (result.upsertedId != null || result.matchedCount > 0)
        if (upserted) {
          success++
        } else {
          failed++
          errors.push(`Failed to upsert specifications for SKU ${sku}`)
        }
      } catch (error) {
        console.error("ByteWise Testing Point Error processing SKU:", spec.sku, error)
        failed++
        errors.push(`Error processing SKU ${spec.sku}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Upload complete (product_specifications):", { success, failed, skipped })

    return NextResponse.json({
      success,
      failed,
      skipped,
      errors: errors.slice(0, 20),
      message: `Processed ${specifications.length} rows: ${success} successful, ${failed} failed, ${skipped} skipped`,
    })
  } catch (error) {
    console.error("ByteWise Testing Point Error uploading specifications:", error)
    return NextResponse.json(
      { error: "Failed to upload specifications", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
