import { NextResponse } from "next/server"
import { z } from "zod"
import { ObjectId } from "mongodb"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { publicCatalogueFilter } from "@/lib/public-catalogue"
import { merchantOfferId, merchantPreviewItem, type MerchantProductInput } from "@/lib/google-merchant-products"
import { MERCHANT_BATCH_SIZE, MerchantError, merchantConfig, merchantPayloadDigest, signMerchantPreview, verifyMerchantPreview, submitMerchantInputs } from "@/lib/google-merchant-api"

export const dynamic = "force-dynamic"
export const maxDuration = 60
const noStore = { "Cache-Control": "no-store" }
const eligible = { active: true, $expr: { $gt: [{ $convert: { input: "$stock", to: "double", onError: 0, onNull: 0 } }, 0] } }
async function identityCounts() {
  const collection = await getCollection("products")
  const identities = await collection.find({}, { projection: { sku: 1, slug: 1 }, maxTimeMS: 8000 }).limit(20001).toArray()
  if (identities.length > 20000) throw new MerchantError("The catalogue exceeds the verified identity scan limit.", 413)
  const counts = new Map<string, number>()
  for (const product of identities) {
    const offerId = merchantOfferId(product)
    counts.set(offerId, (counts.get(offerId) || 0) + 1)
  }
  return counts
}
async function loadBatch(offset: number, batchSize = MERCHANT_BATCH_SIZE) {
  const collection = await getCollection("products")
  const filter = await publicCatalogueFilter(eligible)
  const total = await collection.countDocuments(filter, { maxTimeMS: 8000 })
  const products = normalizeId(await collection.find(filter, { maxTimeMS: 10000 }).sort({ _id: 1 }).skip(offset).limit(batchSize).toArray())
  const config = merchantConfig()
  const items = products.map(product => merchantPreviewItem(product, config.origin || "https://www.sarastores.com", config.feedLabel))
  const counts = await identityCounts()
  // Check actual offer-ID precedence, not incidental collisions with another item's slug.
  for (const item of items) {
    if (!item.input) continue
    const count = counts.get(item.offerId) || 0
    if (count > 1) { item.errors.push("This offer ID is duplicated in the catalogue. Resolve it before submitting."); item.input = null }
  }
  return { items, total }
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof MerchantError ? error.message : "Merchant operation failed. Please try again or check configuration." },
    { status: error instanceof MerchantError ? error.status : 503, headers: noStore })
}
export async function GET(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const params = new URL(request.url).searchParams
    const view = params.get("view") || "batch"
    if (!["batch", "audit"].includes(view)) throw new MerchantError("Invalid Merchant preview mode.")
    const batchSize = view === "audit" ? 100 : MERCHANT_BATCH_SIZE
    const text = params.get("offset") || "0"
    const offset = Number(text)
    if (!/^\d+$/.test(text) || offset % batchSize || offset > 20000) throw new MerchantError("Invalid Merchant preview page.")
    const config = merchantConfig()
    const { items, total } = await loadBatch(offset, batchSize)
    const ready = items.filter(item => item.input)
    return NextResponse.json({ items, total, offset, batchSize, nextOffset: offset + items.length < total ? offset + items.length : null,
      accountId: config.accountId, dataSourceId: config.dataSourceId, feedLabel: config.feedLabel, country: "IN", language: "en",
      missing: config.missing, token: view === "audit" ? null : signMerchantPreview(guard.user.id, ready.map(item => item.id), ready.map(item => item.input!)) }, { headers: noStore })
  } catch (error) { return failure(error) }
}
const submitSchema = z.object({ token: z.string().min(1).max(5000), confirmed: z.literal(true) }).strict()
export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) throw new MerchantError("Cross-origin submission is not allowed.", 403)
    const parsed = submitSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new MerchantError("Review and confirm a valid preview before submitting.")
    const preview = verifyMerchantPreview(parsed.data.token, guard.user.id)
    const collection = await getCollection("products")
    const config = merchantConfig()
    const filter = await publicCatalogueFilter(eligible)
    const storedIds = preview.ids.flatMap(id => ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id])
    const products = normalizeId(await collection.find({ $and: [filter, { _id: { $in: storedIds } }] }, { maxTimeMS: 10000 }).limit(MERCHANT_BATCH_SIZE).toArray())
    const inputs: MerchantProductInput[] = []
    const counts = await identityCounts()
    for (const id of preview.ids) {
      const product = products.find(product => product.id === id)
      if (!product) throw new MerchantError("A previewed product is no longer active or in stock. Refresh the preview.", 409)
      const item = merchantPreviewItem(product, config.origin!, config.feedLabel)
      if (!item.input) throw new MerchantError("Product data changed or is no longer ready. Refresh the preview.", 409)
      const count = counts.get(item.offerId) || 0
      if (count > 1) throw new MerchantError("A previewed offer ID is duplicated. Refresh the preview.", 409)
      inputs.push(item.input)
    }
    if (merchantPayloadDigest(inputs) !== preview.digest) throw new MerchantError("Product facts changed after preview. Refresh and review the new values.", 409)
    return NextResponse.json({ results: await submitMerchantInputs(inputs) }, { headers: noStore })
  } catch (error) { return failure(error) }
}
