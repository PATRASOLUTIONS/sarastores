import jsPDF from "jspdf"
import QRCode from "qrcode"

export type QRType = "google_maps" | "whatsapp" | "instagram"

interface SinglePamphletData {
  storeName: string
  storeAddress?: string
  storeTiming?: string
  type: QRType
  scanUrl: string
}

interface PamphletData {
  storeName: string
  storeAddress?: string
  storeTiming?: string
  qrCodes: Array<{ type: QRType; scanUrl: string; targetUrl: string }>
}

const BRAND: Record<
  QRType,
  {
    label: string
    tagline: string
    cta: string
    subText: string
    color: [number, number, number]
    colorLight: [number, number, number]
  }
> = {
  google_maps: {
    label: "Google Review",
    tagline: "Your feedback matters!",
    cta: "Scan & Leave a Review",
    subText: "Give us a review and help us serve you better",
    color: [66, 133, 244],
    colorLight: [232, 240, 254],
  },
  whatsapp: {
    label: "WhatsApp",
    tagline: "Stay Connected!",
    cta: "Scan & Get Daily Offers",
    subText: "Get exclusive deals and offer updates directly on WhatsApp",
    color: [37, 211, 102],
    colorLight: [230, 255, 240],
  },
  instagram: {
    label: "Instagram",
    tagline: "Follow Us!",
    cta: "Scan & Follow Us",
    subText: "Know the latest market trends and new product launches",
    color: [228, 64, 95],
    colorLight: [255, 235, 240],
  },
}

/**
 * Draw a simple brand icon using only valid jsPDF primitives
 * (circle, rect, roundedRect — no triangle/pie/lines)
 */
function drawBrandIcon(
  doc: jsPDF,
  type: QRType,
  cx: number,
  cy: number,
  size: number
) {
  const config = BRAND[type]
  const [cr, cg, cb] = config.color

  // Outer white circle background
  doc.setFillColor(255, 255, 255)
  doc.circle(cx, cy, size, "F")

  // Colored inner circle
  doc.setFillColor(cr, cg, cb)
  doc.circle(cx, cy, size * 0.85, "F")

  // White center
  doc.setFillColor(255, 255, 255)
  doc.circle(cx, cy, size * 0.5, "F")

  // Type-specific inner mark
  doc.setFillColor(cr, cg, cb)
  if (type === "google_maps") {
    // Pin dot
    doc.circle(cx, cy, size * 0.25, "F")
    // Small pin base
    doc.rect(cx - size * 0.15, cy + size * 0.1, size * 0.3, size * 0.3, "F")
  } else if (type === "whatsapp") {
    // Phone shape
    doc.roundedRect(
      cx - size * 0.18,
      cy - size * 0.32,
      size * 0.36,
      size * 0.64,
      size * 0.08,
      size * 0.08,
      "F"
    )
    // Speaker dot
    doc.setFillColor(255, 255, 255)
    doc.circle(cx, cy + size * 0.15, size * 0.06, "F")
  } else {
    // Instagram: camera body
    doc.roundedRect(
      cx - size * 0.35,
      cy - size * 0.35,
      size * 0.7,
      size * 0.7,
      size * 0.12,
      size * 0.12,
      "F"
    )
    // Lens
    doc.setFillColor(255, 255, 255)
    doc.circle(cx, cy, size * 0.2, "F")
    // Flash dot
    doc.setFillColor(255, 255, 255)
    doc.circle(cx + size * 0.22, cy - size * 0.22, size * 0.06, "F")
  }
}

/**
 * Generate a single A5 portrait pamphlet for one QR type.
 * Designed for in-store pasting — one poster per platform.
 */
