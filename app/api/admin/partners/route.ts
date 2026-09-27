/**
 * Admin Partners List API
 * 
 * GET /api/admin/partners - List all partners with filters
 * POST /api/admin/partners - Create a new partner (admin-initiated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { listPartners, createPartner } from '@/lib/partner/service';
import { PartnerFilterParams } from '@/lib/partner/types';

/**
 * GET /api/admin/partners
 * List all partners with filters
 */
export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }
  
  try {
    const { searchParams } = new URL(request.url);
    
    const params: PartnerFilterParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      status: searchParams.get('status') as any || undefined,
      tier: searchParams.get('tier') as any || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
    };
    
    const result = await listPartners(params);
    
    // Transform partners for response
    const partners = result.partners.map((partner: any) => ({
      id: partner.id || partner._id?.toString(),
      companyName: partner.name,
      email: partner.email,
      phone: partner.phone,
      gstin: partner.businessDetails?.gstin,
      status: partner.status,
      tier: partner.tier,
      commissionRate: partner.commissionRate,
      createdAt: partner.createdAt,
      lastActiveAt: partner.lastActiveAt,
    }));
    
    const page = params.page || 1;
    const limit = params.limit || 20;
    
    return NextResponse.json({
      success: true,
      data: {
        partners,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Admin Partners] List error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list partners' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners
 * Create a new partner (admin-initiated)
 */
export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const validationErrors: string[] = [];
    
    if (!body.name && !body.companyName) validationErrors.push('name is required');
    if (!body.email) validationErrors.push('email is required');
    if (!body.phone) validationErrors.push('phone is required');
    
    if (!body.businessDetails) {
      validationErrors.push('businessDetails is required');
    } else {
      if (!body.businessDetails.gstin) validationErrors.push('businessDetails.gstin is required');
      if (!body.businessDetails.pan) validationErrors.push('businessDetails.pan is required');
      if (!body.businessDetails.registeredAddress) {
        validationErrors.push('businessDetails.registeredAddress is required');
      }
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validationErrors.join('; ') } },
        { status: 400 }
      );
    }
    
    // Create partner
    const result = await createPartner({
      name: body.name || body.companyName,
      email: body.email,
      phone: body.phone,
      website: body.website,
      businessDetails: body.businessDetails,
      contactPerson: body.contactPerson,
      tier: body.tier || 'starter',
      commissionRate: body.commissionRate,
    });
    
    const partner = result.partner;
    
    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          status: partner.status,
          tier: partner.tier,
          createdAt: partner.createdAt,
        },
        apiKey: {
          key: result.apiKey,
          environment: 'test',
          message: 'Store this API key securely. It will only be shown once.',
        },
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Partners] Create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'CREATION_FAILED', message: error.message || 'Failed to create partner' } },
      { status: 400 }
    );
  }
}
