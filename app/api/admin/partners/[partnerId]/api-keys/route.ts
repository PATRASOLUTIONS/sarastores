/**
 * Admin Partner API Keys Management
 * 
 * GET /api/admin/partners/[partnerId]/api-keys - List partner's API keys
 * POST /api/admin/partners/[partnerId]/api-keys - Generate new API key
 * DELETE /api/admin/partners/[partnerId]/api-keys - Revoke an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { getPartnerById } from '@/lib/partner/service';
import { listPartnerAPIKeys, generatePartnerAPIKey, revokeAPIKey, decryptAPIKey } from '@/lib/partner/api-keys';

/**
 * GET /api/admin/partners/[partnerId]/api-keys
 * List partner's API keys
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
    
    // Find partner
    const partner = await getPartnerById(partnerId);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    const apiKeys = await listPartnerAPIKeys(partner.id);
    
    // Decrypt the keys for admin viewing
    const keys = apiKeys.map(key => {
      let fullKey = key.prefix; // Default to prefix
      let hasFullKey = false;
      
      // Decrypt the full key if encryption data is available
      if (key.encryptedKey && key.encryptionIv) {
        try {
          const decrypted = decryptAPIKey(key.encryptedKey, key.encryptionIv);
          if (decrypted && decrypted.length > key.prefix.length) {
            fullKey = decrypted;
            hasFullKey = true;
          }
        } catch (error) {
          console.error('[Admin API Keys] Decryption error for key:', key.id, error);
        }
      }
      
      return {
        id: key.id,
        name: key.name,
        key: fullKey, // Return full decrypted key for admin
        prefix: key.prefix,
        environment: key.environment,
        status: key.status,
        permissions: key.permissions,
        allowedDomains: key.allowedDomains || [],
        allowedMethods: key.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        hasFullKey, // Indicate if full key is available
      };
    });
    
    return NextResponse.json({
      success: true,
      data: { apiKeys: keys },
    });
  } catch (error) {
    console.error('[Admin Partner API Keys] List error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list API keys' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners/[partnerId]/api-keys
 * Generate new API key for partner
 */
export async function POST(
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
    
    // Find partner
    const partner = await getPartnerById(partnerId);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    // Validate environment
    const environment = body.environment === 'live' ? 'live' : 'test';
    
    // Generate API key
    const result = await generatePartnerAPIKey(
      partner.id,
      body.name || `${environment} API Key`,
      environment,
      partner.tier
    );
    
    const apiKey = result.apiKey;
    
    return NextResponse.json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          key: result.key, // Only shown once
          name: apiKey.name,
          environment: apiKey.environment,
          permissions: apiKey.permissions,
          allowedDomains: apiKey.allowedDomains || [],
          allowedMethods: apiKey.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
        warning: 'Store this API key securely. It will only be shown once.',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Admin Partner API Keys] Create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate API key' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/partners/[partnerId]/api-keys
 * Revoke an API key
 */
export async function DELETE(
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
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');
    
    if (!keyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'keyId is required' } },
        { status: 400 }
      );
    }
    
    // Find partner
    const partner = await getPartnerById(partnerId);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    // Revoke API key
    const success = await revokeAPIKey(keyId);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: { code: 'REVOCATION_FAILED', message: 'Failed to revoke API key' } },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'API key revoked successfully',
        keyId,
      },
    });
  } catch (error) {
    console.error('[Admin Partner API Keys] Revoke error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke API key' } },
      { status: 500 }
    );
  }
}
