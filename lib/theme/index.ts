/**
 * Storefront theming.
 *
 * Every colour, gradient and decorative effect on the storefront resolves to a
 * CSS custom property. Tailwind's `brand-*` scale points at those variables, so
 * changing a theme repaints the entire site — including the ~600 components
 * that already use `bg-brand-primary` — without touching a single class name.
 *
 * Themes are stored in Mongo and rendered into the document server-side, so
 * there is no flash of the wrong palette on first paint.
 */

export type ThemeEffect =
  | "none"
  | "confetti"
  | "diyas"
  | "petals"
  | "marigold"
  | "rockets"
  | "colours"
  | "coins"
  | "hearts"
  | "crescent"
  | "moonlight"
  | "tricolour"
  | "dandiya"
  | "leaves"
  | "snow"
  | "sparkles"
  | "fireworks"

/** How loud the festive treatment is: spacing, glow, ornament and banner scale. */
export type ThemeIntensity = "subtle" | "festive" | "grand"

/** Decorative motif tiled behind hero bands and section headers. */
export type ThemePattern =
  | "none"
  | "rangoli"
  | "floral"
  | "geometric"
  | "lights"
  | "rays"

export const THEME_EFFECTS: ThemeEffect[] = [
  "none",
  "confetti",
  "diyas",
  "petals",
  "marigold",
  "rockets",
  "colours",
  "coins",
  "hearts",
  "crescent",
  "moonlight",
  "tricolour",
  "dandiya",
  "leaves",
  "snow",
  "sparkles",
  "fireworks",
]

export const THEME_INTENSITIES: ThemeIntensity[] = ["subtle", "festive", "grand"]

export const THEME_PATTERNS: ThemePattern[] = [
  "none",
  "rangoli",
  "floral",
  "geometric",
  "lights",
  "rays",
]

export interface ThemeTokens {
  primary: string
  primaryHover: string
  primaryLight: string
  primarySubtle: string
  accent: string
  accentHover: string
  surface: string
  surfaceRaised: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  border: string
  borderHover: string
  success: string
  warning: string
  /** Hero band gradient. */
  heroFrom: string
  heroVia: string
  heroTo: string
  /** Colour of the ambient glow behind hero and section headings. */
  glow: string
  /** Sale ribbon / discount badge. */
  ribbon: string
  ribbonText: string
}

export interface Theme {
  id: string
  name: string
  /** Shown in the admin picker so staff know when to use it. */
  occasion: string
  /** Key into lib/marketing/occasions.ts, so the calendar can offer this theme. */
  occasionKey: string | null
  tokens: ThemeTokens
  effect: ThemeEffect
  intensity: ThemeIntensity
  pattern: ThemePattern
  /** Hanging garland across the hero. */
  toran: boolean
  /** Ganesh arrival-and-blessing sequence. Only meaningful on the Ganesh theme. */
  blessing: boolean
  /** Optional strip above the header, e.g. "Diwali Dhamaka — up to 60% off". */
  announcement: string
  announcementLink: string
  /** Corner radius scale in rem; festivals often want softer or sharper cards. */
  radius: number
  /** Active window; outside it the default theme is used. */
  startsAt: string | null
  endsAt: string | null
}

const BASE_TOKENS: ThemeTokens = {
  primary: "#0F2557",
  primaryHover: "#0A1A40",
  primaryLight: "#E6EBF5",
  primarySubtle: "#F2F5FA",
  accent: "#FF6A2C",
  accentHover: "#E85618",
  surface: "#FAFBFC",
  surfaceRaised: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  border: "#E2E8F0",
  borderHover: "#CBD5E1",
  success: "#059669",
  warning: "#D97706",
  heroFrom: "#0F2557",
  heroVia: "#16336F",
  heroTo: "#0A1A40",
  glow: "#FF6A2C",
  ribbon: "#DC2626",
  ribbonText: "#FFFFFF",
}

function theme(
  id: string,
  name: string,
  occasion: string,
  tokens: Partial<ThemeTokens>,
  extras: Partial<
    Pick<
      Theme,
      | "effect"
      | "announcement"
      | "announcementLink"
      | "radius"
      | "intensity"
      | "pattern"
      | "occasionKey"
      | "toran"
      | "blessing"
    >
  > = {},
): Theme {
  return {
    id,
    name,
    occasion,
    occasionKey: extras.occasionKey ?? null,
    tokens: { ...BASE_TOKENS, ...tokens },
    effect: extras.effect ?? "none",
    intensity: extras.intensity ?? "festive",
    pattern: extras.pattern ?? "none",
    toran: extras.toran ?? true,
    blessing: extras.blessing ?? false,
    announcement: extras.announcement ?? "",
    announcementLink: extras.announcementLink ?? "/offers",
    radius: extras.radius ?? 0.75,
    startsAt: null,
    endsAt: null,
  }
}

