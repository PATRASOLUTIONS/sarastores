"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"

const ALLOWED_EMAIL = "sales.systechdigital@gmail.com"

export default function AntiInspect() {
  const { user } = useAuth()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (user?.email === ALLOWED_EMAIL) return

    // Use direct assignment instead of addEventListener for highest priority
    // Edge sometimes ignores addEventListener handlers for F12
    const origOnKeyDown = document.onkeydown
    const origOnContextMenu = document.oncontextmenu

    document.onkeydown = function (e: KeyboardEvent) {
      const key = (e.key || "").toUpperCase()
      const code = (e.code || "")

      // F12
      if (e.key === "F12" || code === "F12" || e.keyCode === 123) {
        e.preventDefault(); e.stopPropagation(); return false
      }

      // Ctrl key combos (works across Chrome, Edge, Firefox, Opera)
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Shift+I / J / C / U / K / L
        if (e.shiftKey && ["I", "J", "C", "U", "K", "L"].includes(key)) {
          e.preventDefault(); e.stopPropagation(); return false
        }
        // Ctrl+U (view source)
        if (key === "U" || code === "KeyU") {
          e.preventDefault(); e.stopPropagation(); return false
        }
      }

      // Cmd+Option+I / J / C (Mac)
      if (e.metaKey && e.altKey && ["I", "J", "C"].includes(key)) {
        e.preventDefault(); e.stopPropagation(); return false
      }
    }

    document.oncontextmenu = function (e: MouseEvent) {
      e.preventDefault()
      return false
    }

    // Disable drag on images
    const imgs = document.querySelectorAll("img")
    imgs.forEach((img) => { img.draggable = false })

    // Chrome/Edge DevTools detection via debugger timing
    const devtoolsDetector = () => {
      const start = performance.now()
      debugger  // eslint-disable-line no-debugger
      const end = performance.now()
      if (end - start > 100) {
        const noop = () => {}
        console.log = noop
        console.warn = noop
        console.error = noop
        console.info = noop
        console.debug = noop
        console.clear = noop
        console.table = noop
        console.group = noop
        console.groupEnd = noop
        console.time = noop
        console.timeEnd = noop
        console.count = noop
        console.trace = noop
        console.profile = noop
        console.profileEnd = noop
      }
    }

    timerRef.current = setInterval(devtoolsDetector, 3000)
    devtoolsDetector()

    return () => {
      document.onkeydown = origOnKeyDown as any
      document.oncontextmenu = origOnContextMenu as any
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user])

  return null
}
