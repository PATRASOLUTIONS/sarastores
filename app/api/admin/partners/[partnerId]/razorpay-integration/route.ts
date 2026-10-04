/**
 * Partner Razorpay Integration API
 * 
 * GET /api/admin/partners/[partnerId]/razorpay-integration - Get integration settings
 * PUT /api/admin/partners/[partnerId]/razorpay-integration - Update integration settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { getCollection } from '@/lib/db-service';
import { encrypt } from '@/lib/encryption';
import { ObjectId } from 'mongodb';

const PARTNERS_COLLECTION = 'partners';

interface RazorpayIntegration {
  enabled: boolean;
  paymentMode: 'wallet' | 'direct';
  commissionPercent: number;
  allowedDomains: string[];
  credentials: Partial<Record<'test' | 'live', {
    keyId?: string;
    keySecretEnc?: string;
    keySecretIv?: string;
    keySecretTag?: string;
  }>>;
  defaultEnvironment: 'test' | 'live';
  webhookSecret?: string;
  razorpayAccountId?: string;
  razorpayAccountStatus?: 'pending' | 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * GET /api/admin/partners/[partnerId]/razorpay-integration
 * Get Razorpay integration settings for a partner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId } = await params;
    const collection = await getCollection(PARTNERS_COLLECTION);

    const partner = await collection.findOne({ 
      $or: [
        { _id: new ObjectId(partnerId) },
        { id: partnerId }
      ]
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }

    // Clone and redact any encrypted secrets before returning to client
    const rawIntegration: any = partner.razorpayIntegration || {
      enabled: false,
      paymentMode: 'wallet',
      commissionPercent: 0,
      allowedDomains: [],
    };

    const razorpayIntegration: any = JSON.parse(JSON.stringify(rawIntegration))
    if (razorpayIntegration.credentials) {
      for (const env of ['test', 'live']) {
        if (razorpayIntegration.credentials[env]) {
          // Do not expose encrypted blobs to the client; expose only keyId and presence flag
          const keep = { keyId: razorpayIntegration.credentials[env].keyId }
          razorpayIntegration.credentials[env] = keep
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        razorpayIntegration,
      },
    });
  } catch (error) {
    console.error('[Razorpay Integration GET] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch integration settings' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/partners/[partnerId]/razorpay-integration
 * Update Razorpay integration settings for a partner
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId } = await params;
    const body = await request.json();
    const collection = await getCollection(PARTNERS_COLLECTION);

    // Validate required fields
    const {
      enabled,
      paymentMode,
      commissionPercent,
      allowedDomains,
      razorpayAccountId,
    } = body;

    // Validate paymentMode
    if (paymentMode && !['wallet', 'direct'].includes(paymentMode)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid payment mode' } },
        { status: 400 }
      );
    }

    // Validate commission percentage
    if (commissionPercent !== undefined && (commissionPercent < 0 || commissionPercent > 100)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Commission must be between 0 and 100' } },
        { status: 400 }
      );
    }

    // Validate domains format
    if (allowedDomains && Array.isArray(allowedDomains)) {
      const domainPattern = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      const localhostPattern = /^localhost(:\d+)?$/;
      
      for (const domain of allowedDomains) {
        if (domain !== '*' && !domainPattern.test(domain) && !localhostPattern.test(domain)) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_INPUT', message: `Invalid domain format: ${domain}` } },
            { status: 400 }
          );
        }
      }
    }

    // Get existing partner to check if it exists and get current settings
    const partner = await collection.findOne({ 
      $or: [
        { _id: new ObjectId(partnerId) },
        { id: partnerId }
      ]
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }

    // Build update object
    const existingIntegration = partner.razorpayIntegration || {};
    const updatedIntegration: RazorpayIntegration = {
      enabled: enabled !== undefined ? enabled : existingIntegration.enabled || false,
      paymentMode: paymentMode || existingIntegration.paymentMode || 'wallet',
      commissionPercent: commissionPercent !== undefined ? commissionPercent : existingIntegration.commissionPercent || 0,
      allowedDomains: allowedDomains || existingIntegration.allowedDomains || [],
      credentials: existingIntegration.credentials || {},
      defaultEnvironment: existingIntegration.defaultEnvironment || 'test',
      webhookSecret: existingIntegration.webhookSecret,
      razorpayAccountId: razorpayAccountId !== undefined ? razorpayAccountId : existingIntegration.razorpayAccountId,
      razorpayAccountStatus: existingIntegration.razorpayAccountStatus || 'pending',
      createdAt: existingIntegration.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Generate webhook secret if enabling for the first time
    if (updatedIntegration.enabled && !updatedIntegration.webhookSecret) {
      const crypto = require('crypto');
      updatedIntegration.webhookSecret = crypto.randomBytes(32).toString('hex');
    }

    // If credentials provided in body, encrypt secrets before storing
    // Expected body.credentials = { test?: { keyId, keySecret }, live?: { keyId, keySecret } }
    if (body.credentials && typeof body.credentials === 'object') {
      const newCreds: any = { ...(updatedIntegration.credentials || {}) };
      for (const env of ['test', 'live'] as const) {
        const envCred = (body.credentials as any)[env];
        if (!envCred) continue;
        const keyIdVal = envCred.keyId && String(envCred.keyId).trim()
        const keySecretVal = envCred.keySecret && String(envCred.keySecret).trim()
        if (keyIdVal) {
          newCreds[env] = newCreds[env] || {}
          newCreds[env].keyId = keyIdVal
        }
        if (keySecretVal) {
          // encrypt secret
          try {
            const encrypted = encrypt(keySecretVal)
            newCreds[env] = newCreds[env] || {}
            newCreds[env].keySecretEnc = encrypted.ciphertext
            newCreds[env].keySecretIv = encrypted.iv
            newCreds[env].keySecretTag = encrypted.tag
          } catch (e) {
            console.error('[Razorpay Integration] encryption failed', e)
          }
        }
      }
      updatedIntegration.credentials = newCreds
    }

    // Update the partner document
    const result = await collection.updateOne(
      { 
        $or: [
          { _id: new ObjectId(partnerId) },
          { id: partnerId }
        ]
      },
      {
        $set: {
          razorpayIntegration: updatedIntegration,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update integration settings' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Razorpay integration settings updated successfully',
      data: {
        razorpayIntegration: updatedIntegration,
      },
    });
  } catch (error) {
    console.error('[Razorpay Integration PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update integration settings' } },
      { status: 500 }
    );
  }
}
