# Spin Wheel Logging & Debugging Guide

## Overview
This guide helps you debug issues with the spin wheel, especially when:
- Congratulation messages don't arrive
- Emails aren't being sent
- WhatsApp notifications fail

## Where to Check Logs

### 1. **Server-Side Logs (Vercel/Node Console)**
Check your server logs in Vercel or your hosting provider's console.

#### Key Log Patterns to Look For:

**Spin Process Initiates:**
```
[SPIN_WHEEL_INIT] Participant {participantId} initiating spin process...
```

**Prize Selected:**
```
[SPIN_WHEEL_SELECTED_PRIZE] Participant {participantId} drew prize: {prizeName}
```

**Coupon Claimed:**
```
[SPIN_WHEEL_COUPON_CLAIMED] Participant {participantId} claimed coupon: {couponCode}
```

**Notification Sending Starts:**
```
[SPIN_WHEEL_NOTIFY_START] Participant {participantId} - Sending congratulation notifications...
```

**Email Details:**
```
[SPIN_WHEEL_NOTIFY_EMAIL] Email: {email}, Prize: {prize}, Coupon: {couponCode}
```

**Email Success:**
```
[SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS] Email sent to {email} for participant {participantId}. Result: {...]
```

**Email Failure (Critical Issue):**
```
[SPIN_WHEEL_NOTIFY_EMAIL_FAILED] Email failed for participant {participantId} ({email}): {error message}
```

**WhatsApp Success:**
```
[SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] WhatsApp sent to {phone} for participant {participantId}. Result: {...}
```

**WhatsApp Failure (Critical Issue):**
```
[SPIN_WHEEL_NOTIFY_WHATSAPP_FAILED] WhatsApp failed for participant {participantId} (+91{phone}): {error message}
```

**Spin Complete:**
```
[SPIN_WHEEL_SUCCESS] Successfully finished spin for participant {participantId}. Final Prize: {prize}, Coupon: {couponCode || 'N/A'}
```

---

### 2. **Browser Console Logs (Client-Side)**
Open Developer Tools (F12) → Console tab

**Inventory Cache Info:**
```
[INVENTORY_FETCH_SKIPPED] Using cached inventory (Xs old)
[INVENTORY_FETCH_START] Fetching fresh inventory...
[INVENTORY_FETCH_SUCCESS] Received {count} prizes
```

---

### 3. **Network Tab Debug**
Open Developer Tools → Network tab

**Before Fix:**
- You'll see multiple calls to `/api/spin-wheel/admin/inventory` (one on mount, one before spin)

**After Fix:**
- First visit: One call to `/api/spin-wheel/admin/inventory` (on mount)
- After spin: NO additional inventory call (uses cache) ✅
- See `[INVENTORY_FETCH_SKIPPED]` in console instead

---

## Troubleshooting Flowchart

### Issue: "Congratulation message doesn't show"

**Step 1:** Check Server Logs
```
1. Look for [SPIN_WHEEL_NOTIFY_EMAIL_FAILED] or [SPIN_WHEEL_NOTIFY_WHATSAPP_FAILED]
   → If found, the notification service failed. Check error message.
   
2. Look for [SPIN_WHEEL_NOTIFY_SKIPPED]
   → Better luck result? No notifications are sent for "BETTER LUCK NEXT TIME"
   
3. Look for [SPIN_WHEEL_SUCCESS]
   → If found but no notification logs, server crashed before sending them
```

**Step 2:** Check What Failed
- **Email Log:** `[SPIN_WHEEL_NOTIFY_EMAIL_FAILED]` + error details
  - Check email service credentials in `.env`
  - Verify recipient email is valid
  
- **WhatsApp Log:** `[SPIN_WHEEL_NOTIFY_WHATSAPP_FAILED]` + error details
  - Check AskEva API credentials in `.env`
  - Verify phone number format (should be 10 digits)
  - Check API key and URL are correct

**Step 3:** Common Issues & Solutions

| Issue | Log Pattern | Solution |
|-------|------------|----------|
| Email not sent | `[EMAIL_SEND_ERROR]` | Check SENDGRID_API_KEY, SENDGRID_FROM_EMAIL in .env |
| WhatsApp not sent | `[SPIN_WHEEL_NOTIFY_WHATSAPP_FAILED]` | Check ASKEVA_API_KEY, ASKEVA_API_URL in .env |
| Coupon failed | `[SPIN_WHEEL_COUPON_FALLBACK]` | Race condition - prize ran out. Check inventory |
| Already spun | `[SPIN_WHEEL_WARNING]` | This is expected for duplicate attempts |

---

## Enhanced Logging Details

