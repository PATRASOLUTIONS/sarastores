# 🚀 Platform Optimization & Market Efficiency

> **Technical Enhancement Guide for Performance, Scalability, Security & UX**

---

## Table of Contents

1. [Performance Optimization](#1-performance-optimization)
2. [Scalability Improvements](#2-scalability-improvements)
3. [Security Enhancements](#3-security-enhancements)
4. [User Experience Improvements](#4-user-experience-improvements)
5. [SEO Optimization](#5-seo-optimization)
6. [Analytics & Tracking](#6-analytics--tracking)
7. [Checkout Flow Optimization](#7-checkout-flow-optimization)
8. [Inventory Management](#8-inventory-management)
9. [Load Performance](#9-load-performance)
10. [Caching Strategies](#10-caching-strategies)
11. [Database Optimization](#11-database-optimization)

---

## 1. Performance Optimization

### 1.1 Current State Analysis

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| First Contentful Paint | ~2.5s | <1.5s | High |
| Time to Interactive | ~4.0s | <2.5s | High |
| Largest Contentful Paint | ~3.5s | <2.0s | Medium |
| Cumulative Layout Shift | ~0.15 | <0.1 | Low |

### 1.2 Recommended Optimizations

#### A. Image Optimization

**Current Issue**: Images served without optimization
```typescript
// Current: Direct image usage
<img src={product.images[0]} alt={product.name} />
```

**Recommended Solution**: Implement Next.js Image with optimization
```typescript
// Improved: Use Next.js Image component with optimization
import Image from 'next/image'

<Image
  src={product.images[0]}
  alt={product.name}
  width={400}
  height={400}
  placeholder="blur"
  blurDataURL={product.thumbnailBlur}
  loading="lazy"
  quality={85}
/>
```

**Configuration Enhancement** (`next.config.js`):
```javascript
module.exports = {
  images: {
    domains: ['your-cdn.com', 'images.unsplash.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}
```

#### B. Code Splitting & Lazy Loading

**Implementation**:
```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic'

const ProductComparison = dynamic(
  () => import('@/components/ProductComparison'),
  { 
    loading: () => <ComparisonSkeleton />,
    ssr: false 
  }
)

const ReviewSection = dynamic(
  () => import('@/components/ReviewSection'),
  { loading: () => <ReviewSkeleton /> }
)
```

#### C. Bundle Size Optimization

**Current Dependencies to Audit**:
```json
{
  "heavy-dependencies": [
    "recharts (80KB+)",
    "framer-motion (50KB+)",
    "xlsx (200KB+)",
    "jspdf (150KB+)"
  ]
}
```

**Recommendations**:
1. Replace `xlsx` with `SheetJS` subset or server-side only
2. Use `motion` (lite) instead of full `framer-motion`
3. Lazy load `jspdf` only on invoice pages
4. Tree-shake `recharts` components

### 1.3 Performance Monitoring

**Add Performance Tracking**:
```typescript
// lib/performance.ts
export function trackWebVitals(metric: any) {
  const { name, value, id } = metric
  
  // Send to analytics
  fetch('/api/analytics/vitals', {
    method: 'POST',
    body: JSON.stringify({ name, value, id }),
  })
}

// In app/layout.tsx
export function reportWebVitals(metric: any) {
  trackWebVitals(metric)
}
```

---

## 2. Scalability Improvements

### 2.1 Database Scaling

#### Current Architecture
```
┌─────────────────┐
│   Next.js API   │
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    MongoDB      │
│  (Single Node)  │
└─────────────────┘
```

#### Recommended Architecture
```
┌─────────────────┐     ┌─────────────────┐
│   Next.js API   │────▶│   Redis Cache   │
│                 │     │   (TTL: 5min)   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           MongoDB Replica Set           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Primary │  │Secondary│  │Secondary│ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

### 2.2 API Rate Limiting Enhancement

**Current State**: Basic rate limiting exists
**Enhancement**: Implement tiered rate limiting

```typescript
// lib/rateLimiter.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

// Tiered rate limits
export const rateLimiters = {
  public: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
    analytics: true,
  }),
  authenticated: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, '1 m'), // 500 req/min
    analytics: true,
  }),
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 req/min
    analytics: true,
  }),
}

// Usage in API route
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success, limit, remaining } = await rateLimiters.public.limit(ip)
  
  if (!success) {
    return new Response('Too Many Requests', { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      }
    })
  }
  
  // Continue with request...
}
```

### 2.3 Horizontal Scaling Preparation

**Stateless Session Management**:
```typescript
// Current: Cookie-based sessions (stateful)
// Recommended: JWT with Redis session store

// lib/session.ts
import { SignJWT, jwtVerify } from 'jose'
import { Redis } from '@upstash/redis'

const redis = new Redis({...})
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function createSession(userId: string, userData: any) {
  const sessionId = crypto.randomUUID()
  
  // Store session data in Redis
  await redis.setex(`session:${sessionId}`, 86400, JSON.stringify(userData))
  
  // Create JWT with session reference
  const jwt = await new SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET)
  
  return jwt
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, SECRET)
  const sessionData = await redis.get(`session:${payload.sid}`)
  return sessionData ? JSON.parse(sessionData) : null
}
```

---

## 3. Security Enhancements

### 3.1 Current Security Assessment

| Feature | Status | Risk Level |
|---------|--------|------------|
| Password Hashing (bcrypt) | ✅ Implemented | Low |
| Bot Detection | ✅ Implemented | Low |
| Rate Limiting | ⚠️ Basic | Medium |
| CSRF Protection | ⚠️ Cookie-based | Medium |
| Input Validation | ✅ Zod | Low |
| API Authentication | ⚠️ Cookie only | High |
| SQL Injection | ✅ NoSQL (MongoDB) | Low |
| XSS Prevention | ✅ DOMPurify | Low |

### 3.2 Recommended Security Enhancements

#### A. API Key Authentication for Public APIs

```typescript
// lib/apiAuth.ts
import { createHash, randomBytes } from 'crypto'

