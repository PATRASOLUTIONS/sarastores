import { canonicalSiteOrigin, parseSiteOrigin } from '@/lib/site-origin'

export const INDEXNOW_KEY_PATH = '/indexnow-key.txt'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

export function indexNowConfig() {
  const key = process.env.INDEXNOW_KEY?.trim() || ''
  const rawOrigin = process.env.INDEXNOW_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  const parsed = parseSiteOrigin(rawOrigin)
  const origin = parsed ? canonicalSiteOrigin(parsed) : undefined
  const keyValid = /^[a-zA-Z0-9-]{8,128}$/.test(key)
  const publicOrigin = origin ? new URL(origin) : undefined
  const host = publicOrigin?.hostname || ''
  const originValid = !!publicOrigin && publicOrigin.protocol === 'https:' && host.includes('.')
    && !/^(?:[\d.]+|.*\.local|.*\.localhost|localhost)$/.test(host) && !host.endsWith('.vercel.app')
  const production = process.env.NODE_ENV === 'production' && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production')
  const enabled = process.env.INDEXNOW_ENABLED === 'true'
  const problems = [
    ...(!enabled ? ['Set INDEXNOW_ENABLED=true in production to enable submissions.'] : []),
    ...(!keyValid ? ['INDEXNOW_KEY must contain 8–128 letters, digits or hyphens.'] : []),
    ...(!originValid ? ['Set NEXT_PUBLIC_SITE_URL (or INDEXNOW_SITE_URL) to the public HTTPS website origin.'] : []),
    ...(!production ? ['Submissions are disabled in development and preview deployments.'] : []),
  ]
  return { key, keyValid, origin: originValid ? origin : undefined, enabled, ready: !problems.length, problems,
    keyUrl: originValid ? `${origin}${INDEXNOW_KEY_PATH}` : null }
}
