"use client"

import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import {
  Sparkles, PartyPopper, Gift, Trophy, X, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, FileText, Loader2, Phone, Mail, User, ShieldCheck, KeyRound
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

// Default fallback Prize segments for the wheel
const DEFAULT_SEGMENTS: { name: string, color: string, textColor: string, icon: string, img?: HTMLImageElement | null, productImage?: string | null }[] = [
  { name: "TV", color: "#ffffff", textColor: "#000000", icon: "📺" },
  { name: "SPEAKER", color: "#f3f4f6", textColor: "#000000", icon: "🔊" },
  { name: "₹500 VOUCHER", color: "#ffffff", textColor: "#000000", icon: "🎫" },
  { name: "HOME THEATRE", color: "#f3f4f6", textColor: "#000000", icon: "🎬" },
  { name: "CAR", color: "#ffffff", textColor: "#000000", icon: "🚗" },
  { name: "IPHONE", color: "#f3f4f6", textColor: "#000000", icon: "📱" },
  { name: "SAMSUNG PHONE", color: "#ffffff", textColor: "#000000", icon: "📱" },
  { name: "SOUNDBAR", color: "#f3f4f6", textColor: "#000000", icon: "🎵" },
  { name: "BETTER LUCK\nNEXT TIME", color: "#ffffff", textColor: "#000000", icon: "🍀" },
]

const TERMS = [
  "One user = one spin. No re-spins allowed.",
  "Campaign valid only for April 2026.",
  "Applicable for selected offline stores only.",
  "Coupon must be shown at billing counter to claim the prize.",
  "Prizes are subject to availability and cannot be exchanged for cash.",
  "The decision of the management is final and binding.",
  "Valid government ID is required for prize collection.",
]

/** Play synthesized tick sound */
function playTickSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.1)
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.1)
  } catch (e) {
    // Ignore audio errors
  }
}

/** Play synthesized win celebration sound */
function playWinSound(isBetterLuck: boolean) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    if (isBetterLuck) {
      // Sad sound
      oscillator.type = "triangle"
      oscillator.frequency.setValueAtTime(300, audioCtx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 1)
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1)
      oscillator.start(audioCtx.currentTime)
      oscillator.stop(audioCtx.currentTime + 1)
    } else {
      // Happy chord progression (C - E - G - C)
      const now = audioCtx.currentTime
      oscillator.type = "sine"
      gainNode.gain.setValueAtTime(0.2, now)

      oscillator.frequency.setValueAtTime(261.63, now) // C4
      oscillator.frequency.setValueAtTime(329.63, now + 0.1) // E4
      oscillator.frequency.setValueAtTime(392.00, now + 0.2) // G4
      oscillator.frequency.setValueAtTime(523.25, now + 0.3) // C5

      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5)
      oscillator.start(now)
      oscillator.stop(now + 1.5)
    }
  } catch (e) { console.error("[spin] audio error", e) }
}

// Wrapper with Suspense for useSearchParams
export default function SpinWheelPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
    }>
      <SpinWheelPage />
    </Suspense>
  )
}

/** Render the spin wheel for a specific campaign (used by /spin/[slug]) */
export function SpinWheelPageWithCampaign({ campaignId }: { campaignId: string }) {
  return <SpinWheelPage campaignId={campaignId} />
}

