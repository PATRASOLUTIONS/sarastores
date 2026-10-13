import assert from "node:assert/strict"
import crypto from "node:crypto"
import { createRequire } from "node:module"
import { MongoClient, ObjectId } from "mongodb"
import { sourceLoader } from "../tests/source-loader.mjs"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd())
const action = process.argv[2]
const database = process.argv[3]
if (!["seed", "verify", "verify-posters", "verify-partner-assignments", "verify-store-qr", "verify-campaign-admin", "verify-license-repair", "verify-admin-finance", "verify-admin-updates", "verify-spin-admin", "verify-external-queue", "verify-coupons", "verify-rate-limits", "verify-wallet", "verify-partner-checkout", "verify-scraper", "verify-lucky-draw", "verify-hero-slides", "verify-order-ids", "verify-unsubscribe", "cleanup"].includes(action) || !database?.startsWith("ecom_sara_audit_") || Buffer.byteLength(database) > 38) {
  throw new Error("Usage: node scripts/audit-isolated-db.mjs seed|verify|verify-posters|verify-partner-assignments|verify-store-qr|verify-campaign-admin|verify-license-repair|verify-admin-finance|verify-admin-updates|verify-spin-admin|verify-external-queue|verify-coupons|verify-rate-limits|verify-wallet|verify-partner-checkout|verify-scraper|verify-lucky-draw|verify-hero-slides|verify-order-ids|verify-unsubscribe|cleanup ecom_sara_audit_<identifier>. Live databases are prohibited.")
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required; its value is never printed")
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 3 })
const marker = "production-audit-isolated-fixtures-v1"
const collections = ["products", "categories", "brands", "store_locations", "settings", "orders", "checkout_intents", "license_keys", "software_licenses", "external_orders"]
await client.connect()
const db = client.db(database)
try {
  if (action === "cleanup") {
    for (const name of collections) {
      const result = await db.collection(name).deleteMany({ _auditFixture: marker })
      console.log(name, "own fixture records removed:", result.deletedCount)
    }
  } else if (action === "seed") {
    const categoryId = new ObjectId()
    const brandId = new ObjectId()
    const records = {
      products: {
        name: "Audit Fixture Television", slug: "audit-fixture-television", price: 4999, mrp: 5999,
        stock: 10, active: true, type: "hardware", brand: "Audit Fixture", category: "Electronics",
        categoryId: categoryId.toString(), image: "/sara-logo.png", images: ["/sara-logo.png"],
        description: "Synthetic catalogue item used only in the isolated local audit database.",
      },
      categories: { _id: categoryId, name: "Electronics", slug: "audit-electronics", active: true, image: "/sara-logo.png" },
      brands: { _id: brandId, name: "Audit Fixture", slug: "audit-fixture", active: true, logo: "/sara-logo.png" },
      store_locations: {
        shopName: "Audit Fixture Store", city: "Bangalore", locationDescription: "Synthetic test location",
        isActive: true, latitude: 12.9716, longitude: 77.5946, pincode: "560001", mobileNo: "0000000000",
      },
      settings: { companyName: "SARA Audit Fixture", storeName: "SARA Audit Fixture", shippingFee: 99, freeShippingThreshold: 1000 },
    }
    for (const [name, record] of Object.entries(records)) {
      await db.collection(name).updateOne({ _auditFixture: marker }, { $setOnInsert: { ...record, _auditFixture: marker } }, { upsert: true })
    }
    console.log("PASS: five synthetic storefront fixture documents seeded in", database)
  } else if (action === "verify-posters") {
    const run = crypto.randomUUID().slice(0, 8)
    const custom = db.collection("custom_posters")
    const settings = db.collection("poster_settings")
    const products = db.collection("products")
    const productId = new ObjectId()
    const legacyProductId = `audit-poster-${run}`
    const created = new Set()
    const indexes = []
    let failUpdate = false
    let failRead = false
    assert.equal(await custom.countDocuments({}), 0, "Poster checks require an empty isolated custom collection")
    assert.equal(await settings.countDocuments({}), 0, "Poster checks require an empty isolated settings collection")
    const loader = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/api-error": { handleApiError: () => Response.json({ error: "Fixture failure" }, { status: 500 }) },
      "@/lib/db-service": {
        COLLECTIONS: { PRODUCTS: "products", CATEGORIES: "categories", SUB_CATEGORIES: "sub_categories" },
        normalizeId: doc => { const { _id, id: _ignored, ...fields } = doc; return { ...fields, id: _id.toString() } },
        getCollection: async name => {
          assert.ok(["custom_posters", "poster_settings", "products", "categories", "sub_categories"].includes(name))
          const collection = db.collection(name)
          return new Proxy(collection, { get(target, key) {
            if (name === "custom_posters" && key === "insertOne") return async (doc, ...args) => {
              created.add(doc.slug)
              return target.insertOne(doc, ...args)
            }
            if (name === "poster_settings" && key === "updateOne") return async (...args) => {
              const result = await target.updateOne(...args)
              if (failUpdate) throw new Error("Injected settings failure after transactional write")
              return result
            }
            if (name === "poster_settings" && key === "findOne") return async (...args) => {
              if (failRead) throw new Error("Injected poster configuration read failure")
              return target.findOne(...args)
            }
            const value = Reflect.get(target, key)
            return typeof value === "function" ? value.bind(target) : value
          } })
        },
      },
    })
    const helper = loader.load("lib/custom-posters.ts")
    const route = loader.load("app/api/posters/route.ts")
    const customRoute = loader.load("app/api/posters/custom/route.ts")
    const publish = body => route.PUT(new Request("https://fixture.invalid/posters", { method: "PUT", body: JSON.stringify(body) }))
    const remove = slug => customRoute.DELETE(new Request(`https://fixture.invalid/posters/custom?slug=${slug}`, { method: "DELETE" }))
    let count = 0
    const check = (label, condition) => { assert.ok(condition, label); console.log(`PASS: ${label}`); count++ }
    try {
      for (const [collection, spec] of [[custom, { slug: 1 }], [settings, { key: 1 }]]) {
        const name = `audit_poster_unique_${run}_${indexes.length}`
        await collection.createIndex(spec, { unique: true, name })
        indexes.push([collection, name])
      }
      const input = { headline: `Audit ${run}`, headlineAccent: "Fixture" }
      const posters = await Promise.all([helper.saveCustomPoster(input), helper.saveCustomPoster(input)])
      check("concurrent custom poster creation allocates unique slugs without overwriting artwork", posters[0].slug !== posters[1].slug && await custom.countDocuments({ slug: { $in: posters.map(p => p.slug) } }) === 2)
      await products.insertMany([
        { _id: productId, name: "Native fixture", slug: `audit-native-${run}`, active: true, price: 100 },
        { _id: legacyProductId, name: "Legacy fixture", active: true, price: 200 },
      ])
      const body = { enabled: posters.map(p => p.slug), links: {
        [posters[0].slug]: { href: "/products", feature: { type: "product", id: productId.toString() } },
        [posters[1].slug]: { href: "/products", feature: { type: "product", id: legacyProductId } },
      } }
      check("poster publication commits validated enabled slugs and links together", (await publish(body)).status === 200 && (await settings.findOne({ key: "hero" })).enabled.length === 2)
      const catalog = await (await route.GET()).json()
      const selected = catalog.posters.filter(poster => body.enabled.includes(poster.slug))
      check("public poster features resolve native and string catalogue IDs", selected.length === 2 && selected.every(poster => poster.feature && [productId.toString(), legacyProductId].includes(poster.feature.id)))
      failUpdate = true
      const failed = await remove(posters[0].slug)
      check("custom poster deletion rolls back artwork and publication on settings failure", failed.status === 500 && await custom.countDocuments({ slug: posters[0].slug }) === 1 && (await settings.findOne({ key: "hero" })).enabled.length === 2)
      failUpdate = false
      const deleted = await remove(posters[0].slug)
      const after = await settings.findOne({ key: "hero" })
      check("custom poster deletion commits exact artwork and link removal", deleted.status === 200 && await custom.countDocuments({ slug: posters[0].slug }) === 0 && after.enabled.length === 1 && !Object.hasOwn(after.links, posters[0].slug))
      check("publication rejects deleted posters without changing stored configuration", (await publish(body)).status === 400 && (await settings.findOne({ key: "hero" })).enabled.length === 1)
      const unsafe = { enabled: [], links: { [posters[1].slug]: { href: "/\\outside.invalid" } } }
      check("unsafe poster links reject before clearing the published configuration", (await publish(unsafe)).status === 400 && (await settings.findOne({ key: "hero" })).enabled.length === 1)
      failRead = true
      check("poster database outages return an error instead of an empty successful catalogue", (await route.GET()).status === 500 && (await settings.findOne({ key: "hero" })).enabled.length === 1)
    } finally {
      await custom.deleteMany({ slug: { $in: [...created] } })
      await settings.deleteOne({ key: "hero" })
      await products.deleteMany({ _id: { $in: [productId, legacyProductId] } })
      for (const [collection, name] of indexes) await collection.dropIndex(name)
      console.log("Own isolated poster fixtures and indexes cleaned")
    }
    console.log(`PASS: ${count} real isolated poster checks`)
  } else if (action === "verify-partner-assignments") {
    const partnerId = new ObjectId()
    const productIds = [new ObjectId(), new ObjectId()]
    const legacyId = `audit-legacy-${crypto.randomUUID()}`
    const assignments = db.collection("partner_products")
    const partners = db.collection("partners")
    const catalog = db.collection("products")
    const indexName = `audit_assignment_unique_${crypto.randomUUID()}`
    let indexCreated = false
    let fail = false
    const loader = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
      "@/lib/partner/service": { getPartnerById: async id => {
        const partner = await partners.findOne({ _id: new ObjectId(id) })
        return partner ? { ...partner, id: partner._id.toString() } : null
      } },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": { getCollection: async name => {
        assert.ok(["partner_products", "partners", "products"].includes(name))
        const collection = db.collection(name)
        if (name !== "partner_products") return collection
        return new Proxy(collection, { get(target, key) {
          if (key === "bulkWrite") return async (...args) => {
            const result = await target.bulkWrite(...args)
            if (fail) throw new Error("Injected assignment failure after bulk write")
            return result
          }
          const value = Reflect.get(target, key)
          return typeof value === "function" ? value.bind(target) : value
        } })
      } },
    })
    const route = loader.load("app/api/admin/partners/[partnerId]/products/route.ts")
    const context = { params: Promise.resolve({ partnerId: partnerId.toString() }) }
    const update = products => route.POST(new Request("https://fixture.invalid/assignments", { method: "POST", body: JSON.stringify({ products }) }), context)
    let count = 0
    const check = (label, condition) => { assert.ok(condition, label); console.log(`PASS: ${label}`); count++ }
    try {
      await assignments.createIndex({ partnerId: 1, productId: 1 }, { unique: true, name: indexName })
      indexCreated = true
      await partners.insertOne({ _id: partnerId, name: "Synthetic partner", _auditFixture: marker })
      await catalog.insertMany([...productIds, legacyId].map(_id => ({ _id, name: "Synthetic product", active: true, price: 100, stock: 5, _auditFixture: marker })))
      await assignments.insertOne({ partnerId, productId: productIds[0], enabled: true, customPrice: 77, customCommission: 0 })
      const filter = { partnerId: { $in: [partnerId, partnerId.toString()] } }
      fail = true
      const rollback = await update([{ productId: productIds[0].toString(), enabled: false }, { productId: legacyId, enabled: true }])
      check("assignment bulk failure rolls back legacy update, new assignment and partner revision", rollback.status === 500 && await assignments.countDocuments(filter) === 1 && (await assignments.findOne(filter)).enabled === true && !(await partners.findOne({ _id: partnerId })).productAssignmentsRevision)
      fail = false
      const preserved = await update([{ productId: productIds[0].toString(), enabled: false }])
      const saved = await assignments.findOne(filter)
      check("legacy native assignment IDs canonicalize without erasing omitted custom money", preserved.status === 200 && saved.partnerId === partnerId.toString() && saved.productId === productIds[0].toString() && saved.customPrice === 77 && saved.customCommission === 0)
      const cleared = await update([{ productId: productIds[0].toString(), enabled: true, customPrice: 0, customCommission: null }])
      const override = await assignments.findOne(filter)
      check("explicit zero prices persist and null explicitly clears an override", cleared.status === 200 && override.customPrice === 0 && !Object.hasOwn(override, "customCommission"))
      const before = (await partners.findOne({ _id: partnerId })).productAssignmentsRevision
      const missing = await update([{ productId: new ObjectId().toString(), enabled: true }])
      check("missing enabled products reject before assignment or revision changes", missing.status === 400 && await assignments.countDocuments(filter) === 1 && (await partners.findOne({ _id: partnerId })).productAssignmentsRevision === before)
      const race = await Promise.all([
        update([{ productId: productIds[1].toString(), enabled: true }]),
        update([{ productId: legacyId, enabled: true }]),
      ])
      check("concurrent product assignment batches serialize and retain both writes", race.every(response => response.status === 200) && await assignments.countDocuments({ ...filter, enabled: true }) === 3)
      const report = await (await route.GET(new Request("https://fixture.invalid/assignments"), context)).json()
      check("assignment read normalizes native and legacy product details without Mongo IDs", report.data.enabledCount === 3 && report.data.enabledProductDetails.every(product => typeof product.id === "string" && !("_id" in product)))
      await catalog.updateOne({ _id: productIds[1] }, { $set: { active: false } })
      check("inactive products cannot be newly enabled", (await update([{ productId: productIds[1].toString(), enabled: true }])).status === 400)
      check("inactive or missing products can still be explicitly disabled", (await update([{ productId: productIds[1].toString(), enabled: false }])).status === 200)
    } finally {
      await assignments.deleteMany({ partnerId: { $in: [partnerId, partnerId.toString()] } })
      await partners.deleteOne({ _id: partnerId })
      await catalog.deleteMany({ _id: { $in: [...productIds, legacyId] } })
      if (indexCreated) await assignments.dropIndex(indexName)
      console.log("Own isolated partner assignment fixtures and index cleaned")
    }
    console.log(`PASS: ${count} real isolated partner assignment checks`)
  } else if (action === "verify-store-qr") {
    const run = crypto.randomUUID()
    const stores = db.collection("store_locations")
    const qrs = db.collection("store_qr_codes")
    const ids = [new ObjectId(), new ObjectId()]
    const names = [`audit-store-${run}`, `audit-store-new-${run}`]
    const indexName = `audit_qr_unique_${run}`
    const storeIndexName = `audit_store_unique_${run}`
    let qrIndexCreated = false
    let storeIndexCreated = false
    let failQr = false
    let failStores = false
    const encoded = []
    const loader = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
      "@/lib/seo-metadata": { getOriginFromHeaders: async () => "https://fixture.invalid" },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "qrcode": { toDataURL: async (...args) => {
        encoded.push(args[0])
        return require("qrcode").toDataURL(...args)
      } },
      "@/lib/db-service": { getCollection: async name => {
        assert.ok(["store_locations", "store_qr_codes"].includes(name))
        const collection = db.collection(name)
        return new Proxy(collection, { get(target, key) {
          if (key === "insertMany" && name === "store_qr_codes") return async (...args) => {
            const result = await target.insertMany(...args)
            if (failQr) throw new Error("Injected QR failure after transactional insertion")
            return result
          }
          if (key === "bulkWrite" && name === "store_locations") return async (...args) => {
            const result = await target.bulkWrite(...args)
            if (failStores) throw new Error("Injected store failure after transactional bulk write")
            return result
          }
          const value = Reflect.get(target, key)
          return typeof value === "function" ? value.bind(target) : value
        } })
      } },
    })
    const create = loader.load("app/api/admin/store-qr/route.ts")
    const edit = loader.load("app/api/admin/store-qr/[id]/route.ts")
    const bulk = loader.load("app/api/admin/store-qr/bulk/route.ts")
    const scan = loader.load("app/api/store-qr/scan/[id]/route.ts")
    const analytics = loader.load("app/api/admin/store-qr/analytics/route.ts")
    const storeBulk = loader.load("app/api/admin/store-locations/bulk/route.ts")
    const req = (body, method = "POST") => new Request("https://fixture.invalid/api/admin/store-qr", { method, body: JSON.stringify(body) })
    const params = id => ({ params: Promise.resolve({ id }) })
    let count = 0
    const check = (label, condition) => { assert.ok(condition, label); console.log(`PASS: ${label}`); count++ }
    try {
      await qrs.createIndex({ storeId: 1, type: 1 }, { unique: true, name: indexName })
      qrIndexCreated = true
      await stores.createIndex({ shopName: 1 }, { unique: true, name: storeIndexName })
      storeIndexCreated = true
      await stores.insertOne({ _id: ids[0], shopName: names[0], isActive: true, googleMapLocation: "https://maps.example.invalid/fixture", _auditFixture: marker })
      failQr = true
      const rollback = await bulk.POST(req({ storeIds: [ids[0].toString()] }))
      check("QR bulk failure after insert rolls back every code", rollback.status === 500 && await qrs.countDocuments({ storeId: ids[0].toString() }) === 0)
      failQr = false
      const body = { storeId: ids[0].toString(), type: "google_maps", targetUrl: "https://maps.example.invalid/one" }
      const concurrent = await Promise.all([create.POST(req(body)), create.POST(req(body))])
      check("unique QR store/type index prevents concurrent duplicates", concurrent.map(r => r.status).sort().join(",") === "200,409" && await qrs.countDocuments({ storeId: ids[0].toString(), type: "google_maps" }) === 1)
      const saved = await qrs.findOne({ storeId: ids[0].toString(), type: "google_maps" })
      const qrId = saved._id.toHexString()
      check("single QR stores an image for its tracked ID, never its destination", encoded.includes(`https://fixture.invalid/api/store-qr/scan/${qrId}`) && !encoded.includes(body.targetUrl))
      const updated = await edit.PUT(req({ targetUrl: "https://maps.example.invalid/two" }, "PUT"), params(qrId))
      check("target edits preserve the original tracked QR image", updated.status === 200 && (await qrs.findOne({ _id: saved._id })).qrDataUrl === saved.qrDataUrl)
      const response = await scan.GET(new Request("https://fixture.invalid/scan"), params(qrId))
      check("public QR scans atomically count and redirect without caching", response.status === 307 && response.headers.get("cache-control") === "no-store" && (await qrs.findOne({ _id: saved._id })).scanCount === 1)
      await qrs.updateOne({ _id: saved._id }, { $set: { isActive: false } })
      check("inactive QR codes do not redirect or count scans", (await scan.GET(new Request("https://fixture.invalid/scan"), params(qrId))).status === 410 && (await qrs.findOne({ _id: saved._id })).scanCount === 1)
      const generated = await (await bulk.POST(req({ storeIds: [ids[0].toString()] }))).json()
      check("bulk generation commits only missing types with tracked images", generated.created.length === 2 && generated.skipped.length === 1 && generated.created.every(qr => encoded.includes(qr.scanUrl)))
      await qrs.updateOne({ _id: saved._id }, { $set: { scanCount: 501 } })
      const report = await (await analytics.GET(new Request("https://fixture.invalid/analytics?range=7d"))).json()
      check("QR analytics reports retained range counts and incomplete lifetime history honestly", report.overview.totalScans === 1 && report.overview.lifetimeScans === 501 && report.overview.historyComplete === false && !("_id" in report.storeDetails[0].types.google_maps))
      const storeBody = { stores: [{ shopName: names[0], isActive: false }, { shopName: names[1], isActive: true }] }
      failStores = true
      check("store bulk update and insert roll back together on database failure", (await storeBulk.POST(req(storeBody))).status === 500 && (await stores.findOne({ _id: ids[0] })).isActive === true && await stores.countDocuments({ shopName: names[1] }) === 0)
      failStores = false
      const imported = await (await storeBulk.POST(req(storeBody))).json()
      check("validated store bulk upload commits exact inserted and matched counts", imported.success && imported.inserted === 1 && imported.updated === 1 && (await stores.findOne({ _id: ids[0] })).isActive === false)
    } finally {
      await qrs.deleteMany({ storeId: { $in: ids.map(id => id.toString()) } })
      await stores.deleteMany({ shopName: { $in: names } })
      if (qrIndexCreated) await qrs.dropIndex(indexName)
      if (storeIndexCreated) await stores.dropIndex(storeIndexName)
      console.log("Own isolated QR/store fixtures and indexes cleaned")
    }
    console.log(`PASS: ${count} real isolated store/QR checks`)
  } else if (action === "verify-campaign-admin") {
    const run = crypto.randomUUID()
    const own = { _auditFixture: marker, run }
    const slug = `audit-${run}`
    const indexName = `audit_campaign_slug_${run}`
    const campaignId = new ObjectId().toString()
    const productId = new ObjectId()
    const legacyProductId = `audit-product-${run}`
    const winnerId = new ObjectId().toString()
    const oldId = new ObjectId().toString()
    const allowed = new Set(["campaign_pages", "products", "lucky_draw_campaigns", "lucky_draw_participants"])
    let failInsert = false
    let indexCreated = false
    const pages = db.collection("campaign_pages")
    const participants = db.collection("lucky_draw_participants")
    const campaigns = db.collection("lucky_draw_campaigns")
    const products = db.collection("products")
    const loader = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": {
        normalizeId: doc => { const { _id, id: _ignored, ...fields } = doc; return { ...fields, id: _id.toString() } },
        getCollection: async name => {
          assert.ok(allowed.has(name), `Unexpected campaign-admin collection ${name}`)
          const collection = db.collection(name)
          if (name !== "lucky_draw_participants") return collection
          return new Proxy(collection, { get(target, key) {
            if (key === "insertMany") return async (...args) => {
              const result = await target.insertMany(...args)
              if (failInsert) throw new Error("Injected participant insertion failure")
              return result
            }
            const value = Reflect.get(target, key)
            return typeof value === "function" ? value.bind(target) : value
          } })
        },
      },
    })
    const pageRoute = loader.load("app/api/admin/campaign-pages/route.ts")
    const pageDetail = loader.load("app/api/admin/campaign-pages/[id]/route.ts")
    const publicPage = loader.load("app/api/campaign-pages/[slug]/route.ts")
    const poolRoute = loader.load("app/api/admin/lucky-draw/[id]/participants/route.ts")
    const { NextRequest } = require("next/server")
    const request = (body, path = "/fixture", method = "POST") => new NextRequest(`https://fixture.invalid${path}`, { method, body: JSON.stringify(body) })
    const poolContext = { params: Promise.resolve({ id: campaignId }) }
    const upload = body => poolRoute.POST(request(body), poolContext)
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      assert.equal(await pages.countDocuments({}), 0, "Use an empty isolated campaign database")
      await pages.createIndex({ slug: 1 }, { unique: true, name: indexName })
      indexCreated = true
      await products.insertMany([
        { _id: productId, name: "Fixture native", price: 100, active: true, ...own },
        { _id: legacyProductId, name: "Fixture legacy", price: 200, active: true, ...own },
      ])
      const body = { name: "Fixture landing", slug, productIds: [productId.toString(), legacyProductId] }
      const creates = await Promise.all([pageRoute.POST(request(body)), pageRoute.POST(request(body))])
      check("unique slug index prevents concurrent duplicate canonical campaign URLs",
        creates.filter(response => response.status === 200).length === 1 &&
        creates.filter(response => response.status === 409).length === 1 && await pages.countDocuments({ slug }) === 1)
      const created = await (await pages.findOne({ slug }))._id
      const detailContext = { params: Promise.resolve({ id: created.toString() }) }
      const publicContext = { params: Promise.resolve({ slug }) }
      const publicResponse = await publicPage.GET(request({}, "/fixture"), publicContext)
      const responseBody = await publicResponse.json()
      check("public campaigns normalize both native and string catalogue IDs",
        publicResponse.status === 200 && responseBody.campaign.id === created.toString() &&
        responseBody.campaign.products.length === 2 &&
        responseBody.campaign.products.every(product => typeof product.id === "string" && !("_id" in product)))
      await products.updateOne({ _id: legacyProductId, ...own }, { $set: { active: false } })
      check("public campaigns do not display disabled products",
        (await (await publicPage.GET(request({}), publicContext)).json()).campaign.products.length === 1)
      const updated = await pageDetail.PUT(request({ isActive: false }), detailContext)
      check("partial campaign writes preserve existing fields and return actual normalized data",
        updated.status === 200 && (await updated.json()).campaign.slug === slug &&
        (await pages.findOne({ _id: created })).productIds.length === 2)
      check("inactive campaign pages return a genuine not-found response",
        (await publicPage.GET(request({}), publicContext)).status === 404)
      const missing = { params: Promise.resolve({ id: new ObjectId().toString() }) }
      check("missing campaign mutations are not acknowledged as successful",
        (await pageDetail.PUT(request({ name: "Missing" }), missing)).status === 404 &&
        (await pageDetail.DELETE(request({}), missing)).status === 404)
      await campaigns.insertOne({ _id: campaignId, name: "Fixture draw", status: "active", prizes: [], ...own })
      await participants.insertMany([
        { _id: winnerId, campaignId, name: "Winner", phone: "", email: "", wonAt: new Date(), ...own },
        { _id: oldId, campaignId, name: "Old eligible", phone: "", email: "", wonAt: null, ...own },
      ])
      failInsert = true
      check("replace failure after insertion rolls back removed participants and the campaign revision",
        (await upload({ rows: [{ name: "New" }], replace: true })).status === 500 &&
        await participants.countDocuments({ campaignId }) === 2 && await participants.countDocuments({ _id: oldId }) === 1 &&
        !(await campaigns.findOne({ _id: campaignId })).participantsRevision)
      failInsert = false
      const replaced = await upload({ rows: [{ name: "Winner" }, { name: "New" }], replace: true })
      const replacedBody = await replaced.json()
      check("replacement preserves prior winners and prevents them from re-entering the pool",
        replaced.status === 200 && replacedBody.inserted === 1 && replacedBody.duplicates === 1 &&
        await participants.countDocuments({ _id: winnerId, campaignId, wonAt: { $ne: null } }) === 1)
      const removeWinner = await poolRoute.DELETE(new NextRequest(`https://fixture.invalid/participants?participantId=${winnerId}`), poolContext)
      const removePool = await poolRoute.DELETE(new NextRequest("https://fixture.invalid/participants"), poolContext)
      check("pool removal cannot erase already-drawn winners",
        removeWinner.status === 409 && removePool.status === 200 && await participants.countDocuments({ campaignId }) === 1)
      await participants.insertMany(Array.from({ length: 19998 }, (_, index) => ({
        _id: new ObjectId().toString(), campaignId, name: `Fixture ${index}`, phone: "", email: "", wonAt: null, ...own,
      })))
      const uploads = await Promise.all([upload({ rows: [{ name: "Concurrent A" }] }), upload({ rows: [{ name: "Concurrent B" }] })])
      check("concurrent uploads cannot exceed the exact 20000-participant cap",
        uploads.filter(response => response.status === 200).length === 1 &&
        uploads.filter(response => response.status === 400).length === 1 &&
        await participants.countDocuments({ campaignId }) === 20000)
      console.log(`${checks} real MongoDB campaign-admin checks passed; no live campaign or provider mutations`)
    } finally {
      await participants.deleteMany({ campaignId })
      await campaigns.deleteOne({ _id: campaignId, ...own })
      await pages.deleteMany({ slug })
      await products.deleteMany(own)
      if (indexCreated) await pages.dropIndex(indexName)
      console.log("Own synthetic campaign fixtures and own isolated index removed")
    }
  } else if (action === "verify-license-repair") {
    const run = crypto.randomUUID()
    const own = { _auditFixture: marker, run }
    const softwareId = new ObjectId()
    const shortageId = new ObjectId()
    const orders = db.collection("orders")
    const inventory = db.collection("license_keys")
    const allowed = new Set(["orders", "license_keys", "software_licenses"])
    const proxyDb = { collection: name => {
      assert.ok(allowed.has(name), `Unexpected license-repair collection ${name}`)
      return db.collection(name)
    } }
    let emails = 0
    const loader = sourceLoader({
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: proxyDb }) },
      "@/lib/db-service": { getCollection: async name => proxyDb.collection(name) },
      "@/lib/email": { sendEmail: async () => { emails++; return { success: false } } },
    })
    const repair = loader.load("scripts/assign-missing-licenses.ts")
    const fulfillment = loader.load("lib/software-fulfillment.ts")
    const base = {
      customer: { email: "fixture@example.invalid", name: "Fixture" },
      status: "processing", paymentVerification: { verified: true }, createdAt: new Date(), ...own,
    }
    const item = { id: softwareId.toString(), name: "Fixture software", type: "software", quantity: 1 }
    const fixtures = [
      { ...base, _id: new ObjectId(), orderId: `LEGACY-${run}`, licenseKey: null,
        items: [{ ...item, id: undefined, softwareId: softwareId.toString(), quantity: 2 }] },
      { ...base, _id: new ObjectId(), orderId: `MIXED-${run}`, items: [item, { type: "hardware", quantity: 1 }] },
      { ...base, _id: new ObjectId(), orderId: `INVALID-${run}`, items: [{ ...item, quantity: 0 }] },
      { ...base, _id: new ObjectId(), orderId: `SHORTAGE-${run}`, items: [{ ...item, id: shortageId.toString(), quantity: 2 }] },
      { ...base, _id: new ObjectId(), orderId: `UNPAID-${run}`, paymentVerification: { verified: false }, items: [item] },
      { ...base, _id: new ObjectId(), orderId: `CANCELLED-${run}`, status: "cancelled", items: [item] },
      { ...base, _id: new ObjectId(), orderId: `ARRAY-KEY-${run}`, licenseKeys: ["fixture-existing"], items: [item] },
    ]
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      assert.equal(await orders.countDocuments({}), 0, "Use a dedicated empty isolated database for license repair")
      await orders.insertMany(fixtures)
      await inventory.insertMany([0, 1, 2, 3].map(index => ({
        softwareId: index === 3 ? shortageId : softwareId, key: `private-fixture-${run}-${index}`,
        assigned: false, email: null, ...own,
      })))
      check("repair candidates exclude unpaid, cancelled and already-array-licensed orders",
        await orders.countDocuments(repair.missingLicenseQuery(30)) === 4)
      const stats = await repair.assignMissingLicenses(30)
      const legacy = await orders.findOne({ _id: fixtures[0]._id, ...own })
      const mixed = await orders.findOne({ _id: fixtures[1]._id, ...own })
      check("legacy null-key orders use stored softwareId and receive the exact quantity atomically",
        legacy.licenseKeys.length === 2 && legacy.status === "delivered")
      check("mixed hardware orders retain their fulfillment status after local software allocation",
        mixed.licenseKeys.length === 1 && mixed.status === "processing")
      check("invalid stored quantities remain unfulfilled and consume no additional license inventory",
        !(await orders.findOne({ _id: fixtures[2]._id, ...own })).licenseFulfillment &&
        await inventory.countDocuments({ ...own, assigned: true }) === 3)
      check("inventory shortage rolls back the order claim and every partial allocation",
        !(await orders.findOne({ _id: fixtures[3]._id, ...own })).licenseFulfillment &&
        await inventory.countDocuments({ ...own, softwareId: shortageId, assigned: false }) === 1)
      check("false provider acceptance is counted as an error rather than successful delivery",
        stats.totalOrders === 4 && stats.ordersProcessed === 2 && stats.licensesAssigned === 3 &&
        stats.emailsSent === 0 && stats.ordersMarkedDelivered === 1 && stats.errors.length === 4 && emails === 3)
      check("repair statistics do not expose any assigned key", !JSON.stringify(stats).includes("private-fixture"))
      await assert.rejects(fulfillment.fulfillSoftwareOrder(fixtures[0]._id.toString()), /already fulfilled/)
      await assert.rejects(fulfillment.fulfillSoftwareOrder(fixtures[5]._id.toString()), /already fulfilled/)
      await assert.rejects(fulfillment.fulfillSoftwareOrder(fixtures[6]._id.toString()), /already fulfilled/)
      check("replay, cancellation and existing key arrays cannot reassign licenses",
        await inventory.countDocuments({ ...own, assigned: true }) === 3 && emails === 3)
      console.log(`${checks} real MongoDB license-repair checks passed; email acceptance mocked and no live records touched`)
    } finally {
      await orders.deleteMany({ ...own, _id: { $in: fixtures.map(order => order._id) } })
      await inventory.deleteMany(own)
      console.log("Own synthetic license-repair fixtures removed")
    }
  } else if (action === "verify-admin-finance") {
    const partnerId = `audit-finance:${crypto.randomUUID()}`
    const orderIds = [new ObjectId(), new ObjectId()]
    const walletId = new ObjectId()
    const payoutIds = [new ObjectId(), new ObjectId()]
    const allowed = new Set(["partner_orders", "partner_payouts", "partner_wallets", "wallet_transactions"])
    let failPayout = false
    const loader = sourceLoader({
      "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true, userId: "fixture-finance-operator" }) },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": { getCollection: async name => {
        assert.ok(allowed.has(name), `Unexpected finance collection ${name}`)
        const collection = db.collection(name)
        if (name !== "partner_payouts") return collection
        return new Proxy(collection, { get(target, key) {
          if (key === "insertOne") return async (...args) => {
            const result = await target.insertOne(...args)
            if (failPayout) throw new Error("Injected external payout insertion failure")
            return result
          }
          const value = Reflect.get(target, key)
          return typeof value === "function" ? value.bind(target) : value
        } })
      } },
    })
    const route = loader.load("app/api/admin/partner-commissions/mark-paid/route.ts")
    const approval = loader.load("app/api/admin/payouts/[payoutId]/approve/route.ts")
    const rejection = loader.load("app/api/admin/payouts/[payoutId]/reject/route.ts")
    const { NextRequest } = require("next/server")
    const request = body => new NextRequest("https://fixture.invalid/finance", { method: "POST", body: JSON.stringify(body) })
    const post = body => route.POST(request(body))
    const input = { partnerId, orderIds: orderIds.map(String), totalAmount: 30.75 }
    const orders = db.collection("partner_orders")
    const payouts = db.collection("partner_payouts")
    const wallets = db.collection("partner_wallets")
    const ledger = db.collection("wallet_transactions")
    const unchanged = async () => await orders.countDocuments({ partnerId, "commission.status": "pending" }) === 2 &&
      await payouts.countDocuments({ partnerId, source: "admin_direct" }) === 0
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      await orders.insertMany(orderIds.map((_id, index) => ({
        _id, partnerId, orderId: `FIXTURE-FINANCE-${_id}`, commission: { amount: index === 0 ? 10.25 : 20.5, status: "pending" },
        paymentVerification: { verified: true }, _auditFixture: marker,
      })))
      await wallets.insertOne({ _id: walletId, partnerId, balance: { available: 500, pending: 0, held: 0 }, _auditFixture: marker })
      check("forged client total rejects the entire commission batch",
        (await post({ ...input, totalAmount: 9999 })).status === 409 && await unchanged())
      await orders.updateOne({ _id: orderIds[1], partnerId }, { $set: { "paymentVerification.verified": false } })
      check("an unpaid order blocks the entire commission batch",
        (await post(input)).status === 409 && await unchanged())
      await orders.updateOne({ _id: orderIds[1], partnerId }, { $set: { "paymentVerification.verified": true } })
      check("missing or cross-partner order selections do not partially credit",
        (await post({ ...input, orderIds: [...input.orderIds, new ObjectId().toString()] })).status === 409 && await unchanged())
      const alias = (await orders.findOne({ _id: orderIds[0], partnerId })).orderId
      check("duplicate selections through native and internal aliases are rejected",
        (await post({ ...input, orderIds: [input.orderIds[0], alias] })).status === 400 && await unchanged())
      failPayout = true
      check("failure after payout insertion rolls back commissions and the inserted payout",
        (await post(input)).status === 500 && await unchanged())
      failPayout = false
      const concurrent = await Promise.all([post(input), post(input)])
      check("concurrent commission recordings commit once",
        concurrent.filter(response => response.status === 200).length === 1 &&
        concurrent.filter(response => response.status === 409).length === 1 &&
        await payouts.countDocuments({ partnerId, source: "admin_direct" }) === 1)
      const direct = await payouts.findOne({ partnerId, source: "admin_direct" })
      check("external commission audit uses the stored total and authenticated operator",
        direct.amount === 30.75 && direct.approvedBy === "fixture-finance-operator" &&
        await orders.countDocuments({ partnerId, "commission.payoutId": direct._id.toString(),
          "commission.creditedBy": "fixture-finance-operator" }) === 2)
      check("external payment recording leaves wallet balances and ledger untouched",
        (await wallets.findOne({ _id: walletId, partnerId })).balance.available === 500 &&
        await ledger.countDocuments({ partnerId }) === 0)
      await payouts.insertMany(payoutIds.map((_id, index) => ({
        _id, id: `legacy-${_id}`, partnerId, walletId: walletId.toString(), amount: 100,
        status: "pending_approval", requestedAt: new Date(), _auditFixture: marker, notes: `Fixture ${index}`,
      })))
      const approvalParams = { params: Promise.resolve({ payoutId: `legacy-${payoutIds[0]}` }) }
      const approved = await approval.POST(request({ notes: "Fixture approval", transactionId: "FIXTURE-REF" }), approvalParams)
      const stored = await payouts.findOne({ _id: payoutIds[0], partnerId })
      check("legacy-ID approval atomically persists operator, notes, reference and actual approval status",
        approved.status === 200 && stored.status === "approved" && stored.approvedBy === "fixture-finance-operator" &&
        stored.adminNotes === "Fixture approval" && stored.transactionId === "FIXTURE-REF")
      check("approval acknowledgement does not claim funds were transferred",
        /No bank transfer/.test((await approved.json()).data.message))
      check("approval replay is a conflict and cannot overwrite audit metadata",
        (await approval.POST(request({ notes: "Overwrite" }), approvalParams)).status === 409 &&
        (await payouts.findOne({ _id: payoutIds[0], partnerId })).adminNotes === "Fixture approval")
      const rejected = await rejection.POST(request({ reason: "Fixture rejection" }),
        { params: Promise.resolve({ payoutId: payoutIds[1].toString() }) })
      const rejectedDoc = await payouts.findOne({ _id: payoutIds[1], partnerId })
      check("rejection preserves the correct operator and reason and refunds exactly once",
        rejected.status === 200 && rejectedDoc.rejectedBy === "fixture-finance-operator" &&
        rejectedDoc.rejectionReason === "Fixture rejection" &&
        (await wallets.findOne({ _id: walletId, partnerId })).balance.available === 600 &&
        await ledger.countDocuments({ partnerId, payoutId: payoutIds[1].toString(), balanceAfter: 600 }) === 1)
      console.log(`${checks} real MongoDB finance checks passed; zero provider calls or live mutations`)
    } finally {
      await orders.deleteMany({ partnerId, _id: { $in: orderIds } })
      await payouts.deleteMany({ partnerId })
      await wallets.deleteOne({ _id: walletId, partnerId })
      await ledger.deleteMany({ partnerId })
      console.log("Own synthetic finance fixtures removed")
    }
  } else if (action === "verify-admin-updates") {
    const run = crypto.randomUUID()
    const own = { _auditFixture: marker, run }
    const employeeIds = [`ADMIN-${run}`, `COLLISION-${run}`]
    const emails = [`staff-${run}@example.invalid`, `existing-${run}@example.invalid`, `privileged-${run}@example.invalid`,
      `changed-${run}@example.invalid`, `race1-${run}@example.invalid`, `race2-${run}@example.invalid`]
    const allowed = new Set(["employees", "users", "refresh_tokens", "orders", "partner_orders",
      "products", "product_specifications", "blocked_pincodes"])
    let failUserInsert = false
    let failUserUpdate = false
    let failEmployeeDelete = false
    let stalePrice = false
    let staleSpec = false
    let staleDelete = false
    let orderRace = false
    let orderReads = 0
    let releaseOrderReads
    const orderBarrier = new Promise(resolve => { releaseOrderReads = resolve })
    const proxyDb = { collection: name => {
      assert.ok(allowed.has(name), `Unexpected collection ${name}`)
      const collection = db.collection(name)
      return new Proxy(collection, { get(target, key) {
        if (name === "users" && key === "insertOne") return async (...args) => {
          const result = await target.insertOne(...args)
          if (failUserInsert) throw new Error("Injected employee user insertion failure")
          return result
        }
        if (name === "users" && key === "updateOne") return async (...args) => {
          const result = await target.updateOne(...args)
          if (failUserUpdate) throw new Error("Injected employee login update failure")
          return result
        }
        if (name === "employees" && key === "deleteOne") return async (...args) => {
          const result = await target.deleteOne(...args)
          if (failEmployeeDelete) throw new Error("Injected employee deletion failure")
          return result
        }
        if (name === "products" && key === "findOneAndUpdate") return async (query, ...args) => {
          if (stalePrice) await target.updateOne({ _id: query._id, ...own }, { $set: { price: 1600 } })
          return target.findOneAndUpdate(query, ...args)
        }
        if (name === "product_specifications" && ["findOneAndUpdate", "deleteOne"].includes(key)) return async (query, ...args) => {
          if ((key === "findOneAndUpdate" && staleSpec) || (key === "deleteOne" && staleDelete)) {
            await target.updateOne({ _id: query._id, ...own }, { $set: { locked: true } })
          }
          return target[key](query, ...args)
        }
        if (name === "orders" && key === "findOne") return async (...args) => {
          const result = await target.findOne(...args)
          if (orderRace && result) {
            orderReads++
            if (orderReads === 2) releaseOrderReads()
            await orderBarrier
          }
          return result
        }
        const value = Reflect.get(target, key)
        return typeof value === "function" ? value.bind(target) : value
      } })
    } }
    const loader = sourceLoader({
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: proxyDb }) },
      "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "fixture-operator" } }),
        requireFullAdmin: async () => ({ ok: true, user: { id: "fixture-operator", role: "admin" } }),
        getSession: async () => ({ user: { id: "fixture-owner" } }),
        checkAdminAuthorization: async () => ({ authorized: true }) },
      "@/lib/email": { sendEmail: async () => { throw new Error("Unexpected provider call") } },
      "@/lib/push": { notifyOrderStatus: async () => {} },
      "@/lib/customer-profile": { EARNING_STATUSES: ["delivered", "completed"], rebuildCustomerProfile: async () => {}, recordEvent: async () => {} },
      "@/lib/loyalty": { awardPointsForOrder: async () => {}, reverseOrderPoints: async () => {} },
    })
    const employees = loader.load("lib/employee-service.ts")
    const employeeRoute = loader.load("app/api/employees/route.ts")
    const orderRoute = loader.load("app/api/orders/[id]/route.ts")
    const specRoute = loader.load("app/api/products/specifications/[sku]/route.ts")
    const specUploadRoute = loader.load("app/api/products/specifications/upload/route.ts")
    const pincodeRoute = loader.load("app/api/blocked-pincodes/route.ts")
    const prices = loader.load("lib/product-price-import.ts")
    const { NextRequest } = require("next/server")
    const request = (method, body, path = "/fixture") => new NextRequest(`http://localhost${path}`, { method, body: JSON.stringify(body) })
    const input = employees.CreateEmployeeSchema.parse({
      employeeId: employeeIds[0], email: emails[0], name: "Synthetic staff",
      dashboardAccess: true, allowedPages: ["/admin/orders"],
    })
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const pincodeKeys = ["allowed_list", "blocked_list", "mode"]
    try {
      assert.equal(await db.collection("blocked_pincodes").countDocuments({ key: { $in: pincodeKeys } }), 0,
        "This action needs an isolated database without existing pincode fixtures")
      failUserInsert = true
      await assert.rejects(employees.createEmployee(input), /Injected employee user insertion/)
      check("employee creation failure after user insertion rolls back both records",
        await db.collection("users").countDocuments({ email: emails[0] }) === 0 &&
        await db.collection("employees").countDocuments({ employeeId: employeeIds[0] }) === 0)
      failUserInsert = false
      const created = await employees.createEmployee(input)
      const storedUser = await db.collection("users").findOne({ email: emails[0] })
      check("staff creation commits one linked login with a random password stored only as a hash",
        created.success && created.temporaryPassword.length === 32 && storedUser.password !== created.temporaryPassword &&
        await require("bcryptjs").compare(created.temporaryPassword, storedUser.password) &&
        (await db.collection("employees").findOne({ employeeId: input.employeeId })).userId === created.userId)
      const list = await employeeRoute.GET()
      const listBody = await list.json()
      check("employee reads normalize IDs and omit password, internal link and credential fields",
        list.status === 200 && listBody[0].id === created.employeeId && !listBody[0]._id &&
        !listBody[0].password && !listBody[0].userId)
      await db.collection("refresh_tokens").insertOne({ userId: created.userId, tokenHash: run, ...own })
      failUserUpdate = true
      const update = employees.UpdateEmployeeSchema.parse({ ...input, email: emails[3], name: "Changed staff" })
      await assert.rejects(employees.updateEmployee(created.employeeId, update), /Injected employee login update/)
      check("staff access update failure rolls back employee and login together",
        (await db.collection("employees").findOne({ employeeId: input.employeeId })).email === emails[0] &&
        (await db.collection("users").findOne({ _id: storedUser._id })).email === emails[0] &&
        !(await db.collection("refresh_tokens").findOne(own)).revokedAt)
      failUserUpdate = false
      await employees.updateEmployee(created.employeeId, update)
      check("staff updates target their linked account and revoke old sessions atomically",
        (await db.collection("employees").findOne({ employeeId: input.employeeId })).email === emails[3] &&
        (await db.collection("users").findOne({ _id: storedUser._id })).sessionVersion === 1 &&
        !!(await db.collection("refresh_tokens").findOne(own)).revokedAt)
      const privileged = await db.collection("users").insertOne({ email: emails[2], role: "admin", ...own })
      await assert.rejects(employees.updateEmployee(created.employeeId, { ...update, email: emails[2] }), /another account/)
      await assert.rejects(employees.createEmployee({ ...input, employeeId: employeeIds[1], email: emails[2] }), /privileged/)
      check("employee creation and edits cannot attach or overwrite a privileged account",
        (await db.collection("users").findOne({ _id: privileged.insertedId })).role === "admin" &&
        await db.collection("employees").countDocuments({ employeeId: employeeIds[1] }) === 0)
      failEmployeeDelete = true
      await assert.rejects(employees.deleteEmployee(created.employeeId), /Injected employee deletion/)
      check("deletion failure after deleting the employee restores login status and staff record",
        await db.collection("employees").countDocuments({ _id: new ObjectId(created.employeeId) }) === 1 &&
        (await db.collection("users").findOne({ _id: storedUser._id })).status === "active")
      failEmployeeDelete = false
      await employees.deleteEmployee(created.employeeId)
      check("staff deletion disables only the linked login while preserving its customer identity",
        await db.collection("employees").countDocuments({ _id: new ObjectId(created.employeeId) }) === 0 &&
        (await db.collection("users").findOne({ _id: storedUser._id })).status === "inactive" &&
        (await db.collection("users").findOne({ _id: storedUser._id })).dashboardAccess === false &&
        (await db.collection("users").findOne({ _id: privileged.insertedId })).role === "admin")
      const raced = await Promise.allSettled([emails[4], emails[5]].map(email =>
        employees.createEmployee({ ...input, employeeId: employeeIds[1], email })))
      check("concurrent creation of the same employee identity commits only one login",
        raced.filter(value => value.status === "fulfilled").length === 1 &&
        await db.collection("employees").countDocuments({ employeeId: employeeIds[1] }) === 1 &&
        await db.collection("users").countDocuments({ email: { $in: [emails[4], emails[5]] } }) === 1)
      const orderId = new ObjectId()
      await db.collection("orders").insertOne({
        _id: orderId, orderId: `FIXTURE-${run}`, status: "processing", updatedAt: new Date(), userId: "fixture-owner",
        timeline: [], total: 1000, ...own,
      })
      orderRace = true
      const orderContext = { params: Promise.resolve({ id: String(orderId) }) }
      const orderResults = await Promise.all([
        orderRoute.PUT(request("PUT", { status: "confirmed" }), orderContext),
        orderRoute.PUT(request("PUT", { status: "shipped", trackingNumber: "FIXTURE-TRACK" }), orderContext),
      ])
      orderRace = false
      const order = await db.collection("orders").findOne({ _id: orderId })
      check("simultaneous status edits produce one persisted winner, one 409 and one history entry",
        orderResults.filter(response => response.status === 200).length === 1 &&
        orderResults.filter(response => response.status === 409).length === 1 && order.timeline.length === 1)
      const sku = `MRP-${run}`
      const product = await db.collection("products").insertOne({ itemno: sku, price: 1000, mrp: 2000, ...own })
      stalePrice = true
      const changedMrp = await prices.processProductMrps([{ itemno: sku, MRP: 1500 }])
      stalePrice = false
      check("MRP import cannot undercut a selling price changed after its read",
        changedMrp.updated === 0 && changedMrp.errors.length === 1 &&
        (await db.collection("products").findOne({ _id: product.insertedId })).mrp === 2000)
      const specSku = `SPEC-${run}`
      await db.collection("product_specifications").insertOne({ sku: specSku, locked: true, name: "Fixture", updatedAt: new Date(), ...own })
      const specContext = { params: Promise.resolve({ sku: specSku }) }
      check("locked specifications reject mixed unlock-and-edit requests",
        (await specRoute.PATCH(request("PATCH", { locked: false, name: "Bypass" }), specContext)).status === 409)
      const unlocked = await specRoute.PATCH(request("PATCH", { locked: false }), specContext)
      check("lock-only updates use a native compare-and-swap and return a normalized ID",
        unlocked.status === 200 && typeof (await unlocked.json()).data.id === "string")
      staleSpec = true
      check("a concurrent lock prevents a stale specification edit",
        (await specRoute.PATCH(request("PATCH", { name: "Changed" }), specContext)).status === 409 &&
        (await db.collection("product_specifications").findOne({ sku: specSku })).name === "Fixture")
      staleSpec = false
      await db.collection("product_specifications").updateOne({ sku: specSku }, { $set: { locked: false } })
      staleDelete = true
      check("a concurrent lock prevents stale specification deletion",
        (await specRoute.DELETE(request("DELETE", {}), specContext)).status === 409 &&
        await db.collection("product_specifications").countDocuments({ sku: specSku }) === 1)
      staleDelete = false
      const lockedUpload = await specUploadRoute.POST(request("POST", {
        specifications: [{ sku: specSku, name: "Import bypass" }],
      }))
      const lockedUploadBody = await lockedUpload.json()
      check("bulk specification upload preserves a locked record without creating an unlocked duplicate",
        lockedUpload.status === 200 && lockedUploadBody.skipped === 1 && lockedUploadBody.success === 0 &&
        await db.collection("product_specifications").countDocuments({ sku: specSku }) === 1 &&
        (await db.collection("product_specifications").findOne({ sku: specSku })).name === "Fixture")
      await db.collection("blocked_pincodes").insertOne({
        key: "blocked_list", pincodes: ["560001", { pincode: "560001", name: "Legacy" }, "560002"], ...own,
      })
      const pinBody = { pincode: "560001", listType: "blocked", name: "$literal", state: "Karnataka" }
      check("pincode upsert replaces all legacy duplicates with one literal-valued entry",
        (await pincodeRoute.POST(request("POST", pinBody))).status === 200 &&
        (await db.collection("blocked_pincodes").findOne({ key: "blocked_list" })).pincodes.length === 2 &&
        (await db.collection("blocked_pincodes").findOne({ key: "blocked_list" })).pincodes[1].name === "$literal")
      await pincodeRoute.DELETE(request("DELETE", { pincode: "560002", listType: "blocked" }))
      await pincodeRoute.DELETE(request("DELETE", { pincode: "560001", listType: "blocked" }))
      check("pincode deletion handles both string and object legacy entries atomically",
        (await db.collection("blocked_pincodes").findOne({ key: "blocked_list" })).pincodes.length === 0)
      console.log(`${checks} real MongoDB admin-update checks passed; zero provider calls`)
    } finally {
      await db.collection("employees").deleteMany({ employeeId: { $in: employeeIds } })
      await db.collection("users").deleteMany({ email: { $in: emails } })
      for (const name of ["refresh_tokens", "orders", "products", "product_specifications", "blocked_pincodes"]) {
        await db.collection(name).deleteMany(own)
      }
      console.log("Own synthetic admin-update fixtures removed")
    }
  } else if (action === "verify-spin-admin") {
    const run = crypto.randomUUID()
    const slug = `auditspin-${run}`
    const sourceSlug = `source-${run}`
    const own = { _auditFixture: marker, run }
    const inventoryName = `spin_${slug}_inventory`
    const codesName = `spin_${slug}_couponCodes`
    const sourceName = `spin_${sourceSlug}_inventory`
    const names = new Set(["spinWheelCampaigns", inventoryName, codesName, sourceName])
    let failSeeding = false
    let failDeletion = false
    let failCodes = false
    const proxyDb = { collection: name => {
      assert.ok(names.has(name), `Unexpected collection ${name}`)
      const collection = db.collection(name)
      if (name === codesName) return new Proxy(collection, { get(target, key) {
        if (key === "insertMany") return async (docs, options) => target.insertMany(
          failCodes ? [...docs, { code: "FIXTURE-CODE", prizeName: "Fixture" }] : docs, options)
        const value = Reflect.get(target, key)
        return typeof value === "function" ? value.bind(target) : value
      } })
      if (name !== inventoryName) return collection
      return new Proxy(collection, { get(target, key) {
        if (key === "insertMany") return async (...args) => {
          if (failSeeding) throw new Error("Injected spin inventory insertion failure")
          return target.insertMany(...args)
        }
        if (key === "deleteOne") return async (...args) => {
          if (failDeletion) throw new Error("Injected spin prize deletion failure")
          return target.deleteOne(...args)
        }
        const value = Reflect.get(target, key)
        return typeof value === "function" ? value.bind(target) : value
      } })
    } }
    const loader = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true, userId: "fixture-operator" }) },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: proxyDb }) },
    })
    const campaignRoute = loader.load("app/api/spin-wheel/admin/campaigns/route.ts")
    const inventoryRoute = loader.load("app/api/spin-wheel/admin/inventory/route.ts")
    const codesRoute = loader.load("app/api/spin-wheel/admin/coupon-codes/route.ts")
    const { NextRequest } = require("next/server")
    const request = (path, method, body) => new NextRequest(`http://localhost${path}`, { method, body: JSON.stringify(body) })
    const campaigns = db.collection("spinWheelCampaigns")
    const inventory = db.collection(inventoryName)
    const codes = db.collection(codesName)
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      await campaigns.insertOne({ name: "Synthetic source", slug: sourceSlug, isActive: true, createdAt: new Date(), ...own })
      await db.collection(sourceName).insertOne({ prizeName: "Fixture", total: 5, distributed: 2, isActive: false, ...own })
      const createBody = { name: `AuditSpin ${run}`, cloneFrom: sourceSlug }
      failSeeding = true
      const failed = await campaignRoute.POST(request("/api/spin-wheel/admin/campaigns", "POST", createBody))
      check("inventory insertion failure rolls back campaign metadata", failed.status === 500 &&
        await campaigns.countDocuments({ slug }) === 0 && await inventory.countDocuments({}) === 0)
      failSeeding = false
      const created = await campaignRoute.POST(request("/api/spin-wheel/admin/campaigns", "POST", createBody))
      const createdBody = await created.json()
      check("campaign and cloned inventory commit together with a real normalized ID",
        created.status === 200 && ObjectId.isValid(createdBody.campaign.id) &&
        await campaigns.countDocuments({ slug }) === 1 && await inventory.countDocuments({}) === 1)
      const prize = await inventory.findOne({ prizeName: "Fixture" })
      check("clone resets distribution but preserves source eligibility without copying coupon codes",
        prize.distributed === 0 && prize.total === 5 && prize.isActive === false &&
        await codes.countDocuments({}) === 0 && (await db.collection(sourceName).findOne({ prizeName: "Fixture" })).distributed === 2)
      const path = `/api/spin-wheel/admin/inventory?campaignId=${slug}`
      const edited = await inventoryRoute.PUT(request(path, "PUT", { prizeName: "Fixture", isActive: true }))
      check("URL campaign edits only its own existing prize", edited.status === 200 &&
        (await inventory.findOne({ prizeName: "Fixture" })).isActive === true &&
        (await db.collection(sourceName).findOne({ prizeName: "Fixture" })).isActive === false)
      await inventory.updateOne({ prizeName: "Fixture" }, { $set: { distributed: 3 } })
      const low = await inventoryRoute.PUT(request(path, "PUT", { prizeName: "Fixture", total: 2 }))
      check("atomic distributed-count predicate rejects lowering inventory below claimed prizes", low.status === 409 &&
        (await inventory.findOne({ prizeName: "Fixture" })).total === 5)
      const missing = await inventoryRoute.PUT(request(path, "PUT", { prizeName: "Missing", isActive: true }))
      check("editing a missing prize returns 404 without inserting an incomplete row", missing.status === 404 && await inventory.countDocuments({}) === 1)
      const upload = await codesRoute.POST(request(`/api/spin-wheel/admin/coupon-codes?campaignId=${slug}`, "POST",
        { prizeName: "Fixture", codes: ["fixture-code", "FIXTURE-CODE "] }))
      const uploadBody = await upload.json()
      check("case-insensitive duplicate upload inserts one code in the selected campaign",
        upload.status === 200 && uploadBody.added === 1 && uploadBody.skipped === 1 && await codes.countDocuments({}) === 1)
      await assert.rejects(codes.insertOne({ code: "FIXTURE-CODE", prizeName: "Fixture" }), error => error.code === 11000)
      check("database uniqueness prevents racing uploads from storing the same redeemable code twice", await codes.countDocuments({}) === 1)
      failCodes = true
      const failedUpload = await codesRoute.POST(request(`/api/spin-wheel/admin/coupon-codes?campaignId=${slug}`, "POST",
        { prizeName: "Fixture", codes: ["NEW-FIXTURE-CODE"] }))
      failCodes = false
      check("an insertion failure after a code write rolls back the complete upload batch",
        failedUpload.status === 500 && await codes.countDocuments({}) === 1 &&
        await codes.countDocuments({ code: "NEW-FIXTURE-CODE" }) === 0)
      failDeletion = true
      const deletionRequest = () => new NextRequest(`${"http://localhost"}${path}&prizeName=Fixture`, { method: "DELETE" })
      const failedDelete = await inventoryRoute.DELETE(deletionRequest())
      check("prize deletion failure rolls back coupon-code deletion", failedDelete.status === 500 &&
        await inventory.countDocuments({}) === 1 && await codes.countDocuments({}) === 1)
      failDeletion = false
      const deleted = await inventoryRoute.DELETE(deletionRequest())
      check("prize and its coupon codes delete in one committed transaction", deleted.status === 200 &&
        await inventory.countDocuments({}) === 0 && await codes.countDocuments({}) === 0)
      console.log(`${checks} isolated MongoDB spin-admin checks passed; no live campaign, customer or provider touched`)
    } finally {
      await campaigns.deleteMany({ slug: { $in: [slug, sourceSlug] } })
      for (const name of [inventoryName, codesName, sourceName]) await db.collection(name).deleteMany({})
    }
  } else if (action === "verify-external-queue") {
    const run = crypto.randomUUID()
    const own = { _auditFixture: marker, run }
    const orders = db.collection("orders")
    const queue = db.collection("external_orders")
    let failQueueWrite = false
    let failRead = false
    let providerCalls = 0
    const loader = sourceLoader({
      "@/lib/db-service": {
        normalizeId: doc => { const { _id, ...rest } = doc; return { ...rest, id: String(_id) } },
        getCollection: async name => {
          assert.ok(["orders", "external_orders"].includes(name))
          if (name === "orders") return orders
          return {
            findOne: async (...args) => {
              if (failRead) throw new Error("Injected queue read failure")
              return queue.findOne(...args)
            },
            updateOne: async (...args) => {
              if (failQueueWrite) throw new Error("Injected queue write failure")
              return queue.updateOne(...args)
            },
            // Stop the actual dispatch function after its real atomic claim,
            // before it can attempt a billable provider request.
            insertOne: async () => { throw new Error("Synthetic dispatch stop before provider") },
          }
        },
      },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/email": { sendEmail: async () => { throw new Error("Unexpected email") } },
    }, {
      env: { EXLR8_BASE_URL: "https://fixture.invalid", EXLR8_CLIENT_ID: "fixture", EXLR8_CLIENT_SECRET: "fixture", EXLR8_DP_ID: "fixture" },
      fetch: () => { providerCalls++; throw new Error("Provider calls prohibited") },
    })
    const service = loader.load("lib/external-fulfillment.ts")
    const create = async () => {
      const _id = new ObjectId()
      const orderId = `audit-queue:${run}:${_id}`
      const id = `exlr8:${_id}`
      await orders.insertOne({
        _id, orderId, status: "confirmed", paymentVerification: { verified: true },
        externalFulfillment: { status: "queued", updatedAt: new Date() },
        items: [{ id: "fixture", provider: "exlr8", kgenProductId: "fixture-product", quantity: 1 }], ...own,
      })
      await queue.insertOne({ _id: id, orderId, provider: "exlr8", status: "queued", attempts: 0, ...own })
      return { _id, id }
    }
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      const rollback = await create()
      failQueueWrite = true
      await assert.rejects(service.manageQueuedExternalOrder(rollback.id, "cancel", "fixture-operator"), /Injected queue write/)
      failQueueWrite = false
      check("queue write failure rolls back the real linked-order transaction",
        (await orders.findOne({ _id: rollback._id })).externalFulfillment.status === "queued" &&
        (await queue.findOne({ _id: rollback.id })).status === "queued")
      const cancellations = await Promise.all([
        service.manageQueuedExternalOrder(rollback.id, "cancel", "fixture-operator"),
        service.manageQueuedExternalOrder(rollback.id, "cancel", "fixture-operator"),
      ])
      const cancelled = await orders.findOne({ _id: rollback._id })
      check("concurrent cancellations both acknowledge one idempotent committed cancellation",
        cancellations.every(result => result.item.id === rollback.id && result.item.status === "cancelled") &&
        cancellations.some(result => result.message === "Already cancelled") &&
        cancelled.externalFulfillment.status === "cancelled")
      check("cancellation leaves customer payment and order status unchanged",
        cancelled.status === "confirmed" && cancelled.paymentVerification.verified === true)
      const readonly = await create()
      const before = await queue.findOne({ _id: readonly.id })
      const retried = await service.manageQueuedExternalOrder(readonly.id, "retry", "fixture-operator")
      check("retry is a read-only queue check, not a provider retry",
        retried.message.includes("No provider placement") &&
        JSON.stringify(await queue.findOne({ _id: readonly.id })) === JSON.stringify(before))
      failRead = true
      await assert.rejects(service.manageQueuedExternalOrder(readonly.id, "cancel", "fixture-operator"), /Injected queue read/)
      failRead = false
      check("database read errors propagate and do not cancel the linked order",
        (await orders.findOne({ _id: readonly._id })).externalFulfillment.status === "queued")
      const attempted = await create()
      await queue.updateOne({ _id: attempted.id }, { $set: { attempts: 1 } })
      await assert.rejects(service.manageQueuedExternalOrder(attempted.id, "cancel", "fixture-operator"), error => error.status === 409)
      check("queued rows with an attempted-placement counter require reconciliation",
        (await orders.findOne({ _id: attempted._id })).externalFulfillment.status === "queued")
      for (const status of ["processing", "needs_reconciliation", "placed"]) {
        await orders.updateOne({ _id: readonly._id }, { $set: { "externalFulfillment.status": status } })
        for (const action of ["cancel", "retry"]) {
          await assert.rejects(service.manageQueuedExternalOrder(readonly.id, action, "fixture-operator"), error => error.status === 409)
        }
      }
      check("processing and uncertain linked states reject cancellation and retry", (await queue.findOne({ _id: readonly.id })).status === "queued")
      const legacy = new ObjectId()
      await queue.insertOne({ _id: legacy, status: "queued", attempts: 0, ...own })
      await assert.rejects(service.manageQueuedExternalOrder(legacy.toString(), "cancel", "fixture-operator"), error => error.status === 409)
      check("legacy noncanonical rows require reconciliation", (await queue.findOne({ _id: legacy })).status === "queued")
      for (let iteration = 0; iteration < 6; iteration++) {
        const fixture = await create()
        const results = await Promise.allSettled([
          service.manageQueuedExternalOrder(fixture.id, "cancel", "fixture-operator"),
          service.fulfillExternalOrder(fixture._id.toString()),
        ])
        const order = await orders.findOne({ _id: fixture._id })
        const row = await queue.findOne({ _id: fixture.id })
        assert.ok(["cancelled", "processing"].includes(order.externalFulfillment.status))
        if (order.externalFulfillment.status === "cancelled") {
          assert.equal(row.status, "cancelled")
          assert.equal(results[0].status, "fulfilled")
          assert.equal(results[1].status, "rejected")
          assert.equal(results[1].reason.status, 409)
        } else {
          assert.equal(row.status, "queued")
          assert.equal(results[0].status, "rejected")
          assert.equal(results[0].reason.status, 409)
          assert.equal(results[1].status, "rejected")
          assert.match(results[1].reason.message, /Synthetic dispatch stop/)
        }
      }
      check("six actual dispatch-versus-cancel races never cancel a claimed placement", true)
      check("all isolated queue checks made zero provider calls", providerCalls === 0)
      console.log(`${checks} isolated MongoDB external queue checks passed; zero live records or providers touched`)
    } finally {
      await orders.deleteMany(own)
      await queue.deleteMany(own)
    }
  } else if (action === "verify-coupons") {
    const run = crypto.randomUUID()
    const productId = new ObjectId()
    const softwareId = `audit-software:${run}`
    const couponId = new ObjectId()
    const code = `AUDIT-${run}`.toUpperCase()
    const userId = `audit-customer:${run}`
    const couponCol = db.collection("coupons")
    let failInsert = false
    let sequence = 0
    const intentIds = []
    const loader = sourceLoader({
      "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products", COUPONS: "coupons" }, getCollection: async name => {
        assert.ok(["products", "software_products", "coupons", "checkout_intents"].includes(name))
        return db.collection(name)
      } },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: { collection: name => {
        assert.ok(["orders", "checkout_intents", "payments"].includes(name))
        const col = db.collection(name)
        return name === "orders" ? { insertOne: async (...args) => {
          if (failInsert) throw new Error("Injected order insertion failure")
          return col.insertOne(...args)
        } } : col
      } } }) },
    })
    const { quoteCoupon, consumeOrderCoupon } = loader.load("lib/order-pricing.ts")
    const { persistCheckoutOrder, CheckoutConflictError } = loader.load("lib/checkout-payment.ts")
    const items = [{ id: productId.toString(), quantity: 1, price: 999999 }]
    const expected = { code, name: "Fixture", discount: 5 }
    const persist = async (identity = userId, discount = 5) => {
      const orderId = `audit-coupon-order:${run}:${sequence++}`
      const intent = {
        _id: orderId, userId: identity, tokenHash: crypto.randomBytes(32).toString("hex"),
        fingerprint: "fixture", amount: 4500, currency: "INR", method: "razorpay",
        status: "verified", paymentId: orderId, expiresAt: new Date(Date.now() + 60000), createdAt: new Date(),
        _auditFixture: marker, run,
      }
      intentIds.push(orderId)
      await db.collection("checkout_intents").insertOne(intent)
      const order = { orderId, userId: identity, coupon: { ...expected, discount }, _auditFixture: marker, run }
      const operation = () => persistCheckoutOrder(order, intent, async session => {
        const result = await consumeOrderCoupon(items, order.coupon, identity, session)
        if (!result.ok) throw new CheckoutConflictError(result.error)
      })
      return { operation, orderId }
    }
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const own = { _auditFixture: marker, run }
    try {
      await db.collection("products").insertOne({ _id: productId, price: 50, stock: 20, active: true, ...own })
      await db.collection("software_products").insertOne({ _id: softwareId, price: 200, active: true, sku: `AUDIT-SKU-${run}`, ...own })
      await couponCol.insertOne({
        _id: couponId, code, name: "Fixture", active: true, type: "percentage", value: 10, applyScope: "all",
        usageCount: 0, usageLimit: 1, perCustomerLimit: 1, usageByUser: [], ...own,
      })
      const quoted = await quoteCoupon(items, code, userId)
      check("preview uses catalogue price instead of the forged client price", quoted.ok && quoted.coupon.discount === 5)
      const guest = await quoteCoupon(items, code, null)
      check("guest cannot bypass an account-bound cap", !guest.ok && guest.error.includes("Sign in"))
      const softwareQuote = await quoteCoupon([...items, { id: softwareId, quantity: 1 }], code, userId)
      check("legacy software and native hardware share the same quote", softwareQuote.ok && softwareQuote.coupon.discount === 25)
      const failed = await persist()
      failInsert = true
      await assert.rejects(failed.operation(), /Injected order/)
      check("order insertion failure rolls back coupon, payment and intent consumption",
        (await couponCol.findOne({ _id: couponId })).usageCount === 0 &&
        (await db.collection("checkout_intents").findOne({ _id: failed.orderId })).status === "verified" &&
        await db.collection("payments").countDocuments({ _id: failed.orderId }) === 0 &&
        await db.collection("orders").countDocuments(own) === 0)
      failInsert = false
      const attempts = await Promise.all([persist(), persist()])
      const results = await Promise.allSettled(attempts.map(attempt => attempt.operation()))
      const successIndex = results.findIndex(result => result.status === "fulfilled")
      check("two simultaneous checkouts cannot exceed the global or customer cap", results.filter(result => result.status === "fulfilled").length === 1 &&
        (await couponCol.findOne({ _id: couponId })).usageCount === 1)
      const winner = attempts[successIndex]
      const loser = attempts[1 - successIndex]
      check("winning order and its one customer usage record commit together",
        await db.collection("orders").countDocuments(own) === 1 &&
        (await couponCol.findOne({ _id: couponId })).usageByUser[0].count === 1 &&
        (await db.collection("checkout_intents").findOne({ _id: winner.orderId })).status === "consumed")
      check("losing payment proof remains unconsumed for reconciliation",
        (await db.collection("checkout_intents").findOne({ _id: loser.orderId })).status === "verified" &&
        await db.collection("payments").countDocuments({ _id: loser.orderId }) === 0)
      await assert.rejects(winner.operation(), /already been used/)
      check("retrying the same completed intent cannot consume coupon usage twice", (await couponCol.findOne({ _id: couponId })).usageCount === 1)
      await couponCol.updateOne({ _id: couponId }, { $set: { usageCount: 0, usageLimit: 0, perCustomerLimit: 2, usageByUser: [] } })
      const customerAttempts = await Promise.all(Array.from({ length: 3 }, () => persist()))
      const customerResults = await Promise.allSettled(customerAttempts.map(attempt => attempt.operation()))
      const customerCoupon = await couponCol.findOne({ _id: couponId })
      check("concurrent per-customer usage is not duplicated or lost", customerResults.filter(result => result.status === "fulfilled").length === 2 &&
        customerCoupon.usageCount === 2 && customerCoupon.usageByUser.length === 1 && customerCoupon.usageByUser[0].count === 2)
      await couponCol.updateOne({ _id: couponId }, { $set: { usageCount: 0, usageLimit: 1, perCustomerLimit: 0, usageByUser: [] } })
      const guestAttempts = await Promise.all([persist(null), persist(null)])
      const guestResults = await Promise.allSettled(guestAttempts.map(attempt => attempt.operation()))
      const guestCoupon = await couponCol.findOne({ _id: couponId })
      check("unrestricted guest coupons still enforce one shared global cap", guestResults.filter(result => result.status === "fulfilled").length === 1 &&
        guestCoupon.usageCount === 1 && guestCoupon.usageByUser.length === 0)
      await couponCol.updateOne({ _id: couponId }, { $set: { usageCount: 0, usageLimit: 0, value: 20 } })
      const changed = await persist(userId, 5)
      await assert.rejects(changed.operation(), /Coupon changed/)
      check("a changed discount aborts without consuming the payment or coupon",
        (await couponCol.findOne({ _id: couponId })).usageCount === 0 &&
        (await db.collection("checkout_intents").findOne({ _id: changed.orderId })).status === "verified")
      console.log(`${checks} isolated MongoDB coupon/order checks passed; zero live orders, customers or providers touched`)
    } finally {
      await db.collection("products").deleteOne({ _id: productId, ...own })
      await db.collection("software_products").deleteOne({ _id: softwareId, ...own })
      await couponCol.deleteOne({ _id: couponId, ...own })
      await db.collection("orders").deleteMany(own)
      await db.collection("checkout_intents").deleteMany({ _id: { $in: intentIds }, ...own })
      await db.collection("payments").deleteMany({ _id: { $in: intentIds } })
    }
  } else if (action === "verify-rate-limits") {
    const key = `audit-rate-limit:${crypto.randomUUID()}`
    const id = crypto.createHash("sha256").update(key).digest("hex")
    const collection = db.collection("rate_limits")
    const overrides = { "@/lib/db-service": { getCollection: async (name) => db.collection(name) } }
    const globals = { env: { NODE_ENV: "production", RATE_LIMIT_BACKEND: "mongodb" } }
    const first = sourceLoader(overrides, globals).load("lib/rate-limit-store.ts")
    const second = sourceLoader(overrides, globals).load("lib/rate-limit-store.ts")
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      const hits = await Promise.all(Array.from({ length: 50 }, (_, index) =>
        (index % 2 ? first : second).rateLimitHit(key, 10, 60000)))
      check("two independent instances enforce one shared concurrent limit", hits.filter(hit => !hit.limited).length === 10)
      const counter = await collection.findOne({ _id: id })
      check("all 50 concurrent hits are persisted atomically", counter?.count === 50)
      check("stored counter IDs hash the request key", counter?._id === id && !JSON.stringify(counter).includes(key))
      const ttl = (await collection.listIndexes().toArray()).find(index => index.name === "rate_limit_expiry")
      check("expiry index is a TTL index on resetAt", ttl?.expireAfterSeconds === 0 && ttl.key.resetAt === 1)
      check("the other instance can read the shared reset time", await second.rateLimitResetSeconds(key) > 0)
      check("reading reset time does not count a request", (await collection.findOne({ _id: id })).count === 50)
      await collection.updateOne({ _id: id }, { $set: { resetAt: new Date(0) } })
      const next = await second.rateLimitHit(key, 10, 60000)
      check("an expired window resets atomically without waiting for TTL deletion", !next.limited && next.remaining === 9)
      await first.rateLimitReset(key)
      check("reset deletes the shared counter across instances", await second.rateLimitResetSeconds(key) === 0 && await collection.countDocuments({ _id: id }) === 0)
      console.log(`${checks} isolated MongoDB rate-limit checks passed; zero application or provider writes`)
    } finally {
      await collection.deleteOne({ _id: id })
    }
  } else if (action === "verify-unsubscribe") {
    const userId = `audit-unsubscribe:${crypto.randomUUID()}`
    const profiles = db.collection("customer_profiles")
    const tokens = db.collection("customer_unsubscribe_tokens")
    const events = db.collection("customer_events")
    const service = sourceLoader({
      "@/lib/db-service": { getCollection: async name => db.collection(name) },
    }).load("lib/customer-profile.ts")
    const legacy = `fixture-legacy:${crypto.randomUUID()}`
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      await profiles.insertOne({
        userId, consent: { email: true, whatsapp: true, sms: true },
        unsubscribeTokenHash: service.hashUnsubscribeToken(legacy), _auditFixture: marker,
      })
      const issued = await Promise.all(Array.from({ length: 5 }, () => service.issueUnsubscribeToken(userId, "email")))
      check("concurrent issuance creates distinct hash-only verifiers", new Set(issued).size === 5 && await tokens.countDocuments({ userId }) === 5)
      const stored = await tokens.find({ userId }).toArray()
      check("no plaintext token is stored in token or profile records", issued.every(token => !JSON.stringify(stored).includes(token)) &&
        (await profiles.findOne({ userId })).unsubscribeTokenHash === service.hashUnsubscribeToken(legacy))
      for (const token of [issued[0], issued[4], legacy]) {
        await profiles.updateOne({ userId }, { $set: { "consent.email": true } })
        assert.equal(await service.unsubscribeByToken(token, "email"), true)
        const profile = await profiles.findOne({ userId })
        check("previously issued and legacy links still withdraw email only", !profile.consent.email && profile.consent.whatsapp && profile.consent.sms)
      }
      await assert.rejects(service.issueUnsubscribeToken(userId, "email"), /consent was withdrawn/)
      check("withdrawal blocks subsequent campaign token issuance", await tokens.countDocuments({ userId }) === 5)
      check("unknown token makes no consent change", !await service.unsubscribeByToken(`unknown:${crypto.randomUUID()}`, "all"))
      await profiles.deleteOne({ userId, _auditFixture: marker })
      check("a deleted profile cannot be changed through an old link", !await service.unsubscribeByToken(issued[0], "all"))
      console.log(`${checks} isolated MongoDB consent/unsubscribe checks passed; zero real profiles or messages touched`)
    } finally {
      await profiles.deleteOne({ userId, _auditFixture: marker })
      await tokens.deleteMany({ userId })
      await events.deleteMany({ userId })
    }
  } else if (action === "verify-order-ids") {
    const run = crypto.randomUUID()
    const counters = db.collection("counters")
    const filter = { _id: "order_number" }
    if (await counters.findOne(filter)) throw new Error("Order-ID verification requires an empty isolated counter; existing records will not be touched")
    const { generateOrderId } = sourceLoader({
      "@/lib/db-service": { getCollection: async name => {
        assert.equal(name, "counters")
        return { findOneAndUpdate: (query, pipeline, options) => counters.findOneAndUpdate(query, [
          ...pipeline,
          { $set: { _auditFixture: marker, run } },
        ], options) }
      } },
    }).load("lib/order-id.ts")
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    try {
      const firstWave = await Promise.all(Array.from({ length: 10 }, () => generateOrderId()))
      check("concurrent first orders initialize one counter at the documented start", firstWave.includes("SARAECOM-00100001") &&
        (await counters.findOne(filter)).seq === 100010)
      check("every initial order identifier is unique", new Set(firstWave).size === 10)
      const secondWave = await Promise.all(Array.from({ length: 40 }, () => generateOrderId()))
      check("fifty concurrent increments are persisted without loss", (await counters.findOne(filter)).seq === 100050)
      check("both waves have distinct identifiers in the existing display format", new Set([...firstWave, ...secondWave]).size === 50 &&
        secondWave.every(id => /^SARAECOM-\d{8}$/.test(id)))
      await counters.updateOne({ ...filter, run }, { $set: { seq: 555555 } })
      check("an existing production-shaped sequence is preserved and incremented", await generateOrderId() === "SARAECOM-00555556")
      console.log(`${checks} isolated MongoDB order-ID checks passed; zero orders or production records written`)
    } finally {
      await counters.deleteOne({ ...filter, _auditFixture: marker, run })
    }
  } else if (action === "verify-hero-slides") {
    const col = db.collection("hero_slides")
    if (await col.countDocuments({}) !== 0) throw new Error("Hero replacement verification requires an empty isolated collection; existing records will not be touched")
    const ids = [new ObjectId(), new ObjectId()]
    const image = "data:image/png;base64,AAAA"
    let failInsert = false
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const helpers = sourceLoader().load("lib/db-service.ts")
    const route = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "audit-fixture-admin" } }) },
      "@/lib/db-service": { ...helpers, getCollection: async name => { assert.equal(name, "hero_slides"); return col } },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: {
        collection: name => {
          assert.equal(name, "hero_slides")
          return {
            deleteMany: (query, options) => col.deleteMany(query, options),
            aggregate: (pipeline, options) => col.aggregate(pipeline, options),
            insertMany: (documents, options) => {
              if (failInsert) throw new Error("Intentional isolated slide insertion failure")
              return col.insertMany(documents, options)
            },
          }
        },
      } }) },
    }).load("app/api/hero-slides/route.ts")
    const request = (body, method = "POST") => new Request("https://fixture.invalid/api/hero-slides", {
      method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
    })
    const input = ids.map((id, index) => ({
      id: id.toString(), title: `Fixture ${index}`, subtitle: "", cta: "Shop", link: "/products", active: true,
      image: `/api/media/hero-slide/${id}?v=${image.length}`,
    })).reverse()
    try {
      await col.insertMany(ids.map((id, index) => ({
        _id: id, title: `Fixture ${index}`, subtitle: "", cta: "Shop", link: "/products", active: true,
        image, order: index, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), _auditFixture: marker,
      })))
      const original = JSON.stringify(await col.find({}).sort({ order: 1 }).toArray())
      failInsert = true
      const failed = await route.POST(request({ slides: input }))
      check("bulk insertion failure is an error rather than a success acknowledgement", failed.status === 500)
      check("real transaction restores every deleted slide after insert failure", JSON.stringify(await col.find({}).sort({ order: 1 }).toArray()) === original)
      failInsert = false
      const saved = await route.POST(request({ slides: input }))
      const savedBody = await saved.json()
      const stored = await col.find({}).sort({ order: 1 }).toArray()
      check("bulk replacement retains existing IDs and resolves the original image bytes", saved.status === 200 && stored.length === 2 && stored[0]._id.toString() === input[0].id && stored.every(slide => slide.image === image))
      check("bulk acknowledgements normalize IDs and never inline stored images", savedBody.slides[0].id === input[0].id && !Object.hasOwn(savedBody.slides[0], "_id") && savedBody.slides.every(slide => slide.image.startsWith("/api/media/hero-slide/")))
      const missing = await route.POST(request({ slides: [{ image: `/api/media/hero-slide/${new ObjectId()}` }] }))
      check("unresolved media refuses replacement without deleting stored images", missing.status === 422 && await col.countDocuments({}) === 2)
      const updated = await route.PUT(request({ id: input[0].id, active: false, createdAt: "attacker-date" }, "PUT"))
      const updatedDocument = await col.findOne({ _id: new ObjectId(input[0].id) })
      check("partial mutation preserves immutable metadata and media storage", updated.status === 200 && updatedDocument.active === false && updatedDocument.image === image && updatedDocument.createdAt instanceof Date)
      console.log(`${checks} isolated MongoDB hero-slide checks passed; zero live marketing-content writes`)
    } finally {
      await col.deleteMany({ _id: { $in: ids } })
    }
  } else if (action === "verify-lucky-draw") {
    const campaignId = new ObjectId().toString()
    const token = crypto.randomBytes(16).toString("hex")
    const campaigns = db.collection("lucky_draw_campaigns")
    const participants = db.collection("lucky_draw_participants")
    const winners = db.collection("lucky_draw_winners")
    let failInsert = false
    let failPrize = false
    let failMailRecord = false
    let mailFailure = false
    let sends = 0
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const loader = sourceLoader({
      "@/lib/rate-limit": { withRateLimit: handler => handler },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": { getCollection: async name => {
        if (name === "lucky_draw_campaigns") return {
          findOne: (query, options) => campaigns.findOne(query, options),
          updateOne: (query, update, options) => failPrize ? { modifiedCount: 0 } : campaigns.updateOne(query, update, options),
        }
        if (name === "lucky_draw_participants") return participants
        assert.equal(name, "lucky_draw_winners")
        return {
          find: (query, options) => winners.find(query, options),
          findOne: (query, options) => winners.findOne(query, options),
          findOneAndUpdate: (query, update, options) => winners.findOneAndUpdate(query, update, options),
          updateOne: (query, update, options) => {
            if (failMailRecord) throw new Error("Intentional isolated delivery-recording failure")
            return winners.updateOne(query, update, options)
          },
          insertOne: (document, options) => {
            if (failInsert) throw new Error("Intentional isolated winner insertion failure")
            return winners.insertOne(document, options)
          },
        }
      } },
      "@/lib/email": { sendEmail: async message => {
        sends++
        await new Promise(resolve => setTimeout(resolve, 10))
        return mailFailure ? { success: false, error: new Error("Isolated SMTP rejection") }
          : { success: true, result: { accepted: [message.to], rejected: [] } }
      } },
    })
    const draw = loader.load("app/api/lucky-draw/[token]/draw/route.ts")
    const notify = loader.load("app/api/lucky-draw/[token]/notify/route.ts")
    const publicState = loader.load("app/api/lucky-draw/[token]/route.ts")
    const request = (action, body) => new Request(`https://fixture.invalid/api/lucky-draw/${token}/${action}`, {
      method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
    })
    try {
      await campaigns.insertOne({ _id: campaignId, drawToken: token, status: "active", name: "Synthetic", store: "Synthetic", prizes: [{ name: "Fixture prize", icon: "fixture", quantity: 2 }], _auditFixture: marker })
      await participants.insertMany(Array.from({ length: 3 }, (_, index) => ({
        _id: new ObjectId().toString(), campaignId, name: `Fixture ${index}`,
        email: "fixture@example.invalid", phone: "0000000000", wonAt: null, _auditFixture: marker,
      })))
      failInsert = true
      check("winner insertion failure returns an error", (await draw.POST(request("draw", { requestId: crypto.randomUUID() }))).status === 500)
      check("real transaction rolls back participant and prize on insertion failure", await participants.countDocuments({ campaignId, wonAt: null }) === 3 && (await campaigns.findOne({ _id: campaignId })).prizes[0].quantity === 2 && await winners.countDocuments({ campaignId }) === 0)
      failInsert = false
      failPrize = true
      check("unavailable prize rolls back the participant reservation", (await draw.POST(request("draw", { requestId: crypto.randomUUID() }))).status === 409 && await participants.countDocuments({ campaignId, wonAt: null }) === 3)
      failPrize = false
      const requestId = crypto.randomUUID()
      const retried = await Promise.all([draw.POST(request("draw", { requestId })), draw.POST(request("draw", { requestId }))])
      const results = await Promise.all(retried.map(response => response.json()))
      check("concurrent retry resolves to one recorded winner", retried.every(response => response.status === 200) && results[0].winnerId === results[1].winnerId && await winners.countDocuments({ campaignId }) === 1)
      check("concurrent retry consumes exactly one participant and prize", await participants.countDocuments({ campaignId, wonAt: null }) === 2 && (await campaigns.findOne({ _id: campaignId })).prizes[0].quantity === 1)
      await campaigns.updateOne({ _id: campaignId }, { $set: { status: "paused" } })
      check("recorded draw can be retrieved after campaign pause", (await draw.POST(request("draw", { requestId }))).status === 200 && (await draw.POST(request("draw", { requestId: crypto.randomUUID() }))).status === 409)
      await campaigns.updateOne({ _id: campaignId }, { $set: { status: "active" } })
      const finalDraws = await Promise.all([draw.POST(request("draw", { requestId: crypto.randomUUID() })), draw.POST(request("draw", { requestId: crypto.randomUUID() }))])
      const storedWinners = await winners.find({ campaignId }).toArray()
      check("distinct concurrent draws cannot overdraw inventory or repeat winners", finalDraws.filter(response => response.status === 200).length === 1 && (await campaigns.findOne({ _id: campaignId })).prizes[0].quantity === 0 && storedWinners.length === 2 && new Set(storedWinners.map(winner => winner.participantId)).size === 2)
      const state = await publicState.GET(new Request("https://fixture.invalid"), { params: Promise.resolve({ token }) })
      const stateBody = await state.json()
      check("public draw state masks phones and excludes contact addresses", state.status === 200 && stateBody.winners.length === 2 && !JSON.stringify(stateBody).includes("fixture@example.invalid") && !JSON.stringify(stateBody).includes("0000000000"))
      const winnerId = storedWinners[0]._id
      const notifications = await Promise.all([notify.POST(request("notify", { winnerId })), notify.POST(request("notify", { winnerId }))])
      check("real atomic notification claim prevents concurrent duplicate sends", notifications.filter(response => response.status === 200).length === 1 && notifications.filter(response => response.status === 409).length === 1 && sends === 1 && (await winners.findOne({ _id: winnerId })).emailSent)
      check("a sent notification retry is idempotent", (await notify.POST(request("notify", { winnerId }))).status === 200 && sends === 1)
      mailFailure = true
      const uncertainId = storedWinners[1]._id
      const uncertain = await (await notify.POST(request("notify", { winnerId: uncertainId }))).json()
      check("failed provider acceptance is stored truthfully and not blindly resent", !uncertain.emailSent && !!uncertain.emailError && (await notify.POST(request("notify", { winnerId: uncertainId }))).status === 409 && sends === 2)
      const pendingId = new ObjectId().toString()
      await winners.insertOne({ ...storedWinners[1], _id: pendingId })
      mailFailure = false
      failMailRecord = true
      check("delivery recording failure leaves the real send claim blocked", (await notify.POST(request("notify", { winnerId: pendingId }))).status === 500 && (await notify.POST(request("notify", { winnerId: pendingId }))).status === 409 && sends === 3)
      console.log(`${checks} isolated MongoDB lucky-draw checks passed; SMTP mocked; zero real participants or messages touched`)
    } finally {
      await winners.deleteMany({ campaignId })
      await participants.deleteMany({ campaignId })
      await campaigns.deleteOne({ _id: campaignId, _auditFixture: marker })
    }
  } else if (action === "verify-scraper") {
    const sku = `audit-scraper:${crypto.randomUUID()}`
    const products = db.collection("products")
    const specs = db.collection("product_specifications")
    let failSpecs = false
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const route = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "audit-fixture-admin" } }) },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: {
        collection: name => {
          assert.ok(["products", "product_specifications"].includes(name))
          if (name === "products") return products
          return { updateOne: (query, update, options) => {
            assert.equal(query.sku, sku)
            if (failSpecs) throw new Error("Intentional isolated specification storage failure")
            return specs.updateOne(query, update, options)
          } }
        },
      } }) },
      axios: {
        get: async () => ({ status: 200, headers: {}, data: '<html><span id="productTitle">Synthetic audit television</span><div id="availability"><span>In stock</span></div></html>' }),
        isAxiosError: () => false,
      },
    }).load("app/api/scrape-amazon/route.ts")
    const request = extra => new Request("https://fixture.invalid/api/scrape-amazon", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://amazon.in/dp/B012345678", itemno: sku, saveToDatabase: true, ...extra }),
    })
    try {
      failSpecs = true
      const failedCreate = await route.POST(request())
      check("specification failure returns an error rather than a saved acknowledgement", failedCreate.status === 500 && !(await failedCreate.json()).success)
      check("failed creation rolls back the real product insert", await products.countDocuments({ sku }) === 0 && await specs.countDocuments({ sku }) === 0)
      failSpecs = false
      const created = await route.POST(request({ editedData: { price: 100, mrp: 200 } }))
      const createdBody = await created.json()
      const savedProduct = await products.findOne({ sku })
      const savedSpecs = await specs.findOne({ sku })
      check("successful creation commits both product and canonical specification", created.status === 200 && createdBody.action === "created" && !!savedProduct && !!savedSpecs)
      check("saved acknowledgement has a normalized matching product identifier", createdBody.product.id === savedProduct._id.toString() && !Object.hasOwn(createdBody.product, "_id") && savedSpecs.product_id === createdBody.product.id)
      const before = JSON.stringify(savedProduct)
      failSpecs = true
      const failedUpdate = await route.POST(request({ editedData: { name: "Should roll back" } }))
      check("failed enrichment rolls back the real product update", failedUpdate.status === 500 && JSON.stringify(await products.findOne({ sku })) === before)
      check("failed enrichment preserves the previously committed specification", JSON.stringify(await specs.findOne({ sku })) === JSON.stringify(savedSpecs))
      failSpecs = false
      const updated = await route.POST(request({ editedData: { name: "Committed enrichment" } }))
      const enriched = await products.findOne({ sku })
      check("successful enrichment preserves stored selling price and inventory", updated.status === 200 && enriched.name === "Committed enrichment" && enriched.price === savedProduct.price && enriched.stock === savedProduct.stock)
      check("successful enrichment synchronizes the corresponding specification", (await specs.findOne({ sku })).name === "Committed enrichment")
      console.log(`${checks} isolated MongoDB scraper checks passed; source HTTP mocked; zero live catalogue writes`)
    } finally {
      await products.deleteMany({ sku })
      await specs.deleteMany({ sku })
    }
  } else if (action === "verify-partner-checkout") {
    const partnerId = `audit-checkout:${crypto.randomUUID()}`
    const productId = new ObjectId()
    const secret = crypto.randomBytes(32).toString("hex")
    const products = db.collection("products")
    const payments = db.collection("partner_payments")
    const orders = db.collection("partner_orders")
    const providerOrders = new Map()
    let providerFailure = false
    let badAmount = false
    let insertFailure = false
    let releaseFailure = false
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const partner = { id: partnerId, name: "Fixture", tier: "starter", commissionRate: 0, razorpayIntegration: {
      enabled: true, defaultEnvironment: "test",
      credentials: {
        live: { keyId: "rzp_live_auditfixture", keySecretEnc: "fixture", keySecretIv: "fixture", keySecretTag: "fixture" },
        test: { keyId: "rzp_test_auditfixture", keySecretEnc: "fixture", keySecretIv: "fixture", keySecretTag: "fixture" },
      },
    } }
    const loader = sourceLoader({
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": { getCollection: async name => {
        assert.ok(["products", "partner_payments", "partner_orders"].includes(name), "Unexpected collection")
        const collection = db.collection(name)
        if (name === "products") return {
          findOne: (...args) => collection.findOne(...args),
          updateOne: async (...args) => {
            if (releaseFailure) throw new Error("Injected stock release failure")
            return collection.updateOne(...args)
          },
        }
        return name === "partner_orders" ? {
          findOne: (...args) => collection.findOne(...args),
          findOneAndUpdate: (...args) => collection.findOneAndUpdate(...args),
          insertOne: async (...args) => {
            if (insertFailure) throw new Error("Injected partner order failure")
            return collection.insertOne(...args)
          },
        } : collection
      } },
      "@/lib/order-id": { generateOrderId: async () => `AUDIT-${crypto.randomUUID()}` },
      "@/lib/encryption": { decrypt: () => secret },
      "@/lib/razorpay": { getRazorpayClient: credentials => {
        assert.ok(["rzp_live_auditfixture", "rzp_test_auditfixture"].includes(credentials.keyId))
        assert.equal(credentials.keySecret, secret)
        return {
          orders: {
            create: async input => {
              const order = { ...input, id: `order_${crypto.randomUUID().replace(/-/g, "")}`, status: "created" }
              providerOrders.set(order.id, order)
              return order
            },
            fetch: async id => {
              if (providerFailure) throw new Error("Injected provider outage")
              const order = providerOrders.get(id)
              assert.ok(order)
              return { ...order, status: "paid", amount_paid: order.amount }
            },
          },
          payments: { fetch: async id => {
            if (providerFailure) throw new Error("Injected provider outage")
            const orderId = `order_${id.slice(4)}`
            const order = providerOrders.get(orderId)
            assert.ok(order)
            return { id, order_id: orderId, status: "captured", amount: badAmount ? 1 : order.amount, currency: "INR", method: "upi", created_at: 1780000000 }
          } },
        }
      } },
    })
    const paymentService = loader.load("lib/partner/payments.ts")
    const orderService = loader.load("lib/partner/orders.ts")
    const items = [{ productId: productId.toString(), quantity: 2 }]
    const customer = { name: "Fixture", email: "fixture@example.invalid", phone: "9876543210", address: { line1: "Fixture", city: "Mumbai", state: "Maharashtra", pincode: "400001", country: "India" } }
    const create = environment => paymentService.createPartnerPayment(partner, environment, { items, orderId: crypto.randomUUID(), currency: "INR", amount: 1 })
    const proofFor = created => {
      const paymentId = `pay_${created.razorpayOrderId.slice(6)}`
      return {
        razorpay_order_id: created.razorpayOrderId, razorpay_payment_id: paymentId,
        razorpay_signature: crypto.createHmac("sha256", secret).update(`${created.razorpayOrderId}|${paymentId}`).digest("hex"),
      }
    }
    const inputFor = proof => ({
      items, customer, paymentMethod: "prepaid",
      paymentDetails: { razorpayOrderId: proof.razorpay_order_id, transactionId: proof.razorpay_payment_id, amount: 1 },
    })
    const stock = async () => (await products.findOne({ _id: productId })).stock
    try {
      await products.insertOne({ _id: productId, name: "Fixture", sku: "AUDIT", active: true, stock: 10, price: 100, _auditFixture: marker })
      const created = await create("live")
      const proof = proofFor(created)
      check("real stored initiation uses server price rather than client amount", created.amount === 23600 && (await payments.findOne({ partnerId })).amount === 236)
      providerFailure = true
      await assert.rejects(paymentService.verifyPartnerPayment(partner, "live", proof), /provider outage/)
      check("provider outage leaves initiation unpaid", (await payments.findOne({ partnerId })).status === "created")
      providerFailure = false
      badAmount = true
      await assert.rejects(paymentService.verifyPartnerPayment(partner, "live", proof), /does not match/)
      check("underpayment cannot be promoted", (await payments.findOne({ partnerId })).status === "created")
      badAmount = false
      await assert.rejects(paymentService.verifyPartnerPayment({ ...partner, id: "other-audit-partner" }, "live", proof), /not found/)
      await assert.rejects(paymentService.verifyPartnerPayment(partner, "test", proof), /not found/)
      check("partner and environment ownership checks leave initiation unchanged", (await payments.findOne({ partnerId })).status === "created")
      await assert.rejects(paymentService.verifyPartnerPayment(partner, "live", { ...proof, razorpay_signature: "0".repeat(64) }), /signature/)
      check("invalid signature cannot be promoted", (await payments.findOne({ partnerId })).status === "created")
      await paymentService.verifyPartnerPayment(partner, "live", proof)
      await paymentService.verifyPartnerPayment(partner, "live", proof)
      check("repeat captured verification retains one bound payment", await payments.countDocuments({ partnerId, status: "paid" }) === 1)
      insertFailure = true
      await assert.rejects(orderService.createPartnerOrder(partner, inputFor(proof), "live"), /Injected partner order failure/)
      check("failed insertion rolls back stock and payment consumption", await stock() === 10 && !(await payments.findOne({ partnerId })).consumedOrderId && await orders.countDocuments({ partnerId }) === 0)
      insertFailure = false
      const results = await Promise.all([1, 2].map(() => orderService.createPartnerOrder(partner, inputFor(proof), "live")))
      check("concurrent replay commits one order and one stock reservation", results.filter(result => result.success).length === 1 && await stock() === 8 && await orders.countDocuments({ partnerId }) === 1)
      const storedOrder = await orders.findOne({ partnerId })
      check("committed order and consumed payment agree on authoritative money and identity", storedOrder.paymentDetails.amount === 236 && storedOrder.paymentVerification.verified && (await payments.findOne({ partnerId })).consumedOrderId === storedOrder.orderId)
      const changed = await create("live")
      const changedProof = proofFor(changed)
      await paymentService.verifyPartnerPayment(partner, "live", changedProof)
      await products.updateOne({ _id: productId }, { $set: { price: 200 } })
      check("changed catalogue price rejects prior payment without consuming it", !(await orderService.createPartnerOrder(partner, inputFor(changedProof), "live")).success &&
        !(await payments.findOne({ partnerId, razorpayOrderId: changed.razorpayOrderId })).consumedOrderId && await stock() === 8)
      await products.updateOne({ _id: productId }, { $set: { price: 100 } })
      const testCreated = await create("test")
      const testProof = proofFor(testCreated)
      await paymentService.verifyPartnerPayment(partner, "test", testProof)
      const testResult = await orderService.createPartnerOrder(partner, inputFor(testProof), "test")
      check("test checkout consumes only its proof without stock or fulfillment writes", testResult.success && testResult.testMode && await stock() === 8 && await orders.countDocuments({ partnerId }) === 1)
      const testReplay = await orderService.createPartnerOrder(partner, inputFor(testProof), "test")
      check("test payment proof is single-use too", !testReplay.success && await stock() === 8)
      releaseFailure = true
      await assert.rejects(orderService.cancelPartnerOrder(partnerId, storedOrder.orderId, "live"), /Injected stock release/)
      check("failed stock release rolls back cancellation status", (await orders.findOne({ partnerId })).status === "pending" && await stock() === 8)
      releaseFailure = false
      const cancellations = await Promise.all([1, 2].map(() => orderService.cancelPartnerOrder(partnerId, storedOrder.orderId, "live")))
      check("concurrent cancellation restores stock once without refunding or recycling payment", cancellations.filter(result => result.success).length === 1 &&
        await stock() === 10 && (await payments.findOne({ partnerId, razorpayOrderId: created.razorpayOrderId })).consumedOrderId === storedOrder.orderId)
      console.log(`${checks} isolated MongoDB partner checkout checks passed; zero production or real provider writes`)
    } finally {
      await products.deleteOne({ _id: productId, _auditFixture: marker })
      await payments.deleteMany({ partnerId })
      await orders.deleteMany({ partnerId })
    }
  } else if (action === "verify-wallet") {
    const partnerId = `audit-wallet:${crypto.randomUUID()}`
    const walletId = new ObjectId()
    const wallets = db.collection("partner_wallets")
    const payouts = db.collection("partner_payouts")
    const transactions = db.collection("wallet_transactions")
    let failLedger = false
    let failPayout = false
    const service = sourceLoader({
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": { getCollection: async name => {
        const collection = db.collection(name)
        if (name === "wallet_transactions") return {
          insertOne: async (...args) => {
            if (failLedger) throw new Error("Injected ledger failure")
            return collection.insertOne(...args)
          },
        }
        if (name === "partner_payouts") return {
          findOneAndUpdate: (...args) => collection.findOneAndUpdate(...args),
          insertOne: async (...args) => {
            if (failPayout) throw new Error("Injected payout failure")
            return collection.insertOne(...args)
          },
        }
        return collection
      } },
    }).load("lib/partner/wallet.ts")
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const available = async () => (await wallets.findOne({ _id: walletId })).balance.available
    try {
      await wallets.insertOne({
        _id: walletId, id: walletId.toString(), partnerId, minimumPayout: 100,
        balance: { available: 1500, pending: 200, held: 0 },
        bankAccounts: [{ id: "fixture-bank", bankName: "Fixture", accountNumber: "0000000000", ifsc: "FIXT0000001" }],
        _auditFixture: marker,
      })
      const requests = await Promise.allSettled([1, 2].map(() =>
        service.createPayoutRequest(partnerId, walletId.toString(), 1000, "fixture-bank")))
      check("concurrent requests reserve funds once without overdrawing", requests.filter(result => result.status === "fulfilled").length === 1 && await available() === 500)
      const payout = await payouts.findOne({ partnerId })
      check("reservation has exactly one payout and matching debit", await payouts.countDocuments({ partnerId }) === 1 &&
        await transactions.countDocuments({ partnerId, type: "debit", amount: 1000, balanceAfter: 500 }) === 1)
      failLedger = true
      await assert.rejects(service.rejectPayout(payout.id, "fixture-admin", "Fixture"), /Injected ledger/)
      check("failed rejection rolls back refund and status", await available() === 500 &&
        (await payouts.findOne({ partnerId })).status === "pending_approval")
      failLedger = false
      const rejections = await Promise.allSettled([1, 2].map(() => service.rejectPayout(payout.id, "fixture-admin", "Fixture")))
      check("concurrent rejection refunds only once", rejections.filter(result => result.status === "fulfilled").length === 1 && await available() === 1500)
      check("refund is recorded once with its exact resulting balance", await transactions.countDocuments({ partnerId, type: "credit", category: "payout", balanceAfter: 1700 }) === 1)
      for (const stage of ["payout", "ledger"]) {
        failPayout = stage === "payout"
        failLedger = stage === "ledger"
        await assert.rejects(service.createPayoutRequest(partnerId, walletId.toString(), 1000, "fixture-bank"), /Injected/)
        check(`failed ${stage} write rolls back the entire request`, await available() === 1500 &&
          await payouts.countDocuments({ partnerId }) === 1 && await transactions.countDocuments({ partnerId }) === 2)
      }
      failLedger = false
      failPayout = false
      const credits = await Promise.all(Array.from({ length: 8 }, () =>
        service.createTransaction(walletId.toString(), partnerId, "credit", "bonus", 10, "Fixture")))
      check("concurrent credits are not lost and ledger balances reflect each update", await available() === 1580 &&
        new Set(credits.map(entry => entry.balanceAfter)).size === 8)
      await assert.rejects(service.releasePendingBalance(walletId.toString(), partnerId, 201, "fixture-order"), /insufficient/)
      check("pending transfer cannot overdraw pending funds", (await wallets.findOne({ _id: walletId })).balance.pending === 200)
      failLedger = true
      await assert.rejects(service.releasePendingBalance(walletId.toString(), partnerId, 200, "fixture-order"), /Injected ledger/)
      check("failed pending-release ledger rolls back both balance buckets", await available() === 1580 &&
        (await wallets.findOne({ _id: walletId })).balance.pending === 200)
      failLedger = false
      await service.releasePendingBalance(walletId.toString(), partnerId, 200, "fixture-order")
      check("pending release preserves total funds and its existing zero-amount ledger contract", await available() === 1780 &&
        (await wallets.findOne({ _id: walletId })).balance.pending === 0 &&
        await transactions.countDocuments({ partnerId, orderId: "fixture-order", amount: 0, balanceAfter: 1780 }) === 1)
      await assert.rejects(service.createTransaction(walletId.toString(), "other-partner", "credit", "bonus", 10, "Fixture"), /Wallet not found/)
      check("wallet writes reject mismatched partner identity", await available() === 1780)
      console.log(`${checks} isolated MongoDB wallet accounting checks passed; zero production or provider writes`)
    } finally {
      await wallets.deleteOne({ _id: walletId, partnerId })
      await payouts.deleteMany({ partnerId })
      await transactions.deleteMany({ partnerId })
    }
  } else {
    const run = crypto.randomUUID()
    const userId = new ObjectId().toString()
    const paymentIds = []
    const overrides = {
      "@/lib/mongodb": { connectToDatabase: async () => ({ client, db }) },
      "@/lib/db-service": { getCollection: async (name) => db.collection(name) },
      "@/lib/email": { sendEmail: async () => ({ success: true }) },
    }
    const loader = sourceLoader(overrides)
    const checkout = loader.load("lib/checkout-payment.ts")
    const fulfillment = loader.load("lib/software-fulfillment.ts")
    const external = loader.load("lib/external-fulfillment.ts")
    let checks = 0
    const check = (label, predicate) => { assert.ok(predicate, label); checks++; console.log("PASS:", label) }
    const insertIntent = async () => {
      const intent = {
        _id: `fixture_order_${crypto.randomUUID()}`, userId, tokenHash: "fixture", fingerprint: "fixture",
        amount: 10000, currency: "INR", method: "razorpay", status: "verified",
        paymentId: `fixture_payment_${crypto.randomUUID()}`, createdAt: new Date(), expiresAt: new Date(Date.now() + 60000),
        _auditFixture: marker, run,
      }
      paymentIds.push(intent.paymentId)
      await db.collection("checkout_intents").insertOne(intent)
      return intent
    }
    try {
      const intent = await insertIntent()
      const orders = [1, 2].map((number) => ({
        orderId: `FIXTURE-${run}-${number}`, userId, status: "confirmed", paymentVerification: { verified: true },
        _auditFixture: marker, run,
      }))
      const concurrent = await Promise.allSettled(orders.map((order) => checkout.persistCheckoutOrder(order, intent)))
      check("two concurrent submissions consume one payment exactly once", concurrent.filter((result) => result.status === "fulfilled").length === 1)
      check("only one corresponding order persists", await db.collection("orders").countDocuments({ run }) === 1)
      check("only one payment record persists", await db.collection("payments").countDocuments({ _id: intent.paymentId }) === 1)
      const rollbackIntent = await insertIntent()
      await assert.rejects(checkout.persistCheckoutOrder({ ...orders[0], orderId: `ROLLBACK-${run}` }, rollbackIntent, async () => {
        throw new Error("Injected ledger/database failure")
      }), /Injected ledger/)
      check("a failing ledger write rolls payment consumption back", (await db.collection("checkout_intents").findOne({ _id: rollbackIntent._id })).status === "verified")
      check("failed order transaction creates no payment record", await db.collection("payments").countDocuments({ _id: rollbackIntent.paymentId }) === 0)

      const softwareId = new ObjectId()
      const softwareItems = [{ id: softwareId.toString(), name: "Synthetic Software", type: "software", provider: null, quantity: 2 }]
      const softwareOrder = {
        _id: new ObjectId(), orderId: `SOFTWARE-${run}`, userId, status: "confirmed",
        paymentVerification: { verified: true }, items: softwareItems, customer: { email: "fixture@example.invalid", name: "Fixture" },
        _auditFixture: marker, run,
      }
      await db.collection("orders").insertOne(softwareOrder)
      await db.collection("license_keys").insertMany([1, 2].map((number) => ({
        softwareId, key: `fixture-${run}-${number}`, assigned: false, email: null, _auditFixture: marker, run,
      })))
      const assigned = await fulfillment.fulfillSoftwareOrder(softwareOrder._id.toString())
      check("paid software fulfillment assigns the exact stored quantity", assigned.licenseKeys.length === 2)
      await assert.rejects(fulfillment.fulfillSoftwareOrder(softwareOrder._id.toString()), /already fulfilled/)
      check("replaying fulfillment cannot consume more keys", await db.collection("license_keys").countDocuments({ run, assigned: true }) === 2)

      const shortageOrder = { ...softwareOrder, _id: new ObjectId(), orderId: `SHORTAGE-${run}`, items: [{ ...softwareItems[0], quantity: 2 }] }
      await db.collection("orders").insertOne(shortageOrder)
      const remaining = await db.collection("license_keys").insertOne({
        softwareId, key: `fixture-${run}-remaining`, assigned: false, email: null, _auditFixture: marker, run,
      })
      await assert.rejects(fulfillment.fulfillSoftwareOrder(shortageOrder._id.toString()), /Insufficient/)
      check("inventory shortage rolls back partial assignments", (await db.collection("license_keys").findOne({ _id: remaining.insertedId })).assigned === false)

      const externalOrder = {
        ...softwareOrder, _id: new ObjectId(), orderId: `EXTERNAL-${run}`,
        items: [{ ...softwareItems[0], quantity: 1, provider: "exlr8", kgenProductId: "synthetic-provider-product" }],
      }
      await db.collection("orders").insertOne(externalOrder)
      const queued = await Promise.allSettled([external.queueExternalOrder(externalOrder._id.toString()), external.queueExternalOrder(externalOrder._id.toString())])
      check("external queue creation is atomic and single-use", queued.filter((result) => result.status === "fulfilled").length === 1)
      check("external queue stores only the authoritative order items", (await db.collection("external_orders").findOne({ _id: `exlr8:${externalOrder._id}` })).items[0].kgenProductId === "synthetic-provider-product")
      await db.collection("external_orders").updateOne({ _id: `exlr8:${externalOrder._id}` }, { $set: { _auditFixture: marker, run } })
      console.log(`${checks} real MongoDB transaction checks passed; zero provider or email calls`)
    } finally {
      for (const name of ["orders", "checkout_intents", "license_keys", "software_licenses", "external_orders"]) {
        await db.collection(name).deleteMany({ _auditFixture: marker, run })
      }
      await db.collection("payments").deleteMany({ _id: { $in: paymentIds } })
    }
  }
} finally {
  await client.close()
}
