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

export function staffCanAccessApi(
  user: { role: string; dashboardAccess?: boolean; allowedPages?: string[] },
  path: string,
): boolean {
  if (user.role === "admin" || user.role === "superadmin") return true
  if (!user.dashboardAccess) return false
  const requiredPage = API_PAGE_ACCESS.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  )?.[1]
  return !!requiredPage && !!user.allowedPages?.some(
    (page) => page === requiredPage || requiredPage.startsWith(`${page}/`),
  )
}