export interface APIKey {
  id: string
  hashedKey: string
  name: string
  permissions: string[]
  rateLimit: number
  createdAt: Date
  lastUsed: Date
  expiresAt: Date | null
}

export function generateAPIKey(): { key: string; hash: string } {
  const key = `sk_live_${randomBytes(32).toString('base64url')}`
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, hash }
}

export async function validateAPIKey(key: string): Promise<APIKey | null> {
  const hash = createHash('sha256').update(key).digest('hex')
  const apiKey = await db.collection('api_keys').findOne({ hashedKey: hash })
  
  if (!apiKey) return null
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null
  
  // Update last used
  await db.collection('api_keys').updateOne(
    { _id: apiKey._id },
    { $set: { lastUsed: new Date() } }
  )
  
  return apiKey
}
```

#### B. Content Security Policy

```typescript
// middleware.ts - Add CSP headers
const CSP = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.google.com https://www.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.razorpay.com https://*.vercel-insights.com;
  frame-src 'self' https://api.razorpay.com https://www.google.com;
`.replace(/\n/g, ' ').trim()

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set('Content-Security-Policy', CSP)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  return response
}
```

#### C. Audit Logging

```typescript
// lib/auditLog.ts
export interface AuditLogEntry {
  timestamp: Date
  userId: string
  action: string
  resource: string
  resourceId: string
  changes?: Record<string, { old: any; new: any }>
  ip: string
  userAgent: string
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>) {
  await db.collection('audit_logs').insertOne({
    ...entry,
    timestamp: new Date(),
  })
}

// Usage in API routes
await logAuditEvent({
  userId: user.id,
  action: 'ORDER_STATUS_UPDATE',
  resource: 'orders',
  resourceId: orderId,
  changes: { status: { old: 'processing', new: 'shipped' } },
  ip: request.headers.get('x-forwarded-for') || 'unknown',
  userAgent: request.headers.get('user-agent') || 'unknown',
})
```

