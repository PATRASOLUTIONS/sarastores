import { getCollection } from "@/lib/db-service"
import { DEFAULT_THEME, isThemeActive, normalizeTheme, type Theme } from "@/lib/theme"

/**
 * Server-side access to the active storefront theme.
 *
 * Kept apart from lib/theme.ts so client components can import the theme types
 * and presets without pulling the MongoDB driver into the browser bundle.
 */

export const THEME_COLLECTION = "site_theme"

/**
 * The root layout reads the theme on every render, so an uncached lookup would
 * add a Mongo round trip to every page load. Themes change rarely, so a short
 * in-process TTL is enough; the admin save path busts it explicitly.
 */
const CACHE_TTL_MS = 60_000
let cached: { theme: Theme; at: number } | null = null

export function invalidateThemeCache(): void {
  cached = null
}

/**
 * The active theme, or the default when none is set or the scheduled window
 * has passed. Never throws — a theming failure must not take the site down.
 */
export async function getActiveTheme(): Promise<Theme> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    // Re-check the window on every read: a scheduled theme can expire while
    // the cached value is still fresh.
    return isThemeActive(cached.theme) ? cached.theme : DEFAULT_THEME
  }

  try {
    const collection = await getCollection(THEME_COLLECTION)
    const doc = await collection.findOne({ key: "active" })
    if (!doc?.theme) {
      cached = { theme: DEFAULT_THEME, at: Date.now() }
      return DEFAULT_THEME
    }

    const theme = normalizeTheme(doc.theme)
    cached = { theme, at: Date.now() }
    return isThemeActive(theme) ? theme : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export async function setActiveTheme(theme: Theme): Promise<Theme> {
  const normalized = normalizeTheme(theme)
  const collection = await getCollection(THEME_COLLECTION)

  await collection.updateOne(
    { key: "active" },
    { $set: { key: "active", theme: normalized, updatedAt: new Date() } },
    { upsert: true },
  )

  invalidateThemeCache()
  return normalized
}
