"use client"

import { useEffect, useState } from "react"
import { homepageHeaderPromotion } from "@/lib/homepage-chrome"

export interface ActiveHeaderPromotion {
  title: string
  href: string
  description: string
}

export function useHeaderPromotion(staticContent = false) {
  const [promotion, setPromotion] = useState<ActiveHeaderPromotion | null>(() => staticContent ? homepageHeaderPromotion() : null)

  useEffect(() => {
    if (staticContent) {
      const sync = () => setPromotion(homepageHeaderPromotion())
      sync()
      const timer = setInterval(sync, 60_000)
      return () => clearInterval(timer)
    }
    let active = true
    fetch("/api/header-promotions")
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (active) setPromotion(data?.promotion ?? null)
      })
      .catch(() => {
        if (active) setPromotion(null)
      })
    return () => { active = false }
  }, [staticContent])

  return promotion
}
