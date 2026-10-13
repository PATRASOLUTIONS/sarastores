import { NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { COMPLAINT_STATUS, COMPLAINT_TYPE_LABELS, isDpdpComplaint } from "@/lib/complaintTypes"
import { withRateLimit } from "@/lib/rate-limit"
import { requireAdmin, getSession } from "@/lib/auth"
import { dpdpConfig } from "@/lib/dpdp-config"
import { sendComplaintEmail, sendComplaintNotification } from "@/lib/complaint-email"
import { escapeHtml } from "@/lib/html"
import { CreateComplaintSchema, emailSchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"

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
    const parsed = CreateComplaintSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { customerName, email, phone, orderNumber, complaintType, subject, description, productName, images } = parsed.data

    const isPrivacyGrievance = isDpdpComplaint(complaintType)

    const collection = await getCollection("complaints")

    const now = new Date()
    // Section 13 requires a published, honoured response time. The Rules cap it
    // at 90 days; we commit to a shorter one and record the deadline on the
    // record itself so it can be reported on.
    const slaDays = isPrivacyGrievance ? dpdpConfig.grievanceSlaDays : null
    const slaDueBy = slaDays ? new Date(now.getTime() + slaDays * 24 * 60 * 60 * 1000) : null

    // Grievances raised while signed in are linked to the account so the
    // Grievance Officer can verify the data principal's identity.
    const session = await getSession()

    const complaint = {
      customerName,
      email,
      phone: phone || null,
      orderNumber: orderNumber || null,
      complaintType,
      subject,
      description,
      productName: productName || null,
      images: images || [],
      status: COMPLAINT_STATUS.PENDING,
      userId: session?.user?.id ?? null,
      isDpdpGrievance: isPrivacyGrievance,
      ...(isPrivacyGrievance
        ? {
            grievanceOfficer: dpdpConfig.grievanceOfficer.email,
            slaDays,
            slaDueBy,
          }
        : {}),
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          date: now.toISOString(),
          status: "Pending",
          description: isPrivacyGrievance
            ? `Data privacy grievance received and assigned to the Grievance Officer. Response due by ${slaDueBy?.toISOString().slice(0, 10)}.`
            : "Complaint submitted successfully",
        },
      ],
    }

    const result = await collection.insertOne(complaint)
    if (!result.acknowledged) throw new Error("Complaint creation was not acknowledged")
    const insertedComplaint = await collection.findOne({ _id: result.insertedId })
    if (!insertedComplaint) throw new Error("Created complaint could not be reloaded")
    const normalizedComplaint = normalizeId(insertedComplaint)
    let notification: { status: "sent" | "failed" | "not_configured" } = { status: "not_configured" }

    // A DPDP grievance must actually reach the named Grievance Officer, not sit
    // in the product-support queue until someone notices it.
    if (isPrivacyGrievance && emailSchema.safeParse(dpdpConfig.grievanceOfficer.email).success) {
      const due = slaDueBy?.toISOString().slice(0, 10) ?? "—"
      const notify = [
        sendComplaintNotification({
          to: dpdpConfig.grievanceOfficer.email,
          subject: `[DPDP grievance ${normalizedComplaint.id}] ${subject}`,
          html: `<p>A data privacy grievance has been received under section 13 of the DPDP Act, 2023.</p>
<table cellpadding="6">
<tr><td><strong>Reference</strong></td><td>${escapeHtml(normalizedComplaint.id)}</td></tr>
<tr><td><strong>Request type</strong></td><td>${escapeHtml(COMPLAINT_TYPE_LABELS[complaintType] || complaintType)}</td></tr>
<tr><td><strong>Data principal</strong></td><td>${escapeHtml(customerName)} &lt;${escapeHtml(email)}&gt;</td></tr>
<tr><td><strong>Account</strong></td><td>${complaint.userId ? `signed in (${escapeHtml(complaint.userId)})` : "not signed in — verify identity before disclosing data"}</td></tr>
<tr><td><strong>Response due by</strong></td><td>${due} (${slaDays} days)</td></tr>
</table>
<p><strong>Details</strong><br/>${escapeHtml(description)}</p>`,
        }),
        sendComplaintNotification({
          to: email,
          subject: `We have received your data privacy request (${normalizedComplaint.id})`,
          html: `<p>Dear ${escapeHtml(customerName)},</p>
<p>We have received your request under the Digital Personal Data Protection Act, 2023. Your reference is <strong>${escapeHtml(normalizedComplaint.id)}</strong>.</p>
<p>Our Grievance Officer will respond by <strong>${due}</strong>, within ${slaDays} days of your request.</p>
<p>If you are not satisfied with our response, you may complain to the Data Protection Board of India.</p>
<p>${escapeHtml(dpdpConfig.legalEntity)}</p>`,
        }),
      ]
      // Never let a mail failure lose the grievance — it is already stored.
      const outcomes = await Promise.allSettled(notify)
      notification = { status: outcomes.every(outcome => outcome.status === "fulfilled") ? "sent" : "failed" }
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") {
          console.error("[complaints] DPDP grievance notification failed", outcome.reason)
        }
      }
    } else if (isPrivacyGrievance) {
      console.error("[complaints] Grievance Officer email is not configured")
    }

    // Send confirmation email
    try {
      if (!isPrivacyGrievance) {
        await sendComplaintEmail({
          to: email,
          templateId: 'COMPLAINT_SUBMITTED',
          data: { complaintId: normalizedComplaint.id, customerName, subject, orderNumber },
        })
        notification = { status: "sent" }
      }
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
      notification = { status: "failed" }
      // Don't fail the complaint submission if email fails
    }

    return NextResponse.json({ complaint: normalizedComplaint, notification }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    return handleApiError(error, "Failed to create complaint")
  }
}, { maxRequests: 5, windowMs: 60000 })
