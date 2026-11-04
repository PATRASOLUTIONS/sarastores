"use client"

import SiteImage from "@/components/SiteImage"

import { useState } from "react"

export default function CartProductImage({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState<string>()
  const source = src && failed !== src ? src : "/placeholder.svg"
  // Approved supplier images load through the same-origin optimizer.
  return <SiteImage sizes="96px" src={source} alt={name} className={className} onError={() => {
    if (source !== "/placeholder.svg") {
      console.warn("[Cart] Product image unavailable:", src)
      setFailed(src)
    }
  }} />
}
