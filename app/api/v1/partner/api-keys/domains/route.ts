/**
 * Partner API Key Domains Management
 * 
 * GET /api/v1/partner/api-keys/domains - Get whitelisted domains for current API key
 * PUT /api/v1/partner/api-keys/domains - Update whitelisted domains for current API key
 */

import { NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest, getCorsHeaders, handleOptionsRequest } from '@/lib/partner/auth';
import { getCollection } from '@/lib/db-service';

const API_KEYS_COLLECTION = 'partner_api_keys';

/**
 * GET /api/v1/partner/api-keys/domains
 * Returns the list of whitelisted domains for the current API key
 */
async function handleGet(request: PartnerAuthRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const context = {
      apiKey: request.apiKey,
      partner: request.partner,
      requestId: request.requestId,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          apiKeyId: context.apiKey.id,
          apiKeyName: context.apiKey.name,
          allowedDomains: context.apiKey.allowedDomains || [],
          allowedMethods: context.apiKey.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          domainRestrictionEnabled: (context.apiKey.allowedDomains?.length || 0) > 0,
        },
        requestId: context.requestId,
      },
      { headers: getCorsHeaders(origin, context.apiKey.allowedMethods) }
    );
  } catch (error) {
    console.error('[Partner API] Get domains error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch whitelisted domains',
        },
      },
      { status: 500, headers: getCorsHeaders(origin, request.apiKey.allowedMethods) }
    );
  }
}

/**
 * PUT /api/v1/partner/api-keys/domains
 * Updates the list of whitelisted domains for the current API key
 */
async function handlePut(request: PartnerAuthRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const context = {
      apiKey: request.apiKey,
      partner: request.partner,
      requestId: request.requestId,
    };

    const body = await request.json();
    const { domains, methods } = body;

    // Validate domains array if provided
    if (domains !== undefined && !Array.isArray(domains)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'domains must be an array of strings',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate methods array if provided
    if (methods !== undefined && !Array.isArray(methods)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'methods must be an array of strings',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const validatedDomains: string[] = [];
    if (domains) {
      // Validate each domain format
      const domainPattern = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      const localhostPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/;
      const fullUrlPattern = /^https?:\/\/([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?$/;

      for (const domain of domains) {
        if (typeof domain !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Each domain must be a string',
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }

        const trimmedDomain = domain.trim().toLowerCase();
        
        if (trimmedDomain === '') continue; // Skip empty strings
        
        // Allow wildcard, localhost, or valid domain patterns
        if (
          trimmedDomain === '*' ||
          domainPattern.test(trimmedDomain) ||
          localhostPattern.test(trimmedDomain) ||
          fullUrlPattern.test(trimmedDomain)
        ) {
          validatedDomains.push(trimmedDomain);
        } else {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `Invalid domain format: ${domain}. Use formats like "example.com", "*.example.com", "https://example.com", or "localhost:3000"`,
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }
      }
    }

    // Validate methods
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    const validatedMethods: string[] = [];
    if (methods) {
      for (const method of methods) {
        if (typeof method !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Each method must be a string',
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }
        const upperMethod = method.toUpperCase();
        if (validMethods.includes(upperMethod)) {
          if (!validatedMethods.includes(upperMethod)) {
            validatedMethods.push(upperMethod);
          }
        } else {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `Invalid HTTP method: ${method}. Allowed: ${validMethods.join(', ')}`,
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }
      }
    }

    // Limit number of domains
    if (validatedDomains.length > 20) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Maximum 20 domains allowed per API key',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Update the API key in database
    const collection = await getCollection(API_KEYS_COLLECTION);
    
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (domains !== undefined) {
      updateData.allowedDomains = validatedDomains;
    }
    
    if (methods !== undefined) {
      updateData.allowedMethods = validatedMethods;
    }
    
    const result = await collection.updateOne(
      { id: context.apiKey.id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'API key not found',
          },
        },
        { status: 404, headers: getCorsHeaders(origin, context.apiKey.allowedMethods) }
      );
    }

    console.log(`[Partner API] Updated domains/methods for API key ${context.apiKey.id}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          apiKeyId: context.apiKey.id,
          allowedDomains: domains !== undefined ? validatedDomains : (context.apiKey.allowedDomains || []),
          allowedMethods: methods !== undefined ? validatedMethods : (context.apiKey.allowedMethods || validMethods),
          domainRestrictionEnabled: (domains !== undefined ? validatedDomains : (context.apiKey.allowedDomains || [])).length > 0,
        },
        requestId: context.requestId,
      },
      { headers: getCorsHeaders(origin, methods !== undefined ? validatedMethods : context.apiKey.allowedMethods) }
    );
  } catch (error) {
    console.error('[Partner API] Update domains error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update whitelisted domains',
        },
      },
      { status: 500, headers: getCorsHeaders(origin, request.apiKey.allowedMethods) }
    );
  }
}

export const GET = withPartnerAuth(handleGet);
export const PUT = withPartnerAuth(handlePut);

// Handle CORS preflight
export const OPTIONS = handleOptionsRequest;
