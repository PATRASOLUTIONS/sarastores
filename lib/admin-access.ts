const API_PAGE_ACCESS: [string, string | string[]][] = [
  ["/api/admin/dashboard", "/admin/dashboard"],
  ["/api/admin/taxonomy", "/admin/catalogue"],
  ["/api/admin/image-coverage", "/admin/image-coverage"],
  ["/api/admin/features", "/admin/features"],
  ["/api/admin/external-orders", "/admin/external-orders"],
  ["/api/admin/partners", "/admin/partners"],
  ["/api/admin/partner-commissions", "/admin/partner-payouts"],
  ["/api/admin/payouts", "/admin/partner-payouts"],
  ["/api/admin/campaign-pages", ["/admin/campaign-pages", "/admin/super-sunday"]],
  ["/api/admin/email-templates", "/admin/customer-centric/templates"],
  ["/api/admin/segments", "/admin/customer-centric"],
  ["/api/admin/campaign-history", "/admin/customer-centric"],
  ["/api/admin/campaign-recipients", "/admin/customer-centric"],
  ["/api/admin/send-campaign", "/admin/customer-centric"],
  ["/api/admin/marketing", "/admin/customer-centric"],
  ["/api/admin/retention", "/admin/customer-centric"],
  ["/api/orders/bulk-update", "/admin/orders/bulk-update"],
  ["/api/products/specifications", "/admin/product-specifications"],
  ["/api/marketing-content", "/admin/marketing"],
  ["/api/header-promotions", "/admin/super-sunday"],
  ["/api/listing-banners", ["/admin/listing-banners", "/admin/division-promotions"]],
  ["/api/theme", "/admin/theme"],
  ["/api/advertisements", "/admin/advertisements"],
  ["/api/animated-banner", "/admin/advertisements"],
  ["/api/product-slides", "/admin/product-advertisements"],
  ["/api/software-licenses", "/admin/software"],
  ["/api/admin/assign-missing-licenses", "/admin/software"],
  ["/api/scrape", "/admin/scraper"],
  ["/api/media/upload", ["/admin/products", "/admin/scraper", "/admin/marketing", "/admin/division-promotions", "/admin/listing-banners", "/admin/product-advertisements", "/admin/advertisements", "/admin/campaign-pages", "/admin/articles", "/admin/posters"]],
  ["/api/spin-wheel/admin/campaigns", "/admin/spin-wheel/campaigns"],
  ["/api/admin/store-qr/analytics", "/admin/store-qr/analytics"],
  ["/api/admin/sara-care", "/admin/sara-care"],
  ["/api/admin/store-locations", "/admin/store-locations"],
  ["/api/admin/store-stock", "/admin/stock-check"],
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
  ["/api/admin/gifts", "/admin/gifts"],
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

const READ_PAGE_ACCESS: [string, string[]][] = [
  ["/api/admin/taxonomy", ["/admin/catalogue", "/admin/products", "/admin/product-specifications", "/admin/scraper"]],
  ["/api/admin/store-locations", ["/admin/stock-check", "/admin/store-qr", "/admin/store-qr/analytics", "/admin/lucky-draw", "/admin/orders"]],
  ["/api/admin/gifts", ["/admin/promotions"]],
]
type AccessUser = { role?: string; dashboardAccess?: boolean; allowedPages?: string[] }
export function staffCanAccessPage(user: AccessUser, path: string): boolean {
  if (user.role === "admin" || user.role === "superadmin") return true
  if (!user.dashboardAccess) return false
  return !!user.allowedPages?.some(page => page.startsWith("/admin") &&
    (path === page || path.startsWith(`${page}/`)))
}
export function staffLandingPage(user: AccessUser): string {
  if (staffCanAccessPage(user, "/admin/dashboard")) return "/admin/dashboard"
  return user.dashboardAccess ? user.allowedPages?.find(page => /^\/admin\/[a-zA-Z0-9/_-]+$/.test(page)) || "/" : "/"
}

export function staffCanAccessApi(
  user: { role: string; dashboardAccess?: boolean; allowedPages?: string[] },
  path: string,
  method = "GET",
): boolean {
  if (user.role === "admin" || user.role === "superadmin") return true
  if (!user.dashboardAccess) return false
  if (path === "/api/admin/notifications" && (method === "GET" || method === "HEAD")) {
    return !!user.allowedPages?.some(page => /^\/admin\/[a-zA-Z0-9/_-]+$/.test(page) || page === "/admin")
  }
  const matches = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
  const requiredPage = [...API_PAGE_ACCESS].sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => matches(prefix))?.[1]
  if (requiredPage && (Array.isArray(requiredPage) ? requiredPage : [requiredPage])
    .some(page => staffCanAccessPage(user, page))) return true
  return (method === "GET" || method === "HEAD") && READ_PAGE_ACCESS.some(([prefix, pages]) =>
    matches(prefix) && pages.some(page => staffCanAccessPage(user, page)))
}
