/**
 * Live theme, mirrored from the website.
 *
 * The storefront paints itself from a `site_theme` document served by
 * `/api/theme`, which the admin swaps for festivals (Purnima, Diwali, Ganesh…).
 * The app fetches the same document so the two surfaces never drift — hardcoding
 * today's palette here would look correct until the next festival and then be
 * silently wrong.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { BASE_URL } from "@/api/client"

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
  heroFrom: string
  heroVia: string
  heroTo: string
  glow: string
  ribbon: string
  ribbonText: string
}

/** The "Sara Default" preset, used until the network responds and if it never does. */
export const DEFAULT_TOKENS: ThemeTokens = {
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

export interface Theme {
  tokens: ThemeTokens
  /** Corner radius multiplier the website applies to cards and buttons. */
  radius: number
  announcement: string | null
  announcementLink: string | null
  /** Fixed brand colours the theme never repaints. */
  brand: { logo: string; danger: string; star: string; textInverse: string }
}

const BRAND = { logo: "#E11D2E", danger: "#DC2626", star: "#F59E0B", textInverse: "#FFFFFF" }
const CACHE_KEY = "sara.theme"

const ThemeContext = createContext<Theme>({
  tokens: DEFAULT_TOKENS,
  radius: 0.75,
  announcement: null,
  announcementLink: null,
  brand: BRAND,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>({
    tokens: DEFAULT_TOKENS,
    radius: 0.75,
    announcement: null,
    announcementLink: null,
    brand: BRAND,
  })

  useEffect(() => {
    let cancelled = false

    const apply = (payload: any) => {
      if (cancelled || !payload?.tokens) return
      setTheme({
        // Merge over the defaults so a theme that omits a token still renders.
        tokens: { ...DEFAULT_TOKENS, ...payload.tokens },
        radius: typeof payload.radius === "number" ? payload.radius : 0.75,
        announcement: payload.announcement ?? null,
        announcementLink: payload.announcementLink ?? null,
        brand: BRAND,
      })
    }

    ;(async () => {
      // Paint from cache first so a festival theme doesn't flash the default
      // palette on every cold start.
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY)
        if (cached) apply(JSON.parse(cached))
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch(`${BASE_URL}/api/theme`, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return
        const json = await res.json()
        if (json?.theme) {
          apply(json.theme)
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json.theme)).catch(() => {})
        }
      } catch {
        // Offline or slow: the cached or default palette is already showing.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => theme, [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}
