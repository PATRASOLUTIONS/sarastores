"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import type { CountdownParts, HandshakeLaunch } from "@/lib/handshake"
import { countdownParts } from "@/lib/handshake"

type Phase = "cover" | "curtain" | "ribbon" | "welcome" | "done"

const SEEN_PREFIX = "sara-home-launch-grand:"
const CONFETTI = [
  { x: -140, y: -120, color: "#FF6A2C", rotate: -40 },
  { x: 150, y: -100, color: "#F5C16C", rotate: 30 },
  { x: -90, y: 80, color: "#FFFFFF", rotate: 20 },
  { x: 110, y: 90, color: "#FF6A2C", rotate: -24 },
  { x: -180, y: 10, color: "#F5C16C", rotate: 12 },
  { x: 190, y: -20, color: "#FFFFFF", rotate: -16 },
  { x: -40, y: -160, color: "#FF6A2C", rotate: 28 },
  { x: 50, y: -150, color: "#F5C16C", rotate: -32 },
  { x: -160, y: -70, color: "#FFFFFF", rotate: 18 },
  { x: 170, y: 50, color: "#FF6A2C", rotate: -10 },
  { x: 20, y: 140, color: "#F5C16C", rotate: 36 },
  { x: -20, y: 150, color: "#FFFFFF", rotate: -22 },
]
const SPARKS = [
  { left: "12%", delay: 0.1, color: "#FF6A2C" },
  { left: "22%", delay: 0.6, color: "#F5C16C" },
  { left: "70%", delay: 0.2, color: "#FFFFFF" },
  { left: "82%", delay: 0.8, color: "#FF6A2C" },
  { left: "48%", delay: 1.1, color: "#F5C16C" },
  { left: "36%", delay: 0.4, color: "#FFFFFF" },
]
const UNITS = [
  ["days", "Days"],
  ["hours", "Hours"],
  ["minutes", "Minutes"],
  ["seconds", "Seconds"],
] as const

function seenKey(launchAt: string) {
  return `${SEEN_PREFIX}${launchAt}`
}

function alreadySeen(launchAt: string) {
  try {
    return window.localStorage.getItem(seenKey(launchAt)) === "1"
  } catch {
    return false
  }
}

function remember(launchAt: string) {
  try {
    window.localStorage.setItem(seenKey(launchAt), "1")
  } catch {
    // Private mode can refuse the write. The store still opens for this visit.
  }
}

