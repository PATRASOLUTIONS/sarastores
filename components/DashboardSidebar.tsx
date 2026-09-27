"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, ShoppingCart, Package, Heart, Tag, Settings, ChevronRight, Menu, X, Store } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useState, useEffect } from "react"

interface NavItem {
  name: string
  href: string
  icon: any
  exact?: boolean
  badge?: string
}

export default function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [hasInstoreOrders, setHasInstoreOrders] = useState(false)
  const [isCheckingInstoreOrders, setIsCheckingInstoreOrders] = useState(true)

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setIsOpen(!mobile)
    }

    // Initial check
    checkScreenSize()

    // Add event listener
    window.addEventListener("resize", checkScreenSize)

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  // Check if user has any in-store orders
  useEffect(() => {
    const checkInstoreOrders = async () => {
      if (!user?.email) {
        console.log('[Sidebar] No user email found')
        setIsCheckingInstoreOrders(false)
        return
      }

      console.log('[Sidebar] Checking in-store orders for:', user.email)
      try {
        const response = await fetch(`/api/orders?employeeId=${encodeURIComponent(user.email)}`)
        console.log('[Sidebar] API response status:', response.status)
        
        if (response.ok) {
          const orders = await response.json()
          console.log('[Sidebar] Total orders fetched:', orders.length)
          
          const instoreOnly = orders.filter((order: any) => 
            order.paymentMethod === 'instore' || 
            order.paymentDetails?.verifiedEmail === user.email
          )
          console.log('[Sidebar] In-store orders found:', instoreOnly.length)
          
          setHasInstoreOrders(instoreOnly.length > 0)
          console.log('[Sidebar] hasInstoreOrders set to:', instoreOnly.length > 0)
        } else {
          console.log('[Sidebar] API response not OK')
        }
      } catch (error) {
        console.error("[Sidebar] Error checking in-store orders:", error)
      } finally {
        setIsCheckingInstoreOrders(false)
      }
    }

    checkInstoreOrders()
  }, [user])

  if (!user) return null

  console.log('[Sidebar Render] hasInstoreOrders:', hasInstoreOrders, 'isChecking:', isCheckingInstoreOrders)

  const navItems: NavItem[] = [
    {
      name: "Profile",
      href: "/dashboard",
      icon: User,
      exact: true,
    },
    {
      name: "My Cart",
      href: "/dashboard/cart",
      icon: ShoppingCart,
    },
    {
      name: "My Orders",
      href: "/dashboard/orders",
      icon: Package,
    },
    // Conditionally add In-Store Purchases option
    ...(hasInstoreOrders ? [{
      name: "In-Store Purchases",
      href: "/dashboard/instore-purchases",
      icon: Store,
      badge: "Employee" as const,
    }] : []),
    {
      name: "Wishlist",
      href: "/dashboard/wishlist",
      icon: Heart,
    },
// {
//   name: "Offers",
//   href: "/dashboard/offers",
//   icon: Tag,
// },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ]

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Mobile toggle button */}
      <div className="md:hidden fixed top-16 left-4 z-30">
        <button
          onClick={toggleSidebar}
          className="p-2 bg-white rounded-md shadow-md text-gray-700 focus:outline-none"
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={`
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} 
        fixed md:sticky top-16 md:top-0 left-0 h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] 
        w-64 bg-white border-r border-gray-200 z-30 transition-transform duration-300 ease-in-out
      `}
      >
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">My Account</h2>
          <p className="text-sm text-gray-600">Welcome, {user.name}</p>
        </div>
        <nav className="p-4 overflow-y-auto h-[calc(100%-5rem)]">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                    isActive(item.href, item.exact) ? "bg-maroon-50 text-maroon-800" : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => isMobile && setIsOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      {item.badge}
                    </span>
                  )}
                  {isActive(item.href, item.exact) && <ChevronRight className="h-4 w-4 ml-2" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
