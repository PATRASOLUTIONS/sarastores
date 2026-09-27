import { Metadata } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { headers } from 'next/headers'

/**
 * Gets the site origin from env vars or request headers.
 *
 * NEXT_PUBLIC_SITE_URL is checked first on purpose: reading headers() opts the
 * calling page out of static prerendering, so a configured origin keeps
 * product and category pages cacheable. VERCEL_URL is only a fallback because
 * it resolves to the per-deployment hostname, not the custom domain.
 */
export async function getOriginFromHeaders(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/+$/, '')

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const proto = hdrs.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`

  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
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
