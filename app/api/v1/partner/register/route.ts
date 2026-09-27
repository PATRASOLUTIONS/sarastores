/**
 * Partner Registration API
 * 
 * POST /api/v1/partner/register - Register a new partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { partnerService, CreatePartnerInput } from '@/lib/partner/service';
import { getCorsHeaders, handleOptionsRequest } from '@/lib/partner/auth';

// Export OPTIONS handler for CORS preflight
export const OPTIONS = handleOptionsRequest;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'businessDetails'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Missing required field: ${field}`,
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    
    // Validate business details
    const businessDetailsFields = ['gstin', 'pan', 'businessType', 'registeredAddress'];
    for (const field of businessDetailsFields) {
      if (!body.businessDetails[field]) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Missing required business detail: ${field}`,
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    
    // Validate address
    const addressFields = ['line1', 'city', 'state', 'pincode', 'country'];
    for (const field of addressFields) {
      if (!body.businessDetails.registeredAddress[field]) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Missing required address field: ${field}`,
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validate GSTIN format (15 characters)
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(body.businessDetails.gstin)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid GSTIN format',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validate PAN format (10 characters)
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(body.businessDetails.pan)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid PAN format',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Create partner
    const input: CreatePartnerInput = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      website: body.website,
      businessDetails: body.businessDetails,
      tier: body.tier, // Optional, defaults to 'starter'
    };
    
    const { partner, apiKey } = await partnerService.createPartner(input);
    
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
