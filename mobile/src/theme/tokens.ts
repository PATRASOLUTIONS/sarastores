/**
 * Design tokens mirrored from the web app's Tailwind config so the two
 * surfaces stay visually identical. The web palette is the source of truth —
 * if it changes there, change it here.
 */

export const colors = {
  primary: "#0F2557",
  primaryDark: "#0A1A3D",
  primaryLight: "#1E3A6F",
  accent: "#FF6A2C",
  accentDark: "#E5551A",

  background: "#FFFFFF",
  surface: "#F7F8FA",
  surfaceAlt: "#EEF1F6",
  border: "#E2E6ED",

  text: "#111827",
  textMuted: "#6B7280",
  textInverse: "#FFFFFF",

  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",

  /** Discount ribbons and price savings on listing cards. */
  sale: "#FF6A2C",
  star: "#F59E0B",
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" },
  h2: { fontSize: 22, fontWeight: "700" },
  h3: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  bodySmall: { fontSize: 13, fontWeight: "400" },
  caption: { fontSize: 11, fontWeight: "500" },
  price: { fontSize: 20, fontWeight: "800" },
} as const

/** Indian number formatting — the web app shows ₹1,23,456, not ₹123,456. */
export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return "₹0"
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}
