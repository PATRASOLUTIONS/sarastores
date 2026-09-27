"use client"

import { motion, type AnimationControls } from "framer-motion"

/**
 * Layered SVG gift box. Built from separate lid/body groups so the lid can lift
 * away on reveal while the body keeps shaking.
 */
export default function GiftBox({
  controls,
  isShaking,
  isOpen,
}: {
  controls: AnimationControls
  isShaking: boolean
  isOpen: boolean
}) {
  return (
    <div className="relative">
      {/* spotlight */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(245,196,81,.22),transparent_62%)] blur-2xl" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(232,38,42,.28),transparent_55%)] blur-3xl" />
      </div>

      {/* escaping light once the lid is off */}
      <motion.div
        initial={false}
        animate={isOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,236,180,.95),rgba(245,196,81,.35)_45%,transparent_70%)] blur-md"
      />

      <motion.div animate={controls}>
        <svg
          viewBox="0 0 320 320"
          className={`w-[clamp(15rem,34vw,30rem)] transition-[max-height] duration-500 drop-shadow-[0_45px_60px_rgba(0,0,0,.6)] ${
            isOpen ? "max-h-[19vh]" : "max-h-[38vh]"
          }`}
          role="img"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ld-face" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4494d" />
              <stop offset="55%" stopColor="#d9232a" />
              <stop offset="100%" stopColor="#9d1519" />
            </linearGradient>
            <linearGradient id="ld-side" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a8171c" />
              <stop offset="100%" stopColor="#7d1014" />
            </linearGradient>
            <linearGradient id="ld-lid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5b5f" />
              <stop offset="70%" stopColor="#e02a30" />
              <stop offset="100%" stopColor="#b01a1f" />
            </linearGradient>
            <linearGradient id="ld-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff0bd" />
              <stop offset="42%" stopColor="#f5c451" />
              <stop offset="100%" stopColor="#c9902a" />
            </linearGradient>
            <linearGradient id="ld-gold-h" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c9902a" />
              <stop offset="35%" stopColor="#ffe9ae" />
              <stop offset="65%" stopColor="#f5c451" />
              <stop offset="100%" stopColor="#c9902a" />
            </linearGradient>
            <linearGradient id="ld-sheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity=".34" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ld-shadow">
              <stop offset="0%" stopColor="#000" stopOpacity=".62" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ground shadow */}
          <motion.ellipse
            cx="160"
            cy="292"
            rx="104"
            ry="16"
            fill="url(#ld-shadow)"
            animate={isShaking ? { rx: [104, 88, 104], opacity: [0.9, 0.6, 0.9] } : { rx: 104, opacity: 0.9 }}
            transition={isShaking ? { repeat: Infinity, duration: 0.32 } : { duration: 0.3 }}
          />

          {/* ---------------- body ---------------- */}
          <g>
            <path d="M52 140 h216 a6 6 0 0 1 6 6 v112 a10 10 0 0 1 -10 10 H56 a10 10 0 0 1 -10 -10 V146 a6 6 0 0 1 6 -6 z" fill="url(#ld-face)" />
            {/* right side face for depth */}
            <path d="M246 140 h22 a6 6 0 0 1 6 6 v112 a10 10 0 0 1 -10 10 h-18 z" fill="url(#ld-side)" />
            {/* open mouth, revealed once the lid lifts */}
            <path d="M46 140 h228 v16 H46 z" fill="#3d080a" />
            <path d="M46 140 h228 v6 H46 z" fill="#1b0304" />
            <motion.ellipse
              cx="160"
              cy="146"
              rx="96"
              ry="12"
              fill="#ffdf9a"
              initial={false}
              animate={{ opacity: isOpen ? 0.75 : 0 }}
              transition={{ duration: 0.4 }}
            />
            {/* vertical ribbon */}
            <rect x="138" y="156" width="44" height="112" fill="url(#ld-gold)" />
            <rect x="138" y="156" width="44" height="112" fill="url(#ld-sheen)" />
            {/* sheen across the body */}
            <path d="M52 156 h216 v34 L52 214 z" fill="url(#ld-sheen)" opacity=".5" />
          </g>

          {/* ---------------- lid ---------------- */}
          <motion.g
            initial={false}
            animate={
              isOpen
                ? { y: -132, rotate: -16, x: -26, opacity: 0 }
                : { y: 0, rotate: 0, x: 0, opacity: 1 }
            }
            transition={{ type: "spring", stiffness: 140, damping: 13 }}
            style={{ originX: "160px", originY: "120px" }}
          >
            <path d="M38 104 h244 a10 10 0 0 1 10 10 v22 a8 8 0 0 1 -8 8 H36 a8 8 0 0 1 -8 -8 v-22 a10 10 0 0 1 10 -10 z" fill="url(#ld-lid)" />
            <path d="M38 104 h244 a10 10 0 0 1 10 10 v6 H28 v-6 a10 10 0 0 1 10 -10 z" fill="#ffffff" opacity=".18" />
            <rect x="138" y="104" width="44" height="40" fill="url(#ld-gold)" />
            {/* ribbon running round the lid */}
            <rect x="28" y="118" width="264" height="12" fill="url(#ld-gold-h)" opacity=".95" />

            {/* bow */}
            <g>
              <path d="M160 104 C 126 100, 104 82, 112 68 C 120 55, 148 66, 160 100 Z" fill="url(#ld-gold)" />
              <path d="M160 104 C 194 100, 216 82, 208 68 C 200 55, 172 66, 160 100 Z" fill="url(#ld-gold)" />
              <path d="M160 104 C 132 100, 114 86, 116 74 C 130 72, 150 86, 160 102 Z" fill="#ffffff" opacity=".22" />
              <ellipse cx="160" cy="102" rx="17" ry="14" fill="url(#ld-gold)" />
              <ellipse cx="155" cy="98" rx="7" ry="5" fill="#fff6d6" opacity=".7" />
            </g>
          </motion.g>
        </svg>
      </motion.div>
    </div>
  )
}
