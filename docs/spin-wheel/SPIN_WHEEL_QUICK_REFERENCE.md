# Spin Wheel - Quick Reference Card

## 🎯 Most Common Issues & Quick Fixes

### Issue: "No Congratulation Email Received"

**Check these logs in order:**
1. `[SPIN_WHEEL_SUCCESS]` ← Spin completed?
2. `[EMAIL_SEND_ATTEMPT]` ← Email sending attempted?
3. `[EMAIL_SEND_SUCCESS]` ← Email actually sent?

**If #3 shows error:**
- Check `.env` has `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Check recipient email is valid in database

---

### Issue: "No WhatsApp Message Received"

**Check these logs in order:**
1. `[WHATSAPP_WIN_VALIDATION]` ← Phone format check
2. `[WHATSAPP_WIN_RESPONSE_STATUS]` ← API responded?
3. `[WHATSAPP_WIN_RESPONSE_DATA]` ← Contains message ID?

**Common problems:**
- ❌ Phone is 11 digits (should be 10) → `[WHATSAPP_WIN_VALIDATION_ERROR]`
- ❌ API key wrong → `[WHATSAPP_WIN_RESPONSE_STATUS] HTTP 401`
- ❌ Template not approved → Check WhatsApp Business Account

---

### Issue: "Can't See Prize Data After Winning"

**Quick check:**
1. Open Browser DevTools (F12) → Network tab
2. Find `POST /api/spin-wheel/spin` request
3. Click "Response" tab
4. Should show JSON with `prize` and `couponCode`

**If empty:** Backend error. Check `[SPIN_WHEEL_SUCCESS]` in server logs.

---

## 🔍 Log Cheatsheet

| What You Want to Check | Look for this log | What it means |
|------------------------|------------------|--------------|
| Did spin complete? | `[SPIN_WHEEL_SUCCESS]` | Whole process worked ✅ |
| Did email send? | `[EMAIL_SEND_SUCCESS]` | Email service responded ✅ |
| Did WhatsApp send? | `[WHATSAPP_WIN_RESPONSE_STATUS] 200` | API accepted message ✅ |
| What prize was won? | `[SPIN_WHEEL_SELECTED_PRIZE]` | The actual prize selected |
| What parameters sent? | `[WHATSAPP_WIN_PAYLOAD]` | Exact data to API |
| Why no notification? | `[SPIN_WHEEL_NOTIFY_SKIPPED]` | Better luck or no coupon |
| Email config OK? | `[EMAIL_CONFIG_CHECK]` | SMTP settings validation |
| Phone format OK? | `[WHATSAPP_WIN_VALIDATION]` | Phone must be 10 digits |

---

## 🛠️ Environment Variables to Check

```bash
# Email Service
SMTP_HOST          # Server address
SMTP_PORT          # Usually 587
SMTP_USER          # Username
SMTP_PASS          # Password
EMAIL_FROM         # Sender email

# WhatsApp Service
ASKEVA_API_KEY     # API authentication
ASKEVA_API_URL     # Endpoint URL
ASKEVA_SENDER_NUM  # Sender number (91XXXXXXXXXX)
```

---

## ⚡ Quick Debug Steps

### When Email Fails:

```
1. Look for: [EMAIL_SEND_ERROR]
2. Check error message in logs
3. Verify .env variables are set
4. Check recipient email format
5. Test SMTP connection manually
```

### When WhatsApp Fails:

```
1. Look for: [WHATSAPP_WIN_VALIDATION_ERROR]
   → Phone format wrong (should be 10 digits)
2. Look for: [WHATSAPP_WIN_RESPONSE_STATUS]
   → 401 = API key wrong
   → 400 = Payload format wrong
   → 429 = Rate limit
3. Look for: [WHATSAPP_WIN_RESPONSE_DATA]
   → Check for template not found error
