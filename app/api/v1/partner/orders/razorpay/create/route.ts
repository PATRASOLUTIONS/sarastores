import { NextResponse } from 'next/server';
import { withPartnerAuth, type PartnerAuthRequest, createErrorResponse } from '@/lib/partner/auth';
import { PartnerPaymentCreateSchema } from '@/lib/validation';
import { createPartnerPayment } from '@/lib/partner/payments';
import { PartnerCheckoutError } from '@/lib/partner/order-pricing';

async function handlePost(request: PartnerAuthRequest) {
  const origin = request.headers.get('origin');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid JSON body', request.requestId, 400, origin);
  }
  const parsed = PartnerPaymentCreateSchema.safeParse(body);
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, request.requestId, 400, origin);
  try {
    const data = await createPartnerPayment(request.partner, request.apiKey.environment, parsed.data);
    return NextResponse.json({ success: true, data, requestId: request.requestId }, { status: 201 });
  } catch (error) {
    if (error instanceof PartnerCheckoutError) return createErrorResponse('CHECKOUT_ERROR', error.message, request.requestId, error.status, origin);
    console.error('[Partner API] Razorpay order creation failed:', error instanceof Error ? error.message : 'Unexpected service failure');
    return createErrorResponse('INTERNAL_ERROR', 'Unable to create payment order', request.requestId, 502, origin);
  }
}

export const POST = withPartnerAuth(handlePost, ['orders:create']);
export { OPTIONS } from '@/lib/partner/auth';
