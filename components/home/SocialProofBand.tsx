"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarClock, Users, Store, Star } from "lucide-react"
import { useReducedMotion } from "@/hooks/useAnimations"

type Stat = {
  icon: typeof Users
  /** Numeric target for the count-up. */
  value: number
  /** Decimal places to render (ratings use 1). */
  decimals?: number
  prefix?: string
  suffix?: string
  label: string
}

// Verifiable business facts only. An average rating is not shown because no
// review data backs it up.
const stats: Stat[] = [
  { icon: CalendarClock, value: 25, suffix: "+", label: "Years of trust" },
  { icon: Store, value: 40, suffix: "+", label: "Stores in Karnataka" },
  { icon: Users, value: 2000, suffix: "+", label: "Products available" },
]

function useCountUp(target: number, decimals: number, inView: boolean, prefersReduced: boolean) {
  // Start at 0 whenever we intend to animate, so the number never flashes its
  // final value before counting up. Reduced-motion users get the target at once.
  const [value, setValue] = useState(prefersReduced ? target : 0)

  useEffect(() => {
    if (prefersReduced) {
      setValue(target)
      return
    }
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const duration = 1400
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setValue(Number((target * eased).toFixed(decimals)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, decimals, inView, prefersReduced])

  return value
}

function StatItem({ stat, inView, prefersReduced }: { stat: Stat; inView: boolean; prefersReduced: boolean }) {
  const value = useCountUp(stat.value, stat.decimals ?? 0, inView, prefersReduced)
  const display = stat.decimals ? value.toFixed(stat.decimals) : Math.round(value).toString()
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
        <stat.icon className="h-5 w-5" />
      </span>
      <p className="mt-2.5 text-2xl font-black leading-none text-white md:text-3xl">
        {stat.prefix}{display}{stat.suffix}
      </p>
      <p className="mt-1 text-xs font-medium text-white/70">{stat.label}</p>
    </div>
  )
}

export default function SocialProofBand() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      aria-label="Why shoppers stay with Sara"
      className="overflow-hidden rounded-3xl bg-gradient-to-r from-brand-primary to-indigo-600 px-6 py-7 md:px-10 md:py-9"
    >
      <p className="mb-5 text-center text-sm font-semibold uppercase tracking-wider text-white/80">
        Karnataka&apos;s neighbourhood electronics family
      </p>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((stat) => (
          <StatItem key={stat.label} stat={stat} inView={inView} prefersReduced={prefersReduced} />
        ))}
      </div>
    </section>
  )
}
