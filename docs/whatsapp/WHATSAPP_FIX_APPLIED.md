# WhatsApp Win Message - Quick Fix Applied

## ✅ What Was Fixed

The AskEva API was using the wrong authentication method. 

### ❌ **Before (Wrong)**
```typescript
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`  // ❌ Wrong!
  },
  body: JSON.stringify(payload)
})
```

### ✅ **After (Correct)**
```typescript
const urlWithToken = `${apiUrl}?token=${apiKey}`  // ✅ Token in query param

const response = await fetch(urlWithToken, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"  // ✅ No Authorization header
  },
  body: JSON.stringify(payload)
})
```

---

## 🔧 Key Changes Made

### 2 Functions Updated:

1. **`sendWhatsAppOTP()`** - For OTP verification messages
   - Changed from Bearer token to query parameter
   - Removed Authorization header

2. **`sendWhatsAppWinNotification()`** - For winning messages (THE MAIN FIX)
   - Changed from Bearer token to query parameter
   - Removed Authorization header
   - Kept all validation and logging intact

---

## 📋 Environment Variables to Check

Verify these are set in your `.env` or Vercel environment:

```bash
# Correct AskEva configuration
ASKEVA_API_KEY=your_actual_token_here
ASKEVA_API_URL=https://backend.askeva.io/v1/message/send-message
ASKEVA_SENDER_NUMBER=91XXXXXXXXXX
```

**Critical:** The URL should be `https://backend.askeva.io/v1/message/send-message` (without `?token=` - that gets added automatically)

---

## 🧪 Testing the Fix

### Test Steps:

1. **Go to `/spin` page**
2. **Complete a spin** that results in a WINNING (not "Better Luck")
3. **Check server logs** for:

```
[WHATSAPP_WIN_VALIDATION] Starting WhatsApp win notification:
  - Phone: 8332936831
  ...
  - API URL: https://backend.askeva.io/v1/message/send-message

[WHATSAPP_WIN_PAYLOAD] Full payload being sent to AskEva:
  To: 918332936831
  Template Name: spin_win_confirm
  Parameters:
    [0] User Name
    [1] Prize Name
    [2] COUPON_CODE

[WHATSAPP_WIN_REQUEST] Sending request to AskEva API: https://backend.askeva.io/v1/message/send-message?token=***

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK

[WHATSAPP_WIN_RESPONSE_DATA] Response from AskEva: {
  "messaging_product": "whatsapp",
  "contacts": [...],
  "messages": [...]
}

[WHATSAPP_WIN_SUCCESS_DETAILED] Message object:
  Message [0]: {
    "id": "wamid.xxx...",
    "message_status": "accepted"
  }

[SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] WhatsApp sent to 8332936831...
```

4. **Check WhatsApp** on the phone
   - Message should arrive within 30 seconds
   - Should show prize name and coupon code

---

## 🔍 Log Patterns to Look For

### ✅ Success Logs:
```
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK
[WHATSAPP_WIN_SUCCESS_DETAILED] Message object:
[SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] WhatsApp sent to...
```

### ❌ Error Logs (if still not working):
```
[WHATSAPP_WIN_VALIDATION_ERROR] Invalid phone format
[WHATSAPP_WIN_API_ERROR] Request failed
[WHATSAPP_WIN_ERROR_REASON] Error details: ...
```

---

## 📊 API Comparison

| Aspect | Before (Wrong) | After (Fixed) |
|--------|---|---|
| Authentication | Authorization: Bearer header | Query param: ?token= |
| URL format | `{apiUrl}` only | `{apiUrl}?token={key}` |
| Headers | Has Authorization | Content-Type only |
| Status code expected | 200 | 200 OK |
| Success response | `messaging_product: whatsapp` | `messaging_product: whatsapp` |

---

## 🎯 Why This Fixes The Issue

AskEva uses endpoint authentication via query parameter instead of Bearer token header. The old code was sending the token in the wrong place, so AskEva API was rejecting the request (401 Unauthorized error would have appeared, but wasn't being logged).

With this fix:
- ✅ Token is correctly passed in URL: `?token=your_key`
- ✅ API authenticates successfully
- ✅ Message payload is accepted
- ✅ WhatsApp messages are delivered

---

## 🚀 Next Steps

1. **Deploy** this fix to production
2. **Test** with a test spin (should receive WhatsApp message)
3. **Verify** logs show `[WHATSAPP_WIN_SUCCESS_DETAILED]`
4. **Done!** WhatsApp messages should now arrive

---

## 💡 If Still Not Working

Check these in order:

1. **Verify Environment Variables:**
   ```bash
   echo $ASKEVA_API_KEY      # Should NOT be empty
   echo $ASKEVA_API_URL      # Should be: https://backend.askeva.io/v1/message/send-message
   ```

2. **Check Logs for:**
   ```
   [WHATSAPP_WIN_RESPONSE_STATUS] - what HTTP status?
   [WHATSAPP_WIN_RESPONSE_DATA] - what's the response?
   ```

3. **Common Issues:**
   - ❌ Phone number format: Should be 10 digits (e.g., 8332936831)
   - ❌ Template not approved: Verify "spin_win_confirm" exists in WhatsApp Business
   - ❌ API key wrong: Check if using old key vs new key

4. **Manual Test (Optional):**
   ```bash
   curl -X POST 'https://backend.askeva.io/v1/message/send-message?token=YOUR_TOKEN' \
     -H 'Content-Type: application/json' \
     -d '{
       "to": "918332936831",
       "type": "template",
       "template": {
         "name": "spin_win_confirm",
         "language": {"code": "en"},
         "components": [{
           "type": "body",
           "parameters": [
             {"type": "text", "text": "Test User"},
             {"type": "text", "text": "Test Prize"},
             {"type": "text", "text": "TEST123"}
           ]
         }]
       }
     }'
   ```

---

**Files Modified:**
- ✅ [lib/spin-wheel-notifications.ts](lib/spin-wheel-notifications.ts) - Fixed both WhatsApp functions

**Status:** Ready for deployment ✓
