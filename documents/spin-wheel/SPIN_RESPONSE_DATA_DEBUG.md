# Complete Spin Wheel Response Data Debugging

## Issue: "Can't See The Data" After Winning

When someone wins, they should see:
1. ✅ Congratulation modal on screen
2. ✅ Prize details displayed
3. ✅ Coupon code shown
4. ✅ Email notification sent
5. ✅ WhatsApp notification sent

If you can't see the data, follow this guide.

---

## Data Flow Diagram

```
User clicks "SPIN NOW"
    ↓
Frontend sends POST to /api/spin-wheel/spin
    ↓
Backend processes spin → selects prize → sends notifications
    ↓
Backend returns JSON response with:
{
  success: true,
  prize: "Prize Name",
  couponCode: "CODE123",
  message: "Congratulations! You won Prize Name!"
}
    ↓
Frontend receives and displays in modal
    ↓
User sees modal with prize + coupon
```

---

## Browser Console Debugging

### Step 1: Open Developer Tools
- **Windows/Linux:** F12
- **Mac:** Cmd + Option + I

### Step 2: Go to Network Tab
- Click "Network" tab
- Look for requests starting with `/api/spin-wheel/spin`

### Step 3: Click on the Request
- Filter by: XHR/Fetch
- Find: `POST /api/spin-wheel/spin`
- Click it to see details

### Step 4: Check Response Tab

**GOOD Response (User Won):**
```json
{
  "success": true,
  "prize": "OnePlus 12",
  "couponCode": "SPIN2026APRIL001",
  "message": "Congratulations! You won OnePlus 12!"
}
```

**GOOD Response (Better Luck):**
```json
{
  "success": true,
  "prize": "BETTER LUCK NEXT TIME",
  "couponCode": null,
  "message": "Better luck next time! Thank you for participating."
}
```

**BAD Response (Already Spun):**
```json
{
  "error": "already_spun",
  "message": "You have already spun the wheel.",
  "prize": "Prize Name",
  "couponCode": "CODE123"
}
```

**BAD Response (Error):**
```json
{
  "error": "Internal server error"
}
```

### Step 5: Check Console Logs
- Click "Console" tab
- Look for client-side logs from the spin page

---

## Server-Side Log Sequence for Winning Spin

When a user wins and should see congratulation message, you should see these logs in order:

### ✅ Stage 1: Spin Process Started
```
[SPIN_WHEEL_INIT] Participant 69d3ee8d5f324820c9273653 initiating spin process...
```

### ✅ Stage 2: Prize Selected
```
[SPIN_WHEEL_SELECTED_PRIZE] Participant 69d3ee8d5f324820c9273653 drew prize: OnePlus 12
```

### ✅ Stage 3: Coupon Claimed (if win)
```
[SPIN_WHEEL_COUPON_CLAIMED] Participant 69d3ee8d5f324820c9273653 claimed coupon: SPIN2026APRIL001
```

### ✅ Stage 4: Inventory Updated
```
[no specific log - happens silently]
```

### ✅ Stage 5: Participant Record Updated
```
[no specific log - happens silently]
```

### ✅ Stage 6: Coupon Record Stored
```
[no specific log - happens silently]
```

### ✅ Stage 7: Notifications Start Sending
```
[SPIN_WHEEL_NOTIFY_START] Participant 69d3ee8d5f324820c9273653 - Sending congratulation notifications...
[SPIN_WHEEL_PARTICIPANT_DATA] Name: John Doe, Email: john@example.com, Phone: 8332936831, Sender: 918332936831
[SPIN_WHEEL_NOTIFY_EMAIL] Email: john@example.com, Prize: OnePlus 12, Coupon: SPIN2026APRIL001
```

### ✅ Stage 8: Email Sending
```
[EMAIL_SEND_ATTEMPT] Preparing to send email:
  To: john@example.com
  Subject: 🎉 Congratulations John! You won OnePlus 12 - Spin the Wheel Campaign
  HTML size: 3845 characters
  Attachments: 0
  From: noreply@saramobiles.com

[EMAIL_SENDING] Sending via SMTP to john@example.com...
[EMAIL_SEND_SUCCESS] Email sent successfully to john@example.com
[EMAIL_RESPONSE] Result: {... SMTP response ...}
[SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS] Email sent to john@example.com for participant 69d3ee8d5f324820c9273653
[SPIN_WHEEL_EMAIL_RESULT] {
  "success": true,
  "result": "250 Message accepted"
}
```

