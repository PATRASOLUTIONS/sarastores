/**
 * Spin Wheel Campaign Helper
 *
 * Each campaign gets its own isolated set of collections:
 *   spin_<slug>_participants, spin_<slug>_inventory, spin_<slug>_couponCodes, etc.
 *
 * The "default" campaign (legacy) uses the original collection names so
 * existing data keeps working without migration.
 */
import { connectToDatabase } from "@/lib/mongodb"
import { Db, Collection } from "mongodb"

const CAMPAIGN_COLLECTIONS = [
  "participants",
  "inventory",
  "couponCodes",
  "coupons",
  "otps",
  "visits",
] as const

type CampaignCollection = (typeof CAMPAIGN_COLLECTIONS)[number]

/** Original (legacy) collection names — used when campaignSlug is "default" */
const LEGACY_NAMES: Record<CampaignCollection, string> = {
  participants: "spinWheelParticipants",
  inventory: "spinWheelInventory",
  couponCodes: "spinWheelCouponCodes",
  coupons: "spinWheelCoupons",
  otps: "spinWheelOtps",
  visits: "spinWheelVisits",
}

function prefixName(slug: string, col: CampaignCollection): string {
  return `spin_${slug}_${col}`
}

/** Get a collection handle for a specific campaign */
export async function getCampaignCollection(
  campaignSlug: string,
  col: CampaignCollection
): Promise<Collection> {
  const { db } = await connectToDatabase()
  const name =
    campaignSlug === "default"
      ? LEGACY_NAMES[col]
      : prefixName(campaignSlug, col)
  return db.collection(name)
}

/** Get the campaigns metadata collection */
export async function getCampaignsCollection(): Promise<Collection> {
  const { db } = await connectToDatabase()
  return db.collection("spinWheelCampaigns")
}

/** Find a campaign by slug */
export async function findCampaignBySlug(slug: string) {
  const col = await getCampaignsCollection()
  return col.findOne({ slug })
}

/** List all campaigns */
export async function listCampaigns(filter: Record<string, any> = {}) {
  const col = await getCampaignsCollection()
  return col.find(filter).sort({ createdAt: -1 }).toArray()
}

/** Default prize configuration for new campaigns */
export const DEFAULT_PRIZES = [
  { prizeName: "TV", emoji: "📺", productImage: "", total: 2, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 1 },
  { prizeName: "SPEAKER", emoji: "🔊", productImage: "", total: 10, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 2 },
  { prizeName: "₹500 VOUCHER", emoji: "🎫", productImage: "", total: 10, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 3 },
  { prizeName: "HOME THEATRE", emoji: "🎬", productImage: "", total: 10, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 1 },
  { prizeName: "CAR", emoji: "🚗", productImage: "", total: 0, distributed: 0, isActive: false, dateRanges: [], timeSlots: [], weightMultiplier: 1 },
  { prizeName: "IPHONE", emoji: "📱", productImage: "", total: 0, distributed: 0, isActive: false, dateRanges: [], timeSlots: [], weightMultiplier: 1 },
  { prizeName: "SAMSUNG PHONE", emoji: "📱", productImage: "", total: 1, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 1 },
  { prizeName: "SOUNDBAR", emoji: "🎵", productImage: "", total: 10, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 2 },
  { prizeName: "BETTER LUCK NEXT TIME", emoji: "🍀", productImage: "", total: 9999, distributed: 0, isActive: true, dateRanges: [], timeSlots: [], weightMultiplier: 5 },
]

/** Seed default prizes for a new campaign */
export async function seedCampaignPrizes(slug: string) {
  const invCol = await getCampaignCollection(slug, "inventory")
  const count = await invCol.countDocuments()
  if (count === 0) {
    await invCol.insertMany(DEFAULT_PRIZES)
    await invCol.createIndex({ prizeName: 1 }, { unique: true })
  }
}