/**
 * Ready-made palettes for the Indian retail calendar. Staff pick one and
 * adjust; they are starting points, not fixed.
 */
export const THEME_PRESETS: Theme[] = [
  theme("default", "Sara Default", "Everyday", {}, { intensity: "subtle", pattern: "none", toran: false }),

  theme(
    "ganesh",
    "Ganesh Chaturthi",
    "Ganesh Chaturthi / Ganpati",
    {
      primary: "#9C2A0E",
      primaryHover: "#7A200A",
      primaryLight: "#FDECE4",
      primarySubtle: "#FFF7F3",
      accent: "#F5A623",
      accentHover: "#DB8B0C",
      heroFrom: "#9C2A0E",
      heroVia: "#C2410C",
      heroTo: "#6B1607",
      glow: "#F5A623",
      ribbon: "#F5A623",
      ribbonText: "#6B1607",
    },
    {
      effect: "marigold",
      intensity: "grand",
      pattern: "rangoli",
      toran: true,
      blessing: true,
      occasionKey: "ganesh-chaturthi",
      announcement: "Ganpati Bappa Morya — Ganesh Chaturthi offers across every category",
      announcementLink: "/ganesh",
    },
  ),

  theme(
    "diwali",
    "Diwali Dhamaka",
    "Diwali / Deepavali",
    {
      primary: "#4A148C",
      primaryHover: "#38106B",
      primaryLight: "#F3E5F5",
      primarySubtle: "#FAF5FC",
      accent: "#FFB300",
      accentHover: "#FF8F00",
      heroFrom: "#4A148C",
      heroVia: "#6A1B9A",
      heroTo: "#2E0854",
      glow: "#FFB300",
      ribbon: "#FF6F00",
    },
    {
      effect: "rockets",
      intensity: "grand",
      pattern: "lights",
      occasionKey: "diwali",
      announcement: "Diwali Dhamaka — up to 60% off + no-cost EMI",
    },
  ),

  theme(
    "holi",
    "Holi Colours",
    "Holi",
    {
      primary: "#C2185B",
      primaryHover: "#9C1249",
      primaryLight: "#FCE4EC",
      primarySubtle: "#FFF5F8",
      accent: "#00BCD4",
      accentHover: "#0097A7",
      heroFrom: "#C2185B",
      heroVia: "#7B1FA2",
      heroTo: "#00838F",
      glow: "#FFEB3B",
      ribbon: "#00BCD4",
    },
    { effect: "colours", intensity: "grand", pattern: "floral", occasionKey: "holi", announcement: "Holi Sale — colours of savings across every category" },
  ),

  theme(
    "independence",
    "Independence Day",
    "15 August / 26 January",
    {
      primary: "#0B5C3A",
      primaryHover: "#08452B",
      primaryLight: "#E6F4EC",
      primarySubtle: "#F3FAF6",
      accent: "#FF9933",
      accentHover: "#F57C00",
      heroFrom: "#FF9933",
      heroVia: "#FFFFFF",
      heroTo: "#138808",
      glow: "#FF9933",
      ribbon: "#138808",
    },
    { effect: "tricolour", intensity: "grand", pattern: "rays", occasionKey: "independence-day", announcement: "Freedom Sale — celebrating with unbeatable prices" },
  ),

  theme(
    "newyear",
    "New Year",
    "December / January",
    {
      primary: "#0D1B3E",
      primaryHover: "#081228",
      primaryLight: "#E8EAF6",
      primarySubtle: "#F5F6FC",
      accent: "#D4AF37",
      accentHover: "#B8952E",
      heroFrom: "#0D1B3E",
      heroVia: "#1A2B5C",
      heroTo: "#000814",
      glow: "#D4AF37",
      ribbon: "#D4AF37",
      ribbonText: "#0D1B3E",
    },
    { effect: "fireworks", intensity: "grand", pattern: "geometric", occasionKey: "new-year", announcement: "New Year Sale — start the year with a new upgrade" },
  ),

  theme(
    "christmas",
    "Christmas",
    "December",
    {
      primary: "#0F5132",
      primaryHover: "#0A3D26",
      primaryLight: "#E3F2E8",
      primarySubtle: "#F4FAF6",
      accent: "#C62828",
      accentHover: "#A61F1F",
      heroFrom: "#0F5132",
      heroVia: "#14653F",
      heroTo: "#0A3D26",
      glow: "#E53935",
      ribbon: "#C62828",
    },
    { effect: "snow", pattern: "lights", occasionKey: "christmas", announcement: "Christmas Sale — gifts for the whole family" },
  ),

  theme(
    "onam",
    "Onam",
    "Onam",
    {
      primary: "#1B5E20",
      primaryHover: "#14481A",
      primaryLight: "#E8F5E9",
      primarySubtle: "#F4FBF5",
      accent: "#FDD835",
      accentHover: "#F9A825",
      heroFrom: "#1B5E20",
      heroVia: "#2E7D32",
      heroTo: "#F9A825",
      glow: "#FDD835",
      ribbon: "#EF6C00",
    },
    { effect: "leaves", pattern: "floral", occasionKey: "onam", announcement: "Onam Offers — Thiruvonam savings on home appliances" },
  ),

  theme(
    "pongal",
    "Pongal",
    "Pongal / Sankranti",
    {
      primary: "#8D6E00",
      primaryHover: "#6B5300",
      primaryLight: "#FFF8E1",
      primarySubtle: "#FFFCF2",
      accent: "#E65100",
      accentHover: "#BF360C",
      heroFrom: "#8D6E00",
      heroVia: "#B58900",
      heroTo: "#5D4700",
      glow: "#FFC107",
      ribbon: "#E65100",
    },
    { effect: "sparkles", pattern: "rays", occasionKey: "pongal-sankranti", announcement: "Pongal Sale — harvest-season deals on kitchen appliances" },
  ),

  theme(
    "megasale",
    "Mega Sale",
    "Flagship sale event",
    {
      primary: "#B71C1C",
      primaryHover: "#8E1616",
      primaryLight: "#FFEBEE",
      primarySubtle: "#FFF5F5",
      accent: "#FFC107",
      accentHover: "#FFA000",
      heroFrom: "#B71C1C",
      heroVia: "#D32F2F",
      heroTo: "#7F0000",
      glow: "#FFC107",
      ribbon: "#FFC107",
      ribbonText: "#7F0000",
    },
    { effect: "confetti", intensity: "grand", pattern: "rays", announcement: "Sara Mega Sale is live — lowest prices of the year" },
  ),

  theme(
    "summer",
    "Summer Cool",
    "Summer / AC season",
    {
      primary: "#01579B",
      primaryHover: "#01426F",
      primaryLight: "#E1F5FE",
      primarySubtle: "#F2FAFE",
      accent: "#00BCD4",
      accentHover: "#0097A7",
      heroFrom: "#01579B",
      heroVia: "#0288D1",
      heroTo: "#01426F",
      glow: "#4FC3F7",
      ribbon: "#00ACC1",
    },
    { effect: "sparkles", pattern: "geometric", occasionKey: "summer-sale", announcement: "Summer Cooling Sale — ACs, coolers and refrigerators" },
  ),

  theme(
    "navratri",
    "Navratri Nights",
    "Navratri / Garba",
    {
      primary: "#6A1B9A",
      primaryHover: "#4F1373",
      primaryLight: "#F3E5F5",
      primarySubtle: "#FBF5FD",
      accent: "#FF6D00",
      accentHover: "#E65100",
      heroFrom: "#6A1B9A",
      heroVia: "#D81B60",
      heroTo: "#4A148C",
      glow: "#FFD54F",
      ribbon: "#FF6D00",
    },
    { effect: "dandiya", intensity: "grand", pattern: "geometric", occasionKey: "navratri", announcement: "Navratri Nights — nine days of festive prices" },
  ),

  theme(
    "dussehra",
    "Dussehra",
    "Dussehra / Vijayadashami",
    {
      primary: "#1A237E",
      primaryHover: "#121858",
      primaryLight: "#E8EAF6",
      primarySubtle: "#F5F6FD",
      accent: "#FFA000",
      accentHover: "#FF8F00",
      heroFrom: "#1A237E",
      heroVia: "#283593",
      heroTo: "#0D1250",
      glow: "#FFC107",
      ribbon: "#C62828",
    },
    { effect: "fireworks", intensity: "grand", pattern: "rays", occasionKey: "dussehra", announcement: "Vijayadashami — an auspicious day to bring one home" },
  ),

  theme(
    "durgapuja",
    "Durga Puja",
    "Durga Puja / Pujor Bazaar",
    {
      primary: "#AD1457",
      primaryHover: "#880E4F",
      primaryLight: "#FCE4EC",
      primarySubtle: "#FFF5F9",
      accent: "#FFB300",
      accentHover: "#FF8F00",
      heroFrom: "#AD1457",
      heroVia: "#C2185B",
      heroTo: "#6A0D3A",
      glow: "#FFB300",
      ribbon: "#F4511E",
    },
    { effect: "petals", intensity: "grand", pattern: "floral", occasionKey: "durga-puja", announcement: "Pujor Bazaar — Durga Puja offers on every category" },
  ),

  theme(
    "dhanteras",
    "Dhanteras Gold",
    "Dhanteras",
    {
      primary: "#7B5800",
      primaryHover: "#5C4100",
      primaryLight: "#FFF8E1",
      primarySubtle: "#FFFCF0",
      accent: "#D4AF37",
      accentHover: "#B8952E",
      heroFrom: "#7B5800",
      heroVia: "#A67C00",
      heroTo: "#4E3700",
      glow: "#FFD54F",
      ribbon: "#D4AF37",
      ribbonText: "#4E3700",
    },
    { effect: "coins", intensity: "grand", pattern: "rays", occasionKey: "dhanteras", announcement: "Dhanteras — the most auspicious day to buy" },
  ),

  theme(
    "rakshabandhan",
    "Raksha Bandhan",
    "Raksha Bandhan",
    {
      primary: "#AD1457",
      primaryHover: "#871044",
      primaryLight: "#FCE4EC",
      primarySubtle: "#FFF6F9",
      accent: "#FFA726",
      accentHover: "#FB8C00",
      heroFrom: "#AD1457",
      heroVia: "#EC407A",
      heroTo: "#7B0D3D",
      glow: "#FFCC80",
      ribbon: "#FF7043",
    },
    { effect: "petals", pattern: "floral", occasionKey: "raksha-bandhan", announcement: "Raksha Bandhan — gifts your sibling will actually use" },
  ),

  theme(
    "eid",
    "Eid Mubarak",
    "Eid",
    {
      primary: "#00695C",
      primaryHover: "#004D40",
      primaryLight: "#E0F2F1",
      primarySubtle: "#F2FAF9",
      accent: "#D4AF37",
      accentHover: "#B8952E",
      heroFrom: "#00695C",
      heroVia: "#00897B",
      heroTo: "#00382E",
      glow: "#D4AF37",
      ribbon: "#D4AF37",
      ribbonText: "#00382E",
    },
    { effect: "crescent", intensity: "grand", pattern: "geometric", occasionKey: "eid", announcement: "Eid Mubarak — celebration offers across the store" },
  ),

  theme(
    "ugadi",
    "Ugadi / Gudi Padwa",
    "Ugadi / Gudi Padwa",
    {
      primary: "#33691E",
      primaryHover: "#255015",
      primaryLight: "#F1F8E9",
      primarySubtle: "#F8FCF4",
      accent: "#FDD835",
      accentHover: "#FBC02D",
      heroFrom: "#33691E",
      heroVia: "#558B2F",
      heroTo: "#1B4310",
      glow: "#FDD835",
      ribbon: "#EF6C00",
    },
    { effect: "leaves", pattern: "floral", occasionKey: "gudi-padwa-ugadi", announcement: "Ugadi & Gudi Padwa — start the new year with an upgrade" },
  ),

  theme(
    "republic",
    "Republic Day",
    "26 January",
    {
      primary: "#0B3C8C",
      primaryHover: "#082D69",
      primaryLight: "#E8EFFA",
      primarySubtle: "#F4F8FD",
      accent: "#FF9933",
      accentHover: "#F57C00",
      heroFrom: "#FF9933",
      heroVia: "#FFFFFF",
      heroTo: "#138808",
      glow: "#FF9933",
      ribbon: "#0B3C8C",
    },
    { effect: "tricolour", intensity: "grand", pattern: "rays", occasionKey: "republic-day", announcement: "Republic Day Sale — republic-sized price drops" },
  ),

  theme(
    "valentines",
    "Valentine's Day",
    "14 February",
    {
      primary: "#AD1457",
      primaryHover: "#880E4F",
      primaryLight: "#FCE4EC",
      primarySubtle: "#FFF5F8",
      accent: "#FF4081",
      accentHover: "#F50057",
      heroFrom: "#AD1457",
      heroVia: "#E91E63",
      heroTo: "#6A0D3A",
      glow: "#FF80AB",
      ribbon: "#F50057",
    },
    { effect: "hearts", pattern: "floral", occasionKey: "valentines", announcement: "Valentine's Day — gift something they'll use every day" },
  ),

  theme(
    "karwachauth",
    "Karwa Chauth",
    "Karwa Chauth",
    {
      primary: "#8E1538",
      primaryHover: "#6D1029",
      primaryLight: "#FCE4EA",
      primarySubtle: "#FFF5F7",
      accent: "#D4AF37",
      accentHover: "#B8952E",
      heroFrom: "#8E1538",
      heroVia: "#B71C4A",
      heroTo: "#5E0C24",
      glow: "#F0C75E",
      ribbon: "#D4AF37",
      ribbonText: "#5E0C24",
    },
    { effect: "diyas", pattern: "rangoli", occasionKey: "karwa-chauth", announcement: "Karwa Chauth — thoughtful gifts for your partner" },
  ),

  theme(
    "blackfriday",
    "Black Friday",
    "Black Friday / Cyber Week",
    {
      primary: "#111827",
      primaryHover: "#000000",
      primaryLight: "#E5E7EB",
      primarySubtle: "#F3F4F6",
      accent: "#FACC15",
      accentHover: "#EAB308",
      heroFrom: "#111827",
      heroVia: "#1F2937",
      heroTo: "#000000",
      glow: "#FACC15",
      ribbon: "#FACC15",
      ribbonText: "#111827",
    },
    { effect: "sparkles", intensity: "grand", pattern: "geometric", occasionKey: "black-friday", announcement: "Black Friday — the deepest discounts of the year" },
  ),

  theme(
    "wedding",
    "Wedding Season",
    "Wedding season",
    {
      primary: "#7B4B94",
      primaryHover: "#5E3872",
      primaryLight: "#F3EAF8",
      primarySubtle: "#FBF7FD",
      accent: "#E0A458",
      accentHover: "#C68A3E",
      heroFrom: "#7B4B94",
      heroVia: "#9C6BB5",
      heroTo: "#523062",
      glow: "#E0A458",
      ribbon: "#E0A458",
      ribbonText: "#523062",
    },
    { effect: "petals", pattern: "floral", occasionKey: "wedding-season", announcement: "Wedding Season — everything for a brand-new home" },
  ),

  theme(
    "bhaidooj",
    "Bhai Dooj",
    "Bhai Dooj",
    {
      primary: "#B23A48",
      primaryHover: "#8C2C38",
      primaryLight: "#FCE8EB",
      primarySubtle: "#FFF6F7",
      accent: "#F2A65A",
      accentHover: "#DC8B3C",
      heroFrom: "#B23A48",
      heroVia: "#D45D6A",
      heroTo: "#7C2029",
      glow: "#F2A65A",
      ribbon: "#F2A65A",
      ribbonText: "#7C2029",
    },
    { effect: "petals", pattern: "rangoli", occasionKey: "bhai-dooj", announcement: "Bhai Dooj — celebrate the bond with a gift that lasts" },
  ),

  theme(
    "purnima",
    "Purnima",
    "Full moon day — Guru, Sharad, Kartik & Buddha Purnima",
    {
      primary: "#22305F",
      primaryHover: "#18234A",
      primaryLight: "#E8ECF7",
      primarySubtle: "#F5F7FC",
      accent: "#5C79C4",
      accentHover: "#47619F",
      heroFrom: "#22305F",
      heroVia: "#31427C",
      heroTo: "#101835",
      glow: "#DCE6FA",
      ribbon: "#C8A951",
      ribbonText: "#101835",
    },
    {
      effect: "moonlight",
      // Purnima is serene rather than loud, so it stays at festive: no garland,
      // no oversized bands.
      intensity: "festive",
      pattern: "lights",
      toran: false,
      announcement: "Purnima special — auspicious full moon day offers",
    },
  ),
]