### ✅ Stage 9: WhatsApp Sending
```
[SPIN_WHEEL_NOTIFY_WHATSAPP] Sending to Phone: 8332936831, Prize: OnePlus 12, Coupon: SPIN2026APRIL001
[SPIN_WHEEL_WHATSAPP_PARAMS] Name: "John Doe", Prize: "OnePlus 12", Coupon: "SPIN2026APRIL001"

[WHATSAPP_WIN_VALIDATION] Starting WhatsApp win notification:
  - Phone: 8332936831 (format: 10 digits?)
  - Name: John Doe
  - Prize: OnePlus 12
  - Coupon: SPIN2026APRIL001
  - Sender: 918332936831
  - API URL: https://api.askeva.com/send

[WHATSAPP_WIN_PAYLOAD] Full payload being sent to AskEva:
  To: 918332936831
  Template Name: spin_win_confirm
  Parameters:
    [0] John Doe
    [1] OnePlus 12
    [2] SPIN2026APRIL001
  Sender: 918332936831

[WHATSAPP_WIN_REQUEST] Sending request to AskEva API...
[WHATSAPP_WIN_RESPONSE_STATUS] HTTP Status: 200 OK
[WHATSAPP_WIN_RESPONSE_DATA] Response from AskEva: {
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

[SPIN_WHEEL_NOTIFY_WHATSAPP_SUCCESS] WhatsApp sent to 8332936831 for participant 69d3ee8d5f324820c9273653
[SPIN_WHEEL_WHATSAPP_RESULT] {
  "success": true,
  "data": {
    "messaging_product": "whatsapp",
    "contacts": [...],
    "messages": [...]
  }
}
```

### ✅ Stage 10: Spin Complete
```
[SPIN_WHEEL_SUCCESS] Successfully finished spin for participant 69d3ee8d5f324820c9273653. 
Final Prize: OnePlus 12, Coupon: SPIN2026APRIL001
```

---

## What Each Log Tells You

| Log | What It Means | Action If Missing |
|-----|--------------|------------------|
| `[SPIN_WHEEL_INIT]` | Backend started processing | Check API endpoint is being called |
| `[SPIN_WHEEL_SELECTED_PRIZE]` | Prize was randomly selected | Check inventory has active prizes |
| `[SPIN_WHEEL_COUPON_CLAIMED]` | Prize wasn't "Better Luck" | Check if prize had unused coupons |
| `[SPIN_WHEEL_NOTIFY_START]` | About to send notifications | Check spin completed successfully |
| `[EMAIL_SEND_SUCCESS]` | Email was sent | Check SMTP config in .env |
| `[WHATSAPP_WIN_RESPONSE_STATUS]` | WhatsApp API responded | Check API credentials |
| `[SPIN_WHEEL_SUCCESS]` | Spin fully complete | Check previous logs for errors |

---

## Troubleshooting: "Congratulation Not Showing"

### 1. Check if Response Reached Frontend

**In Browser Network tab:**
- Find `POST /api/spin-wheel/spin` request
- Click "Response" tab
- Should show JSON with `success: true`

**If you DON'T see this:**
```
❌ Spin API call failed at network level
   → Check internet connection
   → Check API endpoint URL is correct
   → Check request body has participantId
```

**If you SEE 500 error:**
```
❌ Server error occurred
   → Check [SPIN_WHEEL_INIT] in logs
   → Look for exception messages
```

### 2. Check if Frontend Received Data

**In Browser Console:**
```javascript
// Add this to spin/page.tsx to debug response
const res = await fetch("/api/spin-wheel/spin", {...})
const data = await res.json()
console.log("SPIN_RESPONSE:", data)
console.log("SUCCESS:", data.success)
console.log("PRIZE:", data.prize)
console.log("COUPON:", data.couponCode)
```

**If console shows:**
```
SPIN_RESPONSE: {success: true, prize: "OnePlus 12", ...}
SUCCESS: true
PRIZE: OnePlus 12
COUPON: SPIN2026APRIL001
```

Then data reached frontend ✅

**If console shows:**
```
SPIN_RESPONSE: {error: "Internal server error"}
SUCCESS: false
PRIZE: undefined
COUPON: undefined
```

Then server had error ❌

### 3. Check if Modal Displays

**In Browser:**
- After spin completes, do you see congratulation modal?
- Can you see prize name?
- Can you see coupon code?

