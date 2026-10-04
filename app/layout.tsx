

import type React from "react"
import { Inter, Poppins, Caveat } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { Providers } from "./providers"
import { getSettingsData } from "../lib/db-service"
import { Analytics } from "@vercel/analytics/next"
import { SiteJsonLd } from "@/components/SiteJsonLd"
import ReportWebVitals from "@/components/ReportWebVitals"
import MarketingTags from "@/components/MarketingTags"
import ConsentBanner from "@/components/ConsentBanner"
import ConsentGate from "@/components/ConsentGate"
import ThemeEffects from "@/components/theme/ThemeEffects"
import GaneshBlessing from "@/components/theme/GaneshBlessing"
import AnnouncementBar from "@/components/theme/AnnouncementBar"
import { getActiveTheme } from "@/lib/theme/service"
import { themeToCssVars } from "@/lib/theme"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
  display: "swap",
})

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-script",
  display: "swap",
})


// --- HOW TO DO DYNAMIC METADATA ---
// To fetch metadata (title, favicon, etc.) from the database, use the generateMetadata function:
//
// export async function generateMetadata() {
//   // Fetch from your DB or API here (e.g., using fetch or db client)
//   const settings = await fetch("http://localhost:3000/api/settings").then(res => res.json())
//   return {
//     title: settings.storeName || "E-Commerce Store",
//     description: settings.storeDescription || "Your one-stop shop for all your needs",
//     generator: "Bytewise Consulting LLP",
//     icons: {
//       icon: settings.brandLogo || "/favicon.ico"
//     }
//   }
// }

export async function generateMetadata() {
  // Never let a slow or unreachable database block the page: race the settings
  // lookup against a short timeout and fall back to defaults if it loses.
  const settings: any = await Promise.race([
    getSettingsData().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
  ])

  // Determine absolute origin for images/icons
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3000`)

  const siteName = settings?.storeName || "SARA Mobiles & Electronics"
  const description =
    settings?.storeDescription ||
    "Shop genuine mobiles, electronics and home appliances at SARA — best prices, easy EMI and fast delivery across Karnataka."

  // Brand logo doubles as the favicon unless one is uploaded in admin settings.
  const defaultLogo = "/sara-logo.png"
  const rawLogo = settings?.brandLogo || defaultLogo
  const logo = rawLogo && (rawLogo.startsWith("http") ? rawLogo : `${origin}${rawLogo.startsWith("/") ? "" : "/"}${rawLogo}`)

  // Favicons must stay same-origin: an absolute http://localhost URL is cross-origin
  // to the running port and is blocked by the img-src CSP. Only remote logos keep their URL.
  const iconUrl = rawLogo.startsWith("http") ? rawLogo : rawLogo.startsWith("/") ? rawLogo : `/${rawLogo}`
  const iconDescriptor = [{ url: iconUrl, type: "image/png" }]

  return {
    title: siteName,
    description,
    generator: "Bytewise Consulting LLP",
    icons: {
      icon: iconDescriptor,
      apple: iconDescriptor,
      shortcut: defaultLogo,
    },
    openGraph: {
      title: siteName,
      description,
      siteName,
      images: logo ? [logo] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description,
      images: logo ? [logo] : [],
    },
    // PWA / mobile
    manifest: "/manifest.webmanifest",
    applicationName: siteName,
    appleWebApp: {
      capable: true,
      title: siteName,
      statusBarStyle: "default",
      startupImage: defaultLogo,
    },
    formatDetection: { telephone: true, address: true, email: true },
    alternates: {
      canonical: origin,
      languages: {
        "en-IN": origin,
        "x-default": origin,
      },
      rss: `${origin}/feed.xml`,
    },
    // AI-search discoverability
    other: {
      "apple-mobile-web-app-capable": "yes",
      "mobile-web-app-capable": "yes",
      "theme-color": "#0f172a",
      "color-scheme": "light",
    },
  }
}


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const enablePwaServiceWorker = process.env.NEXT_PUBLIC_ENABLE_PWA_SW === "true"
  const theme = await getActiveTheme()

  return (
    <html
      lang="en"
      className={`light ${inter.variable} ${poppins.variable} ${caveat.variable}`}
      data-theme={theme.id}
      data-theme-intensity={theme.intensity}
      data-theme-pattern={theme.pattern}
      data-theme-toran={theme.toran ? "on" : "off"}
      suppressHydrationWarning
    >
      <head>
        {/* Theme variables are rendered before any stylesheet-dependent paint,
            so a festival palette never flashes the default colours first. */}
        <style id="sara-theme" dangerouslySetInnerHTML={{ __html: themeToCssVars(theme) }} />
        {/* Preconnect to external image CDNs for faster image loading */}
        <link rel="dns-prefetch" href="https://m.media-amazon.com" />
        <link rel="preconnect" href="https://m.media-amazon.com" crossOrigin="anonymous" />
        {/* Preconnect to payment / auth / realtime endpoints used in checkout */}
        <link rel="dns-prefetch" href="https://api.razorpay.com" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
        <link rel="preconnect" href="https://api.razorpay.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://checkout.razorpay.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://*.firebaseio.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        {/* PWA / apple touch icons */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" />
        <link rel="icon" type="image/png" href="/icons/icon-192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/icons/icon-512.png" sizes="512x512" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium">
          Skip to main content
        </a>
        {/* Site-wide JSON-LD: Organization + WebSite (sitelinks search box) + LocalBusiness */}
        <SiteJsonLd />
        <ThemeEffects effect={theme.effect} />
        <GaneshBlessing active={theme.id === "ganesh" && theme.blessing} />
        <AnnouncementBar message={theme.announcement} href={theme.announcementLink} />
        <Providers>{children}</Providers>
        {/*
          DPDP: analytics and advertising are not necessary to run the store, so
          they stay unmounted until the visitor grants the matching consent.
          ReportWebVitals is self-gating on the analytics category.
        */}
        <ConsentGate category="analytics">
          <SpeedInsights />
          <Analytics />
        </ConsentGate>
        <ReportWebVitals />
        <ConsentGate category="advertising">
          <MarketingTags />
        </ConsentGate>
        <ConsentBanner />
        {/* Service Worker: disabled by default because stale workers in
            production can keep serving broken cached images or stale route
            responses after deploys. Re-enable only when explicitly opted in. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(reg) { reg.unregister(); });
                }).catch(function() {});
              }
              if (window.caches && caches.keys) {
                caches.keys().then(function(keys) {
                  keys.forEach(function(k) { caches.delete(k); });
                }).catch(function() {});
              }
              if (${enablePwaServiceWorker ? "true" : "false"}) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