---

## 4. User Experience Improvements

### 4.1 Search Experience Enhancement

**Current**: Basic MongoDB text search
**Recommended**: Implement advanced search with autocomplete

```typescript
// components/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      fetchSuggestions(debouncedQuery)
    }
  }, [debouncedQuery])
  
  async function fetchSuggestions(q: string) {
    const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSuggestions(data.suggestions)
    setIsOpen(true)
  }
  
  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
        className="w-full px-4 py-2 border rounded-lg"
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-50">
          {suggestions.map((suggestion) => (
            <SuggestionItem key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Backend Search API Enhancement**:
```typescript
// app/api/search/suggestions/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  
  if (query.length < 2) {
    return Response.json({ suggestions: [] })
  }
  
  const db = await connectDB()
  
  // Search with aggregation for better results
  const suggestions = await db.collection('products').aggregate([
    {
      $search: {
        index: 'product_search',
        compound: {
          should: [
            { autocomplete: { query, path: 'name', fuzzy: { maxEdits: 1 } } },
            { text: { query, path: 'description', fuzzy: { maxEdits: 1 } } },
            { text: { query, path: 'brand' } },
            { text: { query, path: 'category' } },
          ]
        }
      }
    },
    { $limit: 10 },
    { $project: { name: 1, brand: 1, price: 1, images: { $arrayElemAt: ['$images', 0] }, category: 1 } }
  ]).toArray()
  
  return Response.json({ suggestions })
}
```

### 4.2 Product Filtering Enhancement

**Add Filter Persistence & URL Sync**:
```typescript
// hooks/useProductFilters.ts
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export function useProductFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const filters = useMemo(() => ({
    category: searchParams.get('category') || '',
    brand: searchParams.getAll('brand'),
    priceMin: Number(searchParams.get('priceMin')) || 0,
    priceMax: Number(searchParams.get('priceMax')) || Infinity,
    inStock: searchParams.get('inStock') === 'true',
    sort: searchParams.get('sort') || 'relevance',
  }), [searchParams])
  
  const setFilter = useCallback((key: string, value: any) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (Array.isArray(value)) {
      params.delete(key)
      value.forEach(v => params.append(key, v))
    } else if (value === null || value === '' || value === false) {
      params.delete(key)
    } else {
      params.set(key, String(value))
    }
    
    router.push(`/products?${params.toString()}`)
  }, [router, searchParams])
  
  const clearFilters = useCallback(() => {
    router.push('/products')
  }, [router])
  
  return { filters, setFilter, clearFilters }
}
```

### 4.3 Real-time Stock Updates

```typescript
// components/StockStatus.tsx
import { useEffect, useState } from 'react'

export function StockStatus({ productId, initialStock }: { productId: string; initialStock: number }) {
  const [stock, setStock] = useState(initialStock)
  const [isLow, setIsLow] = useState(initialStock < 10)
  
  useEffect(() => {
    // Poll for stock updates every 30 seconds
    const interval = setInterval(async () => {
      const res = await fetch(`/api/products/${productId}/stock`)
      const data = await res.json()
      setStock(data.stock)
      setIsLow(data.stock < 10)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [productId])
  
  return (
    <div className={`flex items-center gap-2 ${isLow ? 'text-orange-600' : 'text-green-600'}`}>
      {stock > 0 ? (
        <>
          <span className="w-2 h-2 rounded-full bg-current" />
          <span>
            {isLow ? `Only ${stock} left!` : 'In Stock'}
          </span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-600">Out of Stock</span>
        </>
      )}
    </div>
  )
}
```

---

## 5. SEO Optimization

### 5.1 Current SEO Gaps

| Element | Status | Impact |
|---------|--------|--------|
| Meta Tags | ⚠️ Basic | High |
| Structured Data | ❌ Missing | High |
| Sitemap | ⚠️ Manual | Medium |
| Canonical URLs | ❌ Missing | Medium |
| Open Graph | ⚠️ Partial | Medium |
| Breadcrumbs Schema | ❌ Missing | Low |

### 5.2 Structured Data Implementation

**Product Schema**:
```typescript
// lib/seo.ts
export function generateProductSchema(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    sku: product.sku,
    gtin: product.gtin || undefined,
    offers: {
      '@type': 'Offer',
      url: `https://saramobiles.com/product/${product.id}`,
      priceCurrency: 'INR',
      price: product.price,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: product.stock > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Sara Mobiles & Electronics',
      },
    },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating,
      reviewCount: product.reviewCount,
    } : undefined,
  }
}

