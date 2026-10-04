"use client"

/**
 * Footer entry point for revisiting the cookie decision.
 *
 * Section 6(4) requires withdrawing consent to be as easy as giving it. A
 * banner that can only ever be answered once does not meet that, so there has
 * to be a permanent, always-visible way back to it.
 */

import { openConsentPreferences } from "@/lib/consent-client"

export default function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentPreferences} className={className}>
      Cookie Preferences
    </button>
  )
}
