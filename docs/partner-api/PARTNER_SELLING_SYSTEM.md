# 🤝 Partner Selling System (B2B API Ecosystem)

> **Version**: 1.0.0  
> **Status**: ✅ Implementation Complete  
> **Last Updated**: February 2025

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Partner Onboarding](#3-partner-onboarding)
4. [API Specifications](#4-api-specifications)
5. [Authentication & Security](#5-authentication--security)
6. [Rate Limiting & Quotas](#6-rate-limiting--quotas)
7. [Wallet & Settlement System](#7-wallet--settlement-system)
8. [Database Schema](#8-database-schema)
9. [Admin Dashboard](#9-admin-dashboard)
10. [Implementation Phases](#10-implementation-phases)
11. [Error Handling](#11-error-handling)
12. [Webhooks](#12-webhooks)
13. [Testing & Sandbox](#13-testing--sandbox)
14. [API Quick Reference](#14-api-quick-reference)

---

## 1. Executive Summary

### 1.1 Objective

Build a partner-selling system that allows external companies (partners) to sell our products on their own websites using our APIs, with a built-in wallet and settlement system, while keeping our platform as the **single source of truth**.

### 1.2 Core Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PARTNER SELLING ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     API Requests      ┌─────────────────────────────────┐ │
│   │  Partner A  │ ◄──────────────────► │                                  │ │
│   │  (Website)  │                       │                                  │ │
│   └─────────────┘                       │                                  │ │
│                                         │      BYTEWISE PLATFORM           │ │
│   ┌─────────────┐     API Requests      │      (Single Source of Truth)    │ │
│   │  Partner B  │ ◄──────────────────► │                                  │ │
│   │  (App)      │                       │  ┌─────────────────────────────┐ │ │
│   └─────────────┘                       │  │ • Product Management        │ │ │
│                                         │  │ • Order Processing          │ │ │
│   ┌─────────────┐     API Requests      │  │ • Payment & Settlement      │ │ │
│   │  Partner C  │ ◄──────────────────► │  │ • Wallet Management         │ │ │
│   │  (Kiosk)    │                       │  │ • Fulfillment               │ │ │
│   └─────────────┘                       │  └─────────────────────────────┘ │ │
│                                         │                                  │ │
│                                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Business Benefits

| Benefit | Description |
|---------|-------------|
| 📈 **Rapid Sales Growth** | Expand reach via partner network without building multiple storefronts |
| 💰 **Zero Storefront Cost** | Partners handle their own UI/UX and customer acquisition |
| 📊 **Clear Revenue Tracking** | Real-time tracking of sales per partner with audit logs |
| 🎛️ **Full Control** | Maintain control over products, pricing, and fulfillment |
| 🚀 **Easy Onboarding** | Self-service API key generation with tiered access |
| 🔒 **Secure Ecosystem** | API key authentication, rate limiting, and fraud prevention |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PARTNER API LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐               │
│   │   API Gateway │    │  Rate Limiter │    │  Auth Service │               │
│   │   /api/v1/    │───►│   (Per-Tier)  │───►│  (API Keys)   │               │
│   └───────────────┘    └───────────────┘    └───────────────┘               │
│           │                                         │                        │
│           ▼                                         ▼                        │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                         CORE SERVICES                                  │ │
│   ├───────────────┬───────────────┬───────────────┬───────────────────────┤ │
│   │   Products    │    Orders     │    Wallet     │    Partners           │ │
│   │   Service     │    Service    │    Service    │    Service            │ │
│   └───────────────┴───────────────┴───────────────┴───────────────────────┘ │
│                                     │                                        │
│                                     ▼                                        │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                         DATABASE LAYER                                 │ │
│   │                       (MongoDB Atlas)                                  │ │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐  │ │
│   │  │products │ │ orders  │ │partners │ │ wallets │ │wallet_transactions│ │ │
│   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘  │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 API Versioning Strategy

All partner APIs will be versioned under `/api/v1/partner/`:

```
/api/v1/partner/products        # Product catalog
/api/v1/partner/orders          # Order management
/api/v1/partner/wallet          # Wallet operations
/api/v1/partner/auth            # Authentication
```

---

## 3. Partner Onboarding

### 3.1 Partner Registration Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Partner   │    │   Admin     │    │  API Key    │    │   Partner   │
│   Applies   │───►│   Review    │───►│  Generated  │───►│   Active    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                   │                  │                  │
      ▼                   ▼                  ▼                  ▼
  Submit Form      Verify Business      Send to Email      Start Selling
  with Documents   & Compliance         (Encrypted)        via API
```

### 3.2 Partner Tiers

| Tier | Rate Limit | Commission | Features |
|------|------------|------------|----------|
| **Starter** | 60 req/min, 1,000/day | 15% | Basic product access, order creation |
| **Growth** | 300 req/min, 10,000/day | 12% | + Bulk operations, webhooks |
| **Professional** | 1,000 req/min, 100,000/day | 10% | + Priority support, analytics |
| **Enterprise** | 5,000 req/min, 1,000,000/day | Custom | + Dedicated support, SLA |

### 3.3 Partner Data Structure

```typescript
interface Partner {
  id: string;                    // Unique partner ID
  name: string;                  // Company name
  email: string;                 // Primary contact email
  phone: string;                 // Contact phone
  website?: string;              // Partner website URL
  
  // Business details
  businessDetails: {
    gstin: string;               // GST number
    pan: string;                 // PAN number
    businessType: 'sole_proprietorship' | 'partnership' | 'llp' | 'pvt_ltd' | 'public_ltd';
    registeredAddress: Address;
  };
  
  // API access
  tier: 'starter' | 'growth' | 'professional' | 'enterprise';
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  
  // Permissions
  permissions: {
    products: ['read'];                        // Always read-only
    orders: ['read', 'create'];                // Create and track orders
    wallet: ['read', 'request_payout'];        // View and request payouts
  };
  
  // Wallet reference
  walletId: string;
  
  // Commission settings
  commissionRate: number;        // Percentage (e.g., 12 = 12%)
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  
  // Verification
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;           // Admin user ID
  
  // Documents
  documents: {
    type: 'gstin_certificate' | 'pan_card' | 'business_registration' | 'address_proof';
    url: string;
    verified: boolean;
  }[];
}
```

---

## 4. API Specifications

### 4.1 Products API

#### 4.1.1 List Products

```http
GET /api/v1/partner/products
Authorization: Bearer {api_key}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (max: 100, default: 20) |
| `category` | string | No | Filter by category |
| `search` | string | No | Search by name/SKU |
| `minPrice` | number | No | Minimum price filter |
| `maxPrice` | number | No | Maximum price filter |
| `inStock` | boolean | No | Only show in-stock items |

**Response:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_abc123",
        "sku": "BW-TV-55-4K",
        "name": "55 inch 4K Smart TV",
        "description": "Ultra HD Smart Television with HDR",
        "category": "televisions",
        "subCategory": "smart-tv",
        "price": 45999,
        "mrp": 59999,
        "discount": 23,
        "stock": 150,
        "inStock": true,
        "images": [
          "https://cdn.bytewise.com/products/tv-55-4k-1.jpg",
          "https://cdn.bytewise.com/products/tv-55-4k-2.jpg"
        ],
        "specifications": {
          "screenSize": "55 inches",
          "resolution": "3840 x 2160",
          "refreshRate": "60Hz"
        },
        "brand": "Samsung",
        "warranty": "2 years",
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-02-01T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "totalPages": 63,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "meta": {
    "requestId": "req_xyz789",
    "timestamp": "2026-02-01T12:00:00Z"
  }
}
```

#### 4.1.2 Get Product Details

```http
GET /api/v1/partner/products/{productId}
Authorization: Bearer {api_key}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "prod_abc123",
    "sku": "BW-TV-55-4K",
    "name": "55 inch 4K Smart TV",
    "description": "Ultra HD Smart Television with HDR support...",
    "category": "televisions",
    "subCategory": "smart-tv",
    "price": 45999,
    "mrp": 59999,
    "discount": 23,
    "stock": 150,
    "inStock": true,
    "images": [
      {
        "url": "https://cdn.bytewise.com/products/tv-55-4k-1.jpg",
        "alt": "Front view",
        "isPrimary": true
      }
    ],
    "specifications": {
      "screenSize": "55 inches",
      "resolution": "3840 x 2160",
      "refreshRate": "60Hz",
      "smartFeatures": ["Netflix", "Prime Video", "YouTube"]
    },
    "brand": "Samsung",
    "model": "UA55AU7700",
    "warranty": "2 years",
    "deliveryInfo": {
      "estimatedDays": 3,
      "freeDelivery": true,
      "installationAvailable": true
    },
    "highlights": [
      "Crystal 4K Processor",
      "HDR10+ Support",
      "Voice Assistant Built-in"
    ]
  }
}
```

#### 4.1.3 Check Stock & Pricing (Bulk)

```http
POST /api/v1/partner/products/stock-check
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**

```json
{
  "productIds": ["prod_abc123", "prod_def456", "prod_ghi789"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_abc123",
        "sku": "BW-TV-55-4K",
        "price": 45999,
        "mrp": 59999,
        "stock": 150,
        "inStock": true,
        "lastUpdated": "2026-02-01T08:00:00Z"
      },
      {
        "id": "prod_def456",
        "sku": "BW-WM-7KG",
        "price": 32999,
        "mrp": 39999,
        "stock": 0,
        "inStock": false,
        "lastUpdated": "2026-02-01T08:00:00Z"
      }
    ]
  }
}
```

---

### 4.2 Orders API

#### 4.2.1 Create Order

```http
POST /api/v1/partner/orders
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**

```json
{
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "address": {
      "line1": "123 Main Street",
      "line2": "Apartment 4B",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    }
  },
  "items": [
    {
      "productId": "prod_abc123",
      "quantity": 1
    },
    {
      "productId": "prod_def456",
      "quantity": 2
    }
  ],
  "paymentMethod": "prepaid",        // prepaid | cod
  "partnerOrderId": "PO-12345",      // Partner's internal order ID (optional)
  "notes": "Gift wrapping requested"  // Optional notes
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "BW-ORD-2026020112345",
    "partnerOrderId": "PO-12345",
    "status": "pending",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210"
    },
    "items": [
      {
        "productId": "prod_abc123",
        "name": "55 inch 4K Smart TV",
        "sku": "BW-TV-55-4K",
        "price": 45999,
        "quantity": 1,
        "subtotal": 45999
      },
      {
        "productId": "prod_def456",
        "name": "7KG Washing Machine",
        "sku": "BW-WM-7KG",
        "price": 32999,
        "quantity": 2,
        "subtotal": 65998
      }
    ],
    "summary": {
      "subtotal": 111997,
      "tax": 20159,
      "shipping": 0,
      "total": 132156
    },
    "partnerEarnings": {
      "orderValue": 132156,
      "commissionRate": 12,
      "commissionAmount": 15859,
      "netEarnings": 15859,
      "status": "pending"           // Credited after delivery
    },
    "paymentMethod": "prepaid",
    "estimatedDelivery": "2026-02-04",
    "createdAt": "2026-02-01T12:00:00Z"
  }
}
```

#### 4.2.2 Get Order Status

```http
GET /api/v1/partner/orders/{orderId}
Authorization: Bearer {api_key}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "BW-ORD-2026020112345",
    "partnerOrderId": "PO-12345",
    "status": "shipped",
    "statusHistory": [
      {
        "status": "pending",
        "timestamp": "2026-02-01T12:00:00Z"
      },
      {
        "status": "confirmed",
        "timestamp": "2026-02-01T12:05:00Z"
      },
      {
        "status": "processing",
        "timestamp": "2026-02-01T14:00:00Z"
      },
      {
        "status": "shipped",
        "timestamp": "2026-02-02T10:00:00Z",
        "details": {
          "carrier": "Delhivery",
          "trackingNumber": "DLV123456789",
          "trackingUrl": "https://tracking.delhivery.com/DLV123456789"
        }
      }
    ],
    "items": [...],
    "summary": {...},
    "partnerEarnings": {
      "orderValue": 132156,
      "commissionRate": 12,
      "commissionAmount": 15859,
      "netEarnings": 15859,
      "status": "pending"
    },
    "tracking": {
      "carrier": "Delhivery",
      "trackingNumber": "DLV123456789",
      "trackingUrl": "https://tracking.delhivery.com/DLV123456789",
      "estimatedDelivery": "2026-02-04"
    }
  }
}
```

#### 4.2.3 List Orders

```http
GET /api/v1/partner/orders
Authorization: Bearer {api_key}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (max: 50, default: 20) |
| `status` | string | No | Filter by status |
| `fromDate` | string | No | Start date (ISO 8601) |
| `toDate` | string | No | End date (ISO 8601) |
| `partnerOrderId` | string | No | Search by partner's order ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "BW-ORD-2026020112345",
        "partnerOrderId": "PO-12345",
        "status": "delivered",
        "customerName": "John Doe",
        "itemCount": 3,
        "total": 132156,
        "partnerEarnings": 15859,
        "createdAt": "2026-02-01T12:00:00Z",
        "deliveredAt": "2026-02-04T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    },
    "summary": {
      "totalOrders": 156,
      "totalRevenue": 4500000,
      "totalEarnings": 540000,
      "pendingEarnings": 45000
    }
  }
}
```

#### 4.2.4 Cancel Order

```http
POST /api/v1/partner/orders/{orderId}/cancel
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**

```json
{
  "reason": "customer_request",
  "notes": "Customer changed their mind"
}
```

**Allowed Reasons:**
- `customer_request`
- `out_of_stock`
- `pricing_error`
- `duplicate_order`
- `other`

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "BW-ORD-2026020112345",
    "status": "cancelled",
    "cancellationDetails": {
      "reason": "customer_request",
      "notes": "Customer changed their mind",
      "cancelledAt": "2026-02-01T14:00:00Z",
      "cancelledBy": "partner"
    },
    "refund": {
      "status": "processing",
      "amount": 132156,
      "estimatedDate": "2026-02-05"
    }
  }
}
```

---

### 4.3 Wallet API

#### 4.3.1 Get Wallet Balance

```http
GET /api/v1/partner/wallet/balance
Authorization: Bearer {api_key}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "walletId": "wallet_abc123",
    "partnerId": "partner_xyz789",
    "balance": {
      "available": 125000,           // Available for withdrawal
      "pending": 45000,              // Earnings from orders not yet delivered
      "held": 5000,                  // Held due to disputes/refunds
      "total": 175000                // Total (available + pending + held)
    },
    "currency": "INR",
    "lastUpdated": "2026-02-01T12:00:00Z",
    "stats": {
      "lifetimeEarnings": 2500000,
      "lifetimeWithdrawals": 2325000,
      "thisMonthEarnings": 175000
    }
  }
}
```

#### 4.3.2 Get Wallet Transactions

```http
GET /api/v1/partner/wallet/transactions
Authorization: Bearer {api_key}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (max: 100, default: 50) |
| `type` | string | No | Filter by type (credit, debit, hold, release) |
| `fromDate` | string | No | Start date (ISO 8601) |
| `toDate` | string | No | End date (ISO 8601) |

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_001",
        "type": "credit",
        "category": "order_commission",
        "amount": 15859,
        "balance": 125000,
        "description": "Commission for order BW-ORD-2026020112345",
        "orderId": "BW-ORD-2026020112345",
        "status": "completed",
        "createdAt": "2026-02-04T15:30:00Z"
      },
      {
        "id": "txn_002",
        "type": "debit",
        "category": "payout",
        "amount": 100000,
        "balance": 109141,
        "description": "Payout to bank account ****1234",
        "payoutId": "payout_xyz",
        "status": "completed",
        "createdAt": "2026-02-01T10:00:00Z"
      },
      {
        "id": "txn_003",
        "type": "hold",
        "category": "refund_hold",
        "amount": 5000,
        "balance": 209141,
        "description": "Hold for potential refund - Order BW-ORD-2026013145678",
        "orderId": "BW-ORD-2026013145678",
        "status": "active",
        "createdAt": "2026-01-31T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 234,
      "totalPages": 5
    }
  }
}
```

#### 4.3.3 Request Payout

```http
POST /api/v1/partner/wallet/payout
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**

