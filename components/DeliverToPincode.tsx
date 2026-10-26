"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { MapPin, ChevronDown, Check, LocateFixed, Loader2, ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { detectDeliveryPincode } from "@/lib/delivery-location-client"

const STORAGE_KEY = "delivery_pincode"
const SAVED_AT_KEY = "delivery_pincode_saved_at"
const CHANGE_EVENT = "delivery-pincode-change"
const MAX_AGE = 30 * 24 * 60 * 60 * 1000
const validPincode = (value: string) => /^[1-9]\d{5}$/.test(value)

export default function DeliverToPincode({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [pincode, setPincode] = useState("")
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [consent, setConsent] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState("")
  const [detected, setDetected] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const detection = useRef<AbortController | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const inputId = useId()
  const detailsId = useId()

  useEffect(() => {
    const sync = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || ""
        const savedAt = Number(localStorage.getItem(SAVED_AT_KEY))
        if (savedAt && Date.now() - savedAt > MAX_AGE) {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(SAVED_AT_KEY)
          setPincode("")
        } else if (validPincode(saved)) {
          setPincode(saved)
          if (!savedAt) localStorage.setItem(SAVED_AT_KEY, String(Date.now()))
        } else setPincode("")
      } catch { /* Manual selection still works when storage is unavailable. */ }
    }
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener(CHANGE_EVENT, sync)
      detection.current?.abort()
    }
  }, [])

  const cancelDetection = () => {
    detection.current?.abort()
    detection.current = null
    setDetecting(false)
    setConsent(false)
  }
  const changeOpen = (next: boolean) => {
    cancelDetection()
    setOpen(next)
    setDraft(pincode)
    setError("")
    setDetected(false)
    setShowDetails(false)
  }
  const apply = () => {
    if (!validPincode(draft)) return
    cancelDetection()
    setPincode(draft)
    try {
      localStorage.setItem(STORAGE_KEY, draft)
      localStorage.setItem(SAVED_AT_KEY, String(Date.now()))
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch { /* Current selection remains available for this page. */ }
    setOpen(false)
  }
  const clear = () => {
    cancelDetection()
    setPincode("")
    setDraft("")
    setDetected(false)
    setError("")
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(SAVED_AT_KEY)
      window.dispatchEvent(new Event(CHANGE_EVENT))
      setStorageWarning(false)
    } catch { setStorageWarning(true) }
  }
  const detect = async () => {
    if (!consent || detecting) return
    const controller = new AbortController()
    detection.current = controller
    setDetecting(true)
    setError("")
    setDetected(false)
    try {
      const result = await detectDeliveryPincode(consent, controller.signal)
      if (!controller.signal.aborted) { setDraft(result); setDetected(true) }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not detect your location. Enter your pincode manually.")
    } finally {
      if (detection.current === controller) { detection.current = null; setDetecting(false); setConsent(false) }
    }
  }

  const triggerClass = variant === "dark" ? "text-white/80 hover:text-white" : "text-gray-700 hover:text-brand-primary"

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button type="button" className={`flex min-h-11 items-center gap-2 text-sm transition-colors ${triggerClass}`} aria-label={`Set delivery location${pincode ? `, current pincode ${pincode}` : ""}`}>
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="flex flex-col items-start gap-1 leading-none">
            <span className="text-[10px]">Deliver to</span>
            <span className="text-[13px] font-semibold">{pincode || "Select location"}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-md overflow-y-auto rounded-2xl p-5 text-gray-800 sm:p-6" onOpenAutoFocus={event => { event.preventDefault(); titleRef.current?.focus() }}>
        <DialogHeader className="pr-5 text-left">
          <DialogTitle ref={titleRef} tabIndex={-1} className="leading-snug outline-none">Choose your delivery location</DialogTitle>
          <DialogDescription>Enter your pincode or detect it once. Confirm your delivery address at checkout.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <button type="button" onClick={detect} disabled={!consent || detecting} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-primary bg-white px-3 py-3 text-sm font-semibold text-brand-primary hover:bg-gray-50 disabled:opacity-50">
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {detecting ? "Detecting location…" : "Use my current location"}
          </button>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[clamp(0.5rem,2.7vw,0.6875rem)]">
            <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-gray-600">
              <input type="checkbox" checked={consent} onChange={event => { if (!event.target.checked) cancelDetection(); else setConsent(true) }} className="h-3.5 w-3.5 shrink-0 accent-brand-primary" />
              <span>I agree to one-time location use &amp; terms (18+).</span>
            </label>
            <button type="button" onClick={() => setShowDetails(value => !value)} aria-expanded={showDetails} aria-controls={detailsId} className="min-h-11 shrink-0 font-medium text-brand-primary underline">
              {showDetails ? "View less" : "View more"}
            </button>
          </div>
          {showDetails && <div id={detailsId} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-brand-primary" />Your location, your choice</p>
            <p className="text-xs leading-relaxed text-gray-600">
              Under the DPDP Act, 2023, location use is optional and needs your consent. We access your location once to find your pincode and share coordinates rounded to three decimal places with OpenStreetMap (Nominatim), which may process them outside India. We do not save coordinates or track you in the background.
            </p>
            <p className="text-xs leading-relaxed text-gray-600">Only your chosen pincode is saved on this device for up to 30 days. We retain a versioned consent record. You can cancel detection and clear your pincode below. <Link href="/privacy-policy#delivery-location" className="font-medium text-brand-primary underline" onClick={() => changeOpen(false)}>Location privacy notice &amp; your rights</Link>.</p>
            <p className="text-xs leading-relaxed text-gray-600">I am 18 or older and agree to this one-time location use. I can also enter my pincode without granting location access.</p>
          </div>}
          {detecting && <button type="button" onClick={cancelDetection} className="min-h-11 w-full text-sm text-gray-600 underline">Cancel &amp; withdraw location consent</button>}
          {error && <p role="alert" className="text-xs leading-relaxed text-red-600">{error}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />or enter pincode manually<span className="h-px flex-1 bg-gray-200" /></div>
        <form onSubmit={event => { event.preventDefault(); apply() }} className="space-y-3">
          <label htmlFor={inputId} className="block text-sm font-medium">Delivery pincode</label>
          <div className="flex gap-2">
            <input id={inputId} type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={draft}
              onChange={event => { setDraft(event.target.value.replace(/\D/g, "").slice(0, 6)); setDetected(false) }}
              placeholder="e.g. 560027" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            <button type="submit" disabled={!validPincode(draft)} className="flex min-h-11 items-center justify-center gap-1 rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-50">
              <Check className="h-4 w-4" /> Apply
            </button>
          </div>
          {detected && <div className="space-y-1 text-xs">
            <p role="status" className="text-green-700">Pincode detected. Please verify it and tap Apply.</p>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">Location data © OpenStreetMap contributors</a>
          </div>}
        </form>
        <button type="button" onClick={clear} className="min-h-11 text-sm font-medium text-gray-600 underline">Clear saved pincode &amp; stop location access</button>
        {storageWarning && <p role="alert" className="text-xs text-red-600">Browser storage is blocked. Clear this site&apos;s data in your browser settings to remove a previously saved pincode.</p>}
      </DialogContent>
    </Dialog>
  )
}