// In product page
export default function ProductPage({ product }: { product: Product }) {
  const schema = generateProductSchema(product)
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* Page content */}
    </>
  )
}
```

**Organization Schema** (layout.tsx):
```typescript
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Sara Mobiles & Electronics',
  url: 'https://saramobiles.com',
  logo: 'https://saramobiles.com/logo.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91-XXXXXXXXXX',
    contactType: 'customer service',
    areaServed: 'IN',
    availableLanguage: ['English', 'Hindi'],
  },
  sameAs: [
    'https://facebook.com/saramobiles',
    'https://instagram.com/saramobiles',
  ],
}
```

### 5.3 Dynamic Sitemap Generation

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'
import { connectDB } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await connectDB()
  
  // Fetch all products
  const products = await db.collection('products')
    .find({ active: true })
    .project({ id: 1, updatedAt: 1 })
    .toArray()
  
  // Fetch all categories
  const categories = await db.collection('categories')
    .find({ active: true })
    .project({ slug: 1, updatedAt: 1 })
    .toArray()
  
  const baseUrl = 'https://saramobiles.com'
  
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
  
  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/product/${product.id}`,
    lastModified: product.updatedAt || new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))
  
  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}/category/${category.slug}`,
    lastModified: category.updatedAt || new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))
  
  return [...staticPages, ...productPages, ...categoryPages]
}
```

---

## 6. Analytics & Tracking

### 6.1 Comprehensive Event Tracking

**Event Taxonomy**:
```typescript
// lib/analytics.ts
export interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  userId?: string
  sessionId: string
  timestamp: Date
  page: string
}

export const EVENTS = {
  // Product Events
  PRODUCT_VIEW: 'product_view',
  PRODUCT_SEARCH: 'product_search',
  PRODUCT_FILTER: 'product_filter',
  PRODUCT_COMPARE_ADD: 'product_compare_add',
  PRODUCT_COMPARE_REMOVE: 'product_compare_remove',
  
  // Cart Events
  CART_ADD: 'cart_add',
  CART_REMOVE: 'cart_remove',
  CART_UPDATE_QUANTITY: 'cart_update_quantity',
  CART_VIEW: 'cart_view',
  
  // Checkout Events
  CHECKOUT_START: 'checkout_start',
  CHECKOUT_STEP: 'checkout_step',
  CHECKOUT_PAYMENT_SELECT: 'checkout_payment_select',
  CHECKOUT_COUPON_APPLY: 'checkout_coupon_apply',
  CHECKOUT_COUPON_FAIL: 'checkout_coupon_fail',
  
  // Purchase Events
  PURCHASE_COMPLETE: 'purchase_complete',
  PURCHASE_FAIL: 'purchase_fail',
  
  // User Events
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  WISHLIST_ADD: 'wishlist_add',
  WISHLIST_REMOVE: 'wishlist_remove',
  
  // Engagement Events
  REVIEW_SUBMIT: 'review_submit',
  SHARE_PRODUCT: 'share_product',
  CONTACT_FORM_SUBMIT: 'contact_form_submit',
} as const

export function trackEvent(event: keyof typeof EVENTS, properties?: Record<string, any>) {
  // Send to multiple providers
  
  // Vercel Analytics
  if (typeof window !== 'undefined' && window.va) {
    window.va('event', { name: EVENTS[event], ...properties })
  }
  
  // Custom backend
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: EVENTS[event],
      properties,
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
    }),
  }).catch(console.error)
}
```

