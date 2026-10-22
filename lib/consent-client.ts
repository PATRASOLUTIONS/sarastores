"use client"

/**
 * Client-side tracking consent store.
 *
 * Under DPDP, analytics and advertising are not necessary to provide the
 * storefront, so they need consent before anything fires. The decision has to
 * be readable synchronously — a tag that waits for a network round-trip has
 * already loaded by the time the answer arrives — so the state lives in
 * `localStorage` and is mirrored to the server for the audit trail.
 *
 * Strictly-necessary processing (session cookie, cart, fraud prevention) is not
 * represented here. It is not consent-based and cannot be switched off.
 */

import { PRIVACY_NOTICE_VERSION } from "@/lib/dpdp-config"

export const CONSENT_STORAGE_KEY = "dpdp_tracking_consent"
export const CONSENT_CHANGE_EVENT = "dpdp:consent-change"
/** Asks the banner to reopen so a decision can be revisited. */
export const CONSENT_REOPEN_EVENT = "dpdp:consent-reopen"

export type TrackingCategory = "analytics" | "advertising" | "personalisation"

export type TrackingConsent = {
  analytics: boolean
  advertising: boolean
  personalisation: boolean
  /** Notice version in force when the choice was made. */
  version: string
  decidedAt: string
  /** Correlates pre-login consent with the account after sign-in. */
  anonymousId: string
}

export const DENY_ALL: Omit<TrackingConsent, "decidedAt" | "anonymousId" | "version"> = {
  analytics: false,
  advertising: false,
  personalisation: false,
}

const CONSENT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

// A cookie copy survives storage partitioning and site-data cleanups that
// drop localStorage, so a made choice is not asked for again.
function readConsentCookie(): string | null {
  if (typeof document === "undefined" || typeof document.cookie !== "string") return null
  const prefix = `${CONSENT_STORAGE_KEY}=`
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix))
  if (!entry) return null
  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return null
  }
}

function writeConsentCookie(value: string | null): void {
  if (typeof document === "undefined") return
  try {
    const secure = window.location?.protocol === "https:" ? "; Secure" : ""
    document.cookie = value === null
      ? `${CONSENT_STORAGE_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
      : `${CONSENT_STORAGE_KEY}=${encodeURIComponent(value)}; Max-Age=${CONSENT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`
  } catch {
    // Cookies disabled: localStorage remains the record.
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to the Math.random path
  }
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Current decision, or `null` if the visitor has not chosen yet.
 * `null` means deny for every practical purpose — the banner is shown and
 * nothing non-essential fires.
 */
export function readConsent(): TrackingConsent | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    const raw = stored || readConsentCookie()
    if (!raw) return null
    if (!stored) {
      try { window.localStorage.setItem(CONSENT_STORAGE_KEY, raw) } catch { /* cookie still holds it */ }
    }
    const parsed = JSON.parse(raw) as TrackingConsent
    if (
      typeof parsed?.analytics !== "boolean" ||
      typeof parsed.advertising !== "boolean" ||
      typeof parsed.personalisation !== "boolean" ||
      typeof parsed.anonymousId !== "string" ||
      typeof parsed.decidedAt !== "string"
    ) return null
    // A changed notice invalidates the old answer: the person agreed to
    // something that no longer describes what we do.
    if (parsed.version !== PRIVACY_NOTICE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/** Convenience check used by the tag gates. Absent consent is denial. */
export function hasConsent(category: TrackingCategory): boolean {
  const consent = readConsent()
  return consent ? Boolean(consent[category]) : false
}

export function getAnonymousId(): string {
  const existing = readConsent()
  if (existing?.anonymousId) return existing.anonymousId
  return randomId()
}

/** Persist a decision, notify listening tag gates, and mirror it to the ledger. */
export function writeConsent(choice: Partial<Record<TrackingCategory, boolean>>): TrackingConsent {
  const previous = readConsent()
  const record: TrackingConsent = {
    analytics: Boolean(choice.analytics),
    advertising: Boolean(choice.advertising),
    personalisation: Boolean(choice.personalisation),
    version: PRIVACY_NOTICE_VERSION,
    decidedAt: new Date().toISOString(),
    anonymousId: getAnonymousId(),
  }

  writeConsentCookie(JSON.stringify(record))
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Private browsing can refuse writes. The session still behaves as denied,
    // which is the safe direction to fail in.
  }

  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: record }))
  } catch {
    // no listeners is fine
  }

  // Section 8(4) evidence. Best-effort: a failed log must not block the UI.
  try {
    void fetch("/api/consent/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(record),
      keepalive: true,
    }).then((response) => {
      if (!response.ok) console.error("[Consent] Consent audit record could not be saved.")
    }).catch(() => {
      console.error("[Consent] Consent audit record could not be saved.")
    })
  } catch {
    console.error("[Consent] Consent audit record could not be saved.")
  }

  // Unmounting a Script does not stop an already-loaded third-party tracker.
  if (hasWithdrawnConsent(previous, readConsent())) window.location.reload()
  return record
}

function hasWithdrawnConsent(previous: TrackingConsent | null, current: TrackingConsent | null): boolean {
  return (["analytics", "advertising", "personalisation"] as const)
    .some((category) => previous?.[category] === true && current?.[category] !== true)
}

/** Subscribe to consent changes so a tag can mount the moment it is allowed. */
export function onConsentChange(handler: (consent: TrackingConsent | null) => void): () => void {
  if (typeof window === "undefined") return () => {}
  let previous = readConsent()
  const listener = () => {
    previous = readConsent()
    handler(previous)
  }
  const storageListener = (event: StorageEvent) => {
    if (event.key !== CONSENT_STORAGE_KEY && event.key !== null) return
    const current = readConsent()
    const withdrawn = hasWithdrawnConsent(previous, current)
    previous = current
    handler(current)
    if (withdrawn) window.location.reload()
  }
  window.addEventListener(CONSENT_CHANGE_EVENT, listener)
  window.addEventListener("storage", storageListener)
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, listener)
    window.removeEventListener("storage", storageListener)
  }
}

/** Clears the stored decision so the banner reappears. */
export function resetConsent(): void {
  const previous = readConsent()
  writeConsentCookie(null)
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: null }))
  } catch {
    console.error("[Consent] Consent preferences could not be reset.")
  }
  if (hasWithdrawnConsent(previous, readConsent())) window.location.reload()
}

/**
 * Reopen the banner without discarding the current choice, so "Cookie
 * preferences" in the footer shows the existing toggles rather than resetting
 * them to deny.
 */
export function openConsentPreferences(): void {
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT))
  } catch {
    // ignore
  }
}
