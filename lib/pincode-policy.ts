import type { z } from "zod"
import type { PincodeModeSchema, PincodeListTypeSchema, PincodeRestrictionsResponseSchema } from "@/lib/validation"
import { checkoutCity } from "@/lib/checkout-region"

export type PincodeMode = z.infer<typeof PincodeModeSchema>
export type PincodeListType = z.infer<typeof PincodeListTypeSchema>
export type PincodeRestrictions = z.infer<typeof PincodeRestrictionsResponseSchema>
export interface PincodeEntry {
  pincode: string
  name: string
  state: string
  addedAt?: string
}

export function normalizePincodeEntry(entry: PincodeRestrictions["allowedPincodes"][number]): PincodeEntry {
  return typeof entry === "string"
    ? { pincode: entry, name: "", state: "" }
    : { ...entry, name: entry.name || "", state: entry.state || "" }
}

export function isPincodeAllowed(rules: PincodeRestrictions, pincode: string): boolean {
  if (!/^\d{6}$/.test(pincode)) return false
  if (rules.mode === "all") return true
  const blocked = rules.blockedPincodes.some(entry => normalizePincodeEntry(entry).pincode === pincode)
  const allowed = rules.allowedPincodes.some(entry => normalizePincodeEntry(entry).pincode === pincode)
  if (rules.mode === "blocked") return !blocked
  if (rules.mode === "allowed") return allowed
  return allowed && !blocked
}

export function isDeliveryRegionAllowed(mode: PincodeMode, city: string, state: string): boolean {
  return mode === "all" || (state.trim().toLowerCase() === "karnataka" && Boolean(checkoutCity(city)))
}
