import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { AccountEnquirySchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"

export async function GET() {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const enquiries = await getCollection("contact_inquiries")
    const documents = await enquiries.find({ userId: guard.user.id, source: "dashboard" })
      .project({ subject: 1, message: 1, status: 1, createdAt: 1, orderNumber: 1, enquiryType: 1 })
      .sort({ createdAt: -1 }).limit(50).toArray()
    return NextResponse.json({ enquiries: documents.map(normalizeId) }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return handleApiError(error, "Could not load your enquiries") }
}

export const POST = withRateLimit(async (request: Request) => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const parsed = AccountEnquirySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const users = await getCollection("users")
    const user = await users.findOne({ _id: new ObjectId(guard.user.id) }, { projection: { name: 1, email: 1 } })
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 })
    const now = new Date()
    const document = {
      ...parsed.data, name: user.name, email: user.email, userId: guard.user.id,
      enquiryType: parsed.data.category, source: "dashboard", status: "new", createdAt: now, updatedAt: now,
    }
    const enquiries = await getCollection("contact_inquiries")
    const result = await enquiries.insertOne(document)
    return NextResponse.json({ enquiry: normalizeId({ ...document, _id: result.insertedId }) }, { status: 201 })
  } catch (error) { return handleApiError(error, "Could not send your enquiry") }
}, { maxRequests: 5, windowMs: 60000 })
