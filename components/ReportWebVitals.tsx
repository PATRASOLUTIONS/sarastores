"use client"

import { useEffect, useRef } from "react"
import { hasConsent, onConsentChange } from "@/lib/consent-client"

type WebVitalMetric = {
  name: string
  value: number
  rating?: string
  delta?: number
  id?: string
  navigationType?: string
}

const ANALYTICS_ENDPOINT = "/api/vitals"

function postMetric(metric: WebVitalMetric) {
  if (typeof window === "undefined") return
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
  })

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" })
      const sent = navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)
      if (sent) return
    }
  } catch {
    // fall through to fetch
  }

  try {
    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {})
  } catch {
    // ignore — analytics must never break the page
  }
}

export default function ReportWebVitals() {
  // Prevent double-subscription in React 18 strict mode
  const subscribed = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    /**
     * DPDP: page-performance metrics are tied to a page path and a visitor's
     * session, so they are treated as consent-based analytics rather than
     * strictly necessary. Subscribing is deferred until consent exists, and
     * re-checked if the visitor accepts later in the same page view.
     */
    const subscribe = () => {
      if (subscribed.current) return
      if (!hasConsent("analytics")) return
      subscribed.current = true

      // Fire-and-forget; the component must always render null.
      import("web-vitals")
        .then((mod) => {
          if (!mod) return
          const { onINP, onLCP, onCLS, onFCP, onTTFB } = mod
          if (typeof onINP === "function") onINP(postMetric)
          if (typeof onLCP === "function") onLCP(postMetric)
          if (typeof onCLS === "function") onCLS(postMetric)
          if (typeof onFCP === "function") onFCP(postMetric)
          if (typeof onTTFB === "function") onTTFB(postMetric)
        })
        .catch(() => {
          // web-vitals is optional — silently ignore if unavailable
        })
    }

    subscribe()
    return onConsentChange(subscribe)
  }, [])

  return null
}
