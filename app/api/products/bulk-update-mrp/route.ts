import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { COLLECTIONS } from "@/lib/db-service"
import * as XLSX from "xlsx"
import { extractCanonicalProductMetadata } from "@/lib/product-schema"

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet)

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Excel is empty" }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const productsCol = db.collection(COLLECTIONS.PRODUCTS)

    let updated = 0
    let skipped = 0
    const errors: any[] = []

    const mrpKeys = ["MRP", "mrp", "M.R.P", "M R P", "mrp_value"]

    for (const r of rows) {
      const rawSku = extractCanonicalProductMetadata(r).itemno

      // Find mrp value from keys
      let rawMrp: any = null
      for (const k of mrpKeys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") {
          rawMrp = r[k]
          break
        }
      }

      if (!rawSku || rawMrp === undefined || rawMrp === null || String(rawMrp).trim() === "") {
        skipped++
        continue
      }

      const skuStr = String(rawSku).trim()
      const mrpNum = Number(String(rawMrp).replace(/[^0-9.-]+/g, ""))
      if (!Number.isFinite(mrpNum)) {
        errors.push({ sku: skuStr, error: "Invalid MRP" })
        continue
      }

      // Normalize SKU lookup: trim and try exact match, then case-insensitive fallback
      const res = await productsCol.updateOne({ itemno: skuStr }, { $set: { mrp: mrpNum, updatedAt: new Date() } })
      if (res.matchedCount === 0) {
        // try case-insensitive match
        const ciRes = await productsCol.updateOne({ itemno: { $regex: `^${skuStr.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, $options: "i" } }, { $set: { mrp: mrpNum, updatedAt: new Date() } })
        if (ciRes.matchedCount > 0) updated++
        else skipped++
      } else {
        updated++
      }
    }

    return NextResponse.json({ success: true, updated, skipped, errors })
  } catch (error) {
    console.error("[API Bulk Update MRP] Error:", error)
    return NextResponse.json({ success: false, message: "Failed to process file", error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
