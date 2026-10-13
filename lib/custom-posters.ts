import { getCollection } from "@/lib/db-service"
import { POSTER_BY_SLUG, type Poster, type PosterMotif } from "@/lib/posters"
import { z } from "zod"
import type { ClientSession } from "mongodb"
import { MongoServerError } from "mongodb"

/**
 * Admin-authored hero posters.
 *
 * They use the same shape and renderer as the bundled ones in lib/posters.ts,
 * so a custom poster is just another row the hero and the admin grid treat
 * identically. Only the definition lives in MongoDB; the artwork is still
 * generated on demand by renderPosterSvg.
 */

const COLLECTION = "custom_posters"

const motifSchema = z.enum(["rays", "dots", "grid", "waves", "arcs"])
const groupSchema = z.enum(["Festival", "Category", "Offer", "Trust", "Seasonal"])
const posterInputSchema = z.object({
  slug: z.unknown().optional(), motif: z.unknown().optional(), group: z.unknown().optional(),
  eyebrow: z.unknown().optional(), headline: z.unknown().optional(), headlineAccent: z.unknown().optional(),
  subline: z.unknown().optional(), cta: z.unknown().optional(),
  from: z.unknown().optional(), via: z.unknown().optional(), to: z.unknown().optional(),
  accent: z.unknown().optional(), ink: z.unknown().optional(), photo: z.unknown().optional(),
})

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

function sanitize(input: z.infer<typeof posterInputSchema>, slug: string): CustomPoster {
  const parsedMotif = motifSchema.safeParse(input.motif)
  const parsedGroup = groupSchema.safeParse(input.group)
  const motif: PosterMotif = parsedMotif.success ? parsedMotif.data : "rays"
  const group = parsedGroup.success ? parsedGroup.data : "Offer"

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

export async function listCustomPosters(session?: ClientSession): Promise<CustomPoster[]> {
  try {
    const collection = await getCollection(COLLECTION)
    const docs = await collection.find({}, { session }).sort({ createdAt: -1 }).toArray()
    return docs.map((doc) => sanitize(posterInputSchema.parse(doc), String(doc.slug)))
  } catch (error) {
    console.error("[Custom posters] Failed to load poster catalog", error)
    throw error
  }
}

export async function getCustomPoster(slug: string): Promise<CustomPoster | null> {
  if (!slug.startsWith("custom-")) return null
  try {
    const collection = await getCollection(COLLECTION)
    const doc = await collection.findOne({ slug })
    return doc ? sanitize(posterInputSchema.parse(doc), String(doc.slug)) : null
  } catch (error) {
    console.error("[Custom posters] Failed to load poster", error)
    throw error
  }
}

/** Creates, or overwrites when `slug` names an existing custom poster. */
export async function saveCustomPoster(value: unknown): Promise<CustomPoster> {
  const input = posterInputSchema.parse(value)
  const collection = await getCollection(COLLECTION)

  const slug = typeof input?.slug === "string" && input.slug.startsWith("custom-") ? input.slug : ""
  if (!slug) {
    const base = slugify(`${input?.headline ?? ""} ${input?.headlineAccent ?? ""}`)
    for (let n = 1; n <= 1000; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`
      if (POSTER_BY_SLUG[candidate] || await collection.findOne({ slug: candidate })) continue
      const poster = sanitize(input, candidate)
      try {
        await collection.insertOne({ ...poster, createdAt: new Date(), updatedAt: new Date() })
        return poster
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) continue
        throw error
      }
    }
    throw new Error("Could not allocate a unique custom poster slug")
  }

  const poster = sanitize(input, slug)
  const saved = await collection.updateOne(
    { slug },
    { $set: { ...poster, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
  if (!saved.matchedCount && !saved.upsertedId) throw new Error("Custom poster write was not acknowledged")
  return poster
}

export async function deleteCustomPoster(slug: string, session?: ClientSession): Promise<boolean> {
  if (!slug.startsWith("custom-")) return false
  const collection = await getCollection(COLLECTION)
  const result = await collection.deleteOne({ slug }, { session })
  return result.deletedCount > 0
}
