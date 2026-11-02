import { NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { CloneSafetyError } from "@/lib/database-clone-policy"
import { COLLECTIONS, getCollection, normalizeId } from "@/lib/db-service"
import { auditCatalogue, packQualityReport } from "@/lib/catalogue-quality"
import { CATALOGUE_DETAIL_PROJECTION, catalogueSpecificationQuery } from "@/lib/catalogue-quality-data"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  const offsetText = request ? new URL(request.url).searchParams.get("offset") : null
  const paged = offsetText !== null
  const offset = Number(offsetText || 0)
  if (paged && (!/^\d+$/.test(offsetText!) || !Number.isSafeInteger(offset) || offset < 0 || offset > 20000 || offset % 100 !== 0)) {
    return NextResponse.json({ error: "Invalid catalogue scan page" }, { status: 400 })
  }
  let stage = "connecting to the store database"
  try {
    const catalogue = await getCollection(COLLECTIONS.PRODUCTS)
    stage = "reading products"
    const projection = { ...CATALOGUE_DETAIL_PROJECTION, sku: 1, itemno: 1, itemNo: 1, name: 1, slug: 1, description: 1, raw: 1,
      division: 1, category: 1, groupName: 1, segment: 1, brand: 1, manufacturerName: 1, manufacturer_name: 1,
      subCategory: 1, prod_desc: 1, char_desc: 1, characteristics: 1, taxonomySource: 1,
      price: 1, mrp: 1, originalPrice: 1, stock: 1, active: 1, image: 1, images: 1,
      gtin: 1, ean: 1, mpn: 1, modelNumber: 1, model_number: 1, model: 1,
      warranty: 1, warrantyText: 1, warrantyMonths: 1, weightKg: 1, weight: 1, dimensionsCm: 1,
      gstRate: 1, gst_rate: 1, hsnCode: 1, hsn: 1, features: 1, technical_details: 1 }
    const total = await catalogue.countDocuments({}, { maxTimeMS: 8000 })
    if (total > 20000) throw new CloneSafetyError("The catalogue exceeds 20,000 products; a paginated scan is required before auditing", 413)
    // Keep getMore replies small: large catalogue batches can exceed the
    // driver socket timeout even when the database query itself is fast.
    const productCursor = catalogue.find({}, { projection, batchSize: 100, maxTimeMS: 15000 }).sort({ _id: 1 })
    const products = await (paged ? productCursor.skip(offset).limit(100) : productCursor.limit(20001)).toArray()
    if (products.length !== (paged ? Math.min(100, Math.max(0, total - offset)) : total)) throw new CloneSafetyError("The catalogue changed during the scan. Please scan again")
    stage = "reading product specifications"
    const specificationCollection = await getCollection("product_specifications")
    const specifications = await specificationCollection.find(paged ? catalogueSpecificationQuery(products) : {}, {
      projection: CATALOGUE_DETAIL_PROJECTION,
      batchSize: 100,
      maxTimeMS: 15000,
    }).limit(20001).toArray()
    if (specifications.length > 20000) throw new CloneSafetyError("Specification scan limit exceeded; no partial report was produced", 413)
    // Read only. Do not update records, create indexes or persist the report.
    stage = "analysing product data"
    const report = auditCatalogue(normalizeId(products), normalizeId(specifications), catalogue.dbName)
    stage = "preparing the report"
    const packed = packQualityReport(report)
    if (Buffer.byteLength(JSON.stringify(packed)) > 4 * 1024 * 1024) {
      throw new CloneSafetyError("The report exceeds Vercel's response budget; a paginated scan is required. No partial report was produced", 413)
    }
    return NextResponse.json({ ...packed, ...(paged ? { scan: { offset, totalProducts: total, read: products.length, nextOffset: offset + products.length < total ? offset + products.length : null } } : {}) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof CloneSafetyError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } })
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "number" ? error.code : undefined
    // Do not log/return raw driver errors: they can contain credentials or record values.
    console.error("[Catalogue quality] Scan failure", { stage, code })
    const message = `Catalogue scan failed while ${stage}. Please try again.`
    const response = handleApiError(new Error(message), message)
    response.headers.set("Cache-Control", "no-store")
    return response
  }
}
