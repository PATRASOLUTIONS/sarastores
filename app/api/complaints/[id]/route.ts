import { NextRequest, NextResponse } from "next/server"
import { getCollection, createObjectId, normalizeId } from "@/lib/db-service"
import { COMPLAINT_STATUS_LABELS } from "@/lib/complaintTypes"
import { requireAdmin } from "@/lib/auth"
import { UpdateComplaintSchema } from "@/lib/validation"
import { complaintStatusTemplate, sendComplaintEmail } from "@/lib/complaint-email"
import { handleApiError } from "@/lib/api-error"

interface ComplaintDocument {
  customerName: string
  email: string
  subject: string
  orderNumber?: string | null
  status: string
  updatedAt?: Date
  timeline?: Array<{ date: string; status: string; description: string }>
  lastAdminNote?: string
}

// GET single complaint
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const collection = await getCollection<ComplaintDocument>("complaints")

    let complaintId
    try {
      complaintId = createObjectId(id)
    } catch {
      return NextResponse.json({ error: "Invalid complaint ID format" }, { status: 400 })
    }

    const complaint = await collection.findOne({ _id: complaintId })

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 })
    }

    return NextResponse.json({ complaint: normalizeId(complaint) })
  } catch (error) {
    console.error("Error fetching complaint:", error)
    return NextResponse.json({ error: "Failed to fetch complaint" }, { status: 500 })
  }
}

// PUT - Update complaint status
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const parsed = UpdateComplaintSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { status, adminNote } = parsed.data

    const collection = await getCollection<ComplaintDocument>("complaints")

    let complaintId
    try {
      complaintId = createObjectId(id)
    } catch {
      return NextResponse.json({ error: "Invalid complaint ID format" }, { status: 400 })
    }

    const complaint = await collection.findOne({ _id: complaintId })

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 })
    }

    // Update timeline
    const statusDescriptions: Record<string, string> = {
      pending: "Complaint is pending review",
      processing: "Complaint is being processed by our team",
      refund_initiated: "Refund has been initiated",
      no_refund: "No refund will be issued",
      resolved: "Complaint has been resolved",
      revoked: "Complaint has been revoked",
    }

    const timelineEntry = {
      date: new Date().toISOString(),
      status: COMPLAINT_STATUS_LABELS[status] || status,
      description: adminNote || statusDescriptions[status] || "Status updated",
    }

    const updateData = {
      status,
      updatedAt: new Date(Math.max(Date.now(), (complaint.updatedAt?.getTime() ?? 0) + 1)),
      ...(adminNote && { lastAdminNote: adminNote }),
    }

    const result = await collection.updateOne({
      _id: complaintId,
      updatedAt: complaint.updatedAt ?? { $exists: false },
    }, {
      $set: updateData,
      $push: { timeline: { $each: [timelineEntry], $position: 0 } },
    })
    if (!result.acknowledged) throw new Error("Complaint update was not acknowledged")
    if (result.matchedCount !== 1) {
      return NextResponse.json({ error: "Complaint changed; reload before updating" }, { status: 409 })
    }

    const updatedComplaint = await collection.findOne({ _id: complaintId })
    if (!updatedComplaint) throw new Error("Updated complaint could not be reloaded")
    const normalizedComplaint = normalizeId(updatedComplaint)
    let notification: { status: "sent" | "failed" } = { status: "failed" }

    // Send status update email
    try {
      await sendComplaintEmail({
          to: normalizedComplaint.email,
          templateId: complaintStatusTemplate[status],
          data: {
            complaintId: normalizedComplaint.id,
            customerName: normalizedComplaint.customerName,
            subject: normalizedComplaint.subject,
            orderNumber: normalizedComplaint.orderNumber,
            adminNote
          }
      })
      notification = { status: "sent" }
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError)
      // Don't fail the update if email fails
    }

    return NextResponse.json({ complaint: normalizedComplaint, notification })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    return handleApiError(error, "Failed to update complaint")
  }
}

// DELETE complaint
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const collection = await getCollection("complaints")

    let complaintId
    try {
      complaintId = createObjectId(id)
    } catch {
      return NextResponse.json({ error: "Invalid complaint ID format" }, { status: 400 })
    }

    const result = await collection.deleteOne({ _id: complaintId })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Complaint deleted successfully" })
  } catch (error) {
    console.error("Error deleting complaint:", error)
    return NextResponse.json({ error: "Failed to delete complaint" }, { status: 500 })
  }
}
