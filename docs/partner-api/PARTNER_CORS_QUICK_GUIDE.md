# Quick Guide: Adding Partner Domains for CORS

## 🚀 Quick Solution

When a partner reports CORS errors from their browser application:

### Step 1: Get Partner Domain(s)
Ask the partner for:
- Production domain(s): `https://partner-website.com`
- Development domain(s): `http://localhost:3000` or `https://dev.partner-website.com`
- Whether they use subdomains: If yes, use `https://*.partner-website.com`

### Step 2: Add to Development Environment

Edit `.env.local`:
```bash
# Find the PARTNER_ALLOWED_ORIGINS line and add partner domains
PARTNER_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://*.vercel.app,https://partner-website.com,https://www.partner-website.com,https://*.partner-website.com
```

Restart the development server:
```bash
npm run dev
```

### Step 3: Add to Production (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (ecom-bytewise)
3. Go to **Settings** → **Environment Variables**
4. Find or create `PARTNER_ALLOWED_ORIGINS`
5. Update the value to include the new partner domains:
   ```
   http://localhost:3000,http://localhost:3001,https://*.vercel.app,https://partner-website.com,https://www.partner-website.com,https://*.partner-website.com
   ```
6. **Redeploy** the application:
   - Option A: Push to main branch
   - Option B: Go to **Deployments** → **...** → **Redeploy**

### Step 4: Verify

Have the partner test from their browser console:
```javascript
fetch('https://ecom-bytewise.vercel.app/api/v1/partner/products?page=1&limit=10', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer pk_test_THEIR_API_KEY',
    'Content-Type': 'application/json',
  },
})
  .then(response => response.json())
  .then(data => console.log('✅ Success:', data))
  .catch(error => console.error('❌ Error:', error));
```

## 📋 Supported Domain Formats

| Format | Example | Description |
|--------|---------|-------------|
| Full URL | `https://partner.com` | Exact match |
| With www | `https://www.partner.com` | Include both with and without www |
| Wildcard subdomains | `https://*.partner.com` | All subdomains |
| Localhost | `http://localhost:3000` | Development |
| Localhost any port | `http://localhost:*` | Any localhost port |

## ⚠️ Important Notes

1. **Comma-separated**: Multiple domains are separated by commas with no spaces
2. **Include protocol**: Always use `http://` or `https://`
3. **www variations**: Add both `https://partner.com` and `https://www.partner.com` if needed
4. **Case-insensitive**: Domain matching is case-insensitive
5. **Redeploy required**: Changes to environment variables require redeployment

## 🔒 Better Alternative: Server-Side Calls

Instead of adding domains, recommend partners use **server-side API calls**:

### Why Server-Side is Better
✅ No CORS issues  
✅ API keys never exposed to browser  
✅ Better security  
✅ Can add caching  
✅ More control  

### Partner Implementation Example

**Their Backend API Route** (`/app/api/sara-products/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const response = await fetch(
    'https://ecom-bytewise.vercel.app/api/v1/partner/products?page=1&limit=20',
    {
      headers: {
        'Authorization': `Bearer ${process.env.SARA_PARTNER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const data = await response.json();
  return NextResponse.json(data);
}
```

**Their Frontend**:
```javascript
// No CORS issues - calling their own API
const response = await fetch('/api/sara-products');
const data = await response.json();
```

## 📝 Template Email for Partners

### Option 1: Browser-Based (Add Domain)

```
Subject: CORS Access - Domain Whitelist Request

Hi [Partner Name],

To enable browser-based API calls from your website, please provide:

1. Production domain(s): (e.g., https://yoursite.com)
2. Development domain(s): (e.g., http://localhost:3000)
3. Do you need subdomain support? (e.g., https://*.yoursite.com)

We'll add these to our CORS whitelist within 24 hours.

Best regards,
ByteWise Support
```

### Option 2: Server-Side (Recommended)

```
Subject: Partner API Integration - Server-Side Recommended

Hi [Partner Name],

For better security, we recommend making API calls from your server instead of the browser.

Benefits:
- No CORS configuration needed
- API keys stay secure
- Better performance
- More control

See our integration guide: [link]
Need help? Let us know!

Best regards,
ByteWise Support
```

## 🐛 Troubleshooting

### Partner Still Gets CORS Error After Adding Domain

**Check:**
1. ✅ Domain format is correct (with protocol)
2. ✅ Environment variable updated in Vercel
3. ✅ Application redeployed after env update
4. ✅ Partner is using correct domain (check browser console for actual origin)
5. ✅ API key doesn't have separate domain restrictions (check database)

**Test:**
```bash
# Check what origin the browser is sending
# In browser console:
console.log(window.location.origin);
```

### Partner's API Key Has Domain Restrictions

If their API key has its own `allowedDomains` array in the database, those domains must match too.

**Database Query:**
```javascript
// In MongoDB or through API
db.api_keys.findOne({ key: "pk_test_..." })

// Check the allowedDomains field:
// - If empty array [] = all domains allowed
// - If has values = must match one of those domains
```

**Solution:**
Either:
- Clear the API key's `allowedDomains` array (allows all)
- Add partner's domain to the API key's `allowedDomains`

## 🔍 Current Allowed Origins

As configured in `.env.local`:

```bash
# Default (hardcoded in auth.ts):
https://sarastores.com
https://www.sarastores.com
https://saramobiles.com
https://www.saramobiles.com
http://localhost:3000
http://localhost:3001

# From PARTNER_ALLOWED_ORIGINS:
https://*.vercel.app

# Add partner domains here:
https://partner-domain.com
```

## 📚 Related Files

- [PARTNER_CORS_SOLUTION.md](./PARTNER_CORS_SOLUTION.md) - Complete documentation
- `lib/partner/auth.ts` - CORS implementation
- `.env.local` - Development configuration
- Vercel Dashboard - Production configuration

## ⏱️ Estimated Time

- Adding domain to dev: **1 minute**
- Adding to production: **2 minutes**
- Deployment + verification: **5-10 minutes**
- **Total: ~15 minutes**