```json
{
  "amount": 100000,
  "bankAccountId": "bank_acc_123",   // Pre-registered bank account
  "notes": "Monthly payout - January 2026"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "payoutId": "payout_abc123",
    "amount": 100000,
    "status": "pending_approval",      // Requires admin approval
    "bankAccount": {
      "bankName": "HDFC Bank",
      "accountNumber": "****1234",
      "ifsc": "HDFC0001234"
    },
    "estimatedArrival": "2026-02-03",  // 2-3 business days after approval
    "createdAt": "2026-02-01T12:00:00Z",
    "notes": "Monthly payout - January 2026"
  },
  "message": "Payout request submitted. Awaiting admin approval."
}
```

#### 4.3.4 Get Payout History

```http
GET /api/v1/partner/wallet/payouts
Authorization: Bearer {api_key}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "payouts": [
      {
        "payoutId": "payout_abc123",
        "amount": 100000,
        "status": "completed",
        "bankAccount": {
          "bankName": "HDFC Bank",
          "accountNumber": "****1234"
        },
        "requestedAt": "2026-02-01T12:00:00Z",
        "approvedAt": "2026-02-01T14:00:00Z",
        "completedAt": "2026-02-02T10:00:00Z",
        "transactionId": "NEFT123456789"
      }
    ],
    "pagination": {...}
  }
}
```

