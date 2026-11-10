"use client"
import Script from "next/script"
import { usePathname } from 'next/navigation'
import ConsentGate from "@/components/ConsentGate"
import GoogleAnalyticsTag from "@/components/GoogleAnalyticsTag"
import { googleTagMode } from "@/lib/google-tag-mode"

/**
 * Third-party measurement tags.
 *
 * Every tag is env-gated, so local and preview builds stay clean and a missing
 * ID is a no-op rather than a runtime error. `lib/analytics.ts` already pushes
 * the full GA4 e-commerce event set to `window.dataLayer`, so nothing else has
 * to change when a container is connected here.
 *
 * A configured GA4 ID defaults to direct Google-tag installation. Explicitly
 * select NEXT_PUBLIC_GOOGLE_TAG_MODE=gtm to use a published container instead.
 * Only one Google installation is mounted, even if both IDs are configured.
 * GA4 and Clarity require analytics consent; Meta requires advertising consent.
 * A configurable GTM container conservatively requires both categories.
 *
 * Hosts for these tags must also be allowed in the CSP in next.config.mjs.
 * A missing host fails silently in production only; dev has no CSP.
 */
export default function MarketingTags() {
  const pathname=usePathname()
  // Opt-out URLs carry a signed capability. Do not load trackers on these pages.
  if(/^\/(admin|dashboard|vendor|account|recovery)(\/|$)/.test(pathname || ''))return null
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  const googleMode = googleTagMode({ NEXT_PUBLIC_GA_ID: gaId, NEXT_PUBLIC_GTM_ID: gtmId,
    NEXT_PUBLIC_GOOGLE_TAG_MODE: process.env.NEXT_PUBLIC_GOOGLE_TAG_MODE })
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID

  return (
    <>
      {googleMode === "gtm" && gtmId ? (
        <ConsentGate category="analytics">
          <ConsentGate category="advertising">
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
          </ConsentGate>
        </ConsentGate>
      ) : googleMode === "direct" && gaId ? (
        <ConsentGate category="analytics">
          <GoogleAnalyticsTag measurementId={gaId} />
        </ConsentGate>
      ) : null}

      {metaPixelId ? (
        <ConsentGate category="advertising">
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');window.dispatchEvent(new Event('sara:meta-ready'));`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </ConsentGate>
      ) : null}

      {clarityId ? (
        <ConsentGate category="analytics">
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${clarityId}');`}
        </Script>
        </ConsentGate>
      ) : null}
    </>
  )
}
