import nextEnv from "@next/env"
import { MongoClient } from "mongodb"

nextEnv.loadEnvConfig(process.cwd())
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required")

const presets = [
  { key: "iphone-16", placement: "home-hero", title: "iPhone 16", subtitle: "Built for what's next.", image: "/homepage/hero-iphone.webp", ctaLink: "/products?q=iPhone", bgFrom: "#050C12", bgTo: "#164E96", bullets: ["A18 chip\nSuper fast", "Stunning\ndisplay", "Advanced\ncamera system", "All-day\nbattery life"] },
  { key: "galaxy", placement: "home-hero", title: "Samsung Galaxy", subtitle: "Discover your next smartphone.", image: "/homepage/hero-galaxy.webp", ctaLink: "/products?q=Samsung%20Galaxy", bgFrom: "#EDF5FF", bgTo: "#DCE9FF", dark: true },
  { key: "laptops", placement: "home-hero", title: "Power Your Possibilities", subtitle: "Find a laptop for work, study and play.", image: "/homepage/hero-laptop.webp", ctaLink: "/products?q=laptop", bgFrom: "#FFDDC1", bgTo: "#FFB58E", dark: true },
  { key: "televisions", placement: "home-hero", title: "Bring the Big Screen Home", subtitle: "Explore televisions from trusted brands.", image: "/products/tv.png", ctaLink: "/products?q=television", bgFrom: "#071B3E", bgTo: "#154C87" },
  { key: "refrigerators", placement: "home-hero", title: "Fresh Ideas for Your Home", subtitle: "Discover our range of refrigerators.", image: "/products/fridge.png", ctaLink: "/products?q=refrigerator", bgFrom: "#E9F5F0", bgTo: "#C3E9DC", dark: true },
  { key: "washing", placement: "home-hero", title: "Make Laundry Day Easier", subtitle: "Explore washing machines for your family.", image: "/products/washer.png", ctaLink: "/products?q=washing", bgFrom: "#F2ECFF", bgTo: "#DACBFF", dark: true },
  { key: "cooling", placement: "home-hero", title: "Comfort in Every Room", subtitle: "Find your next air conditioner.", image: "/products/ac.png", ctaLink: "/products?q=air%20conditioner", bgFrom: "#E8F8FF", bgTo: "#BDE5F7", dark: true },
  { key: "sunday", placement: "home-hero", title: "SARA Super Sunday", subtitle: "Bigger Deals. Brighter Days.", image: "/homepage/super-sunday.webp", ctaLink: "/offers", bgFrom: "#FFF8DB", bgTo: "#FFE78B", dark: true },
  { key: "side-galaxy", placement: "home-duo", title: "SAMSUNG\nGalaxy S25 Series", subtitle: "Galaxy AI", image: "/homepage/hero-galaxy.webp", ctaLink: "/products?q=Samsung%20Galaxy", bgFrom: "#EDF5FF", bgTo: "#DCE9FF", dark: true },
  { key: "side-laptop", placement: "home-duo", title: "Best Deals on\nLaptops", subtitle: "Power your possibilities", image: "/homepage/hero-laptop.webp", ctaLink: "/products?q=laptop", bgFrom: "#FFDDC1", bgTo: "#FFB58E", dark: true },
  { key: "card-exchange", placement: "home-card", title: "Exchange & Upgrade", subtitle: "Give your old device a new beginning.", image: "/homepage/exchange-phones.webp", ctaLink: "/contact", ctaText: "Check Exchange Value", bgFrom: "#EAF5FF", bgTo: "#CDE7FF", dark: true },
  { key: "card-emi", placement: "home-card", title: "Easy EMI Options", subtitle: "No Cost EMI | Low Cost EMI\nAll Major Banks", image: "", ctaLink: "/emi", ctaText: "Know More", bgFrom: "#F6EDFF", bgTo: "#F1E8FF", dark: true },
  { key: "card-sunday", placement: "home-card", title: "SARA Super Sunday", subtitle: "Bigger Deals. Brighter Days.\nEvery Sunday.", image: "/homepage/super-sunday.webp", ctaLink: "/offers", bgFrom: "#FFF8DB", bgTo: "#FFE78B", accent: "#F00024", dark: true },
]

const client = new MongoClient(process.env.MONGODB_URI, { family: 4 })
try {
  await client.connect()
  const collection = client.db(process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise").collection("listing_banners")
  let inserted = 0
  for (const [order, preset] of presets.entries()) {
    const { key, ...banner } = preset
    const result = await collection.updateOne(
      { templateKey: `homepage-${key}` },
      { $setOnInsert: {
        ...banner, templateKey: `homepage-${key}`, active: false, scope: "",
        ctaText: banner.ctaText || "Shop Now", dark: banner.dark || false,
        accent: banner.accent || "#E11D2E", bullets: banner.bullets || [],
        order, createdAt: new Date(), updatedAt: new Date(),
      } },
      { upsert: true },
    )
    inserted += result.upsertedCount
  }
  console.log(`Added ${inserted} disabled homepage banners (${presets.length} presets total). Existing banners and visibility were not changed.`)
} finally {
  await client.close()
}
