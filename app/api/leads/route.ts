import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { checkAdminAuthorization, requireAdmin } from "@/lib/auth"
import { withRateLimit } from "@/lib/rate-limit"
import { LeadQuerySchema, buildLeadFilter } from "@/lib/lead-query"
import { CreateLeadSchema, StoreLocatorLeadSchema, UpdateLeadSchema } from "@/lib/validation"
import { getCollection } from "@/lib/db-service"
import { ACTIVE_RETAIL_STORE_FILTER, type StoredStoreLocation } from "@/lib/store-locations"
import { derivePincode } from "@/lib/store-address"

// GET - Fetch all leads (admin)
export async function GET(req: Request) {
    try {
        const auth = await checkAdminAuthorization()
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error || "Admin access required" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const parsed = LeadQuerySchema.safeParse(Object.fromEntries(searchParams))
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid lead filters" }, { status: 400 })
        const { sort, page, limit } = parsed.data

        const { db } = await connectToDatabase()

        const filter = buildLeadFilter(parsed.data)

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
        const body: unknown = await req.json().catch(error => {
            console.warn("Invalid lead submission JSON:", error)
            return null
        })
        if (body && typeof body === "object" && "source" in body && body.source === "store_locator") {
            const parsed = StoreLocatorLeadSchema.safeParse(body)
            if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid enquiry" }, { status: 400 })
            const { storeId, name, email, phone, message, contactConsent, promotionalConsent } = parsed.data
            const store = await (await getCollection<StoredStoreLocation>("store_locations")).findOne({
                ...ACTIVE_RETAIL_STORE_FILTER, _id: new ObjectId(storeId),
            }, { projection: { shopName: 1, storeCode: 1, pincode: 1, locationDescription: 1 } })
            if (!store) return NextResponse.json({ error: "This store is unavailable. Please select another store." }, { status: 404 })
            const now = new Date()
            const result = await (await getCollection("leads")).insertOne({
                name, email: email.trim().toLowerCase(), phone, message,
                source: "store_locator", category: "Store enquiry", status: "new",
                storeId: String(store._id), storeName: store.shopName || "", storeCode: store.storeCode || "",
                pincode: String(store.pincode || derivePincode(store.locationDescription || "")),
                contactConsent, promotionalConsent, contactChannels: ["notifications", "whatsapp", "call"],
                consentVersion: "store-enquiry-2026-10-30", consentAcceptedAt: now,
                createdAt: now, updatedAt: now,
            })
            return NextResponse.json({ success: true, id: String(result.insertedId), message: "Thank you. Your enquiry has been sent to our team." }, { status: 201 })
        }
        const parsed = CreateLeadSchema.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid lead submission" }, { status: 400 })
        const { name, phone, pincode, email, category, source } = parsed.data

        const { db } = await connectToDatabase()

        const lead = {
            name: name.trim(),
            phone,
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
}, { windowMs: 60 * 1000, maxRequests: 8, message: "Too many submissions, please try again shortly." })

// DELETE - Delete a lead (admin)
export async function DELETE(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id || !ObjectId.isValid(id)) {
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
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response
    try {
        const parsed = UpdateLeadSchema.safeParse(await req.json().catch(error => {
            console.warn("Invalid lead update JSON:", error)
            return null
        }))
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid lead update" }, { status: 400 })
        const { id, ...fields } = parsed.data
        const updateData = { ...fields, updatedAt: new Date() }

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
