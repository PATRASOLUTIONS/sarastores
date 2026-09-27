# 🔌 API & Plugin Ecosystem (Platform as a Service)

> **Comprehensive Guide for Third-Party Integration Architecture**

---

## Table of Contents

1. [Public API Architecture](#1-public-api-architecture)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [API Design Standards](#3-api-design-standards)
4. [Rate Limiting & Quotas](#4-rate-limiting--quotas)
5. [Partner Integration Examples](#5-partner-integration-examples)
6. [Webhook System](#6-webhook-system)
7. [SDK & Developer Tools](#7-sdk--developer-tools)
8. [API Marketplace](#8-api-marketplace)
9. [Security & Compliance](#9-security--compliance)
10. [Real-World Use Cases](#10-real-world-use-cases)

---

## 1. Public API Architecture

### 1.1 API Versioning Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       API ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   External Clients                                                      │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│   │ Web App │  │Mobile   │  │Partner A│  │Partner B│                  │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                  │
│        │            │            │            │                         │
│        └────────────┴─────┬──────┴────────────┘                         │
│                           │                                             │
│                           ▼                                             │
│   ┌───────────────────────────────────────────────────────────────────┐│
│   │                     API Gateway                                   ││
│   │  • Rate Limiting  • Auth  • Logging  • Caching  • Routing        ││
│   └───────────────────────────────────────────────────────────────────┘│
│                           │                                             │
│        ┌──────────────────┼──────────────────┐                         │
│        ▼                  ▼                  ▼                         │
│   ┌─────────┐       ┌─────────┐       ┌─────────┐                     │
│   │  v1 API │       │  v2 API │       │  Beta   │                     │
│   │(Stable) │       │(Current)│       │(Preview)│                     │
│   └─────────┘       └─────────┘       └─────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 API Base Structure

```typescript
// app/api/v1/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAPIKey, checkPermissions, rateLimit } from '@/lib/api-gateway'

export async function handler(request: NextRequest, context: { params: { path: string[] } }) {
  const startTime = Date.now()
  const path = context.params.path.join('/')
  
  try {
    // 1. API Key Validation
    const apiKey = await validateAPIKey(request)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key', code: 'INVALID_API_KEY' },
        { status: 401 }
      )
    }
    
    // 2. Rate Limiting
    const rateLimitResult = await rateLimit(apiKey.id, apiKey.tier)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter.toString(),
          }
        }
      )
    }
    
    // 3. Permission Check
    const hasPermission = await checkPermissions(apiKey, path, request.method)
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    
    // 4. Route to appropriate handler
    const response = await routeRequest(path, request, apiKey)
    
    // 5. Add response headers
    const duration = Date.now() - startTime
    response.headers.set('X-Request-Id', crypto.randomUUID())
    response.headers.set('X-Response-Time', `${duration}ms`)
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    
    return response
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE }
```

### 1.3 API Endpoints Overview

```typescript
// Public API v1 Endpoints
const API_ENDPOINTS = {
  // Products
  'GET /v1/products': 'List products with filtering and pagination',
  'GET /v1/products/:id': 'Get single product details',
  'GET /v1/products/search': 'Search products',
  'GET /v1/products/:id/availability': 'Check stock availability',
  
  // Categories
  'GET /v1/categories': 'List all categories',
  'GET /v1/categories/:id': 'Get category with products',
  'GET /v1/categories/:id/products': 'List products in category',
  
  // Orders (Partner scope)
  'POST /v1/orders': 'Create new order',
  'GET /v1/orders/:id': 'Get order status',
  'GET /v1/orders': 'List orders (partner's orders only)',
  'PUT /v1/orders/:id/cancel': 'Cancel order',
  
  // Inventory (Vendor scope)
  'GET /v1/inventory': 'Get inventory levels',
  'PUT /v1/inventory/:productId': 'Update inventory',
  'POST /v1/inventory/bulk': 'Bulk inventory update',
  
  // Payments (Partner scope)
  'POST /v1/payments/initiate': 'Initiate payment',
  'GET /v1/payments/:id': 'Get payment status',
  'POST /v1/payments/:id/refund': 'Initiate refund',
  
  // Customers (Partner scope)
  'POST /v1/customers': 'Create/sync customer',
  'GET /v1/customers/:id': 'Get customer details',
  'GET /v1/customers/:id/orders': 'Get customer order history',
  
  // Shipping
  'POST /v1/shipping/rates': 'Calculate shipping rates',
  'GET /v1/shipping/:orderId/track': 'Track shipment',
  'GET /v1/shipping/pincodes/:pincode': 'Check serviceability',
  
  // Webhooks
  'POST /v1/webhooks': 'Register webhook',
  'GET /v1/webhooks': 'List webhooks',
  'DELETE /v1/webhooks/:id': 'Delete webhook',
}
```

---

## 2. Authentication & Authorization

### 2.1 API Key Management

```typescript
// lib/api-auth.ts
import { createHash, randomBytes } from 'crypto'

export interface APIKey {
  id: string
  name: string
  hashedKey: string
  prefix: string // First 8 chars for identification
  partnerId: string
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
  permissions: Permission[]
  rateLimit: {
    requestsPerMinute: number
    requestsPerDay: number
  }
  allowedIPs?: string[]
  allowedOrigins?: string[]
  createdAt: Date
  lastUsed: Date
  expiresAt?: Date
  status: 'active' | 'revoked' | 'expired'
}

export interface Permission {
  resource: string
  actions: ('read' | 'write' | 'delete')[]
  conditions?: Record<string, any>
}

// API Key Generation
export async function generateAPIKey(partnerId: string, name: string, tier: APIKey['tier']): Promise<{ key: string; apiKey: APIKey }> {
  const prefix = `sk_${tier === 'free' ? 'test' : 'live'}_`
  const secret = randomBytes(32).toString('base64url')
  const fullKey = `${prefix}${secret}`
  const hashedKey = createHash('sha256').update(fullKey).digest('hex')
  
  const apiKey: APIKey = {
    id: new ObjectId().toString(),
    name,
    hashedKey,
    prefix: fullKey.slice(0, 12),
    partnerId,
    tier,
    permissions: getDefaultPermissions(tier),
    rateLimit: getRateLimits(tier),
    createdAt: new Date(),
    lastUsed: new Date(),
    status: 'active',
  }
  
  const db = await connectDB()
  await db.collection('api_keys').insertOne(apiKey)
  
  // Return key only once - never stored in plain text
  return { key: fullKey, apiKey }
}

// API Key Validation
export async function validateAPIKey(request: NextRequest): Promise<APIKey | null> {
  const authHeader = request.headers.get('Authorization')
  const apiKeyHeader = request.headers.get('X-API-Key')
  
  const key = apiKeyHeader || authHeader?.replace('Bearer ', '')
  if (!key) return null
  
  const hashedKey = createHash('sha256').update(key).digest('hex')
  
  const db = await connectDB()
  const apiKey = await db.collection('api_keys').findOne({
    hashedKey,
    status: 'active',
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  })
  
  if (!apiKey) return null
  
  // Validate IP restrictions
  if (apiKey.allowedIPs?.length) {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    if (!apiKey.allowedIPs.includes(clientIP)) return null
  }
  
  // Validate origin restrictions
  if (apiKey.allowedOrigins?.length) {
    const origin = request.headers.get('origin')
    if (origin && !apiKey.allowedOrigins.includes(origin)) return null
  }
  
  // Update last used
  await db.collection('api_keys').updateOne(
    { _id: apiKey._id },
    { $set: { lastUsed: new Date() } }
  )
  
  return apiKey as APIKey
}

function getDefaultPermissions(tier: APIKey['tier']): Permission[] {
  const permissions: Record<string, Permission[]> = {
    free: [
      { resource: 'products', actions: ['read'] },
      { resource: 'categories', actions: ['read'] },
    ],
    basic: [
      { resource: 'products', actions: ['read'] },
      { resource: 'categories', actions: ['read'] },
      { resource: 'orders', actions: ['read', 'write'] },
      { resource: 'shipping', actions: ['read'] },
    ],
    pro: [
      { resource: 'products', actions: ['read', 'write'] },
      { resource: 'categories', actions: ['read'] },
      { resource: 'orders', actions: ['read', 'write'] },
      { resource: 'inventory', actions: ['read', 'write'] },
      { resource: 'customers', actions: ['read', 'write'] },
      { resource: 'shipping', actions: ['read', 'write'] },
      { resource: 'payments', actions: ['read', 'write'] },
      { resource: 'webhooks', actions: ['read', 'write', 'delete'] },
    ],
    enterprise: [
      { resource: '*', actions: ['read', 'write', 'delete'] },
    ],
  }
  return permissions[tier]
}

function getRateLimits(tier: APIKey['tier']): APIKey['rateLimit'] {
  const limits: Record<string, APIKey['rateLimit']> = {
    free: { requestsPerMinute: 60, requestsPerDay: 1000 },
    basic: { requestsPerMinute: 300, requestsPerDay: 10000 },
    pro: { requestsPerMinute: 1000, requestsPerDay: 100000 },
    enterprise: { requestsPerMinute: 5000, requestsPerDay: 1000000 },
  }
  return limits[tier]
}
```

### 2.2 OAuth2 Implementation

```typescript
// lib/oauth.ts
export interface OAuthClient {
  clientId: string
  clientSecret: string // hashed
  name: string
  redirectUris: string[]
  allowedScopes: string[]
  partnerId: string
}

export interface OAuthToken {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
  scope: string[]
}

// OAuth2 Scopes
export const OAUTH_SCOPES = {
  'products:read': 'View product catalog',
  'products:write': 'Manage products',
  'orders:read': 'View orders',
  'orders:write': 'Create and manage orders',
  'inventory:read': 'View inventory levels',
  'inventory:write': 'Update inventory',
  'customers:read': 'View customer data',
  'customers:write': 'Manage customers',
  'payments:read': 'View payment history',
  'payments:write': 'Process payments',
  'webhooks:manage': 'Manage webhooks',
}

// Authorization Code Flow
export async function initiateAuth(
  clientId: string,
  redirectUri: string,
  scope: string[],
  state: string
): Promise<string> {
  const db = await connectDB()
  const client = await db.collection('oauth_clients').findOne({ clientId })
  
  if (!client) throw new Error('Invalid client')
  if (!client.redirectUris.includes(redirectUri)) throw new Error('Invalid redirect URI')
  
  const invalidScopes = scope.filter(s => !client.allowedScopes.includes(s))
  if (invalidScopes.length) throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`)
  
  const authCode = randomBytes(32).toString('hex')
  
  await db.collection('oauth_codes').insertOne({
    code: authCode,
    clientId,
    scope,
    redirectUri,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    createdAt: new Date(),
  })
  
  return `${redirectUri}?code=${authCode}&state=${state}`
}

// Token Exchange
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthToken> {
  const db = await connectDB()
  
  const client = await db.collection('oauth_clients').findOne({ clientId })
  if (!client) throw new Error('Invalid client')
  
  const hashedSecret = createHash('sha256').update(clientSecret).digest('hex')
  if (client.clientSecret !== hashedSecret) throw new Error('Invalid client secret')
  
  const authCode = await db.collection('oauth_codes').findOneAndDelete({
    code,
    clientId,
    expiresAt: { $gt: new Date() },
  })
  
  if (!authCode) throw new Error('Invalid or expired code')
  
  const accessToken = randomBytes(32).toString('hex')
  const refreshToken = randomBytes(32).toString('hex')
  
  await db.collection('oauth_tokens').insertOne({
    accessToken: createHash('sha256').update(accessToken).digest('hex'),
    refreshToken: createHash('sha256').update(refreshToken).digest('hex'),
    clientId,
    scope: authCode.scope,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    createdAt: new Date(),
  })
  
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    scope: authCode.scope,
  }
}
```

---

## 3. API Design Standards

### 3.1 Response Format

```typescript
// lib/api-response.ts

// Success Response
interface APISuccessResponse<T> {
  success: true
  data: T
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
    timestamp: string
    requestId: string
  }
}

// Error Response
interface APIErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
    helpUrl?: string
  }
  meta: {
    timestamp: string
    requestId: string
  }
}

// Response Helpers
export function successResponse<T>(data: T, meta?: Partial<APISuccessResponse<T>['meta']>): NextResponse {
  const response: APISuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      ...meta,
    },
  }
  return NextResponse.json(response)
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, string[]>
): NextResponse {
  const response: APIErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
      helpUrl: `https://docs.saramobiles.com/errors/${code.toLowerCase()}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  }
  return NextResponse.json(response, { status })
}

// Error Codes
export const ERROR_CODES = {
  // Authentication
  INVALID_API_KEY: { message: 'API key is invalid or missing', status: 401 },
  EXPIRED_API_KEY: { message: 'API key has expired', status: 401 },
  INVALID_TOKEN: { message: 'OAuth token is invalid', status: 401 },
  
  // Authorization
  FORBIDDEN: { message: 'Insufficient permissions for this action', status: 403 },
  SCOPE_REQUIRED: { message: 'Required scope not granted', status: 403 },
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: { message: 'Too many requests', status: 429 },
  QUOTA_EXCEEDED: { message: 'Daily quota exceeded', status: 429 },
  
  // Resources
  NOT_FOUND: { message: 'Resource not found', status: 404 },
  CONFLICT: { message: 'Resource conflict', status: 409 },
  GONE: { message: 'Resource no longer available', status: 410 },
  
  // Validation
  VALIDATION_ERROR: { message: 'Request validation failed', status: 400 },
  INVALID_FORMAT: { message: 'Invalid data format', status: 400 },
  
  // Server
  INTERNAL_ERROR: { message: 'Internal server error', status: 500 },
  SERVICE_UNAVAILABLE: { message: 'Service temporarily unavailable', status: 503 },
}
```

### 3.2 Request Validation

```typescript
// lib/api-validation.ts
import { z } from 'zod'

// Product Schemas
export const ProductQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'name', 'newest', 'popular']).default('newest'),
  search: z.string().optional(),
  fields: z.string().optional(), // Comma-separated field selection
})

// Order Schemas
export const CreateOrderSchema = z.object({
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(2),
    phone: z.string().min(10),
  }),
  shippingAddress: z.object({
    line1: z.string().min(5),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().length(6),
    country: z.string().default('IN'),
  }),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1).max(100),
    price: z.number().optional(), // Optional, will be validated against catalog
  })).min(1),
  paymentMethod: z.enum(['prepaid', 'cod', 'partner_gateway']),
  metadata: z.record(z.string()).optional(),
  externalOrderId: z.string().optional(),
})

// Validation Middleware
export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ data: T } | { error: APIErrorResponse }> {
  try {
    if (request.method === 'GET') {
      const params = Object.fromEntries(new URL(request.url).searchParams)
      const data = await schema.parseAsync(params)
      return { data }
    } else {
      const body = await request.json()
      const data = await schema.parseAsync(body)
      return { data }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details: Record<string, string[]> = {}
      error.errors.forEach(err => {
        const path = err.path.join('.')
        if (!details[path]) details[path] = []
        details[path].push(err.message)
      })
      
      return {
        error: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        },
      }
    }
    throw error
  }
}
```

### 3.3 Field Selection & Expansion

```typescript
// lib/api-fields.ts

// Field selection for optimized responses
export function selectFields<T extends Record<string, any>>(
  data: T,
  fields: string | undefined
): Partial<T> {
  if (!fields) return data
  
  const fieldList = fields.split(',').map(f => f.trim())
  const result: Partial<T> = {}
  
  for (const field of fieldList) {
    if (field in data) {
      result[field as keyof T] = data[field]
    }
  }
  
  return result
}

// Expansion for related resources
export async function expandRelations<T extends Record<string, any>>(
  data: T,
  expand: string | undefined,
  expansionConfig: ExpansionConfig
): Promise<T> {
  if (!expand) return data
  
  const expandList = expand.split(',').map(e => e.trim())
  const result = { ...data }
  
  for (const relation of expandList) {
    if (relation in expansionConfig) {
      const { collection, foreignKey, select } = expansionConfig[relation]
      const db = await connectDB()
      
      const relatedData = await db.collection(collection).findOne(
        { _id: new ObjectId(data[foreignKey]) },
        { projection: select }
      )
      
      result[relation] = relatedData
    }
  }
  
  return result
}

// Example usage in products endpoint
// GET /v1/products/123?fields=id,name,price&expand=category,brand
```

---

## 4. Rate Limiting & Quotas

### 4.1 Tiered Rate Limiting

```typescript
// lib/rate-limiter.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerDay: number
  burstLimit: number // Max requests in 1 second
}

const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: { requestsPerMinute: 60, requestsPerDay: 1000, burstLimit: 5 },
  basic: { requestsPerMinute: 300, requestsPerDay: 10000, burstLimit: 20 },
  pro: { requestsPerMinute: 1000, requestsPerDay: 100000, burstLimit: 50 },
  enterprise: { requestsPerMinute: 5000, requestsPerDay: 1000000, burstLimit: 200 },
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  reset: number
  retryAfter?: number
}

export async function checkRateLimit(
  apiKeyId: string,
  tier: string
): Promise<RateLimitResult> {
  const config = TIER_LIMITS[tier] || TIER_LIMITS.free
  const now = Date.now()
  const minuteKey = `ratelimit:${apiKeyId}:${Math.floor(now / 60000)}`
  const dayKey = `ratelimit:${apiKeyId}:${new Date().toISOString().split('T')[0]}`
  const burstKey = `ratelimit:${apiKeyId}:burst:${Math.floor(now / 1000)}`
  
  // Check burst limit (per second)
  const burstCount = await redis.incr(burstKey)
  if (burstCount === 1) {
    await redis.expire(burstKey, 2)
  }
  if (burstCount > config.burstLimit) {
    return {
      allowed: false,
      remaining: 0,
      limit: config.burstLimit,
      reset: Math.ceil(now / 1000) * 1000 + 1000,
      retryAfter: 1,
    }
  }
  
  // Check per-minute limit
  const minuteCount = await redis.incr(minuteKey)
  if (minuteCount === 1) {
    await redis.expire(minuteKey, 60)
  }
  if (minuteCount > config.requestsPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      limit: config.requestsPerMinute,
      reset: (Math.floor(now / 60000) + 1) * 60000,
      retryAfter: 60 - (now % 60000) / 1000,
    }
  }
  
  // Check daily limit
  const dayCount = await redis.incr(dayKey)
  if (dayCount === 1) {
    await redis.expire(dayKey, 86400)
  }
  if (dayCount > config.requestsPerDay) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    return {
      allowed: false,
      remaining: 0,
      limit: config.requestsPerDay,
      reset: tomorrow.getTime(),
      retryAfter: Math.ceil((tomorrow.getTime() - now) / 1000),
    }
  }
  
  return {
    allowed: true,
    remaining: config.requestsPerMinute - minuteCount,
    limit: config.requestsPerMinute,
    reset: (Math.floor(now / 60000) + 1) * 60000,
  }
}
```

### 4.2 Quota Management

```typescript
// lib/quota.ts
export interface QuotaUsage {
  apiKeyId: string
  period: string // YYYY-MM
  metrics: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    dataTransferred: number // bytes
    webhookDeliveries: number
  }
  limits: {
    requests: number
    dataTransfer: number
    webhooks: number
  }
}

export async function trackQuotaUsage(
  apiKeyId: string,
  bytes: number
): Promise<void> {
  const period = new Date().toISOString().slice(0, 7) // YYYY-MM
  const db = await connectDB()
  
  await db.collection('quota_usage').updateOne(
    { apiKeyId, period },
    {
      $inc: {
        'metrics.totalRequests': 1,
        'metrics.successfulRequests': 1,
        'metrics.dataTransferred': bytes,
      },
    },
    { upsert: true }
  )
}

export async function getQuotaStatus(apiKeyId: string): Promise<QuotaUsage> {
  const period = new Date().toISOString().slice(0, 7)
  const db = await connectDB()
  
  const usage = await db.collection('quota_usage').findOne({ apiKeyId, period })
  const apiKey = await db.collection('api_keys').findOne({ id: apiKeyId })
  
  const limits = getQuotaLimits(apiKey?.tier || 'free')
  
  return {
    apiKeyId,
    period,
    metrics: usage?.metrics || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      dataTransferred: 0,
      webhookDeliveries: 0,
    },
    limits,
  }
}
```

---

## 5. Partner Integration Examples

### 5.1 External Website - Product Display

**Scenario**: Company A wants to display Sara Mobiles products on their website

```typescript
// External Partner Code Example

// Initialize SDK
import { SaraMobilesSDK } from '@saramobiles/sdk'

const sara = new SaraMobilesSDK({
  apiKey: 'sk_live_xxxxxxxxxxxxx',
  environment: 'production',
})

// Fetch products for display
async function displayProducts() {
  const products = await sara.products.list({
    category: 'Smartphones',
    limit: 20,
    sort: 'popular',
    fields: 'id,name,price,images,brand,rating',
  })
  
  return products.data.map(product => ({
    id: product.id,
    title: product.name,
    price: `₹${product.price.toLocaleString()}`,
    image: product.images[0],
    brand: product.brand,
    rating: product.rating,
    buyUrl: `https://saramobiles.com/product/${product.id}?ref=${PARTNER_ID}`,
  }))
}

