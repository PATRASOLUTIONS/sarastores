import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { headers } from 'next/headers'

/**
 * Gets the site origin from request headers or env vars.
 * Handles Vercel, custom domains, and local dev.
 */
export async function getOriginFromHeaders(): Promise<string> {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  return host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'))
}

/**
 * Fetches the site settings from the database.
 * Returns null if the DB is unavailable.
 */
export async function getSiteSettings() {
  try {
    const { db } = await connectToDatabase()
    return await db.collection('settings').findOne({})
  } catch {
    return null
  }
}

/**
 * Returns the company/store name from settings.
 */
export function getCompanyName(settings: any): string {
  return settings?.companyName || settings?.storeName || settings?.siteName || 'Sara Electronics'
}

/**
 * Creates standardized page metadata with OG & Twitter tags.
 */
export function buildPageMetadata({
  title,
  description,
  pageUrl,
  origin,
  companyName,
  imageUrl,
  noIndex = false,
}: {
  title: string
  description: string
  pageUrl: string
  origin: string
  companyName: string
  imageUrl?: string
  noIndex?: boolean
}): Metadata {
  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: companyName,
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
      locale: 'en_IN',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, 'max-image-preview': 'large' as const },
  }
}