---

## 5. Authentication & Security

### 5.1 API Key Structure

```
sk_live_ptnr_{partnerId}_{randomBytes32}
sk_test_ptnr_{partnerId}_{randomBytes32}
```

**Example:**
```
sk_live_ptnr_xyz789_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

### 5.2 API Key Generation

```typescript
// lib/partner-api-key.ts
import { randomBytes, createHash } from 'crypto';
import { ObjectId } from 'mongodb';

interface PartnerAPIKey {
  id: string;
  partnerId: string;
  name: string;
  hashedKey: string;
  prefix: string;                // First 12 chars for identification
  environment: 'live' | 'test';
  tier: 'starter' | 'growth' | 'professional' | 'enterprise';
  permissions: Permission[];
  rateLimit: RateLimitConfig;
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date;
}

export async function generatePartnerAPIKey(
  partnerId: string,
  name: string,
  environment: 'live' | 'test',
  tier: string
): Promise<{ key: string; apiKey: PartnerAPIKey }> {
  const prefix = `sk_${environment}_ptnr_`;
  const secret = randomBytes(32).toString('base64url');
  const fullKey = `${prefix}${partnerId.slice(0, 6)}_${secret}`;
  const hashedKey = createHash('sha256').update(fullKey).digest('hex');
  
  const apiKey: PartnerAPIKey = {
    id: new ObjectId().toString(),
    partnerId,
    name,
    hashedKey,
    prefix: fullKey.slice(0, 20),
    environment,
    tier: tier as any,
    permissions: getDefaultPermissions(),
    rateLimit: getRateLimits(tier),
    status: 'active',
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };
  
  // Store in database
  await storeAPIKey(apiKey);
  
  // Return full key only once - never stored
  return { key: fullKey, apiKey };
}
```

### 5.3 Request Authentication

```typescript
// middleware/partner-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export async function validatePartnerAPIKey(request: NextRequest): Promise<PartnerAPIKey | null> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const apiKey = authHeader.slice(7);
  
  // Validate key format
  if (!apiKey.startsWith('sk_live_ptnr_') && !apiKey.startsWith('sk_test_ptnr_')) {
    return null;
  }
  
  // Hash and lookup
  const hashedKey = createHash('sha256').update(apiKey).digest('hex');
  const storedKey = await findAPIKeyByHash(hashedKey);
  
  if (!storedKey || storedKey.status !== 'active') {
    return null;
  }
  
  // Update last used timestamp
  await updateLastUsed(storedKey.id);
  
  return storedKey;
}
```

### 5.4 Security Headers

All responses include:

```http
X-Request-Id: req_abc123
X-Response-Time: 45ms
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 55
X-RateLimit-Reset: 1706788800
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

