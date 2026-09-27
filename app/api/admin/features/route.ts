import { NextRequest, NextResponse } from "next/server"
import { getAll, create, update, deleteById, COLLECTIONS } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"

// Ensure we have a constant for FEATURES collection if not exported, or use string "features"
// Assuming COLLECTIONS.FEATURES might effectively be "features"
const FEATURE_COLLECTION = "site_features"

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

    try {
        await connectToDatabase()
        const features = await getAll(FEATURE_COLLECTION, {}, { sort: { createdAt: -1 } })
        return NextResponse.json(features)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

    try {
        const body = await request.json()
        const { title, icon, color, description } = body

        if (!title || !icon) {
            return NextResponse.json({ error: "Title and Icon are required" }, { status: 400 })
        }

        await connectToDatabase()
        const newFeature = await create(FEATURE_COLLECTION, {
            title,
            icon,
            color: color || "blue",
            description: description || "",
            isActive: true, // default active
            createdAt: new Date()
        })

        return NextResponse.json(newFeature)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create feature" }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

    try {
        const body = await request.json()
        const { id, ...updateData } = body

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 })
        }

        await connectToDatabase()
        const updated = await update(FEATURE_COLLECTION, id, updateData)
        return NextResponse.json(updated)
    } catch (error) {
        return NextResponse.json({ error: "Failed to update feature" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 })
        }

        await connectToDatabase()
        await deleteById(FEATURE_COLLECTION, id)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete feature" }, { status: 500 })
    }
}