### 6.2 E-commerce Analytics Dashboard

**API Endpoint for Admin Analytics**:
```typescript
// app/api/analytics/dashboard/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '7d'
  
  const db = await connectDB()
  const startDate = getStartDate(period)
  
  const [
    revenue,
    orders,
    topProducts,
    conversionFunnel,
    cartAbandonment,
  ] = await Promise.all([
    // Revenue over time
    db.collection('orders').aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray(),
    
    // Order statistics
    db.collection('orders').aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray(),
    
    // Top products
    db.collection('orders').aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]).toArray(),
    
    // Conversion funnel
    db.collection('analytics_events').aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$event', count: { $sum: 1 } } }
    ]).toArray(),
    
    // Cart abandonment rate
    calculateCartAbandonmentRate(db, startDate),
  ])
  
  return Response.json({
    revenue,
    orders,
    topProducts,
    conversionFunnel,
    cartAbandonment,
  })
}
```

---

## 7. Checkout Flow Optimization

### 7.1 Current Flow Analysis

```
Current: 3-Step Checkout
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Cart       │───▶│  Shipping    │───▶│   Payment    │
│              │    │  + Billing   │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
                          │
                          ▼
                    Form Validation
                    (All fields required)
```

### 7.2 Recommended Improvements

#### A. Guest Checkout Enhancement
```typescript
// app/checkout/page.tsx
export default function CheckoutPage() {
  const [checkoutMode, setCheckoutMode] = useState<'guest' | 'login' | 'register'>('guest')
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  
  // Allow guest checkout with email only
  const guestCheckoutSchema = z.object({
    email: z.string().email('Valid email required'),
    name: z.string().min(2, 'Name required'),
    phone: z.string().min(10, 'Valid phone required'),
    address: addressSchema,
    createAccount: z.boolean().optional(),
    password: z.string().min(8).optional(), // Only if createAccount is true
  })
  
  return (
    <div>
      {/* Quick checkout options */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setCheckoutMode('guest')}
          className={checkoutMode === 'guest' ? 'active' : ''}
        >
          Checkout as Guest
        </button>
        <button 
          onClick={() => setCheckoutMode('login')}
          className={checkoutMode === 'login' ? 'active' : ''}
        >
          Login for Faster Checkout
        </button>
      </div>
      
      {/* Form with progress indicator */}
      <CheckoutForm mode={checkoutMode} />
    </div>
  )
}
```

#### B. Address Autocomplete
```typescript
// components/AddressAutocomplete.tsx
import { useState, useEffect } from 'react'

export function AddressAutocomplete({ onSelect }: { onSelect: (address: Address) => void }) {
  const [pincode, setPincode] = useState('')
  const [loading, setLoading] = useState(false)
  const [addressData, setAddressData] = useState<PincodeData | null>(null)
  
  useEffect(() => {
    if (pincode.length === 6) {
      setLoading(true)
      fetch(`/api/india/pincode/${pincode}`)
        .then(res => res.json())
        .then(data => {
          setAddressData(data)
          onSelect({
            city: data.city,
            state: data.state,
            pincode: pincode,
          })
        })
        .finally(() => setLoading(false))
    }
  }, [pincode, onSelect])
  
  return (
    <div>
      <input
        type="text"
        value={pincode}
        onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="Enter Pincode"
        maxLength={6}
      />
      {loading && <Spinner />}
      {addressData && (
        <div className="text-sm text-gray-600 mt-1">
          {addressData.city}, {addressData.state}
        </div>
      )}
    </div>
  )
}
```

#### C. Order Summary Persistence
```typescript
// hooks/useCheckoutPersistence.ts
import { useEffect } from 'react'

export function useCheckoutPersistence(formData: CheckoutFormData) {
  // Save checkout progress to localStorage
  useEffect(() => {
    if (formData.email) {
      const saveData = {
        ...formData,
        timestamp: Date.now(),
      }
      localStorage.setItem('checkout_progress', JSON.stringify(saveData))
    }
  }, [formData])
  
  // Restore on mount
  const restore = () => {
    const saved = localStorage.getItem('checkout_progress')
    if (saved) {
      const data = JSON.parse(saved)
      // Only restore if less than 24 hours old
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data
      }
    }
    return null
  }
  
  // Clear on successful checkout
  const clear = () => {
    localStorage.removeItem('checkout_progress')
  }
  
  return { restore, clear }
}
```

