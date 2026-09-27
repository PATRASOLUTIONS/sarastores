/**
 * Rate Limiting Utilities
 * 
 * In-memory rate limiting for API endpoints with sliding window algorithm.
 * For production with multiple instances, replace with Redis-based solution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitHit, rateLimitReset, rateLimitResetSeconds } from '@/lib/rate-limit-store';

// Types
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  message?: string;      // Custom error message
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Counting lives in lib/rate-limit-store (Upstash-backed when configured).
// The module-scoped Map that used to sit here reset on every cold start, and
// its cleanup setInterval kept a timer alive for the life of the instance.

// Default rate limit configurations
export const RATE_LIMITS = {
  // General API endpoints
  API: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 100,
    message: 'Too many requests, please try again later.',
  },
  
  // Authentication endpoints (login, register)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later.',
  },
  
  // Password reset
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many password reset attempts, please try again later.',
  },
  
  // Order creation
  ORDERS: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,
    message: 'Too many order requests, please try again later.',
  },
  
  // Search queries
  SEARCH: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 30,
    message: 'Too many search requests, please try again later.',
  },
  
  // Contact/feedback forms
  CONTACT: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: 'Too many submissions, please try again later.',
  },
  
  // Review submission
  REVIEWS: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 10,
    message: 'Review limit reached, please try again tomorrow.',
  },
  
  // OTP requests
  OTP: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 1,
    message: 'Please wait before requesting another OTP.',
  },
  
  // Strict limit for brute force protection
  STRICT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3,
    message: 'Access temporarily blocked due to suspicious activity.',
  },
} as const;

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Use first IP from x-forwarded-for if multiple
  const ip = cfConnectingIp || 
             realIp || 
             (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
             'unknown';
  
  return ip;
}

/**
 * Check rate limit for a request.
 *
 * Counting is delegated to lib/rate-limit-store, which uses Upstash when
 * configured. The previous module-scoped Map reset on every serverless cold
 * start, so the effective limit was `limit x instances` — no real protection.
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { windowMs, maxRequests, keyGenerator } = config;

  // Generate unique key for this client + endpoint
  const clientId = keyGenerator
    ? keyGenerator(request)
    : getClientIdentifier(request);
  const endpoint = new URL(request.url).pathname;
  const key = `ratelimit:${clientId}:${endpoint}`;

  const hit = await rateLimitHit(key, maxRequests, windowMs);

  return {
    success: !hit.limited,
    limit: maxRequests,
    remaining: hit.remaining,
    reset: Date.now() + hit.resetSeconds * 1000,
    retryAfter: hit.limited ? hit.resetSeconds : undefined,
  };
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  config: RateLimitConfig = RATE_LIMITS.API
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await checkRateLimit(request, config);
    
    // Add rate limit headers to all responses
    const rateLimitHeaders = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    };
    
    if (!result.success) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: config.message || 'Too many requests, please try again later.',
            retryAfter: result.retryAfter,
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...rateLimitHeaders,
            'Retry-After': result.retryAfter?.toString() || '60',
          },
        }
      );
    }
    
    // Execute handler
    const response = await handler(request);
    
    // Clone response to add headers
    const newResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
    // Add rate limit headers
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    
    return newResponse;
  };
}

/**
 * Rate limit by user ID (for authenticated endpoints)
 */
export async function rateLimitByUser(
  userId: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:user:${userId}:${endpoint}`;
  const hit = await rateLimitHit(key, config.maxRequests, config.windowMs);

  return {
    success: !hit.limited,
    limit: config.maxRequests,
    remaining: hit.remaining,
    reset: Date.now() + hit.resetSeconds * 1000,
    retryAfter: hit.limited ? hit.resetSeconds : undefined,
  };
}

/**
 * Reset rate limit for a specific key (e.g., after successful authentication)
 */
export async function resetRateLimit(clientId: string, endpoint: string): Promise<void> {
  await rateLimitReset(`ratelimit:${clientId}:${endpoint}`);
}

/**
 * Seconds until this client's window resets, without counting a request.
 */
export async function getRateLimitStatus(clientId: string, endpoint: string): Promise<number> {
  return rateLimitResetSeconds(`ratelimit:${clientId}:${endpoint}`);
}

/**
 * Create custom rate limiter with specific configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  return {
    check: (request: NextRequest) => checkRateLimit(request, config),
    wrap: (handler: (request: NextRequest) => Promise<NextResponse> | NextResponse) => 
      withRateLimit(handler, config),
  };
}

// Pre-configured rate limiters
export const rateLimiters = {
  api: createRateLimiter(RATE_LIMITS.API),
  auth: createRateLimiter(RATE_LIMITS.AUTH),
  passwordReset: createRateLimiter(RATE_LIMITS.PASSWORD_RESET),
  orders: createRateLimiter(RATE_LIMITS.ORDERS),
  search: createRateLimiter(RATE_LIMITS.SEARCH),
  contact: createRateLimiter(RATE_LIMITS.CONTACT),
  reviews: createRateLimiter(RATE_LIMITS.REVIEWS),
  otp: createRateLimiter(RATE_LIMITS.OTP),
  strict: createRateLimiter(RATE_LIMITS.STRICT),
};

export default {
  checkRateLimit,
  withRateLimit,
  rateLimitByUser,
  resetRateLimit,
  getRateLimitStatus,
  createRateLimiter,
  rateLimiters,
  RATE_LIMITS,
};
