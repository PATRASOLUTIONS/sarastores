/**
 * Indian retail calendar for campaign planning.
 *
 * Fixed-date occasions carry an exact day. Festivals that follow the Hindu lunar
 * calendar (Diwali, Holi, Eid, Onam…) move every year, so they are marked
 * `approximate` with a typical window instead of a fabricated date — the admin
 * confirms the real date when scheduling. Getting this wrong sends a Diwali mail
 * in the wrong week, so the uncertainty is surfaced rather than hidden.
 */

export type Occasion = {
  key: string
  label: string
  /** 1–12. The month the campaign usually runs in. */
  month: number
  /** Day of month for fixed-date occasions only. */
  day?: number
  approximate: boolean
  /** What the retailer is actually selling into. */
  angle: string
  /** Categories that historically move during this occasion. */
  pushCategories: string[]
}

export const OCCASIONS: Occasion[] = [
  { key: "new-year", label: "New Year", month: 1, day: 1, approximate: false, angle: "New year, new home upgrade", pushCategories: ["Television", "Kitchen"] },
  { key: "pongal-sankranti", label: "Pongal / Makar Sankranti", month: 1, day: 14, approximate: false, angle: "Harvest festival home refresh", pushCategories: ["Kitchen", "Washing machine"] },
  { key: "republic-day", label: "Republic Day Sale", month: 1, day: 26, approximate: false, angle: "Republic Day price drops", pushCategories: ["Television", "Refrigerator"] },
  { key: "valentines", label: "Valentine's Day", month: 2, day: 14, approximate: false, angle: "Gift for someone special", pushCategories: ["Audio", "Television"] },
  { key: "holi", label: "Holi", month: 3, approximate: true, angle: "Festival of colours celebration deals", pushCategories: ["Washing machine", "Audio"] },
  { key: "gudi-padwa-ugadi", label: "Gudi Padwa / Ugadi", month: 3, approximate: true, angle: "New year in Maharashtra, Karnataka & Andhra — auspicious buying", pushCategories: ["Television", "Refrigerator", "Kitchen"] },
  { key: "financial-year-end", label: "Year-End Clearance", month: 3, day: 31, approximate: false, angle: "Financial year-end clearance", pushCategories: ["All"] },
  { key: "baisakhi", label: "Baisakhi / Vishu / Puthandu", month: 4, approximate: true, angle: "Regional new year offers", pushCategories: ["Kitchen", "Refrigerator"] },
  { key: "akshaya-tritiya", label: "Akshaya Tritiya", month: 4, approximate: true, angle: "Most auspicious day to buy", pushCategories: ["Television", "Refrigerator"] },
  { key: "summer-sale", label: "Summer Cooling Sale", month: 5, approximate: false, angle: "Beat the heat — AC and cooling", pushCategories: ["Air conditioner", "Air cooler", "Refrigerator"] },
  { key: "eid", label: "Eid", month: 4, approximate: true, angle: "Eid Mubarak celebration offers", pushCategories: ["Kitchen", "Television"] },
  { key: "wedding-season", label: "Wedding Season", month: 6, approximate: true, angle: "Setting up a new home", pushCategories: ["Refrigerator", "Washing machine", "Kitchen"] },
  { key: "monsoon-sale", label: "Monsoon Sale", month: 7, approximate: false, angle: "Indoor upgrades for the rains", pushCategories: ["Television", "Washing machine"] },
  { key: "independence-day", label: "Independence Day Sale", month: 8, day: 15, approximate: false, angle: "Freedom sale — biggest discounts", pushCategories: ["All"] },
  { key: "raksha-bandhan", label: "Raksha Bandhan", month: 8, approximate: true, angle: "Gift your sibling", pushCategories: ["Audio", "Small appliances"] },
  { key: "ganesh-chaturthi", label: "Ganesh Chaturthi", month: 9, approximate: true, angle: "Ganpati Bappa Morya — festive home upgrades", pushCategories: ["Television", "Kitchen"] },
  { key: "onam", label: "Onam", month: 9, approximate: true, angle: "Onam special for Kerala customers", pushCategories: ["Kitchen", "Washing machine"] },
  { key: "navratri", label: "Navratri", month: 10, approximate: true, angle: "Nine nights of celebration and savings", pushCategories: ["Television", "Audio"] },
  { key: "durga-puja", label: "Durga Puja", month: 10, approximate: true, angle: "Pujor bazaar — East India festive push", pushCategories: ["Television", "Refrigerator"] },
  { key: "dussehra", label: "Dussehra", month: 10, approximate: true, angle: "Vijayadashami — auspicious purchase day", pushCategories: ["All"] },
  { key: "karwa-chauth", label: "Karwa Chauth", month: 10, approximate: true, angle: "Gift for your partner", pushCategories: ["Kitchen", "Small appliances"] },
  { key: "dhanteras", label: "Dhanteras", month: 11, approximate: true, angle: "The single biggest appliance-buying day of the year", pushCategories: ["All"] },
  { key: "diwali", label: "Diwali", month: 11, approximate: true, angle: "Festival of lights — the flagship sale", pushCategories: ["All"] },
  { key: "bhai-dooj", label: "Bhai Dooj", month: 11, approximate: true, angle: "Celebrate your sibling bond", pushCategories: ["Audio", "Small appliances"] },
  { key: "childrens-day", label: "Children's Day", month: 11, day: 14, approximate: false, angle: "Family entertainment upgrades", pushCategories: ["Television", "Gaming"] },
  { key: "black-friday", label: "Black Friday / Cyber Week", month: 11, approximate: true, angle: "Global sale week, Indian prices", pushCategories: ["All"] },
  { key: "christmas", label: "Christmas", month: 12, day: 25, approximate: false, angle: "Christmas gifting", pushCategories: ["Television", "Audio"] },
  { key: "year-end", label: "Year-End Sale", month: 12, day: 31, approximate: false, angle: "Last chance prices of the year", pushCategories: ["All"] },
]

export const OCCASION_BY_KEY: Record<string, Occasion> = Object.fromEntries(
  OCCASIONS.map((o) => [o.key, o]),
)

/** Occasions in the current and next month, so the admin sees what to run now. */
export function upcomingOccasions(now = new Date()): Occasion[] {
  const thisMonth = now.getMonth() + 1
  const nextMonth = (thisMonth % 12) + 1
  return OCCASIONS.filter((o) => o.month === thisMonth || o.month === nextMonth)
}
