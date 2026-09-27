# Partner API Testing Guide

## How to Generate a Test API Key

Since the Partner API requires authentication, you need to generate a test API key first. Here are the methods:

### Method 1: Using Partner Registration (Recommended for Testing)

1. **Visit the Partner API Test page**: Go to `/partner-api-test`

2. **Use the Registration endpoint** (no auth required):
   - Select "POST /api/v1/partner/register - Register Partner"
   - Fill in the required business details:
     ```json
     {
       "name": "Test Business",
       "email": "test@example.com",
       "phone": "9876543210",
       "website": "https://test.com",
       "businessDetails": {
         "gstin": "22AAAAA0000A1Z5",
         "pan": "AAAAA0000A",
         "businessType": "private_limited",
         "registeredAddress": {
           "line1": "123 Test Street",
           "line2": "Suite 100",
           "city": "Mumbai",
           "state": "Maharashtra",
           "pincode": "400001",
           "country": "India"
         }
       }
     }
     ```
   - Click "Send Request"
   - The response will include your Partner ID and API key

3. **Copy the API key** from the response and use it to test other endpoints

### Method 2: Database Direct Insert (For Development)

If you have database access, you can directly insert an API key into the `partner_api_keys` collection with the following structure:

```javascript
{
  "_id": ObjectId("..."),
  "partnerId": "partner_id_here",
  "name": "Test API Key",
  "hashedKey": "sha256_hash_of_key",
  "prefix": "sk_test_ptnr_abcdef",
  "environment": "test",
  "tier": "free",
  "permissions": [
    { "resource": "products", "actions": ["read"] },
    { "resource": "orders", "actions": ["read", "create"] },
    { "resource": "wallet", "actions": ["read"] }
  ],
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerDay": 1000,
    "burstLimit": 10
  },
  "status": "active",
  "createdAt": new Date(),
  "lastUsedAt": new Date()
}
```

### Method 3: Admin Panel (Production)

In production, partners should:
1. Register through the partner portal
2. Verify their business details
3. Generate API keys from the partner dashboard
4. Use the generated keys for integration

## Testing Endpoints

Once you have an API key:

1. Go to `/partner-api-test`
2. Enter your API key in the "API Authentication" section
3. Select any endpoint from the dropdown
4. Fill in required parameters
5. Click "Send Request"
6. View the response

## Common Issues

### "Cannot read properties of undefined (reading 'permissions')" Error

**Status**: ✅ FIXED

This error occurred when API keys in the database didn't have the `permissions` field. The fix:
- All API key retrieval functions now fallback to default permissions if missing
- The `hasPermission()` function now safely checks if permissions exist before iterating

### Missing Permissions in Database

If your API keys are missing the `permissions` field, they will automatically get these defaults:
- `products`: read
- `orders`: read, create
- `wallet`: read

## Default Permissions by Tier

### Free Tier
- Products: Read only
- Orders: Read and Create
- Wallet: Read only
- Rate Limit: 60 requests/minute, 1000/day

### Starter Tier
- Products: Read only
- Orders: Read and Create
- Wallet: Read only
- Rate Limit: 120 requests/minute, 5000/day

### Professional Tier
- Products: Read only
- Orders: Read, Create, Update
- Wallet: Read only
- Rate Limit: 300 requests/minute, 20000/day

### Enterprise Tier
- Products: Read only
- Orders: Full access
- Wallet: Read only
- Rate Limit: 1000 requests/minute, 100000/day

## Need Help?

- Check the full documentation at `/partner-api-docs`
- Contact support through `/contact`
- Review API errors in browser console for detailed debugging
