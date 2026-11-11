import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireFullAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { getRecoveryDashboard, saveRecoverySettings, runRecoveryAutomation } from '@/lib/recovery-automation'
import { recoverySettingsSchema } from '@/lib/recovery-policy'
export const dynamic='force-dynamic'
export const maxDuration=60
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('settings'),settings:recoverySettingsSchema}).strict(),
  z.object({action:z.literal('preview')}).strict(),
  z.object({action:z.literal('run'),confirm:z.literal(true)}).strict(),
])
export async function GET(request:NextRequest) {
  const guard=await requireFullAdmin()
  if(!guard.ok)return guard.response
  const page=z.coerce.number().int().min(1).max(100000).safeParse(request?.nextUrl?.searchParams.get('page') || 1)
  if(!page.success)return NextResponse.json({error:'Invalid recovery page'},{status:400})
  try {return NextResponse.json(await getRecoveryDashboard(new Date(),page.data),{headers:{'Cache-Control':'private, no-store'}})}catch(error){return handleApiError(error,'Unable to load recovery automation')}
}
export async function POST(request:NextRequest) {
  const guard=await requireFullAdmin()
  if(!guard.ok)return guard.response
  const parsed=actionSchema.safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message || 'Invalid recovery action'},{status:400})
  try {
    if(parsed.data.action==='settings')return NextResponse.json({settings:await saveRecoverySettings(parsed.data.settings,guard.user.id)})
    return NextResponse.json(await runRecoveryAutomation({dryRun:parsed.data.action!=='run'}))
  }catch(error){return handleApiError(error,'Recovery action failed')}
}