export const DEFAULT_THEME: Theme = THEME_PRESETS[0]

export function getPreset(id: string): Theme | null {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? null
}

/** Guard against a malformed stored theme repainting the site with `undefined`. */
export function normalizeTheme(input: any): Theme {
  if (!input || typeof input !== "object") return DEFAULT_THEME

  const tokens: ThemeTokens = { ...BASE_TOKENS }
  for (const key of Object.keys(BASE_TOKENS) as (keyof ThemeTokens)[]) {
    const value = input?.tokens?.[key]
    if (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim())) {
      tokens[key] = value.trim()
    }
  }

  const radius = Number(input.radius)

  return {
    id: String(input.id || "custom"),
    name: String(input.name || "Custom"),
    occasion: String(input.occasion || ""),
    occasionKey: input.occasionKey ? String(input.occasionKey) : null,
    tokens,
    effect: THEME_EFFECTS.includes(input.effect) ? input.effect : "none",
    intensity: THEME_INTENSITIES.includes(input.intensity) ? input.intensity : "festive",
    pattern: THEME_PATTERNS.includes(input.pattern) ? input.pattern : "none",
    toran: input.toran !== false,
    blessing: input.blessing === true,
    announcement: String(input.announcement || ""),
    announcementLink: String(input.announcementLink || "/offers"),
    radius: Number.isFinite(radius) && radius >= 0 && radius <= 2 ? radius : 0.75,
    startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : null,
  }
}