// Check real-time availability
async function checkAvailability(productId: string, pincode: string) {
  const availability = await sara.products.checkAvailability(productId, {
    pincode,
    quantity: 1,
  })
  
  return {
    inStock: availability.available,
    deliveryDate: availability.estimatedDelivery,
    shippingCost: availability.shippingCost,
  }
}
```

### 5.2 Payment Gateway Integration

**Scenario**: Company B handles payments, Sara Mobiles fulfills orders

```typescript
// Partner Payment Gateway Integration

// 1. Partner creates order with pending payment
const orderRequest = {
  customer: {
    email: 'customer@example.com',
    name: 'John Doe',
    phone: '9876543210',
  },
  shippingAddress: {
    line1: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  items: [
    { productId: 'prod_abc123', quantity: 1 },
    { productId: 'prod_def456', quantity: 2 },
  ],
  paymentMethod: 'partner_gateway',
  externalOrderId: 'PARTNER-ORD-12345',
}

const order = await sara.orders.create(orderRequest)
// Returns: { orderId: 'ORD-xxx', status: 'payment_pending', total: 45999 }

// 2. Partner processes payment on their gateway
const payment = await partnerGateway.charge({
  amount: order.total,
  currency: 'INR',
  metadata: { saraOrderId: order.orderId },
})

// 3. Partner confirms payment to Sara Mobiles
await sara.orders.confirmPayment(order.orderId, {
  paymentId: payment.id,
  paymentMethod: 'card',
  gatewayReference: payment.transactionId,
  paidAmount: order.total,
})

// 4. Sara Mobiles fulfills order, partner receives webhook updates
```

### 5.3 Shared Data Sync

**Scenario**: Multi-platform inventory and order sync

```typescript
// Central Inventory Sync System

class InventorySyncService {
  private platforms: Platform[] = [
    { name: 'Sara Mobiles', api: new SaraMobilesSDK({ apiKey: '...' }) },
    { name: 'Amazon', api: new AmazonSPAPI({ credentials: '...' }) },
    { name: 'Flipkart', api: new FlipkartAPI({ credentials: '...' }) },
  ]
  
  async syncInventory(sku: string, quantity: number) {
    const results = await Promise.allSettled(
      this.platforms.map(platform => 
        platform.api.inventory.update(sku, { quantity })
      )
    )
    
    return results.map((result, i) => ({
      platform: this.platforms[i].name,
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason : null,
    }))
  }
  
  async fetchOrdersFromAllPlatforms() {
    const orders = await Promise.all(
      this.platforms.map(platform =>
        platform.api.orders.list({ status: 'pending', since: '24h' })
      )
    )
    
    return orders.flat().map(order => ({
      ...order,
      source: order.platform,
    }))
  }
}

// Webhook handler for Sara Mobiles order updates
app.post('/webhooks/sara-mobiles', async (req, res) => {
  const { event, data } = req.body
  
  if (event === 'order.shipped') {
    // Update tracking on all platforms
    await Promise.all([
      updateAmazonTracking(data.externalOrderId, data.trackingNumber),
      updateFlipkartTracking(data.externalOrderId, data.trackingNumber),
      notifyCustomer(data.customer.email, data.trackingNumber),
    ])
  }
  
  res.sendStatus(200)
})
```

---

## 6. Webhook System

### 6.1 Webhook Configuration

```typescript
// types/webhook.ts
export interface Webhook {
  id: string
  partnerId: string
  url: string
  secret: string // For signature verification
  events: WebhookEvent[]
  status: 'active' | 'paused' | 'failing'
  failureCount: number
  lastDelivery?: Date
  lastError?: string
  createdAt: Date
}

export type WebhookEvent =
  | 'order.created'
  | 'order.paid'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'inventory.low'
  | 'inventory.updated'
  | 'payment.received'
  | 'payment.failed'
  | 'customer.created'

export interface WebhookPayload {
  id: string
  event: WebhookEvent
  timestamp: string
  data: Record<string, any>
  signature: string
}
```

### 6.2 Webhook Delivery

```typescript
// lib/webhook.ts
import { createHmac } from 'crypto'

export async function deliverWebhook(
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  const db = await connectDB()
  
  // Find all webhooks subscribed to this event
  const webhooks = await db.collection('webhooks')
    .find({
      events: event,
      status: { $ne: 'paused' },
    })
    .toArray()
  
  for (const webhook of webhooks) {
    const deliveryId = new ObjectId().toString()
    
    const payload: WebhookPayload = {
      id: deliveryId,
      event,
      timestamp: new Date().toISOString(),
      data,
      signature: '', // Will be set below
    }
    
    // Generate signature
    payload.signature = createHmac('sha256', webhook.secret)
      .update(JSON.stringify({ id: payload.id, event: payload.event, data: payload.data }))
      .digest('hex')
    
    // Queue for delivery
    await queueWebhookDelivery(webhook, payload)
  }
}

async function queueWebhookDelivery(
  webhook: Webhook,
  payload: WebhookPayload
): Promise<void> {
  const db = await connectDB()
  
  // Store delivery attempt
  await db.collection('webhook_deliveries').insertOne({
    webhookId: webhook.id,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  })
  
  // Trigger delivery (in production, use a queue like Redis/SQS)
  await attemptDelivery(webhook, payload)
}

async function attemptDelivery(
  webhook: Webhook,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<void> {
  const maxAttempts = 5
  const db = await connectDB()
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': payload.id,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Signature': payload.signature,
        'X-Webhook-Timestamp': payload.timestamp,
        'User-Agent': 'SaraMobiles-Webhook/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })
    
    if (response.ok) {
      // Success
      await db.collection('webhook_deliveries').updateOne(
        { 'payload.id': payload.id },
        { 
          $set: { 
            status: 'delivered',
            deliveredAt: new Date(),
            responseStatus: response.status,
          },
          $inc: { attempts: 1 },
        }
      )
      
      await db.collection('webhooks').updateOne(
        { id: webhook.id },
        { 
          $set: { 
            lastDelivery: new Date(),
            failureCount: 0,
            status: 'active',
          } 
        }
      )
    } else {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await db.collection('webhook_deliveries').updateOne(
      { 'payload.id': payload.id },
      { 
        $set: { 
          status: attempt >= maxAttempts ? 'failed' : 'retrying',
          lastError: errorMessage,
        },
        $inc: { attempts: 1 },
      }
    )
    
    if (attempt < maxAttempts) {
      // Exponential backoff: 1m, 5m, 15m, 60m
      const delays = [60, 300, 900, 3600]
      const delay = delays[attempt - 1] * 1000
      
      setTimeout(() => {
        attemptDelivery(webhook, payload, attempt + 1)
      }, delay)
    } else {
      // Mark webhook as failing
      await db.collection('webhooks').updateOne(
        { id: webhook.id },
        { 
          $inc: { failureCount: 1 },
          $set: { 
            lastError: errorMessage,
            status: 'failing',
          },
        }
      )
    }
  }
}
```

### 6.3 Webhook Signature Verification

```typescript
// Partner-side webhook verification
import { createHmac } from 'crypto'

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// Express middleware example
app.post('/webhooks/sara', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string
  const payload = req.body.toString()
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  
  const event = JSON.parse(payload)
  
  // Process event
  handleWebhookEvent(event)
  
  res.sendStatus(200)
})
```

---

## 7. SDK & Developer Tools

### 7.1 JavaScript/TypeScript SDK

```typescript
// @saramobiles/sdk

export class SaraMobilesSDK {
  private apiKey: string
  private baseUrl: string
  
  constructor(config: SDKConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.environment === 'production'
      ? 'https://api.saramobiles.com/v1'
      : 'https://sandbox.api.saramobiles.com/v1'
  }
  
  // Products API
  products = {
    list: (params?: ProductQueryParams) => this.request('GET', '/products', params),
    get: (id: string) => this.request('GET', `/products/${id}`),
    search: (query: string, params?: SearchParams) => this.request('GET', '/products/search', { q: query, ...params }),
    checkAvailability: (id: string, params: AvailabilityParams) => this.request('GET', `/products/${id}/availability`, params),
  }
  
  // Orders API
  orders = {
    create: (data: CreateOrderRequest) => this.request('POST', '/orders', undefined, data),
    get: (id: string) => this.request('GET', `/orders/${id}`),
    list: (params?: OrderQueryParams) => this.request('GET', '/orders', params),
    cancel: (id: string, reason?: string) => this.request('PUT', `/orders/${id}/cancel`, undefined, { reason }),
    confirmPayment: (id: string, data: PaymentConfirmation) => this.request('POST', `/orders/${id}/payment`, undefined, data),
    track: (id: string) => this.request('GET', `/orders/${id}/tracking`),
  }
  
  // Inventory API
  inventory = {
    get: (productId: string) => this.request('GET', `/inventory/${productId}`),
    update: (productId: string, data: InventoryUpdate) => this.request('PUT', `/inventory/${productId}`, undefined, data),
    bulkUpdate: (data: BulkInventoryUpdate[]) => this.request('POST', '/inventory/bulk', undefined, { items: data }),
  }
  
  // Webhooks API
  webhooks = {
    create: (data: CreateWebhookRequest) => this.request('POST', '/webhooks', undefined, data),
    list: () => this.request('GET', '/webhooks'),
    delete: (id: string) => this.request('DELETE', `/webhooks/${id}`),
    test: (id: string) => this.request('POST', `/webhooks/${id}/test`),
  }
  
  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, any>,
    body?: Record<string, any>
  ): Promise<APIResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value))
      })
    }
    
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-SDK-Version': '1.0.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new SaraMobilesError(data.error.code, data.error.message, response.status)
    }
    
    return data
  }
}

