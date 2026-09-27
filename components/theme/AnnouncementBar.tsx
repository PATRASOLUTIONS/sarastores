"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"

/**
 * Festival announcement strip, driven by the active theme.
 *
 * Dismissal is keyed on the message text, so publishing a new announcement
 * shows it again to everyone who closed the previous one.
 */
export default function AnnouncementBar({
  message,
  href,
}: {
  message: string
  href: string
}) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (!message) return
    try {
      const key = `announcement_dismissed`
      setDismissed(localStorage.getItem(key) === message)
    } catch {
      setDismissed(false)
    }
  }, [message])

  if (!message || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem("announcement_dismissed", message)
    } catch {
      // Private browsing — it simply reappears next visit.
    }
  }

  return (
    <div className="themed-ribbon relative z-50">
      <div className="section-container flex items-center justify-center gap-3 py-2 text-center">
        <Link
          href={href || "/offers"}
          className="group inline-flex items-center gap-2 text-xs font-bold tracking-wide sm:text-sm"
        >
          {message}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
