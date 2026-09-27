/**
 * Partner Authentication Middleware
 * 
 * Validates API keys and enforces rate limits for partner API requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { validateAPIKey, hasPermission } from './api-keys';

/**
 * Get allowed origins from environment variable
 * Format: comma-separated list of domains
 * Example: PARTNER_ALLOWED_ORIGINS=https://partner1.com,https://partner2.com,*.mypartner.com
 */
function getAllowedOrigins(): string[] {
  const defaultOrigins = [
    'https://sarastores.com',
    'https://www.sarastores.com',
    'https://saramobiles.com',
    'https://www.saramobiles.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  // Add origins from environment variable
  const envOrigins = process.env.PARTNER_ALLOWED_ORIGINS;
  if (envOrigins) {
    const additionalOrigins = envOrigins.split(',').map(o => o.trim()).filter(Boolean);
    return [...defaultOrigins, ...additionalOrigins];
  }

  return defaultOrigins;
}

/**
 * Allowed origins for CORS (loaded from env + defaults)
 */
const ALLOWED_ORIGINS = getAllowedOrigins();

/**
 * Get CORS headers for partner API responses
 */
export function getCorsHeaders(origin?: string | null, allowedMethods?: string[]): Record<string, string> {
  // Allow specific origins or fallback to * for API access
  let allowedOrigin = '*';
  
  if (origin) {
    // Check if the origin is in the allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else {
      // Check for wildcard subdomain matches (e.g., *.example.com)
      const isWildcardMatch = ALLOWED_ORIGINS.some(allowed => {
        if (allowed.startsWith('*.')) {
          const baseDomain = allowed.slice(2);
          const originHost = origin.replace(/^https?:\/\//, '').split(':')[0];
          return originHost === baseDomain || originHost.endsWith('.' + baseDomain);
        }
        return false;
      });
      
      if (isWildcardMatch) {
        allowedOrigin = origin;
      } else {
        // Allow any origin for API key authenticated requests
        allowedOrigin = origin;
      }
    }
  }

  const methods = allowedMethods && allowedMethods.length > 0 
    ? allowedMethods.join(', ') 
    : 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Request-ID, X-Partner-ID, User-Agent',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours cache for preflight
    'Access-Control-Expose-Headers': 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export async function handleOptionsRequest(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const xApiKey = request.headers.get('X-API-Key');
  const authHeader = request.headers.get('Authorization');
  
  let apiKey = xApiKey;
  if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  }
  
  let allowedMethods: string[] | undefined = undefined;
  
  if (apiKey) {
    try {
      const collection = await getCollection(API_KEYS_COLLECTION);
      const keyData = await collection.findOne({ 
        $or: [
          { id: apiKey },
          { hashedKey: createHash('sha256').update(apiKey).digest('hex') }
        ]
      });
      
      if (keyData && keyData.allowedMethods) {
        allowedMethods = keyData.allowedMethods;
      }
    } catch (error) {
      console.error('[CORS] Error fetching API key for OPTIONS:', error);
    }
  }

  const corsHeaders = getCorsHeaders(origin, allowedMethods);
  
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Create a CORS-enabled OPTIONS handler for partner routes
 */
export const OPTIONS = handleOptionsRequest;
import { 
  checkPartnerRateLimit, 
  createRateLimitHeaders, 
  rateLimitExceededResponse 
} from './rate-limit';
import { PartnerAPIKey, Partner, PARTNER_ERROR_CODES } from './types';
import { getCollection } from '@/lib/db-service';

const PARTNERS_COLLECTION = 'partners';
const API_KEYS_COLLECTION = 'partner_api_keys';

export interface PartnerAuthContext {
  apiKey: PartnerAPIKey;
  partner: Partner;
  requestId: string;
}

/**
 * Check if the request origin is allowed for this API key
 */
function isOriginAllowed(apiKey: PartnerAPIKey, origin: string | null): boolean {
  // If no domain restrictions are set, allow all origins
  if (!apiKey.allowedDomains || apiKey.allowedDomains.length === 0) {
    return true;
  }

  // If no origin header (e.g., server-to-server request), allow it
  if (!origin) {
    return true;
  }

  // Normalize the origin
  const normalizedOrigin = origin.toLowerCase();

  for (const domain of apiKey.allowedDomains) {
    const normalizedDomain = domain.toLowerCase();

    // Wildcard allows all
    if (normalizedDomain === '*') {
      return true;
    }

    // Check for localhost patterns
    if (normalizedDomain.includes('localhost') || normalizedDomain.includes('127.0.0.1')) {
      if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
        // Match localhost with optional port
        const domainPort = normalizedDomain.match(/:(\d+)/)?.[1];
        const originPort = normalizedOrigin.match(/:(\d+)/)?.[1];
        if (!domainPort || domainPort === originPort) {
          return true;
        }
      }
      continue;
    }

    // Extract hostname from origin (remove protocol)
    const originHost = normalizedOrigin.replace(/^https?:\/\//, '').split(':')[0];

    // Wildcard subdomain match (e.g., *.example.com)
    if (normalizedDomain.startsWith('*.')) {
      const baseDomain = normalizedDomain.slice(2);
      if (originHost === baseDomain || originHost.endsWith('.' + baseDomain)) {
        return true;
      }
      continue;
    }

    // Exact domain match (with or without protocol)
    const domainHost = normalizedDomain.replace(/^https?:\/\//, '').split(':')[0];
    if (originHost === domainHost) {
      return true;
    }

    // Full URL match
    if (normalizedOrigin === normalizedDomain || normalizedOrigin === `https://${normalizedDomain}` || normalizedOrigin === `http://${normalizedDomain}`) {
      return true;
    }
  }

  return false;
}

/**
 * Authenticate a partner API request
 */
export async function authenticatePartnerRequest(
  request: NextRequest
): Promise<{ context: PartnerAuthContext } | { error: NextResponse }> {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return {
        error: createErrorResponse(
          'AUTHENTICATION_REQUIRED',
          'Authorization header is required',
          requestId
        ),
      };
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return {
        error: createErrorResponse(
          'AUTHENTICATION_REQUIRED',
          'Authorization header must use Bearer scheme',
          requestId
        ),
      };
    }
    
    const apiKeyString = authHeader.slice(7);
    
    // Validate API key
    const apiKey = await validateAPIKey(apiKeyString);
    
    if (!apiKey) {
      return {
        error: createErrorResponse(
          'INVALID_API_KEY',
          'Invalid or expired API key',
          requestId
        ),
      };
    }

    // Check if origin is allowed for this API key
    const origin = request.headers.get('origin');
    if (!isOriginAllowed(apiKey, origin)) {
      console.warn(`[Partner Auth] Origin ${origin} not allowed for API key ${apiKey.prefix}`);
      return {
        error: createErrorResponse(
          'ORIGIN_NOT_ALLOWED',
          `Origin "${origin}" is not whitelisted for this API key. Add it to your allowed domains.`,
          requestId,
          403
        ),
      };
    }
    
    // Get partner
    const partner = await getPartnerById(apiKey.partnerId);
    
    if (!partner) {
      return {
        error: createErrorResponse(
          'INVALID_API_KEY',
          'Partner not found',
          requestId
        ),
      };
    }
    
    // Check partner status
    if (partner.status !== 'active') {
      return {
        error: createErrorResponse(
          'PARTNER_SUSPENDED',
          `Partner account is ${partner.status}`,
          requestId,
          403
        ),
      };
    }
    
    // Check rate limit
    const endpoint = new URL(request.url).pathname;
    const rateLimitResult = checkPartnerRateLimit(apiKey.id, apiKey.tier, endpoint);
    
    if (!rateLimitResult.allowed) {
      return {
        error: rateLimitExceededResponse(rateLimitResult),
      };
    }
    
    // Update partner's last active timestamp
    await updatePartnerLastActive(partner.id);
    
    return {
      context: {
        apiKey,
        partner,
        requestId,
      },
    };
  } catch (error) {
    console.error('[Partner Auth] Error:', error);
    return {
      error: createErrorResponse(
        'INTERNAL_ERROR',
        'Authentication failed',
        requestId,
        500
      ),
    };
  }
}

/**
 * Check if the partner has permission for a specific action
 */
export function checkPartnerPermission(
  context: PartnerAuthContext,
  resource: string,
  action: string
): boolean {
  // Safety check: ensure context and apiKey exist
  if (!context) {
    console.error('[Partner API] Context is null or undefined');
    return false;
  }
  
  if (!context.apiKey) {
    console.error('[Partner API] API key is missing from context. Partner:', context.partner?.id);
    return false;
  }
  
  return hasPermission(context.apiKey, resource, action);
}

/**
 * Create permission denied response
 */
export function permissionDeniedResponse(
  requestId: string,
  resource: string,
  action: string
): NextResponse {
  return createErrorResponse(
    'FORBIDDEN',
    `Permission denied: ${action} on ${resource}`,
    requestId,
    403
  );
}

/**
 * Create standardized error response with CORS headers
 */
export function createErrorResponse(
  code: keyof typeof PARTNER_ERROR_CODES | string,
  message?: string,
  requestId?: string,
  status?: number,
  origin?: string | null
): NextResponse {
  const errorDef = PARTNER_ERROR_CODES[code as keyof typeof PARTNER_ERROR_CODES];
  const corsHeaders = getCorsHeaders(origin);
  
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message: message || errorDef?.message || 'An error occurred',
      },
      meta: {
        requestId: requestId || randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    { 
      status: status || errorDef?.status || 400,
      headers: corsHeaders,
    }
  );
}

