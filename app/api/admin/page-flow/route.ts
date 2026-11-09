import { type NextRequest,NextResponse } from 'next/server'
import { requireFullAdmin } from '@/lib/auth'
import { Ga4Error,ga4Connection } from '@/lib/google-ga4'
import { PageFlowQuery,getPageFlow } from '@/lib/page-flow-data'
export const dynamic='force-dynamic'
export async function GET(request:NextRequest) {
  const guard=await requireFullAdmin()
  if(!guard.ok)return guard.response
  const parsed=PageFlowQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message || 'Invalid page filters'},{status:400})
  if(parsed.data.mode==='status')return NextResponse.json(ga4Connection(),{headers:{'Cache-Control':'private, no-store'}})
  try {return NextResponse.json(await getPageFlow(parsed.data),{headers:{'Cache-Control':'private, no-store'}})}
  catch(error) {
    const failure=error instanceof Ga4Error?error:new Ga4Error('The page report is temporarily unavailable. Retry after checking the GA4 connection.')
    return NextResponse.json({error:failure.message,code:failure.code,missing:failure.missing},{status:failure.status,headers:{'Cache-Control':'private, no-store',...(failure.status===429?{'Retry-After':'60'}:{})}})
  }
}