---

## 8. Inventory Management

### 8.1 Current State
- Basic stock field per product
- Manual stock updates
- No low-stock alerts
- No reorder automation

### 8.2 Enhanced Inventory System

```typescript
// types/inventory.ts
export interface InventoryItem {
  productId: string
  sku: string
  stock: number
  reservedStock: number // For items in carts
  availableStock: number // stock - reservedStock
  lowStockThreshold: number
  reorderPoint: number
  reorderQuantity: number
  warehouseId?: string
  lastRestocked: Date
  stockHistory: StockChange[]
}

export interface StockChange {
  timestamp: Date
  quantity: number // positive for add, negative for remove
  reason: 'sale' | 'restock' | 'adjustment' | 'return' | 'damage'
  orderId?: string
  userId: string
  notes?: string
}
```

**Stock Reservation System**:
```typescript
// lib/inventory.ts
export async function reserveStock(items: CartItem[], sessionId: string): Promise<boolean> {
  const db = await connectDB()
  const session = db.client.startSession()
  
  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        const result = await db.collection('products').updateOne(
          { 
            _id: new ObjectId(item.productId),
            stock: { $gte: item.quantity }
          },
          { 
            $inc: { 
              stock: -item.quantity,
              reservedStock: item.quantity 
            }
          },
          { session }
        )
        
        if (result.modifiedCount === 0) {
          throw new Error(`Insufficient stock for ${item.name}`)
        }
      }
      
      // Store reservation with expiry (15 minutes)
      await db.collection('stock_reservations').insertOne({
        sessionId,
        items,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
      }, { session })
    })
    
    return true
  } catch (error) {
    console.error('Stock reservation failed:', error)
    return false
  } finally {
    session.endSession()
  }
}

// Cron job to release expired reservations
export async function releaseExpiredReservations() {
  const db = await connectDB()
  
  const expired = await db.collection('stock_reservations')
    .find({ expiresAt: { $lt: new Date() } })
    .toArray()
  
  for (const reservation of expired) {
    for (const item of reservation.items) {
      await db.collection('products').updateOne(
        { _id: new ObjectId(item.productId) },
        { 
          $inc: { 
            stock: item.quantity,
            reservedStock: -item.quantity 
          }
        }
      )
    }
    
    await db.collection('stock_reservations').deleteOne({ _id: reservation._id })
  }
}
```

**Low Stock Alerts**:
```typescript
// lib/cron/stockAlerts.ts
import { sendEmail } from '@/lib/email'

export async function checkLowStock() {
  const db = await connectDB()
  
  const lowStockProducts = await db.collection('products').find({
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    active: true,
  }).toArray()
  
  if (lowStockProducts.length > 0) {
    // Send alert email to admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL!,
      subject: `Low Stock Alert: ${lowStockProducts.length} products need attention`,
      template: 'low-stock-alert',
      data: { products: lowStockProducts },
    })
    
    // Create admin notification
    await db.collection('admin_notifications').insertOne({
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: `${lowStockProducts.length} products are running low on stock`,
      products: lowStockProducts.map(p => ({ id: p._id, name: p.name, stock: p.stock })),
      read: false,
      createdAt: new Date(),
    })
  }
}
```

---

## 9. Load Performance

### 9.1 Critical Rendering Path Optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'

// Preload critical fonts
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        
        {/* DNS prefetch for secondary resources */}
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />
        
        {/* Preload critical assets */}
        <link 
          rel="preload" 
          href="/fonts/brand-font.woff2" 
          as="font" 
          type="font/woff2" 
          crossOrigin="anonymous" 
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### 9.2 Server Component Optimization

