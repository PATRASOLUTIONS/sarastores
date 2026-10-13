# Loader Components - Usage Guide

## 📦 Available Loaders

The platform now includes multiple professional loader components that follow the Sara Mobiles and Electronics  brand guidelines.

---

## 1. **Main Loader Component**

### Import
```typescript
import Loader from '@/components/Loader'
```

### Variants

#### **Brand Loader** (Default - Recommended)
Multi-ring animated loader with brand colors
```tsx
<Loader variant="brand" size="md" text="Loading..." />
```

#### **Simple Spinner**
Clean single-ring spinner
```tsx
<Loader variant="spinner" size="lg" text="Please wait..." />
```

#### **Dots Loader**
Three bouncing dots
```tsx
<Loader variant="dots" size="sm" text="Loading data..." />
```

#### **Pulse Loader**
Pulsing circle animation
```tsx
<Loader variant="pulse" size="xl" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"spinner" \| "dots" \| "pulse" \| "brand"` | `"brand"` | Loader animation style |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | `"md"` | Loader size |
| `fullScreen` | `boolean` | `false` | Show as full-screen overlay |
| `text` | `string` | `"Loading..."` | Loading message |

### Examples

```tsx
// Small inline loader
<Loader size="sm" variant="dots" text="Fetching..." />

// Medium brand loader
<Loader variant="brand" text="Loading products..." />

// Full-screen loader
<Loader fullScreen variant="brand" text="Please wait..." />

// Large loader without text
<Loader size="xl" variant="pulse" text="" />
```

---

## 2. **Page Loader**

Full-page loader with animated logo and progress bar

### Import
```typescript
import { PageLoader } from '@/components/Loader'
```

### Usage
```tsx
<PageLoader text="Loading your experience..." />
```

Perfect for:
- Initial page loads
- Route transitions
- App initialization

---

## 3. **Skeleton Loaders**

### Skeleton Card
For product cards, category cards, etc.

```typescript
import { SkeletonCard } from '@/components/Loader'

<SkeletonCard />
```

### Skeleton List
For list items, orders, etc.

```typescript
import { SkeletonList } from '@/components/Loader'

<SkeletonList count={5} />
```

### Skeleton Table
For data tables

```typescript
import { SkeletonTable } from '@/components/Loader'

<SkeletonTable rows={10} cols={5} />
```

---

## 🎯 Implementation Examples

### Example 1: Product Listing Page

```tsx
"use client"

import { useState, useEffect } from "react"
import Loader, { SkeletonCard } from "@/components/Loader"

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### Example 2: Data Fetching with Full-Screen Loader

```tsx
"use client"

import { useState, useEffect } from "react"
import Loader from "@/components/Loader"

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const data = await res.json()
      setData(data)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Loader fullScreen variant="brand" text="Loading dashboard..." />
  }

  return <div>{/* Dashboard content */}</div>
}
```

### Example 3: Button Loading State

```tsx
"use client"

import { useState } from "react"
import Loader from "@/components/Loader"

export default function SubmitButton() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await fetch('/api/submit', { method: 'POST' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSubmit}
      disabled={loading}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg"
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <Loader size="sm" variant="spinner" text="" />
          <span>Submitting...</span>
        </div>
      ) : (
        "Submit"
      )}
    </button>
  )
}
```

### Example 4: Table Loading

```tsx
"use client"

import { useState, useEffect } from "react"
import { SkeletonTable } from "@/components/Loader"

export default function OrdersTable() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  if (loading) {
    return <SkeletonTable rows={10} cols={6} />
  }

  return (
    <table>
      {/* Table content */}
    </table>
  )
}
```

### Example 5: Inline Loading

```tsx
"use client"

import Loader from "@/components/Loader"

export default function InlineLoader() {
  return (
    <div className="p-6">
      <h2>Loading Content</h2>
      <Loader variant="dots" size="sm" text="Fetching data..." />
    </div>
  )
}
```

---

## 🎨 Brand Colors Used

All loaders use the Sara Mobiles and Electronics  brand colors:

- **Primary Blue**: `#2A7FFF` - Main spinner color
- **Accent Yellow**: `#FFC107` - Secondary animation
- **Accent Green**: `#00C48C` - Center dot
- **Neutral Gray**: `#F5F5F5` - Background elements

---

## ⚡ Performance Tips

1. **Use Skeleton Loaders** for content-heavy pages (better UX)
2. **Use Simple Spinner** for quick operations (<1 second)
3. **Use Brand Loader** for medium operations (1-3 seconds)
4. **Use Page Loader** for full page transitions
5. **Avoid Full-Screen** loaders for small operations

---

## 🎯 Best Practices

### ✅ Do's
- Use skeleton loaders for lists and grids
- Show loading text for operations >2 seconds
- Use appropriate sizes for context
- Match loader variant to operation type

### ❌ Don'ts
- Don't use full-screen loaders for small operations
- Don't show loaders for <300ms operations
- Don't use multiple loaders on the same page
- Don't forget to handle loading states

---

## 📱 Responsive Behavior

All loaders are fully responsive:
- Sizes adjust automatically on mobile
- Full-screen loaders work on all devices
- Skeleton loaders adapt to container width

---

## 🔧 Customization

To customize loader colors, edit `/components/Loader.tsx`:

```tsx
// Change primary color
style={{ borderTopColor: '#YOUR_COLOR' }}

// Change accent color
style={{ borderBottomColor: '#YOUR_COLOR' }}

// Change center dot
style={{ backgroundColor: '#YOUR_COLOR' }}
```

---

## 📊 Loader Comparison

| Loader Type | Use Case | Duration | Visual Impact |
|-------------|----------|----------|---------------|
| Dots | Quick ops | <1s | Low |
| Spinner | Medium ops | 1-2s | Medium |
| Brand | Standard ops | 2-5s | High |
| Pulse | Background ops | Any | Medium |
| Page Loader | Full page | 3-10s | Very High |
| Skeleton | Content loading | Any | Low (Better UX) |

---

## 🚀 Quick Start

1. Import the loader:
```tsx
import Loader from '@/components/Loader'
```

2. Add loading state:
```tsx
const [loading, setLoading] = useState(true)
```

3. Show loader conditionally:
```tsx
{loading ? <Loader variant="brand" /> : <YourContent />}
```

Done! 🎉

---

**Last Updated**: October 2025  
**Version**: 1.0
