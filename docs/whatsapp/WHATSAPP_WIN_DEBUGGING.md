# WhatsApp Win Notification Debugging Guide

## Issue: WhatsApp Says "Success" But User Doesn't Receive Message

This is a common issue where the API returns `success: true` but the WhatsApp message never arrives. Here's how to debug it:

---

## Log Structure

When someone wins and should get a WhatsApp message, you'll see these logs:

```
[WHATSAPP_WIN_VALIDATION] Starting WhatsApp win notification:
  - Phone: 8332936831 (format: 10 digits?)
  - Name: John Doe
  - Prize: OnePlus 12
  - Coupon: ABC123XYZ
  - Sender: 918332936831
  - API URL: https://api.askeva.com/send

[WHATSAPP_WIN_PAYLOAD] Full payload being sent to AskEva:
  To: 918332936831
  Template Name: spin_win_confirm
  Parameters:
    [0] John Doe
    [1] OnePlus 12
    [2] ABC123XYZ
  Sender: 918332936831

[WHATSAPP_WIN_REQUEST] Sending request to AskEva API...
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK
[WHATSAPP_WIN_RESPONSE_DATA] Response from AskEva: {
  messaging_product: 'whatsapp',
  contacts: [ { input: '918332936831', wa_id: '918332936831' } ],
  messages: [ { id: 'wamid.xxx', message_status: 'accepted' } ]
}
```

---

## Troubleshooting Checklist

### ✅ Check 1: Is the Phone Number Valid?

**Log to check:** `[WHATSAPP_WIN_VALIDATION]`

**Valid format:**
- 10 digits: `8332936831`
- NOT: `+918332936831` (too long with country code)
- NOT: `918332936831` (11 digits - the API adds 91)
- NOT: `83329` (too short)

**If you see:**
```
[WHATSAPP_WIN_VALIDATION_ERROR] Invalid phone format. Expected 10 digits, got: "918332936831"
```

**Fix:**  
Store phone numbers in the database as **10 digits only**. The API will add the country code `91`.

---

### ✅ Check 2: Is the Template Name Correct?

**Log to check:** `[WHATSAPP_WIN_PAYLOAD]`

**Current template name:** `spin_win_confirm`

**Questions to verify:**
1. ❓ Does WhatsApp Business Account have a template named `spin_win_confirm`?
2. ❓ Is it **APPROVED** by WhatsApp? (Not pending, rejected, or disabled)
3. ❓ Does the template have **3 parameters** (name, prize, coupon)?

**How to check:**
1. Go to your WhatsApp Business Account settings
2. Click "Message Templates"
3. Find `spin_win_confirm`
4. Verify status: Should be ✅ **APPROVED** (not ⏳ PENDING or ❌ REJECTED)

**If template is missing:**
```bash
# You'll see this error in logs:
[WHATSAPP_WIN_RESPONSE_DATA] Response from AskEva: {
  "error": {
    "message": "Template 'spin_win_confirm' not found or not approved"
  }
}
```

**Fix:**
1. Create the template in WhatsApp Business Account
2. Wait for WhatsApp to approve it
3. Alternatively, use a different template name if one exists

---

### ✅ Check 3: Are the Parameters in Correct Order?

**Log to check:** `[WHATSAPP_WIN_PAYLOAD]` → Parameters section

**Current template expects (in order):**
```
[0] Name: "John Doe"
[1] Prize: "OnePlus 12"
[2] Coupon: "ABC123XYZ"
```

**Template message should look like:**
```
Hi {{1}},

Congratulations! 🎉 You won {{2}}.

Your coupon code: {{3}}
```

**How to verify:**
1. Open WhatsApp Business Account → Message Templates
2. Find `spin_win_confirm` template
3. Count the {{1}}, {{2}}, {{3}} placeholders
4. Verify order matches what we're sending

**If order is wrong:**
Update the template creation or change the order in code.

---

### ✅ Check 4: Check API Credentials

**Environment variables required:**

```env
# REQUIRED - Check these are set in .env
ASKEVA_API_KEY=your_actual_key_here
ASKEVA_API_URL=https://api.askeva.com/send
ASKEVA_SENDER_NUMBER=91XXXXXXXXXX
```

**Log to check:** `[WHATSAPP_WIN_VALIDATION]` → "API URL" and "Sender"

**Verify:**
- ✅ ASKEVA_API_KEY is NOT empty
- ✅ ASKEVA_API_URL is correct
- ✅ ASKEVA_SENDER_NUMBER format is: `91` + 10 digit number

**If credentials are missing:**
```
[WhatsApp Win - Placeholder] To: +918332936831
[WhatsApp Win - Placeholder] Prize: OnePlus 12, Coupon: ABC123XYZ
```

This means the credentials aren't set and the system falls back to placeholder mode.

---

### ✅ Check 5: API Response Status Code

**Log to check:** `[WHATSAPP_WIN_RESPONSE_STATUS]`

**Good responses:**
```
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 201 Created
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 202 Accepted
```

**Bad responses:**
```
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 401 Unauthorized
  → Check ASKEVA_API_KEY

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 400 Bad Request
  → Check payload format, phone number, template name

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 429 Too Many Requests
  → API rate limit exceeded. Wait or increase plan

[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 500 Internal Server Error
  → AskEva API error. Contact support.
```

---

### ✅ Check 6: API Response Content

**Log to check:** `[WHATSAPP_WIN_RESPONSE_DATA]`

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

