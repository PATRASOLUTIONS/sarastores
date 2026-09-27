"use client"

import { useEffect, useMemo, useState } from "react"
import type { ThemeEffect } from "@/lib/theme"

/**
 * Decorative festival layer.
 *
 * Purely ambient: fixed, `pointer-events-none`, behind all content, and
 * suppressed entirely under `prefers-reduced-motion` (handled in globals.css).
 * Particles are generated on the client after mount so the markup stays
 * identical between server and client render.
 */

interface Particle {
  left: number
  delay: number
  duration: number
  size: number
  drift: number
  opacity: number
}

const PARTICLE_COUNT: Record<Exclude<ThemeEffect, "none">, number> = {
  confetti: 28,
  diyas: 16,
  petals: 22,
  marigold: 30,
  rockets: 14,
  colours: 26,
  coins: 24,
  hearts: 22,
  crescent: 20,
  moonlight: 26,
  tricolour: 30,
  dandiya: 18,
  leaves: 24,
  snow: 34,
  sparkles: 24,
  fireworks: 10,
}

const CONFETTI_COLOURS = ["#FFC107", "#EF5350", "#42A5F5", "#66BB6A", "#AB47BC", "#FF7043"]
const PETAL_COLOURS = ["#EC407A", "#FFEE58", "#26C6DA", "#AB47BC", "#FF7043"]
/** Genda (marigold) and jaswand shades used in Ganpati decoration. */
const MARIGOLD_COLOURS = ["#F5A623", "#FF8F00", "#FFC107", "#E65100", "#FFD54F", "#C62828"]
/** Gulal powder shades. */
const GULAL_COLOURS = ["#E91E63", "#00BCD4", "#FFEB3B", "#7C4DFF", "#FF6D00", "#00E676"]
const ROCKET_SPARKS = ["#FFD54F", "#FF5252", "#69F0AE", "#40C4FF", "#E040FB"]
const TRICOLOUR = ["#FF9933", "#FFFFFF", "#138808"]
const LEAF_COLOURS = ["#2E7D32", "#43A047", "#66BB6A", "#1B5E20"]

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 7 + Math.random() * 9,
    size: 6 + Math.random() * 10,
    drift: (Math.random() - 0.5) * 160,
    opacity: 0.45 + Math.random() * 0.45,
  }))
}

