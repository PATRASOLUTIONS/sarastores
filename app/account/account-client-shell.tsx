"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { User, Package, Heart, Settings, Bell, LogOut, ShieldCheck } from "lucide-react"

interface AccountClientShellProps {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  children: React.ReactNode
}

export default function AccountClientShell({ user, children }: AccountClientShellProps) {
  const { logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  // Prefer the live AuthContext user (which can be refreshed by the client)
  // but always fall back to the server-verified user passed in, so the
  // shell renders even before the client has finished hydrating.
  const displayUser = user

  const navItems = [
    { href: "/account", icon: <User className="h-5 w-5" />, label: "My Account" },
    { href: "/dashboard/orders", icon: <Package className="h-5 w-5" />, label: "Orders" },
    { href: "/dashboard/wishlist", icon: <Heart className="h-5 w-5" />, label: "Wishlist" },
    { href: "/account/preferences", icon: <Bell className="h-5 w-5" />, label: "Communication Preferences" },
    { href: "/account/privacy", icon: <ShieldCheck className="h-5 w-5" />, label: "Privacy & My Data" },
    { href: "/dashboard/settings", icon: <Settings className="h-5 w-5" />, label: "Addresses & Settings" },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {/* Hero Banner */}
        <div className="bg-maroon-800 text-white py-8">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl font-bold">My Account</h1>
            <p className="text-maroon-100">Welcome back, {displayUser?.name}</p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="md:w-1/4">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-maroon-800 text-white flex items-center justify-center">
                      {displayUser?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="font-medium">{displayUser?.name}</p>
                      <p className="text-sm text-gray-500">{displayUser?.email}</p>
                    </div>
                  </div>
                </div>
                <nav className="p-4">
                  <ul className="space-y-1">
                    {navItems.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href}>
                          <div
                            className={`flex items-center px-3 py-2 rounded-md hover:bg-gray-100`}
                          >
                            {item.icon}
                            <span className="ml-3">{item.label}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-3 py-2 rounded-md hover:bg-gray-100 text-red-600"
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="ml-3">Logout</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="md:w-3/4">
              <div className="bg-white rounded-lg shadow-md p-6">{children}</div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
