// Usage: node scripts/fetch-amazon-to-db.mjs <SKU> <AMAZON_URL>
// Optionally set NEXT_PUBLIC_APP_URL to target a non-local URL.

const [, , sku, url] = process.argv

if (!sku || !url) {
  if (process.env.NODE_ENV === "development") console.log("Usage: node scripts/fetch-amazon-to-db.mjs <SKU> <AMAZON_URL>")
  process.exit(1)
}

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"

async function main() {
  try {
    const res = await fetch(`${base}/api/scrape-amazon`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku, url }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error("ByteWise Testing Point Scrape failed:", data)
      process.exit(2)
    }
    if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Scrape OK:", data)
  } catch (e) {
    console.error("ByteWise Testing Point Error:", e?.message || e)
    process.exit(3)
  }
}

main()
