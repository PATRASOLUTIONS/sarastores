/**
 * Admin Partners List API
 * 
 * GET /api/admin/partners - List all partners with filters
 * POST /api/admin/partners - Create a new partner (admin-initiated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuthorization } from '@/lib/auth';
import { listPartners, createPartner } from '@/lib/partner/service';
import { PartnerListQuerySchema, CreateAdminPartnerSchema } from '@/lib/validation';

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
    
    const parsed = PartnerListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid partner filters' } }, { status: 400 }
    );
    const params = parsed.data;
    
    const result = await listPartners(params);
    
    // Transform partners for response
    const partners = result.partners.map((partner) => ({
      id: partner.id,
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
    const parsed = CreateAdminPartnerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid partner details', details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    
    // Create partner
    const result = await createPartner(parsed.data);
    
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
  } catch (error) {
    console.error('[Admin Partners] Create error:', error);
    const duplicate = error instanceof Error && error.message.includes('already exists');
    return NextResponse.json(
      { success: false, error: { code: duplicate ? 'DUPLICATE_EMAIL' : 'CREATION_FAILED', message: duplicate ? 'A partner with this email already exists' : 'Failed to create partner' } },
      { status: duplicate ? 409 : 500 }
    );
  }
}
