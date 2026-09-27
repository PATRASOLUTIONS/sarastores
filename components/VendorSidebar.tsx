"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { LayoutDashboard, ShoppingBag, LogOut, ChevronLeft, Package } from "lucide-react"
import { useState, useEffect } from "react"

export default function VendorSidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [isLaptopCollapsed, setIsLaptopCollapsed] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`)
  }

  const menuItems = [
    {
      name: "Dashboard",
      path: "/vendor/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: "My Products",
      path: "/vendor/products",
      icon: <ShoppingBag className="h-5 w-5" />,
    },
  ]

  const handleLogout = () => {
    logout()
  }

  const handleLinkClick = () => {
    if (isMobile) {
      setIsOpen(false)
    }
  }

  const toggleLaptopSidebar = () => {
    setIsLaptopCollapsed(!isLaptopCollapsed)
  }

  const sidebarWidth = isMobile ? (isOpen ? "w-64" : "w-0") : isLaptopCollapsed ? "w-16" : "w-64"
  const sidebarTransform = isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"
  const showText = (isMobile && isOpen) || (!isMobile && !isLaptopCollapsed)

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed lg:sticky top-0 bg-blue-800 text-white h-screen z-30 transition-all duration-300 ${sidebarWidth} ${sidebarTransform} overflow-hidden`}
      >
        <div className="p-4 border-b border-blue-700 flex justify-between items-center h-16">
          <Link href="/vendor/dashboard" className="flex items-center">
            <Package className="h-8 w-8 mr-2 text-blue-300 flex-shrink-0" />
            {showText && <h1 className="text-xl font-bold truncate">Vendor Panel</h1>}
          </Link>
          {!isMobile && (
            <button
              onClick={toggleLaptopSidebar}
              className="text-white p-1 rounded-full hover:bg-blue-700 focus:outline-none"
              aria-label={isLaptopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft className={`h-5 w-5 transition-transform ${isLaptopCollapsed ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link href={item.path} onClick={handleLinkClick}>
                  <div
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      isActive(item.path) ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700"
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {showText && <span className="ml-3 truncate">{item.name}</span>}
                    {!showText && <span className="sr-only">{item.name}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-blue-700">
          <button onClick={handleLogout} className="flex items-center text-blue-100 hover:text-white w-full">
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {showText && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  )
}
