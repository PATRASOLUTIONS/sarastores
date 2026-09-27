# Partner API - Vercel Attack Challenge Bypass Guide

This guide explains how to bypass Vercel's Attack Challenge Mode for Partner API calls on a **Hobby plan**.

## The Problem

Vercel's Attack Challenge Mode blocks automated/bot-like requests from browsers. This affects:
- Partner websites calling your API from browser JavaScript
- API testing from external tools
- CORS preflight requests

## Solutions (Choose One)

### Solution 1: Server-Side API Calls (Recommended)

Partners should call your API from their **backend server**, not from browser JavaScript.

```
Browser → Partner's Server → SaraMobiles API → Response → Browser
```

**Example (Next.js API Route on Partner's Site):**

```typescript
// pages/api/products.js (on partner's website)
export default async function handler(req, res) {
  const response = await fetch('https://sarastores.com/api/v1/partner/products', {
    headers: {
      'Authorization': 'Bearer pk_live_xxx',
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  res.json(data);
}
```

### Solution 2: Protection Bypass Secret (For Testing/Development)

Vercel provides a "Protection Bypass for Automation" feature that works even on Hobby plans.

#### Step 1: Generate a Secret

```bash
openssl rand -hex 32
```

Example output: `a1b2c3d4e5f6789...`

#### Step 2: Configure in Vercel Dashboard

1. Go to **Vercel Dashboard** → Your Project → **Settings**
2. Navigate to **Deployment Protection**
3. Find **Protection Bypass for Automation**
4. Enter your generated secret
5. Click **Save**

#### Step 3: Share with Partners

Partners add this header to their requests:

```
x-vercel-protection-bypass: YOUR_SECRET_HERE
```

**JavaScript Example:**
```javascript
const response = await fetch('https://sarastores.com/api/v1/partner/products', {
  headers: {
    'Authorization': 'Bearer pk_live_xxx',
    'x-vercel-protection-bypass': 'YOUR_SECRET_HERE',
    'Content-Type': 'application/json'
  }
});
```

**cURL Example:**
```bash
curl -H "Authorization: Bearer pk_live_xxx" \
     -H "x-vercel-protection-bypass: YOUR_SECRET_HERE" \
     https://sarastores.com/api/v1/partner/products
```

### Solution 3: PARTNER_ALLOWED_ORIGINS Environment Variable

For additional CORS flexibility, set allowed origins in your environment:

```env
PARTNER_ALLOWED_ORIGINS=https://partner1.com,https://partner2.com,*.mypartner.com
```

This allows proper CORS headers for those domains.

## Testing

### Local Testing

1. The API test page at `/partner-api-test` has a field for the bypass secret
2. Enter your API key and bypass secret
3. Test endpoints directly

### Production Testing

Use the bypass secret in your request headers, or make server-side calls.

## Environment Variables Summary

Add these to your `.env.local` and Vercel Environment Variables:

```env
# Partner API Configuration
PARTNER_API_KEY_SECRET=your-32-byte-encryption-key
PARTNER_ALLOWED_ORIGINS=https://partner1.com,https://partner2.com

# Vercel Protection Bypass (same value as in Vercel Dashboard)
VERCEL_AUTOMATION_BYPASS_SECRET=your-generated-secret
```

## Files Modified

- `/lib/partner/auth.ts` - Reads `PARTNER_ALLOWED_ORIGINS` for CORS
- `/app/partner-api-test/page.tsx` - Added bypass secret field
- `/app/partner-api-docs/page.tsx` - Added server-side requirement warning
- `/vercel.json` - Added CORS headers and rewrites
- `/.env.example` - Added all partner-related env vars

## Quick Links

- [Partner API Test Page](/partner-api-test)
- [Partner API Documentation](/partner-api-docs)
- [Vercel Protection Bypass Docs](https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection)
