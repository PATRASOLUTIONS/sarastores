import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
const _cache: Map<string, { ts: number; data: any }> = new Map()

export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const baseUrl = process.env.EXLR8_BASE_URL || 'https://stage-platform-exlr8.exlr8now.com'
    const clientId = process.env.EXLR8_CLIENT_ID
    const clientSecret = process.env.EXLR8_CLIENT_SECRET
    const dpId = process.env.EXLR8_DP_ID || process.env.EXLR8_DP

    if (!baseUrl || !clientId || !clientSecret || !dpId) {
      return NextResponse.json({ error: 'Missing EXLR8 configuration' }, { status: 400 })
    }

    const cacheKey = `exlr8:wallet:${dpId}`
    const cached = _cache.get(cacheKey)
    if (cached && (Date.now() - cached.ts) < 30_000) {
      return NextResponse.json(cached.data)
    }

    const upstream = `${baseUrl.replace(/\/$/, '')}/v1/delivery-partners/${dpId}/wallet/balance`
    const headers: any = {
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch(upstream, { headers, signal: controller.signal })
      clearTimeout(timeout)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return NextResponse.json({ error: 'Upstream error', details: data }, { status: res.status })
      }
      _cache.set(cacheKey, { ts: Date.now(), data })
      return NextResponse.json(data)
    } catch (err) {
      console.error('Error fetching exlr8 wallet balance:', err)
      return NextResponse.json({ error: 'Network error fetching wallet balance' }, { status: 502 })
    }
  } catch (error) {
    console.error('exlr8 balance route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
