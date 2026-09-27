import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"

// GET - Fetch lead form settings
export async function GET() {
    try {
        const { db } = await connectToDatabase()
        const existing = await db.collection("lead_settings").findOne({ key: "lead_form_config" })

        // Return defaults if no settings exist
        const settings = existing || {
            key: "lead_form_config",
            fields: {
                name: { enabled: true, required: true },
                phone: { enabled: true, required: true },
                pincode: { enabled: true, required: true },
                email: { enabled: true, required: false },
                category: { enabled: true, required: true },
            },
            categories: [
                "Smart TV", "LED TV", "OLED TV",
                "Refrigerator", "Washing Machine", "Air Conditioner",
                "Microwave Oven", "Water Purifier",
                "Smartphone", "Laptop", "Tablet",
                "Smart Watch", "Wireless Earbuds", "Headphones",
                "Speaker System", "Soundbar", "Home Theater",
                "Vacuum Cleaner", "Air Purifier", "Geyser",
                "Mixer Grinder", "Other"
            ],
            buttonText: "Submit Entry",
            successMessage: "Thank you for submitting. Our team will contact you shortly.",
            whatsappTemplate: "Hello {name}, thank you for participating in our Lucky Draw!",
            whatsappNumber: "",
        }

        return NextResponse.json({ success: true, settings })
    } catch (error) {
        console.error("Error fetching lead settings:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch settings" },
            { status: 500 }
        )
    }
}

// POST - Save/update lead form settings
export async function POST(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    try {
        const body = await req.json()
        const {
            fields,
            categories,
            buttonText,
            successMessage,
            whatsappTemplate,
            whatsappNumber,
        } = body

        const { db } = await connectToDatabase()

        const settings = {
            key: "lead_form_config",
            fields: fields || {
                name: { enabled: true, required: true },
                phone: { enabled: true, required: true },
                pincode: { enabled: true, required: true },
                email: { enabled: true, required: false },
                category: { enabled: true, required: true },
            },
            categories: categories || [],
            buttonText: buttonText || "Submit Entry",
            successMessage: successMessage || "Thank you for submitting. Our team will contact you shortly.",
            whatsappTemplate: whatsappTemplate || "Hello {name}, thank you for participating in our Lucky Draw!",
            whatsappNumber: whatsappNumber || "",
            updatedAt: new Date(),
        }

        await db.collection("lead_settings").updateOne(
            { key: "lead_form_config" },
            { $set: settings },
            { upsert: true }
        )

        return NextResponse.json({ success: true, message: "Settings saved successfully" })
    } catch (error) {
        console.error("Error saving lead settings:", error)
        return NextResponse.json(
            { success: false, error: "Failed to save settings" },
            { status: 500 }
        )
    }
}
