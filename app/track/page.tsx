"use client"

import { useState, useEffect, useRef } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Search, Package, Truck, MapPin, CheckCircle2, Clock, Loader2, ArrowRight, Box, Warehouse, Home, CircleDot } from "lucide-react"

interface TrackingEvent {
  status: string
  location: string
  timestamp: string
  description: string
}

interface TrackingData {
  orderId: string
  trackingNumber: string
  carrier: string
  currentStatus: string
  estimatedDelivery: string
  origin: string
  destination: string
  events: TrackingEvent[]
}

const STATUS_STEPS = [
  { key: "ordered", label: "Order Placed", icon: Box, color: "from-blue-500 to-blue-600" },
  { key: "processing", label: "Processing", icon: Warehouse, color: "from-indigo-500 to-indigo-600" },
  { key: "shipped", label: "Shipped", icon: Package, color: "from-violet-500 to-violet-600" },
  { key: "transit", label: "In Transit", icon: Truck, color: "from-amber-500 to-amber-600" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: MapPin, color: "from-orange-500 to-orange-600" },
  { key: "delivered", label: "Delivered", icon: Home, color: "from-emerald-500 to-emerald-600" },
]

function AnimatedTrackingVisual({ currentStep }: { currentStep: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const c = ctx as CanvasRenderingContext2D

    const W = canvas.width
    const H = canvas.height
    let frame = 0
    let animId: number

    // Helper: draw a person (stick figure with head)
    function drawPerson(x: number, y: number, scale: number, color: string) {
      const s = scale
      // Head
      c.fillStyle = "#fbbf24"
      c.beginPath()
      c.arc(x, y - 28 * s, 8 * s, 0, Math.PI * 2)
      c.fill()
      // Body
      c.strokeStyle = color
      c.lineWidth = 3 * s
      c.lineCap = "round"
      c.beginPath()
      c.moveTo(x, y - 20 * s)
      c.lineTo(x, y)
      c.stroke()
      // Arms
      c.beginPath()
      c.moveTo(x - 12 * s, y - 14 * s)
      c.lineTo(x + 12 * s, y - 14 * s)
      c.stroke()
      // Legs
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x - 8 * s, y + 14 * s)
      c.moveTo(x, y)
      c.lineTo(x + 8 * s, y + 14 * s)
      c.stroke()
    }

    // Helper: draw a box
    function drawBox(x: number, y: number, w: number, h: number, color: string) {
      c.fillStyle = color
      c.fillRect(x, y, w, h)
      c.strokeStyle = "#92400e"
      c.lineWidth = 1.5
      c.strokeRect(x, y, w, h)
      // Tape line
      c.strokeStyle = "#fbbf24"
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(x + w / 2, y)
      c.lineTo(x + w / 2, y + h)
      c.stroke()
    }

    // Helper: draw a truck
    function drawTruck(x: number, y: number, scale: number, color: string) {
      const s = scale
      // Cargo body
      c.fillStyle = color
      c.fillRect(x, y - 22 * s, 50 * s, 22 * s)
      // Cabin
      c.fillStyle = "#1e40af"
      c.fillRect(x + 50 * s, y - 18 * s, 20 * s, 18 * s)
      // Windshield
      c.fillStyle = "#93c5fd"
      c.fillRect(x + 54 * s, y - 15 * s, 13 * s, 10 * s)
      // Wheels
      c.fillStyle = "#1f2937"
      c.beginPath()
      c.arc(x + 10 * s, y + 2 * s, 5 * s, 0, Math.PI * 2)
      c.fill()
      c.beginPath()
      c.arc(x + 38 * s, y + 2 * s, 5 * s, 0, Math.PI * 2)
      c.fill()
      c.beginPath()
      c.arc(x + 60 * s, y + 2 * s, 5 * s, 0, Math.PI * 2)
      c.fill()
      // Rims
      c.fillStyle = "#9ca3af"
      ;[10, 38, 60].forEach((ox) => {
        c.beginPath()
        c.arc(x + ox * s, y + 2 * s, 2 * s, 0, Math.PI * 2)
        c.fill()
      })
    }

    // Helper: draw a house
    function drawHouse(x: number, y: number, w: number, h: number) {
      // Roof
      c.fillStyle = "#dc2626"
      c.beginPath()
      c.moveTo(x, y - h + 15)
      c.lineTo(x + w / 2, y - h - 12)
      c.lineTo(x + w, y - h + 15)
      c.fill()
      // Walls
      c.fillStyle = "#fef2f2"
      c.fillRect(x + 4, y - h + 15, w - 8, h - 15)
      // Door
      c.fillStyle = "#92400e"
      c.fillRect(x + w / 2 - 7, y - 22, 14, 22)
      // Windows
      c.fillStyle = "#bfdbfe"
      c.fillRect(x + 8, y - h + 22, 12, 10)
      c.fillRect(x + w - 20, y - h + 22, 12, 10)
    }

    // Helper: draw computer/laptop
    function drawLaptop(x: number, y: number) {
      // Screen
      c.fillStyle = "#1e293b"
      c.fillRect(x - 25, y - 40, 50, 30)
      c.fillStyle = "#3b82f6"
      c.fillRect(x - 22, y - 37, 44, 24)
      // Screen content - "ORDER" text
      c.fillStyle = "#fff"
      c.font = "bold 8px sans-serif"
      c.textAlign = "center"
      c.fillText("ORDER", x, y - 22)
      // Keyboard base
      c.fillStyle = "#475569"
      c.fillRect(x - 30, y - 10, 60, 6)
      // Hinge
      c.fillStyle = "#64748b"
      c.fillRect(x - 25, y - 12, 50, 3)
    }

    // Helper: draw cloud
    function drawCloud(x: number, y: number, size: number) {
      c.fillStyle = "rgba(255,255,255,0.15)"
      c.beginPath()
      c.arc(x, y, size, 0, Math.PI * 2)
      c.arc(x + size * 1.2, y - size * 0.3, size * 0.8, 0, Math.PI * 2)
      c.arc(x + size * 2, y, size * 0.9, 0, Math.PI * 2)
      c.fill()
    }

    // Helper: draw confetti
    function drawConfetti(cx: number, cy: number, count: number, spread: number) {
      const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"]
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + frame * 0.02
        const dist = spread * (0.5 + 0.5 * Math.sin(frame * 0.05 + i))
        const px = cx + Math.cos(angle) * dist
        const py = cy + Math.sin(angle) * dist + Math.sin(frame * 0.08 + i) * 5
        c.fillStyle = colors[i % colors.length]
        c.save()
        c.translate(px, py)
        c.rotate(frame * 0.1 + i)
        c.fillRect(-3, -1, 6, 2)
        c.restore()
      }
    }

    const draw = () => {
      c.clearRect(0, 0, W, H)

      // ── SKY ──
      const skyGrad = c.createLinearGradient(0, 0, 0, H * 0.6)
      skyGrad.addColorStop(0, "#0f172a")
      skyGrad.addColorStop(1, "#1e3a5f")
      c.fillStyle = skyGrad
      c.fillRect(0, 0, W, H * 0.6)

      // Stars
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 137 + 50) % W)
        const sy = ((i * 97 + 20) % (H * 0.5))
        const brightness = 0.3 + 0.7 * Math.abs(Math.sin(frame * 0.015 + i * 2))
        c.fillStyle = `rgba(255,255,255,${brightness})`
        c.beginPath()
        c.arc(sx, sy, 1, 0, Math.PI * 2)
        c.fill()
      }

      // Clouds
      const cloudOffset = (frame * 0.3) % (W + 200)
      drawCloud((cloudOffset) % (W + 200) - 100, 40, 20)
      drawCloud((cloudOffset + 300) % (W + 200) - 100, 60, 15)
      drawCloud((cloudOffset + 600) % (W + 200) - 100, 35, 18)

      // ── GROUND ──
      const groundY = H * 0.6
      c.fillStyle = "#1a472a"
      c.fillRect(0, groundY, W, H - groundY)

      // Road
      const roadY = groundY + (H - groundY) * 0.35
      const roadH = 36
      c.fillStyle = "#374151"
      c.fillRect(0, roadY, W, roadH)
      // Dashed center line
      c.strokeStyle = "#fbbf24"
      c.lineWidth = 2
      c.setLineDash([18, 14])
      c.lineDashOffset = currentStep >= 3 ? -frame * 2 : 0
      c.beginPath()
      c.moveTo(0, roadY + roadH / 2)
      c.lineTo(W, roadY + roadH / 2)
      c.stroke()
      c.setLineDash([])

      // Buildings
      const buildings = [
        { x: 0.03, w: 45, h: 70 }, { x: 0.12, w: 30, h: 55 },
        { x: 0.22, w: 50, h: 80 }, { x: 0.38, w: 35, h: 60 },
        { x: 0.52, w: 55, h: 75 }, { x: 0.68, w: 40, h: 65 },
        { x: 0.82, w: 45, h: 72 }, { x: 0.93, w: 35, h: 58 },
      ]
      buildings.forEach((b, i) => {
        const bx = b.x * W
        const by = groundY - b.h
        c.fillStyle = i % 2 === 0 ? "#1e293b" : "#334155"
        c.fillRect(bx, by, b.w, b.h)
        c.fillStyle = "rgba(251,191,36,0.25)"
        for (let wy = by + 8; wy < by + b.h - 5; wy += 12) {
          for (let wx = bx + 5; wx < bx + b.w - 5; wx += 10) {
            if (Math.sin(frame * 0.008 + wx * 0.1 + wy * 0.1 + i) > 0.2) {
              c.fillRect(wx, wy, 5, 7)
            }
          }
        }
      })

      // Warehouse at left
      const whX = W * 0.08
      const whW = 80
      const whH = 55
      c.fillStyle = "#475569"
      c.fillRect(whX, groundY - whH, whW, whH)
      c.fillStyle = "#64748b"
      c.fillRect(whX + 5, groundY - whH + 5, whW - 10, 12)
      c.fillStyle = "#1e293b"
      c.fillRect(whX + 28, groundY - 32, 24, 32)
      c.fillStyle = "#94a3b8"
      c.font = "bold 8px sans-serif"
      c.textAlign = "center"
      c.fillText("WAREHOUSE", whX + whW / 2, groundY - whH - 5)

      // House at right
      const houseX = W * 0.8
      const houseW = 60
      const houseH = 48
      drawHouse(houseX, roadY - 5, houseW, houseH)

      // ── STEP-SPECIFIC ANIMATION ──
      const t = frame // shorthand

      if (currentStep === 0) {
        // ── ORDER PLACED: Person at laptop clicking "Buy Now" ──
        const personX = W * 0.5
        const personY = roadY - 8

        // Desk
        c.fillStyle = "#92400e"
        c.fillRect(personX - 40, personY - 12, 80, 6)
        c.fillStyle = "#78350f"
        c.fillRect(personX - 35, personY - 6, 6, 12)
        c.fillRect(personX + 29, personY - 6, 6, 12)

        // Laptop on desk
        drawLaptop(personX, personY - 12)

        // Person sitting
        drawPerson(personX, personY - 6, 0.9, "#3b82f6")

        // Mouse hand clicking animation
        const clickY = Math.sin(frame * 0.08) > 0.7 ? -2 : 0
        c.fillStyle = "#fbbf24"
        c.beginPath()
        c.arc(personX + 18, personY - 16 + clickY, 3, 0, Math.PI * 2)
        c.fill()

        // "Click!" popup when clicking
        if (Math.sin(frame * 0.08) > 0.7) {
          c.fillStyle = "#22c55e"
          c.font = "bold 11px sans-serif"
          c.textAlign = "center"
          c.fillText("✓ Click!", personX + 18, personY - 30)
        }

        // Floating order confirmation
        const confirmY = personY - 55 - Math.sin(frame * 0.03) * 5
        const confirmAlpha = Math.min(1, (frame % 200) / 50)
        c.globalAlpha = confirmAlpha
        c.fillStyle = "#22c55e"
        c.fillRect(personX - 35, confirmY, 70, 22)
        c.fillStyle = "#fff"
        c.font = "bold 9px sans-serif"
        c.fillText("Order Placed! 🎉", personX, confirmY + 14)
        c.globalAlpha = 1

        // Mini confetti
        if (frame > 30) drawConfetti(personX, confirmY - 10, 8, 40)

      } else if (currentStep === 1) {
        // ── PROCESSING: Packing items into box ──
        const packX = W * 0.35
        const packY = roadY - 20

        // Box (open lid)
        const boxW = 50
        const boxH = 35
        c.fillStyle = "#d97706"
        c.fillRect(packX - boxW / 2, packY - boxH, boxW, boxH)
        c.strokeStyle = "#92400e"
        c.lineWidth = 1.5
        c.strokeRect(packX - boxW / 2, packY - boxH, boxW, boxH)
        // Tape
        c.strokeStyle = "#fbbf24"
        c.lineWidth = 2
        c.beginPath()
        c.moveTo(packX, packY - boxH)
        c.lineTo(packX, packY)
        c.stroke()
        // Open flaps
        c.fillStyle = "#b45309"
        c.beginPath()
        c.moveTo(packX - boxW / 2, packY - boxH)
        c.lineTo(packX - boxW / 2 - 8, packY - boxH - 12)
        c.lineTo(packX - boxW / 2 + 12, packY - boxH - 12)
        c.lineTo(packX - boxW / 2 + 12, packY - boxH)
        c.fill()
        c.beginPath()
        c.moveTo(packX + boxW / 2, packY - boxH)
        c.lineTo(packX + boxW / 2 + 8, packY - boxH - 12)
        c.lineTo(packX + boxW / 2 - 12, packY - boxH - 12)
        c.lineTo(packX + boxW / 2 - 12, packY - boxH)
        c.fill()

        // Item being dropped into box (bouncing animation)
        const dropCycle = (t * 0.04) % (Math.PI * 2)
        const dropY = packY - boxH - 20 - Math.abs(Math.sin(dropCycle)) * 25
        const itemW = 20
        const itemH = 14
        c.fillStyle = "#3b82f6"
        c.fillRect(packX - itemW / 2, dropY - itemH, itemW, itemH)
        c.strokeStyle = "#1d4ed8"
        c.lineWidth = 1
        c.strokeRect(packX - itemW / 2, dropY - itemH, itemW, itemH)
        // Item label
        c.fillStyle = "#fff"
        c.font = "6px sans-serif"
        c.fillText("📱", packX, dropY - itemH / 2 + 2)

        // Worker person
        drawPerson(packX + 55, packY, 0.9, "#6366f1")

        // Tape dispenser sparkle
        if (Math.sin(frame * 0.1) > 0.5) {
          c.fillStyle = "#fbbf24"
          c.beginPath()
          c.arc(packX + 10, packY - boxH - 5, 2, 0, Math.PI * 2)
          c.fill()
        }

        // "Packing..." label
        c.fillStyle = "#6366f1"
        c.font = "bold 10px sans-serif"
        c.textAlign = "center"
        c.fillText("📦 Packing...", packX, packY - boxH - 40)

      } else if (currentStep === 2) {
        // ── SHIPPED: Loading boxes into truck ──
        const truckX = W * 0.3
        const truckY = roadY - 5

        // Truck (parked)
        drawTruck(truckX, truckY, 1, "#2563eb")

        // Loading ramp
        c.fillStyle = "#6b7280"
        c.beginPath()
        c.moveTo(truckX, truckY - 22)
        c.lineTo(truckX - 30, truckY + 2)
        c.lineTo(truckX - 25, truckY + 2)
        c.lineTo(truckX + 5, truckY - 22)
        c.fill()

        // Boxes being loaded (moving up the ramp)
        const loadProgress = (t * 0.02) % 1
        const box1X = truckX - 25 + loadProgress * 30
        const box1Y = truckY + 2 - loadProgress * 24
        drawBox(box1X - 8, box1Y - 10, 16, 10, "#d97706")

        // Second box waiting
        drawBox(truckX - 50, truckY - 8, 18, 12, "#b45309")

        // Worker carrying box
        const workerX = truckX - 40
        const workerBob = Math.sin(frame * 0.1) * 2
        drawPerson(workerX, truckY + 2 + workerBob, 0.8, "#8b5cf6")
        // Box in hand
        drawBox(workerX - 6, truckY - 14 + workerBob, 12, 8, "#d97706")

        // Forklift in background
        c.fillStyle = "#f59e0b"
        c.fillRect(W * 0.12, truckY - 15, 20, 15)
        c.fillStyle = "#92400e"
        c.fillRect(W * 0.12 + 20, truckY - 25, 4, 10)

        // "Loading..." label
        c.fillStyle = "#2563eb"
        c.font = "bold 10px sans-serif"
        c.textAlign = "center"
        c.fillText("🚚 Loading Shipment...", truckX + 25, truckY - 45)

      } else if (currentStep === 3) {
        // ── IN TRANSIT: Truck driving on road ──
        const truckBob = Math.sin(frame * 0.15) * 1.5
        const truckDriveX = W * 0.35 + Math.sin(frame * 0.01) * W * 0.15
        const truckY = roadY - 5 + truckBob

        drawTruck(truckDriveX, truckY, 1.1, "#2563eb")

        // Exhaust puffs
        for (let i = 0; i < 5; i++) {
          const ex = truckDriveX - 10 - i * 12 - (frame % 30) * 0.8
          const ey = truckY - 10 - i * 2
          const size = 4 + i * 2
          const alpha = 0.25 - i * 0.05
          c.fillStyle = `rgba(156,163,175,${Math.max(0, alpha)})`
          c.beginPath()
          c.arc(ex, ey, size, 0, Math.PI * 2)
          c.fill()
        }

        // Scrolling trees
        for (let i = 0; i < 6; i++) {
          const tx = ((i * 170 + frame * 1.2) % (W + 100)) - 50
          const ty = groundY - 5
          // Trunk
          c.fillStyle = "#92400e"
          c.fillRect(tx - 2, ty - 20, 4, 20)
          // Leaves
          c.fillStyle = "#166534"
          c.beginPath()
          c.arc(tx, ty - 28, 12, 0, Math.PI * 2)
          c.fill()
          c.fillStyle = "#15803d"
          c.beginPath()
          c.arc(tx - 5, ty - 24, 8, 0, Math.PI * 2)
          c.fill()
        }

        // Speed lines
        c.strokeStyle = "rgba(255,255,255,0.1)"
        c.lineWidth = 1
        for (let i = 0; i < 4; i++) {
          const ly = truckY - 5 + i * 6
          const lx = truckDriveX - 60 - Math.random() * 20
          c.beginPath()
          c.moveTo(lx, ly)
          c.lineTo(lx - 30, ly)
          c.stroke()
        }

        // Label
        c.fillStyle = "#f59e0b"
        c.font = "bold 10px sans-serif"
        c.textAlign = "center"
        c.fillText("🚛 In Transit — On the way!", truckDriveX + 25, truckY - 45)

      } else if (currentStep === 4) {
        // ── OUT FOR DELIVERY: Truck arriving at neighborhood ──
        const truckArriveX = W * 0.6 + Math.sin(frame * 0.02) * 10
        const truckY = roadY - 5

        drawTruck(truckArriveX, truckY, 1, "#ea580c")

        // Map pin bouncing above truck
        const pinY = truckY - 50 - Math.sin(frame * 0.06) * 5
        c.fillStyle = "#ef4444"
        c.beginPath()
        c.arc(truckArriveX + 25, pinY, 8, 0, Math.PI * 2)
        c.fill()
        c.fillStyle = "#fff"
        c.font = "bold 8px sans-serif"
        c.textAlign = "center"
        c.fillText("📍", truckArriveX + 25, pinY + 3)
        // Pin triangle
        c.fillStyle = "#ef4444"
        c.beginPath()
        c.moveTo(truckArriveX + 25 - 5, pinY + 8)
        c.lineTo(truckArriveX + 25 + 5, pinY + 8)
        c.lineTo(truckArriveX + 25, pinY + 16)
        c.fill()

        // Pulse rings
        const pulseR = 12 + (frame % 60)
        const pulseAlpha = Math.max(0, 1 - pulseR / 60)
        c.strokeStyle = `rgba(239,68,68,${pulseAlpha})`
        c.lineWidth = 2
        c.beginPath()
        c.arc(truckArriveX + 25, pinY, pulseR, 0, Math.PI * 2)
        c.stroke()

        // Packages visible in truck
        drawBox(truckArriveX + 5, truckY - 20, 12, 10, "#d97706")
        drawBox(truckArriveX + 20, truckY - 18, 10, 8, "#b45309")

        // Label
        c.fillStyle = "#ea580c"
        c.font = "bold 10px sans-serif"
        c.fillText("📍 Almost there! Out for delivery", truckArriveX + 25, truckY - 60)

      } else if (currentStep === 5) {
        // ── DELIVERED: Package at doorstep, happy person ──
        const doorX = houseX + houseW / 2
        const doorY = roadY - 5

        // Package at doorstep
        drawBox(doorX - 12, doorY - 14, 24, 14, "#d97706")
        // Ribbon
        c.strokeStyle = "#ef4444"
        c.lineWidth = 2
        c.beginPath()
        c.moveTo(doorX - 12, doorY - 7)
        c.lineTo(doorX + 12, doorY - 7)
        c.stroke()
        c.beginPath()
        c.moveTo(doorX, doorY - 14)
        c.lineTo(doorX, doorY)
        c.stroke()

        // Happy person
        drawPerson(doorX + 35, doorY, 0.9, "#22c55e")

        // Big checkmark
        const checkY = doorY - 55 - Math.sin(frame * 0.03) * 3
        c.fillStyle = "#22c55e"
        c.beginPath()
        c.arc(doorX, checkY, 16, 0, Math.PI * 2)
        c.fill()
        c.strokeStyle = "#fff"
        c.lineWidth = 3
        c.beginPath()
        c.moveTo(doorX - 6, checkY)
        c.lineTo(doorX - 1, checkY + 5)
        c.lineTo(doorX + 7, checkY - 5)
        c.stroke()

        // Confetti!
        drawConfetti(doorX, checkY - 20, 12, 50)
        drawConfetti(W * 0.5, checkY - 30, 8, 35)

        // Label
        c.fillStyle = "#22c55e"
        c.font = "bold 11px sans-serif"
        c.textAlign = "center"
        c.fillText("✅ Delivered! Enjoy your order!", doorX, checkY - 25)
      }

      // ── PROGRESS DOTS at bottom ──
      const dotY = H - 20
      for (let i = 0; i <= 5; i++) {
        const dx = W * 0.08 + (W * 0.84) * (i / 5)
        const filled = i <= currentStep
        c.fillStyle = filled ? "#3b82f6" : "#475569"
        c.beginPath()
        c.arc(dx, dotY, 5, 0, Math.PI * 2)
        c.fill()
        if (filled) {
          c.fillStyle = "#fff"
          c.beginPath()
          c.arc(dx, dotY, 2, 0, Math.PI * 2)
          c.fill()
        }
        if (i < 5) {
          c.strokeStyle = i < currentStep ? "#3b82f6" : "#475569"
          c.lineWidth = 2
          c.beginPath()
          c.moveTo(dx + 7, dotY)
          const nextDx = W * 0.08 + (W * 0.84) * ((i + 1) / 5)
          c.lineTo(nextDx - 7, dotY)
          c.stroke()
        }
      }

      frame++
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [currentStep])

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
      <canvas ref={canvasRef} width={900} height={300} className="w-full h-auto" />
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center px-4 py-2 bg-black/50 backdrop-blur-sm rounded-xl">
        <span className="text-white text-sm font-semibold">{STATUS_STEPS[currentStep]?.label || "Unknown"}</span>
        <span className="text-blue-300 text-xs">Step {currentStep + 1} of {STATUS_STEPS.length}</span>
      </div>
    </div>
  )
}

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState("")
  const [loading, setLoading] = useState(false)
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [error, setError] = useState("")
  const [hint, setHint] = useState("")

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId.trim()) return
    setLoading(true)
    setError("")
    setHint("")
    setTracking(null)
    try {
      const res = await fetch(`/api/orders/track?orderId=${encodeURIComponent(orderId.trim())}`)
      const data = await res.json()
      if (res.ok && data.tracking) {
        setTracking(data.tracking)
      } else {
        setError(data.error || "Order not found. Please check your order ID and try again.")
        if (data.hint) setHint(data.hint)
      }
    } catch {
      setError("Something went wrong. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  const currentStep = tracking
    ? STATUS_STEPS.findIndex((s) => s.key === tracking.currentStatus)
    : -1

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-grow">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
              <Truck className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white tracking-wide">Live Tracking</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              Track Your <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">Order</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Enter your order ID to see real-time shipment status with live animated tracking.
            </p>

            {/* Search Form */}
            <form onSubmit={handleTrack} className="max-w-xl mx-auto flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Enter Order ID, Payment ID, or Tracking Number"
                  className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !orderId.trim()}
                className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                Track
              </button>
            </form>
            <p className="text-gray-400 text-sm mt-4 text-center">
              Enter your order ID from the confirmation email (with or without #), Razorpay payment ID (pay_...), or your registered email/phone.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-12" viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none"><path d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z" fill="white" /></svg>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 md:px-6">
            {/* Error */}
            {error && (
              <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-8">
                <p className="text-red-700 font-medium">{error}</p>
                {hint && <p className="text-red-500 text-sm mt-2">{hint}</p>}
              </div>
            )}

            {/* Tracking Result */}
            {tracking && (
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Animated Visual */}
                <AnimatedTrackingVisual currentStep={Math.max(0, currentStep)} />

                {/* Order Info Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Order {tracking.orderId}</h2>
                      <p className="text-gray-500 text-sm mt-1">Tracking: {tracking.trackingNumber} via {tracking.carrier}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Estimated Delivery</p>
                      <p className="text-lg font-bold text-blue-600">{tracking.estimatedDelivery}</p>
                    </div>
                  </div>

                  {/* Status Steps */}
                  <div className="relative">
                    {/* Progress bar */}
                    <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full mx-5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(Math.max(0, currentStep) / 5) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between relative z-10">
                      {STATUS_STEPS.map((step, idx) => {
                        const Icon = step.icon
                        const isCompleted = idx <= currentStep
                        const isCurrent = idx === currentStep
                        return (
                          <div key={step.key} className="flex flex-col items-center text-center w-16 md:w-24">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-500 ${
                              isCompleted
                                ? `bg-gradient-to-br ${step.color} text-white shadow-lg`
                                : "bg-gray-100 text-gray-400"
                            } ${isCurrent ? "ring-4 ring-blue-200 scale-110" : ""}`}>
                              {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                            </div>
                            <span className={`text-[10px] md:text-xs font-medium ${isCompleted ? "text-gray-900" : "text-gray-400"}`}>
                              {step.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 md:p-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Tracking History
                  </h3>
                  <div className="relative pl-8">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                    {tracking.events.map((event, idx) => (
                      <div key={idx} className="relative mb-8 last:mb-0">
                        <div className={`absolute -left-5 top-1 w-3 h-3 rounded-full border-2 ${
                          idx === 0 ? "bg-blue-600 border-blue-600 shadow-md shadow-blue-300" : "bg-white border-gray-300"
                        }`} />
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-blue-200 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-gray-900">{event.status}</p>
                            <span className="text-xs text-gray-500">{event.timestamp}</span>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {event.location}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Route Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Origin</p>
                    <p className="text-lg font-bold text-gray-900">{tracking.origin}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100">
                    <p className="text-sm text-emerald-600 font-semibold mb-1">Destination</p>
                    <p className="text-lg font-bold text-gray-900">{tracking.destination}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!tracking && !error && !loading && (
              <div className="max-w-2xl mx-auto text-center py-12">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Truck className="h-12 w-12 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Enter your Order ID above</h3>
                <p className="text-gray-500">You&apos;ll see real-time tracking with animated shipment visualization.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
