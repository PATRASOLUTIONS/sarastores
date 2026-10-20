import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { COLLECTIONS, updateMany } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"

const requestSchema = z.object({
  division: z.string().trim().min(1).max(200),
  active: z.boolean(),
}).strict()

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid division and visibility are required" }, { status: 400 })
    }

    const { division, active } = parsed.data
    const result = await updateMany(
      COLLECTIONS.PRODUCTS,
      { division: { $regex: `^${escapeRegex(division)}$`, $options: "i" } },
      { active },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      division,
      active,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    return handleApiError(error, "Failed to update division visibility")
  }
}
