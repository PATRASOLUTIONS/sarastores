import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { DeletePincodeSchema, PincodeModeMutationSchema, PincodeMutationSchema } from "@/lib/validation"
import { getPincodeRestrictions, mergePincodes, removePincodes, setPincodeMode } from "@/lib/pincode-store"
import { z } from "zod"

export const dynamic = "force-dynamic"

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch (error) {
    console.warn("Invalid pincode mutation JSON:", error)
    return null
  }
}

export async function GET() {
  try {
    return NextResponse.json(await getPincodeRestrictions(), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleApiError(error, "Failed to load pincode restrictions")
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = z.union([PincodeModeMutationSchema, PincodeMutationSchema]).safeParse(await readBody(request))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pincode settings" }, { status: 400 })
    if ("mode" in parsed.data) await setPincodeMode(parsed.data.mode)
    else {
      const { listType, ...entry } = parsed.data
      await mergePincodes(listType, [entry])
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to update pincode restrictions")
  }
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = DeletePincodeSchema.safeParse(await readBody(request))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pincode deletion" }, { status: 400 })
    const data = parsed.data
    await removePincodes(data.listType, "clear" in data ? "all" : "pincodes" in data ? data.pincodes : [data.pincode])
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to remove pincode restriction")
  }
}