---

## 6. Rate Limiting & Quotas

### 6.1 Tier-Based Rate Limits

```typescript
// lib/partner-rate-limits.ts
export const PARTNER_RATE_LIMITS = {
  starter: {
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    burstLimit: 10,
    ordersPerDay: 50,
    productFetchLimit: 500,
  },
  growth: {
    requestsPerMinute: 300,
    requestsPerDay: 10000,
    burstLimit: 50,
    ordersPerDay: 500,
    productFetchLimit: 5000,
  },
  professional: {
    requestsPerMinute: 1000,
    requestsPerDay: 100000,
    burstLimit: 100,
    ordersPerDay: 2000,
    productFetchLimit: 50000,
  },
  enterprise: {
    requestsPerMinute: 5000,
    requestsPerDay: 1000000,
    burstLimit: 500,
    ordersPerDay: 10000,
    productFetchLimit: -1,  // Unlimited
  },
};
```

### 6.2 Endpoint-Specific Limits

| Endpoint | Starter | Growth | Professional | Enterprise |
|----------|---------|--------|--------------|------------|
| `GET /products` | 30/min | 100/min | 300/min | 1000/min |
| `GET /products/{id}` | 60/min | 300/min | 1000/min | 5000/min |
| `POST /products/stock-check` | 10/min | 50/min | 200/min | 500/min |
| `POST /orders` | 5/min | 20/min | 100/min | 500/min |
| `GET /orders` | 30/min | 100/min | 300/min | 1000/min |
| `GET /wallet/*` | 20/min | 60/min | 200/min | 500/min |
| `POST /wallet/payout` | 2/day | 5/day | 10/day | Unlimited |

