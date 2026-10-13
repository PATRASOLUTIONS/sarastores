# Technical Specifications & Standards

## Document Information
| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | February 1, 2026 |
| Status | Reference |

---

## Table of Contents
1. [Coding Standards](#1-coding-standards)
2. [API Standards](#2-api-standards)
3. [Database Standards](#3-database-standards)
4. [Security Standards](#4-security-standards)
5. [Testing Standards](#5-testing-standards)
6. [Documentation Standards](#6-documentation-standards)

---

## 1. Coding Standards

### 1.1 TypeScript/JavaScript

```typescript
// ✅ Good: Use explicit types
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  createdAt: Date;
}

// ✅ Good: Use const for variables that don't change
const MAX_ITEMS = 100;

// ✅ Good: Async/await over promises
async function fetchProduct(id: string): Promise<Product> {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

// ✅ Good: Destructuring
const { name, price } = product;

// ✅ Good: Optional chaining
const categoryName = product?.category?.name ?? 'Uncategorized';

// ❌ Bad: Any type
function processData(data: any) { } // Avoid

// ❌ Bad: Nested callbacks
api.get('/products').then(res => {
  res.data.forEach(p => {
    // Nested logic
  });
}); // Use async/await instead
```

### 1.2 React/Next.js

```tsx
// ✅ Good: Functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-600 text-white',
        variant === 'secondary' && 'bg-gray-200 text-gray-800',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// ✅ Good: Custom hooks for logic reuse
function useProducts(categoryId: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchProducts(categoryId)
      .then(setProducts)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [categoryId]);

  return { products, loading, error };
}

// ✅ Good: Server Components (Next.js 14+)
async function ProductList({ categoryId }: { categoryId: string }) {
  const products = await getProducts(categoryId);
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### 1.3 File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ProductCard.tsx` |
| Hooks | camelCase with 'use' prefix | `useProducts.ts` |
| Utilities | camelCase | `formatPrice.ts` |
| Constants | UPPER_SNAKE_CASE | `API_ENDPOINTS.ts` |
| Types/Interfaces | PascalCase | `ProductTypes.ts` |
| API Routes | kebab-case | `route.ts` in folder |
| Pages | kebab-case folder | `product-details/page.tsx` |

### 1.4 Directory Structure

```
app/
├── (public)/           # Public routes group
│   ├── products/
│   ├── cart/
│   └── checkout/
├── (auth)/             # Auth routes group
│   ├── login/
│   └── register/
├── admin/              # Admin routes
├── api/                # API routes
└── layout.tsx

components/
├── ui/                 # Base UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Modal.tsx
├── features/           # Feature-specific components
│   ├── products/
│   ├── cart/
│   └── checkout/
└── layouts/            # Layout components

lib/
├── api/               # API client functions
├── utils/             # Utility functions
├── hooks/             # Custom hooks
└── config/            # Configuration

types/
├── product.ts
├── order.ts
└── user.ts
```

---

## 2. API Standards

### 2.1 RESTful Conventions

```
# Resources (plural nouns)
GET    /api/v1/products          # List products
GET    /api/v1/products/:id      # Get single product
POST   /api/v1/products          # Create product
PUT    /api/v1/products/:id      # Update product (full)
PATCH  /api/v1/products/:id      # Update product (partial)
DELETE /api/v1/products/:id      # Delete product

# Nested resources
GET    /api/v1/products/:id/reviews
POST   /api/v1/orders/:id/items

# Query parameters for filtering
GET    /api/v1/products?category=electronics&minPrice=100&maxPrice=500

# Pagination
GET    /api/v1/products?page=1&limit=20

# Sorting
GET    /api/v1/products?sort=price&order=asc

# Include related data
GET    /api/v1/products?include=category,reviews
```

### 2.2 Response Format

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// Example Success
{
  "success": true,
  "data": {
    "id": "prod_123",
    "name": "Product Name",
    "price": 1999
  }
}

// Example Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "price": ["Price must be a positive number"]
    }
  }
}
```

### 2.3 HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Semantic validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Temporary outage |

### 2.4 Error Codes

```typescript
// Standard error codes
const ErrorCodes = {
  // Authentication
  AUTH_REQUIRED: 'Authentication required',
  AUTH_INVALID: 'Invalid authentication credentials',
  AUTH_EXPIRED: 'Authentication token expired',
  
  // Authorization
  PERMISSION_DENIED: 'Permission denied',
  INSUFFICIENT_SCOPE: 'Insufficient API scope',
  
  // Validation
  VALIDATION_ERROR: 'Validation error',
  INVALID_FORMAT: 'Invalid data format',
  MISSING_FIELD: 'Required field missing',
  
  // Resources
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  
  // Rate Limiting
  RATE_LIMITED: 'Rate limit exceeded',
  
  // Server
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
} as const;
```

---

## 3. Database Standards

### 3.1 Firestore Collection Naming

```
# Collections (plural, lowercase with underscores)
products
product_categories
orders
order_items
users
user_addresses

# Subcollections
users/{userId}/addresses
orders/{orderId}/items
products/{productId}/reviews
```

### 3.2 Document Structure

```typescript
// Standard fields for all documents
interface BaseDocument {
  id: string;           // Document ID
  createdAt: Timestamp; // Creation timestamp
  updatedAt: Timestamp; // Last update timestamp
  createdBy?: string;   // User ID who created
  updatedBy?: string;   // User ID who last updated
}

// Product document example
interface ProductDocument extends BaseDocument {
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  categoryId: string;
  subcategoryId?: string;
  brand?: string;
  sku: string;
  stock: number;
  images: string[];
  status: 'draft' | 'active' | 'archived';
  metadata: {
    views: number;
    sales: number;
    rating: number;
    reviewCount: number;
  };
  searchKeywords: string[];
}
```

### 3.3 Indexing Guidelines

```typescript
// Composite indexes needed for common queries
// Define in firestore.indexes.json

// Product listing with filters
// Collection: products
// Fields: categoryId (ASC), status (ASC), price (ASC)

// Order history
// Collection: orders
// Fields: userId (ASC), createdAt (DESC)

// Product search
// Collection: products
// Fields: status (ASC), searchKeywords (ARRAY_CONTAINS)
```

---

## 4. Security Standards

### 4.1 Authentication

```typescript
// JWT token validation
async function validateToken(token: string): Promise<DecodedToken> {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    throw new AuthenticationError('Invalid token');
  }
}

// API key validation
async function validateApiKey(apiKey: string): Promise<ApiKeyData> {
  const keyHash = hashApiKey(apiKey);
  const keyData = await getApiKeyByHash(keyHash);
  
  if (!keyData || !keyData.isActive) {
    throw new AuthenticationError('Invalid API key');
  }
  
  if (keyData.expiresAt && keyData.expiresAt < new Date()) {
    throw new AuthenticationError('API key expired');
  }
  
  return keyData;
}
```

### 4.2 Input Validation

```typescript
import { z } from 'zod';

// Product creation schema
const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().positive(),
  categoryId: z.string().uuid(),
  stock: z.number().int().nonnegative(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
});

// Validate in API route
export async function POST(request: Request) {
  const body = await request.json();
  
  const result = CreateProductSchema.safeParse(body);
  if (!result.success) {
    return Response.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten().fieldErrors,
      }
    }, { status: 400 });
  }
  
  // Process valid data
  const product = await createProduct(result.data);
  return Response.json({ success: true, data: product }, { status: 201 });
}
```

### 4.3 Rate Limiting Implementation

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 requests per minute
  analytics: true,
});

async function checkRateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
  
  if (!success) {
    throw new RateLimitError({
      limit,
      remaining,
      reset,
    });
  }
  
  return { limit, remaining, reset };
}
```

