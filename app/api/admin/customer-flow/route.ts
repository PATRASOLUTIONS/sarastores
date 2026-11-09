import { NextResponse, type NextRequest } from 'next/server'
import { requireFullAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { FlowQuery, getCustomerFlow } from '@/lib/customer-flow-data'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  const query = FlowQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ error:query.error.issues[0]?.message || 'Invalid filters' },{ status:400 })
  try {
    const result = await getCustomerFlow(query.data)
    if (query.data.mode === 'detail' && 'customer' in result && !result.customer) return NextResponse.json({ error:'Customer not found' },{ status:404 })
    return NextResponse.json(result,{ headers:{ 'Cache-Control':'private, no-store' } })
  } catch (error) { return handleApiError(error,'Unable to load customer journey') }
}
