import { NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CloneSafetyError } from "@/lib/database-clone-policy"
import { withVerifiedClone } from "@/lib/database-clone"
import { auditCatalogue, packQualityReport } from "@/lib/catalogue-quality"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const report = await withVerifiedClone(async (target, state) => {
      const projection = { sku: 1, itemno: 1, itemNo: 1, name: 1, slug: 1, description: 1, raw: 1,
        division: 1, category: 1, groupName: 1, segment: 1, brand: 1, manufacturerName: 1, manufacturer_name: 1,
        subCategory: 1, prod_desc: 1, char_desc: 1, characteristics: 1, taxonomySource: 1,
        price: 1, mrp: 1, originalPrice: 1, stock: 1, active: 1, image: 1, images: 1,
        gtin: 1, ean: 1, mpn: 1, modelNumber: 1, model_number: 1, model: 1,
        warranty: 1, warrantyText: 1, warrantyMonths: 1, weightKg: 1, weight: 1, dimensionsCm: 1,
        gstRate: 1, gst_rate: 1, hsnCode: 1, hsn: 1, features: 1, technical_details: 1 }
      const total = await target.collection("products").countDocuments({}, { maxTimeMS: 8000 })
      if (total > 20000) throw new CloneSafetyError("The catalogue exceeds 20,000 products; a paginated scan is required before auditing", 413)
      const products = await target.collection("products").find({}, { projection, maxTimeMS: 15000 }).sort({ _id: 1 }).limit(20001).toArray()
      if (products.length !== total) throw new CloneSafetyError("The clone changed during the scan. Refresh and scan again")
      const specifications = await target.collection("product_specifications").find({}, {
        projection: { sku: 1, description: 1, modelNumber: 1, model_number: 1, features: 1, technical_details: 1, specification_images: 1, warranty: 1 },
        maxTimeMS: 15000,
      }).limit(20001).toArray()
      if (specifications.length > 20000) throw new CloneSafetyError("Specification scan limit exceeded; no partial report was produced", 413)
      const audited = auditCatalogue(products, specifications)
      return { ...audited, cloneCompletedAt: state.completedAt }
    })
    const packed = packQualityReport(report)
    if (Buffer.byteLength(JSON.stringify(packed)) > 4 * 1024 * 1024) {
      throw new CloneSafetyError("The report exceeds Vercel's response budget; a paginated scan is required. No partial report was produced", 413)
    }
    return NextResponse.json(packed, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CloneSafetyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return handleApiError(new Error("Catalogue scan failed"), "Catalogue scan failed")
  }
}
