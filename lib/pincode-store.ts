import { getCollection } from "@/lib/db-service"
import { PincodeRestrictionsResponseSchema } from "@/lib/validation"
import type { PincodeEntry, PincodeListType, PincodeMode } from "@/lib/pincode-policy"

interface PincodeDocument {
  key: string
  value?: PincodeMode
  pincodes?: Array<string | Partial<PincodeEntry> & { pincode: string }>
}

function withoutPincodes(pincodes: string[]) {
  return {
    $filter: {
      input: { $ifNull: ["$pincodes", []] }, as: "entry",
      cond: { $not: [{ $in: [
        { $cond: [{ $eq: [{ $type: "$$entry" }, "string"] }, "$$entry", "$$entry.pincode"] },
        { $literal: pincodes },
      ] }] },
    },
  }
}

export async function getPincodeRestrictions() {
  const collection = await getCollection<PincodeDocument>("blocked_pincodes")
  const [blocked, allowed, mode] = await Promise.all([
    collection.findOne({ key: "blocked_list" }),
    collection.findOne({ key: "allowed_list" }),
    collection.findOne({ key: "mode" }),
  ])
  return PincodeRestrictionsResponseSchema.parse({
    blockedPincodes: blocked?.pincodes ?? [],
    allowedPincodes: allowed?.pincodes ?? [],
    mode: mode?.value ?? "blocked",
  })
}

export async function setPincodeMode(mode: PincodeMode) {
  const collection = await getCollection<PincodeDocument>("blocked_pincodes")
  await collection.createIndex({ key: 1 }, { unique: true, name: "pincode_key_unique" })
  const result = await collection.updateOne({ key: "mode" }, { $set: { key: "mode", value: mode } }, { upsert: true })
  if (!result.acknowledged) throw new Error("Pincode mode write was not acknowledged")
}

export async function mergePincodes(listType: PincodeListType, entries: PincodeEntry[]) {
  const collection = await getCollection<PincodeDocument>("blocked_pincodes")
  await collection.createIndex({ key: 1 }, { unique: true, name: "pincode_key_unique" })
  const key = `${listType}_list`
  const addedAt = new Date().toISOString()
  const result = await collection.updateOne({ key }, [{
    $set: { key, pincodes: { $concatArrays: [
      withoutPincodes(entries.map(entry => entry.pincode)),
      { $literal: entries.map(entry => ({ ...entry, addedAt })) },
    ] } },
  }], { upsert: true })
  if (!result.acknowledged) throw new Error("Pincode list write was not acknowledged")
}

export async function removePincodes(listType: PincodeListType, pincodes: string[] | "all") {
  const collection = await getCollection<PincodeDocument>("blocked_pincodes")
  const result = await collection.updateOne({ key: `${listType}_list` }, [{
    $set: { pincodes: pincodes === "all" ? { $literal: [] } : withoutPincodes(pincodes) },
  }])
  if (!result.acknowledged) throw new Error("Pincode deletion was not acknowledged")
}
