import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { POSTERS } from "@/lib/posters"
import { getPosterSettings, setPosterSettings, type PosterFeature } from "@/lib/poster-settings"
import { listCustomPosters } from "@/lib/custom-posters"
import { getCollection, normalizeId, COLLECTIONS } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { PosterSettingsWriteSchema } from "@/lib/validation"
import { connectToDatabase } from "@/lib/mongodb"
class PosterSelectionError extends Error {}

interface ResolvedFeature {
  type: PosterFeature["type"]
  id: string
  name: string
  image: string | null
  price: number | null
  mrp: number | null
  href: string
  caption: string | null
}

const featureKey = (f: PosterFeature) => `${f.type}:${f.id}`
interface FeatureDocument {
  _id: ObjectId | string
  id?: string
  name?: string
  image?: string | null
  slug?: string
  price?: number | null
  mrp?: number | null
  active?: boolean
}

async function findByIds(name: string, ids: string[], projection: Record<string, 1>) {
  if (ids.length === 0) return []
  const collection = await getCollection<FeatureDocument>(name)
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
  const docs = await collection
    .find({
      ...(name === COLLECTIONS.PRODUCTS ? { active: true } : { active: { $ne: false } }),
      $or: [{ _id: { $in: objectIds } }, { _id: { $in: ids } }, { id: { $in: ids } }],
    }, { projection })
    .toArray()
  return docs.map((doc) => normalizeId(doc))
}

/** Featured items are resolved server-side so the hero needs one request, not N. */
async function resolveFeatures(features: PosterFeature[]): Promise<Record<string, ResolvedFeature>> {
  const map: Record<string, ResolvedFeature> = {}
  if (features.length === 0) return map

  const idsFor = (type: PosterFeature["type"]) =>
    Array.from(new Set(features.filter((f) => f.type === type).map((f) => f.id)))

  try {
    const [products, categories, subCategories] = await Promise.all([
      findByIds(COLLECTIONS.PRODUCTS, idsFor("product"), {
        name: 1,
        slug: 1,
        price: 1,
        mrp: 1,
        image: 1,
      }),
      findByIds(COLLECTIONS.CATEGORIES, idsFor("category"), { name: 1, image: 1 }),
      findByIds(COLLECTIONS.SUB_CATEGORIES, idsFor("subcategory"), { name: 1, image: 1 }),
    ])

    for (const p of products) {
      map[`product:${p.id}`] = {
        type: "product",
        id: p.id,
        name: p.name ?? "",
        image: p.image ?? null,
        price: p.price ?? null,
        mrp: p.mrp ?? null,
        href: `/product/${p.slug ?? p.id}`,
        caption: null,
      }
    }

    for (const c of categories) {
      map[`category:${c.id}`] = {
        type: "category",
        id: c.id,
        name: c.name ?? "",
        image: c.image ?? null,
        price: null,
        mrp: null,
        href: `/category/${c.id}`,
        caption: "Explore the range",
      }
    }

    for (const s of subCategories) {
      const name = String(s.name ?? "").trim()
      map[`subcategory:${s.id}`] = {
        type: "subcategory",
        id: s.id,
        name,
        image: s.image ?? null,
        price: null,
        mrp: null,
        // /sub-category/[name] matches on the name, turning hyphens back into spaces.
        href: `/sub-category/${encodeURIComponent(name.replace(/\s+/g, "-"))}`,
        caption: "Explore the range",
      }
    }
  } catch (error) {
    console.error("[Posters] Featured catalogue lookup failed", error)
    throw error
  }

  return map
}

/** Public: the catalogue plus which posters are live. */
export async function GET() {
  try {
    const [settings, custom] = await Promise.all([getPosterSettings(), listCustomPosters()])

    const configured = Object.values(settings.links)
      .map((l) => l.feature)
      .filter((f): f is PosterFeature => Boolean(f))
    const resolved = await resolveFeatures(configured)

    const posters = [...custom, ...POSTERS].map((p) => {
      const link = settings.links[p.slug]
      const feature = link?.feature ? resolved[featureKey(link.feature)] ?? null : null
      return {
        slug: p.slug,
        group: p.group,
        eyebrow: p.eyebrow,
        headline: `${p.headline} ${p.headlineAccent}`,
        subline: p.subline,
        cta: p.cta,
        url: `/api/poster/${p.slug}`,
        custom: "custom" in p,
        enabled: settings.enabled.includes(p.slug),
        // A feature overrides the link so the click always lands on what is shown.
        href: feature?.href ?? link?.href ?? "/products",
        feature,
      }
    })

    return NextResponse.json({
      success: true,
      posters,
      enabled: settings.enabled,
      links: settings.links,
    })
  } catch (error) {
    return handleApiError(error, "Failed to load posters")
  }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = PosterSettingsWriteSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const settings = await session.withTransaction(async () => {
        const custom = await listCustomPosters(session)
        const known = new Set([...POSTERS, ...custom].map(poster => poster.slug))
        if ([...parsed.data.enabled, ...Object.keys(parsed.data.links)].some(slug => !known.has(slug))) {
          throw new PosterSelectionError("A selected poster no longer exists; reload before publishing")
        }
        return setPosterSettings(parsed.data, session)
      })
      if (!settings) throw new Error("Poster publication transaction did not commit")
      return NextResponse.json({ success: true, ...settings })
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    if (error instanceof PosterSelectionError) return NextResponse.json({ error: error.message }, { status: 400 })
    return handleApiError(error, "Failed to save posters")
  }
}
