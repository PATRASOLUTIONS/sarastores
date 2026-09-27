# Quick Test Guide - Abandoned Cart Emails

## The Problem You Had

✋ Added product to cart → Waited 20 minutes → **No email received**

## The Root Issues

1. Cron job ran **only hourly** (needed every 2 minutes)
2. Email marked as "sent" permanently (needed to send multiple times)
3. Cart needed to be abandoned for **1 hour** (you had only 20 minutes)
4. Cron didn't initialize in **dev mode**

## The Fix

✅ All of the above are now **FIXED**!

---

## How to Test Now

### 🚀 QUICKEST METHOD (Test Right Now!)

```bash
# Step 1: Get your user ID from MongoDB
# Go to MongoDB Atlas or your local MongoDB
# Find your user in 'users' collection and copy the _id

# Step 2: Make the API call
curl -X POST http://localhost:3000/api/debug/test-abandoned-cart \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_USER_ID_HERE"}'

# Step 3: Check your email inbox
# ✅ You should receive the abandoned cart email within seconds
```

### 📊 REAL TEST (Test the Cron Job)

1. Add a product to cart in your app
2. **Wait 20+ minutes** (don't checkout)
3. Check server logs for:
   ```
   [2-MIN CHECK] Running Abandoned Cart Check...
   [2-MIN] 📧 Sending email to your-email@example.com
   [2-MIN] ✅ Abandoned cart email sent
   ```
4. Check your email inbox
5. If you wait **1 hour more**, you'll get another email (follow-up)

---

## Important Environment Variables

Make sure these exist in `.env.local`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-specific-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password!

---

## What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **First Email** | 1 hour | 20 minutes |
| **Email Frequency** | Once only | Every 2 minutes (with limit) |
| **Cron Schedule** | Hourly | Every 2 minutes + hourly follow-ups |
| **Dev Mode** | ❌ Disabled | ✅ Works |
| **Repeat Emails** | ❌ No | ✅ Yes (smart limit) |

---

## Files Changed

- ✅ `lib/cron/abandoned-cart.ts` - Main fix
- ✅ `instrumentation.ts` - Dev mode support
- ✅ `app/api/debug/test-abandoned-cart/route.ts` - New test endpoint
- ✅ `ABANDONED_CART_EMAIL_FIX.md` - Full documentation

---

## Troubleshooting

### 📧 Not getting emails?

1. **Check SMTP credentials** in `.env.local`
2. **Check Gmail spam folder**
3. **Run test endpoint** to verify email config works
4. **Check server console** for `[CRON]` logs

### 🐛 Server logs show errors?

- Look for `[CRON]` or `[INSTRUMENTATION]` messages
- Check MongoDB connection
- Verify user has valid email in database

---

## Next Steps

1. Verify `.env.local` has correct SMTP credentials
2. Test with the quick method above
3. Run the real test by adding products to cart and waiting

That's it! 🎉
