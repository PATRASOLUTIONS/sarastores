/**
 * Seeds the default product-listing banners shown in the approved design.
 *
 * Safe to re-run: banners are upserted by (placement, title).
 * Usage:
 *   node --env-file=.env scripts/seed-listing-banners.js
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

const BANNERS = [
  {
    placement: "hero",
    scope: "",
    title: "Electronics For A Better Everyday",
    subtitle: "Top Brands | Great Offers | Expert Advice",
    script: "Upgrade Your Home Upgrade Your Life",
    ctaText: "Shop Now",
    ctaLink: "/products",
    image: "/banners/appliances-lineup.svg",
    bgFrom: "#1F72D0",
    bgTo: "#0A3A7A",
    accent: "#E11D2E",
    dark: false,
    order: 0,
    active: true,
  },
  {
    placement: "promo",
    scope: "",
    title: "LG",
    subtitle: "Life's Good With Smarter Choices",
    script: "",
    ctaText: "Explore LG Range",
    ctaLink: "/products?brand=LG",
    image: "/banners/promo-appliances.svg",
    bgFrom: "#FBE4EA",
    bgTo: "#F3D3DC",
    accent: "#A50034",
    dark: true,
    order: 0,
    active: true,
  },
  {
    placement: "promo",
    scope: "",
    title: "Samsung",
    subtitle: "AI for a Smarter Home",
    script: "",
    ctaText: "Shop Samsung",
    ctaLink: "/products?brand=Samsung",
    image: "/banners/promo-appliances.svg",
    bgFrom: "#1A63C8",
    bgTo: "#0B3C87",
    accent: "#0B3C87",
    dark: false,
    order: 1,
    active: true,
  },
]

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/seed-listing-banners.js")
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const collection = client.db(DB_NAME).collection("listing_banners")

  for (const banner of BANNERS) {
    const now = new Date()
    const result = await collection.updateOne(
      { placement: banner.placement, title: banner.title },
      { $set: { ...banner, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    )
    console.log(`${result.upsertedCount ? "created" : "updated"}: ${banner.placement} — ${banner.title}`)
  }

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