This means:
- ✅ Message accepted by WhatsApp API
- ✅ Message queued for delivery
- ✅ Has message ID for tracking

**Common error responses:**

| Response | Issue | Fix |
|----------|-------|-----|
| `"error": "Template not found"` | Template doesn't exist or isn't approved | Check WhatsApp Business Account → Message Templates |
| `"error": "Invalid phone format"` | Phone number format wrong | Use 10 digits: `8332936831` |
| `"error": "Invalid parameters"` | Wrong number of parameters | Template needs 3 params (name, prize, coupon) |
| `"error": "Sender not authorized"` | Sender number not set up | Check ASKEVA_SENDER_NUMBER in .env |

---

## Complete Debugging Flow

When user reports "I won but didn't get WhatsApp":

### Step 1: Verify Spin Succeeded
```
Look for: [SPIN_WHEEL_SUCCESS]
```

### Step 2: Verify It's Not "Better Luck"
```
Look for: [SPIN_WHEEL_SELECTED_PRIZE]
Should NOT say: "BETTER LUCK NEXT TIME"
```

### Step 3: Verify Participant Data
```
Look for: [SPIN_WHEEL_PARTICIPANT_DATA]
Check that phone and email are correct
```

### Step 4: Verify WhatsApp Attempt Started
```
Look for: [SPIN_WHEEL_NOTIFY_WHATSAPP]
Shows: Phone: {phone}, Prize: {prize}, Coupon: {code}
```

### Step 5: Check Validation
```
Look for: [WHATSAPP_WIN_VALIDATION]
Check phone format (should be 10 digits)
Check if API credentials are set
```

### Step 6: Check Payload
```
Look for: [WHATSAPP_WIN_PAYLOAD]
Verify To: 91{phone}
Verify Template: spin_win_confirm
Verify Parameters: [name, prize, coupon]
```

### Step 7: Check API Response
```
Look for: [WHATSAPP_WIN_RESPONSE_STATUS]
Should be 200/201/202
Look for: [WHATSAPP_WIN_RESPONSE_DATA]
Check if "messaging_product": "whatsapp"
Check if message has "id" and "message_status": "accepted"
```

### Step 8: Verify Success Logged
```
Look for: [SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS]
Check [SPIN_WHEEL_WHATSAPP_RESULT]
```

---

## Solution Decision Tree

```
Did you see [WHATSAPP_WIN_VALIDATION_ERROR]?
├─ YES → Fix phone format (10 digits only)
└─ NO → Continue

Did you see [WHATSAPP_WIN_RESPONSE_STATUS] 401?
├─ YES → Check ASKEVA_API_KEY in .env
└─ NO → Continue

Did you see [WHATSAPP_WIN_RESPONSE_STATUS] 400?
├─ YES → Check template name and parameters
└─ NO → Continue

Did you see [WHATSAPP_WIN_RESPONSE_DATA] with error?
├─ YES → 
│   ├─ "Template not found" → Create/approve template
│   ├─ "Invalid parameters" → Check parameter count
│   └─ "Invalid phone" → Check phone format
└─ NO → Continue

Did you see success response but still no message?
├─ YES → 
│   ├─ Check if phone number is WhatsApp-registered
│   ├─ Check if message reached spam folder
│   ├─ Verify recipient has internet/data
│   └─ Check WhatsApp Business Account settings
└─ NO → Message succeeded!
```

---

## Database Check

**Query to verify participant data:**

```javascript
// MongoDB query to check participant
db.spinWheelParticipants.findOne({
  _id: ObjectId("69d3ee8d5f324820c9273653")
})

// Should show:
{
  name: "User Name",
  phone: "8332936831",        // 10 digits
  email: "user@example.com",
  senderNumber: "918332936831", // 91 + 10 digits
  hasSpun: true,
  prize: "Prize Name",
  couponCode: "CODE123",
  ...
}
```

---

## Environment Variables Checklist

Before deploying, verify:

```bash
# 1. Check .env file has these
echo $ASKEVA_API_KEY        # Should NOT be empty
echo $ASKEVA_API_URL        # Should be: https://api.askeva.com/send
echo $ASKEVA_SENDER_NUMBER  # Should be: 91XXXXXXXXXX

# 2. In Vercel/Production environment:
# Go to Settings → Environment Variables
# Verify same three variables are set
```

---

## Testing WhatsApp Without Spin

To manually test WhatsApp API:

```bash
curl -X POST https://api.askeva.com/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "918332936831",
    "type": "template",
    "template": {
      "name": "spin_win_confirm",
      "language": {
        "code": "en"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {"type": "text", "text": "John Doe"},
            {"type": "text", "text": "OnePlus 12"},
            {"type": "text", "text": "ABC123XYZ"}
          ]
        }
      ]
    },
    "sender": "918332936831"
  }'
```

If this fails, the problem is:
1. API credentials
2. Template
3. Phone format
4. Sender number

If this succeeds but spin doesn't send, check the logs for where it's failing.

---

## Contact Support

When contacting AskEva support, provide:

1. **Full logs** from the spin event
2. **Exact phone number** that failed
3. **Participant ID** (from logs)
4. **Screenshot of WhatsApp Business Account** settings
5. **Verify template** exists and is approved

Include these specific logs:
- `[WHATSAPP_WIN_VALIDATION]`
- `[WHATSAPP_WIN_PAYLOAD]`
- `[WHATSAPP_WIN_RESPONSE_STATUS]` + `[WHATSAPP_WIN_RESPONSE_DATA]`
