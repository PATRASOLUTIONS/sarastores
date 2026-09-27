import { getCollection } from "@/lib/db-service"
import { POSTER_BY_SLUG, type Poster, type PosterMotif } from "@/lib/posters"

/**
 * Admin-authored hero posters.
 *
 * They use the same shape and renderer as the bundled ones in lib/posters.ts,
 * so a custom poster is just another row the hero and the admin grid treat
 * identically. Only the definition lives in MongoDB; the artwork is still
 * generated on demand by renderPosterSvg.
 */

const COLLECTION = "custom_posters"

const MOTIFS: readonly PosterMotif[] = ["rays", "dots", "grid", "waves", "arcs"]
const GROUPS: readonly Poster["group"][] = ["Festival", "Category", "Offer", "Trust", "Seasonal"]

/**
 * Colours are interpolated into raw SVG markup, not escaped like the text is,
 * so anything other than a plain hex value is rejected outright.
 */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const PHOTO = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i

/** Kept short enough that the fixed 1920x600 layout doesn't overflow. */
const LIMITS = { eyebrow: 28, headline: 24, headlineAccent: 24, subline: 70, cta: 22 } as const

export interface CustomPoster extends Poster {
  custom: true
}

function text(value: unknown, max: number, fallback: string): string {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  return (cleaned || fallback).slice(0, max)
}

function colour(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback
}

function photo(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 7_000_000 || !PHOTO.test(value)) return undefined
  return value
}

export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return `custom-${base || "poster"}`
}

function sanitize(input: any, slug: string): CustomPoster {
  const motif: PosterMotif = MOTIFS.includes(input?.motif) ? input.motif : "rays"
  const group = GROUPS.includes(input?.group) ? input.group : "Offer"

  return {
    custom: true,
    slug,
    group,
    motif,
    eyebrow: text(input?.eyebrow, LIMITS.eyebrow, "SARA ELECTRONICS").toUpperCase(),
    headline: text(input?.headline, LIMITS.headline, "Your headline"),
    headlineAccent: text(input?.headlineAccent, LIMITS.headlineAccent, "here"),
    subline: text(input?.subline, LIMITS.subline, ""),
    cta: text(input?.cta, LIMITS.cta, "SHOP NOW").toUpperCase(),
    from: colour(input?.from, "#0F2557"),
    via: colour(input?.via, "#16336F"),
    to: colour(input?.to, "#0A1A40"),
    accent: colour(input?.accent, "#FF6A2C"),
    ink: colour(input?.ink, "#0A1A40"),
    photo: photo(input?.photo),
  }
}

export async function listCustomPosters(): Promise<CustomPoster[]> {
  try {
    const collection = await getCollection(COLLECTION)
    const docs = await collection.find({}).sort({ createdAt: -1 }).toArray()
    return docs.map((doc) => sanitize(doc, String(doc.slug)))
  } catch {
    return []
  }
}

export async function getCustomPoster(slug: string): Promise<CustomPoster | null> {
  if (!slug.startsWith("custom-")) return null
  try {
    const collection = await getCollection(COLLECTION)
    const doc = await collection.findOne({ slug })
    return doc ? sanitize(doc, String(doc.slug)) : null
  } catch {
    return null
  }
}

/** Creates, or overwrites when `slug` names an existing custom poster. */
export async function saveCustomPoster(input: any): Promise<CustomPoster> {
  const collection = await getCollection(COLLECTION)

  let slug = typeof input?.slug === "string" && input.slug.startsWith("custom-") ? input.slug : ""
  if (!slug) {
    const base = slugify(`${input?.headline ?? ""} ${input?.headlineAccent ?? ""}`)
    slug = base
    // Bundled slugs and existing custom ones both have to stay reachable.
    for (let n = 2; POSTER_BY_SLUG[slug] || (await collection.findOne({ slug })); n++) {
      slug = `${base}-${n}`
    }
  }

  const poster = sanitize(input, slug)
  await collection.updateOne(
    { slug },
    { $set: { ...poster, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
  return poster
}

export async function deleteCustomPoster(slug: string): Promise<boolean> {
  if (!slug.startsWith("custom-")) return false
  const collection = await getCollection(COLLECTION)
  const result = await collection.deleteOne({ slug })
  return result.deletedCount > 0
}
