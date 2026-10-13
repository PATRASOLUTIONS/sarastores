/**
 * Admin Payout Approve API
 * 
 * POST /api/admin/payouts/[payoutId]/approve - Approve a payout (no bank transfer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { approvePayout, PayoutStateConflictError } from '@/lib/partner/wallet';
import { getCollection } from '@/lib/db-service';
import type { Payout } from '@/lib/partner/types';
import { z } from 'zod';

const PAYOUTS_COLLECTION = 'partner_payouts';
const approvalSchema = z.object({
  transactionId: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

/**
 * POST /api/admin/payouts/[payoutId]/approve
 * Approval does not initiate or confirm a bank transfer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }
  
  try {
    const { payoutId } = await params;
    
    const text = await request.text();
    let body: unknown = {};
    try {
      if (text.trim()) body = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, { status: 400 }
      );
    }
    const parsed = approvalSchema.safeParse(body);
    if (!parsed.success || !payoutId || payoutId.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid payout approval details' } }, { status: 400 }
      );
    }
    const collection = await getCollection<Payout>(PAYOUTS_COLLECTION);
    const payout = (ObjectId.isValid(payoutId)
      ? await collection.findOne({ _id: new ObjectId(payoutId) }) : null)
      ?? await collection.findOne({ id: payoutId });
    
    if (!payout) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } },
        { status: 404 }
      );
    }
    
    if (!authCheck.userId) throw new Error('Authenticated operator identity is missing');
    const result = await approvePayout(
      payout._id.toString(),
      authCheck.userId,
      parsed.data
    );
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: result.id,
        status: result.status,
        message: 'Payout approved. No bank transfer has been initiated or confirmed.',
      },
    });
  } catch (error) {
    if (error instanceof PayoutStateConflictError) return NextResponse.json(
      { success: false, error: { code: 'CONFLICT', message: 'Payout is no longer pending approval' } }, { status: 409 }
    );
    console.error('[Admin Payout Approve] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve payout' } },
      { status: 500 }
    );
  }
}
