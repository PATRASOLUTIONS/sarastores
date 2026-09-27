"use client"

import { useRef } from "react"

/**
 * Synchronous duplicate-submit guard.
 *
 * A `disabled={isSubmitting}` attribute only takes effect after React
 * re-renders, so a fast double click can still run the handler twice and fire
 * two API calls. This ref flips immediately.
 *
 *   const lock = useSubmitLock()
 *   if (!lock.acquire()) return
 *   try { ... } finally { lock.release() }
 */
export function useSubmitLock() {
  const locked = useRef(false)

  return {
    acquire: () => {
      if (locked.current) return false
      locked.current = true
      return true
    },
    release: () => {
      locked.current = false
    },
  }
}
