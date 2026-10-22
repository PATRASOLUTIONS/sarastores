"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, ChevronDown, Check } from "lucide-react"

const STORAGE_KEY = "delivery_pincode"

export default function DeliverToPincode({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [pincode, setPincode] = useState<string>("")
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setPincode(saved)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const apply = () => {
    const clean = draft.replace(/\D/g, "").slice(0, 6)
    if (clean.length !== 6) return
    setPincode(clean)
    try { localStorage.setItem(STORAGE_KEY, clean) } catch { /* ignore */ }
    setOpen(false)
  }

  const triggerClass =
    variant === "dark"
      ? "text-white/80 hover:text-white"
      : "text-gray-700 hover:text-brand-primary"

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setDraft(pincode); setOpen((o) => !o) }}
        className={`flex min-h-[24px] items-center gap-1.5 py-0.5 text-sm transition-colors ${triggerClass}`}
        aria-label="Set delivery location"
      >
        <MapPin className="h-4 w-4 flex-shrink-0" />
        <span className="flex flex-col items-start leading-none">
          <span className="text-[10px]">Deliver to</span>
          <span className="font-semibold text-[13px]">{pincode ? pincode : "Select location"}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-2xl border border-gray-100 p-4 text-gray-800">
          <p className="text-sm font-semibold text-gray-900 mb-1">Choose your location</p>
          <p className="text-xs text-gray-500 mb-3">Enter a 6-digit pincode to check delivery estimates.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter") apply() }}
            placeholder="e.g. 560027"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            autoFocus
          />
          <button
            onClick={apply}
            disabled={draft.replace(/\D/g, "").length !== 6}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