function SpinWheelPage({ campaignId }: { campaignId?: string }) {
  const searchParams = useSearchParams()
  const store = searchParams.get("store") || "direct"
  const activeCampaign = campaignId || "default"
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Dynamic Prizes
  const [prizeSegments, setPrizeSegments] = useState(DEFAULT_SEGMENTS)
  const [preloadedImages, setPreloadedImages] = useState<{ [key: number]: HTMLImageElement }>({})
  const [lastInventoryFetch, setLastInventoryFetch] = useState<number>(0)
  const [isInventoryFresh, setIsInventoryFresh] = useState(false)

  // Reusable fetch function — returns a promise that resolves when images are preloaded
  // Will skip fetch if data is fresh (less than 5 minutes old)
  const fetchInventory = useCallback((forceRefresh = false) => {
    return new Promise<void>((resolve) => {
      const now = Date.now()
      const cacheTime = 5 * 60 * 1000 // 5 minutes
      
      // Skip fetch if data is fresh and not force refreshing
      if (!forceRefresh && isInventoryFresh && (now - lastInventoryFetch) < cacheTime) {
        console.log(`[INVENTORY_FETCH_SKIPPED] Using cached inventory (${Math.round((now - lastInventoryFetch) / 1000)}s old)`)
        resolve()
        return
      }

      console.log(`[INVENTORY_FETCH_START] Fetching fresh inventory...`)
      fetch(`/api/spin-wheel/admin/inventory?campaignId=${activeCampaign}`)
        .then(r => r.json())
        .then(data => {
          if (data.inventory) {
            console.log(`[INVENTORY_FETCH_SUCCESS] Received ${data.inventory.length} prizes`)
            const active = data.inventory.filter((p: any) => p.isActive)
            const colors = ["#ffffff", "#f3f4f6"]
            const mapped = active.map((p: any, i: number) => {
              const isBetterLuck = p.prizeName === "BETTER LUCK NEXT TIME"
              return {
                name: isBetterLuck ? "BETTER LUCK\nNEXT TIME" : p.prizeName,
                color: isBetterLuck ? "#6B7280" : colors[i % colors.length],
                textColor: "#fff",
                icon: p.emoji || "\uD83C\uDF81",
                productImage: p.productImage || null
              }
            })
            setPrizeSegments(mapped)
            setLastInventoryFetch(now)
            setIsInventoryFresh(true)

            // Preload images
            const images: { [key: number]: HTMLImageElement } = {}
            let loaded = 0
            let toLoad = 0
            mapped.forEach((seg: any, idx: number) => {
              if (seg.productImage) {
                toLoad++
                const img = new window.Image()
                img.crossOrigin = "anonymous"
                img.src = seg.productImage
                img.onload = () => {
                  images[idx] = img
                  loaded++
                  if (loaded === toLoad) {
                    setPreloadedImages({ ...images })
                    resolve()
                  }
                }
                img.onerror = () => {
                  loaded++
                  if (loaded === toLoad) {
                    setPreloadedImages({ ...images })
                    resolve()
                  }
                }
              }
            })
            if (toLoad === 0) {
              setPreloadedImages({})
              resolve()
            }
          } else {
            resolve()
          }
        })
        .catch((err) => {
          console.error(`[INVENTORY_FETCH_ERROR]`, err)
          resolve()
        })
    })
  }, [lastInventoryFetch, isInventoryFresh])

  // Fetch on mount
  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // Registration & OTP State
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showOtpStep, setShowOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [verificationToken, setVerificationToken] = useState<string | null>(null)

  // Loading states
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  // App state
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [agreedToPreTerms, setAgreedToPreTerms] = useState(false)

  // Wheel State
  const [isSpinning, setIsSpinning] = useState(false)
  const [spinResult, setSpinResult] = useState<{ prize: string; couponCode: string | null; image?: string | null; icon?: string } | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [currentRotation, setCurrentRotation] = useState(0)
  const [wheelReady, setWheelReady] = useState(false)

  // Track visit on load
  useEffect(() => {
    fetch("/api/spin-wheel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store, campaignId: activeCampaign })
    }).catch(() => { })
  }, [store])

  // Fire confetti
  const triggerConfetti = useCallback(() => {
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
      })
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])

  // Draw the wheel — fully rewritten for perfect image + name at any angle
  const drawWheel = useCallback((rotation: number = 0) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = canvas.width
    const center = size / 2
    const radius = center - 15
    const segments = prizeSegments.length
    const arc = (2 * Math.PI) / segments
    const rotationRad = (rotation * Math.PI) / 180

    ctx.clearRect(0, 0, size, size)

    // Outer rim
    ctx.save()
    ctx.beginPath()
    ctx.arc(center, center, radius + 10, 0, 2 * Math.PI)
    const rimGrad = ctx.createLinearGradient(center, 0, center, size)
    rimGrad.addColorStop(0, "#e8e8e8")
    rimGrad.addColorStop(0.5, "#f8f8f8")
    rimGrad.addColorStop(1, "#d4d4d4")
    ctx.fillStyle = rimGrad
    ctx.fill()
    ctx.shadowColor = "rgba(0,0,0,0.15)"
    ctx.shadowBlur = 12
    ctx.strokeStyle = "#c0c0c0"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // Rotation wrapper
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(rotationRad)
    ctx.translate(-center, -center)

    // --- Draw each segment ---
    for (let i = 0; i < segments; i++) {
      const startAngle = i * arc - Math.PI / 2
      const endAngle = startAngle + arc
      const midAngle = startAngle + arc / 2
      const segment = prizeSegments[i]

      // --- Wedge background ---
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#f3f4f6"
      ctx.fill()
      ctx.strokeStyle = "#d1d5db"
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()

      // --- Content: image/icon + text ---
      ctx.save()
      ctx.translate(center, center)
      ctx.rotate(midAngle)
      // Now +X axis points to the middle of this segment's outer edge

      // Compute available width for the wedge at the text position
      // The chord half-width at distance d from center = d * sin(arc/2)
      const imgSize = Math.min(44, radius * 0.22)
      // Keep image inside and reserve outer ring for text
      const imgDist = radius * 0.48

      // --- Draw image or emoji icon ---
      if (segment.productImage && preloadedImages[i]) {
        // Draw image aligned to the wedge
        ctx.save()
        ctx.translate(imgDist, 0)
        // Counter-rotate so the icon stays upright (matches reference design)
        ctx.rotate(-midAngle - rotationRad)
        // Rounded rect clip for the image
        const halfImg = imgSize / 2
        ctx.beginPath()
        ctx.arc(0, 0, halfImg + 2, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.fillStyle = "#fff"
        ctx.fill()
        ctx.strokeStyle = "#e5e7eb"
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, halfImg, 0, 2 * Math.PI)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(preloadedImages[i], -halfImg, -halfImg, imgSize, imgSize)
        ctx.restore()
      } else {
        // Emoji fallback
        ctx.save()
        ctx.translate(imgDist, 0)
        // Counter-rotate so the emoji stays upright (matches reference design)
        ctx.rotate(-midAngle - rotationRad)
        const emojiFontSize = Math.min(28, radius * 0.14)
        ctx.font = `${emojiFontSize}px 'Inter', system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(segment.icon, 0, 0)
        ctx.restore()
      }

      // --- Draw text label (upright, wrapped) ---
      ctx.save()
      // Keep label near outer ring (reference style) and away from the image
      const textDist = radius * 0.8
      ctx.translate(textDist, 0)
      // Counter-rotate so the label stays upright (matches reference design)
      ctx.rotate(-midAngle - rotationRad)

      const rawName = (segment.name || "").trim()
      const forcedLines = rawName.split("\n").map((l: string) => l.trim()).filter(Boolean)
      const maxTextWidth = 2 * textDist * Math.sin(arc / 2) * 0.9

      const wrapOneLine = (input: string) => {
        const words = input.split(/\s+/).filter(Boolean)
        if (words.length <= 1) return [input]

        const lines: string[] = []
        let current = ""

        for (const w of words) {
          const test = current ? `${current} ${w}` : w
          if (ctx.measureText(test).width <= maxTextWidth) {
            current = test
          } else {
            if (current) lines.push(current)
            current = w
          }
        }
        if (current) lines.push(current)
        return lines
      }

      let fontSize = Math.min(13, radius * 0.07)
      if (segments > 8) fontSize = Math.min(12, radius * 0.058)

      let nameLines: string[] = []
      for (let attempt = 0; attempt < 6; attempt++) {
        ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`
        nameLines = []
        for (const fl of (forcedLines.length ? forcedLines : [rawName])) {
          nameLines.push(...wrapOneLine(fl))
        }

        const tooManyLines = nameLines.length > 3
        const anyTooWide = nameLines.some((l: string) => ctx.measureText(l).width > maxTextWidth)
        if (!tooManyLines && !anyTooWide) break
        fontSize *= 0.9
      }

      if (nameLines.length > 3) {
        nameLines = nameLines.slice(0, 3)
        const last = nameLines[2]
        const ellipsis = "…"
        ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`
        let trimmed = last
        while (trimmed.length > 1 && ctx.measureText(`${trimmed}${ellipsis}`).width > maxTextWidth) {
          trimmed = trimmed.slice(0, -1)
        }
        nameLines[2] = `${trimmed}${ellipsis}`
      }

      ctx.font = `bold ${fontSize}px 'Inter', system-ui, sans-serif`
      ctx.fillStyle = "#111827"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const lineHeight = fontSize * 1.25
      const totalHeight = nameLines.length * lineHeight
      const startY = -totalHeight / 2 + lineHeight / 2

      nameLines.forEach((line: string, li: number) => {
        ctx.fillText(line, 0, startY + li * lineHeight)
      })
      ctx.restore()

      ctx.restore() // end segment
    }

    // --- Center hub ---
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.1)"
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(center, center, 42, 0, 2 * Math.PI)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.strokeStyle = "#d1d5db"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.arc(center, center, 16, 0, 2 * Math.PI)
    const dotGrad = ctx.createRadialGradient(center, center, 0, center, center, 16)
    dotGrad.addColorStop(0, "#374151")
    dotGrad.addColorStop(1, "#111827")
    ctx.fillStyle = dotGrad
    ctx.fill()
    ctx.restore()

    ctx.restore() // end rotation wrapper

    // --- Pointer triangle at top ---
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(center - 16, -2)
    ctx.lineTo(center + 16, -2)
    ctx.lineTo(center, 28)
    ctx.closePath()
    const ptrGrad = ctx.createLinearGradient(center, -2, center, 28)
    ptrGrad.addColorStop(0, "#1f2937")
    ptrGrad.addColorStop(1, "#111827")
    ctx.fillStyle = ptrGrad
    ctx.shadowColor = "rgba(0,0,0,0.3)"
    ctx.shadowBlur = 4
    ctx.fill()
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }, [prizeSegments, preloadedImages])

  // Re-draw wheel whenever participantId changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const size = Math.min(400, window.innerWidth - 40)
      canvas.width = size
      canvas.height = size
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      drawWheel(0)
      setWheelReady(true)
    }
  }, [drawWheel, participantId, prizeSegments])

  // Basic Form Validation
  const validateForm = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = "Name is required"
    if (!formData.phone.trim()) errs.phone = "Phone number is required"
    else if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, "").slice(-10)))
      errs.phone = "Enter a valid 10-digit phone number"
    if (!formData.email.trim()) errs.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = "Enter a valid email address"
    if (!agreedToPreTerms) errs.preTerms = "You must read and agree to the Terms & Conditions"

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Handle Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSendingOtp(true)
    setErrors({})
    try {
      const res = await fetch("/api/spin-wheel/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.phone,
          email: formData.email,
          name: formData.name,
          senderNumber: formData.phone,
          campaignId: activeCampaign
        })
      })
      const data = await res.json()

      if (res.status === 409 || data.error === "duplicate") {
        setShowDuplicateModal(true)
        return
      }

      if (!res.ok) {
        setErrors({ general: data.error || "Failed to send OTP" })
        return
      }

      setShowOtpStep(true)
    } catch {
      setErrors({ general: "Network error. Please try again." })
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length < 6) {
      setErrors({ otp: "Please enter a valid 6-digit OTP" })
      return
    }

    setIsVerifyingOtp(true)
    setErrors({})
    try {
      const res = await fetch("/api/spin-wheel/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.phone,
          otp: otpCode,
          campaignId: activeCampaign
        })
      })
      const data = await res.json()

      if (!res.ok) {
        setErrors({ otp: data.error || "Invalid OTP" })
        return
      }

      // OTP Verified - Proceed to register
      setVerificationToken(data.verificationToken)
      await submitRegistration(data.verificationToken)
    } catch {
      setErrors({ otp: "Network error. Please try again." })
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  // Submit Final Registration (after OTP validated) with retry logic
  const submitRegistration = async (token: string, retryCount = 0) => {
    setIsRegistering(true)
    try {
      const res = await fetch("/api/spin-wheel/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          store,
          verificationToken: token,
          senderNumber: formData.phone,
          campaignId: activeCampaign
        })
      })

      // Retry on 503 (Vercel cold start timeout)
      if (res.status === 503 && retryCount < 2) {
        const delay = (retryCount + 1) * 1500 // 1.5s, 3s
        await new Promise(resolve => setTimeout(resolve, delay))
        return submitRegistration(token, retryCount + 1)
      }

      const data = await res.json()

      if (res.status === 409 || data.error === "duplicate") {
        setShowDuplicateModal(true)
        return
      }

      if (!res.ok) {
        setErrors({ general: data.error || "Registration failed" })
        setShowOtpStep(false)
        return
      }

      setParticipantId(data.participantId)
    } catch {
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 1500
        await new Promise(resolve => setTimeout(resolve, delay))
        return submitRegistration(token, retryCount + 1)
      }
      setErrors({ general: "Registration network error. Please try again." })
    } finally {
      setIsRegistering(false)
    }
  }

  // Spin the wheel
  const handleSpin = async () => {
    if (isSpinning || !participantId || !acceptedTerms) {
      if (!acceptedTerms) setErrors({ terms: "Please accept the Terms & Conditions to spin" })
      return
    }
    setErrors({})
    setIsSpinning(true)

    try {
      // Only refetch inventory if stale, don't force refresh (reduces network calls)
      await fetchInventory(false)

      const res = await fetch("/api/spin-wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, campaignId: activeCampaign })
      })
      const data = await res.json()

      if (data.error === "already_spun") {
        const winSegment = prizeSegments.find(
          s => s.name.replace("\n", " ") === data.prize || s.name === data.prize
        )
        setSpinResult({
          prize: data.prize,
          couponCode: data.couponCode,
          image: winSegment?.img?.src || null,
          icon: winSegment?.icon
        })
        setShowResultModal(true)
        setIsSpinning(false)
        return
      }

      if (!res.ok) {
        setIsSpinning(false)
        setErrors({ general: data.error || "Error spinning. Try again." })
        return
      }

      const isBetterLuck = data.prize === "BETTER LUCK NEXT TIME"

      // Find the winning segment index
      const winIndex = prizeSegments.findIndex(
        s => s.name.replace("\n", " ") === data.prize || s.name === data.prize
      )

      // Fallback index if prize name mismatch (shouldn't happen)
      const targetIndex = winIndex !== -1 ? winIndex : prizeSegments.length - 1

      // Calculate rotation
      const segmentAngle = 360 / prizeSegments.length
      const targetAngle = 360 - (targetIndex * segmentAngle + segmentAngle / 2)
      const fullSpins = 6 * 360 // 6 full rotations
      const finalRotation = currentRotation + fullSpins + targetAngle - (currentRotation % 360)

      // Animate the wheel
      const startTime = performance.now()
      const duration = 6000 // 6 seconds
      const startRotation = currentRotation

      let lastTickAngle = currentRotation

      const animate = (time: number) => {
        const elapsed = time - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Custom easing for wheel spin (ease out cubic)
        const eased = 1 - Math.pow(1 - progress, 3)
        const rotation = startRotation + (finalRotation - startRotation) * eased

        drawWheel(rotation)

        // Play tick sound every ~segmentAngle rotated
        if (rotation - lastTickAngle > segmentAngle * 0.8) {
          playTickSound()
          lastTickAngle = rotation
        }

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setCurrentRotation(finalRotation)
          const winSegment = prizeSegments[targetIndex]
          setSpinResult({
            prize: data.prize,
            couponCode: data.couponCode,
            image: winSegment?.img?.src || null,
            icon: winSegment?.icon
          })

          playWinSound(isBetterLuck)
          if (!isBetterLuck) {
            triggerConfetti()
          }

          setTimeout(() => {
            setShowResultModal(true)
            setIsSpinning(false)
          }, 600)
        }
      }

      requestAnimationFrame(animate)
    } catch {
      setIsSpinning(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 overflow-x-hidden relative">

      {/* Main Content */}
      <section className="py-8 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          {!participantId ? (
            /* Registration & OTP Form area */
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
                {/* Loader Overlay */}
                {(isRegistering) && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-2" />
                    <p className="font-medium animate-pulse">Finalizing Registration...</p>
                  </div>
                )}

                <div className="text-center mb-6 relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {showOtpStep ? "Verify OTP" : "Fill the Form to Spin"}
                  </h2>
                  <p className="text-white/50 text-sm">
                    {showOtpStep ? `Sent to ******${formData.phone.slice(-4)}` : "Secure OTP verification required"}
                  </p>
                </div>

                {errors.general && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2 relative z-10">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errors.general}
                  </div>
                )}

                {!showOtpStep ? (
                  /* Step 1: User Details Form */
                  <form onSubmit={handleSendOtp} className="space-y-4 relative z-10">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5"><User className="w-3.5 h-3.5 inline mr-1.5" />Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className={`w-full px-4 py-3 bg-slate-700/50 border ${errors.name ? "border-red-500/50" : "border-white/10"} rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-amber-500/50 transition-all`}
                        placeholder="Enter your full name"
                      />
                      {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5"><Phone className="w-3.5 h-3.5 inline mr-1.5" />Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className={`w-full px-4 py-3 bg-slate-700/50 border ${errors.phone ? "border-red-500/50" : "border-white/10"} rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-amber-500/50 transition-all`}
                        placeholder="10-digit phone number"
                        maxLength={10}
                      />
                      {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5"><Mail className="w-3.5 h-3.5 inline mr-1.5" />Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full px-4 py-3 bg-slate-700/50 border ${errors.email ? "border-red-500/50" : "border-white/10"} rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-amber-500/50 transition-all`}
                        placeholder="you@example.com"
                      />
                      {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                    </div>

                    {/* Pre-Terms Checkbox */}
                    <div className="pt-2 pb-1">
                      <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${agreedToPreTerms ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-800/80 border-white/10 hover:border-white/30'} ${errors.preTerms ? 'border-red-500 bg-red-500/5' : ''}`}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 mt-0.5 rounded border-gray-400 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 flex-shrink-0"
                          checked={agreedToPreTerms}
                          onChange={(e) => {
                            setAgreedToPreTerms(e.target.checked)
                            if (e.target.checked && errors.preTerms) {
                              const newErrors = { ...errors }; delete newErrors.preTerms; setErrors(newErrors);
                            }
                          }}
                        />
                        <span className="text-xs text-white/70 select-none leading-relaxed">
                          I confirm my details are accurate and I agree to the <a href="/spin/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-amber-400 hover:text-amber-300 underline font-bold whitespace-nowrap">Official Terms</a>, including the "one spin per person" rule.
                        </span>
                      </label>
                      {errors.preTerms && <p className="text-red-400 text-xs text-center font-medium mt-2">{errors.preTerms}</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingOtp || !agreedToPreTerms}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-pink-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-pink-600 transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                      {isSendingOtp ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                      ) : (
                        <>Send OTP <Sparkles className="w-4 h-4" /></>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: OTP Entry Form */
                  <form onSubmit={handleVerifyOtp} className="space-y-5 relative z-10">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                      <p className="text-amber-300 text-sm">OTP has been sent to your WhatsApp and Email.</p>
                      <p className="text-white/50 text-xs mt-1">Valid for 5 minutes.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1.5"><KeyRound className="w-3.5 h-3.5 inline mr-1.5" />Enter 6-Digit OTP</label>
                      <input
                        type="text"
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold bg-slate-700/50 border ${errors.otp ? "border-red-500/50" : "border-white/10"} rounded-xl text-white placeholder-white/20 focus:ring-2 focus:ring-amber-500/50 transition-all`}
                        placeholder="------"
                        maxLength={6}
                      />
                      {errors.otp && <p className="text-red-400 text-xs mt-1 text-center">{errors.otp}</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifyingOtp || otpCode.length < 6}
                      className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isVerifyingOtp ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</>
                      ) : (
                        <><CheckCircle2 className="w-5 h-5" /> Verify & Continue</>
                      )}
                    </button>

                    <div className="text-center mt-4">
                      <button
                        type="button"
                        onClick={() => setShowOtpStep(false)}
                        className="text-white/50 text-sm hover:text-white transition-colors underline"
                      >
                        Change Details / Resend OTP
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          ) : (
            /* Spin Wheel Section (After Registration) */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  🎉 Welcome, <span className="text-amber-600">{formData.name}</span>!
                </h2>
                <p className="text-gray-500">Accept the terms below and tap spin!</p>
              </div>

              {/* Wheel */}
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-black/5 rounded-full blur-2xl scale-110" />
                <div className="relative p-2 bg-gradient-to-br from-gray-200 to-white rounded-full shadow-2xl shadow-black/10 text-center flex justify-center items-center">
                  <div className="bg-white rounded-full p-1 inline-flex justify-center items-center">
                    <canvas ref={canvasRef} className="rounded-full mx-auto" style={{ maxWidth: "400px", maxHeight: "400px", display: "block" }} />
                  </div>
                </div>

              </div>

              {/* T&C Checkbox and Spin Button */}
              {!spinResult && (
                <div className="w-full max-w-sm flex flex-col gap-4">
                  {/* Mandatory T&C */}
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${acceptedTerms ? 'bg-black/5 border-black/20' : 'bg-white border-gray-200 hover:border-gray-300'} ${errors.terms ? 'border-red-500 bg-red-50' : ''}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 mt-0.5 rounded border-gray-400 text-black focus:ring-black focus:ring-offset-white"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked)
                        if (e.target.checked) setErrors({})
                      }}
                    />
                    <span className="text-sm text-gray-700 select-none">
                      I have read and agree to all the <span className="text-black font-bold underline">Terms & Conditions</span>. I understand this action is final and I cannot spin again.
                    </span>
                  </label>
                  {errors.terms && <p className="text-red-500 text-xs font-bold text-center">{errors.terms}</p>}

                  {/* General error fallback */}
                  {errors.general && <p className="text-red-500 text-xs font-bold text-center">{errors.general}</p>}

                  <motion.button
                    onClick={handleSpin}
                    disabled={isSpinning || !acceptedTerms}
                    whileHover={{ scale: (isSpinning || !acceptedTerms) ? 1 : 1.02 }}
                    whileTap={{ scale: (isSpinning || !acceptedTerms) ? 1 : 0.98 }}
                    className={`w-full py-4 text-white font-bold text-xl tracking-tight rounded-[20px] flex items-center justify-center gap-3 transition-all ${acceptedTerms && !isSpinning
                      ? 'bg-black shadow-xl hover:shadow-2xl'
                      : 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed'
                      }`}
                  >
                    {isSpinning ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> Spinning...</>
                    ) : (
                      <>Spin Now!</>
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>


      {/* Result Modal (Full Screen with glowing overlay) */}
      <AnimatePresence>
        {showResultModal && spinResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowResultModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", damping: 20 }}
              onClick={e => e.stopPropagation()}
              className={`bg-slate-800 rounded-[2rem] p-8 max-w-md w-full border-4 shadow-2xl relative overflow-hidden ${spinResult.prize !== "BETTER LUCK NEXT TIME" ? "border-amber-400/50 shadow-amber-500/20" : "border-slate-600/50"
                }`}
            >
              {spinResult.prize !== "BETTER LUCK NEXT TIME" && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-pink-500/10 to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
              )}

              <button
                onClick={() => setShowResultModal(false)}
                className="absolute top-5 right-5 w-8 h-8 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/40 transition-all z-20"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="relative z-10 text-center pt-2">
                {spinResult.prize !== "BETTER LUCK NEXT TIME" ? (
                  <>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", delay: 0.1, bounce: 0.5 }}
                      className="text-7xl mb-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] flex justify-center items-center"
                    >
                      {spinResult.image ? (
                        <img src={spinResult.image} alt={spinResult.prize} className="w-32 h-32 object-contain" />
                      ) : (
                        spinResult.icon || "🏆"
                      )}
                    </motion.div>
                    <h3 className="text-3xl font-extrabold text-white mb-2 tracking-tight">YOU WON!</h3>
                    <p className="text-amber-400 font-medium mb-5">Outstanding spin, {formData.name}!</p>

                    <div className="bg-gradient-to-br from-amber-500/20 to-pink-500/10 rounded-2xl p-6 mb-6 border border-amber-400/40 shadow-inner">
                      <p className="text-3xl font-black bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent mb-5 leading-tight">
                        {spinResult.prize}
                      </p>
                      {spinResult.couponCode && (
                        <div className="bg-slate-900/80 rounded-xl py-4 px-4 border border-white/5 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-pink-500" />
                          <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">Secret Coupon Code</p>
                          <p className="text-2xl font-mono font-bold text-white tracking-widest">
                            {spinResult.couponCode}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 text-left border border-white/10 mb-6 flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-white/70 text-sm leading-relaxed">
                        Show this <strong>coupon code and a valid ID</strong> at the billing counter to claim your prize. A confirmation is sent to your email & WhatsApp.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="text-6xl mb-6 grayscale"
                    >
                      🍀
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-3">Better Luck Next Time</h3>
                    <p className="text-white/60 mb-6 leading-relaxed">
                      Ah, so close! Thank you for participating, <span className="text-white font-medium">{formData.name}</span>.<br />
                      Visit our stores for more exciting offers and try again in future campaigns.
                    </p>

                    <button
                      onClick={() => setShowResultModal(false)}
                      className="w-full py-3 bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-600 transition-colors"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Participant Error Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-slate-800 rounded-[2rem] p-8 max-w-sm w-full border border-red-500/30 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-500/20">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Already Spun!</h3>
              <p className="text-white/60 mb-8 leading-relaxed">
                Our records show this phone or email has already participated. Fair play means only one spin per user!
              </p>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="w-full py-3.5 bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/30 hover:bg-red-500/30 hover:text-red-300 transition-all"
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt)
  const B = Math.min(255, (num & 0x0000ff) + amt)
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
}
