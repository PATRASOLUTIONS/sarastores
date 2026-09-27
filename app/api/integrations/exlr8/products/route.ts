import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

// Simple in-memory cache to reduce rate of upstream calls (per instance).
const cache = new Map<string, { ts: number; body: any; status: number; headers?: Record<string,string> }>()
const CACHE_TTL_MS = 30 * 1000 // 30s

function buildUpstreamUrl(baseUrl: string, dpId: string, searchParams: URLSearchParams) {
  const url = new URL(`${baseUrl}/v1/products/delivery-partners/${encodeURIComponent(dpId)}`)
  // forward recognized query params like cursor, limit
  for (const [k, v] of searchParams.entries()) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}

// Proxy route to fetch products from eXlr8 (stage by default).
export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const clientId = process.env.EXLR8_CLIENT_ID
    const clientSecret = process.env.EXLR8_CLIENT_SECRET
    const dpId = process.env.EXLR8_DP_ID
    const baseUrl = process.env.EXLR8_BASE_URL || 'https://stage-platform-exlr8.exlr8now.com'

    if (!clientId || !clientSecret || !dpId) {
      // 503, not 500: this is a deployment configuration gap, not a crash.
      return NextResponse.json({ error: 'eXlr8 integration is not configured' }, { status: 503 })
    }

    const urlObj = new URL(req.url)
    const upstreamUrl = buildUpstreamUrl(baseUrl, dpId, urlObj.searchParams)

    // Return cached result if available and fresh
    const cached = cache.get(upstreamUrl)
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      return NextResponse.json(cached.body, { status: cached.status })
    }

    // Timeout controller for fetch
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000) // 10s

    const resp = await fetch(upstreamUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'Content-Type': 'application/json'
      }
    })

    clearTimeout(timeout)

    const text = await resp.text()

    // Respect Retry-After for 429
    if (resp.status === 429) {
      const retryAfter = resp.headers.get('retry-after') || undefined
      return NextResponse.json({ error: 'Rate limited by upstream', retryAfter }, { status: 429 })
    }

    // If unauthorized, return clear message
    if (resp.status === 401 || resp.status === 403) {
      return NextResponse.json({ error: 'Unauthorized to eXlr8 API - check EXLR8_CLIENT_ID/SECRET/DP_ID and environment (UAT/Prod)' }, { status: 502 })
    }

    let body: any = text
    try {
      body = JSON.parse(text)
    } catch (e) {
      // keep raw text
    }

    // Cache successful JSON responses
    if (resp.ok) {
      cache.set(upstreamUrl, { ts: Date.now(), body, status: resp.status, headers: {} })
    }

    return NextResponse.json(body, { status: resp.status })
  } catch (err: any) {
    console.error('Error proxying eXlr8 products:', err)
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Upstream request timed out' }, { status: 504 })
    }
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