---

## 5. Testing Standards

### 5.1 Unit Tests

```typescript
// Example: Testing a utility function
import { describe, it, expect } from 'vitest';
import { formatPrice, calculateDiscount } from '@/lib/utils/price';

describe('formatPrice', () => {
  it('should format price in INR', () => {
    expect(formatPrice(1999)).toBe('₹1,999');
  });

  it('should handle decimal prices', () => {
    expect(formatPrice(1999.99)).toBe('₹1,999.99');
  });

  it('should handle zero', () => {
    expect(formatPrice(0)).toBe('₹0');
  });
});

describe('calculateDiscount', () => {
  it('should calculate percentage discount', () => {
    expect(calculateDiscount(1000, 900)).toBe(10);
  });

  it('should return 0 when no discount', () => {
    expect(calculateDiscount(1000, 1000)).toBe(0);
  });
});
```

### 5.2 Integration Tests

```typescript
// Example: Testing API route
import { describe, it, expect, beforeEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/products/route';

describe('POST /api/products', () => {
  const validProduct = {
    name: 'Test Product',
    price: 1999,
    categoryId: 'cat_123',
    stock: 10,
    sku: 'TEST-001',
  };

  it('should create a product with valid data', async () => {
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify(validProduct),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test Product');
  });

  it('should reject invalid data', async () => {
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({ name: '' }), // Invalid: empty name
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
  });
});
```

