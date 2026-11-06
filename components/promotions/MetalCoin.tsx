"use client"

import { useId } from "react"

/** Decorative illustration; the labelled gift determines the actual award. */
export default function MetalCoin({ tone, className = "h-12 w-12" }: { tone: "silver" | "gold"; className?: string }) {
  const gradient = useId()
  const gold = tone === "gold"
  return <svg viewBox="0 0 80 80" aria-hidden="true" className={className}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={gold ? "#fff0ad" : "#ffffff"} /><stop offset="0.45" stopColor={gold ? "#dfb145" : "#cbd1d8"} />
      <stop offset="0.7" stopColor={gold ? "#fff0b5" : "#f5f7fa"} /><stop offset="1" stopColor={gold ? "#b88320" : "#929ca8"} />
    </linearGradient></defs>
    <circle cx="40" cy="40" r="37" fill={`url(#${gradient})`} stroke={gold ? "#b88320" : "#8b96a3"} strokeWidth="2" />
    <circle cx="40" cy="40" r="30" fill="none" stroke={gold ? "#b88320" : "#8995a3"} strokeWidth="1.5" strokeDasharray="2 3" />
    <circle cx="40" cy="40" r="23" fill="none" stroke={gold ? "#c49430" : "#a6afb9"} />
    <path d="M40 23l4.5 10 11 1.5-8 7.5 2 11-9.5-5.5-9.5 5.5 2-11-8-7.5 11-1.5z" fill={gold ? "#c4912b" : "#a5afb9"} opacity=".65" />
  </svg>
}
