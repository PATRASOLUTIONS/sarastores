# Abandoned Cart Email System - Fixed Implementation

## Problem Summary

**Issue**: You added products to cart and kept them for 20+ minutes on local server, but didn't receive abandonment emails.

### Root Causes Fixed:

1. **❌ Cron ran only hourly** - Changed to run every 2 minutes for initial detection
2. **❌ Email marked as permanently sent** - Now allows repeated emails with 2-minute spacing
3. **❌ Cart must be 1-24 hours old** - Changed to 20+ minutes for initial email
4. **❌ Dev mode not initialized** - Now initializes in development mode as well

---

## What Changed

### 1. Updated Cron Schedule (`lib/cron/abandoned-cart.ts`)

**Before:**
```typescript
const CRON_SCHEDULE = '0 * * * *'; // Only every hour
// Once abandonedEmailSent = true, no more emails sent
```

**After:**
```typescript
const CRON_SCHEDULE_2_MIN = '*/2 * * * *';   // Every 2 minutes
const CRON_SCHEDULE_HOURLY = '0 * * * *';    // Every hour (follow-ups)

// Two checks:
// 1. First email: Carts abandoned 20+ minutes → runs every 2 minutes
// 2. Follow-up: Carts abandoned 1+ hour → runs every hour
```

### 2. Email Tracking System

**Before:**
```typescript
abandonedEmailSent: { $ne: true }  // Once true, never sends again
```

**After:**
```typescript
// Tracks last email time and count
lastAbandonmentEmailSent: Date     // When was last email sent
abandonmentEmailCount: number      // How many emails have been sent

// Rate limiting: Don't spam - wait at least 2 minutes between emails
```

### 3. Dev Mode Support

**Before:**
```typescript
if (process.env.NEXT_RUNTIME !== 'nodejs') return;  // Skipped in dev
```

**After:**
```typescript
if (isNodeRuntime || process.env.NODE_ENV === 'development') {
    // Initializes in both production and development
}
```

---

## How It Works Now

### Timeline for Abandoned Carts:

```
User adds product to cart
        ↓
20 minutes pass (no checkout)
        ↓
🔔 FIRST EMAIL SENT (via 2-minute cron job)
        ↓
22 minutes pass
        ↓
(2-minute check prevents another email immediately)
        ↓
1 hour total passes
        ↓
🔔 FOLLOW-UP EMAIL SENT (via hourly cron job)
        ↓
2+ hours pass
        ↓
🔔 ANOTHER FOLLOW-UP EMAIL (cycle repeats)
```

### Key Points:

✅ **First email**: 20+ minutes after cart abandoned  
✅ **Frequency**: Up to every 2 minutes (with rate limiting)  
✅ **Follow-ups**: Every hour after that  
✅ **Works on local server**: Initializes in development mode  
✅ **DB fields updated**: Tracks email history per cart  

---

## Testing on Local Server

### Option 1: Manual Test Endpoint (QUICKEST ⚡)

This endpoint lets you test immediately without waiting:

```bash
# Get instructions
GET http://localhost:3000/api/debug/test-abandoned-cart

# Send test email
POST http://localhost:3000/api/debug/test-abandoned-cart
Content-Type: application/json

{
  "userId": "YOUR_MONGODB_USER_ID_HERE"
}
```

**Example with cURL:**
```bash
curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \
  -H "Content-Type: application/json" \
  -d '{"userId": "676a1b2c3d4e5f6g7h8i9j0k"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Abandoned cart email sent to user@example.com",
  "details": {
    "userId": "676a1b2c3d4e5f6g7h8i9j0k",
    "email": "user@example.com",
    "itemCount": 3,
    "userName": "John Doe"
  }
}
```

### Option 2: Wait for Automatic Cron (Real Test)

1. Add product to cart (cart gets stored in DB with `updatedAt`)
2. Wait 20+ minutes
3. Cron job runs every 2 minutes and sends email automatically
4. Check email inbox for abandonment notice

### Option 3: Monitor Cron Jobs

In your local server logs, you should see:

```
[CRON] Setting up abandoned cart checks...
[2-MIN CHECK] Running Abandoned Cart Check...
[2-MIN] Looking for carts not updated since 2024-01-28T10:40:00.000Z
[2-MIN] Found 1 potential abandoned carts.
[2-MIN] Processing cart 676a1b2c3d4e5f6g7h8i9j0k...
[2-MIN] 📧 Sending email to user@example.com for cart 676a1b2c3d4e5f6g7h8i9j0k
[2-MIN] ✅ Abandoned cart email sent to user@example.com
[2-MIN] Updated cart 676a1b2c3d4e5f6g7h8i9j0k: emailCount=1
```

---

## Database Schema Changes

### Cart Document Now Includes:

```javascript
{
  _id: ObjectId,
  userId: String,
  items: Array,
  createdAt: Date,
  updatedAt: Date,
  
  // NEW FIELDS:
  lastAbandonmentEmailSent: Date,      // When last email was sent
  abandonmentEmailCount: Number        // Total emails sent (for analytics)
}
```

### Migration (Automatic)

- Old carts with `abandonedEmailSent: true` will still work
- New carts use the new `lastAbandonmentEmailSent` field
- On first email, old field is ignored and new field is set

---

## Configuration

### Customize Timing

To change when emails are sent, edit `lib/cron/abandoned-cart.ts`:

```typescript
// For 10 minutes instead of 20 minutes
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

// For every minute instead of every 2 minutes
const CRON_SCHEDULE_2_MIN = '* * * * *';

// For every 30 minutes instead of hourly follow-up
const CRON_SCHEDULE_HOURLY = '*/30 * * * *';
```

### Enable/Disable

To disable abandoned cart emails:
```typescript
// In instrumentation.ts, comment out:
// await initCronJobs();
```

---

## Email Content

The email sent uses the template `emailTemplates.CART_ABANDONMENT` which includes:
- Customer greeting
- Up to 3 abandoned cart items
- Product details (price, quantity, image)
- Direct link back to cart
- Special messaging to encourage completion

---

## Troubleshooting

### ❌ Not receiving emails?

1. **Check SMTP config in `.env.local`**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

2. **Check browser console logs**
   - Look for `[CRON]` messages
   - Should see cron job initialization

3. **Check server logs**
   - Look for `[2-MIN CHECK]` logs
   - Check for email sending errors

4. **Test with manual endpoint**
   ```bash
   POST /api/debug/test-abandoned-cart
   ```

### ❌ Email sent but user didn't receive it?

- Check spam/promotions folder
- Verify email address is correct in database
- Test email config with a different endpoint like `/api/contact`

### ❌ Getting same email repeatedly?

- This is normal! That's the feature
- Each email is spaced at least 2 minutes apart
- To prevent emails, customer should checkout or clear cart

---

## Environment Variables Required

Make sure these are in your `.env.local`:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=your-email@gmail.com

# App URL (for cart link in email)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Files Modified

1. ✅ `lib/cron/abandoned-cart.ts` - Updated cron logic
2. ✅ `instrumentation.ts` - Enhanced initialization
3. ✅ `app/api/debug/test-abandoned-cart/route.ts` - NEW test endpoint

---

## Summary

**Before**: Cart abandoned → Wait 1 hour → One email sent → No more emails  
**After**: Cart abandoned → 20 minutes → Email sent → Every 2 minutes (with rate limit) → Follow-ups every hour

This gives customers multiple chances to recover their cart while respecting rate limits.
