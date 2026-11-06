export const PRODUCT_GIFT_CELEBRATION_MS = 5000

export const giftTermsHref = (productId: string) => `/gift-terms?productId=${encodeURIComponent(productId)}`

export function shortGiftName(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length > 3 ? `${words.slice(0, 3).join(" ")}…` : name.trim()
}

export function formatGiftExpiryDate(expiresAt: string): string {
  return `Valid till ${new Date(expiresAt).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
  })}.`
}

export function formatGiftExpiry(expiresAt: string): string {
  return `Valid until ${new Date(expiresAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  })} IST.`
}