### 6.3 Rate Limit Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please retry after 45 seconds.",
    "retryAfter": 45
  },
  "meta": {
    "limit": 60,
    "remaining": 0,
    "reset": 1706788845
  }
}
```

HTTP Headers:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706788845
Retry-After: 45
```

---

## 7. Wallet & Settlement System

### 7.1 Wallet Structure

```typescript
interface PartnerWallet {
  id: string;
  partnerId: string;
  
  balance: {
    available: number;           // Ready for withdrawal
    pending: number;             // From undelivered orders
    held: number;                // Under review/dispute
  };
  
  currency: 'INR';
  
  // Bank account for payouts
  bankAccounts: BankAccount[];
  defaultBankAccountId: string;
  
  // Minimum withdrawal amount
  minimumPayout: number;         // Default: ₹1,000
  
  // Auto-payout settings
  autoPayout: {
    enabled: boolean;
    threshold: number;           // Auto-payout when available balance exceeds
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;          // 0-6 for weekly
    dayOfMonth?: number;         // 1-28 for monthly
  };
  
  createdAt: Date;
  updatedAt: Date;
}

interface WalletTransaction {
  id: string;
  walletId: string;
  partnerId: string;
  
  type: 'credit' | 'debit' | 'hold' | 'release';
  category: 
    | 'order_commission'         // Credit: Commission from order
    | 'payout'                   // Debit: Withdrawal to bank
    | 'refund_adjustment'        // Debit: Refund deduction
    | 'bonus'                    // Credit: Promotional bonus
    | 'penalty'                  // Debit: Policy violation penalty
    | 'refund_hold'              // Hold: Potential refund
    | 'dispute_hold'             // Hold: Customer dispute
    | 'hold_release';            // Release: Resolved hold
  
  amount: number;
  balanceAfter: number;
  
  // Reference
  orderId?: string;
  payoutId?: string;
  
  description: string;
  notes?: string;
  
  status: 'pending' | 'completed' | 'failed' | 'active' | 'released';
  
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;          // Admin user ID
}
```

