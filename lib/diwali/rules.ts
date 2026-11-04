export const GIFTS = [
  { code: 'silver5', label: '5 Gram Silver', kannada: '5 ಗ್ರಾಂ ಬೆಳ್ಳಿ', grams: 5, metal: 'silver', min: 15000, max: 25999 },
  { code: 'silver10', label: '10 Gram Silver', kannada: '10 ಗ್ರಾಂ ಬೆಳ್ಳಿ', grams: 10, metal: 'silver', min: 26000, max: 50000 },
  { code: 'silver15', label: '15 Gram Silver', kannada: '15 ಗ್ರಾಂ ಬೆಳ್ಳಿ', grams: 15, metal: 'silver', min: 50001, max: 80000 },
  { code: 'silver20', label: '20 Gram Silver', kannada: '20 ಗ್ರಾಂ ಬೆಳ್ಳಿ', grams: 20, metal: 'silver', min: 80001, max: 100000 },
  { code: 'gold1', label: '1 Gram Gold', kannada: '1 ಗ್ರಾಂ ಚಿನ್ನ', grams: 1, metal: 'gold', min: 100001, max: null },
] as const
export type GiftCode = typeof GIFTS[number]['code']
export function giftForRupees(value: number) {
  // Whole-rupee invoices only until Finance approves a paise policy.
  if (!Number.isSafeInteger(value) || value < 15000) return null
  return GIFTS.find(gift => value >= gift.min && (gift.max === null || value <= gift.max)) ?? null
}
export function normalizeInvoice(value: string) { return value.trim().replace(/\s+/g, '').toUpperCase() }
export function indiaDate(value: Date) {
  return new Date(value.getTime() + 330 * 60_000).toISOString().slice(0, 10)
}
export function isRealDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function deliveryDueAt(approvedAt: Date, weekdays: number[], holidays: string[]) {
  if (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Invalid working-day calendar')
  const day = new Date(`${indiaDate(approvedAt)}T00:00:00Z`)
  let remaining = 7
  for (let examined = 0; remaining && examined < 370; examined++) {
    day.setUTCDate(day.getUTCDate() + 1)
    if (weekdays.includes(day.getUTCDay()) && !holidays.includes(day.toISOString().slice(0, 10))) remaining--
  }
  if (remaining) throw new Error('Calendar does not contain enough working days')
  // End of the seventh working day in Asia/Kolkata; approval day excluded.
  return new Date(`${day.toISOString().slice(0, 10)}T23:59:59.999+05:30`)
}
export function safeCsv(value: unknown) {
  const text = String(value ?? '')
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
}
