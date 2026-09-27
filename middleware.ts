import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

const API_PAGE_ACCESS: [string, string][] = [
  ["/api/admin/store-locations", "/admin/store-locations"],
  ["/api/admin/store-qr", "/admin/store-qr"],
  ["/api/admin/lucky-draw", "/admin/lucky-draw"],
  ["/api/spin-wheel/admin", "/admin/spin-wheel"],
  ["/api/sub-categories", "/admin/catalogue"],
  ["/api/categories", "/admin/catalogue"],
  ["/api/brands", "/admin/catalogue"],
  ["/api/product-specifications", "/admin/product-specifications"],
  ["/api/product-advertisements", "/admin/product-advertisements"],
  ["/api/scraped-products", "/admin/scraper"],
  ["/api/scrape-amazon", "/admin/scraper"],
  ["/api/products", "/admin/products"],
  ["/api/orders", "/admin/orders"],
  ["/api/payments", "/admin/payments"],
  ["/api/coupons", "/admin/promotions"],
  ["/api/employees", "/admin/employees"],
  ["/api/leads", "/admin/leads"],
  ["/api/contact-inquiries", "/admin/contact-inquiries"],
  ["/api/complaints", "/admin/complaints"],
  ["/api/hero-slides", "/admin/posters"],
  ["/api/posters", "/admin/posters"],
  ["/api/home-components", "/admin/home-components"],
  ["/api/settings", "/admin/settings"],
  ["/api/software", "/admin/software"],
  ["/api/blocked-pincodes", "/admin/blocked-pincodes"],
  ["/api/articles", "/admin/articles"],
]

function staffCanAccessApi(user: { role: string; dashboardAccess: boolean; allowedPages: string[] }, path: string) {
  if (user.role === "admin" || user.role === "superadmin") return true
  if (!user.dashboardAccess) return false
  const requiredPage = API_PAGE_ACCESS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1]
  if (!requiredPage) return true
  return user.allowedPages.some((page) => page === requiredPage || requiredPage.startsWith(`${page}/`))
}

