/**
 * Seed a synthetic load-test dataset into a SEPARATE database.
 *
 * Clones the real catalogue's document shapes so payload sizes and index
 * behaviour match production, then multiplies them up to the target counts.
 * Refuses to run against any database whose name does not contain "loadtest".
 *
 * Usage:
 *   node --env-file=.env scripts/loadtest-seed.mjs            # dry run
 *   node --env-file=.env scripts/loadtest-seed.mjs --apply
 *   node --env-file=.env scripts/loadtest-seed.mjs --drop     # remove it again
 */
import { MongoClient, ObjectId } from "mongodb"

const SOURCE_DB = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"
const TARGET_DB = "e-commerce-loadtest"
const TARGET_PRODUCTS = 10_000
const TARGET_BUYERS = 5_000
const ORDERS_PER_BUYER = 3

const apply = process.argv.includes("--apply")
const drop = process.argv.includes("--drop")

if (!TARGET_DB.includes("loadtest")) throw new Error("refusing to write to a non-loadtest database")
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set")

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, family: 4 })
await client.connect()
const src = client.db(SOURCE_DB)
const dst = client.db(TARGET_DB)

if (drop) {
  // The Atlas user has no dropDatabase privilege, so remove collection by collection.
  const names = (await dst.listCollections().toArray()).map((c) => c.name)
  for (const name of names) {
    try {
      await dst.collection(name).drop()
      console.log(`  dropped ${name}`)
    } catch (e) {
      const n = await dst.collection(name).deleteMany({})
      console.log(`  emptied ${name} (${n.deletedCount} docs) — drop denied: ${e.codeName ?? e.message}`)
    }
  }
  console.log(`\n${TARGET_DB}: ${(await dst.listCollections().toArray()).length} collections remaining`)
  await client.close()
  process.exit(0)
}

console.log(`source ${SOURCE_DB} -> target ${TARGET_DB}   ${apply ? "APPLY" : "DRY RUN"}\n`)

// Content collections are small; copy them verbatim so pages render normally.
const VERBATIM = [
  "categories", "sub_categories", "brands", "settings", "footer", "home_components",
  "hero_slides", "split_cards", "animated_banners", "advertisements",
  "product_advertisements", "offers", "featured_products", "testimonials",
  "product_slides", "store_locations", "coupons", "site_features",
]

const rand = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rand(arr.length)]

