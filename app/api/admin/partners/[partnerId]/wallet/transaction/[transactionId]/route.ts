/**
 * Partner Wallet Transaction Delete API
 * 
 * DELETE - Remove a transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { getCollection } from '@/lib/db-service';
import { ObjectId } from 'mongodb';

const WALLET_TRANSACTIONS_COLLECTION = 'partner_wallet_transactions';
const WALLETS_COLLECTION = 'partner_wallets';

/**
 * DELETE - Remove a transaction (test mode only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string; transactionId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId, transactionId } = await params;
    const transactionsCollection = await getCollection(WALLET_TRANSACTIONS_COLLECTION);
    const walletsCollection = await getCollection(WALLETS_COLLECTION);

    // Find the transaction
    const transaction = await transactionsCollection.findOne({
      $or: [
        { _id: new ObjectId(transactionId) },
        { id: transactionId }
      ]
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
        { status: 404 }
      );
    }

    // Only allow deleting test transactions
    if (transaction.environment !== 'test') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only test transactions can be deleted' } },
        { status: 403 }
      );
    }

    // Verify the transaction belongs to this partner
    if (transaction.partnerId !== partnerId && transaction.walletId) {
      const wallet = await walletsCollection.findOne({
        $or: [
          { _id: new ObjectId(transaction.walletId) },
          { id: transaction.walletId }
        ]
      });
      
      if (!wallet || wallet.partnerId !== partnerId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Transaction does not belong to this partner' } },
          { status: 403 }
        );
      }
    }

    // Calculate amount to reverse
    const amountToReverse = transaction.type === 'credit' || transaction.type === 'release' 
      ? -transaction.amount 
      : transaction.amount;

    // Update wallet balance (reverse the transaction)
    const wallet = await walletsCollection.findOne({
      $or: [
        { partnerId: partnerId },
        { id: transaction.walletId }
      ]
    });

    if (wallet) {
      await walletsCollection.updateOne(
        { _id: wallet._id },
        {
          $inc: {
            'balance.available': amountToReverse
          },
          $set: {
            updatedAt: new Date()
          }
        }
      );
    }

    // Delete the transaction
    const deleteResult = await transactionsCollection.deleteOne({
      $or: [
        { _id: new ObjectId(transactionId) },
        { id: transactionId }
      ]
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'DELETE_FAILED', message: 'Failed to delete transaction' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction removed successfully',
      data: {
        transactionId,
        amountReversed: amountToReverse
      }
    });
  } catch (error) {
    console.error('[Transaction DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete transaction' } },
      { status: 500 }
    );
  }
}
