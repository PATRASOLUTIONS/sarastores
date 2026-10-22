export interface HeaderPromotion {
  id: "super-sunday" | "full-moon"
  title: string
  href: string
  description: string
  weekday: 0 | 1
  enabled: boolean
}

export const DEFAULT_HEADER_PROMOTIONS: HeaderPromotion[] = [
  {
    id: "super-sunday",
    title: "SARA Super Sunday",
    href: "/super-sunday",
    description: "Biggest Deals. Brighter Days.",
    weekday: 0,
    enabled: true,
  },
  {
    id: "full-moon",
    title: "Full Moon Day",
    href: "/products",
    description: "Auspicious full moon day offers",
    weekday: 1,
    enabled: true,
  },
]

export function weekdayInIndia(date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(date)
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name)
}

export function activeHeaderPromotion(promotions: HeaderPromotion[], date = new Date()): HeaderPromotion | null {
  const weekday = weekdayInIndia(date)
  return promotions.find(promotion => promotion.enabled && promotion.weekday === weekday) ?? null
}
