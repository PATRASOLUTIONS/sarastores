/**
 * Caching Utilities
 * 
 * Multi-tier caching system with in-memory and optional Redis support
 * for optimal performance across the e-commerce platform.
 */

import { LRUCache } from 'lru-cache';

// Types
interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
}

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

// Default TTL values (in milliseconds)
export const CACHE_TTL = {
  SHORT: 60 * 1000,           // 1 minute
  MEDIUM: 5 * 60 * 1000,      // 5 minutes
  LONG: 30 * 60 * 1000,       // 30 minutes
  HOUR: 60 * 60 * 1000,       // 1 hour
  DAY: 24 * 60 * 60 * 1000,   // 24 hours
} as const;

// In-memory LRU cache for server-side caching
const memoryCache = new LRUCache<string, CacheEntry<unknown>>({
  max: 500,                    // Maximum items
  maxSize: 50 * 1024 * 1024,   // 50MB max size
  sizeCalculation: (value) => {
    return JSON.stringify(value).length;
  },
  ttl: CACHE_TTL.MEDIUM,
  allowStale: true,            // Return stale items while revalidating
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

/**
 * Generic cache wrapper for any async function
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = CACHE_TTL.MEDIUM, staleWhileRevalidate = true } = options;

  // Try to get from cache
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  
  if (cached) {
    const now = Date.now();
    const isExpired = now > cached.expiresAt;
    
    // Return cached data if not expired
    if (!isExpired) {
      return cached.data;
    }
    
    // If stale-while-revalidate, return stale data and refresh in background
    if (staleWhileRevalidate && cached.data) {
      // Refresh in background (don't await)
      refreshCache(key, fetcher, ttl);
      return cached.data;
    }
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  const entry: CacheEntry<T> = {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };
  
  memoryCache.set(key, entry, { ttl });
  
  return data;
}

/**
 * Refresh cache in background
 */
async function refreshCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<void> {
  try {
    const data = await fetcher();
    const entry: CacheEntry<T> = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    memoryCache.set(key, entry, { ttl });
  } catch (error) {
    console.error(`[Cache] Failed to refresh cache for key: ${key}`, error);
  }
}

/**
 * Invalidate cache by key
 */
export function invalidateCache(key: string): void {
  memoryCache.delete(key);
}

/**
 * Invalidate cache by pattern (prefix matching)
 */
export function invalidateCacheByPattern(pattern: string): void {
  const keys = Array.from(memoryCache.keys());
  for (const key of keys) {
    if (key.startsWith(pattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  memoryCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    size: memoryCache.size,
    calculatedSize: memoryCache.calculatedSize,
    max: memoryCache.max,
    maxSize: memoryCache.maxSize,
  };
}

// Cache key generators for consistent key naming
export const cacheKeys = {
  product: (id: string) => `product:${id}`,
  productList: (query: string) => `products:list:${query}`,
  productsByCategory: (categoryId: string) => `products:category:${categoryId}`,
  productsByBrand: (brand: string) => `products:brand:${brand}`,
  category: (id: string) => `category:${id}`,
  categoryList: () => 'categories:all',
  user: (id: string) => `user:${id}`,
  cart: (userId: string) => `cart:${userId}`,
  order: (id: string) => `order:${id}`,
  ordersByUser: (userId: string) => `orders:user:${userId}`,
  settings: (key: string) => `settings:${key}`,
  siteConfig: () => 'config:site',
  banners: () => 'banners:active',
  featuredProducts: () => 'products:featured',
  newArrivals: () => 'products:new-arrivals',
  bestsellers: () => 'products:bestsellers',
  searchResults: (query: string) => `search:${query}`,
  pincodeService: (pincode: string) => `pincode:${pincode}`,
};

/**
 * Cached data fetcher with automatic key generation
 */
export class CachedFetcher<T> {
  private keyGenerator: (...args: unknown[]) => string;
  private fetcher: (...args: unknown[]) => Promise<T>;
  private defaultOptions: CacheOptions;

  constructor(
    keyGenerator: (...args: unknown[]) => string,
    fetcher: (...args: unknown[]) => Promise<T>,
    defaultOptions: CacheOptions = {}
  ) {
    this.keyGenerator = keyGenerator;
    this.fetcher = fetcher;
    this.defaultOptions = defaultOptions;
  }

  async get(...args: unknown[]): Promise<T> {
    const key = this.keyGenerator(...args);
    return withCache(key, () => this.fetcher(...args), this.defaultOptions);
  }

  invalidate(...args: unknown[]): void {
    const key = this.keyGenerator(...args);
    invalidateCache(key);
  }
}

/**
 * HTTP Cache Headers generator
 */
export function generateCacheHeaders(options: {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  private?: boolean;
  noStore?: boolean;
}) {
  if (options.noStore) {
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    };
  }

  const directives: string[] = [];
  
  if (options.private) {
    directives.push('private');
  } else {
    directives.push('public');
  }
  
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }
  
  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }
  
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  return {
    'Cache-Control': directives.join(', '),
  };
}

/**
 * Preset cache headers for common scenarios
 */
export const cacheHeaders = {
  // Static assets (images, fonts) - long cache
  static: generateCacheHeaders({
    maxAge: 31536000, // 1 year
    sMaxAge: 31536000,
  }),
  
  // Product pages - medium cache with revalidation
  productPage: generateCacheHeaders({
    maxAge: 60,
    sMaxAge: 300,
    staleWhileRevalidate: 3600,
  }),
  
  // Category pages - short cache
  categoryPage: generateCacheHeaders({
    maxAge: 30,
    sMaxAge: 60,
    staleWhileRevalidate: 600,
  }),
  
  // API responses - very short cache
  apiResponse: generateCacheHeaders({
    maxAge: 10,
    sMaxAge: 30,
    staleWhileRevalidate: 60,
  }),
  
  // User-specific content - no CDN cache
  userContent: generateCacheHeaders({
    private: true,
    maxAge: 0,
  }),
  
  // Cart and checkout - no cache
  noCache: generateCacheHeaders({
    noStore: true,
  }),
};

export default {
  withCache,
  invalidateCache,
  invalidateCacheByPattern,
  clearCache,
  getCacheStats,
  cacheKeys,
  cacheHeaders,
  CACHE_TTL,
};