### Email Sending Flow
```
[EMAIL_SEND_START] → Preparing email template
    ↓
[EMAIL_TEMPLATE_READY] → Template generated (shows character count)
    ↓
[EMAIL_SEND_SUCCESS] → Email sent successfully
    ↓
[SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS] → Confirmed in spin route

OR

[EMAIL_SEND_ERROR] → Email service failed (check error details)
    ↓
[SPIN_WHEEL_NOTIFY_EMAIL_FAILED] → Error propagated to spin route
```

### WhatsApp Sending Flow
```
[SPIN_WHEEL_NOTIFY_WHATSAPP] → Starting WhatsApp send
    ↓
[WhatsApp Win] → AskEva API response logged (check status)
    ↓
[SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] → Success confirmed
    ↓
Result shows: {success: true/false, data: {...}}

OR

[WhatsApp Win] Error → API failed
    ↓
[SPIN_WHEEL_NOTIFY_WHATSAPP_FAILED] → Error details shown
```

---

## Quick Debugging Checklist

Use this when someone complains spin notifications didn't work:

```
☐ Spin completed successfully? (Look for [SPIN_WHEEL_SUCCESS])
☐ Was it a win (not "Better luck")? (Check [SPIN_WHEEL_SELECTED_PRIZE])
☐ Were notifications sent? (Look for [SPIN_WHEEL_NOTIFY_EMAIL] + [SPIN_WHEEL_NOTIFY_WHATSAPP])
☐ Did email succeed? (Look for [SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS] or [EMAIL_SEND_ERROR])
☐ Did WhatsApp succeed? (Look for [SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] or [WhatsApp Win] Error)
☐ Check .env variables are set correctly (API keys, sender emails, API URLs)
☐ Check recipient email/phone in database is correct
☐ Check API quotas haven't been exceeded
```

---

## Environment Variables Required

For proper email and WhatsApp notifications:

```env
# Email Service (SendGrid)
SENDGRID_API_KEY=your_key_here
SENDGRID_FROM_EMAIL=noreply@saramobiles.com

# WhatsApp Service (AskEva)
ASKEVA_API_KEY=your_key_here
ASKEVA_API_URL=https://api.askeva.com/send
ASKEVA_SENDER_NUMBER=91XXXXXXXXXX
```

---

## Network Tab Improvement

### Before This Update
- **Inventory API calls:** 2+ per spin event
- **Visible in network:** Yes, `/api/spin-wheel/admin/inventory` shows prominently

### After This Update
- **Inventory API calls:** 1 per 5 minutes (cached)
- **Visible in network:** Only on first page load
- **Before spin:** Skipped! Uses cached data
- **Console shows:** `[INVENTORY_FETCH_SKIPPED]` when cache is used ✅

### Testing Network Improvements
1. Open Network tab (F12)
2. Load `/spin` page
3. See first inventory call (expected)
4. Click "SPIN NOW" button
5. ✅ **NO** inventory API call should appear
6. Console should show: `[INVENTORY_FETCH_SKIPPED] Using cached inventory...`

---

## Advanced: Reading Full Error Details

When you see `[SPIN_WHEEL_NOTIFY_EMAIL_FAILED]` or `[SPIN_WHEEL_NOTIFY_WHATSAPP_FAILED]`, look for the accompanying error details:

```javascript
// In server logs, you'll see structured error info:

[SPIN_WHEEL_NOTIFY_EMAIL_FAILED] Email failed for participant 507f1f77bcf86cd799439011 (user@example.com): 
Error: Invalid email service credentials
```

**Common Error Messages:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid email service credentials" | SENDGRID_API_KEY not set or invalid | Set correct API key in .env |
| "Request failed with status 401" | API authentication failed | Check API credentials |
| "Email address is invalid" | Recipient email malformed in DB | Verify email in participant record |
| "API rate limit exceeded" | Service quota used up | Wait or contact service provider |
| "Network timeout" | Service unreachable | Check API URL, internet connection |

---

## For Developers: Understanding the Log Structure

All logs follow this pattern:
```
[CATEGORY_ACTION] Message with {details}
```

**Categories:**
- `SPIN_WHEEL_*` - Spin process related
- `INVENTORY_*` - Inventory fetch related
- `EMAIL_*` - Email service related
- `WhatsApp *` - WhatsApp service related

**Actions:**
- `START` - Process beginning
- `SUCCESS` - Process completed successfully
- `FAILED` - Process encountered an error
- `ERROR` - Exception thrown

This makes it easy to grep logs:
```bash
# Find all spin events
grep "SPIN_WHEEL_" app.log

# Find all failures
grep "FAILED\|ERROR" app.log

# Find specific participant
grep "507f1f77bcf86cd799439011" app.log
```

---

## Support

If you've checked all logs and still can't find the issue:

1. **Collect logs:** Share server logs from time of spin attempt
2. **Check variables:** Verify all .env variables are set
3. **Test manually:** Try sending test email/WhatsApp via API directly
4. **Check database:** Verify participant record has correct email/phone