### 7.2 Commission Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMMISSION LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ORDER PLACED          ORDER DELIVERED        RETURN WINDOW CLOSED          │
│       │                      │                        │                      │
│       ▼                      ▼                        ▼                      │
│   ┌─────────┐          ┌─────────┐              ┌─────────┐                 │
│   │ Pending │ ───────► │ Pending │ ──────────► │Available│                 │
│   │ Balance │          │ Balance │              │ Balance │                 │
│   └─────────┘          └─────────┘              └─────────┘                 │
│                              │                        │                      │
│                              │ If Return             │                       │
│                              ▼ Requested             ▼                       │
│                        ┌─────────┐              ┌─────────┐                 │
│                        │  Held   │ ──────────► │ Adjusted│                 │
│                        │ Balance │  If Refunded │ Balance │                 │
│                        └─────────┘              └─────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Settlement Timeline

| Event | Action | Timeline |
|-------|--------|----------|
| Order Placed | Commission calculated → Pending Balance | Immediate |
| Order Delivered | Pending → Still Pending (return window) | Delivery date |
| Return Window Closed | Pending → Available | +7 days after delivery |
| Return Requested | Available → Held | Immediate |
| Return Approved | Held → Deducted | Within 24 hours |
| Return Rejected | Held → Available | Within 24 hours |
| Payout Requested | Debit from Available | Immediate |
| Payout Approved | Processing | Admin approval (1-2 days) |
| Payout Completed | Bank credit | 2-3 business days |

### 7.4 Payout Rules

```typescript
interface PayoutRules {
  minimumAmount: 1000,                    // ₹1,000 minimum
  maximumAmount: 1000000,                 // ₹10,00,000 per transaction
  processingFee: 0,                       // No fee (can be tiered)
  processingDays: 3,                      // Business days
  dailyLimit: 500000,                     // ₹5,00,000 per day
  weeklyLimit: 2000000,                   // ₹20,00,000 per week
  requiresApproval: {
    threshold: 100000,                    // Admin approval for > ₹1,00,000
    alwaysForNewPartners: true,           // First 3 months
  }
}
```

---

## 8. Database Schema

### 8.1 Collections Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PARTNER SYSTEM COLLECTIONS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   partners              partner_api_keys         partner_wallets             │
│   ├─ _id               ├─ _id                   ├─ _id                      │
│   ├─ name              ├─ partnerId ────────────├─ partnerId ───────────┐   │
│   ├─ email             ├─ hashedKey             ├─ balance               │   │
│   ├─ tier              ├─ tier                  ├─ bankAccounts          │   │
│   ├─ status            ├─ permissions           └─ autoPayout            │   │
│   ├─ commissionRate    ├─ status                                         │   │
│   └─ walletId ─────────└─ expiresAt                                      │   │
│         │                                                                 │   │
│         │              wallet_transactions       partner_orders           │   │
│         │              ├─ _id                   ├─ _id                   │   │
│         └──────────────├─ walletId              ├─ partnerId ────────────┤   │
│                        ├─ type                  ├─ orderId               │   │
│                        ├─ amount                ├─ status                │   │
│                        ├─ orderId               ├─ commission            │   │
│                        └─ status                └─ partnerOrderId        │   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Indexes

