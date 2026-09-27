# ✅ Abandoned Cart Implementation - Verification Checklist

## Pre-Launch Checklist

### ✅ Code Changes
- [x] Updated `lib/cron/abandoned-cart.ts` with new cron schedules
- [x] Modified `instrumentation.ts` for dev mode support
- [x] Created test endpoint `/api/debug/test-abandoned-cart/route.ts`
- [x] Verified all file syntax (no TypeScript errors)

### ✅ Environment Configuration
- [ ] **SMTP_HOST** set in `.env.local`
  ```env
  SMTP_HOST=smtp.gmail.com
  ```
- [ ] **SMTP_PORT** set in `.env.local`
  ```env
  SMTP_PORT=587
  ```
- [ ] **SMTP_USER** set in `.env.local`
  ```env
  SMTP_USER=your-gmail@gmail.com
  ```
- [ ] **SMTP_PASS** set in `.env.local` (app password, not regular password)
  ```env
  SMTP_PASS=your-16-char-app-password
  ```
- [ ] **SMTP_FROM** set in `.env.local`
  ```env
  SMTP_FROM=your-gmail@gmail.com
  ```
- [ ] **NEXT_PUBLIC_APP_URL** set in `.env.local`
  ```env
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

### ✅ Database Configuration
- [ ] MongoDB connection working
- [ ] **carts** collection exists (auto-created on first cart)
- [ ] **users** collection has user records
- [ ] Users have **email** field populated

### ✅ Email Setup (Gmail Example)
- [ ] Google Account has 2-Factor Authentication enabled
- [ ] Generated App Password for "Mail"
- [ ] App Password copied to `SMTP_PASS`
- [ ] Test email sending with another endpoint (e.g., `/api/contact`)

---

## Testing Checklist

### ✅ Test 1: Manual Email Test (5 seconds)

```bash
# 1. Find your user ID in MongoDB
# 2. Call this:
curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID_HERE"}'

# 3. Check response
# Expected: { success: true, message: "Abandoned cart email sent to..." }

# ✅ PASS: Received success response + email in inbox
# ❌ FAIL: Got error response or no email
```

### ✅ Test 2: Add Product to Cart

```bash
# 1. Open browser and go to: http://localhost:3000
# 2. Search/browse for a product
# 3. Click "Add to Cart"
# 4. Verify cart shows product

# ✅ PASS: Product visible in cart
# ❌ FAIL: Product not in cart or error
```

### ✅ Test 3: Check Server Logs

```bash
# 1. Look at Next.js server console
# 2. Find logs containing:

[INSTRUMENTATION] Node.js runtime detected
[INSTRUMENTATION] Loading cron jobs
[CRON] Setting up abandoned cart checks
[CRON] Abandoned cart cron jobs initialized!

# ✅ PASS: All logs present
# ❌ FAIL: Logs missing or have errors
```

### ✅ Test 4: Automatic Email (20-minute wait)

```bash
# 1. Add product to cart (don't checkout)
# 2. Monitor server logs
# 3. Wait 20+ minutes
# 4. Check logs for:

[2-MIN CHECK] Running Abandoned Cart Check...
[2-MIN] Found 1 potential abandoned carts
[2-MIN] 📧 Sending email to your-email@example.com
[2-MIN] ✅ Abandoned cart email sent

# 5. Check email inbox for "You forgot something amazing" email

# ✅ PASS: Email received and logged
# ❌ FAIL: No email or logs
```

### ✅ Test 5: Repeated Emails (2+ hours total)

```bash
# 1. Keep cart abandoned (don't checkout)
# 2. Monitor logs over time
# 3. After 1+ hour, should see:

[HOURLY CHECK] Running Abandoned Cart Follow-up...
[HOURLY] Found 1 potential abandoned carts
[HOURLY] 📧 Sending email to your-email@example.com
[HOURLY] ✅ Abandoned cart email sent

# 4. Receive second email (follow-up)

# ✅ PASS: Multiple emails received over time
# ❌ FAIL: Only one email or no follow-ups
```

### ✅ Test 6: Email Stops After Checkout

```bash
# 1. Add product to cart
# 2. Wait for first email (20 min)
# 3. Proceed to checkout
# 4. Place order successfully
# 5. Wait another 20 minutes
# 6. Monitor logs

