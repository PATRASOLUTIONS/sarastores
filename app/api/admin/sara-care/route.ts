import { NextResponse } from "next/server"
import { z } from "zod"
import * as XLSX from "xlsx"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { getMongoClient } from "@/lib/mongodb"
import { handleApiError } from "@/lib/api-error"
import { loadSaraCareConfig, type StoredSaraCareConfig, type StoredSaraCareMaster } from "@/lib/sara-care"
import { SaraCareConfigSchema, saraCareProductId, saraCareSku, saraCareDurationLabel } from "@/lib/sara-care-types"
import { parseSaraCareWorkbook, SaraCareImportError, SARA_CARE_HEADERS } from "@/lib/sara-care-import"

export const runtime = "nodejs"
export const maxDuration = 120
const noStore = { "Cache-Control": "private, no-store" }
const SettingsSchema = z.object({ enabled: z.boolean(), terms: z.string().trim().max(10000), coverageStarts: z.enum(["purchase", "delivery"]), basis: z.enum(["price", "mrp"]).optional() })
export async function GET(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const params = new URL(request.url).searchParams
    if (params.get("format") === "xlsx") {
      const workbook = XLSX.utils.book_new()
      const sheet = XLSX.utils.aoa_to_sheet([SARA_CARE_HEADERS])
      sheet["!cols"] = SARA_CARE_HEADERS.map(() => ({ wch: 22 }))
      XLSX.utils.book_append_sheet(workbook, sheet, "Sara Care")
      return new NextResponse(new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), { headers: {
        ...noStore, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="sara-care-format.xlsx"',
      } })
    }
    const config = await loadSaraCareConfig()
    const page = Math.max(0, Math.min(500, Number.parseInt(params.get("page") || "0", 10) || 0))
    const search = (params.get("search") || "").trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const filter = { importId: config.importId || "unconfigured", ...(search ? { $or: ["itemno", "name"].map(field => ({ [field]: { $regex: search, $options: "i" } })) } : {}) }
    const master = await getCollection<StoredSaraCareMaster>("sara_care_master")
    const [rows, total] = await Promise.all([master.find(filter, { projection: { _id: 0, itemno: 1, name: 1, plans: 1 } }).sort({ itemno: 1 }).skip(page * 100).limit(100).toArray(), master.countDocuments(filter)])
    return NextResponse.json({ config, rows, total }, { headers: noStore })
  } catch (error) { return handleApiError(error, "Could not load Sara Care") }
}
export async function PUT(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = SettingsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const existing = await loadSaraCareConfig()
    const config = SaraCareConfigSchema.safeParse({ ...existing, ...parsed.data, rules: [] })
    if (!config.success) return NextResponse.json({ error: config.error.issues[0].message }, { status: 400 })
    const result = await (await getCollection<StoredSaraCareConfig>("sara_care_config")).updateOne(
      { _id: "settings", revision: existing.revision }, { $set: { ...parsed.data, revision: crypto.randomUUID(), updatedAt: new Date() } })
    if (!result.matchedCount) return NextResponse.json({ error: "The configuration changed. Reload the page and save again." }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error, "Could not save Sara Care") }
}
export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    if (Number(request.headers.get("content-length") || 0) > 12 * 1024 * 1024) return NextResponse.json({ error: "Upload an Excel file smaller than 10 MB." }, { status: 413 })
    const form = await request.formData()
    const file = form.get("file")
    const mode = z.enum(["percentage", "value"]).safeParse(form.get("pricingMode") || "percentage")
    const basis = z.enum(["price", "mrp"]).optional().safeParse(form.get("basis") || undefined)
    if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024 || !mode.success || !basis.success) return NextResponse.json({ error: "Choose a valid Excel file (up to 10 MB), pricing mode and price basis." }, { status: 400 })
    const imported = parseSaraCareWorkbook(new Uint8Array(await file.arrayBuffer()), mode.data)
    const master = await getCollection<StoredSaraCareMaster>("sara_care_master")
    await master.createIndex({ importId: 1, itemno: 1 }, { unique: true })
    const settings = await getCollection<StoredSaraCareConfig>("sara_care_config")
    const products = await getCollection<{ _id: string; [key: string]: unknown }>("products")
    const importId = crypto.randomUUID()
    const session = (await getMongoClient()).startSession()
    try {
      await session.withTransaction(async () => {
        const old = await loadSaraCareConfig(session)
        const data = { ...old, enabled: old.enabled && imported.rows.length > 0, rules: [], importId, pricingMode: mode.data, basis: basis.data ?? old.basis,
          importedProducts: imported.rows.length, importedPlans: imported.rows.reduce((sum, row) => sum + row.plans.length, 0),
          importedFile: file.name.slice(0, 300), importedSheet: imported.sheetName, revision: crypto.randomUUID(), updatedAt: new Date() }
        // Validate first, then replace atomically; failed writes keep the previous master.
        await master.deleteMany({}, { session })
        for (let start = 0; start < imported.rows.length; start += 500) {
          await master.insertMany(imported.rows.slice(start, start + 500).map(row => ({ ...row, importId })), { session })
        }
        const durations = [...new Set(imported.rows.flatMap(row => row.plans.map(plan => plan.years)))]
        for (const years of durations) {
          await products.updateOne({ _id: saraCareProductId(years) }, { $set: { id: saraCareProductId(years), sku: saraCareSku(years),
            name: `Sara Care — ${saraCareDurationLabel(years)}`, type: "service", serviceKind: "sara-care", linkedPurchaseOnly: true,
            active: false, price: 0, image: "/images/sara-care.svg", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true, session })
        }
        await settings.updateOne({ _id: "settings" }, { $set: data }, { upsert: true, session })
      })
    } finally { await session.endSession() }
    return NextResponse.json({ success: true, products: imported.rows.length, plans: imported.rows.reduce((sum, row) => sum + row.plans.length, 0), omittedRows: imported.omittedRows })
  } catch (error) {
    if (error instanceof SaraCareImportError) return NextResponse.json({ error: error.message }, { status: 400 })
    return handleApiError(error, "Could not replace Sara Care plans")
  }
}
