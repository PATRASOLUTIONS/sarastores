/**
 * Hero poster generator.
 *
 * Posters are defined as data and rendered to SVG on demand, so twenty of them
 * cost one template rather than twenty files to keep in sync. Served from
 * app/api/poster/[slug] and toggled per-poster in the admin.
 *
 * The logo is drawn as a typographic wordmark rather than the PNG: an SVG
 * loaded through <img> cannot fetch external resources, and base64-inlining the
 * logo would add ~100 KB to every poster.
 */

export type PosterMotif = "rays" | "dots" | "grid" | "waves" | "arcs"

export interface Poster {
  slug: string
  group: "Festival" | "Category" | "Offer" | "Trust" | "Seasonal"
  eyebrow: string
  headline: string
  headlineAccent: string
  subline: string
  cta: string
  motif: PosterMotif
  from: string
  via: string
  to: string
  accent: string
  ink: string
  photo?: string
}

export const POSTERS: Poster[] = [
  // ── Festival ──────────────────────────────────────────────────────────
  { slug: "ganesh-festive", group: "Festival", eyebrow: "GANESH CHATURTHI", headline: "Ganpati Bappa", headlineAccent: "Morya", subline: "Up to 60% off on TVs, ACs and home appliances", cta: "SHOP THE SALE", motif: "dots", from: "#9C2A0E", via: "#C2410C", to: "#6B1607", accent: "#F5A623", ink: "#6B1607" },
  { slug: "diwali-lights", group: "Festival", eyebrow: "DIWALI DHAMAKA", headline: "Light up every", headlineAccent: "room", subline: "Lowest prices of the year with no-cost EMI", cta: "EXPLORE OFFERS", motif: "arcs", from: "#4A148C", via: "#6A1B9A", to: "#2E0854", accent: "#FFB300", ink: "#2E0854" },
  { slug: "holi-colours", group: "Festival", eyebrow: "HOLI SALE", headline: "Colours of", headlineAccent: "savings", subline: "Bright deals across every category", cta: "SHOP NOW", motif: "waves", from: "#C2185B", via: "#7B1FA2", to: "#00838F", accent: "#FFEB3B", ink: "#4A0D2E" },
  { slug: "navratri-nights", group: "Festival", eyebrow: "NAVRATRI NIGHTS", headline: "Nine nights of", headlineAccent: "offers", subline: "New deals every single day of the festival", cta: "SEE TODAY'S DEAL", motif: "grid", from: "#6A1B9A", via: "#D81B60", to: "#4A148C", accent: "#FFD54F", ink: "#3B0A55" },

  // ── Category ──────────────────────────────────────────────────────────
  { slug: "television", group: "Category", eyebrow: "TELEVISIONS", headline: "Cinema, in your", headlineAccent: "living room", subline: "4K and QLED panels from every major brand", cta: "SHOP TVs", motif: "rays", from: "#0F2557", via: "#16336F", to: "#0A1A40", accent: "#FF6A2C", ink: "#0A1A40" },
  { slug: "air-conditioner", group: "Category", eyebrow: "AIR CONDITIONERS", headline: "Cool rooms,", headlineAccent: "lower bills", subline: "5-star inverter ACs with free installation", cta: "SHOP ACs", motif: "waves", from: "#01579B", via: "#0288D1", to: "#01426F", accent: "#4FC3F7", ink: "#01426F" },
  { slug: "refrigerator", group: "Category", eyebrow: "REFRIGERATORS", headline: "Fresh for", headlineAccent: "longer", subline: "Frost-free double door and side-by-side models", cta: "SHOP FRIDGES", motif: "grid", from: "#004D40", via: "#00695C", to: "#00332B", accent: "#4DB6AC", ink: "#00332B" },
  { slug: "washing-machine", group: "Category", eyebrow: "WASHING MACHINES", headline: "Laundry day,", headlineAccent: "sorted", subline: "Front load and top load with 10-year motor warranty", cta: "SHOP WASHERS", motif: "arcs", from: "#283593", via: "#3949AB", to: "#1A237E", accent: "#7986CB", ink: "#1A237E" },

  // ── Offer ─────────────────────────────────────────────────────────────
  { slug: "no-cost-emi", group: "Offer", eyebrow: "NO-COST EMI", headline: "Pay in parts,", headlineAccent: "pay nothing extra", subline: "Zero interest on all major credit and debit cards", cta: "CHECK ELIGIBILITY", motif: "rays", from: "#1B5E20", via: "#2E7D32", to: "#0F3D14", accent: "#A5D6A7", ink: "#0F3D14" },
  { slug: "free-delivery", group: "Offer", eyebrow: "FREE DELIVERY", headline: "Delivered free,", headlineAccent: "every order", subline: "No minimum spend anywhere we deliver in Karnataka", cta: "START SHOPPING", motif: "dots", from: "#0F2557", via: "#1E3A73", to: "#0A1A40", accent: "#FF6A2C", ink: "#0A1A40" },
  { slug: "free-installation", group: "Offer", eyebrow: "FREE INSTALLATION", headline: "Fitted and set up,", headlineAccent: "at no extra cost", subline: "Certified engineers, scheduled to suit you", cta: "BOOK A SLOT", motif: "arcs", from: "#4E342E", via: "#6D4C41", to: "#3E2723", accent: "#FFB74D", ink: "#3E2723" },
  { slug: "clearance", group: "Offer", eyebrow: "CLEARANCE", headline: "Last few", headlineAccent: "units left", subline: "Display pieces and end-of-line stock at cost", cta: "GRAB THE DEAL", motif: "grid", from: "#B71C1C", via: "#D32F2F", to: "#7F0000", accent: "#FFC107", ink: "#7F0000" },

  // ── Trust ─────────────────────────────────────────────────────────────
  { slug: "stores-karnataka", group: "Trust", eyebrow: "54 STORES", headline: "See it before", headlineAccent: "you buy it", subline: "Fifty-four Sara stores across Karnataka", cta: "FIND A STORE", motif: "dots", from: "#0F2557", via: "#16336F", to: "#0A1A40", accent: "#FF6A2C", ink: "#0A1A40" },
  { slug: "authorised-dealer", group: "Trust", eyebrow: "AUTHORISED DEALER", headline: "Genuine stock,", headlineAccent: "always", subline: "Full manufacturer warranty on every product", cta: "WHY SARA", motif: "rays", from: "#1A237E", via: "#283593", to: "#0D1250", accent: "#FFC107", ink: "#0D1250" },
  { slug: "installation", group: "Trust", eyebrow: "INSTALLATION", headline: "Fitted by", headlineAccent: "our own team", subline: "Delivery, installation and demo handled for you", cta: "HOW IT WORKS", motif: "waves", from: "#00695C", via: "#00897B", to: "#00382E", accent: "#D4AF37", ink: "#00382E" },
  { slug: "service-support", group: "Trust", eyebrow: "AFTER-SALES", headline: "We answer", headlineAccent: "the phone", subline: "Local service support, not a call centre queue", cta: "CONTACT US", motif: "grid", from: "#37474F", via: "#455A64", to: "#263238", accent: "#FF8A65", ink: "#263238" },

  // ── Seasonal ──────────────────────────────────────────────────────────
  { slug: "summer-cooling", group: "Seasonal", eyebrow: "SUMMER SALE", headline: "Beat the", headlineAccent: "heat", subline: "ACs, coolers and refrigerators from ₹9,999", cta: "SHOP COOLING", motif: "waves", from: "#0277BD", via: "#039BE5", to: "#01579B", accent: "#FFEB3B", ink: "#01579B" },
  { slug: "monsoon-indoors", group: "Seasonal", eyebrow: "MONSOON SALE", headline: "Made for", headlineAccent: "indoor days", subline: "Big-screen TVs, audio and dryers for the rains", cta: "SHOP INDOORS", motif: "arcs", from: "#263238", via: "#37474F", to: "#12191D", accent: "#4FC3F7", ink: "#12191D" },
  { slug: "wedding-season", group: "Seasonal", eyebrow: "WEDDING SEASON", headline: "Everything for a", headlineAccent: "new home", subline: "Package prices on full kitchen and living sets", cta: "SEE PACKAGES", motif: "dots", from: "#7B4B94", via: "#9C6BB5", to: "#523062", accent: "#E0A458", ink: "#523062" },
  { slug: "new-year", group: "Seasonal", eyebrow: "NEW YEAR SALE", headline: "Start the year", headlineAccent: "upgraded", subline: "First sale of the year, lowest prices of the year", cta: "SHOP THE SALE", motif: "rays", from: "#0D1B3E", via: "#1A2B5C", to: "#000814", accent: "#D4AF37", ink: "#000814" },
]