async function run() {
  for (const name of VERBATIM) {
    const docs = await src.collection(name).find({}).toArray()
    console.log(`  ${name.padEnd(24)} copy ${docs.length}`)
    if (apply && docs.length) {
      await dst.collection(name).deleteMany({})
      await dst.collection(name).insertMany(docs)
    }
  }

  const baseProducts = await src.collection("products").find({ active: true }).toArray()
  const baseSpecs = await src.collection("product_specifications").find({}).limit(200).toArray()
  console.log(`\n  templates: ${baseProducts.length} products, ${baseSpecs.length} spec docs`)

  // Products + specifications
  console.log(`  products                 generate ${TARGET_PRODUCTS}`)
  if (apply) {
    await dst.collection("products").deleteMany({})
    await dst.collection("product_specifications").deleteMany({})
    const BATCH = 500
    for (let i = 0; i < TARGET_PRODUCTS; i += BATCH) {
      const products = []
      const specs = []
      for (let j = i; j < Math.min(i + BATCH, TARGET_PRODUCTS); j++) {
        const t = baseProducts[j % baseProducts.length]
        const sku = `LT${String(j).padStart(6, "0")}`
        const doc = structuredClone(t)
        delete doc._id
        doc.sku = sku
        doc.name = `${t.name} ${sku}`
        doc.slug = `${(t.slug || "product")}-${sku.toLowerCase()}`
        doc.price = Math.max(499, Math.round((t.price || 10000) * (0.7 + Math.random() * 0.6)))
        doc.stock = rand(50)
        doc.active = true
        doc.featured = j % 40 === 0
        products.push(doc)

        const st = structuredClone(baseSpecs[j % baseSpecs.length])
        delete st._id
        st.sku = sku
        specs.push(st)
      }
      await dst.collection("products").insertMany(products, { ordered: false })
      await dst.collection("product_specifications").insertMany(specs, { ordered: false })
      if ((i / BATCH) % 4 === 0) process.stdout.write(`    ${i + BATCH}/${TARGET_PRODUCTS}\r`)
    }
    console.log(`    ${TARGET_PRODUCTS}/${TARGET_PRODUCTS} done        `)
  }

  // Buyers + their orders and carts
  console.log(`  users                    generate ${TARGET_BUYERS}`)
  console.log(`  orders                   generate ${TARGET_BUYERS * ORDERS_PER_BUYER}`)
  if (apply) {
    for (const c of ["users", "orders", "carts", "wishlists", "customer_profiles"]) {
      await dst.collection(c).deleteMany({})
    }
    const catalogue = await dst.collection("products")
      .find({}, { projection: { sku: 1, name: 1, price: 1, image: 1 } }).limit(2000).toArray()
    const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]

    const BATCH = 500
    let orderSeq = 0
    for (let i = 0; i < TARGET_BUYERS; i += BATCH) {
      const users = []
      const orders = []
      const carts = []
      for (let j = i; j < Math.min(i + BATCH, TARGET_BUYERS); j++) {
        const userId = new ObjectId()
        users.push({
          _id: userId,
          email: `loadtest${j}@example.invalid`,
          // Not a usable credential: a fixed non-bcrypt string, so nobody can log in as these.
          password: "LOADTEST-NO-LOGIN",
          name: `Load Test Buyer ${j}`,
          role: "user",
          phone: `90000${String(j).padStart(5, "0")}`,
          createdAt: new Date(Date.now() - rand(365) * 86400000),
        })

        const items = Array.from({ length: 1 + rand(3) }, () => {
          const p = pick(catalogue)
          return { productId: String(p._id), sku: p.sku, name: p.name, price: p.price, quantity: 1 + rand(2) }
        })
        const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
        carts.push({ userId: String(userId), items, updatedAt: new Date() })

        for (let k = 0; k < ORDERS_PER_BUYER; k++) {
          orders.push({
            orderId: `LOADTEST-${String(orderSeq++).padStart(7, "0")}`,
            userId: String(userId),
            items,
            subtotal,
            total: Math.round(subtotal * 1.18),
            status: pick(statuses),
            createdAt: new Date(Date.now() - rand(365) * 86400000),
          })
        }
      }
      await dst.collection("users").insertMany(users, { ordered: false })
      await dst.collection("orders").insertMany(orders, { ordered: false })
      await dst.collection("carts").insertMany(carts, { ordered: false })
      process.stdout.write(`    ${Math.min(i + BATCH, TARGET_BUYERS)}/${TARGET_BUYERS} buyers\r`)
    }
    console.log(`    ${TARGET_BUYERS}/${TARGET_BUYERS} buyers done        `)
  }

  // Same indexes production has, so query plans are comparable.
  const INDEXES = [
    ["users", { email: 1 }, { unique: true, name: "email_unique" }],
    ["orders", { userId: 1, createdAt: -1 }, { name: "user_recent" }],
    ["orders", { orderId: 1 }, { unique: true, name: "orderId_unique" }],
    ["carts", { userId: 1 }, { name: "userId" }],
    ["coupons", { code: 1 }, { unique: true, name: "code_unique" }],
    ["products", { slug: 1 }, { name: "slug_1" }],
    ["products", { sku: 1 }, { name: "sku" }],
    ["products", { active: 1, category: 1 }, { name: "active_category" }],
    ["products", { name: "text", description: "text", brand: "text" }, { name: "product_search" }],
    ["product_specifications", { sku: 1 }, { name: "sku" }],
  ]
  console.log(`\n  indexes                  ensure ${INDEXES.length}`)
  if (apply) {
    for (const [c, spec, opts] of INDEXES) {
      try { await dst.collection(c).createIndex(spec, opts) } catch (e) { console.log(`    FAIL ${c}.${opts.name}: ${e.message}`) }
    }
  }

  if (apply) {
    console.log("\n=== RESULT ===")
    for (const c of ["products", "product_specifications", "users", "orders", "carts", "categories", "brands"]) {
      console.log(`  ${c.padEnd(24)} ${await dst.collection(c).countDocuments()}`)
    }
  } else {
    console.log("\nDry run only. Re-run with --apply to write.")
  }
}

await run()
await client.close()
