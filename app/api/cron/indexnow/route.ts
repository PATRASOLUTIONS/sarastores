import { type NextRequest, NextResponse } from 'next/server'
import { requireCron } from '@/lib/cron-auth'
import { handleApiError } from '@/lib/api-error'
import { runIndexNow } from '@/lib/indexnow/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: NextRequest) {
  const guard = requireCron(request); if (!guard.ok) return guard.response
  try { const report = await runIndexNow({ dryRun: new URL(request.url).searchParams.get('dryRun') === '1' }); return NextResponse.json(report, { status: report.status === 'failed' ? 502 : 200, headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return handleApiError(error, 'IndexNow scheduled sync failed') }
}