/**
 * Create standardized success response with CORS headers
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  additionalHeaders?: Record<string, string>,
  origin?: string | null
): NextResponse {
  const corsHeaders = getCorsHeaders(origin);
  const headers: Record<string, string> = {
    'X-Request-Id': requestId,
    'X-Response-Time': `${Date.now()}ms`,
    ...corsHeaders,
    ...(additionalHeaders || {}),
  };
  
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    { headers }
  );
}

/**
 * Create paginated success response with CORS headers
 */
export function createPaginatedResponse<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
  requestId: string,
  additionalData?: Record<string, any>,
  origin?: string | null
): NextResponse {
  const totalPages = Math.ceil(total / limit);
  const corsHeaders = getCorsHeaders(origin);
  
  return NextResponse.json(
    {
      success: true,
      data: {
        ...additionalData,
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    {
      headers: {
        'X-Request-Id': requestId,
        ...corsHeaders,
      },
    }
  );
}

/**
 * Extended request type with partner and API key attached
 */
export interface PartnerAuthRequest extends NextRequest {
  partner: Partner;
  apiKey: PartnerAPIKey;
  requestId: string;
}

/**
 * Wrapper for partner API handlers with optional permission checking and CORS support
 */
export function withPartnerAuth(
  handler: (
    request: PartnerAuthRequest,
    ...args: any[]
  ) => Promise<NextResponse>,
  requiredPermissions?: string[]
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    
    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptionsRequest(request);
    }
    
    const authResult = await authenticatePartnerRequest(request);
    
    // Get updated CORS headers with methods from API key if available
    const apiKeyMethods = 'apiKey' in authResult ? (authResult as any).context?.apiKey?.allowedMethods : undefined;
    const finalCorsHeaders = getCorsHeaders(origin, apiKeyMethods);
    
    if ('error' in authResult) {
      // Add CORS headers to error responses
      const errorResponse = authResult.error;
      Object.entries(finalCorsHeaders).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }
    
    // Check required permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      for (const perm of requiredPermissions) {
        const [resource, action] = perm.split(':');
        if (!checkPartnerPermission(authResult.context, resource, action)) {
          const response = permissionDeniedResponse(authResult.context.requestId, resource, action);
          Object.entries(finalCorsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
          return response;
        }
      }
    }
    
    try {
      // Create extended request with partner info
      const extendedRequest = Object.assign(request, {
        partner: authResult.context.partner,
        apiKey: authResult.context.apiKey,
        requestId: authResult.context.requestId,
      }) as PartnerAuthRequest;
      
      const response = await handler(extendedRequest, ...args);
      
      // Add security headers and CORS headers
      response.headers.set('X-Request-Id', authResult.context.requestId);
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-Frame-Options', 'DENY');
      
      // Add CORS headers to successful responses
      Object.entries(finalCorsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      console.error('[Partner API] Handler error:', error);
      return createErrorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        authResult.context.requestId,
        500,
        origin
      );
    }
  };
}

