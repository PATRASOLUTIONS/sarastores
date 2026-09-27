import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth"

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

        return NextResponse.json({ success: true, inquiries })
    } catch (error) {
        console.error("Error fetching contact inquiries:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch inquiries" },
            { status: 500 }
        )
    }
}

// POST - Submit a new contact inquiry
export async function POST(req: Request) {
    try {
        const { name, email, phone } = await req.json()

        // Validate required fields
        if (!name || !email || !phone) {
            return NextResponse.json(
                { success: false, error: "Name, email, and phone are required" },
                { status: 400 }
            )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { success: false, error: "Invalid email format" },
                { status: 400 }
            )
        }

        // Validate phone number (basic validation)
        const phoneRegex = /^\d{10}$/
        if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
            return NextResponse.json(
                { success: false, error: "Invalid phone number. Please enter a 10-digit phone number" },
                { status: 400 }
            )
        }

        const { db } = await connectToDatabase()

        const inquiry = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            status: "new",
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        const result = await db.collection("contact_inquiries").insertOne(inquiry)

        return NextResponse.json({
            success: true,
            message: "Thank you for reaching out! We will contact you soon.",
            id: result.insertedId,
        })
    } catch (error) {
        console.error("Error submitting contact inquiry:", error)
        return NextResponse.json(
            { success: false, error: "Failed to submit inquiry" },
            { status: 500 }
        )
    }
}

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
