"use client"

import type React from "react"

import { useState } from "react"
import VendorSidebar from "@/components/VendorSidebar"
import { Menu } from "lucide-react"

// Presentation only. The vendor role is enforced in app/vendor/layout.tsx
// before this renders, and again by requireVendor() on every vendor API route.
export default function VendorClientShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
