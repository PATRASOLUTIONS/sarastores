"use client"

import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { User, Package, Heart, MapPin, Settings, LogOut } from "lucide-react"

export default function AccountPage() {
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login?redirect=/account")
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Please log in to view your account</h2>
        <Link href="/login?redirect=/account">
          <button className="bg-maroon-800 text-white px-6 py-3 rounded-lg hover:bg-maroon-900 transition-colors">
            Login
          </button>
        </Link>
      </div>
    )
  }

  const accountSections = [
    {
      title: "Personal Information",
      icon: <User className="h-6 w-6" />,
      description: "Update your personal details and preferences",
      link: "/account/profile",
    },
    {
      title: "My Orders",
      icon: <Package className="h-6 w-6" />,
      description: "View and track your orders",
      link: "/account/orders",
    },
    {
      title: "Wishlist",
      icon: <Heart className="h-6 w-6" />,
      description: "Products you've saved for later",
      link: "/dashboard/wishlist",
    },
    {
      title: "Addresses",
      icon: <MapPin className="h-6 w-6" />,
      description: "Manage your shipping addresses",
      link: "/dashboard/settings",
    },
    {
      title: "Account Settings",
      icon: <Settings className="h-6 w-6" />,
      description: "Password, notifications, and privacy settings",
      link: "/account/preferences",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {accountSections.map((section) => (
        <Link href={section.link} key={section.title}>
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <div className="bg-maroon-100 p-3 rounded-full mr-4 text-maroon-800">{section.icon}</div>
              <h2 className="text-xl font-semibold">{section.title}</h2>
            </div>
            <p className="text-gray-600">{section.description}</p>
          </div>
        </Link>
      ))}

      <div
        onClick={() => {
          logout()
          router.push("/")
        }}
        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
      >
        <div className="flex items-center mb-4">
          <div className="bg-red-100 p-3 rounded-full mr-4 text-red-600">
            <LogOut className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">Logout</h2>
        </div>
        <p className="text-gray-600">Sign out of your account</p>
      </div>
    </div>
  )
}
