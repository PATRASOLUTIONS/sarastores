/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next spawns one static-generation worker per CPU by default, which exhausts
  // memory on smaller build machines. Override with NEXT_BUILD_CPUS if needed.
  experimental: {
    cpus: Number(process.env.NEXT_BUILD_CPUS) || 2,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Image Optimization
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // A trailing `hostname: "**"` used to sit at the end of remotePatterns,
    // which let any host through the optimizer and turned it into an open
    // image proxy. Add real hosts here instead of restoring the wildcard.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.gstatic.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "via.placeholder.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "static.wixstatic.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.blob.core.windows.net" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.vercel-storage.com" },
      // Product-source CDNs the scrapers return URLs from. Without these,
      // next/image rejects every scraped image with a 400.
      { protocol: "https", hostname: "**.flixcart.com" },
      { protocol: "https", hostname: "**.jiostore.online" },
      { protocol: "https", hostname: "**.fynd.com" },
      { protocol: "https", hostname: "**.bsh-group.com" },
      { protocol: "https", hostname: "**.bosch-home.com" },
      { protocol: "https", hostname: "**.paiinternational.in" },
      { protocol: "https", hostname: "**.vijaysales.com" },
      { protocol: "https", hostname: "www.lg.com" },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  compress: true,

  // Security Headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'

    // In development, Next.js loads scripts via webpack HMR from /_next/static/
    // without nonces, so strict-dynamic blocks them entirely. Only apply the
    // hardened CSP in production; dev uses a relaxed script-src to keep HMR alive.
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googletagmanager.com https://*.google-analytics.com https://*.razorpay.com https://*.facebook.net https://*.clarity.ms https://checkout.razorpay.com https://va.vercel-scripts.com https://vercel.live"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googletagmanager.com https://*.google-analytics.com https://*.razorpay.com https://*.facebook.net https://*.clarity.ms https://checkout.razorpay.com https://va.vercel-scripts.com https://vercel.live"

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Marketing tags beacon over fetch/XHR, not just <img>. Omitting a host here
      // fails silently in production only — dev has no CSP, so it looks fine locally.
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com https://*.razorpay.com https://api.razorpay.com https://lux.razorpay.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.facebook.com https://*.facebook.net https://*.clarity.ms https://c.bing.com https://*.shiprocket.in https://vercel.live",
      "frame-src 'self' https://*.razorpay.com https://api.razorpay.com https://*.youtube.com https://*.google.com https://*.googletagmanager.com",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      // Only force HTTPS upgrades in production. On http://localhost this
      // directive rewrites every asset request to https and breaks them.
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // HSTS only matters over HTTPS; skip it in local dev.
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://api.razorpay.com"), interest-cohort=()' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  serverExternalPackages: [
    "mongodb",
    "node-cron",
    "@mongodb-js/zstd",
    "@mongodb-js/zstd-win32-x64-msvc",
    "aws4",
    "snappy",
    "kerberos",
    "mongodb-client-encryption"
  ],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        'mongodb': false,
        'node-cron': false,
        '@mongodb-js/zstd': false,
        '@mongodb-js/zstd-win32-x64-msvc': false,
        'aws4': false,
        'snappy': false,
        'kerberos': false,
        'mongodb-client-encryption': false,
        'gcp-metadata': false,
        'socks': false,
      }

      config.resolve.alias = {
        ...config.resolve.alias,
        'mongodb': false,
        'node-cron': false,
        '@mongodb-js/zstd': false,
        'aws4': false,
        'snappy': false,
      }
    }
    return config
  },
}

export default nextConfig