/**
 * Get partner by ID
 */
async function getPartnerById(partnerId: string): Promise<Partner | null> {
  try {
    const collection = await getCollection(PARTNERS_COLLECTION);
    const { ObjectId } = await import('mongodb');
    
    let partner = null;
    
    // Try ObjectId lookup first
    try {
      partner = await collection.findOne({ _id: new ObjectId(partnerId) });
    } catch (e) {
      // Try string id
      partner = await collection.findOne({ id: partnerId });
    }
    
    if (!partner) {
      return null;
    }
    
    return {
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      website: partner.website,
      businessDetails: partner.businessDetails,
      tier: partner.tier,
      status: partner.status,
      permissions: partner.permissions,
      walletId: partner.walletId,
      commissionRate: partner.commissionRate,
      createdAt: new Date(partner.createdAt),
      updatedAt: new Date(partner.updatedAt),
      lastActiveAt: new Date(partner.lastActiveAt),
      verified: partner.verified,
      verifiedAt: partner.verifiedAt ? new Date(partner.verifiedAt) : undefined,
      verifiedBy: partner.verifiedBy,
      documents: partner.documents || [],
    };
  } catch (error) {
    console.error('[Partner Auth] Error fetching partner:', error);
    return null;
  }
}

/**
 * Update partner's last active timestamp
 */
async function updatePartnerLastActive(partnerId: string): Promise<void> {
  try {
    const collection = await getCollection(PARTNERS_COLLECTION);
    const { ObjectId } = await import('mongodb');
    
    await collection.updateOne(
      { _id: new ObjectId(partnerId) },
      { $set: { lastActiveAt: new Date() } }
    );
  } catch (error) {
    // Non-critical, just log
    console.error('[Partner Auth] Error updating last active:', error);
  }
}

/**
 * Export partner service for use in routes
 */
export const partnerService = {
  getById: getPartnerById,
  updateLastActive: updatePartnerLastActive,
};