# Expected: NO emails in logs after checkout
# ✅ PASS: No abandoned cart emails after purchase
# ❌ FAIL: Still receiving emails after checkout
```

---

## Common Issues & Solutions

### ❌ Issue: "SMTP_PASS is wrong"

**Symptoms**: Error log shows "Invalid login" or "Authentication failed"

**Solution**:
1. ❌ Don't use regular Gmail password
2. ✅ Use [App Password](https://support.google.com/accounts/answer/185833) instead
3. Steps:
   - Go to Google Account settings
   - Enable 2-Factor Authentication (if not already)
   - Generate App Password for "Mail"
   - Copy the 16-character password
   - Paste in `.env.local` as `SMTP_PASS`

### ❌ Issue: "Cron jobs failed to load"

**Symptoms**: Error: "Failed to load node-cron"

**Solution**:
1. Check if `node-cron` is installed:
   ```bash
   npm list node-cron
   ```
2. If missing, install it:
   ```bash
   npm install node-cron
   ```
3. Restart dev server

### ❌ Issue: "Emails not being sent"

**Symptoms**: 
- No logs showing email send attempts
- OR logs show "Error sending email"

**Solution**:
1. Test email config first:
   - Try `/api/contact` endpoint
   - If that works, email config is fine
   - If that fails, fix SMTP credentials first

2. Check user record:
   ```bash
   db.users.findOne({ _id: ObjectId("your-user-id") })
   # Check: user.email field exists and is valid
   ```

3. Check cart record:
   ```bash
   db.carts.findOne({ userId: "your-user-id" })
   # Check: items array is not empty
   # Check: updatedAt is recent
   ```

### ❌ Issue: "Test endpoint not found"

**Symptoms**: 404 error when calling `/api/debug/test-abandoned-cart`

**Solution**:
1. Check file exists:
   ```
   app/api/debug/test-abandoned-cart/route.ts
   ```
2. Ensure you're in development mode:
   - Test endpoint only works when `NODE_ENV=development`
3. Restart dev server

### ❌ Issue: "Email received but looks ugly"

**Symptoms**: Email template not rendering properly

**Solution**:
1. Check email client:
   - Gmail sometimes blocks some CSS
   - Try different email client
2. Check SMTP_FROM is set correctly
3. Email might need to be marked as "trusted sender"

---

## Performance Checklist

- [ ] Cron jobs run without blocking main app
- [ ] Email sending doesn't timeout (should be <5 sec per email)
- [ ] Database queries are efficient
- [ ] No memory leaks in email tracking
- [ ] Server logs are readable (not spam)

---

## Security Checklist

- [ ] Test endpoint only works in development (`NODE_ENV=development`)
- [ ] Email credentials stored in `.env.local` (not in code)
- [ ] Only registered users get emails (verified by userId)
- [ ] Rate limiting prevents spam
- [ ] No sensitive data in email templates

---

## Deployment Checklist

### Before going to production:

- [ ] All tests pass ✅
- [ ] No console errors in development
- [ ] Email template displays correctly
- [ ] SMTP credentials work
- [ ] Database is backed up
- [ ] Consider disabling test endpoint in production:
  ```typescript
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is only available in development mode" },
      { status: 403 }
    );
  }
  ```

---

## Monitoring in Production

### Set Up Alerts For:

- [ ] SMTP connection failures
- [ ] Email sending errors
- [ ] Unusual abandonment rates
- [ ] Database query timeouts
- [ ] Cron job failures

### Track These Metrics:

- [ ] Total abandoned carts per day
- [ ] Total emails sent per day
- [ ] Recovery rate (checkouts after email)
- [ ] Email delivery success rate
- [ ] Customer complaints about email frequency

---

## Documentation Status

| Doc | Status | Purpose |
|-----|--------|---------|
| `ABANDONED_CART_IMPLEMENTATION.md` | ✅ Created | Complete overview |
| `ABANDONED_CART_QUICK_TEST.md` | ✅ Created | Quick reference |
| `ABANDONED_CART_EMAIL_FIX.md` | ✅ Created | Detailed technical guide |
| `ABANDONED_CART_VISUAL_GUIDE.md` | ✅ Created | Architecture & diagrams |
| `ABANDONED_CART_IMPLEMENTATION-VERIFICATION_CHECKLIST.md` | ✅ Created | This file |

---

## Quick Reference

### Test Endpoint
```bash
POST /api/debug/test-abandoned-cart
{ "userId": "YOUR_ID" }
```

### File Locations
```
lib/cron/abandoned-cart.ts          ← Main logic
instrumentation.ts                  ← Initialization
app/api/debug/test-abandoned-cart/  ← Test endpoint
```

### Key Environment Variables
```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
NEXT_PUBLIC_APP_URL
NODE_ENV=development
```

### Key Database Fields
```javascript
cart.lastAbandonmentEmailSent  // When last email sent
cart.abandonmentEmailCount     // How many sent
user.email                     // Required for email
```

---

## Sign-Off

- [x] Code changes implemented
- [x] Documentation complete
- [x] Test endpoint created
- [x] No TypeScript errors
- [x] Ready for testing

**Status**: ✅ **READY FOR TESTING**

Next step: Follow the "Testing Checklist" above starting with Test 1 (Manual Email Test).

Good luck! 🚀
