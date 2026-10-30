import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import * as XLSX from "xlsx"
import { requireAdmin } from "@/lib/auth"
import { LeadQuerySchema, buildLeadFilter } from "@/lib/lead-query"

// GET - Export leads as Excel
export async function GET(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response
    try {
        const { searchParams } = new URL(req.url)
        const parsed = LeadQuerySchema.safeParse(Object.fromEntries(searchParams))
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid lead filters" }, { status: 400 })
        const { sort } = parsed.data

        const { db } = await connectToDatabase()

        const filter = buildLeadFilter(parsed.data)

        const sortOrder = sort === "oldest" ? 1 : -1

        const leads = await db
            .collection("leads")
            .find(filter)
            .sort({ createdAt: sortOrder })
            .toArray()

        // Prepare data for Excel
        const excelData = leads.map((lead, index) => ({
            "S.No": index + 1,
            "Name": lead.name || "",
            "Phone": lead.phone || "",
            "Email": lead.email || "",
            "Pincode": lead.pincode || "",
            "Category": lead.category || "",
            "Source": lead.source || "",
            "Store": lead.storeName || "",
            "Store Code": lead.storeCode || "",
            "Message": lead.message || "",
            "Enquiry Contact Consent": lead.contactConsent === true ? "Yes" : lead.contactConsent === false ? "No" : "Not recorded",
            "Promotional Consent": lead.promotionalConsent === true ? "Yes" : lead.promotionalConsent === false ? "No" : "Not recorded",
            "Status": (lead.status || "new").charAt(0).toUpperCase() + (lead.status || "new").slice(1),
            "Date": lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }) : "",
        }))

        // Create workbook
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(excelData)

        // Set column widths
        ws["!cols"] = [
            { wch: 6 },   // S.No
            { wch: 25 },  // Name
            { wch: 15 },  // Phone
            { wch: 30 },  // Email
            { wch: 10 },  // Pincode
            { wch: 20 },  // Category
            { wch: 25 },  // Source
            { wch: 30 },  // Store
            { wch: 15 },  // Store Code
            { wch: 60 },  // Message
            { wch: 25 },  // Enquiry Contact Consent
            { wch: 25 },  // Promotional Consent
            { wch: 15 },  // Status
            { wch: 20 },  // Date
        ]

        XLSX.utils.book_append_sheet(wb, ws, "Leads")

        // Generate buffer
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })

        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="leads_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        console.error("Error exporting leads:", error)
        return NextResponse.json(
            { success: false, error: "Failed to export leads" },
            { status: 500 }
        )
    }
}
