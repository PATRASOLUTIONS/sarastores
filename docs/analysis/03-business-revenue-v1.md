# 💰 Business & Revenue Improvisation

> **Strategies for Increasing Revenue, Customer Retention & Operational Efficiency**

---

## Table of Contents

1. [Revenue Enhancement Opportunities](#1-revenue-enhancement-opportunities)
2. [Customer Retention Strategies](#2-customer-retention-strategies)
3. [Loyalty Program Design](#3-loyalty-program-design)
4. [Subscription Services](#4-subscription-services)
5. [B2B/Corporate Features](#5-b2bcorporate-features)
6. [Multi-Vendor Marketplace](#6-multi-vendor-marketplace)
7. [Dynamic Pricing Strategies](#7-dynamic-pricing-strategies)
8. [Referral & Affiliate Programs](#8-referral--affiliate-programs)
9. [Automation & Operational Efficiency](#9-automation--operational-efficiency)
10. [New Revenue Streams](#10-new-revenue-streams)

---

## 1. Revenue Enhancement Opportunities

### 1.1 Current Revenue Analysis

| Revenue Stream | Status | Potential |
|---------------|--------|-----------|
| Product Sales (Hardware) | ✅ Active | Optimize margins |
| Product Sales (Software) | ✅ Active | Expand catalog |
| Extended Warranties | ❌ Missing | High margin |
| Installation Services | ❌ Missing | Service revenue |
| Accessories Cross-sell | ⚠️ Basic | +15% AOV |
| B2B/Bulk Orders | ❌ Missing | +30% order value |
| Subscription Services | ❌ Missing | Recurring revenue |

### 1.2 Quick Win Opportunities

#### A. Extended Warranty Upsell

```typescript
// components/WarrantyUpsell.tsx
interface WarrantyOption {
  id: string
  duration: number // months
  price: number
  coverage: string[]
  popular?: boolean
}

const warrantyOptions: WarrantyOption[] = [
  {
    id: 'basic-12',
    duration: 12,
    price: 999,
    coverage: ['Manufacturing defects', 'Free repairs'],
  },
  {
    id: 'extended-24',
    duration: 24,
    price: 1999,
    coverage: ['Manufacturing defects', 'Free repairs', 'Accidental damage (1x)'],
    popular: true,
  },
  {
    id: 'complete-36',
    duration: 36,
    price: 3499,
    coverage: ['Manufacturing defects', 'Free repairs', 'Accidental damage (2x)', 'Battery replacement'],
  },
]

export function WarrantyUpsell({ product }: { product: Product }) {
  const calculateWarrantyPrice = (option: WarrantyOption) => {
    // Dynamic pricing based on product value
    const baseMultiplier = product.price > 50000 ? 1.5 : 1
    return Math.round(option.price * baseMultiplier)
  }
  
  return (
    <div className="border rounded-lg p-4 bg-blue-50">
      <h3 className="font-semibold text-lg mb-3">
        🛡️ Protect Your Purchase
      </h3>
      <div className="grid gap-3">
        {warrantyOptions.map(option => (
          <WarrantyCard 
            key={option.id}
            option={option}
            price={calculateWarrantyPrice(option)}
          />
        ))}
      </div>
    </div>
  )
}
```

**Revenue Impact**: 15-25% of customers opt for extended warranty → +3-5% revenue

#### B. Accessory Bundling

```typescript
// lib/recommendations.ts
export interface ProductBundle {
  mainProductId: string
  accessories: {
    productId: string
    discountPercent: number
    reason: string
  }[]
  bundleDiscount: number
}

export async function getAccessoryRecommendations(productId: string): Promise<ProductBundle> {
  const db = await connectDB()
  const product = await db.collection('products').findOne({ _id: new ObjectId(productId) })
  
  if (!product) throw new Error('Product not found')
  
  // Category-based accessory mapping
  const accessoryMap: Record<string, string[]> = {
    'Smartphones': ['Phone Cases', 'Screen Protectors', 'Chargers', 'Earphones'],
    'Laptops': ['Laptop Bags', 'Mouse', 'Keyboard', 'USB Hub'],
    'Televisions': ['Wall Mount', 'HDMI Cable', 'Soundbar', 'Streaming Device'],
    'Refrigerators': ['Stabilizer', 'Water Filter', 'Deodorizer'],
    'Washing Machines': ['Stabilizer', 'Stand', 'Inlet Pipe'],
  }
  
  const accessoryCategories = accessoryMap[product.category] || []
  
  const accessories = await db.collection('products')
    .find({
      category: { $in: accessoryCategories },
      price: { $lt: product.price * 0.2 }, // Accessories < 20% of main product price
      active: true,
    })
    .limit(4)
    .toArray()
  
  return {
    mainProductId: productId,
    accessories: accessories.map(acc => ({
      productId: acc._id.toString(),
      discountPercent: 10, // 10% off when bundled
      reason: `Perfect match for your ${product.name}`,
    })),
    bundleDiscount: 5, // Additional 5% off entire bundle
  }
}
```

**Revenue Impact**: +12-18% Average Order Value (AOV)

#### C. Smart Upselling Algorithm

```typescript
// lib/upsell.ts
export interface UpsellRecommendation {
  type: 'upgrade' | 'complement' | 'bundle'
  products: Product[]
  message: string
  savingsAmount?: number
}

export async function getUpsellRecommendations(
  cartItems: CartItem[]
): Promise<UpsellRecommendation[]> {
  const recommendations: UpsellRecommendation[] = []
  const db = await connectDB()
  
  for (const item of cartItems) {
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(item.productId) 
    })
    
    if (!product) continue
    
    // 1. Upgrade recommendation (10-30% higher price, same category)
    const upgrades = await db.collection('products')
      .find({
        category: product.category,
        brand: product.brand,
        price: { $gt: product.price * 1.1, $lt: product.price * 1.3 },
        active: true,
        _id: { $ne: product._id },
      })
      .sort({ 'metadata.rating': -1 })
      .limit(2)
      .toArray()
    
    if (upgrades.length > 0) {
      recommendations.push({
        type: 'upgrade',
        products: upgrades,
        message: `Upgrade to a better model for just ₹${Math.round((upgrades[0].price - product.price) / 100) * 100} more!`,
      })
    }
    
    // 2. Frequently bought together
    const frequentlyBought = await db.collection('order_analytics')
      .aggregate([
        { $match: { 'items.productId': product._id.toString() } },
        { $unwind: '$items' },
        { $match: { 'items.productId': { $ne: product._id.toString() } } },
        { $group: { _id: '$items.productId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ])
      .toArray()
    
    if (frequentlyBought.length > 0) {
      const complementProducts = await db.collection('products')
        .find({ _id: { $in: frequentlyBought.map(f => new ObjectId(f._id)) } })
        .toArray()
      
      recommendations.push({
        type: 'complement',
        products: complementProducts,
        message: 'Customers also bought these items',
      })
    }
  }
  
  return recommendations
}
```

---

## 2. Customer Retention Strategies

### 2.1 Customer Lifecycle Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER LIFECYCLE STAGES                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ACQUISITION        ACTIVATION         RETENTION         ADVOCACY     │
│   ────────────      ────────────       ──────────        ─────────     │
│                                                                         │
│   • SEO/Ads         • First Purchase   • Repeat Purchase  • Referrals  │
│   • Social Media    • Account Setup    • Loyalty Points   • Reviews    │
│   • Referrals       • Wishlist         • Personalization  • Social     │
│                     • Cart             • Win-back         • Advocacy   │
│                                                                         │
│   Current: ✅       Current: ✅        Current: ⚠️        Current: ⚠️   │
│   Status: Good      Status: Good       Status: Needs Work Status: Basic│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Retention Feature Implementation

#### A. Price Drop Alerts

```typescript
// app/api/price-alerts/route.ts
interface PriceAlert {
  userId: string
  productId: string
  targetPrice: number
  currentPrice: number
  createdAt: Date
  notified: boolean
}

export async function POST(request: Request) {
  const { productId, targetPrice } = await request.json()
  const user = await getCurrentUser(request)
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const db = await connectDB()
  const product = await db.collection('products').findOne({ _id: new ObjectId(productId) })
  
  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }
  
  // Create price alert
  await db.collection('price_alerts').insertOne({
    userId: user.id,
    productId,
    targetPrice,
    currentPrice: product.price,
    createdAt: new Date(),
    notified: false,
  })
  
  return Response.json({ success: true })
}

// Cron job to check price alerts
export async function checkPriceAlerts() {
  const db = await connectDB()
  
  // Find products with price drops
  const alerts = await db.collection('price_alerts')
    .aggregate([
      { $match: { notified: false } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      { $match: { $expr: { $lte: ['$product.price', '$targetPrice'] } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ])
    .toArray()
  
  for (const alert of alerts) {
    // Send email notification
    await sendEmail({
      to: alert.user.email,
      subject: `Price Drop Alert: ${alert.product.name}`,
      template: 'price-drop-alert',
      data: {
        productName: alert.product.name,
        oldPrice: alert.currentPrice,
        newPrice: alert.product.price,
        savings: alert.currentPrice - alert.product.price,
        productUrl: `/product/${alert.productId}`,
      },
    })
    
    // Mark as notified
    await db.collection('price_alerts').updateOne(
      { _id: alert._id },
      { $set: { notified: true, notifiedAt: new Date() } }
    )
  }
}
```

#### B. Back-in-Stock Notifications

```typescript
// app/api/stock-alerts/route.ts
export async function POST(request: Request) {
  const { productId, email } = await request.json()
  
  const db = await connectDB()
  const product = await db.collection('products').findOne({ _id: new ObjectId(productId) })
  
  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }
  
  if (product.stock > 0) {
    return Response.json({ error: 'Product is in stock' }, { status: 400 })
  }
  
  // Create stock alert
  await db.collection('stock_alerts').updateOne(
    { productId, email },
    { 
      $set: { 
        productId, 
        email, 
        productName: product.name,
        createdAt: new Date(),
        notified: false,
      } 
    },
    { upsert: true }
  )
  
  return Response.json({ success: true })
}

// Component for out-of-stock products
export function StockAlertForm({ productId }: { productId: string }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await fetch('/api/stock-alerts', {
      method: 'POST',
      body: JSON.stringify({ productId, email }),
    })
    setSubmitted(true)
  }
  
  if (submitted) {
    return (
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-green-700">✓ We'll notify you when this item is back in stock!</p>
      </div>
    )
  }
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="flex-1 px-3 py-2 border rounded"
        required
      />
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Notify Me
      </button>
    </form>
  )
}
```

#### C. Personalized Recommendations Engine

```typescript
// lib/recommendations.ts
export async function getPersonalizedRecommendations(userId: string): Promise<Product[]> {
  const db = await connectDB()
  
  // Get user's purchase history and browsing behavior
  const [orderHistory, recentlyViewed, wishlist] = await Promise.all([
    db.collection('orders')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray(),
    db.collection('recently_viewed')
      .findOne({ userId }),
    db.collection('wishlist')
      .findOne({ userId }),
  ])
  
  // Extract categories and brands from history
  const purchasedProducts = orderHistory.flatMap(o => o.items)
  const categories = [...new Set(purchasedProducts.map(p => p.category))]
  const brands = [...new Set(purchasedProducts.map(p => p.brand))]
  const priceRange = calculatePriceRange(purchasedProducts)
  
  // Build recommendation query
  const recommendations = await db.collection('products')
    .aggregate([
      {
        $match: {
          active: true,
          stock: { $gt: 0 },
          $or: [
            { category: { $in: categories } },
            { brand: { $in: brands } },
          ],
          price: { $gte: priceRange.min * 0.5, $lte: priceRange.max * 1.5 },
          _id: { $nin: purchasedProducts.map(p => new ObjectId(p.productId)) },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $cond: [{ $in: ['$category', categories] }, 10, 0] },
              { $cond: [{ $in: ['$brand', brands] }, 5, 0] },
              { $multiply: ['$metadata.rating', 2] },
            ],
          },
        },
      },
      { $sort: { score: -1, 'metadata.rating': -1 } },
      { $limit: 12 },
    ])
    .toArray()
  
  return recommendations
}
```

---

## 3. Loyalty Program Design

### 3.1 Points-Based Loyalty System

```typescript
// types/loyalty.ts
export interface LoyaltyProgram {
  tiers: LoyaltyTier[]
  pointsPerRupee: number
  pointValue: number // 1 point = X rupees
  expiryMonths: number
}

export interface LoyaltyTier {
  name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  minPoints: number
  benefits: string[]
  pointsMultiplier: number
  exclusiveDiscounts: number
}

export interface UserLoyalty {
  userId: string
  currentPoints: number
  lifetimePoints: number
  currentTier: LoyaltyTier['name']
  pointsHistory: PointsTransaction[]
  tierExpiresAt: Date
}

export interface PointsTransaction {
  id: string
  type: 'earned' | 'redeemed' | 'expired' | 'bonus'
  points: number
  description: string
  orderId?: string
  createdAt: Date
  expiresAt?: Date
}
```

### 3.2 Loyalty Program Configuration

```typescript
// lib/loyalty.ts
export const LOYALTY_CONFIG: LoyaltyProgram = {
  pointsPerRupee: 1, // 1 point per ₹100 spent
  pointValue: 0.25, // 1 point = ₹0.25
  expiryMonths: 12,
  tiers: [
    {
      name: 'Bronze',
      minPoints: 0,
      pointsMultiplier: 1,
      exclusiveDiscounts: 0,
      benefits: [
        'Earn 1 point per ₹100 spent',
        'Birthday bonus points',
        'Early access to sales',
      ],
    },
    {
      name: 'Silver',
      minPoints: 5000,
      pointsMultiplier: 1.25,
      exclusiveDiscounts: 5,
      benefits: [
        'Earn 1.25x points on purchases',
        '5% exclusive discount',
        'Free shipping on orders over ₹999',
        'Priority customer support',
      ],
    },
    {
      name: 'Gold',
      minPoints: 15000,
      pointsMultiplier: 1.5,
      exclusiveDiscounts: 10,
      benefits: [
        'Earn 1.5x points on purchases',
        '10% exclusive discount',
        'Free shipping on all orders',
        'Extended return window (30 days)',
        'Early access to new products',
      ],
    },
    {
      name: 'Platinum',
      minPoints: 50000,
      pointsMultiplier: 2,
      exclusiveDiscounts: 15,
      benefits: [
        'Earn 2x points on purchases',
        '15% exclusive discount',
        'Free express shipping',
        'Dedicated account manager',
        'Exclusive product launches',
        'Annual gift voucher',
      ],
    },
  ],
}

export async function earnPoints(userId: string, orderId: string, orderTotal: number): Promise<number> {
  const db = await connectDB()
  const userLoyalty = await db.collection('user_loyalty').findOne({ userId })
  
  const tier = LOYALTY_CONFIG.tiers.find(t => t.name === (userLoyalty?.currentTier || 'Bronze'))!
  const basePoints = Math.floor(orderTotal / 100) * LOYALTY_CONFIG.pointsPerRupee
  const earnedPoints = Math.floor(basePoints * tier.pointsMultiplier)
  
  await db.collection('user_loyalty').updateOne(
    { userId },
    {
      $inc: { currentPoints: earnedPoints, lifetimePoints: earnedPoints },
      $push: {
        pointsHistory: {
          id: new ObjectId().toString(),
          type: 'earned',
          points: earnedPoints,
          description: `Points earned from order #${orderId}`,
          orderId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + LOYALTY_CONFIG.expiryMonths * 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
    { upsert: true }
  )
  
  // Check for tier upgrade
  await checkTierUpgrade(userId)
  
  return earnedPoints
}

export async function redeemPoints(userId: string, points: number): Promise<{ discount: number; success: boolean }> {
  const db = await connectDB()
  const userLoyalty = await db.collection('user_loyalty').findOne({ userId })
  
  if (!userLoyalty || userLoyalty.currentPoints < points) {
    return { discount: 0, success: false }
  }
  
  const discount = points * LOYALTY_CONFIG.pointValue
  
  await db.collection('user_loyalty').updateOne(
    { userId },
    {
      $inc: { currentPoints: -points },
      $push: {
        pointsHistory: {
          id: new ObjectId().toString(),
          type: 'redeemed',
          points: -points,
          description: `Redeemed ${points} points for ₹${discount} discount`,
          createdAt: new Date(),
        },
      },
    }
  )
  
  return { discount, success: true }
}
```

### 3.3 Loyalty Dashboard Component

```typescript
// components/LoyaltyDashboard.tsx
export function LoyaltyDashboard({ loyalty }: { loyalty: UserLoyalty }) {
  const currentTier = LOYALTY_CONFIG.tiers.find(t => t.name === loyalty.currentTier)!
  const nextTier = LOYALTY_CONFIG.tiers.find(t => t.minPoints > currentTier.minPoints)
  
  const pointsToNextTier = nextTier ? nextTier.minPoints - loyalty.lifetimePoints : 0
  const progressPercent = nextTier 
    ? ((loyalty.lifetimePoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100
    : 100
  
  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold">{currentTier.name} Member</h2>
          <p className="text-purple-200">Member since {format(loyalty.memberSince, 'MMM yyyy')}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{loyalty.currentPoints.toLocaleString()}</div>
          <div className="text-purple-200">Available Points</div>
        </div>
      </div>
      
      {nextTier && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress to {nextTier.name}</span>
            <span>{pointsToNextTier.toLocaleString()} points to go</span>
          </div>
          <div className="h-3 bg-purple-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-400 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold">
            ₹{(loyalty.currentPoints * LOYALTY_CONFIG.pointValue).toFixed(0)}
          </div>
          <div className="text-purple-200">Redeemable Value</div>
        </div>
        <div className="bg-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold">{currentTier.exclusiveDiscounts}%</div>
          <div className="text-purple-200">Member Discount</div>
        </div>
      </div>
      
      <div className="mt-6">
        <h3 className="font-semibold mb-2">Your Benefits</h3>
        <ul className="space-y-1">
          {currentTier.benefits.map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="text-yellow-400">✓</span> {benefit}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

---

## 4. Subscription Services

### 4.1 Subscription Models

```typescript
// types/subscription.ts
export interface SubscriptionPlan {
  id: string
  name: string
  type: 'consumable' | 'service' | 'box'
  price: number
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  benefits: string[]
  products?: string[] // For box subscriptions
}

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  status: 'active' | 'paused' | 'cancelled'
  startDate: Date
  nextBillingDate: Date
  paymentMethod: string
  history: SubscriptionEvent[]
}
```

### 4.2 Subscription Service Ideas

#### A. Software License Subscriptions

```typescript
// Perfect for existing software license business
const softwareSubscriptions: SubscriptionPlan[] = [
  {
    id: 'antivirus-annual',
    name: 'Antivirus Protection Plan',
    type: 'service',
    price: 1999,
    frequency: 'yearly',
    benefits: [
      'Auto-renewal of antivirus license',
      '10% discount vs one-time purchase',
      'Free upgrade to new versions',
      'Priority support',
    ],
  },
  {
    id: 'office-monthly',
    name: 'Office Suite Monthly',
    type: 'service',
    price: 599,
    frequency: 'monthly',
    benefits: [
      'Full Microsoft Office access',
      '1TB Cloud storage',
      'Multi-device support',
      'Cancel anytime',
    ],
  },
]
```

#### B. Electronics Care Plan

```typescript
const carePlans: SubscriptionPlan[] = [
  {
    id: 'device-care-basic',
    name: 'Device Care Basic',
    type: 'service',
    price: 299,
    frequency: 'monthly',
    benefits: [
      'Annual device health check',
      '20% off repairs',
      'Free battery diagnostic',
      'Software cleanup service',
    ],
  },
  {
    id: 'device-care-premium',
    name: 'Device Care Premium',
    type: 'service',
    price: 599,
    frequency: 'monthly',
    benefits: [
      'Unlimited device health checks',
      '50% off repairs',
      'One free screen replacement/year',
      'Priority service',
      'Loaner device during repair',
    ],
  },
]
```

#### C. Consumables Auto-Replenish

```typescript
// For products like printer ink, batteries, filters
const autoReplenishProducts = [
  {
    productId: 'printer-ink-001',
    replenishOptions: [
      { frequency: 'monthly', discount: 15 },
      { frequency: 'quarterly', discount: 10 },
    ],
  },
  {
    productId: 'water-filter-001',
    replenishOptions: [
      { frequency: 'quarterly', discount: 20 },
      { frequency: 'biannual', discount: 15 },
    ],
  },
]
```

### 4.3 Subscription Management API

```typescript
// app/api/subscriptions/route.ts
export async function POST(request: Request) {
  const { planId, paymentMethodId } = await request.json()
  const user = await getCurrentUser(request)
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const db = await connectDB()
  const plan = await db.collection('subscription_plans').findOne({ id: planId })
  
  if (!plan) {
    return Response.json({ error: 'Plan not found' }, { status: 404 })
  }
  
  // Create Razorpay subscription
  const razorpaySubscription = await razorpay.subscriptions.create({
    plan_id: plan.razorpayPlanId,
    customer_notify: 1,
    quantity: 1,
    total_count: 12, // 12 billing cycles
    notes: {
      userId: user.id,
      planId,
    },
  })
  
  // Store subscription
  const subscription = await db.collection('subscriptions').insertOne({
    userId: user.id,
    planId,
    razorpaySubscriptionId: razorpaySubscription.id,
    status: 'created',
    startDate: new Date(),
    nextBillingDate: new Date(Date.now() + getFrequencyMs(plan.frequency)),
    createdAt: new Date(),
  })
  
  return Response.json({
    subscriptionId: subscription.insertedId,
    razorpaySubscriptionId: razorpaySubscription.id,
    shortUrl: razorpaySubscription.short_url,
  })
}
```

---

## 5. B2B/Corporate Features

### 5.1 B2B Account Structure

```typescript
// types/b2b.ts
export interface CorporateAccount {
  id: string
  companyName: string
  gstin: string
  pan: string
  billingAddress: Address
  shippingAddresses: Address[]
  creditLimit: number
  creditUsed: number
  paymentTerms: number // days
  discountTier: 'standard' | 'silver' | 'gold' | 'platinum'
  primaryContact: ContactPerson
  authorizedBuyers: AuthorizedBuyer[]
  approvalWorkflow: ApprovalWorkflow
}

export interface AuthorizedBuyer {
  userId: string
  name: string
  email: string
  purchaseLimit: number
  requiresApproval: boolean
  approver?: string
}

export interface ApprovalWorkflow {
  enabled: boolean
  thresholds: {
    amount: number
    approverLevel: 'manager' | 'director' | 'cfo'
  }[]
}
```

### 5.2 Bulk Ordering System

```typescript
// components/BulkOrderForm.tsx
export function BulkOrderForm() {
  const [items, setItems] = useState<BulkOrderItem[]>([])
  const [rfqMode, setRfqMode] = useState(false)
  
  const handleExcelUpload = async (file: File) => {
    const data = await parseExcel(file)
    const products = await lookupProducts(data)
    setItems(products)
  }
  
  const handleRFQSubmit = async () => {
    const response = await fetch('/api/b2b/rfq', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
    // Handle response
  }
  
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button onClick={() => setRfqMode(false)} className={!rfqMode ? 'active' : ''}>
          Direct Order
        </button>
        <button onClick={() => setRfqMode(true)} className={rfqMode ? 'active' : ''}>
          Request Quote (RFQ)
        </button>
      </div>
      
      <ExcelUploader onUpload={handleExcelUpload} template="/templates/bulk-order.xlsx" />
      
      <BulkOrderTable items={items} onUpdate={setItems} />
      
      <div className="flex justify-between items-center">
        <div>
          <div className="text-lg font-semibold">
            Total: ₹{calculateTotal(items).toLocaleString()}
          </div>
          {items.length >= 10 && (
            <div className="text-green-600">Bulk discount applied: 5%</div>
          )}
        </div>
        
        {rfqMode ? (
          <button onClick={handleRFQSubmit} className="btn-primary">
            Submit RFQ
          </button>
        ) : (
          <button onClick={handleOrder} className="btn-primary">
            Place Order
          </button>
        )}
      </div>
    </div>
  )
}
```

### 5.3 B2B Pricing Engine

```typescript
// lib/b2b-pricing.ts
export interface B2BPricingRule {
  type: 'quantity' | 'customer' | 'contract'
  conditions: Record<string, any>
  discount: number
  discountType: 'percentage' | 'fixed'
}

export async function calculateB2BPrice(
  productId: string,
  quantity: number,
  corporateAccountId: string
): Promise<{ unitPrice: number; totalPrice: number; discounts: AppliedDiscount[] }> {
  const db = await connectDB()
  
  const [product, account, rules] = await Promise.all([
    db.collection('products').findOne({ _id: new ObjectId(productId) }),
    db.collection('corporate_accounts').findOne({ id: corporateAccountId }),
    db.collection('b2b_pricing_rules').find({ active: true }).toArray(),
  ])
  
  if (!product || !account) throw new Error('Invalid product or account')
  
  let price = product.price
  const discounts: AppliedDiscount[] = []
  
  // Apply quantity discounts
  const quantityRules = rules.filter(r => r.type === 'quantity')
  for (const rule of quantityRules) {
    if (quantity >= rule.conditions.minQuantity) {
      const discount = rule.discountType === 'percentage' 
        ? price * (rule.discount / 100)
        : rule.discount
      price -= discount
      discounts.push({ rule: rule.name, amount: discount * quantity })
    }
  }
  
  // Apply customer tier discount
  const tierDiscounts: Record<string, number> = {
    standard: 0,
    silver: 5,
    gold: 10,
    platinum: 15,
  }
  const tierDiscount = price * (tierDiscounts[account.discountTier] / 100)
  if (tierDiscount > 0) {
    price -= tierDiscount
    discounts.push({ rule: `${account.discountTier} tier discount`, amount: tierDiscount * quantity })
  }
  
  // Check contract pricing
  const contractPrice = await db.collection('contract_prices').findOne({
    corporateAccountId,
    productId,
    validFrom: { $lte: new Date() },
    validTo: { $gte: new Date() },
  })
  
  if (contractPrice && contractPrice.price < price) {
    discounts.push({ rule: 'Contract pricing', amount: (price - contractPrice.price) * quantity })
    price = contractPrice.price
  }
  
  return {
    unitPrice: price,
    totalPrice: price * quantity,
    discounts,
  }
}
```

---

## 6. Multi-Vendor Marketplace

### 6.1 Vendor Onboarding System

```typescript
// types/vendor.ts
export interface VendorProfile {
  id: string
  businessName: string
  legalName: string
  gstin: string
  pan: string
  bankDetails: BankDetails
  documents: VendorDocument[]
  categories: string[]
  commissionRate: number
  status: 'pending' | 'approved' | 'suspended' | 'rejected'
  rating: number
  totalSales: number
  joinedAt: Date
}

export interface VendorDocument {
  type: 'gstin' | 'pan' | 'bank_statement' | 'address_proof' | 'business_license'
  url: string
  verified: boolean
  verifiedAt?: Date
}

export interface BankDetails {
  accountName: string
  accountNumber: string
  ifsc: string
  bankName: string
  verified: boolean
}
```

### 6.2 Commission & Payout System

```typescript
// lib/vendor-payouts.ts
export interface VendorPayout {
  vendorId: string
  period: { start: Date; end: Date }
  grossSales: number
  returns: number
  netSales: number
  commissionRate: number
  commissionAmount: number
  payoutAmount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  paymentReference?: string
}

export async function calculateVendorPayout(vendorId: string, periodEnd: Date): Promise<VendorPayout> {
  const db = await connectDB()
  const periodStart = new Date(periodEnd.getTime() - 14 * 24 * 60 * 60 * 1000) // Bi-weekly
  
  const vendor = await db.collection('vendors').findOne({ id: vendorId })
  if (!vendor) throw new Error('Vendor not found')
  
  // Calculate sales for period
  const salesData = await db.collection('orders').aggregate([
    {
      $match: {
        'items.vendorId': vendorId,
        status: 'delivered',
        deliveredAt: { $gte: periodStart, $lt: periodEnd },
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.vendorId': vendorId } },
    {
      $group: {
        _id: null,
        grossSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        itemCount: { $sum: '$items.quantity' },
      },
    },
  ]).toArray()
  
  // Calculate returns
  const returnsData = await db.collection('returns').aggregate([
    {
      $match: {
        vendorId,
        status: 'completed',
        completedAt: { $gte: periodStart, $lt: periodEnd },
      },
    },
    {
      $group: {
        _id: null,
        totalReturns: { $sum: '$refundAmount' },
      },
    },
  ]).toArray()
  
  const grossSales = salesData[0]?.grossSales || 0
  const returns = returnsData[0]?.totalReturns || 0
  const netSales = grossSales - returns
  const commissionAmount = netSales * (vendor.commissionRate / 100)
  const payoutAmount = netSales - commissionAmount
  
  return {
    vendorId,
    period: { start: periodStart, end: periodEnd },
    grossSales,
    returns,
    netSales,
    commissionRate: vendor.commissionRate,
    commissionAmount,
    payoutAmount,
    status: 'pending',
  }
}
```

### 6.3 Vendor Dashboard

```typescript
// app/vendor/dashboard/page.tsx
export default async function VendorDashboard() {
  const vendor = await getCurrentVendor()
  
  const [stats, recentOrders, payouts] = await Promise.all([
    getVendorStats(vendor.id),
    getVendorRecentOrders(vendor.id),
    getVendorPayouts(vendor.id),
  ])
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={`₹${stats.todaySales}`} trend={stats.todayTrend} />
        <StatCard title="This Month" value={`₹${stats.monthSales}`} trend={stats.monthTrend} />
        <StatCard title="Pending Orders" value={stats.pendingOrders} />
        <StatCard title="Rating" value={vendor.rating.toFixed(1)} icon="⭐" />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <RecentOrdersTable orders={recentOrders} />
        <PayoutHistory payouts={payouts} />
      </div>
      
      <SalesChart data={stats.salesChart} />
    </div>
  )
}
```

---

## 7. Dynamic Pricing Strategies

### 7.1 Pricing Rules Engine

```typescript
// lib/dynamic-pricing.ts
export interface PricingRule {
  id: string
  name: string
  type: 'time-based' | 'demand-based' | 'inventory-based' | 'competitor-based'
  conditions: PricingCondition[]
  adjustment: PriceAdjustment
  priority: number
  active: boolean
}

export interface PricingCondition {
  field: string
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between'
  value: any
}

export interface PriceAdjustment {
  type: 'percentage' | 'fixed'
  value: number
  direction: 'increase' | 'decrease'
  minPrice?: number
  maxPrice?: number
}

export async function calculateDynamicPrice(product: Product): Promise<number> {
  const db = await connectDB()
  const rules = await db.collection('pricing_rules')
    .find({ active: true })
    .sort({ priority: -1 })
    .toArray()
  
  let price = product.price
  let appliedRules: string[] = []
  
  for (const rule of rules) {
    if (await evaluateConditions(product, rule.conditions)) {
      const adjustment = calculateAdjustment(price, rule.adjustment)
      price = applyAdjustment(price, adjustment, rule.adjustment)
      appliedRules.push(rule.name)
      
      // Respect min/max bounds
      if (rule.adjustment.minPrice) price = Math.max(price, rule.adjustment.minPrice)
      if (rule.adjustment.maxPrice) price = Math.min(price, rule.adjustment.maxPrice)
    }
  }
  
  // Log for analytics
  await db.collection('pricing_logs').insertOne({
    productId: product._id,
    basePrice: product.price,
    finalPrice: price,
    appliedRules,
    timestamp: new Date(),
  })
  
  return Math.round(price)
}

// Example rules
const pricingRules: PricingRule[] = [
  {
    id: 'flash-sale',
    name: 'Flash Sale Hours (6-9 PM)',
    type: 'time-based',
    conditions: [
      { field: 'hour', operator: 'between', value: [18, 21] },
      { field: 'category', operator: 'in', value: ['Electronics', 'Appliances'] },
    ],
    adjustment: { type: 'percentage', value: 5, direction: 'decrease' },
    priority: 10,
    active: true,
  },
  {
    id: 'low-stock-premium',
    name: 'Low Stock Premium',
    type: 'inventory-based',
    conditions: [
      { field: 'stock', operator: 'lt', value: 5 },
      { field: 'stock', operator: 'gt', value: 0 },
    ],
    adjustment: { type: 'percentage', value: 3, direction: 'increase', maxPrice: 'mrp' },
    priority: 5,
    active: true,
  },
  {
    id: 'slow-moving',
    name: 'Slow Moving Inventory',
    type: 'demand-based',
    conditions: [
      { field: 'daysSinceLastSale', operator: 'gt', value: 30 },
      { field: 'stock', operator: 'gt', value: 10 },
    ],
    adjustment: { type: 'percentage', value: 10, direction: 'decrease' },
    priority: 3,
    active: true,
  },
]
```

### 7.2 A/B Price Testing

```typescript
// lib/ab-testing.ts
export interface PriceTest {
  id: string
  productId: string
  variants: PriceVariant[]
  startDate: Date
  endDate: Date
  status: 'active' | 'completed' | 'paused'
  results?: TestResults
}

export interface PriceVariant {
  id: string
  price: number
  weight: number // Traffic allocation percentage
}

export async function getPriceForUser(productId: string, userId: string): Promise<number> {
  const db = await connectDB()
  
  const activeTest = await db.collection('price_tests').findOne({
    productId,
    status: 'active',
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
  })
  
  if (!activeTest) {
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) })
    return product?.price || 0
  }
  
  // Consistent variant assignment based on user ID
  const hash = hashCode(userId + productId)
  const bucket = Math.abs(hash) % 100
  
  let cumulative = 0
  for (const variant of activeTest.variants) {
    cumulative += variant.weight
    if (bucket < cumulative) {
      // Log assignment for analysis
      await db.collection('price_test_assignments').updateOne(
        { testId: activeTest.id, userId, productId },
        { $set: { variantId: variant.id, price: variant.price, assignedAt: new Date() } },
        { upsert: true }
      )
      return variant.price
    }
  }
  
  return activeTest.variants[0].price
}
```

---

## 8. Referral & Affiliate Programs

### 8.1 Customer Referral Program

```typescript
// types/referral.ts
export interface ReferralProgram {
  referrerReward: {
    type: 'points' | 'credit' | 'discount'
    value: number
    conditions: { minOrderValue: number }
  }
  refereeReward: {
    type: 'discount' | 'credit'
    value: number
  }
  maxReferralsPerUser: number
}

export interface ReferralCode {
  code: string
  userId: string
  uses: number
  maxUses: number
  createdAt: Date
  earnings: number
}
```

### 8.2 Referral System Implementation

```typescript
// lib/referral.ts
const REFERRAL_CONFIG: ReferralProgram = {
  referrerReward: {
    type: 'credit',
    value: 500, // ₹500 store credit
    conditions: { minOrderValue: 2000 },
  },
  refereeReward: {
    type: 'discount',
    value: 10, // 10% off first order
  },
  maxReferralsPerUser: 50,
}

export async function generateReferralCode(userId: string): Promise<string> {
  const db = await connectDB()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  
  if (!user) throw new Error('User not found')
  
  // Generate unique code based on user name
  const baseCode = user.name.split(' ')[0].toUpperCase().slice(0, 4)
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const code = `${baseCode}${suffix}`
  
  await db.collection('referral_codes').insertOne({
    code,
    userId,
    uses: 0,
    maxUses: REFERRAL_CONFIG.maxReferralsPerUser,
    createdAt: new Date(),
    earnings: 0,
  })
  
  return code
}

export async function applyReferralCode(code: string, newUserId: string): Promise<{ discount: number }> {
  const db = await connectDB()
  
  const referralCode = await db.collection('referral_codes').findOne({ 
    code: code.toUpperCase(),
    uses: { $lt: REFERRAL_CONFIG.maxReferralsPerUser },
  })
  
  if (!referralCode) {
    throw new Error('Invalid or expired referral code')
  }
  
  if (referralCode.userId === newUserId) {
    throw new Error('Cannot use your own referral code')
  }
  
  // Mark user as referred
  await db.collection('users').updateOne(
    { _id: new ObjectId(newUserId) },
    { 
      $set: { 
        referredBy: referralCode.userId,
        referralCode: code,
        referralDiscount: REFERRAL_CONFIG.refereeReward.value,
      } 
    }
  )
  
  return { discount: REFERRAL_CONFIG.refereeReward.value }
}

export async function processReferralReward(orderId: string): Promise<void> {
  const db = await connectDB()
  const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) })
  
  if (!order || order.total < REFERRAL_CONFIG.referrerReward.conditions.minOrderValue) {
    return
  }
  
  const buyer = await db.collection('users').findOne({ _id: new ObjectId(order.userId) })
  
  if (!buyer?.referredBy || buyer.referralRewardProcessed) {
    return
  }
  
  // Credit referrer
  await db.collection('users').updateOne(
    { _id: new ObjectId(buyer.referredBy) },
    { $inc: { storeCredit: REFERRAL_CONFIG.referrerReward.value } }
  )
  
  // Update referral code stats
  await db.collection('referral_codes').updateOne(
    { userId: buyer.referredBy },
    { 
      $inc: { 
        uses: 1, 
        earnings: REFERRAL_CONFIG.referrerReward.value 
      } 
    }
  )
  
  // Mark as processed
  await db.collection('users').updateOne(
    { _id: new ObjectId(order.userId) },
    { $set: { referralRewardProcessed: true } }
  )
  
  // Notify referrer
  await sendEmail({
    to: (await db.collection('users').findOne({ _id: new ObjectId(buyer.referredBy) }))?.email,
    subject: 'You earned a referral reward! 🎉',
    template: 'referral-reward',
    data: { amount: REFERRAL_CONFIG.referrerReward.value },
  })
}
```

### 8.3 Affiliate Program

```typescript
// types/affiliate.ts
export interface AffiliatePartner {
  id: string
  name: string
  email: string
  website?: string
  socialMedia?: string[]
  commissionRate: number // percentage
  paymentThreshold: number
  bankDetails: BankDetails
  status: 'pending' | 'approved' | 'suspended'
  totalEarnings: number
  pendingPayout: number
}

export interface AffiliateLink {
  partnerId: string
  productId?: string
  categoryId?: string
  code: string
  clicks: number
  conversions: number
  revenue: number
  commission: number
}
```

```typescript
// lib/affiliate.ts
export async function trackAffiliateClick(code: string, request: Request): Promise<void> {
  const db = await connectDB()
  
  await db.collection('affiliate_links').updateOne(
    { code },
    { $inc: { clicks: 1 } }
  )
  
  // Store in session for attribution
  // Return cookie or session token
}

export async function attributeAffiliateSale(orderId: string, affiliateCode: string): Promise<void> {
  const db = await connectDB()
  
  const [order, link] = await Promise.all([
    db.collection('orders').findOne({ _id: new ObjectId(orderId) }),
    db.collection('affiliate_links').findOne({ code: affiliateCode }),
  ])
  
  if (!order || !link) return
  
  const partner = await db.collection('affiliate_partners').findOne({ id: link.partnerId })
  if (!partner || partner.status !== 'approved') return
  
  const commission = order.total * (partner.commissionRate / 100)
  
  // Record sale
  await db.collection('affiliate_sales').insertOne({
    partnerId: link.partnerId,
    orderId,
    orderTotal: order.total,
    commission,
    status: 'pending', // Becomes 'confirmed' after return window
    createdAt: new Date(),
  })
  
  // Update stats
  await db.collection('affiliate_links').updateOne(
    { code: affiliateCode },
    { 
      $inc: { 
        conversions: 1, 
        revenue: order.total, 
        commission 
      } 
    }
  )
  
  await db.collection('affiliate_partners').updateOne(
    { id: link.partnerId },
    { $inc: { pendingPayout: commission } }
  )
}
```

---

## 9. Automation & Operational Efficiency

### 9.1 Order Processing Automation

```typescript
// lib/automation/order-automation.ts
export interface AutomationRule {
  id: string
  trigger: 'order_created' | 'payment_confirmed' | 'order_shipped' | 'order_delivered'
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  enabled: boolean
}

export interface AutomationAction {
  type: 'send_email' | 'update_status' | 'assign_warehouse' | 'create_task' | 'notify_vendor'
  config: Record<string, any>
}

// Example automation rules
const automationRules: AutomationRule[] = [
  {
    id: 'auto-confirm-prepaid',
    trigger: 'payment_confirmed',
    conditions: [
      { field: 'paymentMethod', operator: 'ne', value: 'cod' },
    ],
    actions: [
      { type: 'update_status', config: { status: 'processing' } },
      { type: 'send_email', config: { template: 'order-confirmed' } },
      { type: 'assign_warehouse', config: { strategy: 'nearest' } },
    ],
    enabled: true,
  },
  {
    id: 'low-stock-alert',
    trigger: 'order_created',
    conditions: [
      { field: 'product.stock', operator: 'lte', value: 5 },
    ],
    actions: [
      { type: 'create_task', config: { type: 'restock', priority: 'high' } },
      { type: 'send_email', config: { to: 'inventory@company.com', template: 'low-stock' } },
    ],
    enabled: true,
  },
  {
    id: 'vendor-notification',
    trigger: 'order_created',
    conditions: [
      { field: 'items.vendorId', operator: 'exists', value: true },
    ],
    actions: [
      { type: 'notify_vendor', config: { method: 'email' } },
    ],
    enabled: true,
  },
]

export async function executeAutomation(trigger: string, data: any): Promise<void> {
  const db = await connectDB()
  const rules = await db.collection('automation_rules')
    .find({ trigger, enabled: true })
    .toArray()
  
  for (const rule of rules) {
    if (await evaluateConditions(data, rule.conditions)) {
      for (const action of rule.actions) {
        await executeAction(action, data)
      }
      
      // Log execution
      await db.collection('automation_logs').insertOne({
        ruleId: rule.id,
        trigger,
        dataId: data._id || data.id,
        actions: rule.actions.map(a => a.type),
        executedAt: new Date(),
      })
    }
  }
}
```

### 9.2 Inventory Automation

```typescript
// lib/automation/inventory-automation.ts
export async function checkAndReorder(): Promise<void> {
  const db = await connectDB()
  
  // Find products below reorder point
  const lowStockProducts = await db.collection('products')
    .find({
      $expr: { $lte: ['$stock', '$reorderPoint'] },
      autoReorder: true,
    })
    .toArray()
  
  for (const product of lowStockProducts) {
    // Check if PO already exists
    const existingPO = await db.collection('purchase_orders').findOne({
      productId: product._id,
      status: { $in: ['pending', 'ordered'] },
    })
    
    if (existingPO) continue
    
    // Create purchase order
    await db.collection('purchase_orders').insertOne({
      productId: product._id,
      productName: product.name,
      quantity: product.reorderQuantity,
      supplierId: product.preferredSupplierId,
      status: 'pending',
      createdAt: new Date(),
      autoGenerated: true,
    })
    
    // Notify purchasing team
    await sendEmail({
      to: 'purchasing@company.com',
      subject: `Auto-Reorder: ${product.name}`,
      template: 'purchase-order-created',
      data: { product, quantity: product.reorderQuantity },
    })
  }
}
```

### 9.3 Customer Service Automation

```typescript
// lib/automation/customer-service.ts
export async function handleComplaintAutomation(complaintId: string): Promise<void> {
  const db = await connectDB()
  const complaint = await db.collection('complaints').findOne({ _id: new ObjectId(complaintId) })
  
  if (!complaint) return
  
  // Auto-categorize based on keywords
  const category = categorizeComplaint(complaint.message)
  
  // Auto-assign based on category
  const assignee = await getAvailableAgent(category)
  
  // Set SLA based on priority
  const sla = calculateSLA(complaint.priority)
  
  await db.collection('complaints').updateOne(
    { _id: new ObjectId(complaintId) },
    {
      $set: {
        category,
        assignedTo: assignee?.id,
        slaDeadline: new Date(Date.now() + sla),
        autoProcessed: true,
      },
    }
  )
  
  // Send acknowledgment
  await sendEmail({
    to: complaint.email,
    subject: `Complaint Received - Ticket #${complaintId.slice(-8)}`,
    template: 'complaint-acknowledged',
    data: { 
      ticketId: complaintId.slice(-8),
      expectedResponse: formatSLA(sla),
    },
  })
}

function categorizeComplaint(message: string): string {
  const keywords = {
    'delivery': ['delivery', 'shipping', 'track', 'courier', 'late'],
    'refund': ['refund', 'money back', 'cancel', 'return'],
    'quality': ['defect', 'broken', 'damage', 'quality', 'not working'],
    'payment': ['payment', 'charged', 'deducted', 'transaction'],
  }
  
  const lowerMessage = message.toLowerCase()
  
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => lowerMessage.includes(word))) {
      return category
    }
  }
  
  return 'general'
}
```

---

## 10. New Revenue Streams

### 10.1 Advertising Platform

```typescript
// Monetize product placement and featured listings
export interface AdPlacement {
  id: string
  type: 'sponsored-product' | 'banner' | 'category-feature' | 'search-boost'
  vendorId: string
  productId?: string
  budget: number
  spent: number
  cpc: number // Cost per click
  impressions: number
  clicks: number
  startDate: Date
  endDate: Date
  status: 'active' | 'paused' | 'exhausted'
}

export async function serveAd(placement: string, context: AdContext): Promise<AdPlacement[]> {
  const db = await connectDB()
  
  const ads = await db.collection('ad_placements')
    .find({
      type: placement,
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      $expr: { $lt: ['$spent', '$budget'] },
    })
    .sort({ cpc: -1 }) // Highest bidder first
    .limit(3)
    .toArray()
  
  // Record impressions
  for (const ad of ads) {
    await db.collection('ad_placements').updateOne(
      { _id: ad._id },
      { $inc: { impressions: 1 } }
    )
  }
  
  return ads
}

export async function recordAdClick(adId: string): Promise<void> {
  const db = await connectDB()
  const ad = await db.collection('ad_placements').findOne({ _id: new ObjectId(adId) })
  
  if (!ad) return
  
  await db.collection('ad_placements').updateOne(
    { _id: new ObjectId(adId) },
    { 
      $inc: { 
        clicks: 1, 
        spent: ad.cpc 
      } 
    }
  )
  
  // Check if budget exhausted
  if (ad.spent + ad.cpc >= ad.budget) {
    await db.collection('ad_placements').updateOne(
      { _id: new ObjectId(adId) },
      { $set: { status: 'exhausted' } }
    )
  }
}
```

### 10.2 Data & Insights Service

```typescript
// Sell anonymized market insights to vendors
export interface MarketInsight {
  category: string
  period: { start: Date; end: Date }
  metrics: {
    totalSales: number
    averagePrice: number
    topBrands: { brand: string; marketShare: number }[]
    priceDistribution: { range: string; percentage: number }[]
    seasonality: { month: string; indexScore: number }[]
  }
}

export async function generateMarketInsights(category: string): Promise<MarketInsight> {
  const db = await connectDB()
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000)
  
  // Aggregate anonymized data
  const insights = await db.collection('orders').aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'delivered',
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.category': category } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        totalItems: { $sum: '$items.quantity' },
        avgPrice: { $avg: '$items.price' },
        brands: { $push: '$items.brand' },
        prices: { $push: '$items.price' },
      },
    },
  ]).toArray()
  
  // Process and anonymize
  return {
    category,
    period: { start: startDate, end: endDate },
    metrics: processInsights(insights[0]),
  }
}
```

### 10.3 Installation & Service Network

```typescript
// Partner with local technicians for installation services
export interface ServiceProvider {
  id: string
  name: string
  areas: string[] // Pincodes
  services: ('installation' | 'repair' | 'amc')[]
  rating: number
  completedJobs: number
  commissionRate: number
}

export interface ServiceBooking {
  id: string
  orderId: string
  productId: string
  serviceType: 'installation' | 'repair' | 'amc'
  customerId: string
  providerId: string
  scheduledDate: Date
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  price: number
  customerRating?: number
}

export async function bookInstallation(orderId: string, productId: string): Promise<ServiceBooking> {
  const db = await connectDB()
  
  const [order, product] = await Promise.all([
    db.collection('orders').findOne({ _id: new ObjectId(orderId) }),
    db.collection('products').findOne({ _id: new ObjectId(productId) }),
  ])
  
  if (!order || !product) throw new Error('Order or product not found')
  
  // Find available service provider
  const provider = await db.collection('service_providers')
    .findOne({
      areas: order.customer.pincode,
      services: 'installation',
      status: 'active',
    })
  
  if (!provider) {
    throw new Error('No service provider available in your area')
  }
  
  // Calculate installation price
  const installationPrice = product.installationPrice || Math.round(product.price * 0.02)
  
  const booking = await db.collection('service_bookings').insertOne({
    orderId,
    productId,
    serviceType: 'installation',
    customerId: order.userId,
    providerId: provider.id,
    scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    status: 'pending',
    price: installationPrice,
    createdAt: new Date(),
  })
  
  // Notify provider
  await sendEmail({
    to: provider.email,
    subject: 'New Installation Job',
    template: 'service-booking',
    data: { booking, product, customer: order.customer },
  })
  
  return { id: booking.insertedId.toString(), ...booking }
}
```

---

## Summary

This document outlines comprehensive business and revenue enhancement strategies:

| Category | Features | Revenue Impact |
|----------|----------|----------------|
| **Upselling** | Warranties, Accessories, Upgrades | +15-20% AOV |
| **Retention** | Price alerts, Back-in-stock, Personalization | +25% repeat rate |
| **Loyalty** | Points program, Tier benefits | +15% retention |
| **Subscriptions** | Software, Care plans, Auto-replenish | Recurring revenue |
| **B2B** | Corporate accounts, Bulk ordering | +30% order value |
| **Marketplace** | Multi-vendor, Commissions | Platform revenue |
| **Dynamic Pricing** | Rules engine, A/B testing | +5-10% margin |
| **Referrals** | Customer referrals, Affiliates | +20% new customers |
| **Automation** | Order processing, Inventory, Support | Cost reduction |
| **New Streams** | Ads, Insights, Services | New revenue |

**Next Steps**: See [06-IMPLEMENTATION-ROADMAP.md](./06-IMPLEMENTATION-ROADMAP.md) for phased implementation plan.
