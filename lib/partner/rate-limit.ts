/**
 * Partner Rate Limiting
 * 
 * Tier-based rate limiting for partner API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { PartnerAPIKey, PartnerTier, PARTNER_TIER_LIMITS } from './types';

// In-memory store for rate limiting (use Redis in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
  dailyCount: number;
  dailyResetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.dailyResetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

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

/**
 * Check rate limit for a partner API request
 */
export function checkPartnerRateLimit(
  apiKeyId: string,
  tier: PartnerTier,
  endpoint?: string
): PartnerRateLimitResult {
  const limits = PARTNER_TIER_LIMITS[tier];
  const now = Date.now();
  
  // Create unique key including endpoint for more granular limiting
  const key = endpoint ? `${apiKeyId}:${endpoint}` : apiKeyId;
  const dailyKey = `${apiKeyId}:daily`;
  
  // Get or create minute entry
  let entry = rateLimitStore.get(key);
  const minuteWindow = 60 * 1000;
  const dayWindow = 24 * 60 * 60 * 1000;
  
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + minuteWindow,
      dailyCount: 0,
      dailyResetTime: now + dayWindow,
    };
  }
  
  // Get or create daily entry
  let dailyEntry = rateLimitStore.get(dailyKey);
  if (!dailyEntry || now > dailyEntry.dailyResetTime) {
    dailyEntry = {
      count: 0,
      resetTime: now + minuteWindow,
      dailyCount: 0,
      dailyResetTime: now + dayWindow,
    };
  }
  
  // Increment counters
  entry.count++;
  dailyEntry.dailyCount++;
  
  // Save entries
  rateLimitStore.set(key, entry);
  rateLimitStore.set(dailyKey, dailyEntry);
  
  // Check limits
  const minuteRemaining = Math.max(0, limits.requestsPerMinute - entry.count);
  const dailyRemaining = Math.max(0, limits.requestsPerDay - dailyEntry.dailyCount);
  
  const minuteExceeded = entry.count > limits.requestsPerMinute;
  const dailyExceeded = dailyEntry.dailyCount > limits.requestsPerDay;
  
  const allowed = !minuteExceeded && !dailyExceeded;
  
  let retryAfter: number | undefined;
  if (!allowed) {
    if (dailyExceeded) {
      retryAfter = Math.ceil((dailyEntry.dailyResetTime - now) / 1000);
    } else {
      retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    }
  }
  
  return {
    allowed,
    limit: limits.requestsPerMinute,
    remaining: minuteRemaining,
    reset: Math.ceil(entry.resetTime / 1000),
    retryAfter,
    dailyLimit: limits.requestsPerDay,
    dailyRemaining,
    dailyReset: Math.ceil(dailyEntry.dailyResetTime / 1000),
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
 * Reset rate limit for a specific key (for testing)
 */
export function resetPartnerRateLimit(apiKeyId: string): void {
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(apiKeyId)) {
      rateLimitStore.delete(key);
    }
  }
}