```javascript
// partners collection
db.partners.createIndex({ "email": 1 }, { unique: true });
db.partners.createIndex({ "status": 1, "tier": 1 });
db.partners.createIndex({ "createdAt": -1 });

// partner_api_keys collection
db.partner_api_keys.createIndex({ "hashedKey": 1 }, { unique: true });
db.partner_api_keys.createIndex({ "partnerId": 1, "status": 1 });
db.partner_api_keys.createIndex({ "prefix": 1 });

// partner_wallets collection
db.partner_wallets.createIndex({ "partnerId": 1 }, { unique: true });

// wallet_transactions collection
db.wallet_transactions.createIndex({ "walletId": 1, "createdAt": -1 });
db.wallet_transactions.createIndex({ "partnerId": 1, "type": 1 });
db.wallet_transactions.createIndex({ "orderId": 1 });
db.wallet_transactions.createIndex({ "status": 1 });

// partner_orders collection
db.partner_orders.createIndex({ "partnerId": 1, "createdAt": -1 });
db.partner_orders.createIndex({ "orderId": 1 }, { unique: true });
db.partner_orders.createIndex({ "partnerOrderId": 1, "partnerId": 1 });
db.partner_orders.createIndex({ "status": 1 });
```

---

## 9. Admin Dashboard

### 9.1 Partner Management

**Admin Routes:**
- `GET /admin/partners` - List all partners
- `GET /admin/partners/{id}` - Partner details
- `PUT /admin/partners/{id}` - Update partner
- `POST /admin/partners/{id}/suspend` - Suspend partner
- `POST /admin/partners/{id}/activate` - Activate partner
- `DELETE /admin/partners/{id}` - Terminate partner

### 9.2 Payout Approval

**Admin Routes:**
- `GET /admin/payouts` - List pending payouts
- `GET /admin/payouts/{id}` - Payout details
- `POST /admin/payouts/{id}/approve` - Approve payout
- `POST /admin/payouts/{id}/reject` - Reject payout

### 9.3 Analytics Dashboard

```typescript
interface PartnerAnalytics {
  // Overview
  totalPartners: number;
  activePartners: number;
  pendingApproval: number;
  
  // Revenue
  totalGMV: number;                       // Gross Merchandise Value
  totalCommissionPaid: number;
  pendingPayouts: number;
  
  // Orders
  totalOrders: number;
  ordersToday: number;
  averageOrderValue: number;
  
  // Top Partners
  topByRevenue: PartnerSummary[];
  topByOrders: PartnerSummary[];
  
  // Trends
  dailyOrders: DailyData[];
  dailyRevenue: DailyData[];
}
```

---

## 10. Implementation Phases

### Phase 1: MVP (4-6 weeks)

**Scope:**
- ✅ Partner registration & onboarding
- ✅ API key generation & authentication
- ✅ Products API (list, details, stock check)
- ✅ Orders API (create, status, list)
- ✅ Basic wallet (balance view)
- ✅ Rate limiting (basic tier)
- ✅ Admin: Partner management

**Deliverables:**
1. Partner registration form
2. API key management
3. Core API endpoints
4. Basic admin dashboard

### Phase 2: Wallet & Settlements (3-4 weeks)

**Scope:**
- ✅ Full wallet implementation
- ✅ Transaction history
- ✅ Payout requests
- ✅ Admin payout approval
- ✅ Commission calculation
- ✅ Settlement automation

**Deliverables:**
1. Wallet dashboard
2. Payout system
3. Settlement reports
4. Bank account management

### Phase 3: Advanced Features (4-6 weeks)

**Scope:**
- ✅ Webhooks for order updates
- ✅ Advanced analytics
- ✅ Tiered rate limiting
- ✅ Bulk operations
- ✅ Partner portal
- ✅ API documentation portal

**Deliverables:**
1. Webhook system
2. Analytics dashboard
3. Partner self-service portal
4. Interactive API docs

### Phase 4: Scale & Optimize (Ongoing)

**Scope:**
- ✅ Performance optimization
- ✅ Redis-based rate limiting
- ✅ CDN for product images
- ✅ Advanced fraud detection
- ✅ White-label options

