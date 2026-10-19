import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { pageMetadata } from "@/lib/seo-page"
import VendorClientShell from "./vendor-client-shell"

export const generateMetadata = pageMetadata({
  path: "/vendor", title: brand => `Vendor Portal | ${brand}`,
  description: "Private SARA vendor portal for managing your product catalogue.",
  noIndex: true,
})

// Reads the session cookie, so it can never be prerendered at build time.
export const dynamic = "force-dynamic"

// Mirrors requireVendor() in lib/auth.ts so the portal and the APIs behind it
// agree on who a vendor is.
const VENDOR_ROLES = new Set(["vendor", "admin", "superadmin"])

export default async function VendorLayout({ children }: { children: ReactNode }) {
  // Authoritative check against the signed httpOnly cookie, before any markup
  // is produced. The previous client-only gate shipped the portal shell to
  // anonymous visitors and only redirected after hydration.
  const session = await getSession()

  if (!session?.user) {
    redirect("/login?redirect=/vendor")
  }
  if (!VENDOR_ROLES.has(session.user.role)) {
    redirect("/")
  }

  return <VendorClientShell>{children}</VendorClientShell>
}
