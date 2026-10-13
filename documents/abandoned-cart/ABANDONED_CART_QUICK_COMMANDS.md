# 🚀 Abandoned Cart - Quick Start Commands

## Step 1: Environment Setup

### Copy your Gmail App Password into `.env.local`

```bash
# Edit .env.local and add/update these lines:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-gmail@gmail.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**Need Gmail App Password?**
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click "Security" in left menu
3. Scroll to "App passwords"
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password
6. Paste in `.env.local` as shown above

---

## Step 2: Restart Your Server

```bash
# Stop current server (Ctrl+C)

# Clear cache and restart
npm run dev

# Wait for "ready on http://localhost:3000"
# Look for these logs:
# [INSTRUMENTATION] Node.js runtime detected
# [INSTRUMENTATION] Loading cron jobs
# [CRON] Abandoned cart cron jobs initialized!
```

---

## Step 3: Test Immediately (No Waiting!)

### 3a. Get Your User ID

```bash
# You need your MongoDB user ID
# Go to MongoDB Atlas (or local MongoDB)
# Find your user in 'users' collection
# Copy the _id value (looks like: 676a1b2c3d4e5f6g7h8i9j0k)
```

### 3b. Test Email Sending

**Using cURL** (copy-paste this):
```bash
curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID_HERE"}'
```

**Using Postman**:
1. New → Request
2. Method: POST
3. URL: `http://localhost:3000/api/debug/test-abandoned-cart`
4. Body → raw JSON:
   ```json
   {"userId": "YOUR_USER_ID_HERE"}
   ```
5. Click Send

**Expected Response**:
```json
{
  "success": true,
  "message": "Abandoned cart email sent to user@example.com",
  "details": {
    "userId": "...",
    "email": "user@example.com",
    "itemCount": 3
  }
}
```

### 3c. Check Your Email

- Open Gmail inbox
- Look for email from `your-gmail@gmail.com`
- Subject: **"You forgot something amazing in your cart! 🛒"**
- Should contain your abandoned cart items

✅ **If you see the email, everything is working!**

---

## Step 4: Real-World Test (20-minute test)

```bash
# 1. Open browser: http://localhost:3000
# 2. Find a product and click "Add to Cart"
# 3. DON'T checkout (leave it)
# 4. Monitor server logs

# Look for these logs after 20+ minutes:
# [2-MIN CHECK] Running Abandoned Cart Check...
# [2-MIN] Found 1 potential abandoned carts
# [2-MIN] 📧 Sending email to your-email@example.com
# [2-MIN] ✅ Abandoned cart email sent

# 5. Check your email inbox
# You should receive the abandoned cart email!

# 6. Keep waiting to see follow-up (after 1 hour total):
# [HOURLY CHECK] Running Abandoned Cart Follow-up...
# [HOURLY] ✅ Abandoned cart email sent
```

---

## Step 5: Verify in MongoDB

### Check Cart Record

```bash
# Open MongoDB Compass or use mongosh

# Find your cart
use your_database_name
db.carts.findOne({userId: "YOUR_USER_ID"})

# You should see:
{
  _id: ObjectId(...),
  userId: "YOUR_USER_ID",
  items: [{...product...}],
  createdAt: ISODate("2024-01-28T10:00:00.000Z"),
  updatedAt: ISODate("2024-01-28T10:00:00.000Z"),
  lastAbandonmentEmailSent: ISODate("2024-01-28T10:20:00.000Z"),  // NEW
  abandonmentEmailCount: 1  // NEW
}
```

---

## Common Copy-Paste Fixes

### Problem: "Cron jobs not initializing"

```bash
# Check if node-cron is installed
npm list node-cron

# If missing, install it
npm install node-cron

# Restart server
npm run dev
```

### Problem: "SMTP authentication failed"

```bash
# Make sure you're using App Password, not regular password
# Get new App Password from: https://myaccount.google.com/apppasswords

# Update .env.local
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-new-16-char-app-password

# Restart server
npm run dev
```

### Problem: "Test endpoint returns 404"

```bash
# Make sure you're in development mode
NODE_ENV=development

# Check file exists
# app/api/debug/test-abandoned-cart/route.ts

# Restart server
npm run dev
```

### Problem: "No logs about cron jobs"

```bash
# Check instrumentation.ts exists in project root
# File should be: c:\Users\nabap\OneDrive\Desktop\ALL_PROJECTS\ecommerce-byte-wisemain\instrumentation.ts

# If missing, restart server with:
npm run dev

# You should see in logs:
# [INSTRUMENTATION] Registering hooks...
```

