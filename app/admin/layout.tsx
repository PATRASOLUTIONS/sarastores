import type React from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import AdminClientShell from "./admin-client-shell"
import { pageMetadata } from "@/lib/seo-page"

export const generateMetadata = pageMetadata({
  path: "/admin", title: brand => `Administration | ${brand}`,
  description: "Private administration area. Sign in with an authorised SARA staff account.",
  noIndex: true,
})

// Session must be read per request, never prerendered or cached.
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authoritative server-side gate. The client shell only handles per-page
  // granularity for staff accounts; it cannot be the security boundary because
  // an anonymous visitor would otherwise receive the full admin HTML.
  const session = await getSession()

  if (!session?.user) {
    redirect("/login?redirect=/admin")
  }

  const { role, dashboardAccess } = session.user as {
    role?: string
    dashboardAccess?: boolean
  }
  const isAdmin = role === "admin" || role === "superadmin"

  if (!isAdmin && dashboardAccess !== true) {
    redirect("/")
  }

  return <AdminClientShell>{children}</AdminClientShell>
}
