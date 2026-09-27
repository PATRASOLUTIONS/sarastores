import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import { updateMany, COLLECTIONS } from "@/lib/db-service"

export async function POST() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  console.log("[API Activate All] Starting activate-all request")

  try {
    await connectToDatabase()
  } catch (err) {
    console.error("[API Activate All] DB connect failed", err)
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  try {
    const result = await updateMany(COLLECTIONS.PRODUCTS, {}, { active: true })
    console.log("[API Activate All] Updated products:", result)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("[API Activate All] Error activating products", error)
    return NextResponse.json({ error: "Failed to activate products", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
