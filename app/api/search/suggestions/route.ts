/**
 * Search Suggestions API
 * 
 * Provides autocomplete suggestions for the search component.
 * Returns products, categories, and brands matching the query.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { withCache, cacheKeys, CACHE_TTL } from '@/lib/cache';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  describeSearchQuery,
  hasStructuredIntent,
  parseSearchQuery,
  toMongoFilter,
  toProductSearchParams,
} from '@/lib/search-query';

interface SearchSuggestion {
  id: string;
  type: 'product' | 'category' | 'brand' | 'query';
  text: string;
  image?: string;
  price?: number;
  url: string;
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = checkRateLimit(request, RATE_LIMITS.SEARCH);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'RATE_LIMITED', 
          message: 'Too many requests' 
        } 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
        }
      }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim().toLowerCase() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 20);

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }

    // Use caching for suggestions
    const suggestions = await withCache(
      cacheKeys.searchResults(query),
      () => fetchSuggestions(query, limit),
      { ttl: CACHE_TTL.SHORT }
    );

    return NextResponse.json({
      success: true,
      suggestions,
      query,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      }
    });

  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch suggestions' } },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchSuggestions(query: string, limit: number): Promise<SearchSuggestion[]> {
  const suggestions: SearchSuggestion[] = [];

  try {
    const { db } = await connectToDatabase();
    const parsed = parseSearchQuery(query);
    const structured = hasStructuredIntent(parsed);

    // Match on the keyword remainder so "tv under 50000" still finds TVs.
    const textTerm = parsed.text || query;
    const safe = escapeRegex(textTerm);
    const rx = new RegExp(safe, "i");

    const textFilter = textTerm
      ? { $or: [{ name: rx }, { brand: rx }, { category: rx }] }
      : {};
    const structuredFilter = toMongoFilter(parsed);
    const productFilter =
      Object.keys(structuredFilter).length > 0
        ? { $and: [textFilter, structuredFilter].filter((part) => Object.keys(part).length > 0) }
        : textFilter;

    // Fetch products matching the query across name/brand/category
    const products = await db
      .collection("products")
      .find(productFilter)
      .limit(Math.max(Math.ceil(limit * 0.6), 1))
      .toArray();

    // Add product suggestions
    for (const product of products) {
      const p = product as Record<string, unknown>;
      const id = (p._id as { toString(): string })?.toString();
      const slug = (p.slug as string) || (p.name as string)
        ?.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || id;
      suggestions.push({
        id: `product-${id}`,
        type: 'product',
        text: p.name as string,
        image: ((p.images as string[]) || [])[0] || (p.image as string),
        price: (p.salePrice as number) || (p.price as number),
        url: `/product/${slug}`,
      });
    }

    // Fetch matching categories
    const categories = await db
      .collection("categories")
      .find({ name: rx })
      .limit(3)
      .toArray();
    // Add category suggestions
    for (const category of categories) {
      const c = category as Record<string, unknown>;
      const id = (c._id as { toString(): string })?.toString();
      suggestions.push({
        id: `category-${id}`,
        type: 'category',
        text: c.name as string,
        image: c.image as string | undefined,
        url: `/category/${(c.slug as string) || id}`,
      });
    }

    // Extract unique brands from matching products and add as suggestions
    const brands = [...new Set(
      products
        .map((p: Record<string, unknown>) => p.brand as string)
        .filter(Boolean)
        .filter((brand: string) => rx.test(brand))
    )].slice(0, 2);

    for (const brand of brands) {
      suggestions.push({
        id: `brand-${brand}`,
        type: 'brand',
        text: brand,
        url: `/products?brand=${encodeURIComponent(brand)}`,
      });
    }

    // Add query suggestion if we have results
    if (suggestions.length > 0) {
      suggestions.unshift({
        id: `query-${query}`,
        type: 'query',
        // Echo the interpreted filters so the shopper can see the query was understood.
        text: structured ? `${parsed.text || query} — ${describeSearchQuery(parsed)}` : query,
        url: `/products?${toProductSearchParams(parsed).toString()}`,
      });
    }

    return suggestions.slice(0, limit);

  } catch (error) {
    console.error('[Search] Failed to fetch suggestions:', error);
    return [];
  }
}
