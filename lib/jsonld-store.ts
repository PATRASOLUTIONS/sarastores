/**
 * Site-wide structured data built from the `settings` collection.
 *
 * Used by the root layout to render Organization, WebSite (sitelinks
 * search box), and LocalBusiness JSON-LD. Centralised so every page
 * agrees on the brand entity graph (Knowledge Panel, Google Shopping
 * feed, AI-citation grounding, "near me" Maps pack).
 */

import { getSettingsData } from "@/lib/db-service"
import { getOriginFromHeaders } from "@/lib/seo-metadata"

export interface StoreSettingsLite {
  storeName?: string
  companyName?: string
  siteName?: string
  storeDescription?: string
  brandLogo?: string
  email?: string
  phone?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  geo?: { lat: number; lng: number }
  openingHours?: string[] // e.g. ["Mo-Sa 09:00-21:00"]
  socialLinks?: string[]
  twitterHandle?: string
}

export async function getStoreSettings(): Promise<StoreSettingsLite | null> {
  try {
    // Goes through getSettingsData so brandLogo arrives as a media URL rather
    // than an 800 KB data URI that would be inlined into every page's JSON-LD.
    const s = await getSettingsData()
    return (s as StoreSettingsLite) || null
  } catch {
    return null
  }
}

export function pickStoreName(s: StoreSettingsLite | null | undefined): string {
  return s?.storeName || s?.companyName || s?.siteName || "Sara Electronics"
}

function absolutize(origin: string, value: string | undefined | null): string | undefined {
  if (!value) return undefined
  if (value.startsWith("http")) return value
  return `${origin}${value.startsWith("/") ? "" : "/"}${value}`
}

export interface OrganizationGraphInput {
  settings: StoreSettingsLite | null
  origin: string
}

export function buildOrganizationJsonLd({ settings, origin }: OrganizationGraphInput) {
  const name = pickStoreName(settings)
  const logo = absolutize(origin, settings?.brandLogo) || `${origin}/sara-logo.png`
  const description =
    settings?.storeDescription ||
    `${name} — Buy genuine electronics, home appliances, TVs, smartphones and more online at best prices with fast delivery across India.`

  const social = (settings?.socialLinks || []).filter(Boolean)

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}#organization`,
    name,
    url: origin,
    logo: {
      "@type": "ImageObject",
      url: logo,
    },
    description,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        ...(settings?.email ? { email: settings.email } : {}),
        ...(settings?.phone ? { telephone: settings.phone } : {}),
        areaServed: { "@type": "Country", name: "India" },
        availableLanguage: ["en", "hi"],
      },
    ],
  }

  if (social.length) data.sameAs = social
  if (settings?.email) data.email = settings.email
  if (settings?.phone) data.telephone = settings.phone
  if (settings?.address?.street) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: settings.address.street,
      addressLocality: settings.address.city,
      addressRegion: settings.address.state,
      postalCode: settings.address.postalCode,
      addressCountry: settings.address.country || "IN",
    }
  }

  return data
}

export function buildWebSiteJsonLd({ origin }: { origin: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}#website`,
    url: origin,
    name: pickStoreName(null),
    inLanguage: "en-IN",
    publisher: { "@id": `${origin}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/products?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function buildLocalBusinessJsonLd({
  settings,
  origin,
}: OrganizationGraphInput) {
  const name = pickStoreName(settings)
  const logo = absolutize(origin, settings?.brandLogo) || `${origin}/sara-logo.png`
  const description =
    settings?.storeDescription ||
    `${name} — Electronics and home appliance store in India. Online shopping with fast delivery, warranty, and customer support.`

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${origin}#store`,
    name,
    url: origin,
    logo,
    image: logo,
    description,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "Cash, Credit Card, Debit Card, UPI, Net Banking, Razorpay",
    areaServed: { "@type": "Country", name: "India" },
    parentOrganization: { "@id": `${origin}#organization` },
  }

  if (settings?.phone) data.telephone = settings.phone
  if (settings?.email) data.email = settings.email

  if (settings?.address?.street) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: settings.address.street,
      addressLocality: settings.address.city || "",
      addressRegion: settings.address.state || "",
      postalCode: settings.address.postalCode || "",
      addressCountry: settings.address.country || "IN",
    }
  }

  if (settings?.geo?.lat && settings?.geo?.lng) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: settings.geo.lat,
      longitude: settings.geo.lng,
    }
  } else {
    // Fallback: Bangalore city center coordinates for "near me" queries
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: 12.9716,
      longitude: 77.5946,
    }
  }

  if (Array.isArray(settings?.openingHours) && settings.openingHours.length) {
    data.openingHoursSpecification = settings.openingHours.map((spec) => {
      // Accepts either "Mo-Sa 09:00-21:00" or {"days":[...], "opens":"...", "closes":"..."}
      if (typeof spec === "string") {
        const match = spec.match(/^(\S+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
        if (match) {
          return {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: match[1].split("-"),
            opens: match[2],
            closes: match[3],
          }
        }
        return { "@type": "OpeningHoursSpecification", description: spec }
      }
      return spec
    })
  }

  return data
}
