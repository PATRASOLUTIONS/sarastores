/**
 * Offer merchandising sections ("OFFERS ENGINE" in the BRD).
 *
 * The BRD asks for a dedicated offers hub broken into named sections —
 * today's deals, mega sale, clearance, store-exclusive and so on. An offer
 * carries a `section` so the hub can render each one, and store-exclusive
 * offers additionally carry the stores they apply to.
 */

export const OFFER_SECTIONS = [
  "todays-deals",
  "mega-sale",
  "mobile-offers",
  "tv-offers",
  "appliance-offers",
  "bank-offers",
  "cashback",
  "emi-offers",
  "clearance",
  "store-exclusive",
] as const

export type OfferSection = (typeof OFFER_SECTIONS)[number]

export const OFFER_SECTION_LABELS: Record<OfferSection, string> = {
  "todays-deals": "Today's Deals",
  "mega-sale": "Mega Sale",
  "mobile-offers": "Mobile Offers",
  "tv-offers": "TV Offers",
  "appliance-offers": "Appliance Offers",
  "bank-offers": "Bank Offers",
  cashback: "Cashback",
  "emi-offers": "EMI Offers",
  clearance: "Clearance Sale",
  "store-exclusive": "Store Exclusive",
}

export const OFFER_SECTION_BLURBS: Record<OfferSection, string> = {
  "todays-deals": "Live today only — prices return to normal at midnight.",
  "mega-sale": "Our biggest savings event across every category.",
  "mobile-offers": "Smartphones and wearables at their best prices.",
  "tv-offers": "Televisions and home entertainment deals.",
  "appliance-offers": "Refrigerators, washing machines, ACs and more.",
  "bank-offers": "Instant discounts and cashback with partner bank cards.",
  cashback: "Money back after purchase on eligible payment methods.",
  "emi-offers": "No-cost and low-interest instalment plans.",
  clearance: "Last units, display pieces and end-of-line stock. Once they're gone, they're gone.",
  "store-exclusive": "Available only in selected SARA stores — not online.",
}

export function isOfferSection(value: unknown): value is OfferSection {
  return typeof value === "string" && (OFFER_SECTIONS as readonly string[]).includes(value)
}

export function normalizeOfferSection(value: unknown): OfferSection {
  return isOfferSection(value) ? value : "todays-deals"
}

export interface OfferMerchandising {
  section: OfferSection
  /** Store ids an offer is limited to; empty means every store / online. */
  storeIds: string[]
  /** Clearance urgency — the offer stops showing after this instant. */
  endsAt: string | null
}

export function getOfferMerchandising(offer: any): OfferMerchandising {
  return {
    section: normalizeOfferSection(offer?.section),
    storeIds: Array.isArray(offer?.storeIds) ? offer.storeIds.map(String) : [],
    endsAt: offer?.endsAt ? new Date(offer.endsAt).toISOString() : null,
  }
}

/** An offer is live when it is active and inside its end window. */
export function isOfferLive(offer: any, now: Date = new Date()): boolean {
  if (offer?.active === false) return false
  if (!offer?.endsAt) return true
  const endsAt = new Date(offer.endsAt)
  return Number.isNaN(endsAt.getTime()) ? true : now <= endsAt
}