export class SaraMobilesError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'SaraMobilesError'
  }
}
```

### 7.2 Developer Portal

```typescript
// app/developers/page.tsx
export default function DeveloperPortal() {
  return (
    <div className="max-w-7xl mx-auto py-12">
      <h1 className="text-4xl font-bold mb-8">Developer Portal</h1>
      
      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
        <div className="grid grid-cols-3 gap-6">
          <QuickStartCard
            title="Get API Key"
            description="Create your first API key to start integrating"
            link="/developers/keys"
          />
          <QuickStartCard
            title="Read Documentation"
            description="Comprehensive API reference and guides"
            link="/developers/docs"
          />
          <QuickStartCard
            title="Try Sandbox"
            description="Test your integration in our sandbox environment"
            link="/developers/sandbox"
          />
        </div>
      </section>
      
      {/* API Keys Management */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Your API Keys</h2>
        <APIKeysList />
      </section>
      
      {/* Usage Statistics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Usage Statistics</h2>
        <UsageChart />
      </section>
      
      {/* Webhooks */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Webhooks</h2>
        <WebhooksList />
      </section>
    </div>
  )
}
```

### 7.3 API Console

```typescript
// Interactive API Console Component
export function APIConsole() {
  const [endpoint, setEndpoint] = useState('/products')
  const [method, setMethod] = useState('GET')
  const [params, setParams] = useState('{}')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const executeRequest = async () => {
    setLoading(true)
    try {
      const result = await fetch(`/api/console/execute`, {
        method: 'POST',
        body: JSON.stringify({ endpoint, method, params: JSON.parse(params) }),
      })
      setResponse(await result.json())
    } catch (error) {
      setResponse({ error: 'Request failed' })
    }
    setLoading(false)
  }
  
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex gap-2">
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input
            value={endpoint}
            onChange={e => setEndpoint(e.target.value)}
            className="flex-1 border rounded px-3"
            placeholder="/products"
          />
        </div>
        
        <textarea
          value={params}
          onChange={e => setParams(e.target.value)}
          className="w-full h-48 font-mono text-sm border rounded p-3"
          placeholder="Request parameters (JSON)"
        />
        
        <button
          onClick={executeRequest}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          {loading ? 'Executing...' : 'Execute Request'}
        </button>
      </div>
      
      <div>
        <h3 className="font-semibold mb-2">Response</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded h-80 overflow-auto text-sm">
          {response ? JSON.stringify(response, null, 2) : 'No response yet'}
        </pre>
      </div>
    </div>
  )
}
```

---

## 8. API Marketplace

### 8.1 Marketplace Structure

```typescript
// types/marketplace.ts
export interface APIProduct {
  id: string
  name: string
  description: string
  category: 'products' | 'orders' | 'inventory' | 'payments' | 'analytics' | 'full-access'
  pricing: {
    model: 'free' | 'per-request' | 'subscription'
    price?: number
    includedRequests?: number
    overagePrice?: number
  }
  features: string[]
  documentation: string
  sandbox: boolean
}

export interface PartnerSubscription {
  partnerId: string
  productId: string
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
  status: 'active' | 'cancelled' | 'suspended'
  billingCycle: 'monthly' | 'yearly'
  currentPeriodEnd: Date
  usage: {
    requests: number
    dataTransfer: number
  }
}
```

### 8.2 API Products Catalog

```typescript
const API_PRODUCTS: APIProduct[] = [
  {
    id: 'product-catalog',
    name: 'Product Catalog API',
    description: 'Access our complete product catalog with real-time pricing and availability',
    category: 'products',
    pricing: {
      model: 'free',
      includedRequests: 1000,
    },
    features: [
      'Full product listings',
      'Category navigation',
      'Search and filtering',
      'Real-time stock levels',
      'Product images and specifications',
    ],
    documentation: '/docs/products',
    sandbox: true,
  },
  {
    id: 'order-management',
    name: 'Order Management API',
    description: 'Create, track, and manage orders programmatically',
    category: 'orders',
    pricing: {
      model: 'per-request',
      price: 0.01, // ₹0.01 per order created
    },
    features: [
      'Create orders',
      'Real-time status updates',
      'Shipment tracking',
      'Return processing',
      'Invoice generation',
    ],
    documentation: '/docs/orders',
    sandbox: true,
  },
  {
    id: 'inventory-sync',
    name: 'Inventory Sync API',
    description: 'Real-time inventory synchronization across platforms',
    category: 'inventory',
    pricing: {
      model: 'subscription',
      price: 4999, // ₹4,999/month
      includedRequests: 50000,
      overagePrice: 0.001,
    },
    features: [
      'Real-time stock updates',
      'Low stock alerts',
      'Multi-warehouse support',
      'Bulk updates',
      'Webhooks for changes',
    ],
    documentation: '/docs/inventory',
    sandbox: true,
  },
  {
    id: 'payment-processing',
    name: 'Payment Processing API',
    description: 'Process payments through Sara Mobiles\' payment infrastructure',
    category: 'payments',
    pricing: {
      model: 'per-request',
      price: 2, // 2% of transaction
    },
    features: [
      'Multiple payment methods',
      'Refund processing',
      'Split payments',
      'Recurring billing',
      'PCI DSS compliant',
    ],
    documentation: '/docs/payments',
    sandbox: true,
  },
  {
    id: 'analytics-insights',
    name: 'Analytics & Insights API',
    description: 'Access sales analytics and market insights',
    category: 'analytics',
    pricing: {
      model: 'subscription',
      price: 9999, // ₹9,999/month
    },
    features: [
      'Sales reports',
      'Customer insights',
      'Product performance',
      'Market trends',
      'Custom reports',
    ],
    documentation: '/docs/analytics',
    sandbox: false,
  },
]
```

---

## 9. Security & Compliance

### 9.1 API Security Checklist

```typescript
// lib/api-security.ts

// Security middleware
export async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // 1. HTTPS enforcement
  if (process.env.NODE_ENV === 'production' && !request.headers.get('x-forwarded-proto')?.includes('https')) {
    return NextResponse.json({ error: 'HTTPS required' }, { status: 400 })
  }
  
  // 2. IP allowlist check (for enterprise partners)
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]
  const apiKey = await validateAPIKey(request)
  
  if (apiKey?.allowedIPs?.length && !apiKey.allowedIPs.includes(clientIP || '')) {
    await logSecurityEvent('IP_BLOCKED', { apiKey: apiKey.prefix, ip: clientIP })
    return NextResponse.json({ error: 'IP not allowed' }, { status: 403 })
  }
  
  // 3. Request size limits
  const contentLength = parseInt(request.headers.get('content-length') || '0')
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }
  
  // 4. Check for suspicious patterns
  const isSuspicious = await checkSuspiciousActivity(apiKey?.id || 'anonymous', clientIP || '')
  if (isSuspicious) {
    return NextResponse.json({ error: 'Suspicious activity detected' }, { status: 429 })
  }
  
  return null // Continue processing
}

