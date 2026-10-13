"use client"

import { useState } from "react"

export default function CartProductImage({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState<string>()
  const source = src && failed !== src ? src : "/placeholder.svg"
  // Cart images can come from any catalog supplier; render directly rather than
  // throwing in next/image before its onError handler can show a fallback.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt={name} className={className} onError={() => {
    if (source !== "/placeholder.svg") {
      console.warn("[Cart] Product image unavailable:", src)
      setFailed(src)
    }
  }} />
}