export async function generateSinglePamphlet(
  data: SinglePamphletData
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  })

  const W = 148
  const H = 210
  const config = BRAND[data.type]
  const [cr, cg, cb] = config.color
  const [lr, lg, lb] = config.colorLight

  // === BACKGROUND ===
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, H, "F")

  // === TOP BRAND STRIPE ===
  doc.setFillColor(cr, cg, cb)
  doc.rect(0, 0, W, 55, "F")

  // Decorative circles on stripe
  doc.setFillColor(255, 255, 255)
  doc.circle(W - 15, 12, 20, "F")
  doc.setFillColor(cr, cg, cb)
  doc.circle(W - 15, 12, 18, "F")
  doc.setFillColor(255, 255, 255)
  doc.circle(15, 45, 12, "F")
  doc.setFillColor(cr, cg, cb)
  doc.circle(15, 45, 10, "F")

  // Brand icon centered in stripe
  drawBrandIcon(doc, data.type, W / 2, 20, 12)

  // Store name on stripe
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text("Sara Electronics", W / 2, 38, { align: "center" })

  // Platform label
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(config.label, W / 2, 48, { align: "center" })

  // === MAIN CONTENT ===

  // Tagline
  doc.setTextColor(cr, cg, cb)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(config.tagline, W / 2, 68, { align: "center" })

  // QR Code
  const qrSize = 62
  const qrX = (W - qrSize) / 2
  const qrY = 74

  if (data.scanUrl) {
    const qrDataUrl = await QRCode.toDataURL(data.scanUrl, {
      width: 600,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })

    // QR shadow
    doc.setFillColor(200, 200, 200)
    doc.roundedRect(qrX + 1.5, qrY + 1.5, qrSize, qrSize, 4, 4, "F")

    // QR white background with border
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(cr, cg, cb)
    doc.setLineWidth(1)
    doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 5, 5, "FD")

    // QR image
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize)

    // Corner accents
    const accent = 8
    doc.setFillColor(cr, cg, cb)
    doc.roundedRect(qrX - 6, qrY - 6, accent, accent, 1, 1, "F")
    doc.roundedRect(qrX + qrSize - accent + 6, qrY - 6, accent, accent, 1, 1, "F")
    doc.roundedRect(qrX - 6, qrY + qrSize - accent + 6, accent, accent, 1, 1, "F")
    doc.roundedRect(
      qrX + qrSize - accent + 6,
      qrY + qrSize - accent + 6,
      accent,
      accent,
      1,
      1,
      "F"
    )
  }

  // CTA text
  const ctaY = qrY + qrSize + 16
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.text(config.cta, W / 2, ctaY, { align: "center" })

  // Sub text
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const subLines = doc.splitTextToSize(config.subText, W - 30)
  doc.text(subLines, W / 2, ctaY + 8, { align: "center" })

  // CTA button (decorative)
  const btnY = ctaY + 8 + subLines.length * 5 + 10
  doc.setFillColor(cr, cg, cb)
  doc.roundedRect(W / 2 - 35, btnY, 70, 12, 6, 6, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("SCAN NOW", W / 2, btnY + 8, { align: "center" })

  // Store name box
  const boxY = btnY + 22
  doc.setFillColor(lr, lg, lb)
  doc.roundedRect(15, boxY, W - 30, 18, 3, 3, "F")
  doc.setDrawColor(cr, cg, cb)
  doc.setLineWidth(0.4)
  doc.roundedRect(15, boxY, W - 30, 18, 3, 3, "D")

  doc.setTextColor(cr, cg, cb)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(data.storeName || "Sara Electronics", W / 2, boxY + 7.5, {
    align: "center",
  })

  if (data.storeAddress) {
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    const addrLines = doc.splitTextToSize(data.storeAddress, W - 40)
    doc.text(addrLines[0], W / 2, boxY + 13.5, { align: "center" })
  }

  // Footer
  doc.setFillColor(cr, cg, cb)
  doc.rect(0, H - 16, W, 16, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  const footerParts: string[] = []
  if (data.storeTiming) footerParts.push(`Timings: ${data.storeTiming}`)
  footerParts.push("www.sarastores.com")
  doc.text(footerParts.join("  |  "), W / 2, H - 8, { align: "center" })

  // Save
  const safeName = (data.storeName || "Store").replace(/[^a-zA-Z0-9]/g, "_")
  const typeLabel = config.label.replace(/\s+/g, "_")
  doc.save(`${safeName}-${typeLabel}-QR.pdf`)
}

/**
 * Generate all 3 pamphlets for a store (downloads 3 separate PDFs)
 */
export async function generateA5Pamphlet(data: PamphletData): Promise<void> {
  for (let i = 0; i < data.qrCodes.length; i++) {
    const qr = data.qrCodes[i]
    await generateSinglePamphlet({
      storeName: data.storeName,
      storeAddress: data.storeAddress,
      storeTiming: data.storeTiming,
      type: qr.type,
      scanUrl: qr.scanUrl,
    })
    if (i < data.qrCodes.length - 1) {
      await new Promise((r) => setTimeout(r, 400))
    }
  }
}
