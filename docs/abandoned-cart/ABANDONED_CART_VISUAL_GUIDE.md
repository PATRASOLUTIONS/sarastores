# Abandoned Cart Email System - Visual Guide

## 🔄 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     E-COMMERCE APP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PRODUCT PAGE                                            │   │
│  │  ├─ User browses product                                 │   │
│  │  └─ Clicks "Add to Cart"                                │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  USECAR HOOK (hooks/useCart.ts)                          │   │
│  │  ├─ addToCart(product)                                   │   │
│  │  ├─ Updates localStorage                                 │   │
│  │  └─ Syncs to API                                         │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CART API (app/api/cart/route.ts)                        │   │
│  │  ├─ POST /api/cart                                       │   │
│  │  └─ Stores cart in MongoDB with:                         │   │
│  │      • userId                                             │   │
│  │      • items[]                                            │   │
│  │      • updatedAt = NOW                                    │   │
│  │      • createdAt                                          │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MONGODB (carts collection)                              │   │
│  │  {                                                        │   │
│  │    _id: ObjectId,                                         │   │
│  │    userId: String,                                        │   │
│  │    items: [{...}],                                        │   │
│  │    createdAt: Date,                                       │   │
│  │    updatedAt: Date  ← KEY FIELD                           │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ (Background Task)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CRON JOB (lib/cron/...)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CRON JOB #1: 2-Minute Check                             │   │
│  │  Schedule: */2 * * * * (every 2 minutes)                 │   │
│  │                                                           │   │
│  │  Query MongoDB:                                           │   │
│  │  ├─ updatedAt < 20 minutes ago?                           │   │
│  │  ├─ items not empty?                                      │   │
│  │  ├─ lastAbandonmentEmailSent = null/missing?              │   │
│  │  └─ YES → Send email                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  EMAIL SERVICE (lib/email.ts)                            │   │
│  │  ├─ Fetch user email from MongoDB                        │   │
│  │  ├─ Get cart items                                        │   │
│  │  ├─ Render email template                                 │   │
│  │  └─ Send via SMTP (Gmail/Custom)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CUSTOMER EMAIL INBOX 📧                                 │   │
│  │  From: nabaratanpatra@gmail.com                          │   │
│  │  Subject: "You forgot something amazing in your cart! 🛒" │   │
│  │  Content:                                                 │   │
│  │  ├─ Customer name greeting                                │   │
│  │  ├─ Cart items (image, name, price)                       │   │
│  │  ├─ "Complete your purchase" button                       │   │
│  │  └─ Expires after 24 hours                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CRON JOB #2: Hourly Follow-up                           │   │
│  │  Schedule: 0 * * * * (every hour)                        │   │
│  │                                                           │   │
│  │  Query MongoDB:                                           │   │
│  │  ├─ updatedAt < 1 hour ago?                               │   │
│  │  ├─ items not empty?                                      │   │
│  │  ├─ lastAbandonmentEmailSent exists?                      │   │
│  │  └─ YES → Send follow-up email                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Timeline Example

### Scenario: User Abandons Cart for 2+ Hours

```
00:00 → User adds product "Laptop" to cart
         updatedAt = 00:00
         ✅ Stored in MongoDB
         
20:00 → Cron job runs (2-min check)
         Finds cart: updatedAt = 00:00 (20 min old)
         lastAbandonmentEmailSent = null
         ✅ Conditions met!
         📧 EMAIL #1 SENT: "You forgot something amazing"
         Updates: lastAbandonmentEmailSent = 20:00
                  abandonmentEmailCount = 1
         
22:00 → Cron job runs (2-min check)
         Cart still abandoned (updatedAt = 00:00)
         lastAbandonmentEmailSent = 20:00 (only 2 min ago)
         ❌ Rate limited (wait 2+ min, only 2 min passed)
         No email sent
         
24:00 → Cron job runs (2-min check)
         Cart still abandoned
         lastAbandonmentEmailSent = 20:00 (4 min ago)
         ✅ More than 2 min passed!
         📧 EMAIL #2 SENT: "Your items are still waiting"
         Updates: lastAbandonmentEmailSent = 24:00
                  abandonmentEmailCount = 2
         
60:00 → Cron job runs (hourly check)
         Cart abandoned for 1 hour
         lastAbandonmentEmailSent = 24:00 (36 min ago)
         ✅ Follow-up check conditions met!
         📧 EMAIL #3 SENT: "Last chance: Complete your order"
         Updates: lastAbandonmentEmailSent = 60:00
                  abandonmentEmailCount = 3
         
120:00 → Similar pattern continues...
          🔄 Cron checks every 2 min + hourly follow-ups
          📧 More emails sent until:
             • User checks out ✅
             • User clears cart 🗑️
             • 24+ hours pass (optional: stop sending)

OR

25:00 → User returns from email
         Clicks "Continue Shopping" button
         Views cart
         Proceeds to checkout
         Places order
         ✅ Cart cleared
         
60:00 → Cron job runs
         Cart items are empty now: items: []
         ❌ Abandoned email NOT sent (cart is empty)
         Process complete! 🎉
```

---

## 📊 Database State Evolution

### Initial State (Product Added)
```mongodb
db.carts.findOne({ userId: "user-123" })
{
  _id: ObjectId("..."),
  userId: "user-123",
  items: [
    {
      id: "prod-456",
      name: "Laptop",
      price: 50000,
      quantity: 1,
      ...
    }
  ],
  createdAt: ISODate("2024-01-28T10:00:00.000Z"),
  updatedAt: ISODate("2024-01-28T10:00:00.000Z")
}
```

### After 20 Minutes + Email Sent
```mongodb
{
  _id: ObjectId("..."),
  userId: "user-123",
  items: [
    { id: "prod-456", name: "Laptop", ... }
  ],
  createdAt: ISODate("2024-01-28T10:00:00.000Z"),
  updatedAt: ISODate("2024-01-28T10:00:00.000Z"),  // Still old!
  lastAbandonmentEmailSent: ISODate("2024-01-28T10:20:00.000Z"),  // NEW
  abandonmentEmailCount: 1  // NEW
}
```

### After Multiple Emails
```mongodb
{
  _id: ObjectId("..."),
  userId: "user-123",
  items: [...],
  createdAt: ISODate("2024-01-28T10:00:00.000Z"),
  updatedAt: ISODate("2024-01-28T10:00:00.000Z"),
  lastAbandonmentEmailSent: ISODate("2024-01-28T11:00:00.000Z"),  // Updated
  abandonmentEmailCount: 3  // Updated
}
```

### After Checkout
```mongodb
{
  _id: ObjectId("..."),
  userId: "user-123",
  items: [],  // CLEARED
  createdAt: ISODate("2024-01-28T10:00:00.000Z"),
  updatedAt: ISODate("2024-01-28T10:25:00.000Z"),  // Updated to checkout time
  lastAbandonmentEmailSent: ISODate("2024-01-28T10:20:00.000Z"),
  abandonmentEmailCount: 1  // Preserved for analytics
}
```

---

## 🔌 API Endpoints

### 1. Add to Cart
```http
POST /api/cart
Content-Type: application/json

{
  "userId": "user-123",
  "items": [
    {
      "id": "prod-456",
      "name": "Laptop",
      "price": 50000,
      "quantity": 1
    }
  ]
}
```

### 2. Get Cart
```http
GET /api/cart?userId=user-123
```

### 3. Send Abandoned Cart Email (Test)
```http
POST /api/debug/test-abandoned-cart
Content-Type: application/json

{
  "userId": "user-123"
}
```

---

## 🎯 Check Types Comparison

| Check Type | Frequency | Conditions | Purpose |
|-----------|-----------|-----------|---------|
| **2-Min Check** | Every 2 minutes | • updatedAt < 20 min ago<br/>• lastAbandonmentEmailSent = null | Initial detection & early reminders |
| **Hourly Check** | Every hour | • updatedAt < 1 hour ago<br/>• lastAbandonmentEmailSent exists | Follow-up reminders |

---

## 📧 Email Template Flow

```
CART_ABANDONMENT Template
├─ Subject: "You forgot something amazing in your cart! 🛒"
├─ Header: Orange gradient background
├─ Content:
│  ├─ Customer name greeting
│  ├─ "We noticed you left these great items..."
│  ├─ Cart items preview (up to 3):
│  │  ├─ Product image (if available)
│  │  ├─ Product name
│  │  ├─ Price per item
│  │  └─ Quantity
│  ├─ "Complete Your Purchase" CTA button
│  │  └─ Links to: /cart
│  └─ Footer: Trust badges, support info
└─ Footer: Unsubscribe link (optional)
```

---

## 🚦 Status Indicators in Logs

```
[2-MIN CHECK]     ← Initial detection check
[HOURLY CHECK]    ← Follow-up check
[2-MIN] 📧        ← Email being sent
[2-MIN] ✅        ← Email sent successfully
[2-MIN] ❌        ← Email failed
[2-MIN] Updated   ← Database updated with email metadata
```

---

## 🔐 Security Considerations

✅ **User Verification**
- Email verified in user record before sending
- Rate limited to prevent abuse

✅ **Data Privacy**
- Only sends to verified user emails
- No sensitive data in email template
- No direct payment info included

✅ **Spam Prevention**
- 2-minute minimum gap between emails to same cart
- Only sends if cart has items
- Stops sending once cart emptied

---

## 📈 Metrics You Can Track

```javascript
// Per Cart:
cart.abandonmentEmailCount    // How many emails sent
cart.lastAbandonmentEmailSent // When was last email sent

// Analytics Queries:
1. Total abandoned carts: 
   db.carts.find({ items: { $not: { $size: 0 }}, 
                   updatedAt: { $lt: 20_min_ago } }).count()

2. Email conversion rate:
   (Carts that checkout after email / Total emails sent) × 100

3. Recovery rate:
   (Customers who complete purchase after email / Total sent) × 100

4. Peak abandonment times:
   db.carts.aggregate([
     { $match: { items: { $not: { $size: 0 } } } },
     { $group: { _id: { $hour: "$updatedAt" }, 
                 count: { $sum: 1 } } }
   ])
```

---

## 🎓 Key Concepts

### Abandonment Detection
- **Trigger**: No checkout for 20+ minutes
- **Signal**: `updatedAt` timestamp hasn't changed in 20+ min
- **Confirmation**: Items still in cart

### Rate Limiting
- **Purpose**: Prevent spam and email overload
- **Method**: 2-minute minimum gap between emails per cart
- **Tracking**: `lastAbandonmentEmailSent` timestamp

### Cron Jobs
- **What**: Background tasks that run on schedule
- **When**: Automatically, no user action needed
- **How**: Runs on server during request processing

### Email Service
- **Provider**: SMTP (Gmail, custom server, etc.)
- **Auth**: Username/password or OAuth
- **Template**: Customizable HTML with variables

---

## ✨ Complete Flow Summary

```
1. USER ADDS TO CART
   └─ Stored in DB with updatedAt timestamp

2. USER DOESN'T CHECKOUT
   └─ Cart sits idle for 20+ minutes

3. CRON JOB DETECTS (Every 2 min)
   └─ Finds old cart, loads user email

4. EMAIL SENT
   └─ Abandoned cart notification delivered

5. CUSTOMER RECEIVES EMAIL
   └─ Views cart items in email

6. CUSTOMER CLICKS LINK
   └─ Returns to cart (or ignores)

7. EITHER:
   ├─ Checkouts → Email stops (cart cleared)
   └─ Still ignores → More emails (every hour)

8. ANALYTICS RECORDED
   └─ Tracks email count, timing, success
```

Done! The system is complete and fully documented. 🎉
