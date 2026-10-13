import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { pincodeSchema, PincodeRestrictionsResponseSchema } from "@/lib/validation"
import { z } from "zod"

const COLLECTION = "blocked_pincodes"
const PincodeMutationSchema = z.object({
  pincode: pincodeSchema,
  listType: z.enum(["allowed", "blocked"]),
  name: z.string().trim().max(200).default(""),
  state: z.string().trim().max(100).default(""),
}).strict()
const ModeMutationSchema = z.object({ mode: z.enum(["allowed", "blocked", "both"]) }).strict()
const DeletePincodeSchema = PincodeMutationSchema.pick({ pincode: true, listType: true })

interface PincodeDocument {
  key: string
  value?: "allowed" | "blocked" | "both"
  pincodes?: Array<string | { pincode: string; name?: string; state?: string; addedAt?: string }>
}

function withoutPincode(pincode: string) {
  return {
    $filter: {
      input: { $ifNull: ["$pincodes", []] }, as: "entry",
      cond: { $ne: [{ $cond: [{ $eq: [{ $type: "$$entry" }, "string"] }, "$$entry", "$$entry.pincode"] }, pincode] },
    },
  }
}

export async function GET() {
  try {
  const collection = await getCollection<PincodeDocument>(COLLECTION)
  const blockedDoc = await collection.findOne({ key: "blocked_list" })
  const allowedDoc = await collection.findOne({ key: "allowed_list" })
  const modeDoc = await collection.findOne({ key: "mode" })
  
  return NextResponse.json(PincodeRestrictionsResponseSchema.parse({
    blockedPincodes: blockedDoc?.pincodes || [],
    allowedPincodes: allowedDoc?.pincodes || [],
    mode: modeDoc?.value || "blocked" // "blocked", "allowed", or "both"
  }))
  } catch (error) {
    return handleApiError(error, "Failed to load pincode restrictions")
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
  const body: unknown = await req.json().catch(error => {
    console.warn("Invalid pincode mutation JSON:", error)
    return null
  })
  const parsed = z.union([ModeMutationSchema, PincodeMutationSchema]).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pincode settings" }, { status: 400 })
  const collection = await getCollection<PincodeDocument>(COLLECTION)
  
  // Update mode if provided
  await collection.createIndex({ key: 1 }, { unique: true, name: "pincode_key_unique" })
  if ("mode" in parsed.data) {
    const result = await collection.updateOne(
      { key: "mode" },
      { $set: { key: "mode", value: parsed.data.mode } },
      { upsert: true }
    )
    if (!result.acknowledged) throw new Error("Pincode mode write was not acknowledged")
    return NextResponse.json({ success: true })
  }
  
  // Add pincode to specified list
  const { pincode, name, state, listType } = parsed.data
  const key = listType === "allowed" ? "allowed_list" : "blocked_list"
  const pincodeEntry = {
    pincode,
    name: name || "",
    state: state || "",
    addedAt: new Date().toISOString()
  }
  
  const result = await collection.updateOne(
    { key },
    [{ $set: { key, pincodes: { $concatArrays: [withoutPincode(pincode), { $literal: [pincodeEntry] }] } } }],
    { upsert: true }
  )
  if (!result.acknowledged) throw new Error("Pincode list write was not acknowledged")
  return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to update pincode restrictions")
  }
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
  const parsed = DeletePincodeSchema.safeParse(await req.json().catch(error => {
    console.warn("Invalid pincode deletion JSON:", error)
    return null
  }))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pincode deletion" }, { status: 400 })
  const { pincode, listType } = parsed.data
  
  const collection = await getCollection<PincodeDocument>(COLLECTION)
  const key = listType === "allowed" ? "allowed_list" : "blocked_list"
  const result = await collection.updateOne(
    { key },
    [{ $set: { pincodes: withoutPincode(pincode) } }],
  )
  if (!result.acknowledged) throw new Error("Pincode deletion was not acknowledged")
  return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to remove pincode restriction")
  }
}
