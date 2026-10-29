import { NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection, getById } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { loadSaraCareConfig, priceSaraCare, resolveSaraCareRule, type StoredSaraCareConfig } from "@/lib/sara-care"
import { z } from "zod"
import { SaraCareConfigSchema, saraCareProductId, saraCareSku, type SaraCareYears } from "@/lib/sara-care-types"

export async function GET(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const params = new URL(request.url).searchParams
    const deviceFilter = { serviceKind: { $ne: "sara-care" }, type: { $nin: ["software", "service"] } }
    if (params.get("options") === "products") {
      const search = (params.get("search") || "").trim().slice(0, 200)
      const skip = Math.max(0, Math.min(1000000, Number.parseInt(params.get("skip") || "0", 10) || 0))
      const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const filter = { ...deviceFilter, ...(search ? { $or: ["name", "title", "sku"].map(field => ({ [field]: { $regex: pattern, $options: "i" } })) } : {}) }
      const collection = await getCollection("products")
      const [rows, total] = await Promise.all([
        collection.find(filter, { projection: { _id: 1, id: 1, name: 1, title: 1, sku: 1 } }).sort({ name: 1, _id: 1 }).skip(skip).limit(100).toArray(),
        collection.countDocuments(filter),
      ])
      const products = rows.map(row => ({ id: String(row.id || row._id), name: String(row.name || row.title || row.sku || "Product"), sku: String(row.sku || "") }))
      return NextResponse.json({ products, total, nextSkip: skip + rows.length < total ? skip + rows.length : null }, { headers: { "Cache-Control": "private, no-store" } })
    }
    if (params.get("options") === "taxonomy") {
      // Match the pricing resolver's canonical and legacy label fallbacks.
      const firstLabel = (fields: string[]) => ({ $reduce: {
        input: fields.map(field => ({ $trim: { input: { $convert: { input: field, to: "string", onError: "", onNull: "" } } } })),
        initialValue: "", in: { $cond: [{ $ne: ["$$value", ""] }, "$$value", "$$this"] },
      } })
      const rows = await (await getCollection("products")).aggregate<{ _id: { division: string; category: string; segment: string }; count: number }>([
        { $match: deviceFilter },
        { $group: { _id: { division: firstLabel(["$division", "$raw.Division"]),
          category: firstLabel(["$categoryGroupName", "$category", "$subCategory", "$raw.Category/Group Name"]),
          segment: firstLabel(["$segment", "$raw.Segment"]) }, count: { $sum: 1 } } },
      ]).toArray()
      const values = (field: "division" | "category" | "segment") => [...new Set(rows.map(row => String(row._id[field] || "").trim()).filter(Boolean))].sort()
      const groups = rows.map(row => ({ division: String(row._id.division || "").trim(), category: String(row._id.category || "").trim(), segment: String(row._id.segment || "").trim(), count: row.count }))
      return NextResponse.json({ groups, division: values("division"), category: values("category"), segment: values("segment") }, { headers: { "Cache-Control": "private, no-store" } })
    }
    return NextResponse.json(await loadSaraCareConfig(), { headers: { "Cache-Control": "private, no-store" } })
  }
  catch (error) { return handleApiError(error, "Could not load Sara Care") }
}
export async function PUT(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = SaraCareConfigSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const products = await getCollection<{ _id: string; [key: string]: unknown }>("products")
    // Stable, linked-purchase-only service products. No catalogue replacement.
    for (const years of [1, 2, 3] as SaraCareYears[]) {
      await products.updateOne({ _id: saraCareProductId(years) }, { $set: {
        id: saraCareProductId(years), sku: saraCareSku(years), name: `Sara Care — ${years} ${years === 1 ? "Year" : "Years"}`,
        type: "service", serviceKind: "sara-care", linkedPurchaseOnly: true, active: false,
        price: 0, image: "/images/sara-care.svg", updatedAt: new Date(),
      }, $setOnInsert: { createdAt: new Date() } }, { upsert: true })
    }
    const revision = crypto.randomUUID()
    await (await getCollection<StoredSaraCareConfig>("sara_care_config")).updateOne({ _id: "settings" }, {
      $set: { ...parsed.data, revision, updatedAt: new Date() },
    }, { upsert: true })
    return NextResponse.json({ ...parsed.data, revision })
  } catch (error) { return handleApiError(error, "Could not save Sara Care") }
}

export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = z.object({ config: SaraCareConfigSchema, productId: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const product = await getById("products", parsed.data.productId)
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    const config = { ...parsed.data.config, enabled: true, revision: "preview" }
    const rule = resolveSaraCareRule(config, product)
    const options = rule?.rates.filter(rate => rate.enabled).flatMap(rate => {
      const quote = priceSaraCare(config, product, "preview", rate.years)
      return quote ? [{ years: rate.years, percentage: rate.percentage, price: quote.price }] : []
    }) || []
    return NextResponse.json({ matchedRule: rule?.name || null, options }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return handleApiError(error, "Could not preview Sara Care") }
}
