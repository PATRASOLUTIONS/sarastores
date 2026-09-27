# Partner Selling System - API Testing Guide

This guide provides curl commands and examples for testing the Partner Selling System APIs.

## Prerequisites

1. Start the development server: `npm run dev`
2. Have access to a test API key

## Base URL

```
Development: http://localhost:3001/api/v1/partner
Production: https://yourdomain.com/api/v1/partner
```

## 1. Partner Registration

### Register a New Partner

```bash
curl -X POST http://localhost:3001/api/v1/partner/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Partner Co",
    "email": "partner@example.com",
    "phone": "9876543210",
    "gstin": "29ABCDE1234F1Z5",
    "pan": "ABCDE1234F",
    "website": "https://example.com",
    "address": {
      "line1": "123 Business St",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001"
    },
    "contactPerson": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "designation": "CTO"
    }
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "partner": {
      "id": "...",
      "partnerId": "PTR-XXXXXX",
      "companyName": "Test Partner Co",
      "status": "pending_verification"
    },
    "apiKey": {
      "key": "sk_test_ptnr_...",
      "environment": "test"
    },
    "wallet": {
      "id": "...",
      "balance": 0
    }
  }
}
```

---

## 2. Products API

### List Products

```bash
curl -X GET "http://localhost:3001/api/v1/partner/products?page=1&limit=10&category=electronics" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Get Product Details

```bash
curl -X GET "http://localhost:3001/api/v1/partner/products/PRODUCT_ID" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Bulk Stock Check

```bash
curl -X POST "http://localhost:3001/api/v1/partner/products/stock-check" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": ["product_id_1", "product_id_2", "product_id_3"]
  }'
```

---

## 3. Orders API

### Create Order

```bash
curl -X POST "http://localhost:3001/api/v1/partner/orders" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "PRODUCT_ID",
        "quantity": 1
      }
    ],
    "customer": {
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "9876543210"
    },
    "shippingAddress": {
      "line1": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "paymentMethod": "prepaid",
    "shippingMethod": "standard",
    "partnerReference": "ORD-12345",
    "notes": "Handle with care"
  }'
```

### List Orders

```bash
curl -X GET "http://localhost:3001/api/v1/partner/orders?page=1&limit=20&status=pending" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Get Order Details

```bash
curl -X GET "http://localhost:3001/api/v1/partner/orders/PO-XXXXXX" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Cancel Order

```bash
curl -X POST "http://localhost:3001/api/v1/partner/orders/PO-XXXXXX/cancel" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer requested cancellation"
  }'
```

---

## 4. Wallet API

### Get Wallet Balance

```bash
curl -X GET "http://localhost:3001/api/v1/partner/wallet/balance" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Get Transaction History

```bash
curl -X GET "http://localhost:3001/api/v1/partner/wallet/transactions?page=1&limit=20" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Add Bank Account

```bash
curl -X POST "http://localhost:3001/api/v1/partner/wallet/bank-accounts" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "1234567890123",
    "accountHolderName": "Test Partner Co",
    "ifscCode": "HDFC0001234",
    "bankName": "HDFC Bank",
    "branchName": "Main Branch",
    "accountType": "current",
    "isDefault": true
  }'
```

### Request Payout

```bash
curl -X POST "http://localhost:3001/api/v1/partner/wallet/payout" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "bankAccountId": "BANK_ACCOUNT_ID"
  }'
```

### Get Payout History

```bash
curl -X GET "http://localhost:3001/api/v1/partner/wallet/payouts?page=1&limit=20" \
  -H "Authorization: Bearer sk_test_ptnr_YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

---

## 5. Admin APIs

### List Partners

```bash
curl -X GET "http://localhost:3001/api/admin/partners?page=1&limit=20&status=active" \
  -H "Authorization: Bearer YOUR_ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Partner Details

```bash
curl -X GET "http://localhost:3001/api/admin/partners/PARTNER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### Update Partner

```bash
curl -X PUT "http://localhost:3001/api/admin/partners/PARTNER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "growth",
    "status": "active"
  }'
```

### List Pending Payouts

```bash
curl -X GET "http://localhost:3001/api/admin/payouts?status=pending" \
  -H "Authorization: Bearer YOUR_ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### Approve Payout

```bash
curl -X POST "http://localhost:3001/api/admin/payouts/PAYOUT_ID/approve" \
  -H "Authorization: Bearer YOUR_ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TXN123456"
  }'
```

### Reject Payout

```bash
curl -X POST "http://localhost:3001/api/admin/payouts/PAYOUT_ID/reject" \
  -H "Authorization: Bearer YOUR_ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Invalid bank account details"
  }'
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "requestId": "req_xxxxx"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

Rate limits are based on partner tier:

| Tier | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| Starter | 60 | 5,000 |
| Growth | 300 | 25,000 |
| Professional | 1,000 | 100,000 |
| Enterprise | 5,000 | Unlimited |

Rate limit headers are included in every response:
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets
