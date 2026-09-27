"use client"

import { BadgeCheck, Headphones, Layers, MapPin, Store, Tag, Users, Wrench } from "lucide-react"
import { useSettingsData } from "@/hooks/useSettingsData"
import { useBrandImages } from "@/hooks/useBrandImages"

const HERO_POINTS = [
  { icon: Layers, title: "Wide Network", detail: "Across Karnataka" },
  { icon: BadgeCheck, title: "Genuine Products", detail: "Direct from Brands" },
  { icon: Wrench, title: "Expert Guidance", detail: "In-Store" },
  { icon: Tag, title: "Best Offers", detail: "Near You" },
]

function Script({ className = "", lines }: { className?: string; lines: string[] }) {
  return (
    <p className={`font-script leading-tight ${className}`}>
      {lines.map((line, i) => (
        <span key={line} className={i === 1 ? "ml-4 block" : "block"}>
          {line}
        </span>
      ))}
      <svg viewBox="0 0 120 12" className="mt-1 h-2.5 w-24" fill="none" aria-hidden>
        <path d="M2 9C26 3 62 2 90 4c10 .8 20 2.6 28 5" stroke="#E11D2E" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </p>
  )
}

export function StoreLocatorHero() {
  const { data } = useSettingsData()
  const { storefront } = useBrandImages()
  const stores = data?.statStores || "85+"

  return (
    <section className="bg-gradient-to-br from-[#E9F1FB] to-[#F7FBFF]" aria-labelledby="locator-hero">
      <div className="container mx-auto grid items-center gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div>
          <h1
            id="locator-hero"
            className="font-heading text-[28px] font-extrabold leading-[1.1] text-[#0F2557] md:text-[40px]"
          >
            Find a SARA Store
            <br />
            Near You
          </h1>
          <p className="mt-3 text-sm font-semibold text-[#1560BD]">
            {stores} Stores Across Karnataka | Always Close to You
          </p>

          <ul className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
            {HERO_POINTS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex w-[124px] flex-col gap-1.5">
                <Icon className="h-5 w-5 text-[#1560BD]" strokeWidth={1.5} />
                <span className="text-[12px] font-bold leading-tight text-[#0F2557]">{title}</span>
                <span className="text-[11px] leading-tight text-slate-500">{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={storefront} alt="A SARA store" className="h-full max-h-[240px] w-full rounded-xl object-cover" />
          <Script
            className="absolute bottom-3 left-4 text-lg text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            lines={["Closer to You", "Across Karnataka"]}
          />
        </div>
      </div>
    </section>
  )
}

export function StoreLocatorTrust() {
  const { data } = useSettingsData()
  const stores = data?.statStores || "85+"

  const items = [
    { icon: Store, title: `${stores} Stores`, detail: "Across Karnataka" },
    { icon: BadgeCheck, title: "100% Genuine Products", detail: "From Top Brands" },
    { icon: MapPin, title: "Exclusive In-Store Offers", detail: "& Store Pickup" },
    { icon: Headphones, title: "Expert Assistance", detail: "From Our Team" },
  ]

  return (
    <section className="border-t border-gray-200 bg-white" aria-label="Why visit a SARA store">
      <ul className="container mx-auto grid grid-cols-2 gap-4 px-4 py-6 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#1560BD]">
              <Icon className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold leading-tight text-gray-900">{title}</p>
              <p className="text-[11px] leading-tight text-gray-500">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