/** A scheduled theme only applies inside its window. */
export function isThemeActive(theme: Theme, now: Date = new Date()): boolean {
  if (theme.startsAt && now < new Date(theme.startsAt)) return false
  if (theme.endsAt && now > new Date(theme.endsAt)) return false
  return true
}

/** #RRGGBB → "r g b", for `rgb(var(--x) / <alpha>)` in Tailwind. */
function toRgbChannels(hex: string): string {
  const value = hex.replace("#", "")
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(0, 6)

  const int = Number.parseInt(full, 16)
  if (!Number.isFinite(int)) return "15 37 87"

  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`
}

const TOKEN_TO_VAR: Record<keyof ThemeTokens, string> = {
  primary: "--brand-primary",
  primaryHover: "--brand-primary-hover",
  primaryLight: "--brand-primary-light",
  primarySubtle: "--brand-primary-subtle",
  accent: "--brand-accent",
  accentHover: "--brand-accent-hover",
  surface: "--brand-surface",
  surfaceRaised: "--brand-surface-raised",
  textPrimary: "--brand-text-primary",
  textSecondary: "--brand-text-secondary",
  textTertiary: "--brand-text-tertiary",
  border: "--brand-border",
  borderHover: "--brand-border-hover",
  success: "--brand-success",
  warning: "--brand-warning",
  heroFrom: "--brand-hero-from",
  heroVia: "--brand-hero-via",
  heroTo: "--brand-hero-to",
  glow: "--brand-glow",
  ribbon: "--brand-ribbon",
  ribbonText: "--brand-ribbon-text",
}

/**
 * Scales that turn `intensity` into concrete layout, so a festival changes the
 * shape of the page and not just its colours.
 */
const INTENSITY_SCALE: Record<ThemeIntensity, { glow: number; band: number; ornament: number }> = {
  subtle: { glow: 0.12, band: 1, ornament: 0 },
  festive: { glow: 0.28, band: 1.15, ornament: 0.35 },
  grand: { glow: 0.45, band: 1.35, ornament: 0.6 },
}

/**
 * Inline style block for the document root.
 *
 * Each token is emitted twice: the hex for direct `var()` use, and an
 * `-rgb` channel triple so Tailwind can apply opacity modifiers such as
 * `bg-brand-primary/10`.
 */
export function themeToCssVars(theme: Theme): string {
  const lines: string[] = []

  for (const [token, variable] of Object.entries(TOKEN_TO_VAR) as [keyof ThemeTokens, string][]) {
    const hex = theme.tokens[token]
    lines.push(`${variable}: ${hex};`)
    lines.push(`${variable}-rgb: ${toRgbChannels(hex)};`)
  }

  const scale = INTENSITY_SCALE[theme.intensity] ?? INTENSITY_SCALE.festive
  lines.push(`--radius: ${theme.radius}rem;`)
  lines.push(`--theme-glow-opacity: ${scale.glow};`)
  lines.push(`--theme-band-scale: ${scale.band};`)
  lines.push(`--theme-ornament-opacity: ${scale.ornament};`)

  return `:root{${lines.join("")}}`
}
