import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/diwali/service'
import { limit } from '@/lib/diwali/http'
import { resolveStoreLink, recordStoreOpen, shouldCountStoreOpen, createStoreReferral, STORE_REFERRAL_COOKIE, STORE_REFERRAL_AGE } from '@/lib/diwali/store-links'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
// Public QR landing: aggregate store opens only; no IP/device history is stored.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const target = new URL('/diwali-gift', request.url)
  try {
    const { id } = await context.params
    const store = await resolveStoreLink(id, await getConfig())
    if (!store) return NextResponse.redirect(target, { status: 302, headers })
    if (store.code) target.searchParams.set('store', store.code)
    const response = NextResponse.redirect(target, { status: 302, headers })
    if (shouldCountStoreOpen(request)) {
      await limit(request, 'store-open', id, 1000)
      await recordStoreOpen(store)
      const referral = createStoreReferral(id)
      if (referral) response.cookies.set(STORE_REFERRAL_COOKIE, referral, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: STORE_REFERRAL_AGE })
    }
    return response
  } catch { return NextResponse.redirect(target, { status: 302, headers }) }
}
export async function HEAD(request: Request) { return NextResponse.redirect(new URL('/diwali-gift', request.url), { status: 302, headers }) }
