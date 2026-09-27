# Business & Revenue Improvisation Analysis

## Document Information
| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | February 1, 2026 |
| Status | Complete |
| Category | Business Strategy |

---

## Table of Contents
1. [Current Revenue Analysis](#1-current-revenue-analysis)
2. [Revenue Enhancement Strategies](#2-revenue-enhancement-strategies)
3. [Customer Retention Programs](#3-customer-retention-programs)
4. [Loyalty & Engagement Programs](#4-loyalty--engagement-programs)
5. [B2B Features](#5-b2b-features)
6. [Multi-Vendor Marketplace](#6-multi-vendor-marketplace)
7. [Subscription & Recurring Revenue](#7-subscription--recurring-revenue)
8. [Dynamic Pricing](#8-dynamic-pricing)
9. [Automation & Efficiency](#9-automation--efficiency)
10. [Monetization Beyond Products](#10-monetization-beyond-products)

---

## 1. Current Revenue Analysis

### 1.1 Revenue Sources

| Source | Current | Optimization Potential |
|--------|---------|----------------------|
| Product Sales | Primary | Increase AOV, conversion |
| Shipping Charges | Partial | Optimize margins |
| Transaction Fees | None | N/A (cost center) |

### 1.2 Key Metrics (Estimated)

| Metric | Current State | Industry Benchmark | Gap |
|--------|--------------|-------------------|-----|
| Conversion Rate | 2.0% | 3.5-4.0% | -50% |
| Average Order Value | ₹2,500 | ₹3,500 | -29% |
| Cart Abandonment | 75% | 55-65% | +15% |
| Return Customer Rate | 15% | 30-40% | -50% |
| Customer Lifetime Value | ₹5,000 | ₹15,000 | -67% |

### 1.3 Revenue Leakage Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REVENUE LEAKAGE FUNNEL                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Visitors: 100,000                                                          │
│       │                                                                      │
│       │ ─────────── 40% bounce (no engagement) ───────────▶ LOST           │
│       ▼                                                                      │
│  Product Views: 60,000                                                       │
│       │                                                                      │
│       │ ─────────── 85% no action ──────────────────────────▶ LOST         │
│       ▼                                                                      │
│  Add to Cart: 9,000                                                          │
│       │                                                                      │
│       │ ─────────── 45% cart abandonment ───────────────────▶ LOST         │
│       ▼                                                                      │
│  Checkout Started: 4,950                                                     │
│       │                                                                      │
│       │ ─────────── 60% checkout abandonment ───────────────▶ LOST         │
│       ▼                                                                      │
│  Purchases: 2,000 (2% conversion)                                            │
│                                                                              │
│  RECOVERY OPPORTUNITIES:                                                     │
│  • Engagement optimization: +₹10L/month                                     │
│  • Cart recovery: +₹15L/month                                               │
│  • Checkout optimization: +₹20L/month                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Revenue Enhancement Strategies

### 2.1 Average Order Value (AOV) Increase

#### A. Cross-Selling

```typescript
// components/CrossSell.tsx
interface CrossSellProps {
  product: Product;
  cartItems: CartItem[];
}

export function FrequentlyBoughtTogether({ product, cartItems }: CrossSellProps) {
  const { data: recommendations } = useQuery({
    queryKey: ['cross-sell', product.id],
    queryFn: () => getCrossSellProducts(product.id),
  });
  
  const bundleDiscount = 0.10; // 10% bundle discount
  
  return (
    <div className="border rounded-lg p-6 bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Frequently Bought Together</h3>
      
      <div className="flex items-center gap-4 mb-4">
        <ProductMini product={product} />
        <span className="text-2xl text-gray-400">+</span>
        {recommendations?.slice(0, 2).map(rec => (
          <React.Fragment key={rec.id}>
            <ProductMini product={rec} />
            <span className="text-2xl text-gray-400">+</span>
          </React.Fragment>
        ))}
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">Bundle Price:</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{calculateBundlePrice(product, recommendations, bundleDiscount)}
          </p>
          <p className="text-sm text-green-600">
            Save {bundleDiscount * 100}% on bundle
          </p>
        </div>
        <Button onClick={() => addBundleToCart(product, recommendations)}>
          Add All to Cart
        </Button>
      </div>
    </div>
  );
}
```

#### B. Upselling

```typescript
// components/Upsell.tsx
export function PremiumAlternative({ product }: { product: Product }) {
  const premiumProduct = usePremiumAlternative(product);
  
  if (!premiumProduct || premiumProduct.price <= product.price * 1.1) {
    return null;
  }
  
  const priceDiff = premiumProduct.price - product.price;
  
  return (
    <div className="border-2 border-amber-400 rounded-lg p-4 bg-amber-50">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-amber-700">Premium Alternative</span>
      </div>
      
      <div className="flex gap-4">
        <Image 
          src={premiumProduct.images[0]} 
          alt={premiumProduct.name}
          width={80}
          height={80}
          className="rounded"
        />
        <div className="flex-1">
          <h4 className="font-medium">{premiumProduct.name}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">
            {premiumProduct.upgradeReason}
          </p>
          <p className="text-sm mt-1">
            <span className="text-gray-500">Only </span>
            <span className="font-bold text-green-600">₹{priceDiff} more</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => switchProduct(premiumProduct)}>
          Upgrade
        </Button>
      </div>
    </div>
  );
}
```

#### C. Minimum Order Incentives

```typescript
// components/FreeShippingProgress.tsx
export function FreeShippingProgress({ cartTotal }: { cartTotal: number }) {
  const freeShippingThreshold = 999;
  const progress = Math.min((cartTotal / freeShippingThreshold) * 100, 100);
  const remaining = freeShippingThreshold - cartTotal;
  
  if (cartTotal >= freeShippingThreshold) {
    return (
      <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded">
        <CheckCircle className="w-5 h-5" />
        <span>You've unlocked FREE shipping!</span>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 p-3 rounded">
      <div className="flex justify-between text-sm mb-1">
        <span>Add ₹{remaining} more for FREE shipping</span>
        <span>₹{cartTotal} / ₹{freeShippingThreshold}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

### 2.2 Conversion Rate Optimization

#### A. Exit-Intent Popup

```typescript
// components/ExitIntentPopup.tsx
'use client';

import { useExitIntent } from '@/hooks/useExitIntent';

export function ExitIntentPopup() {
  const [shown, setShown] = useState(false);
  const { hasItems, itemCount, cartTotal } = useCart();
  
  useExitIntent({
    onExit: () => {
      if (hasItems && !shown) {
        setShown(true);
      }
    },
    threshold: 10,
    disabled: !hasItems,
  });
  
  if (!shown) return null;
  
  return (
    <Dialog open={shown} onOpenChange={setShown}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wait! Don't leave yet 🛒</DialogTitle>
        </DialogHeader>
        
        <div className="text-center py-4">
          <p className="text-gray-600 mb-4">
            You have {itemCount} items worth ₹{cartTotal} in your cart.
          </p>
          
          <div className="bg-green-50 p-4 rounded-lg mb-4">
            <p className="text-lg font-semibold text-green-700">
              Complete your order now and get
            </p>
            <p className="text-3xl font-bold text-green-600">
              10% OFF
            </p>
            <p className="text-sm text-gray-600">
              Use code: STAYWITHUS
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setShown(false)}
            >
              Maybe Later
            </Button>
            <Button 
              className="flex-1"
              onClick={() => {
                applyCoupon('STAYWITHUS');
                router.push('/checkout');
              }}
            >
              Complete Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### B. Social Proof

```typescript
// components/SocialProof.tsx
export function LivePurchaseNotification() {
  const [notification, setNotification] = useState<PurchaseNotif | null>(null);
  
  useEffect(() => {
    const unsubscribe = subscribeToRecentPurchases((purchase) => {
      setNotification(purchase);
      setTimeout(() => setNotification(null), 5000);
    });
    
    return unsubscribe;
  }, []);
  
  if (!notification) return null;
  
  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -100, opacity: 0 }}
      className="fixed bottom-4 left-4 bg-white shadow-lg rounded-lg p-4 max-w-xs z-50"
    >
      <div className="flex gap-3">
        <Image
          src={notification.productImage}
          alt={notification.productName}
          width={50}
          height={50}
          className="rounded"
        />
        <div>
          <p className="text-sm">
            <span className="font-semibold">{notification.customerCity}</span>
            {' '}just purchased
          </p>
          <p className="font-medium text-sm line-clamp-1">
            {notification.productName}
          </p>
          <p className="text-xs text-gray-500">
            {formatTimeAgo(notification.timestamp)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
```

---

## 3. Customer Retention Programs

### 3.1 Abandoned Cart Recovery

#### Multi-Touch Recovery Campaign

```typescript
// lib/cart-recovery/campaign.ts
interface RecoveryCampaign {
  cartId: string;
  userId?: string;
  email: string;
  items: CartItem[];
  touches: RecoveryTouch[];
}

const recoverySequence = [
  {
    delay: '1h',
    channel: 'email',
    template: 'cart_reminder_1',
    incentive: null,
    subject: "You left something behind 🛒",
  },
  {
    delay: '24h',
    channel: 'email',
    template: 'cart_reminder_2',
    incentive: { type: 'discount', value: 5 },
    subject: "Your cart misses you + 5% OFF",
  },
  {
    delay: '48h',
    channel: 'email',
    template: 'cart_reminder_3',
    incentive: { type: 'discount', value: 10 },
    subject: "Last chance: 10% OFF expires soon!",
  },
  {
    delay: '72h',
    channel: 'sms',
    template: 'cart_sms_final',
    incentive: { type: 'freeShipping', value: null },
    subject: null,
  },
];

async function processAbandonedCart(cart: AbandonedCart) {
  const campaign = await createRecoveryCampaign(cart);
  
  for (const touch of recoverySequence) {
    // Check if cart was recovered
    if (await isCartRecovered(cart.id)) {
      await endCampaign(campaign.id, 'recovered');
      return;
    }
    
    await scheduleTouch(campaign.id, touch);
  }
}
```

#### Recovery Email Template

```typescript
// emails/CartRecoveryEmail.tsx
import { Html, Head, Preview, Body, Container, Section, Text, Button, Img } from '@react-email/components';

export function CartRecoveryEmail({ 
  customerName, 
  items, 
  cartTotal,
  discountCode,
  discountPercent 
}: CartRecoveryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Complete your purchase with {discountPercent}% off!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={logoUrl} width={150} alt="Store Logo" />
          </Section>
          
          <Section style={content}>
            <Text style={heading}>Hi {customerName},</Text>
            
            <Text style={paragraph}>
              You left some amazing items in your cart! We saved them for you.
            </Text>
            
            {/* Cart Items */}
            <Section style={cartSection}>
              {items.map(item => (
                <div key={item.id} style={cartItem}>
                  <Img src={item.image} width={60} height={60} alt={item.name} />
                  <div>
                    <Text style={itemName}>{item.name}</Text>
                    <Text style={itemPrice}>₹{item.price} × {item.quantity}</Text>
                  </div>
                </div>
              ))}
            </Section>
            
            {discountCode && (
              <Section style={discountSection}>
                <Text style={discountText}>
                  Use code <strong>{discountCode}</strong> for {discountPercent}% off!
                </Text>
              </Section>
            )}
            
            <Section style={ctaSection}>
              <Button style={ctaButton} href={checkoutUrl}>
                Complete Your Order
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### 3.2 Post-Purchase Engagement

```typescript
// lib/post-purchase/sequence.ts
const postPurchaseSequence = [
  {
    trigger: 'order_delivered',
    delay: '3d',
    action: 'request_review',
    template: 'review_request',
  },
  {
    trigger: 'review_submitted',
    delay: '0',
    action: 'reward_points',
    points: 100,
  },
  {
    trigger: 'order_delivered',
    delay: '14d',
    action: 'cross_sell',
    template: 'related_products',
  },
  {
    trigger: 'order_delivered',
    delay: '30d',
    action: 'replenishment_reminder',
    condition: 'isConsumable(product)',
    template: 'reorder_reminder',
  },
];
```

---

## 4. Loyalty & Engagement Programs

### 4.1 Points-Based Loyalty System

```typescript
// lib/loyalty/points.ts
interface LoyaltyConfig {
  pointsPerRupee: number;
  redemptionRate: number; // Points needed per rupee discount
  tiers: LoyaltyTier[];
  earningRules: EarningRule[];
  expirationDays: number;
}

const loyaltyConfig: LoyaltyConfig = {
  pointsPerRupee: 1, // Earn 1 point per ₹1 spent
  redemptionRate: 10, // 10 points = ₹1 discount
  expirationDays: 365,
  
  tiers: [
    {
      name: 'Bronze',
      minPoints: 0,
      benefits: ['1x points', 'Birthday discount 5%'],
      color: '#CD7F32',
    },
    {
      name: 'Silver',
      minPoints: 5000,
      benefits: ['1.25x points', 'Birthday discount 10%', 'Early access to sales'],
      color: '#C0C0C0',
    },
    {
      name: 'Gold',
      minPoints: 15000,
      benefits: ['1.5x points', 'Birthday discount 15%', 'Free shipping', 'Priority support'],
      color: '#FFD700',
    },
    {
      name: 'Platinum',
      minPoints: 50000,
      benefits: ['2x points', 'Birthday discount 20%', 'Free express shipping', 'Exclusive products'],
      color: '#E5E4E2',
    },
  ],
  
  earningRules: [
    { action: 'purchase', points: 'orderTotal', multiplier: 1 },
    { action: 'review', points: 100, condition: 'verified_purchase' },
    { action: 'review_with_photo', points: 150, condition: 'verified_purchase' },
    { action: 'referral', points: 500, condition: 'referral_purchase' },
    { action: 'birthday', points: 200, frequency: 'yearly' },
    { action: 'signup', points: 100, frequency: 'once' },
  ],
};

class LoyaltyService {
  async awardPoints(userId: string, action: string, metadata?: any) {
    const user = await this.getUser(userId);
    const rule = loyaltyConfig.earningRules.find(r => r.action === action);
    
    if (!rule) return;
    
    // Calculate points with tier multiplier
    const tierMultiplier = this.getTierMultiplier(user.loyaltyTier);
    let points = typeof rule.points === 'number' 
      ? rule.points 
      : metadata[rule.points];
    
    points = Math.floor(points * tierMultiplier);
    
    // Add points
    await this.addPoints(userId, {
      points,
      action,
      metadata,
      expiresAt: addDays(new Date(), loyaltyConfig.expirationDays),
    });
    
    // Check tier upgrade
    await this.checkTierUpgrade(userId);
    
    return points;
  }
  
  async redeemPoints(userId: string, pointsToRedeem: number) {
    const user = await this.getUser(userId);
    
    if (user.availablePoints < pointsToRedeem) {
      throw new Error('Insufficient points');
    }
    
    const discountAmount = pointsToRedeem / loyaltyConfig.redemptionRate;
    
    // Create discount code
    const code = await this.createRedemptionCode(userId, discountAmount);
    
    // Deduct points
    await this.deductPoints(userId, pointsToRedeem);
    
    return { code, discountAmount };
  }
}
```

### 4.2 Loyalty Dashboard UI

```typescript
// app/account/loyalty/page.tsx
export default async function LoyaltyPage() {
  const user = await getCurrentUser();
  const loyaltyData = await getLoyaltyData(user.id);
  
  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Tier Status */}
      <div className={cn(
        "rounded-lg p-6 text-white mb-8",
        tierBackgrounds[loyaltyData.tier.name]
      )}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm opacity-80">Your Status</p>
            <h2 className="text-3xl font-bold">{loyaltyData.tier.name} Member</h2>
          </div>
          <TierBadge tier={loyaltyData.tier} />
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>{loyaltyData.totalPoints.toLocaleString()} points</span>
            <span>{loyaltyData.nextTier.minPoints.toLocaleString()} points</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-3">
            <div 
              className="bg-white h-3 rounded-full"
              style={{ 
                width: `${(loyaltyData.totalPoints / loyaltyData.nextTier.minPoints) * 100}%` 
              }}
            />
          </div>
          <p className="text-sm mt-2 opacity-80">
            {loyaltyData.pointsToNextTier.toLocaleString()} points to {loyaltyData.nextTier.name}
          </p>
        </div>
      </div>
      
      {/* Points Balance */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Available Points"
          value={loyaltyData.availablePoints.toLocaleString()}
          subtitle={`Worth ₹${(loyaltyData.availablePoints / 10).toLocaleString()}`}
          action={<Button size="sm">Redeem</Button>}
        />
        <StatCard
          title="Lifetime Points"
          value={loyaltyData.lifetimePoints.toLocaleString()}
          subtitle="Since joining"
        />
        <StatCard
          title="Expiring Soon"
          value={loyaltyData.expiringPoints.toLocaleString()}
          subtitle="In 30 days"
          urgent={loyaltyData.expiringPoints > 0}
        />
      </div>
      
      {/* Benefits */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your {loyaltyData.tier.name} Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {loyaltyData.tier.benefits.map((benefit, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      
      {/* Points History */}
      <Card>
        <CardHeader>
          <CardTitle>Points History</CardTitle>
        </CardHeader>
        <CardContent>
          <PointsHistoryTable history={loyaltyData.history} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4.3 Referral Program

```typescript
// lib/referral/program.ts
interface ReferralProgram {
  referrerReward: { type: 'points' | 'discount'; value: number };
  refereeReward: { type: 'discount'; value: number; minPurchase: number };
  maxReferrals: number;
  expirationDays: number;
}

const referralConfig: ReferralProgram = {
  referrerReward: { type: 'points', value: 500 },
  refereeReward: { type: 'discount', value: 100, minPurchase: 500 },
  maxReferrals: 50,
  expirationDays: 30,
};

async function generateReferralCode(userId: string): Promise<string> {
  const user = await getUser(userId);
  
  // Check if user already has a code
  if (user.referralCode) {
    return user.referralCode;
  }
  
  // Generate unique code
  const code = `${user.firstName.toUpperCase()}${generateRandomString(6)}`;
  
  await updateUser(userId, { referralCode: code });
  
  return code;
}

async function processReferral(
  referralCode: string, 
  newUserId: string,
  orderId: string
) {
  const referrer = await getUserByReferralCode(referralCode);
  
  if (!referrer) {
    throw new Error('Invalid referral code');
  }
  
  // Check if already referred
  const existingReferral = await getReferral(newUserId);
  if (existingReferral) {
    throw new Error('User already referred');
  }
  
  // Create referral record
  await createReferral({
    referrerId: referrer.id,
    refereeId: newUserId,
    orderId,
    status: 'completed',
  });
  
  // Award referrer
  await loyaltyService.awardPoints(
    referrer.id, 
    'referral', 
    { refereeId: newUserId }
  );
  
  // Notify referrer
  await sendNotification(referrer.id, {
    type: 'referral_success',
    message: `You earned ${referralConfig.referrerReward.value} points from a referral!`,
  });
}
```

---

## 5. B2B Features

### 5.1 Business Account System

```typescript
// types/business.ts
interface BusinessAccount {
  id: string;
  companyName: string;
  gstin: string;
  panNumber: string;
  businessType: 'proprietorship' | 'partnership' | 'pvt_ltd' | 'llp' | 'public';
  industry: string;
  
  // Verification
  verificationStatus: 'pending' | 'verified' | 'rejected';
  documents: BusinessDocument[];
  
  // Pricing
  pricingTier: 'standard' | 'silver' | 'gold' | 'enterprise';
  customPricing: Map<string, number>; // productId -> special price
  
  // Credit
  creditLimit: number;
  usedCredit: number;
  paymentTerms: 'prepaid' | 'net15' | 'net30' | 'net60';
  
  // Users
  adminUsers: string[];
  purchasingUsers: string[];
  approvalWorkflow: ApprovalWorkflow;
}

interface ApprovalWorkflow {
  enabled: boolean;
  thresholds: {
    autoApprove: number;     // Below this: auto-approve
    managerApproval: number; // Below this: manager approval
    adminApproval: number;   // Above this: admin approval
  };
}
```

### 5.2 Bulk Ordering Interface

```typescript
// components/b2b/BulkOrderForm.tsx
export function BulkOrderForm() {
  const [items, setItems] = useState<BulkOrderItem[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const handleFileUpload = async (file: File) => {
    const data = await parseCSV(file);
    const validatedItems = await validateBulkItems(data);
    setItems(validatedItems);
  };
  
  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Order File</CardTitle>
          <CardDescription>
            Upload a CSV file with SKU and quantity columns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader
            accept=".csv,.xlsx"
            onUpload={handleFileUpload}
          />
          <Button variant="link" className="mt-2">
            Download template
          </Button>
        </CardContent>
      </Card>
      
      {/* Manual Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Or Add Items Manually</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr>
                <th>SKU / Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <BulkOrderRow 
                  key={index}
                  item={item}
                  onUpdate={(updated) => updateItem(index, updated)}
                  onRemove={() => removeItem(index)}
                />
              ))}
              <tr>
                <td colSpan={5}>
                  <Button variant="outline" onClick={addEmptyRow}>
                    + Add Item
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      
      {/* Summary & Volume Discounts */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal ({getTotalQuantity(items)} items)</span>
                <span>₹{getSubtotal(items).toLocaleString()}</span>
              </div>
              
              {getVolumeDiscount(items) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Volume Discount</span>
                  <span>-₹{getVolumeDiscount(items).toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>₹{getFinalTotal(items).toLocaleString()}</span>
              </div>
            </div>
            
            <Button className="w-full mt-4" size="lg">
              Submit Order for Approval
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 5.3 Quote Request System

```typescript
// lib/b2b/quotes.ts
interface QuoteRequest {
  id: string;
  businessId: string;
  items: QuoteItem[];
  status: 'pending' | 'quoted' | 'accepted' | 'rejected' | 'expired';
  
  // Request details
  requestedDeliveryDate?: Date;
  notes?: string;
  
  // Quote response
  quotedAt?: Date;
  quotedBy?: string;
  quotedItems?: QuotedItem[];
  validUntil?: Date;
  terms?: string;
}

interface QuotedItem {
  productId: string;
  quantity: number;
  listPrice: number;
  quotedPrice: number;
  discount: number;
}

// API endpoint
export async function POST(request: Request) {
  const { businessId, items, notes, requestedDeliveryDate } = await request.json();
  
  // Validate business account
  const business = await getBusinessAccount(businessId);
  if (!business || business.verificationStatus !== 'verified') {
    return Response.json({ error: 'Business account not verified' }, { status: 403 });
  }
  
  // Create quote request
  const quote = await createQuoteRequest({
    businessId,
    items,
    notes,
    requestedDeliveryDate,
    status: 'pending',
  });
  
  // Notify sales team
  await notifySalesTeam('new_quote_request', quote);
  
  return Response.json({ success: true, quoteId: quote.id });
}
```

---

## 6. Multi-Vendor Marketplace

### 6.1 Vendor Management System

```typescript
// types/vendor.ts
interface Vendor {
  id: string;
  businessName: string;
  legalName: string;
  gstin: string;
  
  // Status
  status: 'pending' | 'approved' | 'suspended' | 'terminated';
  verificationLevel: 'basic' | 'verified' | 'premium';
  
  // Financial
  bankDetails: BankDetails;
  commissionRate: number; // Platform commission %
  payoutSchedule: 'weekly' | 'biweekly' | 'monthly';
  pendingPayout: number;
  
  // Performance
  metrics: {
    totalSales: number;
    totalOrders: number;
    averageRating: number;
    returnRate: number;
    fulfillmentRate: number;
    responseTime: number; // hours
  };
  
  // Catalog
  productLimit: number;
  productsCount: number;
  categories: string[]; // Allowed categories
}

interface VendorPayout {
  id: string;
  vendorId: string;
  period: { start: Date; end: Date };
  
  grossSales: number;
  returns: number;
  commission: number;
  fees: number;
  netPayout: number;
  
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  transactionId?: string;
}
```

### 6.2 Vendor Dashboard

```typescript
// app/vendor/dashboard/page.tsx
export default async function VendorDashboard() {
  const vendor = await getCurrentVendor();
  const stats = await getVendorStats(vendor.id);
  const recentOrders = await getVendorOrders(vendor.id, { limit: 10 });
  
  return (
    <div className="p-6 space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={`₹${stats.todaySales.toLocaleString()}`}
          trend={stats.salesTrend}
        />
        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders}
          urgent={stats.pendingOrders > 10}
        />
        <StatCard
          title="Seller Rating"
          value={`${stats.rating.toFixed(1)} ⭐`}
          subtitle={`${stats.reviewCount} reviews`}
        />
        <StatCard
          title="Pending Payout"
          value={`₹${stats.pendingPayout.toLocaleString()}`}
          subtitle="Next payout: Feb 7"
        />
      </div>
      
      {/* Performance Alerts */}
      {stats.alerts.length > 0 && (
        <Alert variant="warning">
          <AlertTitle>Action Required</AlertTitle>
          <ul className="list-disc list-inside">
            {stats.alerts.map((alert, i) => (
              <li key={i}>{alert.message}</li>
            ))}
          </ul>
        </Alert>
      )}
      
      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorOrdersTable orders={recentOrders} />
        </CardContent>
      </Card>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <ActionCard
          title="Add Product"
          icon={<PlusCircle />}
          href="/vendor/products/new"
        />
        <ActionCard
          title="View Inventory"
          icon={<Package />}
          href="/vendor/inventory"
        />
        <ActionCard
          title="Payout History"
          icon={<DollarSign />}
          href="/vendor/payouts"
        />
      </div>
    </div>
  );
}
```

### 6.3 Commission & Payout System

```typescript
// lib/vendor/payout.ts
class PayoutService {
  async calculatePayout(vendorId: string, period: DateRange): Promise<PayoutCalculation> {
    const orders = await getCompletedOrders(vendorId, period);
    const returns = await getReturns(vendorId, period);
    const vendor = await getVendor(vendorId);
    
    let grossSales = 0;
    let commission = 0;
    let shippingCredits = 0;
    
    for (const order of orders) {
      const vendorItems = order.items.filter(i => i.vendorId === vendorId);
      const orderValue = vendorItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      
      grossSales += orderValue;
      commission += orderValue * (vendor.commissionRate / 100);
      
      // Shipping credits if vendor handles shipping
      if (vendor.handlesShipping) {
        shippingCredits += order.shippingCost;
      }
    }
    
    // Deduct returns
    const returnDeductions = returns.reduce((sum, r) => sum + r.refundAmount, 0);
    
    // Calculate fees
    const platformFees = this.calculatePlatformFees(grossSales);
    const paymentProcessingFees = grossSales * 0.02; // 2% payment processing
    
    const netPayout = 
      grossSales 
      - commission 
      - returnDeductions 
      - platformFees 
      - paymentProcessingFees 
      + shippingCredits;
    
    return {
      grossSales,
      returns: returnDeductions,
      commission,
      platformFees,
      paymentProcessingFees,
      shippingCredits,
      netPayout,
    };
  }
  
  async processPayout(vendorId: string, payoutId: string) {
    const payout = await getPayout(payoutId);
    const vendor = await getVendor(vendorId);
    
    // Initiate bank transfer
    const transfer = await initiateTransfer({
      amount: payout.netPayout,
      bankAccount: vendor.bankDetails,
      reference: `PAYOUT-${payoutId}`,
    });
    
    // Update payout status
    await updatePayout(payoutId, {
      status: 'processing',
      transactionId: transfer.id,
    });
    
    return transfer;
  }
}
```

---

## 7. Subscription & Recurring Revenue

### 7.1 Subscription Products

```typescript
// types/subscription.ts
interface SubscriptionProduct {
  id: string;
  productId: string;
  
  // Pricing
  intervals: SubscriptionInterval[];
  
  // Delivery
  deliveryFrequency: 'weekly' | 'biweekly' | 'monthly';
  flexibleDelivery: boolean;
  
  // Features
  pauseAllowed: boolean;
  maxPauseDays: number;
  skipAllowed: boolean;
  cancelAnytime: boolean;
}

interface SubscriptionInterval {
  period: 'monthly' | 'quarterly' | 'yearly';
  price: number;
  comparePrice?: number;
  discountPercent: number;
}

interface UserSubscription {
  id: string;
  userId: string;
  productId: string;
  
  status: 'active' | 'paused' | 'cancelled';
  interval: 'monthly' | 'quarterly' | 'yearly';
  
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextDeliveryDate: Date;
  
  paymentMethod: string;
  shippingAddressId: string;
  
  history: SubscriptionEvent[];
}
```

### 7.2 Subscription Management

```typescript
// components/subscription/SubscriptionManager.tsx
export function SubscriptionManager({ subscription }: { subscription: UserSubscription }) {
  const [loading, setLoading] = useState(false);
  
  const handleSkipDelivery = async () => {
    setLoading(true);
    await skipNextDelivery(subscription.id);
    mutate(`/api/subscriptions/${subscription.id}`);
    setLoading(false);
    toast.success('Next delivery skipped');
  };
  
  const handlePause = async (days: number) => {
    await pauseSubscription(subscription.id, days);
    toast.success(`Subscription paused for ${days} days`);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{subscription.product.name}</span>
          <Badge variant={subscription.status === 'active' ? 'success' : 'warning'}>
            {subscription.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Delivery */}
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">Next Delivery</p>
            <p className="font-medium">
              {format(subscription.nextDeliveryDate, 'PPP')}
            </p>
          </div>
          <Button variant="outline" onClick={handleSkipDelivery} disabled={loading}>
            Skip This Delivery
          </Button>
        </div>
        
        {/* Subscription Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Plan</p>
            <p className="font-medium capitalize">{subscription.interval}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="font-medium">₹{subscription.price}/delivery</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => openEditDialog(subscription)}>
            Edit Subscription
          </Button>
          <Button variant="outline" onClick={() => handlePause(7)}>
            Pause (7 days)
          </Button>
          <Button variant="destructive" onClick={() => cancelSubscription(subscription.id)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 8. Dynamic Pricing

### 8.1 Pricing Rules Engine

```typescript
// lib/pricing/engine.ts
interface PricingRule {
  id: string;
  name: string;
  priority: number;
  conditions: PricingCondition[];
  action: PricingAction;
  enabled: boolean;
  validFrom?: Date;
  validUntil?: Date;
}

interface PricingCondition {
  type: 'user_tier' | 'quantity' | 'time' | 'cart_value' | 'category' | 'product' | 'location';
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between';
  value: any;
}

interface PricingAction {
  type: 'fixed_discount' | 'percentage_discount' | 'fixed_price' | 'multiplier';
  value: number;
  appliesTo: 'product' | 'category' | 'cart';
}

class PricingEngine {
  private rules: PricingRule[];
  
  async calculatePrice(context: PricingContext): Promise<number> {
    const { product, user, quantity, cartValue } = context;
    let finalPrice = product.basePrice;
    
    // Sort rules by priority
    const applicableRules = this.rules
      .filter(rule => this.evaluateConditions(rule.conditions, context))
      .sort((a, b) => b.priority - a.priority);
    
    // Apply first matching rule (or stack based on configuration)
    for (const rule of applicableRules) {
      finalPrice = this.applyAction(finalPrice, rule.action);
      break; // Remove break to stack discounts
    }
    
    // Apply quantity discounts
    if (quantity > 1) {
      const volumeDiscount = this.getVolumeDiscount(product, quantity);
      finalPrice = finalPrice * (1 - volumeDiscount);
    }
    
    return Math.max(finalPrice, product.minPrice || 0);
  }
  
  private evaluateConditions(conditions: PricingCondition[], context: PricingContext): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'user_tier':
          return this.compare(context.user?.tier, condition.operator, condition.value);
        case 'quantity':
          return this.compare(context.quantity, condition.operator, condition.value);
        case 'time':
          return this.compareTime(new Date(), condition.operator, condition.value);
        case 'cart_value':
          return this.compare(context.cartValue, condition.operator, condition.value);
        default:
          return true;
      }
    });
  }
}
```

### 8.2 Time-Based Pricing

```typescript
// lib/pricing/flash-sale.ts
interface FlashSale {
  id: string;
  name: string;
  products: FlashSaleProduct[];
  
  startTime: Date;
  endTime: Date;
  
  displayCountdown: boolean;
  limitedStock: boolean;
  
  status: 'scheduled' | 'active' | 'ended';
}

interface FlashSaleProduct {
  productId: string;
  salePrice: number;
  originalPrice: number;
  stockLimit?: number;
  soldCount: number;
}

// Real-time flash sale component
export function FlashSaleCountdown({ sale }: { sale: FlashSale }) {
  const { timeLeft, isExpired } = useCountdown(sale.endTime);
  
  if (isExpired) return null;
  
  return (
    <div className="bg-red-600 text-white p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6" />
          <span className="font-bold text-lg">FLASH SALE</span>
        </div>
        
        <div className="flex gap-2">
          <TimeBlock value={timeLeft.hours} label="HRS" />
          <span className="text-2xl">:</span>
          <TimeBlock value={timeLeft.minutes} label="MIN" />
          <span className="text-2xl">:</span>
          <TimeBlock value={timeLeft.seconds} label="SEC" />
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Automation & Efficiency

### 9.1 Automated Workflows

```typescript
// lib/automation/workflows.ts
const automatedWorkflows = [
  {
    name: 'Low Stock Alert',
    trigger: { type: 'stock_level', threshold: 10 },
    actions: [
      { type: 'email', to: 'inventory@store.com', template: 'low_stock' },
      { type: 'slack', channel: '#inventory', template: 'low_stock' },
      { type: 'create_po', supplier: 'auto' },
    ],
  },
  {
    name: 'Order Shipped Notification',
    trigger: { type: 'order_status', from: 'processing', to: 'shipped' },
    actions: [
      { type: 'email', to: 'customer', template: 'order_shipped' },
      { type: 'sms', to: 'customer', template: 'order_shipped_sms' },
      { type: 'push', to: 'customer', template: 'order_shipped_push' },
    ],
  },
  {
    name: 'Review Request',
    trigger: { type: 'order_delivered', delay: '3d' },
    actions: [
      { type: 'email', to: 'customer', template: 'review_request' },
    ],
    conditions: [
      { type: 'not_reviewed' },
    ],
  },
  {
    name: 'Win-back Campaign',
    trigger: { type: 'user_inactive', days: 30 },
    actions: [
      { type: 'email', to: 'customer', template: 'winback_offer' },
      { type: 'loyalty_points', amount: 100, reason: 'win_back' },
    ],
  },
];
```

### 9.2 Report Automation

```typescript
// lib/automation/reports.ts
const scheduledReports = [
  {
    name: 'Daily Sales Summary',
    schedule: '0 9 * * *', // 9 AM daily
    recipients: ['sales@store.com', 'management@store.com'],
    reportType: 'sales_summary',
    period: 'yesterday',
    format: 'pdf',
  },
  {
    name: 'Weekly Inventory Report',
    schedule: '0 8 * * 1', // Monday 8 AM
    recipients: ['inventory@store.com'],
    reportType: 'inventory_status',
    format: 'excel',
  },
  {
    name: 'Monthly Business Review',
    schedule: '0 9 1 * *', // 1st of month
    recipients: ['ceo@store.com', 'cfo@store.com'],
    reportType: 'business_review',
    period: 'last_month',
    format: 'pdf',
  },
];

async function generateReport(config: ReportConfig) {
  const data = await fetchReportData(config.reportType, config.period);
  const report = await renderReport(config.reportType, data, config.format);
  
  await sendEmail({
    to: config.recipients,
    subject: `${config.name} - ${format(new Date(), 'PPP')}`,
    attachments: [{ filename: `${config.name}.${config.format}`, content: report }],
  });
}
```

---

## 10. Monetization Beyond Products

### 10.1 Revenue Diversification Matrix

| Revenue Stream | Model | Potential | Effort |
|---------------|-------|-----------|--------|
| **Platform Commission** | % of vendor sales | Very High | High |
| **API Subscriptions** | Monthly fee | High | Medium |
| **Promoted Listings** | CPC/CPM | Medium | Low |
| **Featured Products** | Fixed fee | Medium | Low |
| **Premium Vendor Tier** | Monthly subscription | Medium | Medium |
| **White-Label Licensing** | License fee | High | Very High |
| **Data & Analytics** | Subscription | Medium | Medium |
| **Financial Services** | Commission | High | High |

### 10.2 Advertising Platform

```typescript
// types/advertising.ts
interface AdCampaign {
  id: string;
  vendorId: string;
  
  type: 'sponsored_product' | 'banner' | 'search_boost';
  status: 'draft' | 'active' | 'paused' | 'ended';
  
  budget: {
    daily: number;
    total: number;
    spent: number;
  };
  
  bidding: {
    strategy: 'cpc' | 'cpm' | 'cpa';
    maxBid: number;
  };
  
  targeting: {
    keywords?: string[];
    categories?: string[];
    locations?: string[];
    demographics?: DemographicTarget;
  };
  
  schedule: {
    startDate: Date;
    endDate?: Date;
    dayParting?: DayPartingSchedule;
  };
  
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
  };
}

// Ad serving logic
async function serveAd(context: AdContext): Promise<Ad | null> {
  const eligibleCampaigns = await getEligibleCampaigns({
    placement: context.placement,
    category: context.category,
    keywords: context.searchQuery,
  });
  
  if (eligibleCampaigns.length === 0) return null;
  
  // Auction: highest bid wins (with quality score factor)
  const winner = eligibleCampaigns
    .map(campaign => ({
      campaign,
      score: campaign.bidding.maxBid * campaign.qualityScore,
    }))
    .sort((a, b) => b.score - a.score)[0];
  
  // Record impression
  await recordImpression(winner.campaign.id, context);
  
  return formatAd(winner.campaign);
}
```

### 10.3 Premium Features Tiers

```typescript
// Vendor premium tiers
const vendorTiers = {
  basic: {
    name: 'Basic',
    price: 0,
    features: {
      productLimit: 50,
      commission: 15,
      support: 'email',
      analytics: 'basic',
      promotions: false,
      apiAccess: false,
    },
  },
  professional: {
    name: 'Professional',
    price: 2999, // per month
    features: {
      productLimit: 500,
      commission: 12,
      support: 'priority_email',
      analytics: 'advanced',
      promotions: true,
      apiAccess: true,
      customStorefront: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 9999, // per month
    features: {
      productLimit: -1, // unlimited
      commission: 8,
      support: 'dedicated_manager',
      analytics: 'enterprise',
      promotions: true,
      apiAccess: true,
      customStorefront: true,
      whiteLabel: true,
      customIntegrations: true,
    },
  },
};
```

---

## Summary: Revenue Impact Projections

### Short-term (3-6 months)

| Initiative | Investment | Expected Revenue Lift |
|-----------|------------|----------------------|
| AOV Optimization | Low | +15-20% AOV |
| Cart Recovery | Low | +10-15% recovery |
| Loyalty Program | Medium | +20% repeat purchases |

### Medium-term (6-12 months)

| Initiative | Investment | Expected Revenue Lift |
|-----------|------------|----------------------|
| B2B Features | High | New B2B revenue stream |
| Multi-Vendor | Very High | +50% catalog, commission revenue |
| Subscriptions | Medium | Recurring revenue base |

### Long-term (12-24 months)

| Initiative | Investment | Expected Revenue Lift |
|-----------|------------|----------------------|
| API Platform | High | SaaS revenue stream |
| Advertising | Medium | Additional margin |
| White-Label | Very High | Licensing revenue |

---

*This document outlines business opportunities and should be reviewed with financial projections before implementation.*
