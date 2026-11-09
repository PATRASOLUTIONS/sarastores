import { createHmac } from 'node:crypto'
import { PRIVACY_NOTICE_VERSION } from '@/lib/dpdp-config'

/** Only pseudonymous, consented browser identity. Never use this as authentication. */
export function consentedVisitor(cookie: string | undefined): string | null {
  if (!cookie || !process.env.SESSION_SECRET && !process.env.NEXTAUTH_SECRET) return null
  try {
    const consent = JSON.parse(decodeURIComponent(cookie))
    if (consent.analytics !== true || consent.inherited || consent.version !== PRIVACY_NOTICE_VERSION ||
      typeof consent.anonymousId !== 'string' || !/^[a-zA-Z0-9_-]{12,100}$/.test(consent.anonymousId)) return null
    return createHmac('sha256', process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET!)
      .update(`customer-flow:${consent.anonymousId}`).digest('hex')
  } catch { return null }
}
export function trafficSource(referer: string | null, ownOrigin: string): string {
  if (!referer) return 'Direct'
  try {
    const url = new URL(referer)
    if (url.origin === ownOrigin) return ''
    if (/(^|\.)google\./.test(url.hostname)) return 'Google'
    if (/(^|\.)(facebook|instagram)\.com$/.test(url.hostname)) return 'Meta'
    return url.hostname.slice(0,100)
  } catch { return 'Unknown' }
}
