/**
 * Lifecycle rules — the calendar behind Phase 2 reminders.
 *
 * Products carry no structured warranty or service data (only free-text scraped
 * strings), so durations are derived from the shopper-facing category produced by
 * `categoryOf` in utils/catalog.ts. These are deliberately conservative defaults:
 * a reminder that arrives slightly early is useful, one that arrives after the
 * warranty has lapsed is worse than none at all.
 *
 * Every value here is business configuration. Change it freely — nothing in the
 * engine assumes a particular number.
 */

export type ReminderKind =
  | "warranty_expiry"
  | "service_due"
  | "replenishment"
  | "accessory"
  | "winback"
  | "review_request"
  | "abandoned_cart"
  | "back_in_stock"
  | "price_drop"

const DAY = 24 * 60 * 60 * 1000
export const DAYS_MS = DAY

/** Manufacturer warranty length, in months, by shopper-facing category. */
export const WARRANTY_MONTHS: Record<string, number> = {
  "Washing Machines": 24,
  Refrigerators: 12,
  Televisions: 12,
  "Air Conditioners": 12,
  "Air Coolers": 12,
  "Microwaves & Ovens": 12,
  "Water Heaters": 24,
  "Water Purifiers": 12,
  Dishwashers: 24,
}

export const DEFAULT_WARRANTY_MONTHS = 12

/** Warn this far ahead of expiry, so there is time to buy extended cover. */
export const WARRANTY_NOTICE_DAYS = 30

/**
 * Recurring service interval in days. Only categories where servicing is a real,
 * chargeable job appear here — reminding someone to "service" a television would
 * destroy the credibility of every other message.
 */
export const SERVICE_INTERVAL_DAYS: Record<string, number> = {
  "Air Conditioners": 182,
  "Water Purifiers": 182,
  "Washing Machines": 365,
  "Water Heaters": 365,
}

/** Consumables that genuinely run out, with the part the customer will need. */
export const CONSUMABLES: Record<string, { intervalDays: number; part: string }> = {
  "Water Purifiers": { intervalDays: 182, part: "replacement filter cartridge" },
  "Air Conditioners": { intervalDays: 182, part: "service kit and filter clean" },
}

/** Accessory cross-sell fires once, shortly after the customer has settled in. */
export const ACCESSORY_DELAY_DAYS = 14

/** Review invitation — long enough to have formed an opinion, soon enough to recall it. */
export const REVIEW_REQUEST_DELAY_DAYS = 7
export const REVIEW_REQUEST_WINDOW_DAYS = 7

/**
 * Abandoned-cart recovery. Two touches only. The previous implementation had an
 * uncapped hourly follow-up, which would have emailed the same shopper every hour
 * indefinitely — the fastest way to lose a mailing list.
 */
export const CART_FIRST_REMINDER_HOURS = 4
export const CART_SECOND_REMINDER_HOURS = 48
export const CART_MAX_REMINDERS = 2
/** Carts older than this are stale intent, not recoverable. */
export const CART_MAX_AGE_DAYS = 14

/** Minimum price fall before a wishlist alert is worth sending. */
export const PRICE_DROP_MIN_PERCENT = 5

/** Recurring reminders stop once a product is old enough to have been replaced. */
export const MAX_PRODUCT_AGE_DAYS = 365 * 6

/** A reminder within this window of an identical earlier one is suppressed. */
export const DEDUPE_WINDOW_DAYS = 60

export function warrantyMonthsFor(category: string | null): number {
  if (!category) return DEFAULT_WARRANTY_MONTHS
  return WARRANTY_MONTHS[category] ?? DEFAULT_WARRANTY_MONTHS
}

/** Add whole months without the day-of-month drift that `setMonth` alone causes. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const targetDay = result.getDate()
  result.setMonth(result.getMonth() + months)
  if (result.getDate() < targetDay) {
    // Landed in a shorter month (e.g. 31 Jan + 1 month) — clamp to its last day.
    result.setDate(0)
  }
  return result
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY)
}

/** Stable key used to guarantee a customer never receives the same nudge twice. */
export function reminderKey(
  kind: ReminderKind,
  orderId: string,
  productId: string,
  occurrence = 0,
): string {
  return `${kind}:${orderId}:${productId}:${occurrence}`
}