4. Verify .env has ASKEVA_API_KEY
5. Verify template "spin_win_confirm" exists in WhatsApp Business
```

### When Data Doesn't Show:

```
1. Check Network tab for /api/spin-wheel/spin response
2. Look for: [SPIN_WHEEL_SUCCESS] in server logs
3. Check response JSON has prize and couponCode
4. Check modal CSS isn't hiding the element
5. Verify database has the spin record
```

---

## 📊 Test Checklist

After deploying changes:

- [ ] User can complete spin
- [ ] Winner sees congratulation modal
- [ ] Modal shows prize name
- [ ] Modal shows coupon code
- [ ] Email received in inbox
- [ ] WhatsApp message received
- [ ] Network tab shows no duplicate inventory calls
- [ ] Console shows `[INVENTORY_FETCH_SKIPPED]` on spin click
- [ ] Server logs show all expected log patterns

---

## 🔗 Documentation Quick Links

| Issue | Guide |
|-------|-------|
| General logging patterns | [SPIN_WHEEL_LOGGING_GUIDE.md](SPIN_WHEEL_LOGGING_GUIDE.md) |
| WhatsApp not working | [WHATSAPP_WIN_DEBUGGING.md](WHATSAPP_WIN_DEBUGGING.md) |
| Data not showing | [SPIN_RESPONSE_DATA_DEBUG.md](SPIN_RESPONSE_DATA_DEBUG.md) |
| Complete reference | [SPIN_WHEEL_DEBUG_MASTER.md](SPIN_WHEEL_DEBUG_MASTER.md) |
| What was changed | [SPIN_WHEEL_IMPROVEMENTS_SUMMARY.md](SPIN_WHEEL_IMPROVEMENTS_SUMMARY.md) |

---

## 💡 Pro Tips

1. **Search logs by participant ID:**
   ```bash
   grep "69d3ee8d5f324820c9273653" logs.txt
   ```
   Shows all activity for that user

2. **Find all errors:**
   ```bash
   grep "FAILED\|ERROR" logs.txt
   ```
   Shows only problem logs

3. **Test email manually:**
   ```bash
   node scripts/test-email.js your@email.com
   ```

4. **Test WhatsApp manually:**
   ```bash
   curl -X POST https://api.askeva.com/send \
     -H "Authorization: Bearer KEY" \
     -d '{...payload...}'
   ```

5. **Check database spin record:**
   ```javascript
   db.spinWheelParticipants.findOne({phone: "XXXXXXXXXX"})
   ```

---

## ⏱️ Expected Timings

| Operation | Duration | Log Pattern |
|-----------|----------|------------|
| Inventory fetch | <1s | `[INVENTORY_FETCH_START]` to `[INVENTORY_FETCH_SUCCESS]` |
| Spin API (backend) | <3s | `[SPIN_WHEEL_INIT]` to `[SPIN_WHEEL_SUCCESS]` |
| Email send | <2s | `[EMAIL_SENDING]` to `[EMAIL_SEND_SUCCESS]` |
| WhatsApp send | <2s | `[WHATSAPP_WIN_REQUEST]` to response |

If slower than above, investigate that specific component.

---

## ❓ FAQ

**Q: Why does API say success but message doesn't arrive?**  
A: API accepted message but delivery can fail later. Check WhatsApp Business account webhook logs or ask recipient to check spam folder.

**Q: Phone number format - should it be with or without 91?**  
A: Store as 10 digits only (e.g., `8332936831`). The API adds `91` automatically.

**Q: How often are emails/WhatsApp checked?**  
A: They're sent immediately after spin completes. Fire-and-forget design means spin response doesn't wait for delivery.

**Q: Can I see message delivery status?**  
A: Yes, WhatsApp API should return `message_status: "accepted"`. Check `[WHATSAPP_WIN_RESPONSE_DATA]` for status field.

**Q: What happens if template doesn't exist?**  
A: WhatsApp API returns error. Look for `[WHATSAPP_WIN_ERROR_REASON]` with message about template not found.

---

## 🆘 When All Else Fails

1. **Collect these logs:**
   - Full server logs from `[SPIN_WHEEL_INIT]` to `[SPIN_WHEEL_SUCCESS]`
   - Browser Network response JSON
   - `.env` file (mask secrets)

2. **Check database:**
   ```javascript
   db.spinWheelParticipants.findOne({phone: "XXXXXXXXXX"})
   db.spinWheelCoupons.findOne({couponCode: "CODE123"})
   ```

3. **Verify config:**
   - All `.env` variables set
   - API credentials are correct
   - WhatsApp template exists and is approved

4. **Contact support with:**
   - Participant phone number or ID
   - Exact timestamp of failed spin
   - Collected logs from above
   - Screenshot of error (if any)

---

**Remember:** With these detailed logs, most issues can be diagnosed in under 5 minutes! 🚀
