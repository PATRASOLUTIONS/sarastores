/**
 * Partner Bank Accounts API
 * 
 * GET /api/v1/partner/wallet/bank-accounts - List bank accounts
 * POST /api/v1/partner/wallet/bank-accounts - Add bank account
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { getWalletByPartnerId, addBankAccount } from '@/lib/partner/wallet';

/**
 * GET /api/v1/partner/wallet/bank-accounts
 * List bank accounts
 */
async function handleGet(req: PartnerAuthRequest) {
  try {
    const wallet = await getWalletByPartnerId(req.partner.id);

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Transform bank accounts for response (mask account numbers)
    const bankAccounts = (wallet.bankAccounts || []).map(acc => ({
      id: acc.id,
      accountNumber: `XXXX${acc.accountNumber.slice(-4)}`,
      accountHolderName: acc.accountHolderName,
      bankName: acc.bankName,
      ifsc: acc.ifsc,
      isDefault: acc.isDefault,
      verified: acc.verified,
      createdAt: acc.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: { bankAccounts },
    });
  } catch (error) {
    console.error('[Partner Bank Accounts] List error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list bank accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/partner/wallet/bank-accounts
 * Add a new bank account
 */
async function handlePost(req: PartnerAuthRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const validationErrors: string[] = [];

    if (!body.accountNumber) {
      validationErrors.push('accountNumber is required');
    } else if (!/^\d{9,18}$/.test(body.accountNumber)) {
      validationErrors.push('accountNumber must be 9-18 digits');
    }

    if (!body.accountHolderName) {
      validationErrors.push('accountHolderName is required');
    }

    if (!body.ifsc && !body.ifscCode) {
      validationErrors.push('ifsc is required');
    } else {
      const ifscValue = body.ifsc || body.ifscCode;
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscValue.toUpperCase())) {
        validationErrors.push('Invalid IFSC code format');
      }
    }

    if (!body.bankName) {
      validationErrors.push('bankName is required');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: validationErrors.join('; ') },
        { status: 400 }
      );
    }

    // Add bank account
    const ifscValue = (body.ifsc || body.ifscCode).toUpperCase();
    const result = await addBankAccount(req.partner.id, {
      accountNumber: body.accountNumber,
      accountHolderName: body.accountHolderName,
      ifsc: ifscValue,
      bankName: body.bankName,
      isDefault: body.isDefault || false,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to add bank account' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bankAccount: {
          id: result.id,
          accountNumber: `XXXX${result.accountNumber.slice(-4)}`,
          accountHolderName: result.accountHolderName,
          bankName: result.bankName,
          ifsc: result.ifsc,
          isDefault: result.isDefault,
          verified: result.verified,
          createdAt: result.createdAt,
        },
        message: 'Bank account added successfully. Verification may take 1-2 business days.',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Partner Bank Accounts] Add error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add bank account' },
      { status: 500 }
    );
  }
}

// Export wrapped handlers
export const GET = withPartnerAuth(handleGet as any, ['wallet:read']);
export const POST = withPartnerAuth(handlePost as any, ['wallet:write']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
