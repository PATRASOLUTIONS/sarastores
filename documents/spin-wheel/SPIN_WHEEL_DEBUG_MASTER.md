# Spin Wheel Complete Debugging Master Guide

## Quick Navigation

Choose your issue:

1. **[After winning, congratulation message/email doesn't arrive](#issue-1-no-email-notification)**
2. **[After winning, WhatsApp message doesn't arrive](#issue-2-no-whatsapp-notification)**
3. **[Can't see the winning data or coupon code](#issue-3-no-data-displayed)**
4. **[Inventory API is visible in Network tab during spin](#issue-4-inventory-api-visible)**
5. **[Spin button is slow/laggy](#issue-5-spin-performance)**

---

## Issue 1: No Email Notification

**Symptom:** User won but didn't receive congratulation email

### Quick Check

1. **Check Server Logs** for this sequence:
```
[SPIN_WHEEL_SUCCESS] Successfully finished spin...
    ↓
[SPIN_WHEEL_NOTIFY_EMAIL] Email: user@example.com...
    ↓
[EMAIL_SEND_SUCCESS] Email sent successfully...
    ↓
[SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS] Email sent to user@example.com...
```

2. **If any step is missing** → follow detailed debugging below

3. **If all steps present** → Email was sent, check spam folder or configuration

### Detailed Debugging

**Step 1: Verify Email Config**
```
Check .env or Vercel Environment Variables:
✓ SMTP_HOST = your_smtp_server
✓ SMTP_PORT = 587 (or your port)
✓ SMTP_USER = your_email_username
✓ SMTP_PASS = your_email_password
✓ EMAIL_FROM = noreply@saramobiles.com (or your sender)
```

Log to check: `[EMAIL_CONFIG_CHECK]` should show all ✓ Set

**Step 2: Check Email Sending Logs**

Look for in server logs:
```
[EMAIL_SEND_ATTEMPT] Preparing to send email:
  To: user@example.com
  Subject: 🎉 Congratulations...
  HTML size: XXXX characters
```

If this appears:
- ✅ System tried to send
- But check next log...

**Step 3: Check Send Result**

Look for either:
```
✅ [EMAIL_SEND_SUCCESS] Email sent successfully to user@example.com
   [EMAIL_RESPONSE] Result: (SMTP response shown)
   [SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS] Email sent...

OR

❌ [EMAIL_SEND_ERROR] Failed to send email to user@example.com
   [EMAIL_ERROR_DETAILS] (Error reason shown)
   [SPIN_WHEEL_NOTIFY_EMAIL_FAILED] Email failed...
```

**Step 4: If Error, Check Specific Issue**

| Error | Cause | Fix |
|-------|-------|-----|
| "ECONNREFUSED" | SMTP server unreachable | Check SMTP_HOST and SMTP_PORT |
| "634 Invalid credentials" | Wrong username/password | Verify SMTP_USER and SMTP_PASS |
| "550 Recipient rejected" | Invalid email address | Check participant.email in DB |
| "Timeout" | Network issue | Check internet, try again |

### Test Email Sending

```bash
# Create test script email-test.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: process.env.EMAIL_FROM,
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Test Email</h1>'
}, (err, info) => {
  if (err) console.error('ERROR:', err);
  else console.log('SUCCESS:', info.response);
  process.exit(0);
});

# Run:
node email-test.js
```

If test fails, the SMTP configuration is wrong.

---

## Issue 2: No WhatsApp Notification

**Symptom:** User won but didn't receive WhatsApp message

### Quick Check

1. **Check Server Logs** for this sequence:
```
[WHATSAPP_WIN_VALIDATION] Starting WhatsApp win...
    ↓
[WHATSAPP_WIN_PAYLOAD] Full payload being sent...
    ↓
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK
    ↓
[WHATSAPP_WIN_RESPONSE_DATA] Response from AskEva (shows success)
    ↓
[SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] WhatsApp sent...
```

2. **If any step missing** → API call failed, follow detailed debugging

3. **If all steps present but no message received** → Template or delivery issue

### Detailed Debugging

**Step 1: Verify Phone Format**

Look for: `[WHATSAPP_WIN_VALIDATION]`

Check log shows:
```
- Phone: 8332936831 (format: 10 digits?)
```

Should be **10 digits** (91 is added by API)

**If you see:**
```
[WHATSAPP_WIN_VALIDATION_ERROR] Invalid phone format. Expected 10 digits, got: "918332936831"
```

**Problem:** Phone stored with country code
**Fix:** Remove 91 prefix - store as 10 digits only

**Step 2: Verify API Credentials**

Look for: `[WHATSAPP_WIN_VALIDATION]` → "API URL" and "Sender"

Check .env has:
```
✓ ASKEVA_API_KEY = your_actual_key (NOT empty)
✓ ASKEVA_API_URL = https://api.askeva.com/send (or correct URL)
✓ ASKEVA_SENDER_NUMBER = 91XXXXXXXXXX (with country code)
```

**If you see:**
```
[WhatsApp Win - Placeholder] To: +918332936831
```

**Problem:** Credentials not set
**Fix:** Add to .env and deploy

**Step 3: Check Template Configuration**

Look for: `[WHATSAPP_WIN_PAYLOAD]`

Should show:
```
Template Name: spin_win_confirm
Parameters:
  [0] John Doe
  [1] OnePlus 12
  [2] SPIN2026APRIL001
```

**To verify template exists:**
1. Go to WhatsApp Business Account
2. Settings → Message Templates
3. Find "spin_win_confirm"
4. Check status: ✅ **APPROVED** (not ⏳ PENDING or ❌ REJECTED)

**If template missing:**
- Create it manually in WhatsApp Business
- Wait for WhatsApp approval (usually instant)
- Retry spin

**Step 4: Check API Response**

Look for: `[WHATSAPP_WIN_RESPONSE_STATUS]`

**Good responses:**
```
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 202 Accepted
```

**Bad responses:**
```
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 401 Unauthorized
   → Problem: ASKEVA_API_KEY is wrong or missing
   → Fix: Check .env ASKEVA_API_KEY value

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 400 Bad Request
   → Problem: Payload format wrong
   → Fix: Check template name, phone format, parameters

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 429 Too Many Requests
   → Problem: API rate limit exceeded
   → Fix: Wait or upgrade AskEva plan

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 500 Internal Server Error
   → Problem: AskEva API error
   → Fix: Contact AskEva support
```

**Step 5: Check API Response Data**

Look for: `[WHATSAPP_WIN_RESPONSE_DATA]`

**Good response:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "918332936831",
      "wa_id": "918332936831"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBEUxtGNh-d8AQHEF...",
      "message_status": "accepted"
    }
  ]
}
```

Means: ✅ Message accepted by WhatsApp API

**Bad response with error:**
```json
{
  "error": {
    "message": "Template 'spin_win_confirm' not found or not approved"
  }
}
```

**Common errors:**

| Error | Fix |
|-------|-----|
| "Template not found" | Create template in WhatsApp Business |
| "Template not approved" | Wait for WhatsApp approval or resubmit |
| "Invalid parameters" | Check template has 3 parameters |
| "Invalid phone" | Use 10 digit format: 8332936831 |

**Step 6: Verify Message Actually Sent**

Even if API says success, check:
1. Is phone number WhatsApp-registered?
2. Does phone have internet connection?
3. Check WhatsApp Business Account webhook logs

### Manual WhatsApp API Test

```bash
curl -X POST https://api.askeva.com/send \
  -H "Authorization: Bearer YOUR_ASKEVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "918332936831",
    "type": "template",
    "template": {
      "name": "spin_win_confirm",
      "language": {"code": "en"},
      "components": [{
        "type": "body",
        "parameters": [
          {"type": "text", "text": "John Doe"},
          {"type": "text", "text": "OnePlus 12"},
          {"type": "text", "text": "ABC123XYZ"}
        ]
      }]
    },
    "sender": "918332936831"
  }'
```

If this fails, API issue. If succeeds but spin doesn't send, check code logs.

---

## Issue 3: No Data Displayed

**Symptom:** After winning, don't see prize/coupon in modal or response

### Quick Check

1. **Open Browser DevTools** (F12) → Network tab
2. **Click Spin Now button**
3. **Find Request:** `POST /api/spin-wheel/spin`
4. **Check Response Tab**

**Should show:**
```json
{
  "success": true,
  "prize": "OnePlus 12",
  "couponCode": "SPIN2026APRIL001",
  "message": "Congratulations! You won OnePlus 12!"
}
```

**If you see this:** ✅ Data is there, check modal display
**If you DON'T see:** ❌ Server error, check logs

### Detailed Debugging

**Step 1: Check Backend Returned Data**

Look for server logs:
```
[SPIN_WHEEL_SUCCESS] Successfully finished spin for participant...
Final Prize: OnePlus 12, Coupon: SPIN2026APRIL001
```

If missing: Spin failed before completion. Check earlier logs for error.

**Step 2: Check Frontend Received Response**

Browser Console:
```javascript
// Add to spin/page.tsx in handleSpin:
const res = await fetch("/api/spin-wheel/spin", {...})
const data = await res.json()
console.log("SPIN_RESPONSE:", {
  ok: res.ok,
  status: res.status,
  data: data
})
```

Should show:
```
SPIN_RESPONSE: {
  ok: true,
  status: 200,
  data: {success: true, prize: "...", couponCode: "..."}
}
```

If shows error or missing fields: API issue

**Step 3: Check Frontend State Updated**

Look for in code:
```typescript
setSpinResult({
  prize: data.prize,      // Should have value
  couponCode: data.couponCode,  // Should have value
  image: ...,
  icon: ...
})
setShowResultModal(true)  // Should be called
```

Browser Console check:
- After spin, is modal visible?
- Does modal contain prize name?
- Does modal contain coupon code?

If NO: Frontend display issue, check CSS/component

If YES: Everything working ✅

**Step 4: Database Verification**

```javascript
// Check participant record
db.spinWheelParticipants.findOne({
  _id: ObjectId("69d3ee8d5f324820c9273653")
})

// Should have:
{
  hasSpun: true,
  prize: "OnePlus 12",
  couponCode: "SPIN2026APRIL001"
}
```

If record missing/wrong: Backend didn't save, check earlier logs.

---

## Issue 4: Inventory API Visible

**Symptom:** Network tab shows `/api/spin-wheel/admin/inventory` call when clicking Spin

### Solution Applied

✅ **Already Fixed:** Inventory is now cached for 5 minutes

**Verification:**

1. **Open Network tab** → XHR/Fetch filter
2. **First page load:** See ONE inventory call (expected)
3. **Click Spin Now:** See NO inventory call (should be skipped)
4. **Browser Console:** Should show:
```
[INVENTORY_FETCH_SKIPPED] Using cached inventory (45s old)
```

**If still seeing extra calls:**
- Check Network tab for HTTP 304 (cached) responses
- Browser cache might be aggressive

**Force clear cache:**
- DevTools → Network → "Disable cache"
- Or: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## Issue 5: Spin Performance

**Symptom:** Spin button is slow or lag when clicked

### Diagnosis

**Check Browser Console:**
- Any JavaScript errors?
- Any performance warnings?

**Check Network Tab:**
- Is inventory fetch taking too long?
- Is spin API response slow?

**Check Server Logs:**
- Is spin taking long to process?

### Solutions

**If inventory fetch is slow:**
```
[INVENTORY_FETCH_START] Fetching fresh inventory...
(Takes more than 2 seconds?)

→ Database query slow
→ Add index to spinWheelInventory collection
→ Or reduce number of prizes in system
```

**If spin API is slow:**
```
[SPIN_WHEEL_INIT] Started...
(Takes more than 3 seconds to [SPIN_WHEEL_SUCCESS]?)

→ Prize calculation slow (too many coupons to search?)
→ Database calls slow
→ Email/WhatsApp sending delay (shouldn't block response!)
```

**Optimization:**

Currently email and WhatsApp are fire-and-forget (don't block response). This is correct ✅

If still slow, check:
1. Database indexes on spinWheelInventory
2. Number of active prizes (too many to filter?)
3. Server CPU/memory usage

---

## Complete Testing Checklist

After making any changes, test:

### Test: User Wins

```
☐ Open /spin page
☐ Fill form (name, phone, email)
☐ Send OTP and verify
☐ Accept terms
☐ Click "SPIN NOW"
☐ Wheel spins and stops on a prize
☐ Congratulation modal appears
☐ Modal shows prize name
☐ Modal shows coupon code
☐ Server logs show [SPIN_WHEEL_SUCCESS]
☐ Email received in inbox
☐ WhatsApp message received on phone
```

### Test: Better Luck

```
☐ Complete spin until better luck
☐ Modal shows "Better Luck Next Time"
☐ No coupon code shown (correct)
☐ Server logs show no notification attempts (correct)
```

### Test: Already Spun

```
☐ Try to spin again with same phone
☐ See "Already Spun" modal
☐ Shows original prize and coupon from first spin
☐ Server logs show [SPIN_WHEEL_WARNING]
```

### Test: Network

```
☐ Open Network tab
☐ Load /spin page
☐ See one /api/spin-wheel/admin/inventory call
☐ Click "SPIN NOW"
☐ See NO inventory call (use cache)
☐ Browser console shows [INVENTORY_FETCH_SKIPPED]
```

---

## Emergency Debug Command

If everything is broken, run this MongoDB query to check system state:

```javascript
// Check inventory is set up
db.spinWheelInventory.find().pretty()

// Check participants
db.spinWheelParticipants.countDocuments({otpVerified: true})

// Check coupons
db.spinWheelCouponCodes.countDocuments({isUsed: false})

// Check recent spins
db.spinWheelParticipants.find({hasSpun: true}).limit(5).pretty()

// Check recent emails sent
db.spinWheelCoupons.find({status: "issued"}).sort({createdAt: -1}).limit(5).pretty()
```

---

## Environment Variables Checklist

Before deploying to production:

```bash
# Email
SMTP_HOST = ✓ Set
SMTP_PORT = ✓ Set
SMTP_USER = ✓ Set
SMTP_PASS = ✓ Set
EMAIL_FROM = ✓ Set

# WhatsApp
ASKEVA_API_KEY = ✓ Set
ASKEVA_API_URL = ✓ Set
ASKEVA_SENDER_NUMBER = ✓ Set

# Database
MONGODB_URI = ✓ Set
```

---

## Support

For additional help, provide:

1. **Full server logs** between [SPIN_WHEEL_INIT] and [SPIN_WHEEL_SUCCESS]
2. **Browser Network response** JSON
3. **Participant phone number** that failed
4. **Screenshot** of WhatsApp Business Message Templates
5. **.env variables** (mask sensitive values)

---

## Documentation Files Reference

- [SPIN_WHEEL_LOGGING_GUIDE.md](SPIN_WHEEL_LOGGING_GUIDE.md) - General logging patterns
- [WHATSAPP_WIN_DEBUGGING.md](WHATSAPP_WIN_DEBUGGING.md) - Complete WhatsApp debugging
- [SPIN_RESPONSE_DATA_DEBUG.md](SPIN_RESPONSE_DATA_DEBUG.md) - Data and response debugging
