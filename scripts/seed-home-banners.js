/**
 * Seeds the home page banners shown in the approved design.
 *
 * Safe to re-run: banners are upserted by (placement, title).
 * Usage:
 *   node --env-file=.env scripts/seed-home-banners.js
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

const BANNERS = [
  {
    placement: "home-hero",
    scope: "",
    title: "Technology Brings People Closer",
    subtitle: "Mobiles | Electronics | Home Appliances | More",
    script: "Happier Homes Brighter Lives",
    ctaText: "Shop Now",
    ctaLink: "/products",
    image: "/banners/mixed-lineup.svg",
    bgFrom: "#E9F1FB",
    bgTo: "#F8FBFF",
    accent: "#E11D2E",
    dark: true,
    bullets: ["Latest Technology", "Wide Range of Brands", "Easy EMI Options", "Trusted Since 25 Years"],
    order: 0,
    active: true,
  },
  {
    placement: "home-hero",
    scope: "",
    title: "Big Brands. Bigger Savings.",
    subtitle: "Televisions, refrigerators, washing machines and more",
    script: "Happier Homes Brighter Lives",
    ctaText: "See All Offers",
    ctaLink: "/offers",
    image: "/banners/appliances-lineup.svg",
    bgFrom: "#E8F4EC",
    bgTo: "#F8FDF9",
    accent: "#E11D2E",
    dark: true,
    bullets: ["No-Cost EMI", "Free Delivery", "Free Installation", "Brand Warranty"],
    order: 1,
    active: true,
  },
  {
    placement: "home-strip",
    scope: "",
    title: "SARA Super Sunday",
    subtitle: "The Prime Super Saver!",
    ctaText: "Shop Now",
    ctaLink: "/offers",
    image: "/banners/mixed-lineup.svg",
    bgFrom: "#F7C948",
    bgTo: "#F0A500",
    accent: "#E11D2E",
    dark: true,
    bullets: ["Best Offers", "Top Brands", "Easy EMI", "Exclusive Gifts"],
    order: 0,
    active: true,
  },
  {
    placement: "home-duo",
    scope: "",
    title: "Super Saver Days",
    subtitle: "Upgrade to a Better Tomorrow",
    ctaText: "Know More",
    ctaLink: "/offers",
    image: "/banners/appliances-lineup.svg",
    bgFrom: "#E8452F",
    bgTo: "#B3141F",
    accent: "#E8452F",
    dark: false,
    bullets: ["Best Prices", "Easy EMI", "Wide Range"],
    order: 0,
    active: true,
  },
  {
    placement: "home-duo",
    scope: "",
    title: "No Cost EMI",
    subtitle: "Bring Home Happiness Today",
    ctaText: "Know More",
    ctaLink: "/offers",
    image: "/banners/promo-appliances.svg",
    bgFrom: "#1A63C8",
    bgTo: "#0B3C87",
    accent: "#1A63C8",
    dark: false,
    bullets: ["All Major Banks", "Up to 24 Months", "Cardless Options"],
    order: 1,
    active: true,
  },
  {
    placement: "home-card",
    scope: "",
    title: "Festival Offers",
    subtitle: "Big Brands. Bigger Savings.",
    ctaText: "Explore Offers",
    ctaLink: "/offers",
    image: "/banners/promo-appliances.svg",
    bgFrom: "#1E7A46",
    bgTo: "#0E4B29",
    accent: "#F7C948",
    dark: false,
    bullets: [],
    order: 0,
    active: true,
  },
  {
    placement: "home-statement",
    scope: "",
    title: "Making Everyday A Brighter Tomorrow",
    subtitle: "Technology for a better, happier Karnataka.",
    script: "Proudly Karnataka Always",
    ctaText: "Know More About SARA",
    ctaLink: "/about",
    image: "/banners/sara-store.svg",
    bgFrom: "#0F2557",
    bgTo: "#071634",
    accent: "#E11D2E",
    dark: false,
    bullets: [],
    order: 0,
    active: true,
  },
]

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/seed-home-banners.js")
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
