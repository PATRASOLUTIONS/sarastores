import { NextResponse } from 'next/server'
import { requireFullAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { indexNowStatus, runIndexNow } from '@/lib/indexnow/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function GET() {
  const guard = await requireFullAdmin(); if (!guard.ok) return guard.response
  try { return json(await indexNowStatus()) } catch (error) { return handleApiError(error, 'IndexNow status could not be loaded') }
}
export async function POST(request: Request) {
  const guard = await requireFullAdmin(); if (!guard.ok) return guard.response
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Cross-site request denied' }, 403)
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  try { const report = await runIndexNow({ dryRun }); return json({ ...report, ...(report.status === 'failed' || report.status === 'busy' ? { error: report.message } : {}) }, report.status === 'failed' ? 502 : report.status === 'busy' ? 409 : 200) }
  catch (error) { return handleApiError(error, 'IndexNow sync could not complete') }
}