**If YES:** Everything is working ✅

**If NO:** Frontend component issue
- Check [app/spin/page.tsx](app/spin/page.tsx) showResultModal section
- Verify state is being updated: `setShowResultModal(true)`
- Check CSS isn't hiding the modal

---

## Complete Data Flow Check

### Can't See Data After Winning

**Question 1:** Was there a modal that appeared?
- **YES** → Go to Question 2
- **NO** → Go to Question 3

**Question 2:** Did the modal show prize name and coupon?
- **YES** → Everything working! Notifications may not be received (see WhatsApp guide)
- **NO** → Frontend display issue. Check modal rendering code

**Question 3:** Did spin animation play?
- **YES** → Backend returned success
  - Check Browser Network tab
  - Check Response content
- **NO** → API call failed
  - Check server logs for [SPIN_WHEEL_INIT]
  - Check 500 error response

---

## Database Check: Verify Data Saved

**Query to check if spin was recorded:**

```javascript
// Check if participant has spin record
db.spinWheelParticipants.findOne({
  _id: ObjectId("69d3ee8d5f324820c9273653")
})

// Should show:
{
  _id: ObjectId("69d3ee8d5f324820c9273653"),
  name: "John Doe",
  email: "john@example.com",
  phone: "8332936831",
  otpVerified: true,
  hasSpun: true,        // ✅ MUST BE TRUE
  prize: "OnePlus 12",  // ✅ MUST HAVE VALUE
  couponCode: "SPIN2026APRIL001", // ✅ MUST HAVE VALUE
  spinDate: ISODate("2026-04-06T..."),
  ...
}

// Query to check coupon was issued
db.spinWheelCoupons.findOne({
  couponCode: "SPIN2026APRIL001"
})

// Should show:
{
  couponCode: "SPIN2026APRIL001",
  prize: "OnePlus 12",
  participantId: ObjectId("69d3ee8d5f324820c9273653"),
  participantName: "John Doe",
  participantEmail: "john@example.com",
  participantPhone: "8332936831",
  status: "issued",
  createdAt: ISODate("2026-04-06T..."),
  ...
}
```

If these records exist, the backend saved everything correctly ✅

---

## Checklist for "Can't See Data"

```
☐ User completed spin successfully
☐ Spin animation finished (not stuck)
☐ Browser Network tab shows /api/spin-wheel/spin request
☐ Response status is 200 OK (not 500)
☐ Response JSON has: success: true
☐ Response has prize field filled
☐ Response has couponCode field filled
☐ Modal appears on screen
☐ Modal shows prize name
☐ Modal shows coupon code
☐ Database has participant record with hasSpun: true
☐ Database has winner coupon record
☐ Server logs show [SPIN_WHEEL_SUCCESS]
☐ Email logs show [EMAIL_SEND_SUCCESS]
☐ WhatsApp logs show [WHATSAPP_WIN_RESPONSE_STATUS] 200
```

If all checked, system is working ✅

If any unchecked, debug that specific step using above guides.

---

## Testing Step by Step

### Test 1: Can You Spin Without Errors?
1. Go to `/spin` page
2. Fill details
3. Verify OTP
4. Accept terms
5. Click "SPIN NOW"
6. Wait for wheel to spin
7. Check server logs for `[SPIN_WHEEL_INIT]` + `[SPIN_WHEEL_SUCCESS]`

### Test 2: Does Data Return to Frontend?
1. Open Browser DevTools → Network
2. Click "SPIN NOW"
3. Find `/api/spin-wheel/spin` request
4. Click Response tab
5. Verify JSON has all fields

### Test 3: Does Modal Display?
1. Complete spin
2. Verify modal appears
3. Check modal text contains prize name
4. Check modal shows coupon code

### Test 4: Are Notifications Sent?
1. Complete spin with a win
2. Check server logs for `[SPIN_WHEEL_NOTIFY_EMAIL_SUCCESS]`
3. Check server logs for `[WHATSAPP_WIN_RESPONSE_STATUS]` 200
4. Verify email received in inbox
5. Verify WhatsApp message received

---

## Support Information

If data isn't showing after following all steps above:

1. **Collect logs:** Share complete server logs from spin attempt
2. **Share Network response:** Screenshot of Network → Response tab
3. **Verify database:** Confirm participant record exists with hasSpun: true
4. **Check .env:** Ensure API credentials are set (ASKEVA_API_KEY, SENDGRID_API_KEY, etc.)
