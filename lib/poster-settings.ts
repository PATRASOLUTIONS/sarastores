import { getCollection } from "@/lib/db-service"
import { POSTERS } from "@/lib/posters"
import { z } from "zod"
import type { ClientSession } from "mongodb"

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
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(trimmed)) return null
  return trimmed
}

const linkInputSchema = z.object({
  href: z.unknown().optional(),
  productId: z.unknown().optional(),
  feature: z.unknown().optional(),
})
const featureInputSchema = z.object({
  type: z.enum(["product", "category", "subcategory"]),
  id: z.string().trim().min(1),
})

function safeFeature(raw: z.infer<typeof linkInputSchema>): PosterFeature | undefined {
  // Settings saved before categories were selectable only carried a product id.
  if (!raw?.feature && typeof raw?.productId === "string" && raw.productId.trim()) {
    return { type: "product", id: raw.productId.trim() }
  }

  const parsed = featureInputSchema.safeParse(raw.feature)
  return parsed.success ? parsed.data : undefined
}

function sanitize(input: unknown): PosterSettings {
  const settings = z.object({
    enabled: z.unknown().optional(),
    links: z.unknown().optional(),
  }).safeParse(input)
  const bundled = new Set(POSTERS.map((p) => p.slug))
  // Admin-authored posters live in MongoDB, so they can't be checked against a
  // static list here; the catalogue endpoint omits any that no longer exist.
  const known = (slug: string) => bundled.has(slug) || slug.startsWith("custom-")

  const raw: unknown[] = settings.success && Array.isArray(settings.data.enabled) ? settings.data.enabled : []
  // Drop slugs that no longer exist so a renamed poster can't 404 the hero.
  const enabled: string[] = Array.from(
    new Set(raw.filter((s): s is string => typeof s === "string" && known(s))),
  )

  const links: Record<string, PosterLink> = {}
  const parsedLinks = z.record(z.unknown()).safeParse(settings.success ? settings.data.links : undefined)
  const rawLinks = parsedLinks.success ? parsedLinks.data : {}
  for (const [slug, rawLink] of Object.entries(rawLinks)) {
    if (!known(slug)) continue
    const parsed = linkInputSchema.safeParse(rawLink)
    const href = safeHref(parsed.success ? parsed.data.href : undefined)
    const feature = parsed.success ? safeFeature(parsed.data) : undefined
    links[slug] = { href: href ?? "/products", ...(feature ? { feature } : {}) }
  }

  return { enabled, links }
}

export async function getPosterSettings(session?: ClientSession): Promise<PosterSettings> {
  try {
    const collection = await getCollection(COLLECTION)
    const doc = await collection.findOne({ key: KEY }, { session })
    return doc ? sanitize(doc) : DEFAULT_POSTER_SETTINGS
  } catch (error) {
    console.error("[Poster settings] Failed to load hero configuration", error)
    throw error
  }
}

export async function setPosterSettings(input: unknown, session?: ClientSession): Promise<PosterSettings> {
  const clean = sanitize(input)
  const collection = await getCollection(COLLECTION)
  const result = await collection.updateOne(
    { key: KEY },
    { $set: { key: KEY, enabled: clean.enabled, links: clean.links, updatedAt: new Date() } },
    { upsert: true, session },
  )
  if (!result.matchedCount && !result.upsertedId) throw new Error("Poster settings write was not acknowledged")
  return clean
}
