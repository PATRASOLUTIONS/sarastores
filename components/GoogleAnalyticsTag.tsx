"use client"

import Script from "next/script"
import { useEffect } from "react"
import { initializeGoogleTag } from "@/lib/google-tag-client"

export default function GoogleAnalyticsTag({ measurementId }: { measurementId: string }) {
  useEffect(() => { initializeGoogleTag(measurementId) }, [measurementId])
  return <Script id="sara-google-tag" strategy="afterInteractive"
    src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
    onReady={() => { initializeGoogleTag(measurementId) }} />
}
