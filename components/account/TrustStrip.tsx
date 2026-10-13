"use client"

import { BadgeCheck, CreditCard, Headphones, RefreshCw, Truck } from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"

const ITEMS = [
  { icon: BadgeCheck, title: "100% Genuine Products", subtitle: "Direct from Brands" },
  { icon: CreditCard, title: "Easy EMI Options", subtitle: "All Major Banks" },
  { icon: Truck, title: "Free & Fast Delivery", subtitle: "Across Karnataka" },
  { icon: RefreshCw, title: "Hassle-Free Returns", subtitle: "Easy & Secure" },
  { icon: Headphones, title: "Expert Support", subtitle: "" },
]

export default function TrustStrip({ className = "" }: { className?: string }) {
  const { data } = useSettingsData()
  const phone = data?.storePhone || "We're here to help"
  const items = ITEMS.map(item => item.icon === Truck
    ? { ...item, title: "Delivery & Pickup", subtitle: "Bangalore & Mysore" } :
    item.icon === RefreshCw ? { ...item, title: "Returns Support", subtitle: "Subject to policy" } : item)

  return (
    <section className={`rounded-xl bg-[#F4F8FD] px-3 py-4 ${className}`} aria-label="Why shop at SARA">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-gray-200">
        {items.map(({ icon: Icon, title, subtitle }) => (
          <li key={title} className="flex items-center gap-2.5 px-2">
            <Icon className="h-6 w-6 flex-shrink-0 text-[#1560BD]" strokeWidth={1.6} />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold leading-tight text-[#0F2557]">{title}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-600">{subtitle || phone}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
