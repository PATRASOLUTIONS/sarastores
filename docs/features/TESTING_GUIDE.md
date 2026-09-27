# Software License Automation - Testing Guide

## Prerequisites

Before testing, ensure you have:
1. MongoDB database connection configured
2. Email service (SMTP) configured
3. At least one software product in the database
4. License keys added to the `software_licenses` collection

## Setup Steps

### 1. Add a Software Product

First, ensure you have a software product in your database:

```javascript
// In MongoDB or via admin panel
{
  _id: ObjectId("..."),
  name: "Test Software",
  description: "Test software for license automation",
  category: "productivity",
  type: "software",
  // ... other fields
}
```

### 2. Add License Keys

Use the provided script or API to add license keys:

**Option A: Using the Script**
```bash
# Copy the example script
cp scripts/add-license-keys.example.ts scripts/add-license-keys.ts

# Edit the file with your softwareId and keys
# Then run:
npx ts-node scripts/add-license-keys.ts
```

**Option B: Using the API**
```bash
curl -X POST http://localhost:3000/api/software-licenses \
  -H "Content-Type: application/json" \
  -d '{
    "softwareId": "YOUR_SOFTWARE_ID",
    "keys": [
      "TEST-KEY-1234-ABCD",
      "TEST-KEY-2345-BCDE",
      "TEST-KEY-3456-CDEF"
    ]
  }'
```

**Option C: Direct MongoDB Insert**
```javascript
db.software_licenses.insertMany([
  {
    softwareId: ObjectId("YOUR_SOFTWARE_ID"),
    key: "TEST-KEY-1234-ABCD",
    assigned: false,
    email: null,
    orderId: null,
    assignedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    softwareId: ObjectId("YOUR_SOFTWARE_ID"),
    key: "TEST-KEY-2345-BCDE",
    assigned: false,
    email: null,
    orderId: null,
    assignedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
])
```

## Test Scenarios

### Test 1: Successful License Assignment

**Steps:**
1. Add software product to cart
2. Proceed to checkout
3. Enter customer details (use a real email you can check)
4. Complete payment (use test payment gateway if available)
5. Wait for order creation

**Expected Results:**
- ✅ Order created with `status: "paid"`
- ✅ License key assigned in database (`assigned: true`)
- ✅ Order document has `licenseKey` field populated
- ✅ Order document has `licenseAssignedAt` timestamp
- ✅ Customer receives activation email
- ✅ Console logs show: `✅ License assigned: [KEY] for order [ORDER_ID]`
- ✅ Console logs show: `📧 Activation key email sent to [EMAIL]`

**Verification:**
```javascript
// Check in MongoDB
db.orders.findOne({ _id: ObjectId("ORDER_ID") })
// Should have: licenseKey, licenseAssignedAt

db.software_licenses.findOne({ key: "YOUR_KEY" })
// Should have: assigned: true, email: "customer@email.com", orderId: ObjectId("...")
```

### Test 2: Multiple Software Items in One Order

**Steps:**
1. Add 2-3 different software products to cart
2. Complete checkout and payment

**Expected Results:**
- ✅ Each software item gets a unique license key
- ✅ Multiple activation emails sent (one per software)
- ✅ All licenses marked as assigned in database

### Test 3: No Available Licenses (Error Handling)

**Steps:**
1. Remove all available licenses for a software product:
   ```javascript
   db.software_licenses.updateMany(
     { softwareId: ObjectId("SOFTWARE_ID") },
     { $set: { assigned: true } }
   )
   ```
2. Try to purchase that software
3. Complete payment

