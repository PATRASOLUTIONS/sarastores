"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PartyPopper, X, ArrowRight, Tag } from "lucide-react"
import { fetchWithCache } from "@/utils/cache"
import { selectDeals, discountPct, getTimeLeft, DEALS_ANCHOR_ID } from "@/utils/deals"

const SESSION_KEY = "sara:deal-popup-seen"
const OPEN_DELAY_MS = 1500
const DATA_TTL = 5 * 60 * 1000

function pad(n: number) {
  return String(n).padStart(2, "0")
}

export default function DealOfTheDayPopup() {
  const [open, setOpen] = useState(false)
  const [topDiscount, setTopDiscount] = useState<number | null>(null)
  const [dealCount, setDealCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(getTimeLeft())
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const lastFocused = useRef<Element | null>(null)

  // Only offer the popup when there are real deals to send the customer to.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionStorage.getItem(SESSION_KEY)) return
    // Full-screen interstitials on mobile are penalised by Google and hurt bounce,
    // so this is desktop-only.
    if (window.matchMedia("(max-width: 1023px)").matches) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    fetchWithCache(
      "products-card",
      async () => {
        const r = await fetch("/api/products?fields=card")
        if (!r.ok) throw new Error("Failed to fetch products")
        return r.json()
      },
      DATA_TTL
    )
      .then((data: any[]) => {
        if (cancelled) return
        const deals = selectDeals(data)
        if (deals.length === 0) return
        setDealCount(deals.length)
        setTopDiscount(discountPct(deals[0]))
        timer = setTimeout(() => !cancelled && setOpen(true), OPEN_DELAY_MS)
      })
      .catch(() => {
        /* no deals, no popup */
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(t)
  }, [open])

  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      /* private mode */
    }
    if (lastFocused.current instanceof HTMLElement) lastFocused.current.focus()
  }, [])

  // Fire confetti, lock scroll, and wire Esc while the dialog is open.
  useEffect(() => {
    if (!open) return

    lastFocused.current = document.activeElement
    closeRef.current?.focus()

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!prefersReduced) {
      import("canvas-confetti")
        .then(({ default: confetti }) => {
          const burst = (originX: number) =>
            confetti({
              particleCount: 55,
              spread: 70,
              startVelocity: 45,
              origin: { x: originX, y: 0.35 },
              zIndex: 10000,
              colors: ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"],
            })
          burst(0.25)
          setTimeout(() => burst(0.75), 220)
        })
        .catch(() => {
          /* confetti is decorative */
        })
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    document.addEventListener("keydown", onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, dismiss])

  const goToDeals = () => {
    dismiss()
    // Let the dialog unmount before scrolling so focus and layout settle.
    requestAnimationFrame(() => {
      document.getElementById(DEALS_ANCHOR_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deal-popup-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <button
              ref={closeRef}
              onClick={dismiss}
              aria-label="Close offer"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="bg-gradient-to-br from-brand-primary via-brand-primary to-brand-accent px-6 pb-8 pt-7 text-center text-white">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/15">
                <PartyPopper className="h-7 w-7" />
              </span>
              <h2 id="deal-popup-title" className="text-2xl font-extrabold leading-tight">
                Deal of the Day
              </h2>
              <p className="mt-1 text-sm text-white/85">
                {topDiscount
                  ? `Up to ${topDiscount}% off on ${dealCount}+ handpicked products`
                  : "Handpicked offers, today only"}
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="mb-4 flex items-center justify-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Ends in</span>
                {([
                  [timeLeft.hours, "Hrs"],
                  [timeLeft.minutes, "Min"],
                  [timeLeft.seconds, "Sec"],
                ] as const).map(([value, label]) => (
                  <span key={label} className="flex flex-col items-center">
                    <span className="min-w-[2.25rem] rounded-md bg-gray-900 px-2 py-1 text-center text-sm font-bold tabular-nums text-white">
                      {pad(value)}
                    </span>
                    <span className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
                  </span>
                ))}
              </div>

              <button
                onClick={goToDeals}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-accent/25 transition-colors hover:bg-brand-accent/90 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              >
                <Tag className="h-4 w-4" />
                Grab today&apos;s deals
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={dismiss}
                className="mt-2 w-full py-2 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
