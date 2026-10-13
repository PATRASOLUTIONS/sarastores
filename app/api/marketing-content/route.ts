import { NextResponse } from "next/server"
import { MongoServerError } from "mongodb"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { marketingDefinition, type MarketingContent } from "@/lib/marketing-content"

export const dynamic = "force-dynamic"
type MarketingDocument = Omit<MarketingContent, "id"> & { _id: string; updatedAt: Date }
const safeLink = (value: string) => {
  if (!value || /^(\/(?!\/)|#[\w-]+$)/.test(value)) return true
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" }
  catch { return false }
}
const WriteSchema = z.object({
  page: z.string().max(30), section: z.string().max(50), enabled: z.boolean(),
  order: z.number().int().min(0).max(999), revision: z.number().int().min(0),
  values: z.record(z.string().max(6000)),
}).strict().superRefine((data, context) => {
  const definition = marketingDefinition(data.page, data.section)
  if (!definition) { context.addIssue({ code: "custom", message: "Unknown marketing section" }); return }
  for (const [key, value] of Object.entries(data.values)) {
    const field = definition.fields.find(item => item.key === key)
    if (!field) { context.addIssue({ code: "custom", message: `Unknown field: ${key}` }); continue }
    if ((field.type === "link" || field.type === "image") && (!safeLink(value) || /[\u0000-\u001f\\]/.test(value))) {
      context.addIssue({ code: "custom", message: `${field.label}: use a site path or an http(s) URL` })
    }
    if (field.type === "link" && field.value && !value.trim()) context.addIssue({ code: "custom", message: `${field.label} cannot be empty` })
    if (field.type === "image" && value.length > 600) context.addIssue({ code: "custom", message: "Upload the image instead of pasting image data" })
  }
})

export async function GET() {
  try {
    const collection = await getCollection<MarketingDocument>("marketing_content")
    const documents = await collection.find({}).toArray()
    return NextResponse.json({ sections: documents.map(document => {
      const { updatedAt, ...content } = normalizeId(document)
      return content
    }) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return handleApiError(error, "Failed to load marketing content") }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = WriteSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid marketing content" }, { status: 400 })
    const { page, section, revision, ...content } = parsed.data
    const definition = marketingDefinition(page, section)
    if (!definition) return NextResponse.json({ error: "Unknown marketing section" }, { status: 400 })
    const collection = await getCollection<MarketingDocument>("marketing_content")
    const id = `${page}:${section}`
    const document: MarketingDocument = {
      _id: id, page: definition.page, section, ...content, revision: revision + 1, updatedAt: new Date(),
    }
    if (revision === 0) {
      try { await collection.insertOne(document) }
      catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) return NextResponse.json({ error: "This section changed. Reload before saving." }, { status: 409 })
        throw error
      }
    } else {
      const result = await collection.replaceOne({ _id: id, revision }, document)
      if (!result.matchedCount) return NextResponse.json({ error: "This section changed. Reload before saving." }, { status: 409 })
    }
    const { updatedAt, ...saved } = normalizeId(document)
    return NextResponse.json({ section: saved }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return handleApiError(error, "Failed to save marketing content") }
}
