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
import { Db, Collection, type Document, type Filter } from "mongodb"

export interface SpinCampaign {
  name: string
  slug: string
  description?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SpinPrize {
  prizeName: string
  emoji?: string
  productImage?: string | null
  total: number
  distributed?: number
  isActive?: boolean
  dateRanges?: Array<{ startDate: string; endDate: string }>
  timeSlots?: Array<{ startTime: string; endTime: string }>
  weightMultiplier?: number
}

export interface SpinCouponCode {
  code: string
  prizeName: string
  isUsed?: boolean
  usedBy?: string | null
  createdAt: Date
}

export interface SpinParticipant {
  name?: string
  phone?: string
  email?: string
  otpCode?: string
  otp?: string
  otpVerified?: boolean
  prize?: string | null
  couponCode?: string | null
  store?: string
  hasSpun?: boolean
  createdAt: Date
  spinDate?: Date | string | null
}

export interface SpinCoupon {
  couponCode: string
  prize: string
  participantName: string
  participantPhone: string
  participantEmail?: string
  store?: string
  status: string
  createdAt: Date | string
}

export interface SpinVisitStats {
  _id: string
  visits: number
}

export interface SpinParticipantStats {
  _id: string
  participants: number
  spins: number
  winners: number
}

export interface SpinCouponStats {
  _id: string
  total: number
  used: number
  unused: number
}

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

/**
 * The only shape a campaign slug may take. The slug becomes part of a MongoDB
 * collection name, so an unchecked value from a request body lets an anonymous
 * caller create collections at will. Mirrors SpinOtpRequestSchema in
 * lib/validation.ts, which already enforced this on the OTP-send route.
 */
export const CAMPAIGN_SLUG_PATTERN = /^[a-z0-9-]{1,60}$/

/**
 * Normalise a caller-supplied campaign id, or null when it is unusable.
 * An absent value means the default campaign, which is how every existing
 * caller behaves.
 */
export function resolveCampaignSlug(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "default"
  if (typeof value !== "string") return null
  const slug = value.trim().toLowerCase()
  return CAMPAIGN_SLUG_PATTERN.test(slug) ? slug : null
}

/**
 * Get a collection handle for a specific campaign.
 *
 * The slug becomes part of a collection name, so it is re-validated here rather
 * than trusting each caller to have run it through resolveCampaignSlug first.
 * Several public routes take the campaign id straight from the request body.
 */
export async function getCampaignCollection<TSchema extends Document = Document>(
  campaignSlug: string,
  col: CampaignCollection
): Promise<Collection<TSchema>> {
  const slug = resolveCampaignSlug(campaignSlug)
  if (!slug) throw new Error("Invalid campaign id")

  const { db } = await connectToDatabase()
  const name =
    slug === "default"
      ? LEGACY_NAMES[col]
      : prefixName(slug, col)
  return db.collection<TSchema>(name)
}

/** Get the campaigns metadata collection */
export async function getCampaignsCollection(): Promise<Collection<SpinCampaign>> {
  const { db } = await connectToDatabase()
  return db.collection<SpinCampaign>("spinWheelCampaigns")
}

/** Find a campaign by slug */
export async function findCampaignBySlug(slug: string) {
  const col = await getCampaignsCollection()
  return col.findOne({ slug })
}

/** List all campaigns */
export async function listCampaigns(filter: Filter<SpinCampaign> = {}) {
  const col = await getCampaignsCollection()
  return col.find(filter).sort({ createdAt: -1 }).toArray()
}

/** Default prize configuration for new campaigns */
export const DEFAULT_PRIZES: SpinPrize[] = [
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
  const invCol = await getCampaignCollection<SpinPrize>(slug, "inventory")
  const count = await invCol.countDocuments()
  if (count === 0) {
    await invCol.insertMany(DEFAULT_PRIZES)
    await invCol.createIndex({ prizeName: 1 }, { unique: true })
  }
}
