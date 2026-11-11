import { type NextRequest, NextResponse } from 'next/server'
import { requireCron } from '@/lib/cron-auth'
import { handleApiError } from '@/lib/api-error'
import { runRecoveryAutomation } from '@/lib/recovery-automation'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function POST(request:NextRequest) {
  const guard=requireCron(request)
  if(!guard.ok)return guard.response
  try {return NextResponse.json(await runRecoveryAutomation({dryRun:request.nextUrl.searchParams.get('dryRun')==='1'}))}catch(error){return handleApiError(error,'Recovery automation failed')}
}
export async function GET(request:NextRequest){return POST(request)}
