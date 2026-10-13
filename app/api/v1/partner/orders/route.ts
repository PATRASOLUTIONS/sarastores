import { NextResponse } from 'next/server';
import { withPartnerAuth, type PartnerAuthRequest, createErrorResponse } from '@/lib/partner/auth';
import { createPartnerOrder, listPartnerOrders } from '@/lib/partner/orders';
import { PartnerOrderCreateSchema, PartnerOrderListQuerySchema } from '@/lib/validation';

async function handlePost(req: PartnerAuthRequest) {
  const origin = req.headers.get('origin');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid JSON body', req.requestId, 400, origin);
  }
  const parsed = PartnerOrderCreateSchema.safeParse(body);
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, req.requestId, 400, origin);
  try {
    const result = await createPartnerOrder(req.partner, parsed.data, req.apiKey.environment);
    if (!result.success) return createErrorResponse('CHECKOUT_ERROR', result.error, req.requestId, result.status || 400, origin);
    return NextResponse.json({
      success: true,
      ...(result.testMode ? { testMode: true, message: 'Order simulated in test mode; no stock reserved or fulfillment order saved.' } : {}),
      data: { order: result.order },
    }, { status: 201 });
  } catch (error) {
    console.error('[Partner Orders API] Create error:', error instanceof Error ? error.message : 'Unexpected service failure');
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create order', req.requestId, 500, origin);
  }
}

async function handleGet(req: PartnerAuthRequest) {
  const parsed = PartnerOrderListQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', parsed.error.issues[0].message, req.requestId, 400, req.headers.get('origin'));
  try {
    const result = await listPartnerOrders(req.partner.id, parsed.data);
    return NextResponse.json({
      success: true,
      data: {
        orders: result.orders,
        pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) },
      },
    });
  } catch (error) {
    console.error('[Partner Orders API] List error:', error instanceof Error ? error.message : 'Unexpected service failure');
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch orders', req.requestId, 500, req.headers.get('origin'));
  }
}

export const POST = withPartnerAuth(handlePost, ['orders:write']);
export const GET = withPartnerAuth(handleGet, ['orders:read']);
export { OPTIONS } from '@/lib/partner/auth';