// Audit logging
export async function logAPIAccess(
  apiKeyId: string,
  request: NextRequest,
  response: NextResponse,
  duration: number
): Promise<void> {
  const db = await connectDB()
  
  await db.collection('api_access_logs').insertOne({
    apiKeyId,
    method: request.method,
    path: new URL(request.url).pathname,
    queryParams: Object.fromEntries(new URL(request.url).searchParams),
    statusCode: response.status,
    duration,
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date(),
  })
}

// Anomaly detection
async function checkSuspiciousActivity(apiKeyId: string, ip: string): Promise<boolean> {
  const redis = new Redis(process.env.UPSTASH_REDIS_URL!)
  
  // Check for rapid repeated failures
  const failureKey = `security:failures:${apiKeyId}`
  const failures = await redis.get(failureKey)
  if (parseInt(failures || '0') > 50) return true
  
  // Check for unusual patterns
  const patternKey = `security:patterns:${apiKeyId}`
  const recentRequests = await redis.lrange(patternKey, 0, 99)
  
  // Simple pattern detection: too many different endpoints in short time
  const uniqueEndpoints = new Set(recentRequests).size
  if (recentRequests.length > 50 && uniqueEndpoints > 40) return true
  
  return false
}
```

### 9.2 Data Privacy & Access Control

```typescript
// lib/data-privacy.ts

