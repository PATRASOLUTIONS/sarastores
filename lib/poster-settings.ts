import { getCollection } from "@/lib/db-service"
import { POSTERS } from "@/lib/posters"

/**
 * Which generated posters appear in the hero.
 *
 * Only the enabled slugs and their order are stored — the poster artwork itself
 * lives in lib/posters.ts, so editing a headline never requires a migration.
 */

const COLLECTION = "poster_settings"
const KEY = "hero"

export type PosterFeatureType = "product" | "category" | "subcategory"

/** What the poster showcases. A feature also becomes the poster's click target. */
export interface PosterFeature {
  type: PosterFeatureType
  id: string
}

export interface PosterLink {
  /** Where a click goes when no feature is set. Defaults to /products. */
  href: string
  feature?: PosterFeature
}

export interface PosterSettings {
  /** Slugs currently shown, in display order. */
  enabled: string[]
  /** Per-slug click target and featured product. */
  links: Record<string, PosterLink>
}

/** Nothing enabled by default: staff opt posters in rather than being surprised. */
export const DEFAULT_POSTER_SETTINGS: PosterSettings = { enabled: [], links: {} }

/** Only site-relative paths — an admin-set poster must not become an off-site redirect. */
function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null
  return trimmed
}

const FEATURE_TYPES: readonly PosterFeatureType[] = ["product", "category", "subcategory"]

function safeFeature(raw: any): PosterFeature | undefined {
  // Settings saved before categories were selectable only carried a product id.
  if (!raw?.feature && typeof raw?.productId === "string" && raw.productId.trim()) {
    return { type: "product", id: raw.productId.trim() }
  }

  const type = raw?.feature?.type
  const id = typeof raw?.feature?.id === "string" ? raw.feature.id.trim() : ""
  if (!id || !FEATURE_TYPES.includes(type)) return undefined
  return { type, id }
}

function sanitize(input: any): PosterSettings {
  const bundled = new Set(POSTERS.map((p) => p.slug))
  // Admin-authored posters live in MongoDB, so they can't be checked against a
  // static list here; the catalogue endpoint omits any that no longer exist.
  const known = (slug: string) => bundled.has(slug) || slug.startsWith("custom-")

  const raw: unknown[] = Array.isArray(input?.enabled) ? input.enabled : []
  // Drop slugs that no longer exist so a renamed poster can't 404 the hero.
  const enabled: string[] = Array.from(
    new Set(raw.filter((s): s is string => typeof s === "string" && known(s))),
  )

  const links: Record<string, PosterLink> = {}
  const rawLinks = input?.links && typeof input.links === "object" ? input.links : {}
  for (const slug of Object.keys(rawLinks)) {
    if (!known(slug)) continue
    const href = safeHref(rawLinks[slug]?.href)
    const feature = safeFeature(rawLinks[slug])
    links[slug] = { href: href ?? "/products", ...(feature ? { feature } : {}) }
  }

  return { enabled, links }
}

export async function getPosterSettings(): Promise<PosterSettings> {
  try {
    const collection = await getCollection(COLLECTION)
    const doc = await collection.findOne({ key: KEY })
    return doc ? sanitize(doc) : DEFAULT_POSTER_SETTINGS
  } catch {
    return DEFAULT_POSTER_SETTINGS
  }
}

export async function setPosterSettings(input: any): Promise<PosterSettings> {
  const clean = sanitize(input)
  const collection = await getCollection(COLLECTION)
  await collection.updateOne(
    { key: KEY },
    { $set: { key: KEY, enabled: clean.enabled, links: clean.links, updatedAt: new Date() } },
    { upsert: true },
  )
  return clean
}
