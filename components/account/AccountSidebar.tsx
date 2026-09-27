"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Bell,
  ChevronDown,
  Crown,
  Headphones,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  User,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useSettingsData } from "@/hooks/useSettingsData"

interface NavItem {
  name: string
  href: string
  icon: typeof Home
  exact?: boolean
  badge?: string
}

export default function AccountSidebar() {
  const pathname = usePathname() || ""
  const router = useRouter()
  const { user, logout } = useAuth()
  const { data: settings } = useSettingsData()
  const [isOpen, setIsOpen] = useState(false)
  const [hasInstoreOrders, setHasInstoreOrders] = useState(false)

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch(`/api/orders?employeeId=${encodeURIComponent(user.email)}`)
        if (!response.ok || cancelled) return
        const orders = await response.json()
        if (!Array.isArray(orders)) return
        const instore = orders.filter(
          (order: any) => order.paymentMethod === "instore" || order.paymentDetails?.verifiedEmail === user.email,
        )
        setHasInstoreOrders(instore.length > 0)
      } catch {
        // The in-store shortcut is optional chrome — stay quiet on failure.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null

  const navItems: NavItem[] = [
    { name: "My Account", href: "/dashboard", icon: Home, exact: true },
    { name: "My Orders", href: "/dashboard/orders", icon: Package },
    { name: "My Cart", href: "/dashboard/cart", icon: ShoppingCart },
    { name: "My Wishlist", href: "/dashboard/wishlist", icon: Heart },
    { name: "My Offers", href: "/dashboard/offers", icon: Tag },
    ...(hasInstoreOrders
      ? [{ name: "In-Store Purchases", href: "/dashboard/instore-purchases", icon: Store, badge: "Employee" }]
      : []),
    { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
    { name: "Account Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Help & Support", href: "/contact", icon: Headphones },
  ]

  const isActive = (href: string, exact = false) => (exact ? pathname === href : pathname.startsWith(href))

  const firstName = (user.name || "there").split(" ")[0]
  const phone = settings?.storePhone || "1800 123 7272"
  const whatsapp = String(settings?.whatsappNumber || "").replace(/\D/g, "")

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <aside className="lg:sticky lg:top-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <User className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] leading-tight text-gray-500">Hello,</p>
            <p className="truncate font-heading text-[15px] font-bold leading-tight text-[#0F2557]">{firstName}</p>
            <Link href="/dashboard/settings" className="text-[12px] font-medium text-[#1560BD] hover:underline">
              View Profile
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#0F2557] lg:hidden"
      >
        Account Menu
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <nav className={`mt-3 ${isOpen ? "block" : "hidden"} lg:block`} aria-label="Account">
        <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white p-2">
          {navItems.map(({ name, href, icon: Icon, exact, badge }) => {
            const active = isActive(href, exact)
            return (
              <li key={name}>
                <Link
                  href={href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                    active ? "bg-[#E8F1FC] font-semibold text-[#1560BD]" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
                  <span className="flex-1 truncate">{name}</span>
                  {badge && (
                    <span className="rounded-full bg-[#E8F1FC] px-2 py-0.5 text-[10px] font-semibold text-[#1560BD]">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 transition-colors hover:bg-gray-50"
            >
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} />
              <span className="flex-1 text-left">Logout</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="mt-3 hidden rounded-xl bg-gradient-to-b from-[#E3EFFB] to-[#F3F8FE] p-4 text-center lg:block">
        <Crown className="mx-auto h-7 w-7 text-[#F5A623]" fill="#F5A623" strokeWidth={1.2} />
        <p className="mt-2 font-heading text-[15px] font-bold text-[#0F2557]">SARA Rewards</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-600">Shop More. Earn More. Get Exclusive Benefits.</p>
        <Link
          href="/rewards"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-[#1560BD] shadow-sm transition-colors hover:bg-[#1560BD] hover:text-white"
        >
          Know More
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-3 hidden rounded-xl border border-gray-200 bg-white p-4 lg:block">
        <div className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-[#1560BD]" strokeWidth={1.7} />
          <p className="font-heading text-[14px] font-bold text-[#0F2557]">Need Help?</p>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-600">
          Call us at <span className="font-semibold text-[#0F2557]">{phone}</span> (Toll Free)
        </p>
        {whatsapp ? (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            Chat on WhatsApp
          </a>
        ) : (
          <Link
            href="/contact"
            className="mt-3 flex items-center justify-center rounded-lg border border-[#1560BD] px-3 py-2 text-[12px] font-semibold text-[#1560BD] transition-colors hover:bg-[#1560BD] hover:text-white"
          >
            Contact Support
          </Link>
        )}
      </div>
    </aside>
  )
}