// Data masking for sensitive fields
export function maskSensitiveData(data: Record<string, any>, fields: string[]): Record<string, any> {
  const masked = { ...data }
  
  for (const field of fields) {
    if (field in masked) {
      const value = masked[field]
      if (typeof value === 'string') {
        if (field.includes('email')) {
          masked[field] = maskEmail(value)
        } else if (field.includes('phone')) {
          masked[field] = maskPhone(value)
        } else if (field.includes('card')) {
          masked[field] = `****${value.slice(-4)}`
        } else {
          masked[field] = '***REDACTED***'
        }
      }
    }
  }
  
  return masked
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 2)}***@${domain}`
}

function maskPhone(phone: string): string {
  return `****${phone.slice(-4)}`
}

// Permission-based data filtering
export function filterByPermission(
  data: Record<string, any>,
  permissions: Permission[]
): Record<string, any> {
  const allowedFields = getFieldsByPermissions(permissions)
  const filtered: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key) || allowedFields.includes('*')) {
      filtered[key] = value
    }
  }
  
  return filtered
}
```

---

## 10. Real-World Use Cases

### 10.1 Use Case: Multi-Channel Retail

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-CHANNEL RETAIL INTEGRATION                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐             │
│   │  Physical   │     │  Website    │     │  Mobile App │             │
│   │   Store     │     │  (React)    │     │  (Flutter)  │             │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘             │
│          │                   │                   │                     │
│          └───────────────────┼───────────────────┘                     │
│                              │                                         │
│                              ▼                                         │
│                    ┌─────────────────────┐                             │
│                    │   Sara Mobiles API  │                             │
│                    │  • Product Catalog  │                             │
│                    │  • Inventory Sync   │                             │
│                    │  • Order Creation   │                             │
│                    │  • Payment Processing│                             │
│                    └─────────────────────┘                             │
│                              │                                         │
│              ┌───────────────┼───────────────┐                         │
│              ▼               ▼               ▼                         │
│        ┌──────────┐   ┌──────────┐   ┌──────────┐                     │
│        │  Orders  │   │ Inventory│   │ Analytics│                     │
│        │   Sync   │   │   Sync   │   │   Data   │                     │
│        └──────────┘   └──────────┘   └──────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
// Retailer's unified commerce platform
class UnifiedCommerceService {
  private sara = new SaraMobilesSDK({ apiKey: process.env.SARA_API_KEY! })
  
