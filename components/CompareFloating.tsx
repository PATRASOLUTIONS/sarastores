"use client"

import React from "react"
import { useCompare } from "@/hooks/useCompare"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function CompareFloating() {
  const { compareIds } = useCompare()
  const pathname = usePathname()

  // Hide the floating compare button on admin pages and the full-screen draw display
  if (pathname && (pathname.startsWith("/admin") || pathname.startsWith("/lucky-draw/draw"))) return null

  if (!compareIds) return null

  const count = compareIds.length

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link href="/compare" className="group">
        <button
          aria-label="Open compare"
          className="relative bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-2xl transition"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 6h18M3 12h12M3 18h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
          </svg>
          {count > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center">{count}</span>
          )}
        </button>
      </Link>
    </div>
  )
}
