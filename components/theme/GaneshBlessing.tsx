"use client"

import { useEffect, useState } from "react"

/**
 * Ganesh Chaturthi blessing.
 *
 * Ganpati arrives, blesses, and departs — mirroring the aavahan and visarjan of
 * the festival itself. Runs on a long interval so it stays special rather than
 * nagging, and is fully decorative: fixed, `pointer-events-none`, aria-hidden.
 *
 * Figurative artwork is deliberately not hand-drawn here. Drop a transparent PNG
 * at `public/ganesh/blessing.png` and it is used automatically; without one the
 * component falls back to a gold Om and aura, which is respectful and renders
 * identically everywhere.
 */

const FIRST_APPEARANCE_MS = 4_000
const REPEAT_EVERY_MS = 90_000
const VISIBLE_MS = 7_000

export default function GaneshBlessing({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false)
  const [hasArtwork, setHasArtwork] = useState(false)

  useEffect(() => {
    if (!active) return
    const image = new Image()
    image.src = "/ganesh/blessing.png"
    image.onload = () => setHasArtwork(true)
  }, [active])

  useEffect(() => {
    if (!active) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let hideTimer: ReturnType<typeof setTimeout>

    const show = () => {
      setVisible(true)
      hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS)
    }

    const firstTimer = setTimeout(show, FIRST_APPEARANCE_MS)
    const interval = setInterval(show, REPEAT_EVERY_MS)

    return () => {
      clearTimeout(firstTimer)
      clearTimeout(hideTimer)
      clearInterval(interval)
    }
  }, [active])

  if (!active || !visible) return null

  return (
    <div aria-hidden="true" className="ganesh-blessing pointer-events-none fixed inset-0 z-[60]">
      <div className="ganesh-blessing-figure">
        <span className="ganesh-blessing-aura" />

        {hasArtwork ? (
          <img src="/ganesh/blessing.png" alt="" className="ganesh-blessing-art" />
        ) : (
          <span className="ganesh-blessing-om">ॐ</span>
        )}

        <span className="ganesh-blessing-caption">गणपती बाप्पा मोरया</span>
      </div>

      {/* Petals showered at the moment of blessing, independent of the ambient fall. */}
      <div className="ganesh-blessing-shower">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${60 + Math.random() * 35}%`,
              animationDelay: `${0.4 + Math.random() * 2.4}s`,
              backgroundColor: ["#F5A623", "#FF8F00", "#FFC107", "#E65100"][i % 4],
            }}
          />
        ))}
      </div>
    </div>
  )
}
