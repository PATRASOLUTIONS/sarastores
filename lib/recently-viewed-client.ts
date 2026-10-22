"use client"

export const RECENTLY_VIEWED_STORAGE_KEY = "recently_viewed_ids"
const MAX_RECENTLY_VIEWED = 20

export function readRecentlyViewedIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))] : []
  } catch {
    return []
  }
}

export function writeRecentlyViewedIds(ids: string[]): void {
  try {
    window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENTLY_VIEWED)))
  } catch {
    // Private browsing can refuse writes; the history is a convenience only.
  }
}

/** Put a product at the front of the history, locally and on the account when signed in. */
export function recordRecentlyViewed(productId: string, signedIn: boolean): void {
  if (!productId) return
  writeRecentlyViewedIds([productId, ...readRecentlyViewedIds().filter((id) => id !== productId)])
  if (!signedIn) return
  void fetch("/api/user/recently-viewed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId }),
    keepalive: true,
  }).catch(() => console.error("[RecentlyViewed] Could not save the viewed product."))
}
