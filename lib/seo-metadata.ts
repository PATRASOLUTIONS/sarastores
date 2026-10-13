import { Metadata } from 'next'
import { cache } from 'react'
import { getSettingsData } from '@/lib/db-service'
import { headers } from 'next/headers'

/**
 * Gets the site origin from env vars or request headers.
 *
 * NEXT_PUBLIC_SITE_URL is checked first on purpose: reading headers() opts the
 * calling page out of static prerendering, so a configured origin keeps
 * product and category pages cacheable. VERCEL_URL is only a fallback because
 * it resolves to the per-deployment hostname, not the custom domain.
 */
export const getOriginFromHeaders = cache(async (): Promise<string> => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('The public site URL must use http(s)')
    return url.origin
  }

  const hdrs = await headers()
  const host = (hdrs.get('x-forwarded-host') || hdrs.get('host'))?.split(',')[0].trim()
  const proto = hdrs.get('x-forwarded-proto')?.split(',')[0].trim() ||
    (host && /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host) ? 'http' : 'https')
  if (host) return new URL(`${proto === 'http' ? 'http' : 'https'}://${host}`).origin

  return process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
})

/**
 * Fetches the site settings from the database.
 * Returns null if the DB is unavailable.
 */
export const getSiteSettings = cache(async () => {
  try {
    const settings: Record<string, unknown> | null = await getSettingsData()
    if (!settings) return null
    const text = (key: string) => typeof settings[key] === 'string' ? settings[key] : undefined
    return {
      ...settings,
      companyName: text('companyName'), storeName: text('storeName'), siteName: text('siteName'),
      storeDescription: text('storeDescription'), brandLogo: text('brandLogo'), signature: text('signature'),
      metaTitle: text('metaTitle'), metaDescription: text('metaDescription'),
    }
  } catch (error) {
    console.error('[SEO] Site settings could not be loaded:', error)
    return null
  }
})

/**
 * Returns the company/store name from settings.
 */
export function getCompanyName(settings: { companyName?: string; storeName?: string; siteName?: string } | null): string {
  return settings?.storeName || settings?.companyName || settings?.siteName || 'Sara Electronics'
}

export function seoText(value: string): string {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>' }
  return value.replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match
    const code = entity.toLowerCase().startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
  }).replace(/\s+/g, ' ').trim()
}

export function absoluteSeoImage(value: unknown, origin: string): string | undefined {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\\]/.test(value)) return undefined
  try {
    const url = new URL(value.trim(), `${origin}/`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch { return undefined }
}

export function shareImageUrl({ title, description, companyName, origin }: {
  title: string; description: string; companyName: string; origin: string
}): string {
  const url = new URL('/og', origin)
  url.searchParams.set('title', seoText(title).slice(0, 160))
  url.searchParams.set('description', seoText(description).slice(0, 240))
  url.searchParams.set('brand', seoText(companyName).slice(0, 80))
  return url.href
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
  title = seoText(title)
  description = seoText(description)
  const canonical = new URL(pageUrl, origin)
  canonical.search = ''
  canonical.hash = ''
  pageUrl = canonical.href
  const resolvedImage = absoluteSeoImage(imageUrl, origin)
  const image = resolvedImage && !/\.svg(?:[?#]|$)/i.test(resolvedImage) ? resolvedImage : undefined
  const shareImage = image || shareImageUrl({ title, description, companyName, origin })
  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: { canonical: pageUrl, languages: { 'en-IN': pageUrl, 'x-default': pageUrl } },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: companyName,
      images: [{ url: shareImage, alt: title, ...(!image && { width: 1200, height: 630, type: 'image/png' }) }],
      locale: 'en_IN',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [shareImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, 'max-image-preview': 'large' as const },
  }
}
