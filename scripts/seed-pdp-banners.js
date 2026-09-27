/**
 * Seeds the product-page offer strip and side-rail cards.
 *
 * Safe to re-run: upserted by (placement, title).
 * Usage:
 *   node --env-file=.env scripts/seed-pdp-banners.js
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

const BANNERS = [
  {
    placement: "pdp-offer",
    scope: "",
    script: "HDFC Bank",
    title: "Up to ₹6,000 Instant Discount",
    subtitle: "on HDFC Bank Credit Cards",
    ctaText: "View Details",
    ctaLink: "/offers",
    image: "",
    bgFrom: "#FFFFFF",
    bgTo: "#FFFFFF",
    accent: "#004C8F",
    dark: true,
    bullets: [],
    order: 0,
    active: true,
  },
  {
    placement: "pdp-offer",
    scope: "",
    script: "SBI Card",
    title: "Up to ₹5,000 Instant Discount",
    subtitle: "on SBI Credit Cards",
    ctaText: "View Details",
    ctaLink: "/offers",
    image: "",
    bgFrom: "#FFFFFF",
    bgTo: "#FFFFFF",
    accent: "#22409A",
    dark: true,
    bullets: [],
    order: 1,
    active: true,
  },
  {
    placement: "pdp-offer",
    scope: "",
    script: "No Cost EMI",
    title: "Up to 24 months",
    subtitle: "on all major banks",
    ctaText: "View Plans",
    ctaLink: "/emi",
    image: "",
    bgFrom: "#FFFFFF",
    bgTo: "#FFFFFF",
    accent: "#E11D2E",
    dark: true,
    bullets: [],
    order: 2,
    active: true,
  },
  {
    placement: "pdp-offer",
    scope: "",
    script: "Free Install",
    title: "Free Installation & Demo",
    subtitle: "by our certified engineers",
    ctaText: "How it works",
    ctaLink: "/installation",
    image: "",
    bgFrom: "#FFFFFF",
    bgTo: "#FFFFFF",
    accent: "#0F8A3C",
    dark: true,
    bullets: [],
    order: 3,
    active: true,
  },
  {
    placement: "pdp-offer",
    scope: "",
    script: "Store Pickup",
    title: "Collect from a SARA store",
    subtitle: "stores across Karnataka",
    ctaText: "Find a store",
    ctaLink: "/store-locator",
    image: "",
    bgFrom: "#FFFFFF",
    bgTo: "#FFFFFF",
    accent: "#1560BD",
    dark: true,
    bullets: [],
    order: 4,
    active: true,
  },
  {
    placement: "pdp-rail",
    scope: "",
    script: "Authorised Dealer",
    title: "Experience the brand at SARA",
    subtitle: "Genuine products. Expert advice. Official warranty.",
    ctaText: "Find a Store Near You",
    ctaLink: "/store-locator",
    image: "",
    bgFrom: "#5B4B9E",
    bgTo: "#372C6B",
    accent: "#FFFFFF",
    dark: false,
    bullets: [],
    order: 0,
    active: true,
  },
  {
    placement: "pdp-rail",
    scope: "",
    script: "Service",
    title: "Installation & after-sales",
    subtitle: "Our own engineers install it, demonstrate it and support it afterwards.",
    ctaText: "Learn More",
    ctaLink: "/installation",
    image: "",
    bgFrom: "#EEF2F7",
    bgTo: "#E2E8F0",
    accent: "#0F2557",
    dark: true,
    bullets: [],
    order: 1,
    active: true,
  },
]

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/seed-pdp-banners.js")
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
    console.log(`${result.upsertedCount ? "created" : "updated"}: ${banner.placement} - ${banner.title}`)
  }

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
