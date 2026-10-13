import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, type Filter } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { requireAdmin } from '@/lib/auth';
import { PartnerManualPaymentVerificationSchema } from '@/lib/validation';
import type { PartnerOrder } from '@/lib/partner/types';

type StoredPartnerOrder = Omit<PartnerOrder, 'id'> & { id?: string };
type RouteContext = { params: Promise<{ orderId: string }> };

async function setVerification(request: NextRequest, context: RouteContext, verified: boolean) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { orderId } = await context.params;
  if (!orderId || orderId.length > 100) return NextResponse.json({ success: false, error: 'Valid order ID is required' }, { status: 400 });
  if (verified) {
    const text = await request.text();
    let body: unknown = {};
    try {
      if (text.trim()) body = JSON.parse(text);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    // Accept the legacy display-name field, but never use it as operator identity.
    const parsed = PartnerManualPaymentVerificationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid verification body' }, { status: 400 });
  }
  try {
    const collection = await getCollection<StoredPartnerOrder>('partner_orders');
    const query: Filter<StoredPartnerOrder> = ObjectId.isValid(orderId)
      ? { $or: [{ orderId }, { _id: new ObjectId(orderId) }] } : { orderId };
    const order = await collection.findOne(query);
    if (!order) return NextResponse.json({ success: false, error: 'Partner order not found' }, { status: 404 });
    const now = new Date();
    const result = await collection.updateOne({ _id: order._id }, verified ? {
      $set: { 'paymentVerification.verified': true, 'paymentVerification.verifiedAt': now, 'paymentVerification.verifiedBy': guard.userId, updatedAt: now },
    } : {
      $set: { 'paymentVerification.verified': false, updatedAt: now },
      $unset: { 'paymentVerification.verifiedAt': '', 'paymentVerification.verifiedBy': '' },
    });
    if (result.matchedCount !== 1) return NextResponse.json({ success: false, error: 'Partner order no longer exists' }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: { orderId: order.orderId, paymentVerified: verified, ...(verified ? { verifiedAt: now.toISOString(), verifiedBy: guard.userId } : {}) },
    });
  } catch (error) {
    console.error('[Partner Manual Verification] Update failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment verification' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return setVerification(request, context, true);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return setVerification(request, context, false);
}
