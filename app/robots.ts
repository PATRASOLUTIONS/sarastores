import { MetadataRoute } from 'next'

function getOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

/**
 * Private or transactional areas. Nothing here has search value and several
 * contain personal data, so they stay out of the crawl entirely.
 */
const PRIVATE_PATHS = [
  '/admin/',
  '/api/',
  '/dashboard/',
  '/account/',
  '/checkout/',
  '/cart/',
  '/order/',
  '/thank-you',
  '/track',
  '/auth/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/vendor/',
  '/partner-api-test/',
  '/partner-api-docs/',
  '/loaders-demo/',
  '/subham/',
  '/error/',
  '/compare',
]

/**
 * Faceted-navigation crawl trap.
 *
 * Filter combinations on the listing pages produce a combinatorial number of
 * URLs with no unique content — and every one already canonicalises to the
 * clean `/products` URL, so blocking them costs no ranking while stopping the
 * crawler burning its budget on near-duplicates. `?q=` goes for the same reason
 * internal search results always do: thin, infinite and user-generated.
 */
const FACET_PARAMS = [
  '/*?*q=',
  '/*?*sort=',
  '/*?*minPrice=',
  '/*?*maxPrice=',
  '/*?*size=',
  '/*?*star=',
  '/*?*capacity=',
  '/*?*feature=',
  '/*?*page=',
]

export default function robots(): MetadataRoute.Robots {
  const origin = getOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...PRIVATE_PATHS, ...FACET_PARAMS],
      },
      {
        // The image crawler should still reach product imagery on listing pages.
        userAgent: 'Googlebot-Image',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
