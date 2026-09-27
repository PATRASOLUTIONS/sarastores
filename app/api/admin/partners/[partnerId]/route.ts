/**
 * Admin Partner Details API
 * 
 * GET /api/admin/partners/[partnerId] - Get partner details
 * PUT /api/admin/partners/[partnerId] - Update partner details
 * DELETE /api/admin/partners/[partnerId] - Suspend/Delete partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { 
  getPartnerById, 
  updatePartnerStatus, 
  updatePartnerTier,
  updatePartner
} from '@/lib/partner/service';
import { getWalletByPartnerId } from '@/lib/partner/wallet';
import { listPartnerAPIKeys } from '@/lib/partner/api-keys';
import { getCollection } from '@/lib/db-service';

/**
 * GET /api/admin/partners/[partnerId]
 * Get partner details with full information
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
    
    const partner = await getPartnerById(partnerId);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    // Fetch additional data
    const [wallet, apiKeys] = await Promise.all([
      getWalletByPartnerId(partner.id),
      listPartnerAPIKeys(partner.id),
    ]);
    
    const responseData = {
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        website: partner.website,
        // Keep flat structure for backward compatibility
        gstin: partner.businessDetails?.gstin,
        pan: partner.businessDetails?.pan,
        businessType: partner.businessDetails?.businessType,
        address: partner.businessDetails?.registeredAddress,
        // Include nested objects for edit page
        businessDetails: partner.businessDetails,
        contactPerson: partner.contactPerson,
        status: partner.status,
        tier: partner.tier,
        commissionRate: partner.commissionRate,
        permissions: partner.permissions,
        documents: partner.documents,
        razorpayIntegration: partner.razorpayIntegration || null,
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt,
        lastActiveAt: partner.lastActiveAt,
        verified: partner.verified,
        verifiedAt: partner.verifiedAt,
      },
      wallet: wallet ? {
        balance: wallet.balance?.available || 0,
        pending: wallet.balance?.pending || 0,
        held: wallet.balance?.held || 0,
        bankAccountsCount: wallet.bankAccounts?.length || 0,
      } : null,
      apiKeys: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        environment: key.environment,
        status: key.status,
        permissions: key.permissions,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      })),
    };
    
    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Admin Partner Details] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get partner details' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/partners/[partnerId]
 * Update partner details
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
    
    // Find partner
    const partner = await getPartnerById(partnerId);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    // Handle status update
    if (body.status && body.status !== partner.status) {
      const result = await updatePartnerStatus(partner.id, body.status);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update status' } },
          { status: 400 }
        );
      }
    }
    
    // Handle tier update
    if (body.tier && body.tier !== partner.tier) {
      const result = await updatePartnerTier(partner.id, body.tier);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update tier' } },
          { status: 400 }
        );
      }
    }
    
    // Update other fields
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.website !== undefined) updates.website = body.website;
    
    if (Object.keys(updates).length > 0) {
      await updatePartner(partner.id, updates);
    }
    
    // Fetch updated partner
    const updatedPartner = await getPartnerById(partnerId);
    
    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: updatedPartner?.id,
          name: updatedPartner?.name,
          status: updatedPartner?.status,
          tier: updatedPartner?.tier,
          commissionRate: updatedPartner?.commissionRate,
          updatedAt: updatedPartner?.updatedAt,
        },
        message: 'Partner updated successfully',
      },
    });
  } catch (error) {
    console.error('[Admin Partner Update] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update partner' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/partners/[partnerId]
 * Partial update partner details (status, tier, etc.)
 */
export async function PATCH(
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
    
    // Handle status update
    if (body.status && body.status !== partner.status) {
      const validStatuses = ['pending', 'active', 'suspended', 'terminated'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
          { status: 400 }
        );
      }
      const result = await updatePartnerStatus(partner.id, body.status);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update status' } },
          { status: 400 }
        );
      }
    }
    
    // Handle tier update
    if (body.tier && body.tier !== partner.tier) {
      const validTiers = ['starter', 'growth', 'professional', 'enterprise'];
      if (!validTiers.includes(body.tier)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid tier. Must be one of: ${validTiers.join(', ')}` } },
          { status: 400 }
        );
      }
      const result = await updatePartnerTier(partner.id, body.tier);
      if (!result) {
        return NextResponse.json(
          { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update tier' } },
          { status: 400 }
        );
      }
    }
    
    // Build updates object for other fields
    const updates: any = {};
    
    // Basic fields
    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.website !== undefined) updates.website = body.website;
    if (body.commissionRate !== undefined) updates.commissionRate = body.commissionRate;
    
    // Business details
    if (body.businessDetails || body.gstin || body.pan || body.businessType || body.registeredAddress) {
      updates.businessDetails = {
        ...partner.businessDetails,
        gstin: body.businessDetails?.gstin || body.gstin || partner.businessDetails?.gstin,
        pan: body.businessDetails?.pan || body.pan || partner.businessDetails?.pan,
        businessType: body.businessDetails?.businessType || body.businessType || partner.businessDetails?.businessType,
        registeredAddress: body.businessDetails?.registeredAddress || body.registeredAddress || partner.businessDetails?.registeredAddress,
      };
    }
    
    // Contact person
    if (body.contactPerson) {
      updates.contactPerson = {
        ...partner.contactPerson,
        ...body.contactPerson,
      };
    }
    
    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await updatePartner(partner.id, updates);
    }
    
    // Fetch updated partner
    const updatedPartner = await getPartnerById(partnerId);
    
    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: updatedPartner?.id,
          name: updatedPartner?.name,
          status: updatedPartner?.status,
          tier: updatedPartner?.tier,
          commissionRate: updatedPartner?.commissionRate,
          businessDetails: updatedPartner?.businessDetails,
          contactPerson: updatedPartner?.contactPerson,
          updatedAt: updatedPartner?.updatedAt,
        },
        message: 'Partner updated successfully',
      },
    });
  } catch (error: any) {
    console.error('[Admin Partner PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update partner' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/partners/[partnerId]
 * Suspend or delete partner
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
    const permanent = searchParams.get('permanent') === 'true';
    
    // Find partner
    const partner = await getPartnerById(partnerId);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }
    
    if (permanent) {
      // Terminate partner (soft delete)
      await updatePartnerStatus(partner.id, 'terminated');
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Partner terminated successfully',
          partnerId: partner.id,
        },
      });
    } else {
      // Suspend partner
      await updatePartnerStatus(partner.id, 'suspended');
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Partner suspended successfully',
          partnerId: partner.id,
        },
      });
    }
  } catch (error) {
    console.error('[Admin Partner Delete] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to suspend/terminate partner' } },
      { status: 500 }
    );
  }
}
