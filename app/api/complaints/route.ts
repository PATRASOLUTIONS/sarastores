import { NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { COMPLAINT_STATUS } from "@/lib/complaintTypes"
import { withRateLimit } from "@/lib/rate-limit"
import { requireAdmin } from "@/lib/auth"

// GET all complaints (for admin)
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const collection = await getCollection("complaints")
    // Image blobs are ~21 MB in total; the list only needs the count, and the
    // detail route returns the images themselves.
    const complaints = await collection
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $addFields: { imageCount: { $size: { $ifNull: ["$images", []] } } } },
        { $project: { images: 0 } },
      ])
      .toArray()
    const normalizedComplaints = complaints.map(normalizeId)

    return NextResponse.json({ complaints: normalizedComplaints })
  } catch (error) {
    console.error("Error fetching complaints:", error)
    return NextResponse.json({ error: "Failed to fetch complaints" }, { status: 500 })
  }
}

// POST - Create new complaint
export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { customerName, email, phone, orderNumber, complaintType, subject, description, productName, images } = body

    // Validation
    if (!customerName || !email || !phone || !orderNumber || !complaintType || !subject || !description || !productName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Validate images for specific complaint types
    const imageRequiredTypes = ["breakage", "return", "defective"]
    if (imageRequiredTypes.includes(complaintType) && (!images || images.length === 0)) {
      return NextResponse.json({ error: "Images are required for this complaint type" }, { status: 400 })
    }

    const collection = await getCollection("complaints")

    const complaint = {
      customerName,
      email,
      phone,
      orderNumber,
      complaintType,
      subject,
      description,
      productName,
      images: images || [],
      status: COMPLAINT_STATUS.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeline: [
        {
          date: new Date().toISOString(),
          status: "Pending",
          description: "Complaint submitted successfully",
        },
      ],
    }

    const result = await collection.insertOne(complaint)
    const insertedComplaint = await collection.findOne({ _id: result.insertedId })
    const normalizedComplaint = normalizeId(insertedComplaint)

    // Send confirmation email
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/complaints/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          templateId: 'COMPLAINT_SUBMITTED',
          data: {
            complaintId: normalizedComplaint.id,
            customerName,
            complaintType,
            subject,
            orderNumber,
            productName
          }
        })
      })
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
      // Don't fail the complaint submission if email fails
    }

    return NextResponse.json({ complaint: normalizedComplaint }, { status: 201 })
  } catch (error) {
    console.error("Error creating complaint:", error)
    return NextResponse.json({ error: "Failed to create complaint" }, { status: 500 })
  }
}, { maxRequests: 5, windowMs: 60000 })
