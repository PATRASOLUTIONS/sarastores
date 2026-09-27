// Load-test measurements against the seeded 10k-product database.
import { MongoClient } from "mongodb"

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, family: 4 })
await client.connect()
const db = client.db("e-commerce-loadtest")

const CARD = {
  slug: 1, name: 1, price: 1, mrp: 1, image: 1, stock: 1, category: 1, subCategory: 1, brand: 1,
  manufacturerName: 1, manufacturer_name: 1, rating: 1, reviews: 1, discount: 1, originalPrice: 1,
  sku: 1, active: 1, featured: 1, trusted: 1, specification_images: 1,
  "raw.MRP": 1, "raw.mrp": 1, "raw.M.R.P": 1,
}

const MB = (b) => (b / 1048576).toFixed(2)
const VERCEL_RESPONSE_LIMIT_MB = 4.5

async function timed(label, fn) {
  const t0 = performance.now()
  const rows = await fn()
  const ms = performance.now() - t0
  const t1 = performance.now()
  const bytes = Buffer.byteLength(JSON.stringify(rows))
  const serializeMs = performance.now() - t1
  const over = bytes / 1048576 > VERCEL_RESPONSE_LIMIT_MB
  console.log(
    `${label.padEnd(46)} ${String(rows.length).padStart(6)} docs  ${MB(bytes).padStart(7)} MB  query ${ms.toFixed(0).padStart(5)}ms  JSON.stringify ${serializeMs.toFixed(0).padStart(4)}ms${over ? "   <-- OVER VERCEL 4.5 MB LIMIT" : ""}`,
  )
  return { bytes, ms }
}

console.log("=== RESPONSE PAYLOADS at 10,000 products ===")
await timed("GET /api/products            (no params)", () => db.collection("products").find({ active: true }).toArray())
await timed("GET /api/products?fields=card", () => db.collection("products").find({ active: true }).project(CARD).toArray())
await timed("GET /api/products?fields=card&limit=60", () => db.collection("products").find({ active: true }).project(CARD).limit(60).toArray())
await timed("GET /api/products?category=X", () => db.collection("products").find({ active: true, category: "TV" }).toArray())

console.log("\n=== HOT QUERIES ===")
const sample = await db.collection("products").findOne({}, { projection: { slug: 1, sku: 1 } })
const buyer = await db.collection("users").findOne({})

const hot = [
  ["PDP  products.findOne({slug})", () => db.collection("products").findOne({ slug: sample.slug })],
  ["PDP  product_specifications.findOne({sku})", () => db.collection("product_specifications").findOne({ sku: sample.sku })],
  ["search  ?search=sam&limit=6 (regex)", () => db.collection("products").find({ active: true, $or: [{ name: { $regex: "sam", $options: "i" } }, { description: { $regex: "sam", $options: "i" } }] }).limit(6).toArray()],
  ["search  ?search=sam NO limit (old behaviour)", () => db.collection("products").find({ active: true }).toArray()],
  ["account  orders by user, recent first", () => db.collection("orders").find({ userId: String(buyer._id) }).sort({ createdAt: -1 }).toArray()],
  ["login  users.findOne({email})", () => db.collection("users").findOne({ email: buyer.email })],
  ["cart  carts.findOne({userId})", () => db.collection("carts").findOne({ userId: String(buyer._id) })],
  ["admin  orders list (limit 50, sorted)", () => db.collection("orders").find({}).sort({ createdAt: -1 }).limit(50).toArray()],
  ["admin  orders revenue aggregate", () => db.collection("orders").aggregate([{ $match: { status: { $in: ["delivered", "completed"] } } }, { $group: { _id: null, total: { $sum: "$total" }, n: { $sum: 1 } } }]).toArray()],
]

for (const [label, fn] of hot) {
  // 5 runs, report median, to smooth out network jitter to Atlas
  const runs = []
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now()
    await fn()
    runs.push(performance.now() - t0)
  }
  runs.sort((a, b) => a - b)
  console.log(`${label.padEnd(46)} median ${runs[2].toFixed(0).padStart(5)} ms   (min ${runs[0].toFixed(0)}, max ${runs[4].toFixed(0)})`)
}

console.log("\n=== INDEX COVERAGE (docsExamined should be near nReturned) ===")
const plans = [
  ["products.find({slug})", db.collection("products").find({ slug: sample.slug })],
  ["products.find({active:true})", db.collection("products").find({ active: true })],
  ["products regex search", db.collection("products").find({ active: true, $or: [{ name: { $regex: "sam", $options: "i" } }, { description: { $regex: "sam", $options: "i" } }] }).limit(6)],
  ["orders.find({userId}).sort(createdAt)", db.collection("orders").find({ userId: String(buyer._id) }).sort({ createdAt: -1 })],
  ["orders.find({}).sort(createdAt).limit(50)", db.collection("orders").find({}).sort({ createdAt: -1 }).limit(50)],
]
for (const [label, cursor] of plans) {
  const ex = await cursor.explain("executionStats")
  const s = ex.executionStats
  const stage = JSON.stringify(ex.queryPlanner.winningPlan).includes("COLLSCAN") ? "COLLSCAN" : "IXSCAN"
  console.log(`${label.padEnd(46)} ${stage.padEnd(9)} examined ${String(s.totalDocsExamined).padStart(6)}  returned ${String(s.nReturned).padStart(6)}  ${s.executionTimeMillis}ms`)
}

console.log("\n=== STORAGE ===")
for (const c of ["products", "product_specifications", "orders", "users", "carts"]) {
  const [st] = await db.collection(c).aggregate([{ $collStats: { storageStats: {} } }]).toArray()
  const s = st.storageStats
  console.log(`  ${c.padEnd(24)} ${String(s.count).padStart(6)} docs  data ${MB(s.size).padStart(7)} MB  indexes ${MB(Object.values(s.indexSizes).reduce((a, b) => a + b, 0)).padStart(6)} MB`)
}

await client.close()
