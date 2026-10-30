"use client"

import { useEffect, useState } from "react"
import { googleStoreEmbed } from "@/lib/store-google-maps"
import { getStoreBusiness } from "@/lib/store-business-client"
import type { Store } from "@/lib/store-data"

export default function GoogleStoreMap({ stores, selectedStore, className = "", resetKey = 0 }: {
  stores: Store[]; selectedStore: string | null; className?: string; resetKey?: number
}) {
  const active = stores.find(store => store.id === selectedStore) || stores[0]
  const [resolved, setResolved] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    if (!active) return
    let cancelled = false
    void getStoreBusiness(active.id).then(data => {
      if (!cancelled && data.embedUrl) setResolved({ id: active.id, url: data.embedUrl })
    }).catch(() => { /* Keep the map based on the saved store details. */ })
    return () => { cancelled = true }
  }, [active?.id, resetKey])
  if (!active) return <div className={`flex items-center justify-center bg-gray-50 p-6 text-sm text-gray-600 ${className}`}>No stores match your filters.</div>
  const src = resolved?.id === active.id ? resolved.url : googleStoreEmbed(active.mapUrl || "", active.name, active.address, active.googlePlaceId)
  return <iframe key={`${active.id}:${resetKey}`} src={src} title={`Google Maps: ${active.name}`} className={className}
    style={{ width: "100%", height: "100%", border: 0 }} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
}
