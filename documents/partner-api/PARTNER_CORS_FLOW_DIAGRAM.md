# Partner API CORS Flow Diagram

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PARTNER'S BROWSER APPLICATION                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  JavaScript Code: https://partner-website.com                            │
│                                                                           │
│  fetch('https://ecom-bytewise.vercel.app/api/v1/partner/products', {    │
│    headers: { 'Authorization': 'Bearer pk_test_...' }                   │
│  })                                                                      │
│                                                                           │
└────────────────────────┬──────────────────────────────────────────────────┘
                         │
                         │ ❌ CORS ERROR (if domain not whitelisted)
                         │ ✅ SUCCESS (if domain is whitelisted)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              YOUR API: https://ecom-bytewise.vercel.app                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1️⃣ Preflight Check (OPTIONS request)                                   │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │ Browser automatically sends OPTIONS request first          │      │
│     │ Origin: https://partner-website.com                        │      │
│     └────────────────────────────────────────────────────────────┘      │
│                          │                                               │
│                          ▼                                               │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │ lib/partner/auth.ts - handleOptionsRequest()              │      │
│     │ Checks: Is origin in ALLOWED_ORIGINS?                     │      │
│     └────────────────────────────────────────────────────────────┘      │
│                          │                                               │
│                          ▼                                               │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │ Returns 204 with CORS headers:                            │      │
│     │ Access-Control-Allow-Origin: https://partner-website.com  │      │
│     │ Access-Control-Allow-Methods: GET, POST, PUT, DELETE...   │      │
│     │ Access-Control-Allow-Headers: Authorization, Content...   │      │
│     └────────────────────────────────────────────────────────────┘      │
│                                                                           │
│  2️⃣ Actual Request (GET/POST/etc)                                       │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │ GET /api/v1/partner/products                               │      │
│     │ Origin: https://partner-website.com                        │      │
│     │ Authorization: Bearer pk_test_...                          │      │
│     └────────────────────────────────────────────────────────────┘      │
│                          │                                               │
│                          ▼                                               │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │ withPartnerAuth() middleware                               │      │
│     │ 1. Validates API key                                       │      │
│     │ 2. Checks origin against:                                  │      │
│     │    - API key allowedDomains                                │      │
│     │    - Global PARTNER_ALLOWED_ORIGINS                        │      │
│     │ 3. Checks rate limits                                      │      │
│     └────────────────────────────────────────────────────────────┘      │
│                          │                                               │
│                          ▼                                               │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │ Route Handler                                              │      │
│     │ app/api/v1/partner/products/route.ts                       │      │
│     │ Returns data with CORS headers                             │      │
│     └────────────────────────────────────────────────────────────┘      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE TO PARTNER'S BROWSER                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  HTTP/1.1 200 OK                                                         │
│  Access-Control-Allow-Origin: https://partner-website.com                │
│  Access-Control-Allow-Credentials: true                                  │
│  X-Request-Id: uuid-...                                                  │
│                                                                           │
│  {                                                                        │
│    "success": true,                                                      │
│    "data": { "items": [...], "pagination": {...} }                      │
│  }                                                                        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## CORS Decision Flow

```
┌─────────────────────────────────────┐
│  Incoming Request from Browser      │
│  Origin: https://partner-site.com   │
└──────────────┬──────────────────────┘
               │
               ▼
         ┌──────────┐
         │ OPTIONS? │
         └─┬─────┬──┘
           │     │
       Yes │     │ No
           │     │
           ▼     │
    ┌──────────┐│
    │ Return   ││
    │ CORS     ││
    │ Headers  ││
    │ (204)    ││
    └──────────┘│
               │
               ▼
        ┌─────────────────────────┐
        │ Extract API Key         │
        │ from Authorization      │
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │ Validate API Key        │
        │ (active, not expired)   │
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │ API Key has             │
        │ allowedDomains?         │
        └───┬──────────────┬──────┘
            │              │
         Yes│              │No (empty array)
            │              │
            ▼              ▼
    ┌──────────────┐  ┌─────────────┐
    │ Check origin │  │ Check       │
    │ against API  │  │ origin      │
    │ key domains  │  │ against     │
    │              │  │ global list │
    └───┬──────────┘  └──────┬──────┘
        │                    │
        ▼                    ▼
    ┌────────────────────────────┐
    │ Origin matches?            │
    └─┬─────────────────────┬────┘
      │                     │
   Yes│                  No │
      │                     │
      ▼                     ▼
┌───────────┐         ┌──────────────┐
│ ✅ Allow  │         │ ❌ Reject    │
│ Process   │         │ 403 Error    │
│ Request   │         │ "Origin not  │
│           │         │  allowed"    │
└───────────┘         └──────────────┘
```