export const POSTER_BY_SLUG: Record<string, Poster> = Object.fromEntries(
  POSTERS.map((p) => [p.slug, p]),
)

function motifDefs(m: PosterMotif, accent: string): string {
  switch (m) {
    case "dots":
      return `<pattern id="m" width="46" height="46" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="12" r="3" fill="${accent}" opacity="0.30"/>
        <circle cx="34" cy="34" r="2" fill="#FFFFFF" opacity="0.16"/>
      </pattern>`
    case "grid":
      return `<pattern id="m" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M60 0H0V60" fill="none" stroke="${accent}" stroke-width="1" opacity="0.20"/>
      </pattern>`
    case "waves":
      return `<pattern id="m" width="160" height="80" patternUnits="userSpaceOnUse">
        <path d="M0 60 Q40 30 80 60 T160 60" fill="none" stroke="${accent}" stroke-width="2" opacity="0.22"/>
        <path d="M0 30 Q40 0 80 30 T160 30" fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity="0.10"/>
      </pattern>`
    case "arcs":
      return `<pattern id="m" width="120" height="120" patternUnits="userSpaceOnUse">
        <circle cx="60" cy="60" r="52" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.18"/>
        <circle cx="60" cy="60" r="30" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.10"/>
      </pattern>`
    default: // rays
      return `<pattern id="m" width="1920" height="600" patternUnits="userSpaceOnUse">
        <rect width="1920" height="600" fill="none"/>
        <g opacity="0.16">
          ${Array.from({ length: 18 }, (_, i) => `<path d="M1500 -60 L${1120 + i * 52} 660" stroke="${accent}" stroke-width="14"/>`).join("")}
        </g>
      </pattern>`
  }
}