**Expected Results:**
- ✅ Order created successfully (doesn't fail)
- ✅ Order does NOT have `licenseKey` field
- ✅ Console shows error: `⚠️ No available license found for software: [NAME]`
- ✅ Admin receives urgent alert email
- ✅ Customer receives order confirmation (but no activation key)

**Admin Alert Email Should Contain:**
- Order ID
- Customer email
- Software name
- Timestamp
- Action items for admin

### Test 4: Email Failure (Graceful Degradation)

**Steps:**
1. Temporarily break email configuration (wrong SMTP settings)
2. Purchase software and complete payment

**Expected Results:**
- ✅ Order created successfully
- ✅ License assigned successfully
- ✅ Console shows error: `❌ Failed to send activation key email`
- ✅ Order creation doesn't fail
- ✅ Admin can manually resend email later

### Test 5: License Revocation (Refund Scenario)

**Steps:**
1. Complete a successful software purchase
2. Revoke the license:
   ```bash
   curl -X DELETE "http://localhost:3000/api/software-licenses?licenseId=LICENSE_ID"
   ```

**Expected Results:**
- ✅ License marked as unassigned (`assigned: false`)
- ✅ Email and orderId fields cleared
- ✅ License becomes available for reassignment

**Verification:**
```javascript
db.software_licenses.findOne({ _id: ObjectId("LICENSE_ID") })
// Should have: assigned: false, email: null, orderId: null
```

### Test 6: Check Available License Count

**Steps:**
```bash
curl "http://localhost:3000/api/software-licenses?softwareId=SOFTWARE_ID&countOnly=true"
```

**Expected Results:**
- ✅ Returns count of available licenses
- ✅ Count matches actual unassigned licenses in database

### Test 7: View All Licenses for a Customer

**Steps:**
```bash
curl "http://localhost:3000/api/software-licenses?email=customer@email.com"
```

**Expected Results:**
- ✅ Returns all licenses assigned to that customer
- ✅ Includes license keys, software IDs, order IDs

## Email Testing

### Check Activation Email Content

The activation email should include:
- ✅ Customer name
- ✅ Software name
- ✅ License key (prominently displayed)
- ✅ Validity period (in days)
- ✅ Max devices
- ✅ Order number
- ✅ Activation instructions
- ✅ Support contact information
- ✅ Professional design with purple gradient header

### Check Admin Alert Email (No License)

The admin alert should include:
- ✅ Urgent subject line
- ✅ Order ID and customer email
- ✅ Software name and ID
- ✅ Timestamp
- ✅ Action items
- ✅ Red/warning color scheme

## Database Verification Queries

### Check Assigned Licenses
```javascript
db.software_licenses.find({ assigned: true })
```

### Check Available Licenses for a Software
```javascript
db.software_licenses.find({
  softwareId: ObjectId("SOFTWARE_ID"),
  assigned: false
})
```

### Check Orders with License Keys
```javascript
db.orders.find({ 
  licenseKey: { $exists: true, $ne: null } 
})
```

### Find Orders Missing License Keys (Should be investigated)
```javascript
db.orders.find({
  items: { $elemMatch: { type: "software" } },
  status: "paid",
  licenseKey: { $exists: false }
})
```

## Performance Testing

### Test with High Volume
1. Add 100+ license keys
2. Simulate 10 concurrent orders
3. Verify all assignments complete successfully
4. Check for race conditions (no duplicate assignments)

## Troubleshooting

### License Not Assigned
**Check:**
1. Is order status "paid"?
2. Are there available licenses in database?
3. Check console logs for errors
4. Verify softwareId matches between order item and licenses

### Email Not Received
**Check:**
1. SMTP configuration in environment variables
2. Customer email address is valid
3. Check spam folder
4. Review console logs for email errors
5. Verify email service is running

### Admin Alert Not Received
**Check:**
1. ADMIN_EMAIL environment variable is set
2. Email service configuration
3. Console logs for alert errors

## Environment Variables Required

```env
# Database
MONGODB_URI=mongodb://...

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin Alerts
ADMIN_EMAIL=admin@yourdomain.com

# Application
NEXTAUTH_URL=http://localhost:3000
```

## Success Criteria

All tests pass when:
- ✅ Licenses assigned automatically on payment
- ✅ Customers receive activation emails
- ✅ Admin receives alerts for issues
- ✅ Database state is consistent
- ✅ No duplicate license assignments
- ✅ Graceful error handling
- ✅ Proper logging throughout
- ✅ Email failures don't block orders
- ✅ License revocation works correctly

## Next Steps After Testing

1. Monitor production logs for first few orders
2. Set up database indexes for performance
3. Create admin dashboard for license management
4. Implement customer portal for viewing licenses
5. Add analytics for license usage
6. Consider implementing license activation tracking
