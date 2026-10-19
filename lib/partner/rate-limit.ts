/**
 * Partner Rate Limiting
 * 
 * Tier-based rate limiting for partner API endpoints
 */

import { NextResponse } from 'next/server';
import { PartnerTier, PARTNER_TIER_LIMITS } from './types';
import { rateLimitHit, rateLimitReset } from '@/lib/rate-limit-store';

export interface PartnerRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  dailyLimit: number;
  dailyRemaining: number;
  dailyReset: number;
}

const MINUTE_WINDOW = 60 * 1000;
const DAY_WINDOW = 24 * 60 * 60 * 1000;

/** Key shape is unchanged: the minute budget is per endpoint, the daily budget per key. */
const minuteKeyFor = (apiKeyId: string, endpoint?: string) =>
  `partner:${endpoint ? `${apiKeyId}:${endpoint}` : apiKeyId}`;
const dailyKeyFor = (apiKeyId: string) => `partner:${apiKeyId}:daily`;

/**
 * Check rate limit for a partner API request.
 *
 * Counters live in the shared store (`lib/rate-limit-store.ts`), not in module
 * memory. The previous Map reset on every cold start and was never shared
 * between warm instances, so the limit a partner actually hit was
 * `limit x instances` — no limit at all under real traffic. The store fails
 * closed, and `authenticatePartnerRequest` turns that into a 500 rather than
 * waving the request through.
 */
export async function checkPartnerRateLimit(
  apiKeyId: string,
  tier: PartnerTier,
  endpoint?: string
): Promise<PartnerRateLimitResult> {
  const limits = PARTNER_TIER_LIMITS[tier];
  const nowSeconds = Math.floor(Date.now() / 1000);

  const minute = await rateLimitHit(
    minuteKeyFor(apiKeyId, endpoint),
    limits.requestsPerMinute,
    MINUTE_WINDOW
  );
  const daily = await rateLimitHit(dailyKeyFor(apiKeyId), limits.requestsPerDay, DAY_WINDOW);

  const allowed = !minute.limited && !daily.limited;

  return {
    allowed,
    limit: limits.requestsPerMinute,
    remaining: minute.remaining,
    reset: nowSeconds + minute.resetSeconds,
    // The daily window is the one worth waiting on when both are blown.
    retryAfter: allowed ? undefined : daily.limited ? daily.resetSeconds : minute.resetSeconds,
    dailyLimit: limits.requestsPerDay,
    dailyRemaining: daily.remaining,
    dailyReset: nowSeconds + daily.resetSeconds,
  };
}

/**
 * Endpoint-specific rate limits
 */
export const ENDPOINT_RATE_LIMITS: Record<string, Record<PartnerTier, number>> = {
  'products': {
    starter: 30,
    growth: 100,
    professional: 300,
    enterprise: 1000,
  },
  'products/:id': {
    starter: 60,
    growth: 300,
    professional: 1000,
    enterprise: 5000,
  },
  'products/stock-check': {
    starter: 10,
    growth: 50,
    professional: 200,
    enterprise: 500,
  },
  'orders': {
    starter: 5,
    growth: 20,
    professional: 100,
    enterprise: 500,
  },
  'orders/:id': {
    starter: 30,
    growth: 100,
    professional: 300,
    enterprise: 1000,
  },
  'wallet/balance': {
    starter: 20,
    growth: 60,
    professional: 200,
    enterprise: 500,
  },
  'wallet/transactions': {
    starter: 20,
    growth: 60,
    professional: 200,
    enterprise: 500,
  },
  'wallet/payout': {
    starter: 2, // Per day
    growth: 5,
    professional: 10,
    enterprise: -1, // Unlimited
  },
};

/**
 * Get rate limit for a specific endpoint
 */
export function getEndpointRateLimit(endpoint: string, tier: PartnerTier): number {
  // Normalize endpoint
  const normalizedEndpoint = endpoint
    .replace(/\/[a-f0-9]{24}/gi, '/:id')
    .replace(/^\/api\/v1\/partner\//, '')
    .replace(/\/$/, '');
  
  const limits = ENDPOINT_RATE_LIMITS[normalizedEndpoint];
  if (limits) {
    return limits[tier];
  }
  
  // Default to tier's general limit
  return PARTNER_TIER_LIMITS[tier].requestsPerMinute;
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: PartnerRateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    'X-RateLimit-Daily-Limit': result.dailyLimit.toString(),
    'X-RateLimit-Daily-Remaining': result.dailyRemaining.toString(),
    'X-RateLimit-Daily-Reset': result.dailyReset.toString(),
  };
  
  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  return headers;
}

/**
 * Rate limit middleware response
 */
export function rateLimitExceededResponse(result: PartnerRateLimitResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      },
      meta: {
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      },
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result),
    }
  );
}

/**
 * Reset rate limit for a specific key (for testing).
 *
 * A shared store cannot be scanned by prefix the way the old Map could, so the
 * endpoint a counter was recorded against has to be named explicitly. Callers
 * that pass none clear the daily budget and the un-scoped minute budget.
 */
export async function resetPartnerRateLimit(
  apiKeyId: string,
  endpoints: string[] = []
): Promise<void> {
  const keys = [
    dailyKeyFor(apiKeyId),
    minuteKeyFor(apiKeyId),
    ...endpoints.map((endpoint) => minuteKeyFor(apiKeyId, endpoint)),
  ];
  await Promise.all(keys.map((key) => rateLimitReset(key)));
}
