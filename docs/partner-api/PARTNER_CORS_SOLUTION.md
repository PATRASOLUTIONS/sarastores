# Partner API CORS Configuration Guide

## Problem Summary

A partner is experiencing CORS (Cross-Origin Resource Sharing) errors when trying to access the Partner API from their browser application. This happens because browser-based requests are subject to CORS restrictions, which are security measures that prevent unauthorized cross-domain requests.

## Current Status ✅

**Good news!** Your application already has a complete CORS solution implemented. The CORS configuration is properly set up in the Partner API authentication middleware.

## Solution Options

### Option 1: Add Partner Domain to Allowed Origins (Recommended for Browser Requests)

If the partner needs to make **browser-based** API calls (client-side JavaScript), they need to have their domain added to the allowed origins list.

#### Current Allowed Origins

The system currently allows these origins by default:
- `https://sarastores.com`
- `https://www.sarastores.com`
- `https://saramobiles.com`
- `https://www.saramobiles.com`
- `http://localhost:3000`
- `http://localhost:3001`

**Plus**, the following from environment variables:
- `https://*.vercel.app` (all Vercel deployments)

#### How to Add Partner Domains

**For Development:**
Add the partner's domain to `.env.local`:
```bash
PARTNER_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://*.vercel.app,https://partner-domain.com,https://www.partner-domain.com
```

**For Production (Vercel):**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find or create `PARTNER_ALLOWED_ORIGINS`
3. Add the partner's production domains:
   ```
   http://localhost:3000,http://localhost:3001,https://*.vercel.app,https://partner-domain.com,https://www.partner-domain.com
   ```
4. Redeploy the application

**Wildcard Support:**
You can use wildcards for subdomains:
- `https://*.partner-domain.com` - Allows all subdomains of partner-domain.com
- `http://localhost:*` - Allows localhost with any port

### Option 2: Partner Uses Server-Side Requests (Recommended for Security)

**This is the better approach for production systems.**

Instead of making API calls from the browser (client-side), the partner should:
1. Create their own backend API route
2. Make the Partner API call from their server
3. Return the data to their frontend

**Benefits:**
- ✅ No CORS issues (server-to-server requests don't have CORS restrictions)
- ✅ API keys stay secure on the server (never exposed to browser)
- ✅ Better control over rate limiting
- ✅ Can add caching layer
- ✅ More secure overall architecture

**Example Implementation:**

```javascript
// Partner's Next.js API Route: /app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Call SaraMobiles Partner API from server-side
    const response = await fetch('https://ecom-bytewise.vercel.app/api/v1/partner/products', {
      headers: {
        'Authorization': `Bearer ${process.env.SARA_PARTNER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

Then from their frontend:
```javascript
// Partner's Frontend Component
const response = await fetch('/api/products'); // Calls their own API
const data = await response.json();
```

### Option 3: Use API Key Domain Restrictions

Each Partner API key can have its own allowed domains configured. This provides per-partner control.

**To configure:**
1. Partner logs into Partner Dashboard
2. Goes to API Keys section
3. Edits their API key
4. Adds their allowed domains in the "Allowed Domains" field

**Format:**
```
https://partner-website.com
https://www.partner-website.com
https://*.partner-website.com
http://localhost:3000
```

## Current Implementation Details

### CORS Headers Set by the System

The Partner API automatically sets these CORS headers:

```
Access-Control-Allow-Origin: <origin or *>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Request-ID, X-Partner-ID, User-Agent
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Access-Control-Expose-Headers: X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

### Origin Checking Logic

The system checks origins in this order:
1. **API Key Allowed Domains** - Partner-specific domain whitelist
2. **Global Allowed Origins** - System-wide allowed domains (from env + defaults)
3. **Wildcard Matching** - Supports `*.domain.com` patterns
4. **Server-to-Server** - If no `Origin` header is present (server-side request), always allowed

### Preflight Requests

The system properly handles OPTIONS preflight requests, which browsers send before actual requests to check CORS permissions.

## Testing CORS Configuration

### Test from Browser Console

Partner can test if their domain is allowed by running this in their browser console:

```javascript
fetch('https://ecom-bytewise.vercel.app/api/v1/partner/products', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer pk_test_YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
})
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('CORS Error:', error));
```

If they see a CORS error, their domain needs to be added.

### Common CORS Error Messages

**"has been blocked by CORS policy"**
- Partner's domain is not in allowed origins list
- **Solution:** Add their domain to `PARTNER_ALLOWED_ORIGINS`

**"Origin not whitelisted for this API key"**
- Partner's API key has domain restrictions enabled
- Their current domain is not in the API key's allowed domains
- **Solution:** Add domain in Partner Dashboard → API Keys → Edit → Allowed Domains

## Partner Instructions

### For Browser-Based Integration

**Email to Partner:**

```
Hi [Partner Name],

To enable browser-based API calls from your website, we need to add your domain to our CORS whitelist.

Please provide the following information:

1. **Production Domain(s):**
   - Example: https://yourwebsite.com
   - Include www version if applicable: https://www.yourwebsite.com

2. **Development/Staging Domain(s):**
   - Example: https://staging.yourwebsite.com
   - Include localhost if needed: http://localhost:3000

3. **Do you use subdomains?**
   - If yes, we can whitelist all subdomains with: https://*.yourwebsite.com

Once we have this information, we'll add your domains to the CORS configuration and notify you when it's live (usually within 24 hours).

**Important Security Note:**
For production environments, we strongly recommend making API calls from your server-side code instead of directly from the browser. This keeps your API key secure and avoids CORS issues entirely.

Best regards,
ByteWise Team
```

### For Server-Side Integration (Recommended)

**Email to Partner:**

```
Hi [Partner Name],

For the most secure integration, we recommend making Partner API calls from your server-side code.

**Benefits:**
✅ No CORS issues
✅ API keys stay secure
✅ Better performance with caching
✅ More control over rate limiting

**Quick Setup:**

1. Create a server-side API route in your application
2. Store your Partner API key in environment variables
3. Make the Partner API call from your server
4. Return the data to your frontend

Example code and documentation: [Include link to integration guide]

Need help? Reply to this email or contact our developer support team.

Best regards,
ByteWise Team
```

## Files Modified/Involved

- `/lib/partner/auth.ts` - Main CORS logic and authentication
- `/lib/partner/index.ts` - Exports CORS utilities
- `/.env.local` - Development environment configuration
- Vercel Environment Variables - Production configuration

## Quick Commands

**Add a new domain to development:**
```bash
# Edit .env.local and append to PARTNER_ALLOWED_ORIGINS
nano .env.local
```

**Restart development server:**
```bash
npm run dev
```

**Deploy to production (Vercel):**
```bash
vercel --prod
# Or push to main branch for automatic deployment
```

## Support Checklist

When a partner reports CORS issues:

- [ ] Verify they're making browser-based requests (not server-side)
- [ ] Ask for their exact domain/URL
- [ ] Check if it's in `PARTNER_ALLOWED_ORIGINS`
- [ ] Check if their API key has domain restrictions
- [ ] Test with their domain added to `.env.local`
- [ ] Add to production environment variables in Vercel
- [ ] Redeploy to production
- [ ] Verify with partner that it's working
- [ ] Document the partner's domain for future reference

## Conclusion

Your CORS infrastructure is already production-ready. You just need to:

1. **Ask the partner for their domain(s)**
2. **Add them to `PARTNER_ALLOWED_ORIGINS`** (dev and production)
3. **Redeploy**

Or better yet, encourage them to use server-side API calls for better security and no CORS headaches!
