/**
 * Partner Registration API
 * 
 * POST /api/v1/partner/register - Register a new partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { partnerService } from '@/lib/partner/service';
import { RegisterPartnerSchema } from '@/lib/validation';
import { getCorsHeaders, handleOptionsRequest } from '@/lib/partner/auth';

// Export OPTIONS handler for CORS preflight
export const OPTIONS = handleOptionsRequest;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const parsed = RegisterPartnerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid partner details', details: parsed.error.flatten() } },
      { status: 400, headers: corsHeaders }
    );
    const { partner, apiKey } = await partnerService.createPartner(parsed.data);
    
    return NextResponse.json(
      {
        success: true,
        data: {
          partner: {
            id: partner.id,
            name: partner.name,
            email: partner.email,
            tier: partner.tier,
            status: partner.status,
            commissionRate: partner.commissionRate,
            createdAt: partner.createdAt,
          },
          apiKey: {
            key: apiKey,
            environment: 'test',
            note: 'This is your test API key. Store it securely - it will not be shown again. A live API key will be provided after account approval.',
          },
        },
        message: 'Partner registration successful. Your account is pending approval.',
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Partner Register] Error:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: error.message,
          },
        },
        { status: 409, headers: corsHeaders }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Registration failed. Please try again.',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
