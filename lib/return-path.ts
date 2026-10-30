/** Same-origin path to resume after login. Rejects off-site and auth-page targets. */
import { staffCanAccessPage, staffLandingPage } from "@/lib/admin-access"

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

export const LAST_VISITED_PATH = "lastVisitedBeforeLogin"

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /^https?:/i.test(path)) return null
  // Browsers strip embedded tabs/newlines and resolve dot segments before
  // navigating. Validate that same destination before checking page access.
  if (/[\u0000-\u001F\u007F]/.test(path)) return null
  const base = "https://return-path.invalid"
  const destination = new URL(path, base)
  if (destination.origin !== base) return null
  const pathname = destination.pathname
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null
  return `${pathname}${destination.search}${destination.hash}`
}

export function loginHref(pathname: string, search = ""): string {
  const path = safeReturnPath(`${pathname}${search}`)
  return path ? `/login?redirect=${encodeURIComponent(path)}` : "/login"
}

type ReturnUser = { role?: string; dashboardAccess?: boolean; allowedPages?: string[] }

export function destinationAfterLogin(user: ReturnUser, requested: string | null | undefined): string {
  const staff = user.role === "admin" || user.role === "superadmin" || user.dashboardAccess === true
  const vendor = user.role === "vendor" || staff
  let path = safeReturnPath(requested)
  if (path?.startsWith("/admin") && !staff) path = null
  if (path && (path === "/admin" || path.startsWith("/admin/")) && !staffCanAccessPage(user, path.split(/[?#]/)[0])) path = null
  if (path?.startsWith("/vendor") && !vendor) path = null
  if (path) return path
  if (staff) return staffLandingPage(user)
  if (user.role === "vendor") return "/vendor/dashboard"
  return "/dashboard"
}
