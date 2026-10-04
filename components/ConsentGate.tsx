"use client"

/**
 * Consent gate for third-party tags.
 *
 * Vercel Analytics, GA4, Meta Pixel and Clarity were previously mounted
 * unconditionally in the root layout, which meant they executed before the
 * visitor had any opportunity to object. Wrapping them here delays mounting
 * until the matching consent category is actually granted, and mounts them
 * immediately if consent is granted later in the same page view.
 */

import { useEffect, useState, type ReactNode } from "react"
import { hasConsent, onConsentChange, type TrackingCategory } from "@/lib/consent-client"

export default function ConsentGate({
  category,
  children,
}: {
  category: TrackingCategory
  children: ReactNode
}) {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    setAllowed(hasConsent(category))
    // Re-evaluate when the banner writes a decision, so accepting takes effect
    // without a reload.
    return onConsentChange(() => setAllowed(hasConsent(category)))
  }, [category])

  if (!allowed) return null
  return <>{children}</>
}
