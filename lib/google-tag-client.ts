"use client"

import { hasConsent, CONSENT_CHANGE_EVENT } from "@/lib/consent-client"
import { googleTagMode } from "@/lib/google-tag-mode"

declare global { interface Window { saraGoogleTagId?: string } }
let listening = false

function updateConsent() {
  const id = window.saraGoogleTagId
  if (!id || typeof window.gtag !== "function") return
  const allowed = hasConsent("analytics"), advertising = hasConsent("advertising")
  const flags = window as unknown as Record<string, unknown>
  flags[`ga-disable-${id}`] = !allowed
  const gtag = window.gtag as (...args: unknown[]) => void
  gtag("consent", "update", {
    analytics_storage: allowed ? "granted" : "denied",
    ad_storage: advertising ? "granted" : "denied",
    ad_user_data: advertising ? "granted" : "denied",
    ad_personalization: advertising ? "granted" : "denied",
  })
}

/** Queue configuration before loading gtag.js, and configure the property once. */
export function initializeGoogleTag(id: string): boolean {
  if (typeof window === "undefined" || /^\/(admin|dashboard|vendor|account|recovery)(\/|$)/.test(window.location?.pathname || '') || !hasConsent("analytics") || !/^G-[A-Z0-9]+$/.test(id)) return false
  if (window.saraGoogleTagId === id) return true
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== "function") {
    // Google's command parser recognizes Arguments objects. Plain arrays are
    // ignored, leaving consent and config unapplied even when the script loads.
    // valueOf preserves the native Arguments object instead of copying it.
    window.gtag = function () { window.dataLayer!.push(arguments.valueOf()) }
  }
  // The gtag API supports setup commands as well as event commands.
  const gtag = window.gtag as (...args: unknown[]) => void
  window.saraGoogleTagId = id
  gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied",
    ad_user_data: "denied", ad_personalization: "denied" })
  updateConsent()
  gtag("js", new Date())
  gtag("config", id, { send_page_view: true, currency: "INR" })
  if (!listening) { listening = true; window.addEventListener(CONSENT_CHANGE_EVENT, updateConsent) }
  return true
}

export function sendGoogleTagEvent(event: string, params: Record<string, unknown>) {
  const mode = googleTagMode({
    NEXT_PUBLIC_GOOGLE_TAG_MODE: process.env.NEXT_PUBLIC_GOOGLE_TAG_MODE,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
  })
  if (mode !== "direct" || !initializeGoogleTag(process.env.NEXT_PUBLIC_GA_ID || "")) return
  // Google handles initial and enhanced-measurement history page views. The
  // internal journey page_view must not become a second Google page view.
  if (event === "page_view") return
  window.gtag!("event", event, params)
}
