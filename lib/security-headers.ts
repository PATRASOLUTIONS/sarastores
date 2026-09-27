/**
 * Security Headers Configuration
 *
 * NOTE: This module is unused — the authoritative security headers are
 * defined inline in `next.config.mjs` via the `headers()` export. This
 * file is kept for reference only and can be safely removed.
 *
 * Comprehensive security headers for the e-commerce platform.
 * Apply these headers via middleware or next.config.js
 */

export interface SecurityHeaderConfig {
  key: string;
  value: string;
}

/**
 * Content Security Policy configuration
 */
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    'https://*.google.com',
    'https://*.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.razorpay.com',
    'https://*.facebook.net',
    'https://checkout.razorpay.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
    'https://*.googleapis.com',
    'https://*.googleusercontent.com',
    'https://*.firebaseio.com',
    'https://firebasestorage.googleapis.com',
  ],
  'font-src': [
    "'self'",
    'data:',
    'https://fonts.gstatic.com',
  ],
  'connect-src': [
    "'self'",
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://firestore.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'wss://*.firebaseio.com',
    'https://*.razorpay.com',
    'https://api.razorpay.com',
    'https://lux.razorpay.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.shiprocket.in',
  ],
  'frame-src': [
    "'self'",
    'https://*.razorpay.com',
    'https://api.razorpay.com',
    'https://*.youtube.com',
    'https://*.google.com',
  ],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP string from directives
 */
function buildCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * All security headers
 */
export const securityHeaders: SecurityHeaderConfig[] = [
  // DNS Prefetch Control
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  
  // Strict Transport Security (HSTS)
  // Forces HTTPS for 2 years, includes subdomains, allows preload
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  
  // X-Frame-Options
  // Prevents clickjacking by not allowing site to be framed
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  
  // X-Content-Type-Options
  // Prevents MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  
  // X-XSS-Protection
  // Legacy XSS protection (modern browsers use CSP instead)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  
  // Referrer Policy
  // Controls how much referrer info is sent
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  
  // Permissions Policy (formerly Feature Policy)
  // Controls browser features
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=(self)',
      'interest-cohort=()',
      'payment=(self "https://api.razorpay.com")',
      'usb=()',
      'bluetooth=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '),
  },
  
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: buildCSP(CSP_DIRECTIVES),
  },
  
  // Cross-Origin-Embedder-Policy
  // Required for SharedArrayBuffer (optional based on needs)
  // {
  //   key: 'Cross-Origin-Embedder-Policy',
  //   value: 'require-corp',
  // },
  
  // Cross-Origin-Opener-Policy
  // Isolates browsing context
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  
  // Cross-Origin-Resource-Policy
  // Controls resource loading
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'cross-origin',
  },
];

/**
 * Get security headers as an object (for middleware)
 */
export function getSecurityHeadersObject(): Record<string, string> {
  return securityHeaders.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Apply security headers to a Response
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  for (const { key, value } of securityHeaders) {
    headers.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Security headers for next.config.js
 */
export const nextConfigSecurityHeaders = securityHeaders.map(({ key, value }) => ({
  key,
  value,
}));

/**
 * Get headers config for next.config.js
 */
export function getNextConfigHeaders() {
  return [
    {
      // Apply to all routes
      source: '/:path*',
      headers: nextConfigSecurityHeaders,
    },
  ];
}

/**
 * Report-Only CSP for testing (doesn't block, just reports)
 */
export function getReportOnlyCSP(reportUri: string): SecurityHeaderConfig {
  const reportDirectives = {
    ...CSP_DIRECTIVES,
    'report-uri': [reportUri],
  };
  
  return {
    key: 'Content-Security-Policy-Report-Only',
    value: buildCSP(reportDirectives),
  };
}

/**
 * API-specific security headers (less restrictive CSP for JSON responses)
 */
export const apiSecurityHeaders: SecurityHeaderConfig[] = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
  },
  {
    key: 'Pragma',
    value: 'no-cache',
  },
  {
    key: 'Expires',
    value: '0',
  },
];

/**
 * Apply API security headers to a Response
 */
export function applyApiSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  for (const { key, value } of apiSecurityHeaders) {
    headers.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  securityHeaders,
  getSecurityHeadersObject,
  applySecurityHeaders,
  nextConfigSecurityHeaders,
  getNextConfigHeaders,
  getReportOnlyCSP,
  apiSecurityHeaders,
  applyApiSecurityHeaders,
};
