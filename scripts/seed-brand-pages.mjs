import { MongoClient } from "mongodb"
import { readdirSync } from "node:fs"
import { basename, extname, join } from "node:path"

const APPLY = process.argv.includes("--apply")
const DB = "e-commerce-bytewise"

const slugify = (name) =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const titleCase = (value) =>
  String(value)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")

/** Drop-in artwork in public/brands wins over whatever is stored on the record. */
function logoManifest() {
  const dir = join(process.cwd(), "public", "brands")
  const out = {}
  for (const file of readdirSync(dir)) {
    const ext = extname(file).toLowerCase()
    if (![".svg", ".png", ".webp", ".jpg", ".jpeg"].includes(ext)) continue
    const slug = basename(file, ext).toLowerCase()
    if (out[slug] && ext !== ".svg") continue
    out[slug] = `/brands/${file}`
  }
  return out
}

const FEATURES = [
  { icon: "Shield", text: "100% Genuine Products", color: "text-blue-300" },
  { icon: "Award", text: "Manufacturer Warranty", color: "text-blue-300" },
  { icon: "Zap", text: "Fast Delivery in Karnataka", color: "text-blue-300" },
]

const reasonsFor = (name) => [
  {
    icon: "CheckCircle",
    title: "Authorised stock",
    description: `Every ${name} product we sell is sourced through authorised channels.`,
  },
  {
    icon: "Wrench",
    title: "Installation & service",
    description: "Expert installation and after-sales support across our store network.",
  },
  {
    icon: "Sparkles",
    title: "Best price promise",
    description: `Member pricing and bank offers on the full ${name} range.`,
  },
]

async function main() {
  const client = await MongoClient.connect(process.env.MONGODB_URI)
  const db = client.db(DB)

  const products = await db
    .collection("products")
    .find({ active: { $ne: false } })
    .project({ manufacturerName: 1, subCategory: 1, image: 1, images: 1 })
    .toArray()

  // Group by slug, not raw name: the catalogue holds both "GODREJ" and "Godrej".
  const byBrand = new Map()
  for (const p of products) {
    const raw = String(p.manufacturerName ?? "").trim()
    if (!raw) continue
    const slug = slugify(raw)
    if (!slug) continue
    if (!byBrand.has(slug)) byBrand.set(slug, { count: 0, subs: new Map(), spellings: new Map() })
    const entry = byBrand.get(slug)
    entry.count += 1
    entry.spellings.set(raw, (entry.spellings.get(raw) ?? 0) + 1)

    const rawSub = String(p.subCategory ?? "").trim()
    if (!rawSub || /^test\d*$/i.test(rawSub)) continue
    const sub = /^tv\b/i.test(rawSub) ? "TV" : rawSub
    if (!entry.subs.has(sub)) entry.subs.set(sub, { count: 0, image: "" })
    const s = entry.subs.get(sub)
    s.count += 1
    if (!s.image) s.image = p.image || (Array.isArray(p.images) ? p.images[0] : "") || ""
  }

  const logos = logoManifest()
  const existing = await db.collection("brands").find({}).toArray()
  const bySlug = new Map(existing.map((b) => [b.slug, b]))

  const created = []
  const updated = []
  const skipped = []

  for (const [slug, data] of [...byBrand.entries()].sort((a, b) => b[1].count - a[1].count)) {
    // Use the spelling that appears most often in the catalogue.
    const name = [...data.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const display = titleCase(name)

    const categories = [...data.subs.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([title, s]) => ({
        url: s.image,
        title: titleCase(title),
        description: `${s.count} product${s.count === 1 ? "" : "s"}`,
        link: `/products?brand=${encodeURIComponent(name)}&subCategory=${encodeURIComponent(title)}`,
      }))

    const current = bySlug.get(slug)

    if (!current) {
      const doc = {
        name,
        slug,
        enabled: true,
        landingPageEnabled: true,
        logo: logos[slug] || "",
        tagline: `Genuine ${display} products at SARA`,
        description: `Explore the complete ${display} range at SARA Electronics — authorised stock, manufacturer warranty and fast delivery across Karnataka.`,
        accentColor: "blue",
        accentColorFrom: "from-[#1560BD]",
        accentColorTo: "to-[#0F2557]",
        heroBgFrom: "from-black/60",
        heroBgTo: "to-transparent",
        trustBadgeBg: "from-[#0F2557] via-[#12336E] to-[#1560BD]",
        banners: [],
        categories,
        features: FEATURES,
        whyChoose: {
          title: `Why Choose ${display}`,
          heading: `Why buy ${display} at SARA?`,
          subtitle: "Authorised stock, real warranty, local service.",
          reasons: reasonsFor(display),
        },
        productsSection: {
          badge: "Featured Products",
          badgeColor: "bg-blue-50 text-blue-600",
          heading: `Shop ${display} Products`,
          subtitle: `${data.count} product${data.count === 1 ? "" : "s"} available`,
          manufacturerFilter: name.toLowerCase(),
          maxProducts: 12,
          ctaText: `View All ${display} Products`,
          ctaLink: `/products?brand=${encodeURIComponent(name)}`,
        },
        categorySection: {
          badge: "Explore Categories",
          badgeColor: "bg-blue-50 text-blue-600",
          heading: `${display} Categories`,
          subtitle: `Browse the ${display} range by category.`,
        },
        trustBadges: [],
        heroContent: {
          title: name.toUpperCase(),
          subtitle: `Genuine ${display} products at SARA`,
          description: `Authorised ${display} stock with manufacturer warranty, expert installation and fast delivery across Karnataka.`,
          ctaText: `Shop ${display} Products`,
          ctaLink: `/products?brand=${encodeURIComponent(name)}`,
          ctaColor: "from-[#1560BD] to-[#0F2557]",
          secondaryCta: "",
        },
        leadFormEnabled: false,
        leadFormSource: `${display} Brand Page`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      created.push({ name, slug, categories: categories.length, products: data.count })
      if (APPLY) await db.collection("brands").insertOne(doc)
      continue
    }

    // Only fill gaps on curated records — never overwrite existing content.
    const patch = {}
    if (!current.logo && logos[slug]) patch.logo = logos[slug]
    if (!Array.isArray(current.categories) || current.categories.length === 0) {
      if (categories.length > 0) patch.categories = categories
    }
    if (!Array.isArray(current.features) || current.features.length === 0) patch.features = FEATURES
    if (current.landingPageEnabled !== true) patch.landingPageEnabled = true
    if (current.enabled === undefined) patch.enabled = true

    if (Object.keys(patch).length === 0) {
      skipped.push({ name, slug })
      continue
    }

    patch.updatedAt = new Date()
    updated.push({ name, slug, fields: Object.keys(patch).filter((k) => k !== "updatedAt") })
    if (APPLY) await db.collection("brands").updateOne({ _id: current._id }, { $set: patch })
  }

  console.log((APPLY ? "APPLIED" : "DRY RUN") + " — brand pages")
  console.log("\ncreate (" + created.length + "):")
  for (const c of created) console.log("  " + c.slug.padEnd(14) + " cats=" + c.categories + " products=" + c.products)
  console.log("\nupdate (" + updated.length + "):")
  for (const u of updated) console.log("  " + u.slug.padEnd(14) + " " + u.fields.join(", "))
  console.log("\nalready complete (" + skipped.length + "): " + skipped.map((s) => s.slug).join(", "))

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
