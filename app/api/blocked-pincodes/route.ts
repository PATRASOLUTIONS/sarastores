import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"

const COLLECTION = "blocked_pincodes"

export async function GET() {
  const collection = await getCollection(COLLECTION)
  const blockedDoc = await collection.findOne({ key: "blocked_list" })
  const allowedDoc = await collection.findOne({ key: "allowed_list" })
  const modeDoc = await collection.findOne({ key: "mode" })
  
  return NextResponse.json({ 
    blockedPincodes: blockedDoc?.pincodes || [],
    allowedPincodes: allowedDoc?.pincodes || [],
    mode: modeDoc?.value || "blocked" // "blocked", "allowed", or "both"
  })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { pincode, name, state, listType, mode } = await req.json()
  const collection = await getCollection(COLLECTION)
  
  // Update mode if provided
  if (mode) {
    await collection.updateOne(
      { key: "mode" },
      { $set: { key: "mode", value: mode } },
      { upsert: true }
    )
    return NextResponse.json({ success: true })
  }
  
  // Add pincode to specified list
  if (!pincode || !listType) {
    return NextResponse.json({ error: "Pincode and listType required" }, { status: 400 })
  }
  
  const key = listType === "allowed" ? "allowed_list" : "blocked_list"
  const pincodeEntry = {
    pincode,
    name: name || "",
    state: state || "",
    addedAt: new Date().toISOString()
  }
  
  await collection.updateOne(
    { key },
    { 
      $addToSet: { pincodes: pincodeEntry }, 
      $set: { key } 
    },
    { upsert: true }
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const { pincode, listType } = await req.json()
  if (!pincode || !listType) {
    return NextResponse.json({ error: "Pincode and listType required" }, { status: 400 })
  }
  
  const collection = await getCollection(COLLECTION)
  const key = listType === "allowed" ? "allowed_list" : "blocked_list"
  await collection.updateOne(
    { key },
    { $pull: { pincodes: { pincode: pincode } } } as any
  )
  return NextResponse.json({ success: true })
}