```typescript
// app/products/page.tsx
import { Suspense } from 'react'

// Streaming with Suspense boundaries
export default async function ProductsPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Critical: Filters load first */}
      <aside className="lg:col-span-1">
        <Suspense fallback={<FiltersSkeleton />}>
          <ProductFilters />
        </Suspense>
      </aside>
      
      {/* Products stream in */}
      <main className="lg:col-span-3">
        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductGrid />
        </Suspense>
      </main>
    </div>
  )
}

// Server component with data fetching
async function ProductGrid() {
  const products = await fetchProducts() // Direct database call, no API roundtrip
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

---

## 10. Caching Strategies

### 10.1 Multi-Layer Caching Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CACHING LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Browser Cache (CDN Edge)                                   │
│  ├── Static Assets: 1 year                                  │
│  ├── Images: 1 month                                        │
│  └── HTML: No cache (dynamic)                               │
│                                                             │
│  Vercel Edge Cache                                          │
│  ├── ISR Pages: Revalidate 60s                              │
│  └── API Routes: Cache headers                              │
│                                                             │
│  Redis Cache (Application)                                  │
│  ├── Product Data: 5 min TTL                                │
│  ├── Category Data: 30 min TTL                              │
│  ├── User Sessions: 24h TTL                                 │
│  └── API Responses: Varies                                  │
│                                                             │
│  MongoDB (Database)                                         │
│  └── Source of truth                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Redis Implementation

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

interface CacheOptions {
  ttl?: number // seconds
  tags?: string[]
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await redis.get(key)
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

export async function cacheSet<T>(
  key: string, 
  value: T, 
  options: CacheOptions = {}
): Promise<void> {
  try {
    const { ttl = 300 } = options
    await redis.setex(key, ttl, JSON.stringify(value))
    
    // Track cache tags for invalidation
    if (options.tags) {
      for (const tag of options.tags) {
        await redis.sadd(`tag:${tag}`, key)
      }
    }
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

export async function cacheInvalidateTag(tag: string): Promise<void> {
  try {
    const keys = await redis.smembers(`tag:${tag}`)
    if (keys.length > 0) {
      await redis.del(...keys)
      await redis.del(`tag:${tag}`)
    }
  } catch (error) {
    console.error('Cache invalidate error:', error)
  }
}

// Wrapper for cached data fetching
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached) return cached
  
  const data = await fetcher()
  await cacheSet(key, data, options)
  return data
}
```

**Usage in API Routes**:
```typescript
// app/api/products/route.ts
import { cachedFetch, cacheInvalidateTag } from '@/lib/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'all'
  
  const cacheKey = `products:${category}`
  
  const products = await cachedFetch(
    cacheKey,
    async () => {
      const db = await connectDB()
      return db.collection('products')
        .find(category !== 'all' ? { category } : {})
        .toArray()
    },
    { ttl: 300, tags: ['products', `products:${category}`] }
  )
  
  return Response.json({ products })
}

// Invalidate cache on product update
export async function POST(request: Request) {
  // ... create product logic
  
  await cacheInvalidateTag('products')
  
  return Response.json({ success: true })
}
```

---

## 11. Database Optimization

### 11.1 Index Strategy