  // Sync products to all channels
  async syncProductsToChannels() {
    const products = await this.sara.products.list({ limit: 100 })
    
    await Promise.all([
      this.syncToWebsite(products.data),
      this.syncToMobileApp(products.data),
      this.syncToPOS(products.data),
    ])
  }
  
  // Unified order placement
  async createOrder(channel: string, orderData: OrderRequest) {
    const order = await this.sara.orders.create({
      ...orderData,
      metadata: {
        channel,
        deviceId: orderData.deviceId,
      },
    })
    
    // Track for analytics
    await this.analytics.trackOrder(order, channel)
    
    return order
  }
  
  // Real-time inventory across channels
  async handleSale(productId: string, quantity: number) {
    // Inventory is automatically updated via webhook
    // Just need to reflect in local systems
    await this.updateLocalInventory(productId, quantity)
  }
}
```

### 10.2 Use Case: Affiliate Marketing Platform

```typescript
// Affiliate platform integration
class AffiliateIntegration {
  private sara = new SaraMobilesSDK({ apiKey: process.env.SARA_API_KEY! })
  
  // Display products with affiliate links
  async getProductsForAffiliate(affiliateId: string, category: string) {
    const products = await this.sara.products.list({ category, limit: 50 })
    
    return products.data.map(product => ({
      ...product,
      affiliateLink: this.generateAffiliateLink(product.id, affiliateId),
      commission: this.calculateCommission(product.price, product.category),
    }))
  }
  
