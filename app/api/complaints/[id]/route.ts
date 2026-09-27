import { NextRequest, NextResponse } from "next/server"
import { getCollection, createObjectId, normalizeId } from "@/lib/db-service"
import { COMPLAINT_STATUS_LABELS } from "@/lib/complaintTypes"
import { requireAdmin } from "@/lib/auth"

// GET single complaint
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const body = await request.json()
    const { status, adminNote } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const collection = await getCollection("complaints")

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
    const existingTimeline = complaint.timeline || []
    const statusDescriptions: Record<string, string> = {
      pending: "Complaint is pending review",
      processing: "Complaint is being processed by our team",
      refund_initiated: "Refund has been initiated",
      no_refund: "No refund will be issued",
      resolved: "Complaint has been resolved",
      revoked: "Complaint has been revoked",
    }

    existingTimeline.unshift({
      date: new Date().toISOString(),
      status: COMPLAINT_STATUS_LABELS[status] || status,
      description: adminNote || statusDescriptions[status] || "Status updated",
    })

    const updateData = {
      status,
      updatedAt: new Date(),
      timeline: existingTimeline,
      ...(adminNote && { lastAdminNote: adminNote }),
    }

    await collection.updateOne({ _id: complaintId }, { $set: updateData })

    const updatedComplaint = await collection.findOne({ _id: complaintId })
    const normalizedComplaint = normalizeId(updatedComplaint)

    // Send status update email
    try {
      const emailTemplateId = getComplaintEmailTemplateId(status)
      
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/complaints/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: normalizedComplaint.email,
          templateId: emailTemplateId,
          data: {
            complaintId: normalizedComplaint.id,
            customerName: normalizedComplaint.customerName,
            status,
            complaintType: normalizedComplaint.complaintType,
            subject: normalizedComplaint.subject,
            orderNumber: normalizedComplaint.orderNumber,
            productName: normalizedComplaint.productName,
            adminNote
          }
        })
      })
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError)
      // Don't fail the update if email fails
    }

    return NextResponse.json({ complaint: normalizedComplaint })
  } catch (error) {
    console.error("Error updating complaint:", error)
    return NextResponse.json({ error: "Failed to update complaint" }, { status: 500 })
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

function getComplaintEmailTemplateId(status: string): string {
  switch (status) {
    case 'pending':
      return 'COMPLAINT_PENDING'
    case 'processing':
      return 'COMPLAINT_PROCESSING'
    case 'refund_initiated':
      return 'COMPLAINT_REFUND_INITIATED'
    case 'no_refund':
      return 'COMPLAINT_NO_REFUND'
    case 'resolved':
      return 'COMPLAINT_RESOLVED'
    case 'revoked':
      return 'COMPLAINT_REVOKED'
    default:
      return 'COMPLAINT_STATUS_UPDATE'
  }
}
