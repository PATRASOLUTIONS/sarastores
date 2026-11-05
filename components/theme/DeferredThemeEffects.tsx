"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import type { ThemeEffect } from "@/lib/theme"

const ThemeEffects = dynamic(() => import("./ThemeEffects"), { ssr: false })
const GaneshBlessing = dynamic(() => import("./GaneshBlessing"), { ssr: false })

/** Ambient artwork loads after essential content and respects reduced motion. */
export default function DeferredThemeEffects({ effect, blessing }: { effect: ThemeEffect; blessing: boolean }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if ((effect === "none" && !blessing) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if ("requestIdleCallback" in window) {
      const idle = window.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      return () => window.cancelIdleCallback(idle)
    }
    const timer = setTimeout(() => setReady(true), 1000)
    return () => clearTimeout(timer)
  }, [effect, blessing])
  if (!ready) return null
  return <>{effect !== "none" && <ThemeEffects effect={effect} />}{blessing && <GaneshBlessing active />}</>
}