### 5.3 E2E Tests

```typescript
// Example: Playwright E2E test
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete checkout as guest', async ({ page }) => {
    // Add product to cart
    await page.goto('/products/test-product');
    await page.click('[data-testid="add-to-cart"]');
    
    // Go to cart
    await page.click('[data-testid="cart-icon"]');
    await expect(page).toHaveURL('/cart');
    
    // Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    
    // Fill shipping info
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="address"]', '123 Test Street');
    await page.fill('[name="city"]', 'Mumbai');
    await page.fill('[name="pincode"]', '400001');
    await page.fill('[name="phone"]', '9876543210');
    
    // Submit order
    await page.click('[data-testid="place-order"]');
    
    // Verify success
    await expect(page).toHaveURL(/\/thank-you/);
    await expect(page.locator('h1')).toContainText('Order Confirmed');
  });
});
```

### 5.4 Test Coverage Requirements

| Category | Minimum Coverage |
|----------|-----------------|
| Utility Functions | 90% |
| API Routes | 80% |
| React Components | 70% |
| Hooks | 80% |
| E2E Critical Paths | 100% |

---

## 6. Documentation Standards

### 6.1 Code Comments

```typescript
/**
 * Calculates the discounted price based on coupon type.
 * 
 * @param originalPrice - The original price before discount
 * @param coupon - The coupon object containing discount details
 * @returns The calculated final price after applying the discount
 * 
 * @example
 * ```ts
 * const price = calculateDiscountedPrice(1000, {
 *   type: 'percentage',
 *   value: 10,
 *   minPurchase: 500
 * });
 * // Returns: 900
 * ```
 */
function calculateDiscountedPrice(
  originalPrice: number,
  coupon: Coupon
): number {
  // Validate minimum purchase requirement
  if (coupon.minPurchase && originalPrice < coupon.minPurchase) {
    return originalPrice;
  }

  // Apply discount based on type
  if (coupon.type === 'percentage') {
    const discount = (originalPrice * coupon.value) / 100;
    return originalPrice - Math.min(discount, coupon.maxDiscount ?? discount);
  }

  return originalPrice - coupon.value;
}
```

### 6.2 API Documentation (OpenAPI)

```yaml
openapi: 3.0.3
info:
  title: E-Commerce Platform API
  version: 1.0.0

paths:
  /api/v1/products:
    get:
      summary: List products
      description: Retrieve a paginated list of products with optional filters
      parameters:
        - name: category
          in: query
          schema:
            type: string
          description: Filter by category ID
        - name: minPrice
          in: query
          schema:
            type: number
          description: Minimum price filter
        - name: page
          in: query
          schema:
            type: integer
            default: 1
          description: Page number
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProductListResponse'
```

### 6.3 README Templates

```markdown
# Component/Feature Name

## Overview
Brief description of what this component/feature does.

## Installation
Any installation or setup steps.

## Usage
```tsx
// Code example showing basic usage
```

## Props/Parameters
| Name | Type | Default | Description |
|------|------|---------|-------------|
| prop1 | string | - | Description |

## Examples
Additional usage examples.

## Notes
Any important notes or caveats.
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 1, 2026 | Initial standards document |

---

*These standards should be reviewed and updated quarterly. All team members are expected to follow these standards for new code.*
