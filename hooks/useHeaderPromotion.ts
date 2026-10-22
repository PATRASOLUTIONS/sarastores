"use client"

import { useEffect, useState } from "react"

export interface ActiveHeaderPromotion {
  title: string
  href: string
  description: string
}

export function useHeaderPromotion() {
  const [promotion, setPromotion] = useState<ActiveHeaderPromotion | null>(null)

  useEffect(() => {
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
  }, [])

  return promotion
}
