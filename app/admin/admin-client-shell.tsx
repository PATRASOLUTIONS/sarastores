"use client"

import { useState, useEffect } from "react"
import type React from "react"
import AdminSidebar from "@/components/AdminSidebar"
import { AdminHeader } from "@/components/AdminHeader"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import { staffCanAccessPage, staffLandingPage } from "@/lib/admin-access"

export default function AdminClientShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    // Track previous mobile state locally so we only close the sidebar
    // when the viewport actually transitions from desktop -> mobile.
    let prevMobile = window.innerWidth < 1024

    const onResize = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)

      // If we just switched from desktop -> mobile, close the sidebar
      if (mobile && !prevMobile) {
        setIsSidebarOpen(false)
      }

      prevMobile = mobile
    }

    // Initial check
    onResize()

    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Per-page granularity for staff accounts. Role and dashboardAccess are
  // already enforced server-side by the layout before this renders.
  useEffect(() => {
    if (!pathname) return
    if (!pathname.startsWith("/admin")) return
    if (!user) return

    const role = user.role
    if (role === "admin" || role === "superadmin") {
      return
    }

    const dashboardAccess = user.dashboardAccess === true
    if (!dashboardAccess) {
      toast.error("You don't have dashboard access. Redirecting to home.")
      router.replace("/")
      return
    }

    const ok = staffCanAccessPage(user, pathname)
    if (!ok) {
      toast.error("You don't have access to this page.")
      router.replace(staffLandingPage(user))
    }
  }, [pathname, user, router])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <AdminHeader toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        {/* Add left margin on large screens to account for the fixed sidebar width */}
        <div className="flex-1 overflow-auto lg:ml-64">
          <main className="p-4">{children}</main>
        </div>
      </div>
    </div>
  )
}
