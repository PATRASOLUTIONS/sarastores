/**
 * Records an external bank/UPI commission payment. Does not transfer funds.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuthorization } from '@/lib/auth'
import { CommissionPaymentSchema, CommissionPaymentError, recordCommissionPayment } from '@/lib/partner/commissions'

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuthorization()
  if (!authCheck.authorized) return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } }, { status: 401 }
  )
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, { status: 400 }
    )
  }
  const parsed = CommissionPaymentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(
    { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid commission payment details' } }, { status: 400 }
  )
  try {
    if (!authCheck.userId) throw new Error('Authenticated operator identity is missing')
    const data = await recordCommissionPayment(parsed.data, authCheck.userId)
    return NextResponse.json({ success: true, data: {
      ...data, message: 'External commission payment recorded. No wallet credit or bank transfer was initiated.',
    } })
  } catch (error) {
    if (error instanceof CommissionPaymentError) return NextResponse.json(
      { success: false, error: { code: 'CONFLICT', message: error.message } }, { status: error.status }
    )
    console.error('[Admin Partner Commissions] mark-paid error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record commission payment' } }, { status: 500 }
    )
  }
}