```javascript
// scripts/createIndexes.js
const indexes = {
  products: [
    { key: { active: 1, category: 1 }, name: 'active_category' },
    { key: { active: 1, brand: 1 }, name: 'active_brand' },
    { key: { active: 1, price: 1 }, name: 'active_price' },
    { key: { sku: 1 }, name: 'sku_unique', unique: true },
    { key: { name: 'text', description: 'text', brand: 'text' }, name: 'search_text' },
    { key: { createdAt: -1 }, name: 'created_desc' },
    { key: { 'metadata.featured': 1, active: 1 }, name: 'featured_active' },
  ],
  
  orders: [
    { key: { userId: 1, createdAt: -1 }, name: 'user_orders' },
    { key: { status: 1, createdAt: -1 }, name: 'status_created' },
    { key: { 'customer.email': 1 }, name: 'customer_email' },
    { key: { createdAt: -1 }, name: 'created_desc' },
    { key: { paymentStatus: 1, createdAt: -1 }, name: 'payment_status' },
  ],
  
  users: [
    { key: { email: 1 }, name: 'email_unique', unique: true },
    { key: { role: 1 }, name: 'role' },
    { key: { createdAt: -1 }, name: 'created_desc' },
  ],
  
  cart: [
    { key: { sessionId: 1 }, name: 'session' },
    { key: { userId: 1 }, name: 'user' },
    { key: { updatedAt: 1 }, name: 'updated', expireAfterSeconds: 604800 }, // 7 days TTL
  ],
  
  analytics_events: [
    { key: { event: 1, timestamp: -1 }, name: 'event_time' },
    { key: { userId: 1, timestamp: -1 }, name: 'user_time' },
    { key: { sessionId: 1, timestamp: -1 }, name: 'session_time' },
    { key: { timestamp: 1 }, name: 'timestamp_ttl', expireAfterSeconds: 7776000 }, // 90 days TTL
  ],
}

async function createIndexes() {
  const client = await MongoClient.connect(process.env.MONGODB_URI)
  const db = client.db('ecommerce')
  
  for (const [collection, indexList] of Object.entries(indexes)) {
    for (const index of indexList) {
      try {
        await db.collection(collection).createIndex(index.key, {
          name: index.name,
          unique: index.unique,
          expireAfterSeconds: index.expireAfterSeconds,
        })
        console.log(`Created index ${index.name} on ${collection}`)
      } catch (error) {
        console.error(`Error creating index ${index.name}:`, error)
      }
    }
  }
  
  await client.close()
}
```

### 11.2 Query Optimization

```typescript
// Before: Inefficient query
const products = await db.collection('products')
  .find({ active: true })
  .toArray()
  .then(products => products.filter(p => p.category === 'Electronics'))

// After: Optimized query with projection
const products = await db.collection('products')
  .find({ 
    active: true, 
    category: 'Electronics' 
  })
  .project({ 
    name: 1, 
    price: 1, 
    images: { $slice: 1 }, // Only first image
    brand: 1,
    stock: 1,
  })
  .hint('active_category') // Use specific index
  .limit(24)
  .toArray()
```

### 11.3 Aggregation Pipeline Optimization

```typescript
// Efficient dashboard stats query
const dashboardStats = await db.collection('orders').aggregate([
  // Match recent orders first (uses index)
  { $match: { 
    createdAt: { $gte: thirtyDaysAgo },
    status: { $ne: 'cancelled' }
  }},
  
  // Use $facet for parallel aggregations
  { $facet: {
    totalRevenue: [
      { $group: { _id: null, total: { $sum: '$total' } } }
    ],
    ordersByStatus: [
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ],
    revenueByDay: [
      { $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$total' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ],
    topProducts: [
      { $unwind: '$items' },
      { $group: { 
        _id: '$items.productId',
        name: { $first: '$items.name' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }},
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]
  }}
], { allowDiskUse: true }).toArray()
```

---

## Summary

This document outlines comprehensive platform optimization strategies across:

1. **Performance**: Image optimization, code splitting, bundle size reduction
2. **Scalability**: Caching layers, horizontal scaling preparation
3. **Security**: API authentication, CSP headers, audit logging
4. **UX**: Advanced search, filtering, real-time updates
5. **SEO**: Structured data, dynamic sitemaps
6. **Analytics**: Comprehensive event tracking, dashboards
7. **Checkout**: Guest checkout, address autocomplete, persistence
8. **Inventory**: Stock reservation, low-stock alerts
9. **Load Performance**: Critical path optimization, streaming
10. **Caching**: Multi-layer Redis implementation
11. **Database**: Index strategy, query optimization

**Next Steps**: See [06-IMPLEMENTATION-ROADMAP.md](./06-IMPLEMENTATION-ROADMAP.md) for prioritized implementation plan.
