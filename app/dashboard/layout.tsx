import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import AccountSidebar from "@/components/account/AccountSidebar"
import AccountBreadcrumb from "@/components/account/AccountBreadcrumb"
import TrustStrip from "@/components/account/TrustStrip"
import { getSession } from "@/lib/auth"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Server-side authoritative auth check using the signed httpOnly session
  // cookie. This is the source of truth — it works in both localhost and
  // production because it does not depend on hydration timing or localStorage.
  const session = await getSession()

  if (!session?.user) {
    // Preserve the originally requested URL so the user lands back here
    // after logging in.
    redirect("/login?redirect=/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-grow">
        <div className="section-container space-y-4 py-4">
          <AccountBreadcrumb />
          <div className="grid items-start gap-5 lg:grid-cols-[236px_minmax(0,1fr)]">
            <AccountSidebar />
            <div className="min-w-0 space-y-5">{children}</div>
          </div>
          <TrustStrip />
        </div>
      </main>
      <Footer />
    </div>
  )
}