export default function ThemeEffects({ effect }: { effect: ThemeEffect }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const particles = useMemo(
    () => (effect === "none" ? [] : makeParticles(PARTICLE_COUNT[effect])),
    [effect],
  )

  if (effect === "none" || !mounted) return null

  return (
    <div
      aria-hidden="true"
      // z-40 keeps particles above page content but below the header (z-50) and
      // menus, so nothing they drift over becomes unclickable or hidden.
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      data-theme-effect={effect}
    >
      {particles.map((particle, index) => {
        const base = {
          left: `${particle.left}%`,
          animationDelay: `${particle.delay}s`,
          animationDuration: `${particle.duration}s`,
          opacity: particle.opacity,
          ["--drift" as string]: `${particle.drift}px`,
        }

        if (effect === "snow") {
          return (
            <span
              key={index}
              className="theme-particle rounded-full bg-white"
              style={{ ...base, width: particle.size / 1.5, height: particle.size / 1.5 }}
            />
          )
        }

        if (effect === "confetti") {
          return (
            <span
              key={index}
              className="theme-particle"
              style={{
                ...base,
                width: particle.size / 2,
                height: particle.size,
                backgroundColor: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
                borderRadius: 2,
              }}
            />
          )
        }

        if (effect === "petals") {
          return (
            <span
              key={index}
              className="theme-particle"
              style={{
                ...base,
                width: particle.size,
                height: particle.size,
                backgroundColor: PETAL_COLOURS[index % PETAL_COLOURS.length],
                borderRadius: "50% 0 50% 0",
              }}
            />
          )
        }

        if (effect === "marigold") {
          // Every sixth particle is a modak rather than a petal — the sweet is
          // as recognisable as the flower, and the mix stops the fall reading
          // as a generic petal shower.
          const isModak = index % 6 === 5

          if (isModak) {
            return (
              <span
                key={index}
                className="theme-particle theme-sway"
                style={{
                  ...base,
                  width: particle.size * 1.1,
                  height: particle.size * 1.1,
                  background: "radial-gradient(circle at 50% 70%, #FFE082 0%, #F5A623 60%, #C77800 100%)",
                  clipPath: "polygon(50% 0%, 78% 42%, 92% 100%, 8% 100%, 22% 42%)",
                  animationDuration: `${particle.duration}s, 3.2s`,
                }}
              />
            )
          }

          return (
            <span
              key={index}
              className="theme-particle theme-sway"
              style={{
                ...base,
                width: particle.size * 1.2,
                height: particle.size * 0.8,
                backgroundColor: MARIGOLD_COLOURS[index % MARIGOLD_COLOURS.length],
                borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                boxShadow: "0 0 6px rgba(245, 166, 35, 0.45)",
                animationDuration: `${particle.duration}s, 2.6s`,
              }}
            />
          )
        }

        if (effect === "rockets") {
          // Odd indices climb and burst; even ones are bursts already high in
          // the sky, so the display reads as continuous rather than in waves.
          const spark = ROCKET_SPARKS[index % ROCKET_SPARKS.length]

          if (index % 2 === 1) {
            return (
              <span
                key={index}
                className="theme-rocket rounded-full"
                style={{
                  left: `${particle.left}%`,
                  width: 4,
                  height: 4,
                  backgroundColor: spark,
                  boxShadow: `0 0 10px 3px ${spark}, 0 14px 22px -6px ${spark}`,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${2.6 + (index % 3) * 0.6}s`,
                }}
              />
            )
          }

          return (
            <span
              key={index}
              className="theme-burst absolute rounded-full"
              style={{
                left: `${particle.left}%`,
                top: `${8 + Math.random() * 42}%`,
                width: particle.size * 3.5,
                height: particle.size * 3.5,
                border: `2px solid ${spark}`,
                boxShadow: `0 0 16px ${spark}`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${2.2 + (index % 3) * 0.5}s`,
              }}
            />
          )
        }

        if (effect === "colours") {
          // Gulal thrown into the air: a puff that blooms outward and fades.
          return (
            <span
              key={index}
              className="theme-splash absolute rounded-full"
              style={{
                left: `${particle.left}%`,
                top: `${Math.random() * 90}%`,
                width: particle.size * 4,
                height: particle.size * 4,
                background: `radial-gradient(circle, ${
                  GULAL_COLOURS[index % GULAL_COLOURS.length]
                } 0%, transparent 68%)`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${2.4 + (index % 4) * 0.7}s`,
              }}
            />
          )
        }

        if (effect === "coins") {
          return (
            <span
              key={index}
              className="theme-particle theme-flip rounded-full"
              style={{
                ...base,
                width: particle.size,
                height: particle.size,
                background:
                  "radial-gradient(circle at 35% 30%, #FFF3C4 0%, #F5C542 45%, #B8860B 100%)",
                border: "1px solid rgba(184, 134, 11, 0.8)",
                boxShadow: "0 0 8px rgba(245, 197, 66, 0.6)",
                animationDuration: `${particle.duration}s`,
              }}
            />
          )
        }

        if (effect === "hearts") {
          // Percentages, not path() — a path is in absolute pixels and would be
          // clipped away on a particle this small. No inline transform either:
          // the fall animation owns transform and would override it.
          return (
            <span
              key={index}
              className="theme-particle theme-sway"
              style={{
                ...base,
                width: particle.size * 1.4,
                height: particle.size * 1.3,
                backgroundColor: index % 3 === 0 ? "#F50057" : "#FF4081",
                clipPath:
                  "polygon(50% 100%, 12% 62%, 3% 42%, 6% 22%, 22% 10%, 38% 14%, 50% 28%, 62% 14%, 78% 10%, 94% 22%, 97% 42%, 88% 62%)",
                animationDuration: `${particle.duration}s, 3s`,
              }}
            />
          )
        }

        if (effect === "crescent") {
          // A crescent is a circle with a second circle punched out of it.
          return (
            <span
              key={index}
              className="theme-twinkle absolute"
              style={{
                left: `${particle.left}%`,
                top: `${Math.random() * 92}%`,
                width: particle.size,
                height: particle.size,
                borderRadius: "50%",
                boxShadow: `inset ${particle.size / 3}px 0 0 0 ${
                  index % 4 === 0 ? "#FFFFFF" : "var(--brand-accent)"
                }`,
                filter: "drop-shadow(0 0 6px rgb(var(--brand-glow-rgb) / 0.7))",
                animationDelay: `${particle.delay}s`,
                animationDuration: `${2 + (index % 4)}s`,
              }}
            />
          )
        }

        if (effect === "moonlight") {
          // Larger, softer and paler than snow, and drifting at half the speed —
          // moonlit dust hanging in the air rather than falling flakes.
          return (
            <span
              key={index}
              className="theme-particle theme-sway rounded-full"
              style={{
                ...base,
                width: particle.size * 1.6,
                height: particle.size * 1.6,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(214,228,255,0.45) 45%, transparent 72%)",
                boxShadow: "0 0 16px 5px rgba(214, 228, 255, 0.30)",
                animationDuration: `${particle.duration * 1.6}s, 5s`,
              }}
            />
          )
        }

        if (effect === "tricolour") {
          return (
            <span
              key={index}
              className="theme-particle theme-sway"
              style={{
                ...base,
                width: particle.size / 2.2,
                height: particle.size * 1.6,
                backgroundColor: TRICOLOUR[index % TRICOLOUR.length],
                borderRadius: 1,
                boxShadow: index % 3 === 1 ? "0 0 4px rgba(0,0,0,0.25)" : undefined,
                animationDuration: `${particle.duration}s, 2.8s`,
              }}
            />
          )
        }

        if (effect === "dandiya") {
          return (
            <span
              key={index}
              className="theme-particle theme-flip"
              style={{
                ...base,
                width: particle.size / 3,
                height: particle.size * 2.4,
                borderRadius: 999,
                background: `linear-gradient(180deg, ${
                  GULAL_COLOURS[index % GULAL_COLOURS.length]
                } 0%, #8D6E63 50%, ${GULAL_COLOURS[(index + 2) % GULAL_COLOURS.length]} 100%)`,
                animationDuration: `${particle.duration}s`,
              }}
            />
          )
        }

        if (effect === "leaves") {
          return (
            <span
              key={index}
              className="theme-particle theme-sway"
              style={{
                ...base,
                width: particle.size * 0.7,
                height: particle.size * 1.5,
                backgroundColor: LEAF_COLOURS[index % LEAF_COLOURS.length],
                borderRadius: "0 100% 0 100%",
                animationDuration: `${particle.duration}s, 3.4s`,
              }}
            />
          )
        }

        if (effect === "diyas") {
          // A warm flame dot rather than an emoji, so it renders identically
          // across platforms and costs nothing to paint.
          return (
            <span
              key={index}
              className="theme-particle theme-flicker rounded-full"
              style={{
                ...base,
                width: particle.size,
                height: particle.size,
                background:
                  "radial-gradient(circle at 50% 40%, #FFF3C4 0%, #FFB300 45%, #FF6F00 100%)",
                boxShadow: "0 0 12px 3px rgba(255, 179, 0, 0.55)",
                animationDuration: `${particle.duration}s, 1.4s`,
              }}
            />
          )
        }

        if (effect === "sparkles") {
          return (
            <span
              key={index}
              className="theme-twinkle absolute rounded-full"
              style={{
                left: `${particle.left}%`,
                top: `${Math.random() * 100}%`,
                width: particle.size / 2,
                height: particle.size / 2,
                backgroundColor: "var(--brand-glow)",
                boxShadow: "0 0 10px 2px rgb(var(--brand-glow-rgb) / 0.6)",
                animationDelay: `${particle.delay}s`,
                animationDuration: `${2 + (index % 4)}s`,
              }}
            />
          )
        }

        // fireworks
        return (
          <span
            key={index}
            className="theme-burst absolute rounded-full"
            style={{
              left: `${particle.left}%`,
              top: `${10 + Math.random() * 50}%`,
              width: particle.size * 3,
              height: particle.size * 3,
              border: "2px solid var(--brand-glow)",
              animationDelay: `${particle.delay}s`,
              animationDuration: `${2.5 + (index % 3)}s`,
            }}
          />
        )
      })}
    </div>
  )
}
