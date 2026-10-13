import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"
import { getCollection, normalizeId } from "@/lib/db-service"
import { ContactInquirySchema } from "@/lib/validation"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"

// GET - Fetch all contact inquiries (for admin)
export async function GET() {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response
    try {
        const { db } = await connectToDatabase()
        const inquiries = await db
            .collection("contact_inquiries")
            .find({})
            .sort({ createdAt: -1 })
            .toArray()

        return NextResponse.json({ success: true, inquiries: inquiries.map(normalizeId) })
    } catch (error) {
        console.error("Error fetching contact inquiries:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch inquiries" },
            { status: 500 }
        )
    }
}

// POST - Submit a new contact inquiry
export const POST = withRateLimit(async (req: Request) => {
    try {
        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
        }
        const parsed = ContactInquirySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                success: false,
                error: parsed.error.issues[0].message,
            }, { status: 400 })
        }
        const now = new Date()
        const inquiry = {
            ...parsed.data,
            ...(parsed.data.consent === true ? { consentAt: now } : {}),
            status: "new",
            createdAt: now,
            updatedAt: now,
        }
        const inquiries = await getCollection("contact_inquiries")
        const result = await inquiries.insertOne(inquiry)

        return NextResponse.json({
            success: true,
            message: "Thank you for reaching out! We will contact you soon.",
            id: result.insertedId.toString(),
        })
    } catch (error) {
        return handleApiError(error, "Failed to submit inquiry")
    }
}, { maxRequests: 5, windowMs: 60000 })

// DELETE - Delete a contact inquiry (admin only)
export async function DELETE(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Inquiry ID is required" },
                { status: 400 }
            )
        }

        const { db } = await connectToDatabase()
        const result = await db
            .collection("contact_inquiries")
            .deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { success: false, error: "Inquiry not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, message: "Inquiry deleted successfully" })
    } catch (error) {
        console.error("Error deleting inquiry:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete inquiry" },
            { status: 500 }
        )
    }
}

// PATCH - Update inquiry status
export async function PATCH(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const { id, status } = await req.json()

        if (!id || !status) {
            return NextResponse.json(
                { success: false, error: "ID and status are required" },
                { status: 400 }
            )
        }

        const validStatuses = ["new", "contacted", "resolved", "archived"]
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, error: "Invalid status" },
                { status: 400 }
            )
        }

        const { db } = await connectToDatabase()
        const result = await db
            .collection("contact_inquiries")
            .updateOne(
                { _id: new ObjectId(id) },
                { $set: { status, updatedAt: new Date() } }
            )

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: "Inquiry not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, message: "Status updated successfully" })
    } catch (error) {
        console.error("Error updating inquiry:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update inquiry" },
            { status: 500 }
        )
    }
}
