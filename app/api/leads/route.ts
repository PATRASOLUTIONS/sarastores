import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { checkAdminAuthorization } from "@/lib/auth"
import { withRateLimit } from "@/lib/rate-limit"

// GET - Fetch all leads (admin)
export async function GET(req: Request) {
    try {
        const auth = await checkAdminAuthorization()
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")
        const category = searchParams.get("category")
        const source = searchParams.get("source")
        const search = searchParams.get("search")
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")
        const sort = searchParams.get("sort") || "latest"
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")

        const { db } = await connectToDatabase()

        // Build filter
        const filter: any = {}
        if (status && status !== "all") filter.status = status
        if (category && category !== "all") filter.category = category
        if (source && source !== "all") filter.source = source
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ]
        }
        if (startDate || endDate) {
            filter.createdAt = {}
            if (startDate) filter.createdAt.$gte = new Date(startDate)
            if (endDate) filter.createdAt.$lte = new Date(endDate + "T23:59:59.999Z")
        }

        const sortOrder = sort === "oldest" ? 1 : -1

        const total = await db.collection("leads").countDocuments(filter)
        const leads = await db
            .collection("leads")
            .find(filter)
            .sort({ createdAt: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray()

        return NextResponse.json({
            success: true,
            leads,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error("Error fetching leads:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch leads" },
            { status: 500 }
        )
    }
}

// POST - Submit a new lead. Public and therefore rate limited.
export const POST = withRateLimit(async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, phone, pincode, email, category, source } = body

        // Validate required fields
        if (!name || name.trim().length < 3) {
            return NextResponse.json(
                { success: false, error: "Name is required (minimum 3 characters)" },
                { status: 400 }
            )
        }

        // Validate phone (10 digit India)
        const phoneRegex = /^\d{10}$/
        const cleanPhone = phone?.replace(/\D/g, "")
        if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
            return NextResponse.json(
                { success: false, error: "Valid 10-digit phone number is required" },
                { status: 400 }
            )
        }

        // Validate pincode (6 digit)
        const pincodeRegex = /^\d{6}$/
        if (!pincode || !pincodeRegex.test(pincode.trim())) {
            return NextResponse.json(
                { success: false, error: "Valid 6-digit pincode is required" },
                { status: 400 }
            )
        }

        // Validate email if provided
        if (email && email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(email.trim())) {
                return NextResponse.json(
                    { success: false, error: "Invalid email format" },
                    { status: 400 }
                )
            }
        }

        if (!category) {
            return NextResponse.json(
                { success: false, error: "Category is required" },
                { status: 400 }
            )
        }

        const { db } = await connectToDatabase()

        const lead = {
            name: name.trim(),
            phone: cleanPhone,
            pincode: pincode.trim(),
            email: email ? email.toLowerCase().trim() : "",
            category,
            source: source || "Shubham Lucky Draw",
            status: "new",
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        const result = await db.collection("leads").insertOne(lead)

        // Webhook / WhatsApp integration ready
        // You can add webhook call here:
        // await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(lead) })

        return NextResponse.json({
            success: true,
            message: "Thank you for submitting. Our team will contact you shortly.",
            id: result.insertedId,
        })
    } catch (error) {
        console.error("Error submitting lead:", error)
        return NextResponse.json(
            { success: false, error: "Failed to submit lead" },
            { status: 500 }
        )
    }
} as any, { windowMs: 60 * 1000, maxRequests: 8, message: "Too many submissions, please try again shortly." })

// DELETE - Delete a lead (admin)
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Lead ID is required" },
                { status: 400 }
            )
        }

        const { db } = await connectToDatabase()
        const result = await db
            .collection("leads")
            .deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { success: false, error: "Lead not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, message: "Lead deleted successfully" })
    } catch (error) {
        console.error("Error deleting lead:", error)
        return NextResponse.json(
            { success: false, error: "Failed to delete lead" },
            { status: 500 }
        )
    }
}

// PATCH - Update lead status or details
export async function PATCH(req: Request) {
    try {
        const body = await req.json()
        const { id, status, ...otherFields } = body

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Lead ID is required" },
                { status: 400 }
            )
        }

        const validStatuses = ["new", "contacted", "interested", "converted", "closed"]
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, error: "Invalid status. Must be one of: " + validStatuses.join(", ") },
                { status: 400 }
            )
        }

        const updateData: any = { updatedAt: new Date() }
        if (status) updateData.status = status
        // Allow-list the editable fields; anything else in the body is ignored so
        // a client cannot rewrite _id, createdAt or arbitrary keys.
        for (const field of ["name", "email", "phone", "city", "category", "source", "notes"]) {
            if (typeof otherFields[field] === "string") updateData[field] = otherFields[field]
        }

        const { db } = await connectToDatabase()
        const result = await db
            .collection("leads")
            .updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            )

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { success: false, error: "Lead not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, message: "Lead updated successfully" })
    } catch (error) {
        console.error("Error updating lead:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update lead" },
            { status: 500 }
        )
    }
}