export default function EcommerceLaunch({ launch }: { launch: HandshakeLaunch }) {
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<Phase>("cover")
  const [parts, setParts] = useState<CountdownParts | null>(null)

  useEffect(() => {
    if (reduceMotion === null) return
    if (alreadySeen(launch.launchAt)) {
      setPhase("done")
      return
    }

    let started = false
    let curtainTimer: ReturnType<typeof setTimeout> | undefined
    let openTimer: ReturnType<typeof setTimeout> | undefined

    const openStore = () => {
      remember(launch.launchAt)
      setPhase("done")
    }

    const begin = () => {
      if (started) return
      started = true
      if (reduceMotion) {
        setPhase("welcome")
        return
      }
      setPhase("curtain")
      curtainTimer = setTimeout(() => setPhase("ribbon"), 2000)
      openTimer = setTimeout(openStore, 8600)
    }

    const tick = () => {
      const next = countdownParts(launch.launchAt, Date.now())
      setParts(next)
      if (next?.live) begin()
    }

    tick()
    const clock = setInterval(tick, 1000)
    return () => {
      clearInterval(clock)
      if (curtainTimer) clearTimeout(curtainTimer)
      if (openTimer) clearTimeout(openTimer)
    }
  }, [launch.launchAt, reduceMotion])

  useEffect(() => {
    if (phase === "done") return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [phase])

  if (phase === "done") return null

  const when = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(launch.launchAt))
  const curtainsOpen = phase === "curtain" || phase === "ribbon" || phase === "welcome"
  const visibleUnits = UNITS.filter(([key]) => key !== "days" || (parts?.days ?? 0) > 0)

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="ecommerce-launch-title">
      <Curtain side="left" open={curtainsOpen} still={!!reduceMotion} />
      <Curtain side="right" open={curtainsOpen} still={!!reduceMotion} />
      {!reduceMotion && <Sparkles />}

      {phase === "cover" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-3xl bg-[#0F2557]/95 px-6 py-8 text-center text-white shadow-2xl sm:px-10">
            <LaunchLogos />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#FF6A2C]">With Bytewise · {when} IST</p>
            <h2 id="ecommerce-launch-title" className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold sm:text-5xl">
              Sara Stores ecommerce
            </h2>
            <p className="mt-2 text-sm text-white/75 sm:text-base">The curtain stays closed until the store opens.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {visibleUnits.map(([key, label]) => (
                <div key={key} className="flex min-w-[4.5rem] flex-col items-center rounded-2xl bg-white/10 px-3 py-3">
                  <motion.span
                    key={parts ? parts[key] : "wait"}
                    className="font-[family-name:var(--font-heading)] text-3xl font-bold tabular-nums sm:text-4xl"
                    initial={reduceMotion ? false : { y: -10, opacity: 0.4 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {parts ? String(parts[key]).padStart(2, "0") : "--"}
                  </motion.span>
                  <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(phase === "curtain" || phase === "ribbon" || phase === "welcome") && (
        <Ribbon cutting={phase === "ribbon"} still={phase === "welcome"} onEnter={() => {
          remember(launch.launchAt)
          setPhase("done")
        }} />
      )}
    </div>
  )
}

function Curtain({ side, open, still }: { side: "left" | "right"; open: boolean; still: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className={`absolute top-0 h-full w-1/2 ${side === "left" ? "left-0" : "right-0"}`}
      style={{
        background: "repeating-linear-gradient(90deg, #4c0c18 0 14px, #8e1a32 14px 22px, #6d1224 22px 36px, #3d0913 36px 42px)",
        boxShadow: side === "left" ? "inset -28px 0 36px rgba(0,0,0,.45)" : "inset 28px 0 36px rgba(0,0,0,.45)",
      }}
      initial={false}
      animate={open
        ? { x: side === "left" ? "-105%" : "105%" }
        : still ? { x: "0%" } : { x: [0, side === "left" ? -10 : 10, 0] }}
      transition={still || open
        ? { duration: still ? 0 : 1.8, ease: [0.22, 1, 0.36, 1] }
        : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

function Ribbon({ cutting, still, onEnter }: { cutting: boolean; still: boolean; onEnter: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
      {cutting && !still && <ConfettiBurst />}
      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0F2557]/95 px-5 py-8 text-center text-white shadow-2xl sm:px-10">
        <LaunchLogos celebrate={cutting && !still} />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#F5C16C]">
          {cutting || still ? "Grand opening" : "The curtain opens"}
        </p>
        <div className="relative mx-auto mt-6 h-24 w-full max-w-lg">
          <RibbonHalf side="left" fall={cutting} still={still} />
          <RibbonHalf side="right" fall={cutting} still={still} />
          <motion.div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[#F5C16C]"
            initial={false}
            animate={cutting && !still ? { y: 28, rotate: -24, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.45, delay: cutting ? 0.35 : 0 }}
          >
            <Scissors />
          </motion.div>
        </div>
        <h2 id="ecommerce-launch-title" className="mt-6 font-[family-name:var(--font-heading)] text-3xl font-bold sm:text-5xl">
          {still || cutting ? "Sara Stores is open" : "Bytewise and Sara Stores"}
        </h2>
        {still && (
          <button
            type="button"
            onClick={onEnter}
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#FF6A2C] px-6 text-sm font-semibold text-white"
          >
            Enter the store
          </button>
        )}
      </div>
    </div>
  )
}

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {CONFETTI.map((piece, index) => (
        <motion.span
          key={`${piece.x}-${piece.y}`}
          className="absolute left-1/2 top-1/2 h-3 w-2 rounded-sm"
          style={{ backgroundColor: piece.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: piece.x, y: piece.y, opacity: 0, rotate: piece.rotate }}
          transition={{ duration: 1.5, delay: index * 0.02, ease: "easeOut" }}
        />
      ))}
    </div>
  )
}

function RibbonHalf({ side, fall, still }: { side: "left" | "right"; fall: boolean; still: boolean }) {
  const left = side === "left"
  return (
    <motion.div
      className={`absolute top-6 flex h-16 w-1/2 items-center border-y-4 border-[#F5C16C] bg-[#C8102E] text-white shadow-lg ${left ? "left-0 justify-end pr-8" : "right-0 justify-start pl-8"}`}
      style={{ transformOrigin: left ? "right center" : "left center" }}
      initial={false}
      animate={fall && !still ? { rotate: left ? -16 : 16, y: 160, opacity: 0 } : { rotate: 0, y: 0, opacity: 1 }}
      transition={still ? { duration: 0 } : { duration: 0.9, delay: 0.7, ease: "easeIn" }}
    >
      <span className="font-[family-name:var(--font-heading)] text-sm font-bold tracking-[0.28em] sm:text-base">
        {left ? "SARA" : "STORES"}
      </span>
    </motion.div>
  )
}

function LaunchLogos({ celebrate = false }: { celebrate?: boolean }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className="flex items-center justify-center gap-3 sm:gap-5"
      initial={false}
      animate={celebrate && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white p-1.5 shadow-lg sm:h-20 sm:w-20">
        <img src="/bytewise-logo.png" alt="Bytewise Consulting" className="h-full w-full object-contain" />
      </span>
      <motion.span
        className="shrink-0 text-lg font-semibold text-[#FF6A2C]"
        aria-hidden="true"
        animate={reduceMotion ? undefined : { scale: [1, 1.2, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        ×
      </motion.span>
      <span className="flex h-16 w-40 shrink-0 items-center justify-center rounded-2xl bg-white px-3 shadow-lg sm:h-20 sm:w-52">
        <img src="/sara-logo.png" alt="Sara Stores" width={4422} height={1182} className="h-9 w-full object-contain sm:h-11" />
      </span>
    </motion.div>
  )
}

function Sparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
      {SPARKS.map((spark) => (
        <motion.span
          key={spark.left}
          className="absolute top-0 h-2 w-2 rounded-full"
          style={{ left: spark.left, backgroundColor: spark.color }}
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: ["0vh", "100vh"], opacity: [0, 1, 0] }}
          transition={{ duration: 3.2, delay: spark.delay, repeat: Infinity, ease: "easeIn" }}
        />
      ))}
    </div>
  )
}

function Scissors() {
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" fill="none" aria-hidden="true">
      <circle cx="16" cy="38" r="7" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="2.4" />
      <path d="M21 20l18 16M21 34l18-16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
