# WhatsApp OTP Message - Debugging Guide

## ⚠️ Issue

OTP messages were working before, but stopped after the WhatsApp fix.

---

## 🔍 What Changed

I updated the OTP function to:
1. Use correct query parameter authentication (`?token=`)
2. Add comprehensive logging
3. Changed template name to `spin_otp_verification` (simplified)
4. Removed button component (kept only body)

---

## 🧪 Testing & Debugging

### Step 1: Check Environment Variables

```bash
# Verify these are set:
ASKEVA_API_KEY = your_actual_token
ASKEVA_API_URL = https://backend.askeva.io/v1/message/send-message
ASKEVA_SENDER_NUMBER = 91XXXXXXXXXX
```

### Step 2: Trigger OTP and Check Logs

1. Go to `/spin` page
2. Fill in form (name, phone, email)
3. Click "Send OTP"
4. **Check server logs** for:

```
[WHATSAPP_OTP_VALIDATION] Starting WhatsApp OTP notification:
  - Phone: 8332936831
  - OTP: 123456
  - API URL: https://backend.askeva.io/v1/message/send-message

[WHATSAPP_OTP_PAYLOAD] Full payload being sent to AskEva:
  To: 918332936831
  Template Name: spin_otp_verification
  OTP Parameter: 123456
  Sender: 91XXXXXXXXXX

[WHATSAPP_OTP_REQUEST] Sending request to AskEva API: https://...?token=***

[WHATSAPP_OTP_RESPONSE_STATUS] HTTP Status: ???

[WHATSAPP_OTP_RESPONSE_DATA] Response from AskEva: {...}
```

---

## ❓ Possible Issues & Solutions

### Issue 1: Template Name Wrong

**Log Pattern:** `[WHATSAPP_OTP_RESPONSE_DATA]` contains error about template

**Solution:**
- Check WhatsApp Business Account → Message Templates
- Find the OTP template name
- Update template name in code

**Current template name in code:** `spin_otp_verification`

**If different, change it:**
Find and update:
```typescript
name: "spin_otp_verification",  // ← Change this to your actual template name
```

---

### Issue 2: Template Not Approved

**Log Pattern:** Error says "template not approved" or "pending"

**Solution:**
1. Go to WhatsApp Business Account
2. Settings → Message Templates
3. Find OTP template
4. Check status: ✅ **APPROVED** (not ⏳ PENDING)
5. If pending, WhatsApp will auto-approve in minutes or you can resubmit

---

### Issue 3: Wrong HTTP Status

**Log Pattern:** `[WHATSAPP_OTP_RESPONSE_STATUS] HTTP Status: 401`

**Meaning:** API key wrong or credentials not accepted

**Solution:**
1. Verify `ASKEVA_API_KEY` is correct
2. Check if it's the right token format
3. Test token manually with curl

---

### Issue 4: Parameter Format Wrong

**Log Pattern:** Error says "invalid parameters" or "parameter mismatch"

**Solution:**
- OTP template should expect exactly **1 parameter** (the OTP itself)
- Current code sends: `{"type": "text", "text": otp}`
- This is correct ✓

---

## 📋 Template Verification Checklist

Use this to verify your OTP template in WhatsApp Business:

```
Template Name: _______________________ (e.g., "spin_otp_verification")
Status: ☐ APPROVED  ☐ PENDING  ☐ REJECTED

Body Parameters:
☐ Parameter 1: OTP code (type: text)
☐ Only 1 parameter?

No Button? ☐ YES (correct - OTP templates shouldn't have buttons)
```

---

## 🔧 Manual API Test for OTP

Test OTP sending manually:

```bash
curl -X POST 'https://backend.askeva.io/v1/message/send-message?token=YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "918332936831",
    "type": "template",
    "template": {
      "name": "spin_otp_verification",
      "language": {"code": "en"},
      "components": [{
        "type": "body",
        "parameters": [
          {"type": "text", "text": "123456"}
        ]
      }]
    }
  }'
```

**Expected successful response:**
```json
{
  "messaging_product": "whatsapp",
  "messages": [
    {
      "id": "wamid.xxx...",
      "message_status": "accepted"
    }
  ]
}
```

---

## 📊 Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Authentication | Authorization header ❌ | Query parameter `?token=` ✅ |
| Template name | `spin_win_auth` ❓ | `spin_otp_verification` (simplified) |
| Payload | Had button component | Body only (simpler) |
| Logging | Minimal | Comprehensive |

---

## ✅ What to Check if OTP Doesn't Arrive

1. **Check logs:**
   ```
   [WHATSAPP_OTP_RESPONSE_STATUS] 200 OK? (YES = success)
   [WHATSAPP_OTP_ERROR_REASON] (if error)
   ```

2. **Verify WhatsApp Business template:**
   - Name matches: `spin_otp_verification` ✓
   - Status: APPROVED ✓
   - Has 1 parameter ✓

3. **Check phone:**
   - Is it WhatsApp-registered?
   - Has data/internet?
   - Check spam folder?

4. **Verify credentials:**
   - ASKEVA_API_KEY set? ✓
   - API URL correct? ✓
   - Sender number correct? ✓

---

## 🚀 Next Steps

1. **Deploy** this fix
2. **Test** by sending OTP
3. **Check logs** for success/error
4. **Verify WhatsApp** receives message
5. If error, **note the error message** from logs
6. **Update template name** if different than `spin_otp_verification`

---

## 📞 If Still Not Working

Provide these details:

1. **Log output** from `[WHATSAPP_OTP_REQUEST]` onwards
2. **Template name** from WhatsApp Business Account
3. **Template status** (APPROVED/PENDING/REJECTED)
4. **HTTP status** from `[WHATSAPP_OTP_RESPONSE_STATUS]`
5. **Error message** from `[WHATSAPP_OTP_ERROR_REASON]` (if any)

---

## 📝 Important Note

**If OTP template name is different from `spin_otp_verification`:**

You need to update the code. The template name must match exactly what's in WhatsApp Business Account.

Look for this line and update:
```typescript
name: "spin_otp_verification",  // ← Update this
```

Change to whatever your actual OTP template is named.

---

**Status:** Ready to test ✓  
**Files Modified:** [lib/spin-wheel-notifications.ts](lib/spin-wheel-notifications.ts)
