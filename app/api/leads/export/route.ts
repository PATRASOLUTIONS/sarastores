import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import * as XLSX from "xlsx"

// GET - Export leads as Excel
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")
        const category = searchParams.get("category")
        const source = searchParams.get("source")
        const search = searchParams.get("search")
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")
        const sort = searchParams.get("sort") || "latest"

        const { db } = await connectToDatabase()

        // Build filter (same as leads GET)
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