## Allowed Origins Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                  ALLOWED ORIGINS CHECK                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1️⃣ API Key Level (per-partner control)                     │
│     ┌─────────────────────────────────────────────────┐     │
│     │ API Key Document in Database:                   │     │
│     │ {                                                │     │
│     │   allowedDomains: [                              │     │
│     │     "https://partner-website.com",               │     │
│     │     "https://*.partner-website.com"              │     │
│     │   ]                                              │     │
│     │ }                                                │     │
│     │                                                  │     │
│     │ If empty [] = no restrictions                    │     │
│     └─────────────────────────────────────────────────┘     │
│                           OR                                 │
│  2️⃣ Global Level (system-wide defaults)                     │
│     ┌─────────────────────────────────────────────────┐     │
│     │ Hardcoded in lib/partner/auth.ts:                │     │
│     │ - https://sarastores.com                         │     │
│     │ - https://saramobiles.com                        │     │
│     │ - http://localhost:3000                          │     │
│     │ - http://localhost:3001                          │     │
│     │                                                  │     │
│     │ Plus PARTNER_ALLOWED_ORIGINS env var:            │     │
│     │ - https://*.vercel.app                           │     │
│     │ - [custom domains added here]                    │     │
│     └─────────────────────────────────────────────────┘     │
│                                                               │
│  3️⃣ No Origin Header (server-to-server)                     │
│     ┌─────────────────────────────────────────────────┐     │
│     │ If request has no Origin header:                │     │
│     │ ✅ Always allowed (server-side request)          │     │
│     └─────────────────────────────────────────────────┘     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Wildcard Matching Examples

```
Pattern: https://*.example.com

✅ Matches:
  - https://app.example.com
  - https://staging.example.com
  - https://dev.staging.example.com
  - https://example.com (base domain)

❌ Does NOT match:
  - https://example.org
  - https://example.com.evil.com
  - http://app.example.com (different protocol)

Pattern: http://localhost:*

✅ Matches:
  - http://localhost:3000
  - http://localhost:3001
  - http://localhost:8080

❌ Does NOT match:
  - https://localhost:3000 (different protocol)
  - http://127.0.0.1:3000 (different host)
```

## Solution Comparison

### ❌ Current Problem (Browser Direct Call)

```
┌──────────────┐              ┌────────────────┐
│   Partner    │              │   ByteWise     │
│   Browser    │─────❌───────│   Partner API  │
│  JavaScript  │   CORS       │                │
└──────────────┘   Error      └────────────────┘

Issues:
- API key exposed in browser
- CORS configuration needed
- Rate limiting harder to control
```

### ✅ Solution 1: Add Domain to Whitelist

```
┌──────────────┐              ┌────────────────┐
│   Partner    │              │   ByteWise     │
│   Browser    │─────✅───────│   Partner API  │
│  JavaScript  │   Allowed    │                │
└──────────────┘              └────────────────┘

Pros:
+ Quick to implement
+ Works for browser apps

Cons:
- API key still exposed
- Need to manage domains
- Less secure
```

### ✅ Solution 2: Partner Server Proxy (Recommended)

```
┌──────────────┐    ┌─────────────┐    ┌────────────────┐
│   Partner    │    │   Partner   │    │   ByteWise     │
│   Browser    │───>│   Server    │───>│   Partner API  │
│  JavaScript  │    │   API       │    │                │
└──────────────┘    └─────────────┘    └────────────────┘
  No CORS           No CORS             No CORS
  No API Key        API Key Secure      Server-to-Server

Pros:
+ API key stays secure on server
+ No CORS issues
+ Can add caching
+ Better rate limit control
+ Can transform data
+ More professional

Cons:
- Requires partner dev work
- Extra server hop (minimal latency)
```

## Environment Configuration

```
Development (.env.local)
┌──────────────────────────────────────────────────┐
│ PARTNER_ALLOWED_ORIGINS=                         │
│   http://localhost:3000,                         │
│   http://localhost:3001,                         │
│   https://*.vercel.app,                          │
│   https://partner-domain.com                     │
└──────────────────────────────────────────────────┘
         │
         │ npm run dev
         ▼
┌──────────────────────────────────────────────────┐
│ Local Development Server                         │
│ http://localhost:3000                            │
└──────────────────────────────────────────────────┘


Production (Vercel)
┌──────────────────────────────────────────────────┐
│ Vercel Dashboard > Environment Variables         │
│                                                   │
│ PARTNER_ALLOWED_ORIGINS =                        │
│   https://*.vercel.app,                          │
│   https://partner-domain.com,                    │
│   https://www.partner-domain.com                 │
└──────────────────────────────────────────────────┘
         │
         │ git push / vercel deploy
         ▼
┌──────────────────────────────────────────────────┐
│ Production Server                                 │
│ https://ecom-bytewise.vercel.app                 │
└──────────────────────────────────────────────────┘
```

## Summary

🎯 **Your system is already CORS-ready!**

All you need to do:
1. Ask partner for their domain(s)
2. Add to `PARTNER_ALLOWED_ORIGINS` (dev + prod)
3. Redeploy
4. ✅ Done!

Or better yet, recommend they use server-side calls and skip CORS entirely! 🚀
