"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LABELS: Record<string, string> = {
  orders: "My Orders",
  cart: "My Cart",
  wishlist: "My Wishlist",
  offers: "My Offers",
  notifications: "Notifications",
  settings: "Account Settings",
  "instore-purchases": "In-Store Purchases",
}

const titleCase = (segment: string) =>
  segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

export default function AccountBreadcrumb() {
  const pathname = usePathname() || "/dashboard"
  const segments = pathname.split("/").filter(Boolean).slice(1)

  const trail = segments.map((segment, index) => {
    const href = `/dashboard/${segments.slice(0, index + 1).join("/")}`
    // Only an id nested under /orders is an order; anything else is a real page.
    const label =
      LABELS[segment] || (segments[index - 1] === "orders" ? "Order Details" : titleCase(segment))
    return { href, label }
  })

  return (
    <nav className="flex flex-wrap items-center gap-2 text-[12px] text-gray-500" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-[#1560BD]">
        Home
      </Link>
      <span className="text-gray-300">›</span>
      {trail.length === 0 ? (
        <span className="font-medium text-gray-700">My Account</span>
      ) : (
        <Link href="/dashboard" className="hover:text-[#1560BD]">
          My Account
        </Link>
      )}
      {trail.map(({ href, label }, index) => (
        <span key={href} className="flex items-center gap-2">
          <span className="text-gray-300">›</span>
          {index === trail.length - 1 ? (
            <span className="font-medium text-gray-700">{label}</span>
          ) : (
            <Link href={href} className="hover:text-[#1560BD]">
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