/** Escape text destined for SVG markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function renderPosterSvg(p: Poster): string {
  const font = "Poppins, Segoe UI, Helvetica Neue, Arial, sans-serif"
  const ctaWidth = Math.max(210, p.cta.length * 15 + 60)
  const photo = p.photo
    ? `<clipPath id="photoClip"><rect x="1230" y="44" width="570" height="512" rx="34"/></clipPath>`
    : ""
  const photoMarkup = p.photo
    ? `<image href="${esc(p.photo)}" x="1230" y="44" width="570" height="512" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>
<rect x="1230" y="44" width="570" height="512" rx="34" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="3"/>`
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 600" width="1920" height="600" role="img" aria-label="${esc(p.eyebrow)} — ${esc(p.headline)} ${esc(p.headlineAccent)}">
<title>${esc(p.headline)} ${esc(p.headlineAccent)} — Sara Electronics</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${p.from}"/>
    <stop offset="55%" stop-color="${p.via}"/>
    <stop offset="100%" stop-color="${p.to}"/>
  </linearGradient>
  <radialGradient id="glow" cx="78%" cy="44%" r="46%">
    <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.42"/>
    <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
  </radialGradient>
  ${photo}
  ${motifDefs(p.motif, p.accent)}
</defs>

<rect width="1920" height="600" fill="url(#bg)"/>
<rect width="1920" height="600" fill="url(#m)"/>
<rect width="1920" height="600" fill="url(#glow)"/>
${photoMarkup}

<g font-family="${font}">
  <g transform="translate(140 126)">
    <rect x="0" y="0" width="${p.eyebrow.length * 15 + 44}" height="44" rx="22" fill="${p.accent}"/>
    <text x="${(p.eyebrow.length * 15 + 44) / 2}" y="30" text-anchor="middle" font-size="19" font-weight="700" fill="${p.ink}" letter-spacing="3">${esc(p.eyebrow)}</text>
  </g>

  <text x="140" y="278" font-size="82" font-weight="800" fill="#FFFFFF">${esc(p.headline)}</text>
  <text x="140" y="368" font-size="82" font-weight="800" fill="${p.accent}">${esc(p.headlineAccent)}</text>
  <text x="140" y="424" font-size="29" font-weight="500" fill="#FFFFFF" opacity="0.88">${esc(p.subline)}</text>

  <g transform="translate(140 462)">
    <rect x="0" y="0" width="${ctaWidth}" height="62" rx="31" fill="${p.accent}"/>
    <text x="${ctaWidth / 2}" y="40" text-anchor="middle" font-size="23" font-weight="800" fill="${p.ink}" letter-spacing="1">${esc(p.cta)}</text>
  </g>

  <!-- Wordmark sits bottom-left, under the CTA: the right third is reserved for
       the featured product card the hero overlays on top of the poster. -->
  <g transform="translate(140 566)">
    <rect x="0" y="-19" width="4" height="26" rx="2" fill="${p.accent}"/>
    <text x="18" y="2" font-size="24" font-weight="800" fill="#FFFFFF" letter-spacing="4">SARA</text>
    <text x="104" y="2" font-size="13" font-weight="600" fill="${p.accent}" letter-spacing="5">ELECTRONICS</text>
  </g>
</g>
</svg>`
}