---

## Troubleshooting Commands

### 1. Check Email Configuration

```bash
# Test if SMTP is working by calling another endpoint
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "your-email@example.com",
    "phone": "9999999999",
    "message": "Test email"
  }'

# Should get: {"success": true}
```

### 2. Check MongoDB Connection

```bash
# In MongoDB client, test query:
use your_database_name
db.users.findOne()  // Should return a user
db.carts.findOne()  // Should return a cart
```

### 3. Monitor Real-Time Logs

```bash
# Keep server running and watch logs
# Use this to see all [CRON] messages
npm run dev 2>&1 | grep -i "cron\|email\|abandoned"
```

### 4. Check Node Version

```bash
node --version
# Should be 18+ or 20+
```

---

## Curl Commands Reference

### 1. Test Abandoned Cart Email
```bash
curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID_HERE"}'
```

### 2. Get Test Instructions
```bash
curl -X GET http://localhost:3000/api/debug/test-abandoned-cart
```

### 3. Test Contact Form (to verify SMTP)
```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "email": "your-email@example.com",
    "phone": "9999999999",
    "message": "Test"
  }'
```

---

## Environment Variables Template

Copy and paste into `.env.local`:

```env
# ============================================
# EMAIL SMTP CONFIGURATION
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-gmail@gmail.com

# ============================================
# APPLICATION CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
NEXT_PUBLIC_NODE_ENV=development

# ============================================
# MONGODB CONFIGURATION (if not already set)
# ============================================
MONGODB_URI=your-mongodb-uri
# MONGODB=database-name

# ============================================
# OTHER CONFIGURATIONS
# ============================================
# NEXTAUTH_SECRET=your-secret
# NEXTAUTH_URL=http://localhost:3000
# RAZORPAY_KEY_ID=your-razorpay-key
# RAZORPAY_KEY_SECRET=your-razorpay-secret
```

---

## Files Modified

### Quick Reference
- ✅ `lib/cron/abandoned-cart.ts` - Main implementation
- ✅ `instrumentation.ts` - Initialization
- ✅ `app/api/debug/test-abandoned-cart/route.ts` - Test endpoint (new)

### Documentation
- 📖 `ABANDONED_CART_IMPLEMENTATION.md` - Full guide
- 📖 `ABANDONED_CART_QUICK_TEST.md` - Quick ref
- 📖 `ABANDONED_CART_EMAIL_FIX.md` - Technical details
- 📖 `ABANDONED_CART_VISUAL_GUIDE.md` - Architecture
- 📖 `ABANDONED_CART_VERIFICATION_CHECKLIST.md` - Testing
- 📖 `ABANDONED_CART_COMPLETE_SUMMARY.md` - Overview

---

## Timeline Summary

```
Your Scenario:
0 min  → Add product to cart
20 min → 📧 EMAIL SENT (automatic)
22 min → Could send EMAIL #2 (if still abandoned)
60 min → 📧 EMAIL #3 SENT (follow-up)
120 min → 📧 EMAIL #4 SENT (if still abandoned)
...
When checkout or cart cleared → Emails stop ✅
```

---

## Success Criteria ✅

- [ ] `.env.local` updated with SMTP credentials
- [ ] Server restarted and logs show `[CRON]` initialization
- [ ] Test endpoint call returns success
- [ ] Email received in inbox
- [ ] Product add to cart works (from UI)
- [ ] Cron logs appear every 2 minutes
- [ ] Follow-up email received after 1 hour
- [ ] Cart records show `lastAbandonmentEmailSent` in MongoDB

---

## Getting Help

1. **Check Logs**: Look for `[CRON]`, `[EMAIL]`, or `[2-MIN]`
2. **Test SMTP**: Use `/api/contact` to verify email works
3. **Verify DB**: Check MongoDB for cart and user records
4. **Check Credentials**: Ensure `SMTP_PASS` is 16-char app password
5. **Restart Server**: Sometimes fresh start fixes issues

---

## Final Checklist

```bash
# 1. Update .env.local ✅
# 2. Install dependencies (if needed)
npm install node-cron

# 3. Restart server ✅
npm run dev

# 4. Test endpoint ✅
curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID_HERE"}'

# 5. Check inbox ✅

# 6. Real test: Add to cart and wait ✅

# 7. Monitor logs ✅

# Done! 🎉
```

---

**You're all set! The abandoned cart email system is ready to use!** 🚀