  generateAffiliateLink(productId: string, affiliateId: string): string {
    return `https://saramobiles.com/product/${productId}?ref=${affiliateId}`
  }
  
  // Track conversions via webhook
  async handleConversionWebhook(event: WebhookPayload) {
    if (event.event === 'order.paid') {
      const affiliateId = event.data.metadata?.ref
      if (affiliateId) {
        await this.creditAffiliateCommission(affiliateId, event.data)
      }
    }
  }
}
```

### 10.3 Use Case: B2B Procurement Platform

```typescript
// B2B procurement integration
class B2BProcurementService {
  private sara = new SaraMobilesSDK({ apiKey: process.env.SARA_API_KEY! })
  
  // Bulk product catalog sync
  async syncCatalogForCorporate(corporateId: string) {
    const products = await this.sara.products.list({ 
      limit: 1000,
      fields: 'id,name,sku,price,stock,category,specifications',
    })
    
    // Apply corporate pricing
    const corporatePricing = await this.getCorporatePricing(corporateId)
    
    return products.data.map(product => ({
      ...product,
      corporatePrice: this.applyDiscount(product.price, corporatePricing.discount),
      moq: this.getMinimumOrderQuantity(product.category),
    }))
  }
  
  // Bulk order with approval workflow
  async createBulkOrder(corporateId: string, items: BulkOrderItem[]) {
    // Validate stock availability
    const availability = await Promise.all(
      items.map(item => this.sara.products.checkAvailability(item.productId, { quantity: item.quantity }))
    )
    
    const unavailable = availability.filter(a => !a.available)
    if (unavailable.length > 0) {
      throw new Error(`Some items are unavailable: ${unavailable.map(u => u.productId).join(', ')}`)
    }
    
    // Create order with corporate payment terms
    const order = await this.sara.orders.create({
      items,
      paymentMethod: 'corporate_credit',
      metadata: { corporateId, approvalRequired: true },
    })
    
    return order
  }
}
```

---

## Summary

This API & Plugin Ecosystem documentation covers:

| Component | Purpose |
|-----------|---------|
| **Public API Architecture** | Versioned, scalable API design |
| **Authentication** | API keys + OAuth2 implementation |
| **API Standards** | Response formats, validation, field selection |
| **Rate Limiting** | Tiered limits with burst protection |
| **Partner Examples** | Product display, payments, data sync |
| **Webhooks** | Event-driven integrations |
| **SDK & Tools** | JavaScript SDK, developer portal, API console |
| **Marketplace** | API products and subscriptions |
| **Security** | Audit logging, anomaly detection, compliance |
| **Use Cases** | Multi-channel retail, affiliates, B2B |

**Next Steps**: See [06-IMPLEMENTATION-ROADMAP.md](./06-IMPLEMENTATION-ROADMAP.md) for phased API rollout plan.