---

## 11. Error Handling

### 11.1 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "items[0].quantity",
        "message": "Quantity must be at least 1"
      }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-02-01T12:00:00Z"
  }
}
```

### 11.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid API key |
| `INVALID_API_KEY` | 401 | API key not found or revoked |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INSUFFICIENT_BALANCE` | 400 | Wallet balance too low |
| `PRODUCT_OUT_OF_STOCK` | 400 | Product unavailable |
| `ORDER_NOT_CANCELLABLE` | 400 | Order cannot be cancelled |
| `PAYOUT_LIMIT_EXCEEDED` | 400 | Payout amount exceeds limits |
| `PARTNER_SUSPENDED` | 403 | Partner account suspended |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 12. Webhooks

### 12.1 Available Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `order.created` | New order placed | Order details |
| `order.confirmed` | Order confirmed | Order details |
| `order.shipped` | Order shipped | Order + tracking |
| `order.delivered` | Order delivered | Order details |
| `order.cancelled` | Order cancelled | Order + reason |
| `order.returned` | Return processed | Order + refund |
| `wallet.credited` | Commission credited | Transaction |
| `wallet.payout_completed` | Payout successful | Payout details |
| `wallet.payout_failed` | Payout failed | Payout + reason |

### 12.2 Webhook Payload

```json
{
  "event": "order.shipped",
  "timestamp": "2026-02-02T10:00:00Z",
  "data": {
    "orderId": "BW-ORD-2026020112345",
    "status": "shipped",
    "tracking": {
      "carrier": "Delhivery",
      "trackingNumber": "DLV123456789"
    }
  },
  "meta": {
    "webhookId": "wh_abc123",
    "deliveryAttempt": 1
  }
}
```

### 12.3 Webhook Security

```http
POST https://partner.example.com/webhooks
Content-Type: application/json
X-Webhook-Signature: sha256=abc123...
X-Webhook-Timestamp: 1706788800
```

Signature verification:
```typescript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${JSON.stringify(payload)}`)
  .digest('hex');
```

---

## 13. Testing & Sandbox

### 13.1 Test Environment

- **Base URL**: `https://sandbox.bytewise.com/api/v1/partner`
- **Test API Key Prefix**: `sk_test_ptnr_`
- **Test Product IDs**: `test_prod_*`
- **Test Order IDs**: `TEST-ORD-*`

### 13.2 Test Cards (for simulated payments)

| Card Number | Scenario |
|-------------|----------|
| 4111111111111111 | Successful payment |
| 4000000000000002 | Declined |
| 4000000000000341 | 3D Secure required |

### 13.3 Sandbox Limitations

- Max 100 test orders per day
- Wallet balance resets daily
- No real payouts processed
- Limited to 500 test products

---

## 14. API Quick Reference

### 14.1 Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.bytewise.com/v1/partner` |
| Sandbox | `https://sandbox.bytewise.com/api/v1/partner` |

### 14.2 Authentication

```bash
curl -X GET "https://api.bytewise.com/v1/partner/products" \
  -H "Authorization: Bearer sk_live_ptnr_xxx" \
  -H "Content-Type: application/json"
```

### 14.3 Endpoints Summary

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `GET` | `/products` | List products | 30-1000/min |
| `GET` | `/products/{id}` | Product details | 60-5000/min |
| `POST` | `/products/stock-check` | Bulk stock check | 10-500/min |
| `POST` | `/orders` | Create order | 5-500/min |
| `GET` | `/orders` | List orders | 30-1000/min |
| `GET` | `/orders/{id}` | Order details | 60-5000/min |
| `POST` | `/orders/{id}/cancel` | Cancel order | 5/min |
| `GET` | `/wallet/balance` | Wallet balance | 20-500/min |
| `GET` | `/wallet/transactions` | Transaction history | 20-500/min |
| `POST` | `/wallet/payout` | Request payout | 2-10/day |
| `GET` | `/wallet/payouts` | Payout history | 20-500/min |

---

## 📞 Support & Contact

- **Partner Support**: partners@bytewise.com
- **Technical Support**: api-support@bytewise.com
- **Documentation**: https://docs.bytewise.com/partner-api
- **Status Page**: https://status.bytewise.com

---

## 📄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Feb 2026 | Initial release - MVP |
| 1.1.0 | TBD | Webhooks, bulk operations |
| 1.2.0 | TBD | Advanced analytics |

---

> **Note**: This is a living document. All specifications are subject to change during implementation. Partners will be notified of any breaking changes with at least 30 days notice.
