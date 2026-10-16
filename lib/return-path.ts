/** Same-origin path to resume after login. Rejects off-site and auth-page targets. */

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /^https?:/i.test(path)) return null
  const pathname = path.split(/[?#]/)[0]
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null
  return path
}

export function loginHref(pathname: string, search = ""): string {
  const path = safeReturnPath(`${pathname}${search}`)
  return path ? `/login?redirect=${encodeURIComponent(path)}` : "/login"
}

type ReturnUser = { role?: string; dashboardAccess?: boolean }

export function destinationAfterLogin(user: ReturnUser, requested: string | null | undefined): string {
  const staff = user.role === "admin" || user.role === "superadmin" || user.dashboardAccess === true
  const vendor = user.role === "vendor" || staff
  let path = safeReturnPath(requested)
  if (path?.startsWith("/admin") && !staff) path = null
  if (path?.startsWith("/vendor") && !vendor) path = null
  if (path) return path
  if (staff) return "/admin/dashboard"
  if (user.role === "vendor") return "/vendor/dashboard"
  return "/dashboard"
}
