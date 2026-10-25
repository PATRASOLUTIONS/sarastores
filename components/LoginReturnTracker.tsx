"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { LAST_VISITED_PATH, safeReturnPath } from "@/lib/return-path"

/** Remember client-side navigation, for which document.referrer does not update. */
export default function LoginReturnTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const path = safeReturnPath(`${pathname}${window.location.search}${window.location.hash}`)
    if (!path) return
    try {
      sessionStorage.setItem(LAST_VISITED_PATH, path)
    } catch {
      // Explicit return URLs still work when browser storage is unavailable.
    }
  }, [pathname, searchParams])

  return null
}