export async function middleware(request: NextRequest) {
  // Skip middleware for partner API routes - they have their own CORS and auth handling
  if (request.nextUrl.pathname.startsWith("/api/v1/partner")) {
    return NextResponse.next()
  }

  // Native auth endpoints issue and rotate the tokens themselves, so they must
  // be reachable without one. Each handler validates its own input.
  if (request.nextUrl.pathname.startsWith("/api/v1/auth")) {
    return NextResponse.next()
  }

  // CORS preflight carries no credentials, so authorizing it is meaningless and
  // only blocks the real request that follows. Dev-only: production native
  // clients never send a preflight.
  if (request.method === "OPTIONS" && process.env.NODE_ENV !== "production") {
    return NextResponse.next()
  }

  // Skip middleware for error page itself and static files
  // if (
  //   request.nextUrl.pathname === "/error" ||
  //   request.nextUrl.pathname.startsWith("/_next") ||
  //   request.nextUrl.pathname.startsWith("/api/") ||
  //   request.nextUrl.pathname.includes("/images/") ||
  //   request.nextUrl.pathname.includes("/fonts/")
  // ) {
  //   return NextResponse.next()
  // }

  // return NextResponse.redirect(new URL("/error", request.url))
  // }
  
  if (process.env.NODE_ENV === "development") {
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`)
  }

  // Get user from the signed, httpOnly session cookie (tamper-proof), or from
  // an `Authorization: Bearer` access token when the caller is a mobile app.
  // The legacy plaintext `user` cookie is NEVER trusted for authorization.
  const authorization = request.headers.get("authorization")
  const bearerToken =
    authorization && authorization.slice(0, 7).toLowerCase() === "bearer "
      ? authorization.slice(7).trim()
      : undefined
  const sessionToken = bearerToken || request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySessionToken(sessionToken)
  const user = session
    ? {
        role: session.role,
        dashboardAccess: session.dashboardAccess ?? false,
        allowedPages: session.allowedPages ?? [],
      }
    : null

  // Lightweight debug log for write attempts that get rejected, so the
  // "I am admin but the API says 401" class of bug is easy to diagnose
  // in production logs without having to repro locally.
  if (!user && process.env.NODE_ENV === "production" && request.method !== "GET") {
    const hasCookie = !!request.cookies.get(SESSION_COOKIE)
    console.warn(
      `[Middleware] ${request.method} ${request.nextUrl.pathname} denied: ` +
        `no session. session_cookie_present=${hasCookie} ` +
        `cookie_keys=${request.cookies.getAll().map((c) => c.name).join(",")}`,
    )
  }

  // Central protection for ALL admin APIs. This is defense-in-depth only:
  // it is prefix-based and silently misses new paths, so every handler must
  // still call requireAdmin()/checkAdminAuthorization() itself.
  // Note: a user granted dashboardAccess after logging in carries a stale
  // token and must re-authenticate to pass this check.
  if (
    request.nextUrl.pathname.startsWith("/api/admin") ||
    request.nextUrl.pathname.startsWith("/api/spin-wheel/admin")
  ) {
    if (!user) {
      console.warn(
        `[Middleware] Admin API ${request.method} ${request.nextUrl.pathname} blocked: no session. ` +
          `session_cookie_present=${!!sessionToken}`
      )
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    if (user.role !== "admin" && user.role !== "superadmin" && !user.dashboardAccess) {
      console.warn(
        `[Middleware] Admin API ${request.method} ${request.nextUrl.pathname} blocked: insufficient role`
      )
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    if (!staffCanAccessApi(user, request.nextUrl.pathname)) {
      return NextResponse.json({ error: "You do not have access to this admin area" }, { status: 403 })
    }
    return NextResponse.next()
  }

  // ---- Central role-based API authorization (by path + method) ----
  // Keeps storefront GETs public while requiring the right role for writes
  // and for sensitive data. This is the single place that secures the long
  // tail of catalog/content/license/vendor endpoints.
  {
    const path = request.nextUrl.pathname
    const method = request.method
    const isWrite =
      method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE"
    const isAdminUser =
      !!user && (user.role === "admin" || user.role === "superadmin" || user.dashboardAccess)
    const isVendorUser =
      !!user && (user.role === "vendor" || user.role === "admin" || user.role === "superadmin")
    const matches = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
    const deny = (status: number, error: string) => NextResponse.json({ error }, { status })

    // Staff accounts must hold the corresponding page permission for protected
    // reads and all writes. Full admins remain unrestricted, and ordinary
    // customers are not staff — gating them here blocked every logged-in
    // shopper from add-to-cart, checkout and reviews.
    if (
      user &&
      user.role !== "admin" &&
      user.role !== "superadmin" &&
      user.dashboardAccess &&
      (isWrite || matches("/api/employees") || (matches("/api/orders") && method === "GET")) &&
      !staffCanAccessApi(user, path)
    ) {
      return deny(403, "You do not have access to this admin area")
    }

    // Vendor APIs: any authenticated vendor (admins allowed too)
    if (matches("/api/vendor")) {
      if (!isVendorUser) return deny(403, "Vendor access required")
      return NextResponse.next()
    }

    // Anonymous telemetry sinks: guests must be able to report funnel events and
    // Core Web Vitals. Both are allow-listed and rate limited in their handlers.
    if ((path === "/api/events" || path === "/api/vitals") && method === "POST") {
      return NextResponse.next()
    }

    // The storefront lead form reads its own config and submits leads while
    // logged out; everything else about leads is admin-only.
    if (path === "/api/leads/settings" && method === "GET") return NextResponse.next()
    if (path === "/api/leads" && method === "POST") return NextResponse.next()

    // Admin-only for ALL methods: sensitive data, tooling, full exports
    const adminAll = [
      "/api/software-licenses",
      "/api/software/license-keys",
      "/api/scraped-products",
      "/api/leads/settings",
      "/api/leads/export",
    ]
    if (
      adminAll.some(matches) ||
      path === "/api/products/export" ||
      path === "/api/products/specifications/export"
    ) {
      if (!isAdminUser) return deny(401, "Admin access required")
      return NextResponse.next()
    }

    // Admin order operations (bulk import/update, license assignment). Regular
    // checkout (POST /api/orders) and order lookup keep their own per-route auth.
    if (
      isWrite &&
      (matches("/api/orders/bulk-upload") ||
        matches("/api/orders/bulk-update") ||
        (path.startsWith("/api/orders/") && path.endsWith("/assign-license")))
    ) {
      if (!isAdminUser) return deny(401, "Admin access required")
      return NextResponse.next()
    }

    // Coupons: validate/redeem are customer-facing; create/update/delete are admin.
    if (isWrite && matches("/api/coupons")) {
      const customerFacing = path === "/api/coupons/validate" || path === "/api/coupons/redeem"
      if (!customerFacing) {
        if (!isAdminUser) return deny(401, "Admin access required")
        return NextResponse.next()
      }
    }

    // Reviews: public to read, but must be logged in to write
    if (isWrite && matches("/api/reviews")) {
      if (!user) return deny(401, "Authentication required")
      return NextResponse.next()
    }

    // Admin-only for WRITES (GET stays public): catalog & site content
    // /api/products/bulk is excluded — it's used by the customer-facing compare page
    const adminWrite = [
      "/api/products",
      "/api/offers",
      "/api/offer-products",
      "/api/sub-categories",
      "/api/product-advertisements",
      "/api/product-slides",
      "/api/split-cards",
      "/api/testimonials",
      "/api/software",
      "/api/scrape-amazon",
      "/api/settings",
      "/api/categories",
      "/api/hero-slides",
      "/api/home-components",
      "/api/brands",
      "/api/notifications",
      "/api/advertisements",
      "/api/animated-banner",
      "/api/blocked-pincodes",
      "/api/footer",
      "/api/employees",
      "/api/leads",
      "/api/contact-inquiries",
      "/api/articles",
      "/api/theme",
      "/api/posters",
      "/api/listing-banners",
    ]
    if (isWrite && adminWrite.some(matches)) {
      // /api/products/bulk POST is public (used by compare page)
      if (path === "/api/products/bulk") return NextResponse.next()
      // Employee ID check runs at in-store checkout, before the customer logs in.
      if (path === "/api/employees/validate") return NextResponse.next()
      // Public submission forms.
      if (path === "/api/contact-inquiries" && method === "POST") return NextResponse.next()
      if (!isAdminUser) return deny(401, "Admin access required")
      return NextResponse.next()
    }
  }

  // Admin page access is enforced by the client-side admin layout. Keep the
  // middleware focused on API authorization so hard navigations to admin pages
  // do not get bounced with a 307 before the layout can hydrate.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const isFullAdmin = user?.role === "admin" || user?.role === "superadmin"
    if (user && !isFullAdmin && user.dashboardAccess) {
      const allowed = Array.isArray(user.allowedPages) && user.allowedPages.length > 0
        ? user.allowedPages
        : ["/admin/dashboard"]
      const permitted = allowed.some(
        (page) => request.nextUrl.pathname === page || request.nextUrl.pathname.startsWith(`${page}/`),
      )
      if (!permitted) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url))
      }
    }

    // Always let HTML (and RSC) requests through to the admin layout. The
    // admin layout performs the authoritative, server-side check against
    // the signed httpOnly session cookie. The middleware role here is
    // limited to API authorization above, not page gating, because:
    //   1. HTML navigations and Next.js RSC fetches both carry the
    //      authoritative session cookie, so the layout can verify it.
    //   2. Trying to redirect at the middleware level creates a race with
    //      the in-flight request, especially on production where cookie
    //      propagation can be delayed, and has historically bounced
    //      legitimate admin users back to the home page.
    if (request.method === "GET") {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Partner API test page: admin-only
  if (request.nextUrl.pathname.startsWith("/partner-api-test")) {
    if (!user || (user.role !== "admin" && user.role !== "superadmin" && !user.dashboardAccess)) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return NextResponse.next()
  }

  // Vendor route protection. Same rationale as admin: the vendor layout
  // (when present) is the authoritative gate. We only block non-HTML
  // requests to prevent vendor API abuse.
  if (request.nextUrl.pathname.startsWith("/vendor")) {
    // Skip middleware for static files
    if (
      request.nextUrl.pathname.includes("/_next") ||
      request.nextUrl.pathname.includes("/api/") ||
      request.nextUrl.pathname.includes("/images/") ||
      request.nextUrl.pathname.includes("/fonts/")
    ) {
      return NextResponse.next()
    }

    if (!user || user.role !== "vendor") {
      const isHtml = request.headers.get("accept")?.includes("text/html")
      if (request.method === "GET" && isHtml) {
        return NextResponse.next()
      }
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // /dashboard and /account: let all requests through. The server-component
  // layout for each route performs the authoritative `getSession()` check
  // and redirects via `redirect()` from `next/navigation`. This avoids a
  // double-redirect race between the middleware (which can only see the
  // cookie at request time) and the layout (which runs after the request
  // resolves and can reliably read the httpOnly session cookie). The
  // middleware historically caused logged-in users on production to be
  // bounced back to "/" when navigating to sub-pages like
  // /dashboard/orders or /account/orders, while the landing page worked
  // — this is because the landing page was rendered via the layout, but
  // sub-page RSC fetches tripped the middleware redirect path.
  if (
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/account")
  ) {
    return NextResponse.next()
  }

  // Continue to the requested resource
  return NextResponse.next()
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    // Apply to all admin routes
    "/admin/:path*",
    // Apply to customer account routes
    "/account/:path*",
    // Apply to all vendor routes
    "/vendor/:path*",
    // Apply to all dashboard routes
    "/dashboard/:path*",
    // Apply to partner API test page
    "/partner-api-test",
    // Apply to all API routes (partner routes early-return inside the handler).
    // Centralizes authorization for admin/vendor/user-scoped endpoints.
    "/api/:path*",
  ],
}
