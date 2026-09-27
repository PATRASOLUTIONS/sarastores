import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

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

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/v1/delivery-partners/${dpId}/wallet/transactions`)
    const params = request instanceof Request ? new URL(request.url).searchParams : new URLSearchParams()

    const allowed = ['txnType', 'nextCursor', 'limit']
    for (const key of allowed) {
      const v = params.get(key)
      if (v) url.searchParams.set(key, v)
    }

    const headers: any = {
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
    }

    try {
      const res = await fetch(url.toString(), { headers })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return NextResponse.json({ error: 'Upstream error', details: data }, { status: res.status })
      }
      return NextResponse.json(data)
    } catch (err) {
      console.error('Error fetching exlr8 wallet transactions:', err)
      return NextResponse.json({ error: 'Network error fetching transactions' }, { status: 502 })
    }
  } catch (error) {
    console.error('exlr8 transactions route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
