"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import VendorSidebar from "@/components/VendorSidebar"
import { Menu } from "lucide-react"

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, isVendor, isLoading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || !isVendor)) {
      router.push("/login")
    }
  }, [user, isVendor, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user || !isVendor) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <VendorSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm z-10 lg:hidden">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-xl font-semibold">Vendor Panel</h2>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">{children}</main>
      </div>
    </div>
  )
}
