import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import { NextRequest } from "next/server.js"
import crypto from "node:crypto"
import { sourceLoader } from "./source-loader.mjs"
import { checkDeploymentEnvironment } from "../scripts/check-deployment-env.mjs"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

test("production preflight rejects missing, placeholder, insecure and mismatched settings without returning secret values", () => {
  const env = {
    MONGODB_URI: "mongodb+srv://synthetic:fixture@cluster.example.net/",
    SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
    CRON_SECRET: crypto.randomBytes(32).toString("hex"),
    NEXT_PUBLIC_SITE_URL: "https://fixture.example.net",
    NEXT_PUBLIC_APP_URL: "https://fixture.example.net",
    NEXTAUTH_URL: "https://fixture.example.net",
    DPDP_LEGAL_ENTITY: "Synthetic Entity", DPDP_REGISTERED_ADDRESS: "Synthetic registered address",
    DPDP_GRIEVANCE_OFFICER_NAME: "Synthetic Officer", DPDP_GRIEVANCE_OFFICER_EMAIL: "officer@fixture.example.net",
    RATE_LIMIT_BACKEND: "mongodb", ENABLE_DEBUG_ROUTES: "false",
    RAZORPAY_KEY_ID: "rzp_live_synthetic", RAZORPAY_KEY_SECRET: crypto.randomBytes(24).toString("hex"),
    SMTP_HOST: "smtp.fixture.example.net", SMTP_PORT: "587", SMTP_USER: "synthetic", SMTP_PASS: crypto.randomBytes(24).toString("hex"),
    EMAIL_FROM: "Synthetic <mail@fixture.example.net>",
    RECAPTCHA_SECRET_KEY: crypto.randomBytes(24).toString("hex"), NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "synthetic-site-key",
  }
  assert.deepEqual(checkDeploymentEnvironment(env), [])
  assert.deepEqual(checkDeploymentEnvironment({
    ...env, MONGODB_URI: "mongodb://synthetic:fixture@one.example.net:27017,two.example.net:27017/?tls=true&replicaSet=rs0",
  }), [])
  // A scoped partner allowlist and an acknowledged Cloudflare front both pass.
  assert.deepEqual(checkDeploymentEnvironment({
    ...env,
    PARTNER_ALLOWED_ORIGINS: "https://partner.example.net, *.partner.example.net",
    TRUST_CLOUDFLARE_IP: "true",
    CLOUDFLARE_PROXY_CONFIRMED: "locked to Cloudflare IP ranges",
  }), [])
  for (const change of [
    { SESSION_SECRET: "short" }, { CRON_SECRET: "<secret>" },
    { MONGODB_URI: "mongodb://host/" }, { MONGODB_URI: "mongodb+srv://synthetic:fixture@cluster.example.net/?tlsInsecure=true" },
    { NEXT_PUBLIC_APP_URL: "https://different.example.net" }, { NEXTAUTH_URL: "http://localhost:3000" },
    { ENABLE_DEBUG_ROUTES: "true" }, { RATE_LIMIT_BACKEND: "memory" },
    { RAZORPAY_KEY_ID: "rzp_test_fixture" }, { SMTP_PORT: "0" },
    { DPDP_GRIEVANCE_OFFICER_EMAIL: "invalid" },
    // Partner CORS reflects these origins with credentials attached.
    { PARTNER_ALLOWED_ORIGINS: "*" }, { PARTNER_ALLOWED_ORIGINS: "*.com" },
    { PARTNER_ALLOWED_ORIGINS: "http://partner.example.net" },
    { PARTNER_ALLOWED_ORIGINS: "https://partner.example.net/callback" },
    // Trusting a client-settable header hands out a fresh rate-limit bucket.
    { TRUST_CLOUDFLARE_IP: "yes" }, { TRUST_CLOUDFLARE_IP: "true" },
  ]) {
    const errors = checkDeploymentEnvironment({ ...env, ...change })
    assert.ok(errors.length > 0)
    for (const value of [env.SESSION_SECRET, env.SMTP_PASS, env.RAZORPAY_KEY_SECRET]) assert.equal(errors.join("\n").includes(value), false)
  }
})

test("Vercel upload exclusions protect environment files and customer dumps without excluding required runtime repair code", () => {
  const ignore = fs.readFileSync(new URL("../.vercelignore", import.meta.url), "utf8").split(/\r?\n/).filter(line => line && !line.startsWith("#"))
  for (const pattern of [".env", ".env.*", "*_dump.json", "*_debug_dump.json", "mobile/", "archive/", "documents/",
    "scripts/audit/", "scripts/archive/", "scripts/diagnostics/", "scripts/utilities/", "scripts/legacy/"]) assert.ok(ignore.includes(pattern))
  assert.equal(ignore.includes("scripts/"), false)
  assert.equal(ignore.includes("scripts/assign-missing-licenses.ts"), false)
  assert.equal(ignore.includes("public/"), false)
})

test("internal documents and seed fixtures stay outside the public asset tree while framework configs remain at the root", () => {
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = new URL(`${encodeURIComponent(entry.name)}${entry.isDirectory() ? "/" : ""}`, directory)
    return entry.isDirectory() ? walk(file) : [file]
  })
  const publicFiles = walk(new URL("../public/", import.meta.url))
  for (const file of publicFiles) {
    assert.equal(/\.(?:html?|md|mjs|cjs|ts|tsx|map|pem|key|p12|pfx)$/i.test(file.pathname), false, `Internal/source artifact in public: ${file.pathname}`)
    assert.equal(/\/\.env(?:[./]|$)/i.test(file.pathname), false, `Environment file in public: ${file.pathname}`)
  }
  assert.ok(fs.existsSync(new URL("../lib/seed-data/realistic-laptop-master-data.json", import.meta.url)))
  assert.equal(fs.existsSync(new URL("../public/data/realistic-laptop-master-data.json", import.meta.url)), false)
  for (const filename of ["next.config.mjs", "eslint.config.mjs", "postcss.config.mjs", "AGENTS.md", "CLAUDE.md"]) {
    assert.ok(fs.existsSync(new URL(`../${filename}`, import.meta.url)), `Required root file moved: ${filename}`)
  }
  for (const filename of ["marketing-campaign-guide.html", "marketing-poster-guide.html", "customer-journey.html"]) {
    assert.ok(fs.existsSync(new URL(`../documents/${filename}`, import.meta.url)))
  }
})

test("relocated archives stay outside the application build and private probes retain their exclusions", async () => {
  const ts = (await import("typescript")).default
  const configPath = new URL("../tsconfig.json", import.meta.url)
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
  assert.ok(config.exclude.includes("documents/archive"))
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, fileURLToPath(new URL("../", import.meta.url)))
  assert.deepEqual(parsed.errors, [])
  assert.ok(parsed.fileNames.some(filename => /[/\\]app[/\\]page\.tsx$/.test(filename)))
  assert.equal(parsed.fileNames.some(filename => /[/\\]documents[/\\]archive[/\\]/.test(filename)), false)
  assert.ok(fs.existsSync(new URL("../documents/archive/ui/about-page.previous.tsx", import.meta.url)))
  assert.equal(fs.existsSync(new URL("../archive/", import.meta.url)), false)
  const read = filename => fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8")
  for (const filename of ["scripts/set-brand-logo.mjs", "scripts/set-store-identity.mjs"]) {
    assert.ok(read(filename).includes('path.resolve("documents", "archive", "branding")'))
  }
  for (const filename of ["scripts/make-test-pdf.mjs", "scripts/test-pdf-scraper.mjs"]) {
    assert.ok(read(filename).includes('path.join(process.cwd(), "documents", "private-artifacts", "archive", "scrape-probe", "pdfs")'))
  }
  assert.ok(read(".gitignore").split(/\r?\n/).includes("/scripts/archive/"))
  assert.ok(read(".vercelignore").split(/\r?\n/).includes("scripts/archive/"))
  assert.ok(read("scripts/make-archive.ps1").includes("$rel.StartsWith('scripts\\archive\\', [System.StringComparison]::OrdinalIgnoreCase)"))
  assert.ok(read(".gitignore").split(/\r?\n/).includes("/documents/private-artifacts/"))
  assert.ok(read("scripts/make-archive.ps1").includes("$rel.StartsWith('documents\\private-artifacts\\', [System.StringComparison]::OrdinalIgnoreCase)"))
  assert.ok(read("scripts/utilities/generate-document-index.mjs").includes('entry.name === "private-artifacts" ? []'))
})

test("customer responses reject malformed statistics instead of fabricating an empty or zero-spend success", () => {
  const { AdminCustomersResponseSchema, CustomerOrderSummaryListSchema } = sourceLoader().load("lib/validation.ts")
  const customer = { id: "fixture", name: "Synthetic", email: "fixture@example.invalid", createdAt: "2026-01-01", phone: null, address: null }
  assert.equal(AdminCustomersResponseSchema.parse({ items: [customer], total: 20 }).total, 20)
  assert.equal(AdminCustomersResponseSchema.parse([customer]).total, 1)
  assert.equal(AdminCustomersResponseSchema.safeParse({ error: "Database unavailable" }).success, false)
  assert.equal(CustomerOrderSummaryListSchema.safeParse([{ id: "fixture", total: "unknown", status: "pending", createdAt: "2026-01-01" }]).success, false)
})

test("unsupported legacy localStorage migration is authenticated, development-only and never reports a false import", async () => {
  let allowed = false
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } : { ok: false, response: new Response(null, { status: 401 }) } },
  }, { env: { NODE_ENV: "development" } })
  const route = loader.load("app/api/migrate/route.ts")
  const request = new Request("https://fixture.invalid/migrate", { method: "POST", body: JSON.stringify({ products: [] }) })
  assert.equal((await route.POST(request)).status, 401)
  allowed = true
  const response = await route.POST(request)
  assert.equal(response.status, 410)
  assert.match((await response.json()).error, /No data was imported/)
  loader.env.NODE_ENV = "production"
  assert.equal((await route.POST(request)).status, 404)
})

test("development direct product updater uses the shared database, preserves native IDs and updates exactly one fallback match", async () => {
  const nativeId = new ObjectId()
  const docs = [{ _id: nativeId, id: "legacy-alias", name: "Synthetic original" }, { _id: "fixture-string", name: "Synthetic string" }]
  let writes = 0
  let allowed = true
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } : { ok: false, response: new Response(null, { status: 401 }) } },
    "@/lib/db-service": {
      COLLECTIONS: { PRODUCTS: "products" },
      normalizeId: doc => { const { _id, id, ...rest } = doc; return { ...rest, id: _id.toString() } },
      getCollection: async name => {
        assert.equal(name, "products")
        const match = (doc, query) => Object.entries(query).every(([key, value]) => {
          if (key === "_id" && typeof value !== typeof doc._id) return false
          return doc[key]?.toString() === value.toString()
        })
        return {
          findOne: async query => docs.find(doc => match(doc, query)) || null,
          updateOne: async (query, update) => {
            writes++
            const doc = docs.find(doc => match(doc, query))
            if (doc) Object.assign(doc, update.$set)
            return { acknowledged: true, matchedCount: doc ? 1 : 0 }
          },
        }
      },
    },
  }, { env: { NODE_ENV: "development" } })
  const route = loader.load("app/api/direct-update/[id]/route.ts")
  const req = body => new Request("https://fixture.invalid/direct-update", { method: "PUT", body: JSON.stringify(body) })
  for (const id of ["legacy-alias", "fixture-string"]) {
    const response = await route.PUT(req({ stock: 4 }), { params: Promise.resolve({ id }) })
    assert.equal(response.status, 200)
    const product = (await response.json()).product
    assert.equal(product.id, id === "legacy-alias" ? nativeId.toString() : id)
    assert.equal(product.stock, 4)
  }
  assert.equal(writes, 2)
  for (const body of [{ price: -1 }, { stock: 1.5 }, { _id: "replacement" }, null]) {
    assert.equal((await route.PUT(req(body), { params: Promise.resolve({ id: "fixture-string" }) })).status, 400)
  }
  allowed = false
  assert.equal((await route.PUT(req({ stock: 1 }), { params: Promise.resolve({ id: "fixture-string" }) })).status, 401)
  loader.env.NODE_ENV = "production"
  assert.equal((await route.PUT(req({ stock: 1 }), { params: Promise.resolve({ id: "fixture-string" }) })).status, 404)
  assert.equal(writes, 2)
})

test("development catalogue seed defaults to preview and atomically rolls back a failed replacement using a local validated file", async () => {
  const categories = []
  const products = [{ source: "excel", name: "Existing seed" }, { source: "manual", name: "Preserved manual" }]
  let writes = 0
  let fail = false
  const rows = [{ "Item No.": "FIX-1", "Item Description": "Synthetic item", "Group Name": "Synthetic category", "In Stock": 2 }]
  const session = {
    endSession: async () => {},
    withTransaction: async callback => {
      const snapshot = { categories: [...categories], products: [...products] }
      try { return await callback() }
      catch (error) { categories.splice(0, categories.length, ...snapshot.categories); products.splice(0, products.length, ...snapshot.products); throw error }
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true }) },
    "node:fs/promises": { readFile: async filename => {
      assert.match(filename, /[/\\]lib[/\\]seed-data[/\\]realistic-laptop-master-data\.json$/)
      return JSON.stringify(rows)
    } },
    "@/lib/mongodb": { connectToDatabase: async () => ({
      client: { startSession: () => session },
      db: { collection: name => ({
        find: (query, options) => {
          assert.equal(options.session, session)
          return { toArray: async () => categories.filter(doc => query.name ? query.name.$in.includes(doc.name) : query._id.$in.some(id => doc._id.equals(id))) }
        },
        insertMany: async (docs, options) => {
          assert.equal(options.session, session)
          writes++
          const target = name === "categories" ? categories : products
          docs.forEach(doc => { doc._id = new ObjectId(); target.push(doc) })
          if (fail && name === "products") throw new Error("Injected replacement failure")
          return { insertedCount: docs.length, insertedIds: Object.fromEntries(docs.map((doc, index) => [index, doc._id])) }
        },
        deleteMany: async (query, options) => {
          assert.equal(options.session, session)
          assert.deepEqual(query.source, "excel")
          writes++
          const removed = products.filter(doc => doc.source === query.source).length
          for (let index = products.length - 1; index >= 0; index--) if (products[index].source === query.source) products.splice(index, 1)
          return { acknowledged: true, deletedCount: removed }
        },
      }) },
    }) },
  }, { env: { NODE_ENV: "development" } })
  const route = loader.load("app/api/seed-database/route.ts")
  const req = body => new Request("https://untrusted.invalid/seed", { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) })
  const preview = await route.POST(req())
  assert.equal(preview.status, 200)
  assert.equal((await preview.json()).dryRun, true)
  assert.equal(writes, 0)
  assert.equal((await route.POST(req({ apply: "true" }))).status, 400)
  fail = true
  assert.equal((await route.POST(req({ apply: true }))).status, 500)
  assert.equal(categories.length, 0)
  assert.equal(products.length, 2)
  fail = false
  const response = await route.POST(req({ apply: true }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).products.inserted, 1)
  assert.equal(products.length, 2)
  assert.ok(products.some(doc => doc.source === "manual"))
  assert.ok(products.some(doc => doc.source === "excel" && doc.stock === 2))
  loader.env.NODE_ENV = "production"
  assert.equal((await route.POST(req({ apply: true }))).status, 404)
})

test("order ID backfill previews by default, reserves above existing IDs/counter and rolls back a conflicted batch", async () => {
  const orders = [
    { _id: new ObjectId(), orderId: "SARAECOM-00150001" },
    { _id: new ObjectId(), createdAt: new Date("2026-01-02") },
  ]
  const partner = [{ _id: "legacy-string", createdAt: new Date("2026-01-01") }]
  let counter = { _id: "order_number", seq: 160000 }
  let conflict = false
  let writes = 0
  const session = {
    endSession: async () => {},
    withTransaction: async callback => {
      const snapshot = { counter: { ...counter }, orders: orders.map(doc => ({ ...doc })), partner: partner.map(doc => ({ ...doc })) }
      try { return await callback() }
      catch (error) {
        counter = snapshot.counter
        orders.splice(0, orders.length, ...snapshot.orders)
        partner.splice(0, partner.length, ...snapshot.partner)
        throw error
      }
    },
  }
  const db = { collection: name => {
    if (name === "counters") return {
      findOne: async () => ({ ...counter }),
      findOneAndUpdate: async (query, update, options) => {
        assert.equal(options.session, session)
        const add = update[0].$set.seq.$add
        counter.seq = Math.max(counter.seq, add[0].$max[1]) + add[1]
        writes++
        return { ...counter }
      },
    }
    const docs = name === "orders" ? orders : partner
    return {
      find: query => ({ toArray: async () => docs.filter(doc => query.orderId.$regex ? doc.orderId?.startsWith("SARAECOM-") : !Object.hasOwn(doc, "orderId")) }),
      updateOne: async (query, update, options) => {
        assert.equal(options.session, session)
        assert.equal(query.orderId.$exists, false)
        writes++
        if (conflict) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 }
        const doc = docs.find(doc => doc._id.toString() === query._id.toString() && !Object.hasOwn(doc, "orderId"))
        Object.assign(doc, update.$set)
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
      },
    }
  } }
  const { backfillOrderIds } = sourceLoader({}, { context: { Date } }).load("scripts/backfill-order-ids.ts")
  const client = { startSession: () => session }
  const preview = await backfillOrderIds(client, db)
  assert.equal(preview.dryRun, true)
  assert.equal(preview.candidates, 2)
  assert.equal(preview.minimumNextSequence, 160001)
  assert.equal(writes, 0)
  conflict = true
  await assert.rejects(backfillOrderIds(client, db, true), /rolled back/)
  assert.equal(counter.seq, 160000)
  assert.equal(partner[0].orderId, undefined)
  conflict = false
  const applied = await backfillOrderIds(client, db, true)
  assert.equal(applied.updated, 2)
  assert.equal(counter.seq, 160002)
  assert.equal(partner[0].orderId, "SARAECOM-00160001")
  assert.equal(orders[1].orderId, "SARAECOM-00160002")
  assert.equal(orders[0].orderId, "SARAECOM-00150001")
})

function complaintFixture({ privacy = false, accepted = true, officer = "officer@example.invalid" } = {}) {
  const docs = []
  const mail = []
  let stale = false
  let authorized = true
  const loader = sourceLoader({
    "@/lib/auth": {
      getSession: async () => ({ user: { id: "fixture-account" } }),
      requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: new Response(null, { status: 401 }) },
    },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/dpdp-config": { dpdpConfig: { legalEntity: "Synthetic & Company", grievanceSlaDays: 30, grievanceOfficer: { email: officer } } },
    "@/lib/email": { sendEmail: async input => {
      mail.push(input)
      return { success: accepted, result: { accepted: accepted ? [input.to] : [], rejected: accepted ? [] : [input.to] } }
    } },
    "@/lib/db-service": {
      createObjectId: id => new ObjectId(id),
      normalizeId: doc => { const { _id, ...rest } = doc; return { ...rest, id: _id.toString() } },
      getCollection: async name => {
        assert.equal(name, "complaints")
        return {
          insertOne: async doc => { doc._id = new ObjectId(); docs.push(doc); return { acknowledged: true, insertedId: doc._id } },
          findOne: async query => {
            const doc = docs.find(doc => doc._id.equals(query._id))
            return doc ? { ...doc, timeline: [...doc.timeline] } : null
          },
          updateOne: async (query, update) => {
            const doc = docs.find(doc => doc._id.equals(query._id))
            assert.ok(Object.hasOwn(query, "updatedAt"))
            assert.equal(Object.hasOwn(update.$set, "timeline"), false)
            assert.equal(update.$push.timeline.$position, 0)
            if (stale) return { acknowledged: true, matchedCount: 0 }
            Object.assign(doc, update.$set)
            doc.timeline.unshift(...update.$push.timeline.$each)
            return { acknowledged: true, matchedCount: 1 }
          },
        }
      },
    },
  })
  const body = {
    customerName: "<img src=x onerror=alert(1)>", email: "customer@example.invalid",
    complaintType: privacy ? "data_erasure" : "enquiry", subject: "<script>fixture</script>",
    description: "<b>Details & text</b>",
    ...(!privacy ? { phone: "9876543210", orderNumber: "ORDER-fixture", productName: "Synthetic item" } : {}),
  }
  const request = body => new Request("https://fixture.invalid/complaints", { method: "POST", body: JSON.stringify(body) })
  return {
    loader, docs, mail, body, request,
    setStale: value => { stale = value }, setAuthorized: value => { authorized = value },
  }
}

test("complaint confirmation sends directly with escaped HTML and an accepted-recipient acknowledgement", async () => {
  const fixture = complaintFixture()
  const route = fixture.loader.load("app/api/complaints/route.ts")
  const response = await route.POST(fixture.request(fixture.body))
  assert.equal(response.status, 201)
  const data = await response.json()
  assert.equal(data.notification.status, "sent")
  assert.equal(fixture.docs.length, 1)
  assert.equal(fixture.mail.length, 1)
  assert.ok(fixture.mail[0].html.includes("&lt;img"))
  assert.ok(fixture.mail[0].html.includes("&lt;script&gt;"))
  assert.equal(fixture.mail[0].html.includes("<script>"), false)
  assert.equal(fixture.docs[0].userId, "fixture-account")
})

test("complaint mail failures preserve the stored complaint and report failure instead of claiming delivery", async () => {
  const fixture = complaintFixture({ accepted: false })
  const route = fixture.loader.load("app/api/complaints/route.ts")
  const response = await route.POST(fixture.request(fixture.body))
  assert.equal(response.status, 201)
  assert.equal((await response.json()).notification.status, "failed")
  assert.equal(fixture.docs.length, 1)
})

test("privacy grievances need no order or product and both officer/customer notification outcomes are checked", async () => {
  for (const accepted of [true, false]) {
    const fixture = complaintFixture({ privacy: true, accepted })
    const route = fixture.loader.load("app/api/complaints/route.ts")
    const response = await route.POST(fixture.request(fixture.body))
    assert.equal(response.status, 201)
    assert.equal((await response.json()).notification.status, accepted ? "sent" : "failed")
    assert.equal(fixture.docs[0].isDpdpGrievance, true)
    assert.ok(fixture.docs[0].slaDueBy)
    assert.equal(fixture.mail.length, 2)
    for (const mail of fixture.mail) assert.equal(mail.html.includes("<img"), false)
    assert.ok(fixture.mail[0].html.includes("&lt;b&gt;Details &amp; text&lt;/b&gt;"))
    assert.ok(fixture.mail[1].html.includes("Synthetic &amp; Company"))
  }
  const fixture = complaintFixture({ privacy: true, officer: "[Not configured]" })
  const response = await fixture.loader.load("app/api/complaints/route.ts").POST(fixture.request(fixture.body))
  assert.equal((await response.json()).notification.status, "not_configured")
  assert.equal(fixture.mail.length, 0)
  assert.equal(fixture.docs.length, 1)
})

test("complaint validation rejects unknown types, non-string fields, unsafe images and oversized combined payloads before writing", async () => {
  const fixture = complaintFixture()
  const route = fixture.loader.load("app/api/complaints/route.ts")
  for (const body of [
    { ...fixture.body, email: "invalid" },
    { ...fixture.body, complaintType: "unknown" },
    { ...fixture.body, customerName: { name: "fixture" } },
    { ...fixture.body, complaintType: "defective" },
    { ...fixture.body, images: ["data:image/svg+xml;base64,PHN2Zz4="] },
    { ...fixture.body, images: Array(5).fill("data:image/png;base64," + "A".repeat(3 * 1024 * 1024)) },
  ]) assert.equal((await route.POST(fixture.request(body))).status, 400)
  assert.equal((await route.POST(new Request("https://fixture.invalid/complaints", { method: "POST", body: "{" }))).status, 400)
  assert.equal(fixture.docs.length, 0)
  assert.equal(fixture.mail.length, 0)
})

test("complaint status writes use CAS and atomic timeline entries and never send mail for a rejected update", async () => {
  const fixture = complaintFixture()
  await fixture.loader.load("app/api/complaints/route.ts").POST(fixture.request(fixture.body))
  const route = fixture.loader.load("app/api/complaints/[id]/route.ts")
  const context = { params: Promise.resolve({ id: fixture.docs[0]._id.toString() }) }
  assert.equal((await route.PUT(fixture.request({ status: "invented" }), context)).status, 400)
  fixture.setStale(true)
  assert.equal((await route.PUT(fixture.request({ status: "processing" }), context)).status, 409)
  assert.equal(fixture.mail.length, 1)
  fixture.setStale(false)
  const response = await route.PUT(fixture.request({ status: "processing", adminNote: "<b>Note</b>" }), context)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).notification.status, "sent")
  assert.equal(fixture.docs[0].timeline.length, 2)
  assert.equal(fixture.docs[0].timeline[0].status, "Processing")
  assert.ok(fixture.mail[1].html.includes("&lt;b&gt;Note&lt;/b&gt;"))
  fixture.setAuthorized(false)
  assert.equal((await route.PUT(fixture.request({ status: "resolved" }), context)).status, 401)
})

test("complaint email API remains admin-only and validates templates and actual recipient acceptance", async () => {
  const fixture = complaintFixture()
  const route = fixture.loader.load("app/api/complaints/email/route.ts")
  const body = { to: fixture.body.email, templateId: "COMPLAINT_SUBMITTED", data: { complaintId: "fixture", customerName: "Customer", subject: "Test" } }
  assert.equal((await route.POST(fixture.request({ ...body, templateId: "COMPLAINT_PENDING" }))).status, 400)
  assert.equal((await route.POST(fixture.request(body))).status, 200)
  fixture.setAuthorized(false)
  assert.equal((await route.POST(fixture.request(body))).status, 401)
  const rejected = sourceLoader({ "@/lib/email": { sendEmail: async () => ({ success: true, result: { accepted: ["someone-else@example.invalid"] } }) } })
  await assert.rejects(rejected.load("lib/complaint-email.ts").sendComplaintEmail(body), /not accepted/)
})

test("bulk order upload uses the guarded order handler directly, bounds concurrency and validates acknowledgements", async () => {
  let active = 0
  let peak = 0
  let calls = 0
  let allowed = true
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } : { ok: false, response: new Response(null, { status: 401 }) } },
    "@/app/api/orders/[id]/route": { PUT: async (request, context) => {
      calls++
      active++
      peak = Math.max(peak, active)
      const { id } = await context.params
      const body = await request.json()
      assert.equal(request.headers.get("cookie"), "session=fixture")
      assert.equal(Object.hasOwn(body, "orderId"), false)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      if (id === "fixture-failed") return Response.json({ error: "Order changed" }, { status: 409 })
      return Response.json(id === "fixture-invalid-ack" ? { id } : { id, status: body.status })
    } },
  }).load("app/api/orders/bulk-upload/route.ts")
  const req = rows => new Request("https://untrusted-host.invalid/api/orders/bulk-upload", { method: "POST", headers: { cookie: "session=fixture" }, body: JSON.stringify({ rows }) })
  assert.equal((await route.POST(req([{ orderId: "one", status: "invalid" }]))).status, 400)
  assert.equal(calls, 0)
  const rows = Array.from({ length: 7 }, (_, index) => ({ orderId: index === 4 ? "fixture-failed" : index === 5 ? "fixture-invalid-ack" : `fixture-${index}`, status: "processing" }))
  const data = await (await route.POST(req(rows))).json()
  assert.equal(data.success.length, 5)
  assert.equal(data.failed.length, 2)
  assert.equal(data.failed[0].error, "Order changed")
  assert.match(data.failed[1].error, /invalid acknowledgement/)
  assert.equal(peak, 4)
  assert.equal((await route.POST(req([rows[0], rows[0]]))).status, 400)
  allowed = false
  assert.equal((await route.POST(req(rows))).status, 401)
  assert.equal(calls, 7)
})

test("debug cart recovery defaults to a dry run and delegates consent and caps to the shared service", async () => {
  const calls = []
  let failures = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/retention/cart-recovery": { runCartRecovery: async options => {
      calls.push(options)
      return { candidates: 1, sent: 0, failed: failures, skipped: { consent: 1, noEmail: 0, empty: 0, capped: 0, tooSoon: 0 }, dryRun: options.dryRun }
    } },
  }, { env: { NODE_ENV: "development" } })
  const route = loader.load("app/api/debug/trigger-abandoned-cart/route.ts")
  const req = body => new Request("https://fixture.invalid/debug", { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const preview = await route.POST(req())
  assert.equal(preview.status, 200)
  assert.equal((await preview.json()).dryRun, true)
  assert.equal(calls[0].dryRun, true)
  assert.equal((await route.POST(req({ dryRun: "false" }))).status, 400)
  failures = 1
  const partial = await route.POST(req({ dryRun: false }))
  assert.equal(partial.status, 207)
  assert.equal((await partial.json()).success, false)
  loader.env.NODE_ENV = "production"
  assert.equal((await route.POST(req())).status, 404)
  assert.equal(calls.length, 2)
})

function storeQrFixture() {
  const storeId = new ObjectId()
  const stores = [{ _id: storeId, shopName: "Synthetic Store", isActive: true, googleMapLocation: "https://maps.example.invalid/fixture" }]
  const qrs = []
  const encoded = []
  let failWrite = false
  let changed = false
  let allowed = true
  let reads = 0
  const session = {
    endSession: async () => {},
    withTransaction: async callback => {
      const snapshot = [...qrs]
      try { return await callback() }
      catch (error) { qrs.splice(0, qrs.length, ...snapshot); throw error }
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } : { ok: false, response: new Response(null, { status: 401 }) } },
    "@/lib/seo-metadata": { getOriginFromHeaders: async () => "https://fixture.invalid" },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => session } }) },
    "qrcode": { toDataURL: async url => { encoded.push(url); return `data:image/png;base64,${Buffer.from(url).toString("base64")}` } },
    "@/lib/db-service": { getCollection: async name => {
      assert.ok(["store_locations", "store_qr_codes"].includes(name))
      const docs = name === "store_locations" ? stores : qrs
      const matches = (doc, query) => Object.entries(query).every(([key, value]) => {
        if (value && typeof value === "object" && "$in" in value) return value.$in.some(id => id.toString() === doc[key]?.toString())
        return value?.toString() === doc[key]?.toString()
      })
      return {
        find: query => {
          const cursor = { sort: () => cursor, toArray: async () => docs.filter(doc => matches(doc, query)) }
          return cursor
        },
        findOne: async query => { reads++; return docs.find(doc => matches(doc, query)) || null },
        insertOne: async doc => { qrs.push(doc); if (failWrite) throw new Error("Injected QR write failure"); return { insertedId: doc._id } },
        insertMany: async docs => { qrs.push(...docs); if (failWrite) throw new Error("Injected QR bulk write failure"); return { insertedCount: docs.length } },
        updateOne: async (query, update) => {
          if (failWrite) throw new Error("Injected QR tracking failure")
          const doc = changed ? undefined : docs.find(doc => matches(doc, query))
          if (!doc) return { matchedCount: 0 }
          Object.assign(doc, update.$set)
          if (update.$inc) doc.scanCount += update.$inc.scanCount
          if (update.$push) doc.scanHistory.push(...update.$push.scanHistory.$each)
          return { matchedCount: 1 }
        },
      }
    } },
  })
  const list = loader.load("app/api/admin/store-qr/route.ts")
  const detail = loader.load("app/api/admin/store-qr/[id]/route.ts")
  const bulk = loader.load("app/api/admin/store-qr/bulk/route.ts")
  const scan = loader.load("app/api/store-qr/scan/[id]/route.ts")
  const analytics = loader.load("app/api/admin/store-qr/analytics/route.ts")
  const bodyRequest = (body, method = "POST") => new NextRequest("https://fixture.invalid/api/admin/store-qr", { method, body: JSON.stringify(body) })
  const params = id => ({ params: Promise.resolve({ id }) })
  return {
    stores, qrs, encoded, storeId: storeId.toHexString(), reads: () => reads,
    create: body => list.POST(bodyRequest(body)),
    update: (id, body) => detail.PUT(bodyRequest(body, "PUT"), params(id)),
    bulk: ids => bulk.POST(bodyRequest({ storeIds: ids })),
    scan: id => scan.GET(new NextRequest("https://fixture.invalid/scan", { headers: { "user-agent": "x".repeat(800) } }), params(id)),
    analytics: range => analytics.GET(new NextRequest(`https://fixture.invalid/api/admin/store-qr/analytics?range=${range}`)),
    fail: () => { failWrite = true }, change: () => { changed = true }, deny: () => { allowed = false },
  }
}

test("partner assignment schemas bound money, require real booleans, deduplicate IDs and preserve omitted overrides", () => {
  const schema = sourceLoader().load("lib/validation.ts").PartnerProductAssignmentsSchema
  const id = new ObjectId().toHexString()
  const parsed = schema.parse({ products: [{ productId: id.toUpperCase(), enabled: false }] })
  assert.equal(parsed.products[0].productId, id)
  assert.equal(Object.hasOwn(parsed.products[0], "customPrice"), false)
  for (const patch of [{ enabled: "false" }, { customPrice: -1 }, { customPrice: Infinity }, { customCommission: 101 }]) {
    assert.equal(schema.safeParse({ products: [{ productId: id, enabled: true, ...patch }] }).success, false)
  }
  assert.equal(schema.safeParse({ products: [{ productId: id, enabled: true }, { productId: id.toUpperCase(), enabled: false }] }).success, false)
  assert.equal(schema.parse({ products: [{ productId: "legacy-id", enabled: true, customPrice: 0, customCommission: null }] }).products[0].customPrice, 0)
})

test("partner assignment handlers reject invalid input and unauthorized access before database writes", async () => {
  let allowed = true
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } : { ok: false, response: new Response(null, { status: 401 }) } },
    "@/lib/partner/service": { getPartnerById: async () => { throw new Error("Unexpected partner lookup") } },
  }).load("app/api/admin/partners/[partnerId]/products/route.ts")
  const context = { params: Promise.resolve({ partnerId: new ObjectId().toHexString() }) }
  const request = body => new NextRequest("https://fixture.invalid/assignments", { method: "POST", body: JSON.stringify(body) })
  assert.equal((await route.POST(request({ products: [{ productId: "id", enabled: "false" }] }), context)).status, 400)
  assert.equal((await route.POST(new NextRequest("https://fixture.invalid/assignments", { method: "POST", body: "{" }), context)).status, 400)
  allowed = false
  assert.equal((await route.POST(request({}), context)).status, 401)
  assert.equal((await route.GET(new NextRequest("https://fixture.invalid/assignments"), context)).status, 401)
})

test("partner assignment response schemas use canonical IDs and reject corrupt override amounts", () => {
  const schema = sourceLoader().load("lib/product-card-response.ts").partnerAssignmentsResponseSchema
  const payload = {
    success: true, data: { partnerId: "partner", products: [{ productId: "product", enabled: true, customPrice: 0, customCommission: 0 }],
      enabledProductDetails: [{ id: "product", name: "Synthetic", price: 100, images: ["/fixture.png"] }] },
  }
  assert.equal(schema.parse(payload).data.enabledProductDetails[0].id, "product")
  payload.data.products[0].customCommission = 101
  assert.equal(schema.safeParse(payload).success, false)
})

test("single store QR creation and target updates always encode the same tracked scan URL", async () => {
  const f = storeQrFixture()
  const result = await f.create({ storeId: f.storeId, storeName: "Spoofed", type: "google_maps", targetUrl: "https://maps.example.invalid/one" })
  assert.equal(result.status, 200)
  const { id } = await result.json()
  assert.equal(f.qrs[0].storeName, "Synthetic Store")
  assert.equal(f.encoded[0], `https://fixture.invalid/api/store-qr/scan/${id}`)
  assert.equal((await f.update(id, { targetUrl: "https://maps.example.invalid/two", isActive: false })).status, 200)
  assert.equal(f.encoded[1], f.encoded[0])
  assert.equal(f.qrs[0].targetUrl, "https://maps.example.invalid/two")
  assert.equal(f.qrs[0].isActive, false)
})

test("QR and store schemas reject unsafe URLs, string booleans, malformed IDs and duplicate bulk selections", async () => {
  const f = storeQrFixture()
  const body = { storeId: f.storeId, type: "whatsapp", targetUrl: "javascript:alert(1)" }
  assert.equal((await f.create(body)).status, 400)
  assert.equal((await f.bulk([f.storeId, "bad-id"])).status, 400)
  assert.equal((await f.bulk([f.storeId, f.storeId])).status, 400)
  assert.equal((await f.update(new ObjectId().toHexString(), { isActive: "false" })).status, 400)
  const schema = sourceLoader().load("lib/validation.ts")
  assert.equal(schema.CreateStoreLocationSchema.safeParse({ shopName: "Store", isActive: "false" }).success, false)
  assert.equal(schema.UpdateStoreLocationSchema.safeParse({ shopName: "" }).success, false)
  assert.equal(schema.BulkStoreLocationSchema.safeParse({ stores: [{ shopName: "A" }, { shopName: " A " }] }).success, false)
  assert.equal(f.qrs.length, 0)
})

test("bulk QR generation prepares tracked images and skips only explicit existing types or missing map URLs", async () => {
  const f = storeQrFixture()
  assert.equal((await f.bulk([f.storeId])).status, 200)
  assert.equal(f.qrs.length, 3)
  assert.ok(f.encoded.every(url => url.startsWith("https://fixture.invalid/api/store-qr/scan/")))
  const again = await (await f.bulk([f.storeId])).json()
  assert.equal(again.created.length, 0)
  assert.equal(again.skipped.length, 3)
  const missing = storeQrFixture()
  missing.stores[0].googleMapLocation = ""
  const partial = await (await missing.bulk([missing.storeId])).json()
  assert.equal(partial.created.length, 2)
  assert.match(partial.skipped[0].reason, /No URL configured/)
})

test("bulk QR failures roll back every prepared code and reject missing or inactive requested stores", async () => {
  const f = storeQrFixture()
  f.fail()
  assert.equal((await f.bulk([f.storeId])).status, 500)
  assert.equal(f.qrs.length, 0)
  const missing = storeQrFixture()
  assert.equal((await missing.bulk([missing.storeId, new ObjectId().toHexString()])).status, 404)
  assert.equal(missing.qrs.length, 0)
  missing.stores[0].isActive = false
  assert.equal((await missing.bulk([missing.storeId])).status, 404)
})

test("QR scans are uncached, bounded and fail closed on deactivation races, unsafe targets and database outages", async () => {
  const f = storeQrFixture()
  const { id } = await (await f.create({ storeId: f.storeId, type: "whatsapp", targetUrl: "https://destination.invalid/" })).json()
  const response = await f.scan(id)
  assert.equal(response.status, 307)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(f.qrs[0].scanCount, 1)
  assert.equal(f.qrs[0].scanHistory[0].userAgent.length, 512)
  f.qrs[0].isActive = false
  assert.equal((await f.scan(id)).status, 410)
  f.qrs[0].isActive = true
  f.change()
  assert.equal((await f.scan(id)).status, 409)
  f.qrs[0].targetUrl = "javascript:alert(1)"
  assert.equal((await f.scan(id)).status, 500)
  f.qrs[0].targetUrl = "https://destination.invalid/"
  f.fail()
  const before = f.reads()
  assert.equal((await f.scan(id)).status, 500)
  assert.equal(f.reads(), before + 1)
})

test("QR analytics separates retained range counts from lifetime counters and normalizes per-store documents", async () => {
  const f = storeQrFixture()
  const { id } = await (await f.create({ storeId: f.storeId, type: "google_maps", targetUrl: "https://maps.example.invalid/" })).json()
  f.qrs[0].scanCount = 501
  const now = Date.now()
  f.qrs[0].scanHistory = [1, 10].map(days => ({ timestamp: new Date(now - days * 86400000), userAgent: "fixture", referer: "", ip: "fixture" }))
  f.qrs[0].lastScannedAt = f.qrs[0].scanHistory[0].timestamp
  const range = await (await f.analytics("7d")).json()
  assert.equal(range.overview.totalScans, 1)
  assert.equal(range.overview.lifetimeScans, 501)
  assert.equal(range.overview.retainedScans, 1)
  assert.equal(range.overview.historyComplete, false)
  assert.equal(range.topStores[0].totalScans, 1)
  assert.equal(range.storeDetails[0].types.google_maps.id, id)
  assert.equal("_id" in range.storeDetails[0].types.google_maps, false)
  assert.equal(range.typeBreakdown.google_maps, 1)
  const all = await (await f.analytics("all")).json()
  assert.equal(all.overview.totalScans, 501)
  assert.equal(all.overview.retainedScans, 2)
  assert.equal(all.topStores[0].totalScans, 501)
  assert.equal((await f.analytics("bogus")).status, 400)
})

test("store QR admin handlers guard before reading or mutating the database", async () => {
  const f = storeQrFixture()
  f.deny()
  assert.equal((await f.create({})).status, 401)
  assert.equal((await f.bulk([f.storeId])).status, 401)
  assert.equal((await f.update(new ObjectId().toHexString(), {})).status, 401)
  assert.equal((await f.analytics("all")).status, 401)
  assert.equal(f.reads(), 0)
})

function partnerCatalogueFixture() {
  const documents = [
    { _id: new ObjectId(), name: "Native", price: 100, mrp: 200, stock: 5, active: true,
      image: "/fixture-primary.png", specification_images: [null, "/fixture-spec.png"],
      technical_details: { URL: "/fixture-manufacturer.png", Resolution: "4K" } },
    { _id: "fixture-legacy-id", id: "fixture-legacy-alias", name: "Legacy", price: 200, stock: 2, active: true },
  ]
  const filters = []
  let allowed = true
  let failLookup = false
  let lookups = 0
  const response = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://fixture.invalid" },
  })
  const loader = sourceLoader({
    "@/lib/partner": {
      withPartnerAuth: handler => handler,
      checkPartnerPermission: () => allowed,
      permissionDeniedResponse: () => response({ success: false }, 403),
      createSuccessResponse: (data, requestId) => response({ success: true, data, requestId }),
      createErrorResponse: (code, message, requestId, status) => response({ success: false, error: { code, message }, requestId }, status),
      createPaginatedResponse: (data, page, limit, total, requestId, aliases) => response({ success: true, data: { ...aliases, page, limit, total }, requestId }),
      OPTIONS: () => response({}),
    },
    "@/lib/db-service": { getCollection: async name => {
      assert.equal(name, "products")
      return {
        findOne: async query => {
          lookups++
          if (failLookup) throw new Error("Injected catalogue lookup failure")
          assert.equal(query.active, true)
          return documents.find(doc => (query._id !== undefined ? doc._id.toString() === query._id.toString() : doc.id === query.id) && doc.active)
        },
        find: filter => {
          filters.push(filter)
          const cursor = {
            project: () => cursor, sort: () => cursor, skip: () => cursor, limit: () => cursor,
            toArray: async () => documents.filter(doc => doc.active),
          }
          return cursor
        },
        countDocuments: async () => documents.length,
      }
    } },
  })
  const listRoute = loader.load("app/api/v1/partner/products/route.ts")
  const detailRoute = loader.load("app/api/v1/partner/products/[productId]/route.ts")
  const stockRoute = loader.load("app/api/v1/partner/products/stock-check/route.ts")
  const req = (path, body) => {
    const request = new NextRequest(`https://fixture.invalid/api/v1/partner/products${path}`, body === undefined ? {} : { method: "POST", body })
    request.partner = { id: "fixture-partner" }
    request.apiKey = { environment: "live" }
    request.requestId = "fixture-request"
    return request
  }
  return {
    documents, filters, list: query => listRoute.GET(req(`?${query}`)), detail: id => detailRoute.GET(req(`/${encodeURIComponent(id)}`)),
    stock: body => stockRoute.POST(req("/stock-check", JSON.stringify(body))),
    forbid: () => { allowed = false }, fail: () => { failLookup = true }, lookups: () => lookups,
  }
}

test("partner catalogue filters validate exact numeric bounds and treat search and brand as literal text", async () => {
  const fixture = partnerCatalogueFixture()
  for (const query of ["page=0", "limit=101", "page=3bad", "minPrice=NaN", "minPrice=-1",
    "minPrice=20&maxPrice=10", "maxPrice=1.234", "inStock=maybe"]) {
    assert.equal((await fixture.list(query)).status, 400)
  }
  assert.equal(fixture.filters.length, 0)
  const response = await fixture.list(`search=${encodeURIComponent("(a+)+")}&brand=${encodeURIComponent("A.B")}&minPrice=0&maxPrice=100`)
  assert.equal(response.status, 200)
  assert.equal(fixture.filters[0].$or[0].name.$regex, "\\(a\\+\\)\\+")
  assert.equal(fixture.filters[0].brand.$regex, "A\\.B")
  assert.equal(fixture.filters[0].price.$gte, 0)
  assert.equal(fixture.filters[0].price.$lte, 100)
  assert.equal((await response.json()).data.products[0].discount, 50)
  fixture.forbid()
  assert.equal((await fixture.list("")).status, 403)
})

test("partner product details retain legacy lookups, primary image roles and specifications without fabricated delivery promises", async () => {
  const fixture = partnerCatalogueFixture()
  const response = await fixture.detail(fixture.documents[0]._id.toString())
  assert.equal(response.status, 200)
  const product = (await response.json()).data
  assert.equal(product.id, fixture.documents[0]._id.toString())
  assert.deepEqual(product.images.map(image => image.url), ["/fixture-primary.png", "/fixture-spec.png", "/fixture-manufacturer.png"])
  assert.equal(product.images.filter(image => image.isPrimary).length, 1)
  assert.deepEqual(product.specifications, { Resolution: "4K" })
  assert.equal(product.deliveryInfo.estimatedDays, null)
  assert.equal(product.deliveryInfo.freeDelivery, null)
  assert.equal(product.deliveryInfo.installationAvailable, null)
  assert.equal((await fixture.detail("fixture-legacy-alias")).status, 200)
  assert.equal((await fixture.detail("fixture-legacy-id")).status, 200)
  const failed = partnerCatalogueFixture()
  failed.fail()
  assert.equal((await failed.detail(failed.documents[0]._id.toString())).status, 500)
  assert.equal(failed.lookups(), 1, "A database outage must not trigger a fallback lookup")
})

test("partner stock checks validate 1–50 unique string IDs and report legacy/uppercase aliases without inventing update timestamps", async () => {
  const fixture = partnerCatalogueFixture()
  for (const body of [{ productIds: [] }, { productIds: [null] }, { productIds: [{}] },
    { productIds: ["one", "one"] }, { productIds: Array.from({ length: 51 }, (_, index) => `id-${index}`) },
    { productIds: ["one"], price: 1 }]) assert.equal((await fixture.stock(body)).status, 400)
  assert.equal(fixture.filters.length, 0)
  const response = await fixture.stock({ productIds: [
    fixture.documents[0]._id.toString().toUpperCase(), "fixture-legacy-alias", "missing",
  ] })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.data.missing, ["missing"])
  assert.equal(body.data.found, 2)
  assert.equal(body.data.products[1].id, "fixture-legacy-id")
  assert.equal(body.data.products[0].lastUpdated, null)
  assert.equal(fixture.filters[0].active, true)
})

test("partner catalogue rejects invalid stored money or inventory instead of advertising a successful zero-priced snapshot", async () => {
  for (const change of [doc => { doc.price = NaN }, doc => { doc.price = -1 },
    doc => { delete doc.price }, doc => { doc.stock = -1 }, doc => { doc.mrp = Infinity }]) {
    const fixture = partnerCatalogueFixture()
    change(fixture.documents[0])
    assert.equal((await fixture.list("")).status, 500)
  }
})

test("campaign page writes validate slug, banner and product selections and acknowledge actual normalized documents", async () => {
  const documents = []
  const normalizeId = doc => { const { _id, ...fields } = doc; return { ...fields, id: _id.toString() } }
  const collection = {
    find: () => ({ sort: () => ({ toArray: async () => documents }) }),
    findOne: async query => documents.find(doc => doc.slug === query.slug && (!query._id?.$ne || !doc._id.equals(query._id.$ne))),
    insertOne: async doc => { const _id = new ObjectId(); documents.push({ ...doc, _id }); return { insertedId: _id } },
    findOneAndUpdate: async (query, update, options) => {
      assert.equal(options.returnDocument, "after")
      const doc = documents.find(item => item._id.equals(query._id))
      if (!doc) return null
      Object.assign(doc, update.$set)
      return doc
    },
    deleteOne: async query => {
      const index = documents.findIndex(doc => doc._id.equals(query._id))
      if (index < 0) return { deletedCount: 0 }
      documents.splice(index, 1)
      return { deletedCount: 1 }
    },
  }
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/db-service": { getCollection: async () => collection, normalizeId },
  })
  const routes = loader.load("app/api/admin/campaign-pages/route.ts")
  const detail = loader.load("app/api/admin/campaign-pages/[id]/route.ts")
  const req = body => new Request("https://fixture.invalid/campaign", { method: "POST", body: JSON.stringify(body) })
  for (const body of [{ name: "Fixture", slug: "!!!" }, { name: 1, slug: "fixture" },
    { name: "Fixture", slug: "fixture", banner: "javascript:alert(1)" },
    { name: "Fixture", slug: "fixture", productIds: ["one", "one"] },
    { name: "Fixture", slug: "fixture", createdAt: "untrusted" }]) assert.equal((await routes.POST(req(body))).status, 400)
  assert.equal(documents.length, 0)
  const created = await (await routes.POST(req({ name: "Fixture", slug: " Fixture Sale " }))).json()
  assert.equal(created.campaign.slug, "fixture-sale")
  assert.ok(created.campaign.id)
  assert.equal(created.campaign._id, undefined)
  assert.equal((await routes.POST(req({ name: "Duplicate", slug: "fixture-sale" }))).status, 409)
  const context = { params: Promise.resolve({ id: created.campaign.id }) }
  assert.equal((await detail.PUT(req({}), context)).status, 400)
  assert.equal((await detail.PUT(req({ name: "Changed" }), context)).status, 200)
  assert.equal(documents[0].slug, "fixture-sale")
  assert.equal((await routes.GET()).status, 200)
  const missing = { params: Promise.resolve({ id: new ObjectId().toString() }) }
  assert.equal((await detail.PUT(req({ name: "Missing" }), missing)).status, 404)
  assert.equal((await detail.DELETE(req({}), missing)).status, 404)
  assert.equal((await detail.DELETE(req({}), context)).status, 200)
})

test("public campaigns normalize native/legacy product IDs, hide disabled products and validate their card contract", async () => {
  const productId = new ObjectId()
  const doc = { _id: new ObjectId(), name: "Fixture", slug: "fixture", isActive: true, productIds: [productId.toString(), "legacy-id"] }
  let active = true
  const route = sourceLoader({
    "@/lib/db-service": {
      normalizeId: value => { const { _id, ...fields } = value; return { ...fields, id: _id.toString() } },
      getCollection: async name => name === "campaign_pages" ? { findOne: async query => {
        assert.equal(query.isActive, true)
        return active ? doc : null
      } } : { find: query => {
        assert.equal(query.active, true)
        assert.ok(query.$or[0]._id.$in[0].equals(productId))
        assert.ok(query.$or[1]._id.$in.includes("legacy-id"))
        return { toArray: async () => [
          { _id: productId, name: "Native", price: 100 }, { _id: "legacy-id", name: "Legacy", price: 200 },
        ] }
      } },
    },
  }).load("app/api/campaign-pages/[slug]/route.ts")
  const get = () => route.GET(new Request("https://fixture.invalid/fixture"), { params: Promise.resolve({ slug: "fixture" }) })
  const response = await get()
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.campaign.id, doc._id.toString())
  assert.deepEqual(data.campaign.products.map(product => product.id), [productId.toString(), "legacy-id"])
  assert.ok(data.campaign.products.every(product => !("_id" in product)))
  active = false
  assert.equal((await get()).status, 404)
})

test("division visibility is admin-only, validates input and updates the exact division", async () => {
  let authorized = false
  let operation = null
  const route = sourceLoader({
    "@/lib/auth": {
      requireAdmin: async () => authorized
        ? { ok: true }
        : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) },
    },
    "@/lib/db-service": {
      COLLECTIONS: { PRODUCTS: "products" },
      updateMany: async (collection, filter, update) => {
        operation = { collection, filter, update }
        return { success: true, matchedCount: 3, modifiedCount: 2 }
      },
    },
    "@/lib/api-error": {
      handleApiError: () => Response.json({ error: "Failed" }, { status: 500 }),
    },
  }).load("app/api/products/division-visibility/route.ts")
  const request = body => new Request("https://fixture.invalid/api/products/division-visibility", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  assert.equal((await route.PATCH(request({ division: "TV", active: false }))).status, 401)
  authorized = true
  assert.equal((await route.PATCH(request({ division: "", active: false }))).status, 400)

  const response = await route.PATCH(request({ division: " TV.* ", active: false }))
  assert.equal(response.status, 200)
  assert.equal(operation.collection, "products")
  assert.equal(operation.filter.division.$regex, "^TV\\.\\*$")
  assert.equal(operation.filter.division.$options, "i")
  assert.equal(operation.update.active, false)
  assert.deepEqual(await response.json(), {
    success: true,
    division: "TV.*",
    active: false,
    matchedCount: 3,
    modifiedCount: 2,
  })
})

function participantUploadFixture() {
  const campaignId = new ObjectId().toString()
  const participants = [
    { _id: new ObjectId().toString(), campaignId, name: "Previous winner", phone: "", email: "", wonAt: new Date() },
    { _id: new ObjectId().toString(), campaignId, name: "Previous eligible", phone: "", email: "", wonAt: null },
  ]
  let activeSession
  let fail = false
  const matches = (doc, query) => Object.entries(query).every(([key, value]) =>
    value === null ? doc[key] == null : doc[key] === value)
  const client = { startSession: () => {
    const session = { withTransaction: async operation => {
      activeSession = session
      const snapshot = [...participants]
      try { return await operation() } catch (error) { participants.splice(0, participants.length, ...snapshot); throw error }
      finally { activeSession = undefined }
    }, endSession: async () => {} }
    return session
  } }
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client }) },
    "@/lib/db-service": { getCollection: async name => name === "lucky_draw_campaigns" ? {
      updateOne: async (filter, update, options) => {
        assert.equal(options.session, activeSession)
        assert.equal(update.$inc.participantsRevision, 1)
        return { matchedCount: filter._id === campaignId ? 1 : 0 }
      },
    } : {
      find: (query, options) => {
        assert.equal(options.session, activeSession)
        return { project: () => ({ toArray: async () => participants.filter(doc => matches(doc, query)) }) }
      },
      deleteMany: async (query, options) => {
        assert.equal(options.session, activeSession)
        let deletedCount = 0
        for (let i = participants.length - 1; i >= 0; i--) if (matches(participants[i], query)) { participants.splice(i, 1); deletedCount++ }
        return { deletedCount }
      },
      insertMany: async (docs, options) => {
        assert.equal(options.session, activeSession)
        participants.push(...docs)
        if (fail) throw new Error("Injected participant insert failure")
      },
    } },
  }).load("app/api/admin/lucky-draw/[id]/participants/route.ts")
  const context = { params: Promise.resolve({ id: campaignId }) }
  const post = body => route.POST(new NextRequest("https://fixture.invalid/participants", { method: "POST", body: JSON.stringify(body) }), context)
  const remove = id => route.DELETE(new NextRequest(`https://fixture.invalid/participants${id ? `?participantId=${id}` : ""}`), context)
  return { campaignId, participants, post, remove, fail: () => { fail = true } }
}

test("participant replacement rolls back on insertion failure and rejects invalid input before removing the pool", async () => {
  const fixture = participantUploadFixture()
  assert.equal((await fixture.post({ rows: [{ name: " " }], replace: true })).status, 400)
  assert.equal(fixture.participants.length, 2)
  fixture.fail()
  assert.equal((await fixture.post({ rows: [{ name: "New" }], replace: true })).status, 500)
  assert.equal(fixture.participants.length, 2)
  assert.equal(fixture.participants[1].name, "Previous eligible")
})

test("participant replacement and removal preserve winners and deduplicate normalized participants", async () => {
  const fixture = participantUploadFixture()
  const winnerId = fixture.participants[0]._id
  const response = await fixture.post({ rows: [
    { name: "Previous winner" }, { name: "New", email: "FIXTURE@example.invalid" },
    { name: "New", email: "fixture@example.invalid" },
  ], replace: true })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.inserted, 1)
  assert.equal(body.duplicates, 2)
  assert.equal(body.total, 2)
  assert.equal(fixture.participants[0]._id, winnerId)
  assert.equal((await fixture.remove(winnerId)).status, 409)
  assert.equal((await fixture.remove()).status, 200)
  assert.equal(fixture.participants.length, 1)
  assert.equal(fixture.participants[0]._id, winnerId)
})

test("license repair streams the canonical paid-order selection and reports failed delivery without exposing keys", async () => {
  const documents = [
    { _id: new ObjectId(), status: "processing" }, { _id: new ObjectId(), status: "processing" },
  ]
  const calls = []
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({
      countDocuments: async query => {
        assert.equal(query["paymentVerification.verified"], true)
        assert.equal(query["licenseKeys.0"].$exists, false)
        assert.ok(query.status.$nin.includes("cancelled"))
        return documents.length
      },
      find: () => ({ sort: () => ({ async *[Symbol.asyncIterator]() { yield* documents } }) }),
      findOne: async query => ({ ...documents.find(order => order._id.equals(query._id)), status: "delivered" }),
    }) },
    "@/lib/software-fulfillment": {
      fulfillSoftwareOrder: async id => {
        calls.push(id)
        return { licenseKeys: ["private-fixture-key-1", "private-fixture-key-2"], results: [{ sent: true }, { sent: false }] }
      },
      SoftwareFulfillmentError: class extends Error {},
    },
  })
  const { assignMissingLicenses, LicenseRepairDaysSchema } = loader.load("scripts/assign-missing-licenses.ts")
  for (const value of [0, -1, 1.5, 3651, true, null, "", "30bad"]) {
    assert.equal(LicenseRepairDaysSchema.safeParse(value).success, false)
  }
  const stats = await assignMissingLicenses(30)
  assert.equal(stats.ordersProcessed, 2)
  assert.equal(stats.licensesAssigned, 4)
  assert.equal(stats.emailsSent, 2)
  assert.equal(stats.ordersMarkedDelivered, 2)
  assert.equal(stats.errors.length, 2)
  assert.equal(calls.length, 2)
  assert.ok(!JSON.stringify(stats).includes("private-fixture-key"))
})

test("license repair previews guard independently and reject malformed inputs; partial repairs are not acknowledged as success", async () => {
  let allowed = false
  let mutations = 0
  const script = sourceLoader({ "@/lib/db-service": {} }).load("scripts/assign-missing-licenses.ts")
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } :
      { ok: false, response: new Response("Forbidden", { status: 403 }) } },
    "@/scripts/assign-missing-licenses": { ...script, assignMissingLicenses: async () => {
      mutations++
      return { totalOrders: 2, ordersProcessed: 1, licensesAssigned: 1, emailsSent: 0, ordersMarkedDelivered: 0,
        errors: [{ orderId: "fixture-order", error: "Activation email failed" }] }
    } },
    "@/lib/db-service": { getCollection: async () => ({ countDocuments: async query => {
      assert.equal(query["paymentVerification.verified"], true)
      return 2
    } }) },
  }).load("app/api/admin/assign-missing-licenses/route.ts")
  const post = body => route.POST(new NextRequest("https://fixture.invalid/repair", { method: "POST", body }))
  assert.equal((await route.GET(new NextRequest("https://fixture.invalid/repair"))).status, 403)
  assert.equal((await post("{}")).status, 403)
  allowed = true
  for (const body of ["{", JSON.stringify({ daysBack: true }), JSON.stringify({ daysBack: -1 }),
    JSON.stringify({ daysBack: 10, userId: "untrusted" })]) assert.equal((await post(body)).status, 400)
  assert.equal((await route.GET(new NextRequest("https://fixture.invalid/repair?daysBack=30bad"))).status, 400)
  assert.equal(mutations, 0)
  const preview = await (await route.GET(new NextRequest("https://fixture.invalid/repair?daysBack=30"))).json()
  assert.equal(preview.ordersNeedingLicenses, 2)
  const result = await (await post("")).json()
  assert.equal(result.success, false)
  assert.equal(result.stats.errorsCount, 1)
  assert.equal(mutations, 1)
})

function commissionPaymentFixture({ authenticated = true, missingOperator = false } = {}) {
  const orders = [1, 2].map(index => ({
    _id: new ObjectId(), partnerId: "fixture-partner", orderId: `FIXTURE-${index}`,
    commission: { amount: index === 1 ? 10.25 : 20.50, status: "pending" },
    paymentVerification: { verified: true },
  }))
  const payouts = []
  let failPayout = false
  let conflict = false
  let activeSession
  let queue = Promise.resolve()
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const previous = queue
        let release
        queue = new Promise(resolve => { release = resolve })
        await previous
        activeSession = session
        const snapshots = orders.map(order => ({ ...order, commission: { ...order.commission } }))
        const count = payouts.length
        try { return await operation() } catch (error) {
          orders.splice(0, orders.length, ...snapshots)
          payouts.splice(count)
          throw error
        } finally { activeSession = undefined; release() }
      },
      endSession: async () => {},
    }
    return session
  } }
  const matches = (order, filter) => Object.entries(filter).every(([key, value]) => {
    const actual = key.split(".").reduce((object, part) => object?.[part], order)
    return key === "_id" ? actual.equals(value) : actual === value
  })
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({
      authorized: authenticated, userId: missingOperator ? undefined : "fixture-operator",
    }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client }) },
    "@/lib/db-service": { getCollection: async name => {
      assert.ok(["partner_orders", "partner_payouts"].includes(name), "No fictitious wallet credit")
      if (name === "partner_orders") return {
        find: (filter, options) => {
          assert.equal(options.session, activeSession)
          return { limit: count => ({ toArray: async () => orders.filter(order => matches(order, filter)).slice(0, count) }) }
        },
        updateOne: async (filter, update, options) => {
          assert.equal(options.session, activeSession)
          if (conflict) return { modifiedCount: 0 }
          const order = orders.find(order => matches(order, filter))
          if (!order) return { modifiedCount: 0 }
          for (const [key, value] of Object.entries(update.$set)) {
            if (key.startsWith("commission.")) order.commission[key.split(".")[1]] = value
            else order[key] = value
          }
          return { modifiedCount: 1 }
        },
      }
      return { insertOne: async (payout, options) => {
        assert.equal(options.session, activeSession)
        payouts.push(payout)
        if (failPayout) throw new Error("Injected payout failure")
      } }
    } },
  })
  const service = loader.load("lib/partner/commissions.ts")
  const route = loader.load("app/api/admin/partner-commissions/mark-paid/route.ts")
  const input = { partnerId: "fixture-partner", orderIds: orders.map(order => order._id.toString()), totalAmount: 30.75 }
  const post = body => route.POST(new NextRequest("https://fixture.invalid/api/admin/partner-commissions/mark-paid", {
    method: "POST", body: JSON.stringify(body),
  }))
  return { service, input, orders, payouts, post, failPayout: () => { failPayout = true }, conflict: () => { conflict = true } }
}

test("commission payments require an operator and bounded unique validated selections before mutation", async () => {
  const fixture = commissionPaymentFixture()
  for (const body of [{}, { ...fixture.input, orderIds: [] },
    { ...fixture.input, orderIds: Array(201).fill("order") },
    { ...fixture.input, orderIds: ["one", "one"] }, { ...fixture.input, totalAmount: -1 },
    { ...fixture.input, transactionId: {} }, { ...fixture.input, amount: 999 }]) {
    assert.equal((await fixture.post(body)).status, 400)
  }
  assert.equal((await commissionPaymentFixture({ authenticated: false }).post(fixture.input)).status, 401)
  assert.equal((await commissionPaymentFixture({ missingOperator: true }).post(fixture.input)).status, 500)
  assert.equal(fixture.payouts.length, 0)
  assert.ok(fixture.orders.every(order => order.commission.status === "pending"))
})

test("only paid orders with pending commissions qualify; any ineligible selection aborts the entire batch", async () => {
  for (const change of [
    order => { order.paymentVerification.verified = false },
    order => { delete order.paymentVerification },
    order => { order.commission.status = "credited" },
    order => { order.partnerId = "another-partner" },
    order => { order.commission.amount = NaN },
    order => { order.commission.amount = 10.001 },
  ]) {
    const fixture = commissionPaymentFixture()
    change(fixture.orders[1])
    assert.equal((await fixture.post(fixture.input)).status, 409)
    assert.equal(fixture.orders[0].commission.status, "pending")
    assert.equal(fixture.payouts.length, 0)
  }
})

test("commission payment records stored amounts and operator atomically without inventing wallet movements", async () => {
  const fixture = commissionPaymentFixture()
  const response = await fixture.post({ ...fixture.input, transactionId: "FIXTURE-UTR", notes: "External fixture payment" })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.amount, 30.75)
  assert.equal(body.data.updated, 2)
  assert.deepEqual(body.data.orderIds, fixture.input.orderIds)
  assert.match(body.data.message, /No wallet credit or bank transfer/)
  assert.equal(fixture.payouts.length, 1)
  assert.equal(fixture.payouts[0].source, "admin_direct")
  assert.equal(fixture.payouts[0].amount, 30.75)
  assert.equal(fixture.payouts[0].approvedBy, "fixture-operator")
  assert.ok(fixture.orders.every(order => order.commission.creditedBy === "fixture-operator" &&
    order.commission.payoutId === body.data.payoutId && order.commission.transactionId === "FIXTURE-UTR"))
})

test("commission totals, missing or aliased duplicate orders, conflicts and payout failures never partially commit", async () => {
  const stale = commissionPaymentFixture()
  assert.equal((await stale.post({ ...stale.input, totalAmount: 9999 })).status, 409)
  const missing = commissionPaymentFixture()
  assert.equal((await missing.post({ ...missing.input, orderIds: [...missing.input.orderIds, "missing"] })).status, 409)
  const duplicate = commissionPaymentFixture()
  assert.equal((await duplicate.post({ ...duplicate.input, orderIds: [
    duplicate.orders[0].orderId, duplicate.orders[0]._id.toString(),
  ] })).status, 400)
  const conflict = commissionPaymentFixture()
  conflict.conflict()
  assert.equal((await conflict.post(conflict.input)).status, 409)
  const failure = commissionPaymentFixture()
  failure.failPayout()
  assert.equal((await failure.post(failure.input)).status, 500)
  for (const fixture of [stale, missing, duplicate, conflict, failure]) {
    assert.ok(fixture.orders.every(order => order.commission.status === "pending"))
    assert.equal(fixture.payouts.length, 0)
  }
})

test("concurrent external commission recordings commit exactly once", async () => {
  const fixture = commissionPaymentFixture()
  const responses = await Promise.all([fixture.post(fixture.input), fixture.post(fixture.input)])
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
  assert.equal(fixture.payouts.length, 1)
  const internal = commissionPaymentFixture()
  assert.equal((await internal.post({ ...internal.input, orderIds: internal.orders.map(order => order.orderId) })).status, 200)
})

function payoutApprovalFixture() {
  const doc = { _id: new ObjectId(), id: "legacy-payout", status: "pending_approval", requestedAt: new Date() }
  const updates = []
  let failure = false
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true, userId: "fixture-operator" }) },
    "@/lib/db-service": { getCollection: async name => {
      assert.equal(name, "partner_payouts")
      return {
        findOne: async query => {
          if (failure) throw new Error("Injected lookup failure")
          return query.id === doc.id || query._id?.equals(doc._id) ? doc : null
        },
        findOneAndUpdate: async (query, update) => {
          updates.push({ query, update })
          if (doc.status !== query.status) return null
          Object.assign(doc, update.$set)
          return doc
        },
      }
    } },
  })
  const route = loader.load("app/api/admin/payouts/[payoutId]/approve/route.ts")
  const post = (text = "", id = doc.id) => route.POST(new NextRequest("https://fixture.invalid/approve", { method: "POST", body: text }),
    { params: Promise.resolve({ payoutId: id }) })
  return { doc, updates, post, fail: () => { failure = true } }
}

test("payout approval validates optional JSON and saves operator, notes and reference in the same status claim", async () => {
  const fixture = payoutApprovalFixture()
  for (const text of ["{", JSON.stringify({ notes: {} }), JSON.stringify({ status: "completed" })]) {
    assert.equal((await fixture.post(text)).status, 400)
  }
  assert.equal(fixture.updates.length, 0)
  const response = await fixture.post(JSON.stringify({ notes: "Fixture", transactionId: "FIXTURE-REF" }))
  assert.equal(response.status, 200)
  assert.equal(fixture.updates.length, 1)
  assert.equal(fixture.updates[0].query.status, "pending_approval")
  assert.equal(fixture.doc.approvedBy, "fixture-operator")
  assert.equal(fixture.doc.adminNotes, "Fixture")
  assert.equal(fixture.doc.transactionId, "FIXTURE-REF")
  assert.match((await response.json()).data.message, /No bank transfer/)
  assert.equal((await fixture.post()).status, 409)
  const empty = payoutApprovalFixture()
  assert.equal((await empty.post()).status, 200)
  const failed = payoutApprovalFixture()
  failed.fail()
  assert.equal((await failed.post("", failed.doc._id.toString())).status, 500)
  assert.equal(failed.updates.length, 0)
})

test("payout rejection validates input and passes the actual operator before the reason", async () => {
  const doc = { _id: new ObjectId() }
  let calls = 0
  const route = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true, userId: "fixture-operator" }) },
    "@/lib/db-service": { getCollection: async () => ({ findOne: async () => doc }) },
    "@/lib/partner/wallet": { rejectPayout: async (id, operator, reason) => {
      calls++
      assert.equal(id, doc._id.toString())
      assert.equal(operator, "fixture-operator")
      assert.equal(reason, "Fixture reason")
      return { id, status: "rejected", rejectionReason: reason }
    }, PayoutStateConflictError: class extends Error {} },
  }).load("app/api/admin/payouts/[payoutId]/reject/route.ts")
  const post = body => route.POST(new NextRequest("https://fixture.invalid/reject", { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ payoutId: doc._id.toString() }) })
  assert.equal((await post({ reason: {} })).status, 400)
  assert.equal((await post({ reason: " " })).status, 400)
  assert.equal(calls, 0)
  assert.equal((await post({ reason: "Fixture reason" })).status, 200)
  assert.equal(calls, 1)
})

test("payout listing rejects invalid pagination, status and date bounds before querying", async () => {
  let reads = 0
  const route = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true }) },
    "@/lib/db-service": { getCollection: async () => {
      reads++
      return { aggregate: () => ({ toArray: async () => [] }), countDocuments: async () => 0 }
    } },
  }).load("app/api/admin/payouts/route.ts")
  for (const query of ["page=0", "page=12bad", "limit=-1", "limit=101", "status=wrong",
    "dateFrom=bad", "dateFrom=2026-10-12&dateTo=2026-10-01"]) {
    assert.equal((await route.GET(new NextRequest(`https://fixture.invalid/payouts?${query}`))).status, 400)
  }
  assert.equal(reads, 0)
  assert.equal((await route.GET(new NextRequest("https://fixture.invalid/payouts"))).status, 200)
})

function orderDetailFixture({ partner = false, conflict = false, session = { user: { id: "fixture-owner" } }, admin = true } = {}) {
  const doc = { _id: new ObjectId(), orderId: "FIXTURE-ORDER", partnerOrderId: "FIXTURE-PARTNER",
    userId: "fixture-owner", status: "processing", updatedAt: new Date("2026-10-12T00:00:00Z"),
    customer: { name: "Fixture", email: "fixture@example.invalid" }, total: 500,
    summary: { total: 600, subtotal: 500, tax: 100 }, guestAccessTokenHash: "fixture-secret",
    licenseKey: "fixture-license", timeline: [], statusHistory: [] }
  const mutations = []
  const effects = []
  const collection = {
    findOne: async () => doc,
    findOneAndUpdate: async (query, update, options) => {
      mutations.push({ query, update, options })
      if (conflict) return null
      Object.assign(doc, update.$set)
      if (update.$push?.timeline) doc.timeline.unshift(...update.$push.timeline.$each)
      if (update.$push?.statusHistory) doc.statusHistory.push(update.$push.statusHistory)
      return doc
    },
  }
  const route = sourceLoader({
    "@/lib/db-service": {
      getCollection: async name => name === "partners" ? { findOne: async () => ({ name: "Fixture partner" }) } :
        (name === "orders" && partner ? { findOne: async () => null } : collection),
      createObjectId: value => new ObjectId(value),
      normalizeId: value => { const { _id, ...rest } = value; return { ...rest, id: String(_id) } },
    },
    "@/lib/auth": { requireAdmin: async () => admin ? { ok: true, user: session?.user } :
      { ok: false, response: new Response("Forbidden", { status: 403 }) },
      getSession: async () => session ? { user: { ...session.user, role: admin ? "admin" : "user" } } : null,
      checkAdminAuthorization: async () => ({ authorized: admin }) },
    "@/lib/guest-order": { verifyGuestAccessToken: (token, hash) => token === "fixture-token" && hash === "fixture-secret" },
    "@/lib/emailTemplates": { getEmailTemplateId: status => status, getEmailSubject: () => "Fixture", getEmailTemplate: () => "Fixture" },
    "@/lib/email": { sendEmail: async () => { effects.push("email"); return { success: true } } },
    "@/lib/customer-profile": { EARNING_STATUSES: ["delivered", "completed"],
      rebuildCustomerProfile: async () => effects.push("profile"), recordEvent: async () => effects.push("event") },
    "@/lib/loyalty": { awardPointsForOrder: async () => effects.push("award"), reverseOrderPoints: async () => effects.push("reverse") },
    "@/lib/push": { notifyOrderStatus: async () => effects.push("push") },
  }).load("app/api/orders/[id]/route.ts")
  const put = (body, id = doc.orderId) => route.PUT(new NextRequest(`https://fixture.invalid/api/orders/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) })
  const get = (token = "") => route.GET(new NextRequest(`https://fixture.invalid/api/orders/${doc.orderId}${token ? `?token=${token}` : ""}`),
    { params: Promise.resolve({ id: doc.orderId }) })
  return { doc, mutations, effects, put, get }
}

test("order updates reject arbitrary money, identity, payment proof and history writes before database mutation", async () => {
  const fixture = orderDetailFixture()
  for (const field of ["total", "userId", "paymentVerification", "licenseKey", "timeline", "statusHistory", "guestAccessTokenHash"]) {
    assert.equal((await fixture.put({ status: "delivered", [field]: "untrusted" })).status, 400)
  }
  for (const body of [{}, { status: "invalid" }, { status: "shipped", trackingNumber: " " },
    { status: "processing", cancellation: { reason: "Fixture" } },
    { status: "cancelled", cancellation: { reason: "Fixture", refundStatus: "processed" } }]) {
    assert.equal((await fixture.put(body)).status, 400)
  }
  assert.equal(fixture.mutations.length, 0)
  assert.equal(fixture.effects.length, 0)
  assert.equal((await orderDetailFixture({ admin: false }).put({ status: "delivered" })).status, 403)
})

test("order updates atomically append history, compare the stored identity/version and acknowledge the persisted document", async () => {
  const fixture = orderDetailFixture()
  const originalDate = fixture.doc.updatedAt
  const response = await fixture.put({ status: "delivered" })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.status, "delivered")
  assert.equal(body.notification.emailSent, true)
  const { query, update, options } = fixture.mutations[0]
  assert.equal(query._id, fixture.doc._id)
  assert.equal(query.status, "processing")
  assert.equal(query.updatedAt, originalDate)
  assert.equal(options.returnDocument, "after")
  assert.equal(update.$set.timeline, undefined)
  assert.equal(update.$push.timeline.$each[0].status, "Delivered")
  assert.equal(fixture.doc.timeline.length, 1)
  assert.ok(fixture.effects.includes("award"))
  fixture.effects.length = 0
  assert.equal((await fixture.put({ status: "delivered" })).status, 200)
  assert.equal(fixture.doc.timeline.length, 1)
  assert.equal(fixture.effects.length, 0)
  const stale = orderDetailFixture({ conflict: true })
  assert.equal((await stale.put({ status: "delivered" })).status, 409)
  assert.equal(stale.effects.length, 0)
})

test("partner order updates use the found primary key and append partner history; cancellation timestamps are server-owned", async () => {
  const fixture = orderDetailFixture({ partner: true })
  assert.equal((await fixture.put({ status: "cancelled", cancellation: {
    reason: "Fixture reason", note: "", date: "2000-01-01T00:00:00Z", refundStatus: "pending",
  } }, fixture.doc.partnerOrderId)).status, 200)
  assert.equal(fixture.mutations[0].query._id, fixture.doc._id)
  assert.equal(fixture.mutations[0].update.$push.statusHistory.status, "cancelled")
  assert.notEqual(fixture.doc.cancellation.date, "2000-01-01T00:00:00Z")
  assert.equal(fixture.doc.statusHistory.length, 1)
  assert.equal(fixture.doc.timeline.length, 0)
})

test("order detail preserves owner/guest authorization and license fields without exposing capability hashes", async () => {
  const owner = orderDetailFixture({ admin: false })
  const ownerBody = await (await owner.get()).json()
  assert.equal(ownerBody.licenseKey, "fixture-license")
  assert.equal(ownerBody.guestAccessTokenHash, undefined)
  const stranger = orderDetailFixture({ admin: false, session: { user: { id: "different-owner" } } })
  assert.equal((await stranger.get()).status, 404)
  const guest = orderDetailFixture({ admin: false, session: null })
  assert.equal((await guest.get()).status, 401)
  guest.doc.userId = null
  assert.equal((await guest.get("fixture-token")).status, 200)
  assert.equal((await guest.get("wrong-token")).status, 404)
})

test("MRP uploads validate currency, reject ambiguous itemnos and preserve concurrent selling-price changes", async () => {
  const products = [
    { _id: new ObjectId(), itemno: "A", price: 100, mrp: 150 },
    { _id: new ObjectId(), itemno: "B", price: 200, mrp: 250 },
    { _id: new ObjectId(), itemno: "DUP", price: 50, mrp: 100 },
    { _id: new ObjectId(), itemno: "dup", price: 50, mrp: 100 },
    { _id: new ObjectId(), itemno: "STALE", price: 100, mrp: 150 },
  ]
  let writes = 0
  const collection = {
    find: query => {
      const regex = new RegExp(query.itemno.$regex, query.itemno.$options)
      return { limit: count => ({ toArray: async () => products.filter(product => regex.test(product.itemno)).slice(0, count) }) }
    },
    findOneAndUpdate: async (query, update, options) => {
      writes++
      assert.equal(options.returnDocument, "after")
      const product = products.find(product => product._id.equals(query._id))
      assert.equal(query.price, product.price)
      assert.equal(query.mrp, product.mrp)
      if (product.itemno === "STALE") return null
      Object.assign(product, update.$set)
      return product
    },
  }
  const { processProductMrps } = sourceLoader({ "@/lib/db-service": { getCollection: async () => collection } }).load("lib/product-price-import.ts")
  const result = await processProductMrps([
    { itemno: "A", MRP: 170 }, { itemno: "a", MRP: "₹1,250.50" },
    { itemno: "B", MRP: 150 }, { itemno: "DUP", MRP: 200 },
    { itemno: "BAD", MRP: -100 }, { itemno: "JUNK", MRP: "100bad" },
    { itemno: "MISSING", MRP: 100 }, { itemno: "STALE", MRP: 300 }, { MRP: 100 },
  ])
  assert.equal(result.updated, 1)
  assert.equal(result.skipped, 3)
  assert.equal(result.errors.length, 5)
  assert.equal(products[0].mrp, 1250.5)
  assert.equal(products[1].mrp, 250)
  assert.equal(products[4].mrp, 150)
  assert.equal(writes, 2)
})

test("specification mutation validates edit types and prevents lock bypass, stale updates and stale deletion", async () => {
  const doc = { _id: new ObjectId(), sku: "FIXTURE", locked: true, updatedAt: new Date(), name: "Fixture" }
  let stale = false
  const updates = []
  const collection = {
    findOne: async () => doc,
    findOneAndUpdate: async (query, update) => {
      updates.push({ query, update })
      if (stale) return null
      return { ...doc, ...update.$set }
    },
    deleteOne: async query => {
      updates.push({ query })
      return { acknowledged: true, deletedCount: stale ? 0 : 1 }
    },
  }
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => collection } }) },
    "@/lib/db-service": { normalizeId: value => { const { _id, ...rest } = value; return { ...rest, id: String(_id) } } },
  }).load("app/api/products/specifications/[sku]/route.ts")
  const context = { params: Promise.resolve({ sku: "FIXTURE" }) }
  const patch = data => route.PATCH(new Request("https://fixture.invalid", { method: "PATCH", body: JSON.stringify(data) }), context)
  for (const data of [{ locked: "false" }, { isSynced: "false" }, { mrp: -1 }, { technical_details: [] }, { untrusted: "bad" }]) {
    assert.equal((await patch(data)).status, 400)
  }
  assert.equal((await patch({ locked: false, name: "Bypass" })).status, 409)
  assert.equal(updates.length, 0)
  const response = await patch({ locked: false })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.id, String(doc._id))
  assert.equal(body.data._id, undefined)
  assert.equal(updates[0].query.locked, true)
  assert.equal(updates[0].query.updatedAt, doc.updatedAt)
  assert.equal(updates[0].update.$set.updatedAt instanceof Date, false) // The actual handler executes in its isolated VM.
  assert.equal(typeof updates[0].update.$set.updatedAt.toISOString(), "string")
  doc.locked = false
  stale = true
  assert.equal((await patch({ name: "Fixture update" })).status, 409)
  assert.equal((await route.DELETE(new Request("https://fixture.invalid"), context)).status, 409)
})

test("catalog Excel exports guard themselves and resolve the live subcategory collection", async () => {
  for (const filename of ["app/api/products/export/route.ts", "app/api/products/specifications/export/route.ts"]) {
    let authorized = false
    const names = []
    const sheets = []
    const route = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: new Response("Forbidden", { status: 403 }) } },
      "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: name => {
        names.push(name)
        return { find: () => ({ toArray: async () => name === "sub_categories"
          ? [{ _id: new ObjectId(), id: "fixture-sub", name: "Fixture subcategory" }]
          : ["products", "product_specifications"].includes(name) ? [{ sku: "FIXTURE", itemno: "FIXTURE", subCategory: "fixture-sub" }] : [] }) }
      } } }) },
      xlsx: { utils: { json_to_sheet: rows => { sheets.push(rows); return {} }, book_new: () => ({}), book_append_sheet: () => {} },
        write: () => Buffer.from("fixture") },
    }).load(filename)
    assert.equal((await route.GET()).status, 403)
    assert.equal(names.length, 0)
    authorized = true
    const response = await route.GET()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.ok(names.includes("sub_categories"))
    assert.ok(!names.includes("sub-categories"))
    assert.equal(sheets[0][0]["sub-category/PROD DESC"], "fixture-sub") // Canonical taxonomy text takes precedence.
  }
})

test("employee management requires full admin access on every operation and validates access settings without silent filtering", async () => {
  const loader = sourceLoader({
    "@/lib/auth": { requireFullAdmin: async () => ({ ok: false, response: new Response("Forbidden", { status: 403 }) }) },
  })
  const collectionRoute = loader.load("app/api/employees/route.ts")
  const detailRoute = loader.load("app/api/employees/[id]/route.ts")
  for (const method of ["GET", "POST"]) {
    assert.equal((await collectionRoute[method](new Request("https://fixture.invalid"))).status, 403)
  }
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await detailRoute[method](new Request("https://fixture.invalid"), { params: Promise.resolve({ id: String(new ObjectId()) }) })).status, 403)
  }
  const { CreateEmployeeSchema, UpdateEmployeeSchema } = loader.load("lib/employee-service.ts")
  const input = { employeeId: "FIXTURE", name: "Fixture staff", email: "fixture@example.invalid" }
  assert.equal(CreateEmployeeSchema.safeParse(input).success, true)
  for (const fields of [{ dashboardAccess: "true" }, { dashboardAccess: true, allowedPages: [] },
    { dashboardAccess: true, allowedPages: ["/admin/../users"] }, { storeAccess: "selected", storeIds: [] },
    { role: "Staff", sessionVersion: 0 }, { password: "FIXTURE@12345" }]) {
    const schema = "password" in fields ? UpdateEmployeeSchema : CreateEmployeeSchema
    assert.equal(schema.safeParse({ ...input, ...fields }).success, false)
  }
})

test("email verification resend derives identity from the session and reports rejected delivery instead of success", async () => {
  const ownerId = new ObjectId()
  const doc = { _id: ownerId, email: "fixture@example.invalid", name: "<img src=x>", emailVerified: false }
  let authorized = true
  const lookups = []
  const messages = []
  const route = sourceLoader({
    "@/lib/auth": { requireUser: async () => authorized ? { ok: true, user: { id: String(ownerId) } } :
      { ok: false, response: new Response("Unauthorized", { status: 401 }) } },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async query => { lookups.push(query); return doc },
      updateOne: async () => ({ acknowledged: true, matchedCount: 1 }),
    }) } }) },
    "@/lib/email": { sendEmail: async message => { messages.push(message); return { success: false, error: "Fixture rejection" } } },
  }).load("app/api/auth/verify-email/route.ts")
  const request = () => new NextRequest("https://fixture.invalid", { method: "POST", body: JSON.stringify({ userId: String(new ObjectId()) }) })
  assert.equal((await route.POST(request())).status, 502)
  assert.equal(String(lookups[0]._id), String(ownerId))
  assert.equal(messages[0].to, doc.email)
  assert.ok(messages[0].html.includes("&lt;img src=x&gt;"))
  assert.ok(!messages[0].html.includes("Hi <img"))
  authorized = false
  assert.equal((await route.POST(request())).status, 401)
  assert.equal(messages.length, 1)
})

test("email verification consumes only the current unexpired token and rejects malformed expiry or stale writes", async () => {
  const doc = { _id: new ObjectId(), email: "fixture@example.invalid", emailVerificationToken: "fixture-token",
    emailVerificationExpiry: new Date(Date.now() + 60000) }
  const queries = []
  let modifiedCount = 1
  const route = sourceLoader({
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async () => doc,
      updateOne: async query => { queries.push(query); return { acknowledged: true, modifiedCount } },
    }) } }) },
  }).load("app/api/auth/verify-email/route.ts")
  const request = () => new NextRequest(`https://fixture.invalid?token=fixture-token&userId=${doc._id}`)
  assert.ok((await route.GET(request())).headers.get("location").endsWith("status=success"))
  assert.equal(queries[0].emailVerificationToken, "fixture-token")
  assert.equal(queries[0].emailVerificationExpiry, doc.emailVerificationExpiry)
  modifiedCount = 0
  assert.ok((await route.GET(request())).headers.get("location").endsWith("status=invalid"))
  doc.emailVerificationExpiry = "invalid"
  assert.ok((await route.GET(request())).headers.get("location").endsWith("status=expired"))
  assert.equal(queries.length, 2)
})

test("lead writes and exports guard themselves; list/export share literal search and valid date ranges", async () => {
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: false, response: new Response("Forbidden", { status: 403 }) }) },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
  })
  const route = loader.load("app/api/leads/route.ts")
  const exported = loader.load("app/api/leads/export/route.ts")
  for (const method of ["PATCH", "DELETE"]) assert.equal((await route[method](new Request("https://fixture.invalid"))).status, 403)
  assert.equal((await exported.GET(new Request("https://fixture.invalid"))).status, 403)
  const { LeadQuerySchema, buildLeadFilter } = loader.load("lib/lead-query.ts")
  for (const input of [{ page: "1junk" }, { limit: 0 }, { search: "x".repeat(201) },
    { startDate: "2026-02-30" }, { startDate: "2026-10-12", endDate: "2026-10-01" }]) {
    assert.equal(LeadQuerySchema.safeParse(input).success, false)
  }
  const filter = buildLeadFilter(LeadQuerySchema.parse({ search: "Fixture.*", startDate: "2026-10-01", endDate: "2026-10-12" }))
  assert.equal(filter.$or[0].name.$regex, "Fixture\\.\\*")
  assert.equal(filter.createdAt.$gte.toISOString(), "2026-10-01T00:00:00.000Z")
  assert.equal(filter.createdAt.$lte.toISOString(), "2026-10-12T23:59:59.999Z")
  const { CreateLeadSchema, UpdateLeadSchema } = loader.load("lib/validation.ts")
  assert.equal(CreateLeadSchema.safeParse({ name: {}, phone: 10, pincode: false }).success, false)
  assert.equal(UpdateLeadSchema.safeParse({ id: String(new ObjectId()), status: "converted", createdAt: "spoofed" }).success, false)
})

test("brand editor validates legacy nullable fields and fills only supported display defaults", () => {
  const { brandEditorListSchema } = sourceLoader().load("lib/brand-landing-response.ts")
  const result = brandEditorListSchema.parse({ success: true, brands: [{
    _id: "fixture", name: "Fixture", slug: "fixture", banners: null, categories: null,
    whyChoose: null, productsSection: null, heroContent: null, enabled: null,
  }] })
  assert.equal(result.brands[0]._id, "fixture")
  assert.equal(result.brands[0].heroContent.title, "FIXTURE")
  assert.equal(result.brands[0].enabled, true)
  assert.equal(result.brands[0].accentColor, "blue")
  assert.equal(result.brands[0].banners.length, 0)
  assert.equal(brandEditorListSchema.safeParse({ success: true, brands: [{ _id: "fixture", name: "Fixture", features: [{}] }] }).success, false)
})

test("marketing coupon previews reject inactive, expired, not-yet-started and exhausted codes and describe buy-get correctly", async () => {
  const coupon = { code: "FIXTURE", name: "Fixture", type: "percentage", value: 10, active: true, noEndDate: true }
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/db-service": { getCollection: async () => ({ findOne: async () => coupon }) },
  }).load("app/api/admin/marketing/templates/route.ts")
  const request = () => new NextRequest("https://fixture.invalid?coupon=FIXTURE")
  for (const fields of [{ active: false }, { noEndDate: false, endDate: "2000-01-01" },
    { startDate: "2999-01-01" }, { usageLimit: 1, usageCount: 1 }, { type: "percentage", value: 101 }]) {
    const original = { ...coupon }
    Object.assign(coupon, fields)
    assert.equal((await route.GET(request())).status, 400)
    for (const key of Object.keys(coupon)) delete coupon[key]
    Object.assign(coupon, original)
  }
  Object.assign(coupon, { type: "buy_get", value: 0, buyQty: 2, getQty: 1 })
  const response = await route.GET(request())
  assert.equal(response.status, 200)
  assert.equal((await response.json()).coupon.note, "Buy 2, get 1 free on eligible products")
})

test("pincode writes reject malformed modes, list names and entries before accessing the database", async () => {
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
  }).load("app/api/blocked-pincodes/route.ts")
  for (const body of [{ mode: "anything" }, { pincode: "560001", listType: "anything" },
    { pincode: "56000", listType: "blocked" }, { pincode: 560001, listType: "allowed" },
    { pincode: "560001", listType: "blocked", state: {} }]) {
    assert.equal((await route.POST(new Request("https://fixture.invalid", { method: "POST", body: JSON.stringify(body) }))).status, 400)
  }
})

test("software license reads guard themselves and preserve native/string identifiers without leaking MongoDB IDs", async () => {
  let authorized = false
  let query
  const doc = { _id: new ObjectId(), softwareId: new ObjectId(), key: "fixture-key", assigned: false, orderId: null }
  const normalizeId = sourceLoader().load("lib/db-service.ts").normalizeId
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: new Response("Forbidden", { status: 403 }) } },
    "@/lib/db-service": { normalizeId, getCollection: async () => ({ find: input => {
      query = input
      return { sort: () => ({ toArray: async () => [doc] }) }
    } }) },
  }).load("app/api/software-licenses/route.ts")
  const request = () => new NextRequest(`https://fixture.invalid?softwareId=${doc.softwareId}`)
  assert.equal((await route.GET(request())).status, 403)
  authorized = true
  const response = await route.GET(request())
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result[0].id, String(doc._id))
  assert.equal(result[0]._id, undefined)
  assert.equal(query.softwareId.$in.length, 2)
  assert.equal((await route.GET(new NextRequest("https://fixture.invalid?softwareId=invalid"))).status, 400)
})

test("bulk specification upload rejects invalid MRP and preserves locked rows with a native lock predicate", async () => {
  const writes = []
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: name => name === "products" ? {
      findOne: async () => ({ _id: new ObjectId(), name: "Fixture" }),
    } : {
      createIndex: async () => "sku_unique",
      findOne: async query => query.sku === "LOCKED" ? { sku: "LOCKED", locked: true } : null,
      updateOne: async (query, update) => { writes.push({ query, update }); return { acknowledged: true, matchedCount: 1 } },
    } } }) },
  }).load("app/api/products/specifications/upload/route.ts")
  const response = await route.POST(new NextRequest("https://fixture.invalid", { method: "POST", body: JSON.stringify({
    specifications: [
      { sku: "LOCKED", name: "Bypass" }, { sku: "NEGATIVE", mrp: "-100" }, { sku: "JUNK", mrp: "100oops" },
      { sku: "VALID", mrp: "₹1,250", name: "Fixture", specification_images: ["https://fixture.invalid/image.png"] },
    ],
  }) }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.success, 1)
  assert.equal(body.skipped, 1)
  assert.equal(body.failed, 2)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].query.locked.$ne, true)
  assert.equal(writes[0].update.$set.mrp, 1250)
})

test("shared error messages preserve Error and provider-object text without trusting malformed thrown values", () => {
  const { getErrorMessage } = sourceLoader().load("lib/utils.ts")
  assert.equal(getErrorMessage(new Error("Fixture failure"), "Fallback"), "Fixture failure")
  assert.equal(getErrorMessage({ message: "Provider failure" }, "Fallback"), "Provider failure")
  for (const value of [null, undefined, "thrown text", 1, { message: 10 }, { message: "" }]) {
    assert.equal(getErrorMessage(value, "Fallback"), "Fallback")
  }
})

test("theme normalization preserves supported tokens, effects and scheduling with unknown input guards", () => {
  const theme = sourceLoader().load("lib/theme/index.ts")
  for (const input of [null, undefined, [], 1]) assert.equal(theme.normalizeTheme(input).id, theme.DEFAULT_THEME.id)
  const normalized = theme.normalizeTheme({
    id: "fixture", tokens: { primary: "#123456", accent: "invalid" }, effect: "confetti", pattern: "rangoli",
    intensity: "grand", radius: 1.5, startsAt: "2026-10-01", endsAt: "2026-10-31",
  })
  assert.equal(normalized.tokens.primary, "#123456")
  assert.equal(normalized.tokens.accent, theme.DEFAULT_THEME.tokens.accent)
  assert.equal(normalized.effect, "confetti")
  assert.equal(normalized.intensity, "grand")
  assert.equal(normalized.radius, 1.5)
  assert.equal(theme.isThemeActive(normalized, new Date("2026-10-12")), true)
  assert.equal(theme.isThemeActive(normalized, new Date("2026-11-01")), false)
  assert.throws(() => theme.normalizeTheme({ startsAt: "invalid" }), /Invalid theme scheduling date/)
})

test("typed rewards history retains legacy string amounts and Date timestamps", async () => {
  const now = new Date(Date.now() - 1000)
  const ledgerId = new ObjectId()
  const collections = {
    loyalty_ledger: [{ _id: ledgerId, userId: "fixture-user", type: "redeem", points: "-100", orderId: "FIXTURE", reason: "Fixture", createdAt: now, expiresAt: null }],
    orders: [{ _id: new ObjectId(), orderId: "FIXTURE", total: "200000", createdAt: now, deliveredAt: now }],
  }
  const service = sourceLoader({ "@/lib/db-service": { getCollection: async name => {
    assert.ok(collections[name])
    return { find: () => ({ project() { return this }, toArray: async () => collections[name] }) }
  } } }).load("lib/loyalty.ts")
  const result = await service.getLoyaltySnapshot("fixture-user")
  assert.equal(result.balance, 100)
  assert.equal(result.lifetimeEarned, 200)
  assert.equal(result.lifetimeRedeemed, 100)
  assert.equal(result.history.find(value => value.type === "redeem").id, ledgerId.toString())
})

test("PDF native text contracts skip marked-content entries while preserving specification rows", async () => {
  const { jsPDF } = await import("jspdf")
  const document = new jsPDF()
  document.text("Synthetic fixture spec sheet", 10, 10)
  const bytes = new Uint8Array(document.output("arraybuffer"))
  const text = (str, x, y) => ({ str, transform: [1, 0, 0, 12, x, y], height: 12 })
  const scraper = sourceLoader({
    unpdf: { getDocumentProxy: async () => ({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [
        { type: "beginMarkedContent" }, text("LG Fixture Television", 10, 100),
        text("Model", 10, 80), text("FIXTURE55", 200, 80),
        text("Screen size", 10, 60), text("55 inches", 200, 60), { type: "endMarkedContent" },
      ] }) }),
      getMetadata: async () => ({ info: { Author: "LG" } }),
    }) },
    "@/lib/media-ingest": { ingestImage: async () => { throw new Error("Unexpected image persistence") } },
  }).load("lib/scrapers/pdf.ts")
  const product = await scraper.scrapePdf(bytes, "fixture.pdf")
  assert.equal(product.sap.charDesc, "FIXTURE55")
  assert.equal(product.technicalDetails["Screen size"], "55 inches")
  assert.equal(product.images.length, 0)
})

function externalQueueAdminFixture() {
  const orderId = new ObjectId()
  const queue = { _id: `exlr8:${orderId}`, orderId: "FIXTURE-ORDER", status: "queued", attempts: 0 }
  const order = { _id: orderId, orderId: queue.orderId, status: "confirmed", paymentVerification: { verified: true },
    externalFulfillment: { status: "queued", updatedAt: new Date() } }
  let activeSession
  let writes = 0
  let ended = 0
  let failedQueue = false
  let failedLookup = false
  const normalizeId = sourceLoader().load("lib/db-service.ts").normalizeId
  const collections = {
    external_orders: {
      findOne: async (query, options) => {
        assert.equal(options.session, activeSession)
        if (failedLookup) throw new Error("Fixture queue read failed")
        return String(query._id) === String(queue._id) ? { ...queue } : null
      },
      updateOne: async (query, update, options) => {
        assert.equal(options.session, activeSession)
        writes++
        if (failedQueue) throw new Error("Fixture queue write failed")
        if (queue.status !== query.status) return { modifiedCount: 0 }
        Object.assign(queue, update.$set)
        return { modifiedCount: 1 }
      },
    },
    orders: {
      findOne: async (query, options) => {
        assert.equal(options.session, activeSession)
        return String(query._id) === String(order._id) && query.orderId === order.orderId ? { ...order } : null
      },
      updateOne: async (query, update, options) => {
        assert.equal(options.session, activeSession)
        writes++
        if (order.externalFulfillment.status !== query["externalFulfillment.status"]) return { modifiedCount: 0 }
        Object.assign(order, update.$set)
        return { modifiedCount: 1 }
      },
    },
  }
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const savedOrder = { ...order, externalFulfillment: { ...order.externalFulfillment } }
        const savedQueue = { ...queue }
        activeSession = session
        try { return await operation() } catch (error) {
          for (const key of Object.keys(queue)) delete queue[key]
          Object.assign(queue, savedQueue)
          Object.assign(order, savedOrder)
          throw error
        } finally { activeSession = undefined }
      },
      endSession: async () => { ended++ },
    }
    return session
  } }
  const loader = sourceLoader({
    "@/lib/db-service": { normalizeId, getCollection: async name => { assert.ok(collections[name]); return collections[name] } },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client }) },
  })
  return { queue, order, loader, service: loader.load("lib/external-fulfillment.ts"), writes: () => writes, ended: () => ended,
    failQueue: () => { failedQueue = true }, failLookup: () => { failedLookup = true } }
}

test("external queue cancellation atomically stops linked dispatch without refunding or changing the customer order", async () => {
  const fixture = externalQueueAdminFixture()
  const result = await fixture.service.manageQueuedExternalOrder(fixture.queue._id, "cancel", "fixture-operator")
  assert.equal(result.item.id, fixture.queue._id)
  assert.equal("_id" in result.item, false)
  assert.equal(fixture.queue.status, "cancelled")
  assert.equal(fixture.queue.cancelledBy, "fixture-operator")
  assert.equal(fixture.order.externalFulfillment.status, "cancelled")
  assert.equal(fixture.order.status, "confirmed")
  assert.equal(fixture.order.paymentVerification.verified, true)
  const repeat = await fixture.service.manageQueuedExternalOrder(fixture.queue._id, "cancel", "fixture-operator")
  assert.equal(repeat.message, "Already cancelled")
  assert.equal(fixture.writes(), 2)
  assert.equal(fixture.ended(), 2)
})

test("external queue retry checks never issue or falsely acknowledge a second provider placement", async () => {
  const fixture = externalQueueAdminFixture()
  const result = await fixture.service.manageQueuedExternalOrder(fixture.queue._id, "retry", "fixture-operator")
  assert.match(result.message, /No provider placement was retried/)
  assert.equal(fixture.queue.attempts, 0)
  assert.equal(fixture.writes(), 0)
})

test("external queue actions reject every attempted, uncertain or legacy provider state", async () => {
  for (const status of ["attempting", "placed", "needs_reconciliation", "failed", "cancelled"]) {
    const fixture = externalQueueAdminFixture()
    fixture.queue.status = status
    for (const action of ["cancel", "retry"]) {
      await assert.rejects(fixture.service.manageQueuedExternalOrder(fixture.queue._id, action, "fixture-operator"), error => error.status === 409)
    }
    assert.equal(fixture.writes(), 0)
  }
  for (const fields of [{ attempts: 1 }, { attempts: undefined }, { requestPayload: {} }, { response: {} }, { unitSeq: 1 }, { _id: new ObjectId() }]) {
    const fixture = externalQueueAdminFixture()
    Object.assign(fixture.queue, fields)
    await assert.rejects(fixture.service.manageQueuedExternalOrder(String(fixture.queue._id), "retry", "fixture-operator"), error => error.status === 409)
    assert.equal(fixture.writes(), 0)
  }
})

test("external cancellation cannot cancel a provider claim even while its queue row still appears queued", async () => {
  const fixture = externalQueueAdminFixture()
  fixture.order.externalFulfillment.status = "processing"
  await assert.rejects(fixture.service.manageQueuedExternalOrder(fixture.queue._id, "cancel", "fixture-operator"), error => error.status === 409)
  assert.equal(fixture.writes(), 0)
})

test("external queue write failure rolls back linked-order cancellation", async () => {
  const fixture = externalQueueAdminFixture()
  fixture.failQueue()
  await assert.rejects(fixture.service.manageQueuedExternalOrder(fixture.queue._id, "cancel", "fixture-operator"), /Fixture queue write failed/)
  assert.equal(fixture.queue.status, "queued")
  assert.equal(fixture.order.externalFulfillment.status, "queued")
  assert.equal(fixture.queue.cancelledBy, undefined)
  assert.equal(fixture.ended(), 1)
})

test("external queue lookup failures are not treated as invalid IDs or success-shaped fallback reads", async () => {
  const fixture = externalQueueAdminFixture()
  fixture.failLookup()
  await assert.rejects(fixture.service.manageQueuedExternalOrder(fixture.queue._id, "cancel", "fixture-operator"), /Fixture queue read failed/)
  assert.equal(fixture.writes(), 0)
})

test("external queue action handlers enforce admin identity before management", async () => {
  for (const action of ["cancel", "retry"]) {
    let calls = 0
    const route = sourceLoader({
      "@/lib/auth": { requireAdmin: async () => ({ ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) }) },
      "@/lib/external-fulfillment": { manageQueuedExternalOrder: async () => { calls++ } },
    }).load(`app/api/admin/external-orders/[id]/${action}/route.ts`)
    assert.equal((await route.POST(new NextRequest("http://localhost"), { params: Promise.resolve({ id: "fixture" }) })).status, 403)
    assert.equal(calls, 0)
  }
})

test("external queue pagination rejects invalid numeric inputs before accessing collections", async () => {
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, userId: "fixture-operator" }) },
    "@/lib/db-service": { getCollection: async () => { throw new Error("Unexpected database access") } },
  }).load("app/api/admin/external-orders/route.ts")
  for (const query of ["page=1.5", "page=-1", "page=Infinity", "limit=0", "limit=101", "limit=NaN", "page=9007199254740991&limit=100"]) {
    assert.equal((await route.GET(new NextRequest(`http://localhost/api/admin/external-orders?${query}`))).status, 400)
  }
})

test("spin prize schemas preserve valid legacy numeric strings and reject malformed schedules and counters", () => {
  const { SpinPrizeCreateSchema, SpinPrizeUpdateSchema } = sourceLoader().load("lib/validation.ts")
  const valid = { prizeName: "Fixture", total: "0", weightMultiplier: "1.5", isActive: false,
    dateRanges: [{ startDate: "2026-10-12", endDate: "2026-10-13" }], timeSlots: [{ startTime: "09:00", endTime: "17:30" }] }
  const parsed = SpinPrizeCreateSchema.parse(valid)
  assert.equal(parsed.total, 0)
  assert.equal(parsed.weightMultiplier, 1.5)
  assert.equal(parsed.isActive, false)
  for (const patch of [
    { total: -1 }, { total: 1.5 }, { total: "" }, { total: "1e999" }, { total: "1abc" },
    { total: Number.MAX_SAFE_INTEGER + 1 }, { weightMultiplier: 0 }, { isActive: "false" },
    { distributed: 0 }, { dateRanges: [{ startDate: "2026-02-30", endDate: "2026-03-01" }] },
    { dateRanges: [{ startDate: "2026-10-13", endDate: "2026-10-12" }] },
    { timeSlots: [{ startTime: "24:00", endTime: "25:00" }] },
    { timeSlots: [{ startTime: "17:00", endTime: "09:00" }] },
  ]) assert.equal(SpinPrizeCreateSchema.safeParse({ ...valid, ...patch }).success, false, JSON.stringify(patch))
  assert.equal(SpinPrizeUpdateSchema.safeParse({ prizeName: "Fixture" }).success, false)
  assert.equal(SpinPrizeUpdateSchema.safeParse({ prizeName: "Fixture", isActive: false }).success, true)
})

test("spin inventory writes honor the URL campaign, validate before lookup and atomically guard distributed counts", async () => {
  const requests = []
  let updated
  const collection = {
    findOneAndUpdate: async (query, changes, options) => {
      updated = { query, changes, options }
      return { _id: new ObjectId(), prizeName: "Fixture", distributed: 3, total: 4 }
    },
    findOne: async () => null,
    createIndex: async () => "prizeName_1",
    insertOne: async doc => { assert.equal(doc.total, 0); assert.equal(doc.isActive, false); return { acknowledged: true, insertedId: new ObjectId() } },
  }
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/spin-wheel-campaigns": { getCampaignCollection: async (slug, name) => { requests.push([slug, name]); return collection } },
  }).load("app/api/spin-wheel/admin/inventory/route.ts")
  const request = (method, body) => new NextRequest("http://localhost/api/spin-wheel/admin/inventory?campaignId=fixture-other", { method, body: JSON.stringify(body) })
  assert.equal((await route.PUT(request("PUT", { prizeName: "Fixture", total: 4 }))).status, 200)
  assert.deepEqual(requests[0], ["fixture-other", "inventory"])
  assert.equal(JSON.stringify(updated.query.$expr), JSON.stringify({ $lte: [{ $ifNull: ["$distributed", 0] }, 4] }))
  assert.equal(updated.options.upsert, undefined)
  assert.equal((await route.POST(request("POST", { prizeName: "Fixture", total: 0, isActive: false }))).status, 200)
  assert.equal((await route.PUT(request("PUT", { prizeName: "Fixture", total: -2 }))).status, 400)
  assert.equal(requests.length, 2)
  assert.equal((await route.DELETE(new NextRequest("http://localhost/api/spin-wheel/admin/inventory?id=bad", { method: "DELETE" }))).status, 400)
})

test("spin prize edits cannot upsert missing prizes or acknowledge an exhausted-counter conflict", async () => {
  let existing = null
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/spin-wheel-campaigns": { getCampaignCollection: async () => ({
      findOneAndUpdate: async () => null, findOne: async () => existing,
    }) },
  }).load("app/api/spin-wheel/admin/inventory/route.ts")
  const request = () => new NextRequest("http://localhost", { method: "PUT", body: JSON.stringify({ prizeName: "Fixture", total: 1 }) })
  assert.equal((await route.PUT(request())).status, 404)
  existing = { prizeName: "Fixture", distributed: 2 }
  assert.equal((await route.PUT(request())).status, 409)
})

test("spin code upload targets its campaign and deduplicates normalized input with truthful counts", async () => {
  let inserted
  let lookups = 0
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => ({
      withTransaction: async operation => operation(), endSession: async () => {},
    }) } }) },
    "@/lib/spin-wheel-campaigns": { getCampaignCollection: async (slug, name) => {
      lookups++
      assert.equal(slug, "fixture-campaign")
      assert.equal(name, "couponCodes")
      return {
        createIndex: async (keys, options) => { assert.equal(keys.code, 1); assert.equal(options.unique, true) },
        find: () => ({ toArray: async () => [{ code: "OLD" }] }),
        insertMany: async docs => { inserted = docs; return { acknowledged: true, insertedCount: docs.length } },
      }
    } },
  }).load("app/api/spin-wheel/admin/coupon-codes/route.ts")
  const request = body => new NextRequest("http://localhost/api/spin-wheel/admin/coupon-codes?campaignId=fixture-campaign", { method: "POST", body: JSON.stringify(body) })
  const response = await route.POST(request({ prizeName: "Fixture", codes: ["new", "NEW ", "old"] }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.added, 1)
  assert.equal(body.skipped, 2)
  assert.equal(inserted[0].code, "NEW")
  assert.equal((await route.POST(request({ prizeName: "Fixture", codes: [{}] }))).status, 400)
  assert.equal(lookups, 1)
})

test("spin campaign deletion does not swallow a database failure or delete metadata after a failed shard drop", async () => {
  let deleted = 0
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/spin-wheel-campaigns": {
      findCampaignBySlug: async () => ({ name: "Fixture" }),
      getCampaignsCollection: async () => ({ deleteOne: async () => { deleted++; return { acknowledged: true, deletedCount: 1 } } }),
    },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { dropCollection: async () => { throw new Error("Fixture drop failure") } } }) },
  }).load("app/api/spin-wheel/admin/campaigns/[slug]/route.ts")
  assert.equal((await route.DELETE(new NextRequest("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ slug: "fixture" }) })).status, 500)
  assert.equal(deleted, 0)
})

test("specification image hook validates actual responses, preserves legacy strings and does not swallow outages", async () => {
  let data
  let response = Response.json({ specification_images: ["a", "b", "c", "d", "e", "f"] })
  let fetcher
  let options
  const loader = sourceLoader({
    swr: (key, load, config) => { assert.equal(key, "/api/products/specifications/FIXTURE"); fetcher = load; options = config; return { data } },
  }, { fetch: async () => response })
  const { useProductSpecImages } = loader.load("hooks/useProductSpecImages.ts")
  assert.equal(JSON.stringify(useProductSpecImages("FIXTURE")), "[]")
  data = await fetcher("/api/fixture")
  assert.equal(JSON.stringify(useProductSpecImages("FIXTURE")), JSON.stringify(["a", "b", "c", "d", "e"]))
  response = Response.json({ specification_images: "legacy" })
  data = await fetcher("/api/fixture")
  assert.equal(JSON.stringify(useProductSpecImages("FIXTURE")), '["legacy"]')
  response = new Response(null, { status: 404 })
  assert.equal(await fetcher("/api/fixture"), null)
  response = Response.json({ error: "fixture" }, { status: 500 })
  await assert.rejects(fetcher("/api/fixture"), /could not be loaded/)
  response = Response.json({ specification_images: [{}] })
  await assert.rejects(fetcher("/api/fixture"))
  assert.equal(typeof options.onError, "function")
})

test("delivery estimator handles both legacy string and object restrictions without approving malformed rule responses", async () => {
  for (const rules of [
    { blockedPincodes: ["560001"], mode: "blocked" },
    { blockedPincodes: [{ pincode: "560001" }], mode: "blocked" },
    { allowedPincodes: ["560002"], mode: "allowed" },
    { allowedPincodes: [{ pincode: "560002" }], mode: "allowed" },
    { allowedPincodes: [{}], mode: "allowed" },
  ]) {
    const effects = []
    const states = []
    const loader = sourceLoader({
      react: { useState: initial => [initial, value => states.push(value)], useEffect: effect => effects.push(effect) },
      "@/lib/store-data": { stores: [] },
      "@/lib/analytics": { analytics: { checkPincode: () => {} } },
    }, { fetch: async () => Response.json(rules),
      context: { localStorage: { getItem: () => "560001", setItem: () => {} } } })
    loader.load("components/DeliveryEstimator.tsx").default()
    effects[0]()
    await new Promise(resolve => setImmediate(resolve))
    const result = states.find(value => value && typeof value === "object" && "deliverable" in value)
    assert.equal(result?.deliverable, false, JSON.stringify(rules))
  }
})

test("in-store shortcut response validation rejects failures and primitive rows while preserving nullable legacy details", () => {
  const { InStoreOrderShortcutListSchema } = sourceLoader().load("lib/validation.ts")
  assert.equal(InStoreOrderShortcutListSchema.safeParse([{ paymentMethod: "instore", paymentDetails: null }, { paymentDetails: { verifiedEmail: "fixture@example.invalid" } }]).success, true)
  for (const response of [{ error: "outage" }, [null], ["primitive"], [{ paymentDetails: "invalid" }]]) {
    assert.equal(InStoreOrderShortcutListSchema.safeParse(response).success, false)
  }
})

test("product feeds return uncached 503 instead of publishing an empty successful catalogue on database failure", async () => {
  const loader = sourceLoader({
    "@/lib/seo-metadata": {
      getOriginFromHeaders: async () => "https://fixture.invalid", getSiteSettings: async () => ({}),
      getCompanyName: () => "Fixture", seoText: value => String(value),
    },
    "@/lib/mongodb": { connectToDatabase: async () => { throw new Error("Fixture catalogue outage") } },
  })
  for (const filename of ["app/feed.xml/route.ts", "app/feed/google-merchant.xml/route.ts"]) {
    const response = await loader.load(filename).GET()
    assert.equal(response.status, 503)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.doesNotMatch(await response.text(), /<rss|<item>/)
  }
})

test("merchant feed honors a legacy false shipping flag and retains real prices, identifiers and XML escaping", async () => {
  const fixtures = [
    { _id: new ObjectId(), name: "Fixture & <TV>", slug: "fixture-tv", price: 50, mrp: 60, image: "/fixture.png", stock: 2, sku: "FIXTURE-SKU", free_delivery: "false" },
    { _id: new ObjectId(), name: "Free shipping", slug: "fixture-free", price: 70, image: "/fixture.png", stock: 0, free_delivery: "true" },
  ]
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: name => {
      assert.equal(name, "products")
      const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => fixtures }
      return { find: query => { assert.equal(query.active, true); return cursor } }
    } } }) },
  }, { env: { NEXT_PUBLIC_SITE_URL: "https://fixture.invalid" } })
  const response = await loader.load("app/feed/google-merchant.xml/route.ts").GET()
  assert.equal(response.status, 200)
  const xml = await response.text()
  const items = xml.match(/<item>[\s\S]*?<\/item>/g)
  assert.equal(items.length, 2)
  assert.match(items[0], /&amp;/)
  assert.match(items[0], /&lt;/)
  assert.match(items[0], /<g:price>60\.00 INR<\/g:price>/)
  assert.match(items[0], /<g:sale_price>50\.00 INR<\/g:sale_price>/)
  assert.match(items[0], /<g:id>FIXTURE-SKU<\/g:id>/)
  assert.doesNotMatch(items[0], /<g:shipping>/)
  assert.match(items[1], /<g:shipping>/)
  assert.match(items[1], /<g:availability>out_of_stock<\/g:availability>/)
})

function couponFixture(overrides = {}) {
  const products = [
    { _id: new ObjectId(), sku: "FIXTURE-TV", price: 100, stock: 20, active: true, category: "fixture-category", brand: "Fixture" },
    { _id: "fixture-legacy", price: 50, stock: 20, active: true, category: "other-category", brand: "Other" },
  ]
  const software = [{ _id: "fixture-software", price: 200, active: true, sku: "FIXTURE-SOFTWARE" }]
  const coupon = { _id: new ObjectId(), code: "FIXTURE", name: "Fixture coupon", active: true, type: "percentage", value: 10,
    applyScope: "all", usageCount: 0, usageLimit: 0, perCustomerLimit: 0, usageByUser: [], ...overrides }
  let userId = null
  let writes = 0
  let failedWrites = false
  const querySessions = []
  const collections = {
    products: { find: (query, options) => {
      querySessions.push(options?.session)
      return { toArray: async () => products.filter(product => query.$or.some(condition =>
        Object.entries(condition).some(([key, value]) => value.$in.some(id => String(id) === String(product[key]))))) }
    } },
    software_products: { find: (query, options) => {
      querySessions.push(options?.session)
      return { toArray: async () => software.filter(product => query.$or.some(condition =>
        Object.entries(condition).some(([key, value]) => value.$in.some(id => String(id) === String(product[key]))))) }
    } },
    settings: { findOne: async () => ({ shippingFee: 99, freeShippingThreshold: 1000 }) },
    coupons: {
      findOne: async (query, options) => { querySessions.push(options?.session); return coupon.active && query.code === coupon.code ? { ...coupon } : null },
      updateOne: async (query, update, options) => {
        querySessions.push(options?.session)
        writes++
        if (failedWrites) return { modifiedCount: 0 }
        coupon.usageCount++
        if (update.$push) coupon.usageByUser.push(update.$push.usageByUser)
        if (options.arrayFilters) {
          const record = coupon.usageByUser.find(record => record.userId === options.arrayFilters[0]["user.userId"])
          record.count++
          record.lastUsed = update.$set["usageByUser.$[user].lastUsed"]
        }
        return { modifiedCount: 1 }
      },
    },
  }
  const loader = sourceLoader({
    "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products", COUPONS: "coupons" }, getCollection: async name => {
      assert.ok(collections[name], `Unexpected collection ${name}`)
      return collections[name]
    } },
    "@/lib/auth": {
      getCurrentUserId: async () => userId,
      requireUser: async () => userId ? { ok: true, user: { id: userId } } : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) },
    },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
  })
  return { products, software, coupon, querySessions, loader, pricing: loader.load("lib/order-pricing.ts"),
    route: loader.load("app/api/coupons/validate/route.ts"), user: id => { userId = id }, writes: () => writes,
    failWrite: () => { failedWrites = true },
    request: cart => new NextRequest("http://localhost/api/coupons/validate", { method: "POST", body: JSON.stringify({
      code: " fixture ", cart, userId: "spoofed-user",
    }) }),
  }
}

test("coupon preview ignores forged price and identity and agrees with charged pricing", async () => {
  const fixture = couponFixture()
  const items = [{ id: fixture.products[0]._id.toString(), quantity: 2, price: 1_000_000 }]
  const response = await fixture.route.POST(fixture.request(items))
  assert.equal(response.status, 200)
  const preview = await response.json()
  const order = await fixture.pricing.priceOrder(items, { couponCode: "fixture", userId: null })
  assert.equal(order.ok, true)
  assert.equal(preview.discount, 20)
  assert.equal(preview.discount, order.couponDiscount)
  assert.equal(preview.details.type, "percentage")
  assert.equal(fixture.writes(), 0)
})

test("coupon preview returns the stored removal policy and allows legacy coupons to be removed", async () => {
  for (const policy of [undefined, true, false]) {
    const fixture = couponFixture(policy === undefined ? {} : { couponRemovable: policy })
    const items = [{ id: fixture.products[0]._id.toString(), quantity: 1 }]
    const response = await fixture.route.POST(fixture.request(items))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).couponRemovable, policy !== false)
    const quote = await fixture.pricing.quoteCoupon(items, "FIXTURE", null)
    assert.equal(quote.ok, true)
    assert.equal(quote.coupon.couponRemovable, policy !== false)
  }
})

test("coupon preview resolves native, legacy, SKU and software identifiers with scoped catalogue prices", async () => {
  const fixture = couponFixture({ applyScope: "skus", skus: ["fixture-software"] })
  const response = await fixture.route.POST(fixture.request([
    { id: fixture.products[0]._id.toString(), quantity: 1 }, { id: "fixture-legacy", quantity: 1 },
    { id: "FIXTURE-SOFTWARE", quantity: 1 },
  ]))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).discount, 20)
})

test("per-customer coupons use live session identity and require guests to sign in", async () => {
  const fixture = couponFixture({ perCustomerLimit: 1, usageByUser: [{ userId: "real-user", count: 1 }] })
  const items = [{ id: "fixture-legacy", quantity: 1 }]
  assert.match((await (await fixture.route.POST(fixture.request(items))).json()).error, /Sign in/)
  fixture.user("real-user")
  assert.match((await (await fixture.route.POST(fixture.request(items))).json()).error, /Per-customer/)
  fixture.user("new-user")
  assert.equal((await fixture.route.POST(fixture.request(items))).status, 200)
})

for (const [label, fields, expected] of [
  ["future ISO date", { startDate: "2099-01-01T00:00:00Z" }, /not yet/],
  ["expired ISO date", { endDate: "2000-01-01T00:00:00Z" }, /expired/],
  ["malformed date", { endDate: "invalid" }, /dates are invalid/],
  ["exhausted global cap", { usageLimit: 1, usageCount: 1 }, /limit reached/],
  ["invalid global count", { usageCount: -1 }, /limits are invalid/],
  ["percentage over 100", { value: 101 }, /value is invalid/],
  ["invalid buy-get quantity", { type: "buy_get", buyQty: 0, getQty: 1 }, /quantities are invalid/],
]) {
  test(`shared coupon evaluation rejects ${label}`, async () => {
    const fixture = couponFixture(fields)
    const quote = await fixture.pricing.quoteCoupon([{ id: "fixture-legacy", quantity: 1 }], "FIXTURE", null)
    assert.equal(quote.ok, false)
    assert.match(quote.error, expected)
    assert.equal(fixture.writes(), 0)
  })
}

test("buy-get preserves cheapest-unit grouping without per-unit allocation", async () => {
  const fixture = couponFixture({ type: "buy_get", buyQty: 2, getQty: 1 })
  const quote = await fixture.pricing.quoteCoupon([
    { id: fixture.products[0]._id.toString(), quantity: 3 }, { id: "fixture-legacy", quantity: 3 },
  ], "FIXTURE", null)
  assert.equal(quote.ok, true)
  assert.equal(quote.coupon.discount, 100)
  assert.equal(quote.details.freeUnits, 2)
  fixture.products[1].price = 0.0001
  fixture.products[1].stock = 1_000_000_000
  const large = await fixture.pricing.quoteCoupon([{ id: "fixture-legacy", quantity: 1_000_000_000 }], "FIXTURE", null)
  assert.equal(large.ok, true)
  assert.equal(large.coupon.discount, 33333)
})

test("coupon discounts never exceed the eligible fractional subtotal", async () => {
  const fixture = couponFixture({ type: "fixed", value: 10 })
  fixture.products[1].price = 0.6
  const quote = await fixture.pricing.quoteCoupon([{ id: "fixture-legacy", quantity: 1 }], "FIXTURE", null)
  assert.equal(quote.ok, true)
  assert.equal(quote.coupon.discount, 0.6)
})

test("coupon preview rejects invalid JSON, missing catalogue lines and duplicate aliases", async () => {
  const fixture = couponFixture()
  assert.equal((await fixture.route.POST(new NextRequest("http://localhost/api/coupons/validate", { method: "POST", body: "{" }))).status, 400)
  for (const cart of [
    [{ id: "missing", quantity: 1 }],
    [{ id: "fixture-legacy", quantity: 1 }, { id: "fixture-legacy", quantity: 1 }],
    [{ id: "fixture-legacy", quantity: 0 }],
    Array.from({ length: 21 }, () => ({ id: "fixture-legacy", quantity: 1 })),
  ]) assert.equal((await fixture.route.POST(fixture.request(cart))).status, 400)
})

test("transactional coupon consumption rechecks limits and uses one session for every read and write", async () => {
  const fixture = couponFixture({ perCustomerLimit: 2 })
  const session = { fixture: true }
  const items = [{ id: "fixture-legacy", quantity: 1 }]
  const expected = { code: "FIXTURE", name: "Fixture coupon", discount: 5 }
  const consume = () => fixture.pricing.consumeOrderCoupon(items, expected, "real-user", session)
  assert.equal((await consume()).ok, true)
  assert.equal((await consume()).ok, true)
  assert.equal((await consume()).ok, false)
  assert.equal(fixture.coupon.usageCount, 2)
  assert.equal(fixture.coupon.usageByUser.length, 1)
  assert.equal(fixture.coupon.usageByUser[0].count, 2)
  assert.ok(fixture.querySessions.every(value => value === session))
})

test("transactional coupon consumption rejects changed discounts and unacknowledged writes", async () => {
  const fixture = couponFixture()
  const items = [{ id: "fixture-legacy", quantity: 1 }]
  assert.equal((await fixture.pricing.consumeOrderCoupon(items, { code: "FIXTURE", discount: 99 }, null, {})).ok, false)
  assert.equal(fixture.writes(), 0)
  fixture.failWrite()
  assert.equal((await fixture.pricing.consumeOrderCoupon(items, { code: "FIXTURE", discount: 5 }, null, {})).ok, false)
})

test("retired client coupon redemption cannot mutate usage or double-count an order", async () => {
  const fixture = couponFixture()
  const route = fixture.loader.load("app/api/coupons/redeem/route.ts")
  assert.equal((await route.POST()).status, 401)
  fixture.user("real-user")
  assert.equal((await route.POST()).status, 410)
  assert.equal(fixture.writes(), 0)
})

function couponAdminFixture() {
  const now = new Date("2026-01-01T00:00:00Z")
  let stored = {
    _id: new ObjectId(), code: "FIXTURE", name: "Fixture", active: false, type: "fixed", value: 10,
    applyScope: "categories", categoryIds: ["fixture-category"], productIds: [], brands: [], skus: [],
    noEndDate: true, usageLimit: 0, perCustomerLimit: 0, usageCount: 9, usageByUser: [{ userId: "fixture-user", count: 9 }],
    createdAt: now, updatedAt: now,
  }
  let allowed = true
  let writes = 0
  let reads = 0
  let conflict = false
  let failRead = false
  const normalizeId = sourceLoader().load("lib/db-service.ts").normalizeId
  const col = {
    find: () => {
      reads++
      if (failRead) throw new Error("Fixture database down")
      return { sort() { return this }, toArray: async () => [stored] }
    },
    findOne: async query => {
      reads++
      if (query._id?.$ne) return null
      if (query._id) return { ...stored }
      return null
    },
    insertOne: async document => {
      writes++
      stored = { ...document, _id: new ObjectId() }
      return { insertedId: stored._id }
    },
    findOneAndUpdate: async (filter, update) => {
      writes++
      assert.equal(filter.updatedAt, stored.updatedAt)
      assert.equal("usageCount" in update.$set, false)
      assert.equal("usageByUser" in update.$set, false)
      if (conflict) return null
      stored = { ...stored, ...update.$set }
      return stored
    },
  }
  const loader = sourceLoader({
    "@/lib/db-service": { COLLECTIONS: { COUPONS: "coupons" }, normalizeId, getCollection: async () => col },
    "@/lib/auth": { requireAdmin: async () => allowed ? { ok: true } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) } },
  })
  return { loader, stored: () => stored, writes: () => writes, reads: () => reads,
    context: { params: Promise.resolve({ id: stored._id.toString() }) },
    request: value => new NextRequest("http://localhost/api/coupons/fixture", { method: "PUT", body: JSON.stringify(value) }),
    deny: () => { allowed = false }, conflict: () => { conflict = true }, failRead: () => { failRead = true },
  }
}

test("coupon creation and individual reads enforce independent admin guards before data access", async () => {
  const fixture = couponAdminFixture()
  fixture.deny()
  const route = fixture.loader.load("app/api/coupons/route.ts")
  assert.equal((await route.POST(fixture.request({}))).status, 403)
  assert.equal((await fixture.loader.load("app/api/coupons/[id]/route.ts").GET(fixture.request({}), fixture.context)).status, 403)
  assert.equal(fixture.reads(), 0)
  assert.equal(fixture.writes(), 0)
})

test("admin can create buy-get SKU coupons with zero placeholder value and unlimited caps", async () => {
  const fixture = couponAdminFixture()
  const route = fixture.loader.load("app/api/coupons/route.ts")
  const response = await route.POST(fixture.request({
    code: " fixture-sku ", name: "Fixture", type: "buy_get", value: 0, buyQty: 2, getQty: 1,
    applyScope: "skus", skus: ["FIXTURE-SKU"], usageLimit: 0, perCustomerLimit: 0,
  }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.coupon.code, "FIXTURE-SKU")
  assert.equal(body.coupon.id, fixture.stored()._id.toString())
  assert.equal("_id" in body.coupon, false)
  assert.equal(body.coupon.value, 0)
  assert.equal(body.coupon.usageLimit, 0)
})

test("partial coupon edits preserve inactive flags, eligible categories, dates and usage history", async () => {
  const fixture = couponAdminFixture()
  const previousTime = fixture.stored().updatedAt.getTime()
  const response = await fixture.loader.load("app/api/coupons/[id]/route.ts").PUT(fixture.request({ name: "Updated" }), fixture.context)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.coupon.name, "Updated")
  assert.equal(body.coupon.active, false)
  assert.equal(body.coupon.noEndDate, true)
  assert.deepEqual(body.coupon.categoryIds, ["fixture-category"])
  assert.equal(body.coupon.usageCount, 9)
  assert.equal(body.coupon.usageByUser[0].count, 9)
  assert.ok(fixture.stored().updatedAt.getTime() > previousTime)
})

test("coupon removal policy is saved, preserved by partial edits and can be changed", async () => {
  const fixture = couponAdminFixture()
  const route = fixture.loader.load("app/api/coupons/[id]/route.ts")
  for (const patch of [{ couponRemovable: false }, { name: "Updated" }, { couponRemovable: true }]) {
    const response = await route.PUT(fixture.request(patch), fixture.context)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).coupon.couponRemovable, patch.couponRemovable === true)
  }
  assert.equal(fixture.stored().usageCount, 9)
  assert.equal((await route.PUT(fixture.request({ couponRemovable: "false" }), fixture.context)).status, 400)
})

test("coupon write schemas reject forged usage, invalid dates and percentage or buy-get terms", async () => {
  const fixture = couponAdminFixture()
  const route = fixture.loader.load("app/api/coupons/[id]/route.ts")
  for (const patch of [
    { usageCount: 0 }, { "usageByUser.0.count": 0 }, { active: "false" }, { endDate: "invalid" },
    { type: "percentage", value: 101 }, { type: "buy_get", buyQty: 0, getQty: 1 },
    { startDate: "2026-10-12", endDate: "2026-10-11", noEndDate: false },
  ]) assert.equal((await route.PUT(fixture.request(patch), fixture.context)).status, 400)
  assert.equal(fixture.writes(), 0)
})

test("coupon admin concurrent edits produce a conflict instead of a false save acknowledgement", async () => {
  const fixture = couponAdminFixture()
  fixture.conflict()
  const response = await fixture.loader.load("app/api/coupons/[id]/route.ts").PUT(fixture.request({ name: "Updated" }), fixture.context)
  assert.equal(response.status, 409)
  assert.equal(fixture.stored().name, "Fixture")
})

test("coupon listing outage is an explicit error rather than a successful empty list", async () => {
  const fixture = couponAdminFixture()
  fixture.failRead()
  const response = await fixture.loader.load("app/api/coupons/route.ts").GET()
  assert.equal(response.status, 500)
  assert.equal((await response.json()).success, false)
})

test("coupon client schemas require normalized mutation IDs and positive finite quote amounts", () => {
  const schema = sourceLoader().load("lib/coupon-validation.ts")
  for (const value of [
    { success: false, coupons: [] }, { success: true, coupons: [{ _id: "fixture" }] },
  ]) assert.equal(schema.CouponListSchema.safeParse(value).success, false)
  assert.equal(schema.CouponMutationSchema.safeParse({ success: true, coupon: {} }).success, false)
  for (const discount of [0, -1, Infinity, "10"]) {
    assert.equal(schema.CouponQuoteSchema.safeParse({ success: true, code: "FIXTURE", name: "Fixture", discount }).success, false)
  }
})

test("authoritative shipping settings fail closed on outages or invalid amounts instead of using silent charges", async () => {
  for (const settings of [new Error("Fixture database down"), { shippingFee: -1 }, { shippingFee: "" },
    { shippingFee: true }, { freeShippingThreshold: Infinity }, { shippingFee: "invalid" }]) {
    const pricing = sourceLoader({
      "@/lib/db-service": { getCollection: async () => ({ findOne: async () => {
        if (settings instanceof Error) throw settings
        return settings
      } }) },
    }).load("lib/order-pricing.ts")
    await assert.rejects(pricing.getShippingSettings(), /Fixture database down|Shipping settings are invalid/)
  }
  const pricing = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({ findOne: async () => ({ shippingFee: 0, freeShippingThreshold: "1000" }) }) },
  }).load("lib/order-pricing.ts")
  const settings = await pricing.getShippingSettings()
  assert.equal(settings.shippingFee, 0)
  assert.equal(settings.freeShippingThreshold, 1000)
})

function amazonScraperFixture({ existing = false, failSpecs = false, authorized = true } = {}) {
  let product = existing ? { _id: new ObjectId(), sku: "FIXTURE", itemno: "FIXTURE", name: "Stored", stock: 7, price: 500 } : null
  let spec = null
  let activeSession
  let sessionsEnded = 0
  const requireSession = options => assert.equal(options?.session, activeSession)
  const products = {
    findOne: async (query, options) => { requireSession(options); return product ? { ...product } : null },
    insertOne: async (value, options) => {
      requireSession(options)
      product = { ...value, _id: new ObjectId() }
      return { insertedId: product._id }
    },
    updateOne: async (query, update, options) => {
      requireSession(options)
      assert.equal(query._id.toString(), product._id.toString())
      product = { ...product, ...update.$set }
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }
  const specs = { updateOne: async (query, update, options) => {
    requireSession(options)
    if (failSpecs) throw new Error("Fixture specification write failure")
    spec = update.$set
    return { matchedCount: 1 }
  } }
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const snapshot = product && { ...product }
        activeSession = session
        try { return await operation() } catch (error) { product = snapshot; spec = null; throw error } finally { activeSession = undefined }
      },
      endSession: async () => { sessionsEnded++ },
    }
    return session
  } }
  const html = '<html><span id="productTitle">Fixture television</span><div id="availability"><span>In stock</span></div><div id="feature-bullets"><ul><li>Fixture feature</li></ul></div></html>'
  const requests = []
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true, user: { id: "fixture-admin" } } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) } },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: { collection: name => {
      assert.ok(["products", "product_specifications"].includes(name))
      return name === "products" ? products : specs
    } } }) },
    axios: { get: async (url, options) => { requests.push({ url, options }); return { status: 200, data: html, headers: {} } }, isAxiosError: () => false },
  })
  const route = loader.load("app/api/scrape-amazon/route.ts")
  return { route, requests, product: () => product, spec: () => spec, sessionsEnded: () => sessionsEnded }
}

const amazonRequest = body => new Request("https://fixture.invalid/api/scrape-amazon", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})
const amazonBody = { url: "https://www.amazon.in/dp/B012345678", itemno: "FIXTURE", saveToDatabase: true }

function heroSlidesFixture() {
  const now = new Date("2026-01-01T00:00:00Z")
  const slides = [1, 2].map(index => ({
    _id: new ObjectId(), title: `Fixture ${index}`, subtitle: "", image: "data:image/png;base64,AAAA",
    cta: "Shop", link: "/products", active: true, order: index - 1, createdAt: now, updatedAt: now,
  }))
  let activeSession
  let failInsert = false
  let authorized = true
  let deleteCalls = 0
  let ended = 0
  const normalizeId = sourceLoader().load("lib/db-service.ts").normalizeId
  const col = {
    aggregate: (pipeline, options) => {
      if (activeSession) assert.equal(options?.session, activeSession)
      return { toArray: async () => slides.map(value => ({
        ...value, imageIsData: value.image.startsWith("data:"), imageLen: value.image.length,
        image: value.image.startsWith("data:") ? null : value.image,
      })) }
    },
    find: () => ({ sort() { return this }, limit() { return this }, toArray: async () => [...slides].sort((a, b) => b.order - a.order).slice(0, 1) }),
    insertOne: async document => {
      const insertedId = new ObjectId()
      slides.push({ ...document, _id: insertedId })
      return { insertedId }
    },
    deleteMany: async (query, options) => { assert.equal(options?.session, activeSession); deleteCalls++; slides.splice(0); return { deletedCount: 2 } },
    insertMany: async (documents, options) => {
      assert.equal(options?.session, activeSession)
      if (failInsert) throw new Error("Fixture slide insertion failure")
      slides.push(...documents)
    },
    findOneAndUpdate: async (query, update) => {
      const slide = slides.find(value => value._id.toString() === query._id.toString())
      if (!slide) return null
      Object.assign(slide, update.$set)
      return { ...slide }
    },
    deleteOne: async query => {
      const index = slides.findIndex(value => value._id.toString() === query._id.toString())
      if (index < 0) return { deletedCount: 0 }
      slides.splice(index, 1)
      return { deletedCount: 1 }
    },
  }
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const snapshot = structuredClone(slides)
        activeSession = session
        try { return await operation() } catch (error) { slides.splice(0, slides.length, ...snapshot); throw error } finally { activeSession = undefined }
      },
      endSession: async () => { ended++ },
    }
    return session
  } }
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) } },
    "@/lib/db-service": { COLLECTIONS: { HERO_SLIDES: "hero_slides" }, normalizeId, getCollection: async () => col },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client, db: { collection: name => { assert.equal(name, "hero_slides"); return col } } }) },
    "@/lib/media-store": { resolveMediaUrl: async value => {
      if (typeof value === "string" && value.startsWith("/api/media/hero-slide/")) {
        const id = value.split("/").at(-1).split("?")[0]
        return slides.find(slide => slide._id.toString() === id)?.image || value
      }
      return value
    } },
  }).load("app/api/hero-slides/route.ts")
  const bodySlides = () => slides.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString(), image: `/api/media/hero-slide/${_id}?v=26` }))
  return {
    route, slides, bodySlides, deleteCalls: () => deleteCalls, ended: () => ended,
    failInsert: value => { failInsert = value }, authorize: value => { authorized = value },
    request: (body, method = "POST") => new NextRequest("https://fixture.invalid/api/hero-slides", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  }
}

test("Hero-slide bulk save restores offloaded images and retains stable IDs in one transaction", async () => {
  const fixture = heroSlidesFixture()
  const input = fixture.bodySlides().reverse()
  const response = await fixture.route.POST(fixture.request({ slides: input }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(body.slides[0].id, input[0].id)
  assert.equal(Object.hasOwn(body.slides[0], "_id"), false)
  assert.ok(body.slides[0].image.startsWith(`/api/media/hero-slide/${input[0].id}`))
  assert.equal(fixture.slides[0].image, "data:image/png;base64,AAAA")
  assert.equal(fixture.slides[0].order, 0)
  assert.equal(fixture.ended(), 1)
})

test("Hero-slide bulk insertion failure rolls back the real handler's preceding deletion", async () => {
  const fixture = heroSlidesFixture()
  const before = structuredClone(fixture.slides)
  fixture.failInsert(true)
  assert.equal((await fixture.route.POST(fixture.request({ slides: fixture.bodySlides() }))).status, 500)
  assert.equal(fixture.deleteCalls(), 1)
  assert.equal(JSON.stringify(fixture.slides), JSON.stringify(before))
  assert.equal(fixture.ended(), 1)
})

test("Hero-slide missing media and duplicate IDs fail before deleting existing slides", async () => {
  const fixture = heroSlidesFixture()
  assert.equal((await fixture.route.POST(fixture.request({ slides: [{ image: `/api/media/hero-slide/${new ObjectId()}` }] }))).status, 422)
  const slide = fixture.bodySlides()[0]
  assert.equal((await fixture.route.POST(fixture.request({ slides: [slide, slide] }))).status, 400)
  assert.equal(fixture.deleteCalls(), 0)
  assert.equal(fixture.slides.length, 2)
})

test("Hero-slide mutations validate identities, link shape and typed fields before writing", async () => {
  const fixture = heroSlidesFixture()
  const id = fixture.slides[0]._id.toString()
  for (const input of [
    { id, active: "true" }, { id, link: "javascript:alert(1)" }, { id, order: -1 },
    { id, _id: new ObjectId().toString() }, { id: "bad", title: "Invalid" },
  ]) assert.equal((await fixture.route.PUT(fixture.request(input, "PUT"))).status, 400)
  assert.equal((await fixture.route.DELETE(new NextRequest("https://fixture.invalid?id=bad", { method: "DELETE" }))).status, 400)
  fixture.authorize(false)
  assert.equal((await fixture.route.POST(fixture.request({ slides: [] }))).status, 403)
  assert.equal(fixture.deleteCalls(), 0)
})

test("Hero-slide create and partial update return normalized offloaded acknowledgements without immutable field writes", async () => {
  const fixture = heroSlidesFixture()
  const created = await fixture.route.POST(fixture.request({ title: "Fixture", image: "data:image/png;base64,BBBB" }))
  assert.equal(created.status, 200)
  const createdBody = await created.json()
  assert.equal(typeof createdBody.slide.id, "string")
  assert.ok(createdBody.slide.image.startsWith("/api/media/hero-slide/"))
  assert.equal(fixture.slides.at(-1).order, 2)
  const existing = fixture.slides[0]
  const response = await fixture.route.PUT(fixture.request({ id: existing._id.toString(), active: false, createdAt: "attacker-date" }, "PUT"))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).slide.active, false)
  assert.equal(existing.createdAt.toISOString(), "2026-01-01T00:00:00.000Z")
})

test("Hero-slide response parsers preserve generated feature cards and reject corrupt caches", () => {
  const schemas = sourceLoader().load("lib/hero-slides.ts")
  const slide = {
    id: "fixture", title: "", subtitle: "", image: "/fixture.svg", cta: "", link: "/products", active: true,
    feature: { type: "product", name: "Fixture", price: 100, mrp: null, image: null, caption: null },
  }
  assert.equal(schemas.heroSlideListSchema.parse([slide])[0].feature.name, "Fixture")
  assert.equal(schemas.heroSlideListSchema.safeParse({ slides: [slide] }).success, false)
  assert.equal(schemas.heroSlideSaveSchema.safeParse({ success: true }).success, false)
  assert.equal(schemas.heroSlideListSchema.safeParse([{ ...slide, active: "true" }]).success, false)
})

test("Amazon create saves product and canonical specifications in one transaction", async () => {
  const fixture = amazonScraperFixture()
  const response = await fixture.route.POST(amazonRequest({ ...amazonBody, editedData: { price: 0, mrp: 0 } }))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.action, "created")
  assert.equal(data.product.id, fixture.product()._id.toString())
  assert.equal(Object.hasOwn(data.product, "_id"), false)
  assert.equal(fixture.spec().product_id, data.product.id)
  assert.equal(fixture.spec().sku, "FIXTURE")
  assert.ok(Array.isArray(fixture.spec().reviews))
  assert.equal(fixture.product().price, 0)
  assert.equal(fixture.product().mrp, 0)
  assert.equal(fixture.sessionsEnded(), 1)
})

test("Amazon enrichment preserves existing inventory and selling price", async () => {
  const fixture = amazonScraperFixture({ existing: true })
  const response = await fixture.route.POST(amazonRequest(amazonBody))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).action, "updated")
  assert.equal(fixture.product().stock, 7)
  assert.equal(fixture.product().price, 500)
  assert.equal(fixture.spec().product_id, fixture.product()._id.toString())
})

for (const existing of [false, true]) {
  test(`Amazon specification failure rolls back ${existing ? "update" : "create"} and never returns saved`, async () => {
    const fixture = amazonScraperFixture({ existing, failSpecs: true })
    const before = fixture.product()
    const response = await fixture.route.POST(amazonRequest(amazonBody))
    assert.equal(response.status, 500)
    const body = await response.json()
    assert.equal(body.success, false)
    assert.equal(body.error, "Failed to scrape product")
    assert.deepEqual(fixture.product(), before)
    assert.equal(fixture.spec(), null)
    assert.equal(fixture.sessionsEnded(), 1)
  })
}

test("Amazon preview does not persist; SKU alias remains compatible and conflicts are rejected", async () => {
  const preview = amazonScraperFixture()
  assert.equal((await preview.route.POST(amazonRequest({ url: amazonBody.url }))).status, 200)
  assert.equal(preview.product(), null)
  assert.equal(preview.sessionsEnded(), 0)
  const fixture = amazonScraperFixture()
  assert.equal((await fixture.route.POST(amazonRequest({ url: amazonBody.url, sku: "FIXTURE", saveToDatabase: true }))).status, 200)
  assert.equal(fixture.spec().sku, "FIXTURE")
  assert.equal((await fixture.route.POST(amazonRequest({ ...amazonBody, sku: "OTHER" }))).status, 400)
})

test("Amazon rejects unauthorized, malformed, credential-bearing and invalid edit requests before fetching", async () => {
  const denied = amazonScraperFixture({ authorized: false })
  assert.equal((await denied.route.POST(amazonRequest(amazonBody))).status, 403)
  assert.equal(denied.requests.length, 0)
  const fixture = amazonScraperFixture()
  for (const body of [
    { ...amazonBody, url: 123 }, { ...amazonBody, editedData: { features: "bad" } },
    { ...amazonBody, active: "true" }, { ...amazonBody, editedData: { price: -1 } },
    { ...amazonBody, url: "https://user:password@amazon.in/dp/B012345678" },
    { ...amazonBody, url: "https://amazon.in:8443/dp/B012345678" },
  ]) assert.equal((await fixture.route.POST(amazonRequest(body))).status, 400)
  assert.equal((await fixture.route.POST(new Request("https://fixture.invalid", { method: "POST", body: "{" }))).status, 400)
  assert.equal(fixture.requests.length, 0)
})

test("Amazon country domain is derived from hostname rather than tracking text", async () => {
  const fixture = amazonScraperFixture()
  assert.equal((await fixture.route.POST(amazonRequest({ url: "https://www.amazon.co.uk/dp/B012345678?tag=amazon.in" }))).status, 200)
  assert.equal(fixture.requests[0].url, "https://www.amazon.co.uk/dp/B012345678")
})

test("Bounded source fetch checks every redirect before requesting and enforces transport limits", async () => {
  const requests = []
  const loader = sourceLoader({ axios: { get: async (url, options) => {
    requests.push({ url, options })
    return { status: 302, headers: { location: "http://127.0.0.1/private" }, data: "" }
  } } })
  const http = loader.load("lib/scrapers/http.ts")
  await assert.rejects(http.fetchHtml("https://www.amazon.in/dp/B012345678"), /destination is not permitted/)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].options.maxRedirects, 0)
  assert.equal(requests[0].options.maxContentLength, 8 * 1024 * 1024)
  assert.equal(http.detectSource("https://user:password@amazon.in/private"), null)
  assert.equal(http.detectSource("https://amazon.in:8443/private"), null)
})

test("Bounded source fetch follows relative redirects, stops loops and rejects non-text payloads", async () => {
  let mode = "relative"
  const requests = []
  const http = sourceLoader({ axios: { get: async url => {
    requests.push(url)
    if (mode === "object") return { status: 200, data: {}, headers: {} }
    if (mode === "loop" || url.endsWith("/start")) return { status: 302, data: "", headers: { location: "/finish" } }
    return { status: 200, data: "<h1>Fixture</h1>", headers: {} }
  } } }).load("lib/scrapers/http.ts")
  const response = await http.fetchHtml("https://amazon.in/start")
  assert.equal(response.finalUrl, "https://amazon.in/finish")
  assert.equal(requests.length, 2)
  mode = "loop"
  await assert.rejects(http.resolveRedirect("https://amzn.in/start"), /invalid redirect chain/)
  const short = sourceLoader({ axios: { get: async url => url.includes("/s/")
    ? { status: 200, data: '<a href="https://www.flipkart.com/samsung-fridge/p/itm123?pid=ABC">Open</a>', headers: {} }
    : { status: 200, data: "<h1>Product</h1>", headers: {} },
  } }).load("lib/scrapers/http.ts")
  assert.equal(await short.resolveRedirect("https://dl.flipkart.com/s/ZunNveuuuN"), "https://www.flipkart.com/samsung-fridge/p/itm123?pid=ABC")
  const buried = sourceLoader({ axios: { get: async () => ({ status: 200, headers: {}, data: '<a href="https://www.flipkart.com/">Home</a><a href="https://dl.flipkart.com/dl/samsung-fridge/p/itm123?pid=ABC">Open</a>' }) } }).load("lib/scrapers/http.ts")
  assert.equal(await buried.resolveRedirect("https://dl.flipkart.com/s/ZunNveuuuN"), "https://www.flipkart.com/samsung-fridge/p/itm123?pid=ABC")
  mode = "object"
  await assert.rejects(http.fetchHtml("https://amazon.in/start"), /did not return text/)
})

test("Scraped-product reads require admin and normalize IDs; removal is idempotent", async () => {
  const id = new ObjectId()
  let authorized = false
  let reads = 0
  const route = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) } },
    "@/lib/db-service": {
      normalizeId: value => { const { _id, ...rest } = value; return { ...rest, id: _id.toString() } },
      getCollection: async () => ({
        findOne: async () => { reads++; return { _id: id, name: "Fixture" } },
        updateOne: async () => ({ matchedCount: 1, modifiedCount: 0 }),
      }),
    },
  }).load("app/api/scraped-products/route.ts")
  assert.equal((await route.GET(new Request("https://fixture.invalid?id=bad"))).status, 403)
  authorized = true
  assert.equal((await route.GET(new Request("https://fixture.invalid?id=bad"))).status, 400)
  assert.equal((await route.DELETE(new Request("https://fixture.invalid?id=bad"))).status, 400)
  assert.equal(reads, 0)
  const response = await route.GET(new Request(`https://fixture.invalid?id=${id}`))
  assert.deepEqual(await response.json(), { id: id.toString(), name: "Fixture" })
  assert.equal((await route.DELETE(new Request(`https://fixture.invalid?id=${id}`))).status, 200)
})

function partnerCheckoutFixture(environment = "live") {
  const product = { _id: new ObjectId(), id: "fixture-product", name: "Fixture", sku: "FIXTURE", active: true, stock: 10, price: 100 }
  const partner = { id: "fixture-partner", name: "Fixture", tier: "starter", commissionRate: 0, razorpayIntegration: {
    enabled: true, defaultEnvironment: environment === "live" ? "test" : "live",
    credentials: { [environment]: { keyId: `rzp_${environment}_fixture`, keySecretEnc: "fixture-ciphertext", keySecretIv: "fixture-iv", keySecretTag: "fixture-tag" } },
  } }
  const payments = []
  const orders = []
  const calls = []
  let decryptFailure = false
  let providerFailure = false
  let insertFailure = false
  let stockFailure = false
  let mutation = {}
  let sequence = 0
  let queue = Promise.resolve()
  let activeSession
  const secret = "fixture-payment-secret"
  const matches = (record, query) => Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some(part => matches(record, part))
    if (value && typeof value === "object" && "$exists" in value) return Object.hasOwn(record, key) === value.$exists
    if (value && typeof value === "object" && "$gte" in value) return record[key] >= value.$gte
    if (value && typeof value === "object" && "$in" in value) return value.$in.includes(record[key])
    if (value instanceof ObjectId) return record[key]?.toString() === value.toString()
    return record[key] === value
  })
  const requireSession = options => assert.equal(options?.session, activeSession)
  const collections = {
    products: {
      findOne: async (query, options) => { requireSession(options); return matches(product, query) ? { ...product } : null },
      updateOne: async (query, update, options) => {
        requireSession(options)
        if (stockFailure || !matches(product, query)) return { modifiedCount: 0 }
        product.stock += update.$inc.stock
        return { modifiedCount: 1, matchedCount: 1 }
      },
    },
    partner_payments: {
      insertOne: async doc => payments.push({ ...doc, _id: new ObjectId() }),
      findOne: async (query, options) => { requireSession(options); const found = payments.find(doc => matches(doc, query)); return found ? { ...found } : null },
      updateOne: async (query, update, options) => {
        requireSession(options)
        const doc = payments.find(record => matches(record, query))
        if (!doc) return { matchedCount: 0, modifiedCount: 0 }
        Object.assign(doc, update.$set)
        return { matchedCount: 1, modifiedCount: 1 }
      },
    },
    partner_orders: {
      insertOne: async (doc, options) => { requireSession(options); if (insertFailure) throw new Error("Fixture order insert failure"); orders.push(doc) },
      findOne: async (query, options) => { requireSession(options); return orders.find(doc => matches(doc, query)) || null },
      findOneAndUpdate: async (query, update, options) => {
        requireSession(options)
        const order = orders.find(doc => matches(doc, query))
        if (!order) return null
        Object.assign(order, update.$set, { statusHistory: [...order.statusHistory, update.$push.statusHistory] })
        return { ...order }
      },
    },
  }
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const previous = queue
        let unlock
        queue = new Promise(resolve => { unlock = resolve })
        await previous
        const snapshot = payments.map(doc => ({ ...doc }))
        const stock = product.stock
        const orderSnapshot = orders.map(doc => ({ ...doc }))
        activeSession = session
        try { return await operation() } catch (error) {
          product.stock = stock
          payments.splice(0, payments.length, ...snapshot)
          orders.splice(0, orders.length, ...orderSnapshot)
          throw error
        } finally { activeSession = undefined; unlock() }
      },
      endSession: async () => {},
    }
    return session
  } }
  let providerOrder
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async name => { assert.ok(collections[name], `Unexpected collection ${name}`); return collections[name] } },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client }) },
    "@/lib/order-id": { generateOrderId: async () => `FIXTURE-${++sequence}` },
    "@/lib/encryption": { decrypt: () => decryptFailure ? "" : secret },
    "@/lib/razorpay": { getRazorpayClient: credentials => {
      calls.push(credentials)
      assert.equal(credentials.keyId, `rzp_${environment}_fixture`)
      assert.equal(credentials.keySecret, secret)
      return {
        orders: {
          create: async input => {
            providerOrder = { ...input, id: "order_fixture", status: "created" }
            return providerOrder
          },
          fetch: async id => {
            assert.equal(id, "order_fixture")
            if (providerFailure) throw new Error("Fixture provider unavailable")
            return { ...providerOrder, status: "paid", amount_paid: providerOrder.amount, ...mutation.order }
          },
        },
        payments: { fetch: async id => {
          assert.equal(id, "pay_fixture")
          if (providerFailure) throw new Error("Fixture provider unavailable")
          return { id, order_id: "order_fixture", status: "captured", amount: providerOrder.amount, currency: "INR", method: "upi", created_at: 1780000000, ...mutation.payment }
        } },
      }
    } },
  })
  const service = loader.load("lib/partner/payments.ts")
  const orderService = loader.load("lib/partner/orders.ts")
  const input = { orderId: "FIXTURE-EXTERNAL", items: [{ productId: product.id, quantity: 2 }], currency: "INR", amount: 1, notes: { partnerId: "attacker", orderId: "different", environment: "other" } }
  const proof = {
    razorpay_order_id: "order_fixture", razorpay_payment_id: "pay_fixture",
    razorpay_signature: crypto.createHmac("sha256", secret).update("order_fixture|pay_fixture").digest("hex"),
  }
  const orderInput = {
    items: input.items, partnerOrderId: input.orderId, paymentMethod: "prepaid",
    customer: { name: "Fixture", email: "fixture@example.invalid", phone: "9876543210", address: { line1: "Fixture", city: "Mumbai", state: "Maharashtra", pincode: "400001", country: "India" } },
    paymentDetails: { razorpayOrderId: "order_fixture", transactionId: "pay_fixture", amount: 1, method: "attacker" },
  }
  return {
    loader, service, orderService, partner, product, payments, orders, calls, input, proof, orderInput,
    create: () => service.createPartnerPayment(partner, environment, input),
    verify: () => service.verifyPartnerPayment(partner, environment, proof),
    fulfill: (input = orderInput) => orderService.createPartnerOrder(partner, input, environment),
    setDecryptFailure: () => { decryptFailure = true },
    setProviderFailure: () => { providerFailure = true },
    setInsertFailure: () => { insertFailure = true },
    setStockFailure: () => { stockFailure = true },
    setMutation: value => { mutation = value },
  }
}

test("partner payment creation prices the catalogue and protects identity notes using the API key environment", async () => {
  const fixture = partnerCheckoutFixture()
  const created = await fixture.create()
  assert.equal(created.amount, 23600)
  assert.equal(created.amountInRupees, 236)
  assert.equal(created.environment, "live")
  assert.equal(created.notes.partnerId, fixture.partner.id)
  assert.equal(created.notes.orderId, fixture.input.orderId)
  assert.equal(created.notes.environment, "live")
  assert.equal(fixture.payments[0].items[0].productId, fixture.product._id.toString())
  assert.equal(fixture.product.stock, 10)
  assert.equal(fixture.orders.length, 0)
})

test("partner payments never fall back to platform credentials after disabled, missing or undecryptable configuration", async () => {
  for (const configure of [
    fixture => { fixture.partner.razorpayIntegration.enabled = false },
    fixture => { delete fixture.partner.razorpayIntegration.credentials.live },
    fixture => { fixture.partner.razorpayIntegration.credentials.live.keyId = "rzp_test_wrong" },
    fixture => fixture.setDecryptFailure(),
  ]) {
    const fixture = partnerCheckoutFixture()
    configure(fixture)
    await assert.rejects(fixture.create())
    assert.equal(fixture.calls.length, 0)
    assert.equal(fixture.payments.length, 0)
  }
})

test("partner quote validation rejects invalid money, fractional quantities, duplicate aliases and database outages", async () => {
  for (const price of [0, -1, NaN, Infinity]) {
    const fixture = partnerCheckoutFixture()
    fixture.product.price = price
    await assert.rejects(fixture.create(), /invalid pricing/)
    assert.equal(fixture.calls.length, 0)
  }
  const fixture = partnerCheckoutFixture()
  fixture.input.items = [{ productId: fixture.product.id, quantity: 1.5 }]
  await assert.rejects(fixture.create(), /Invalid order items/)
  fixture.input.items = [{ productId: fixture.product.id, quantity: 1 }, { productId: fixture.product._id.toString(), quantity: 1 }]
  await assert.rejects(fixture.create(), /Duplicate product aliases/)
  let calls = 0
  const pricing = sourceLoader({ "@/lib/db-service": { getCollection: async () => ({ findOne: async () => { calls++; throw new Error("Fixture database down") } }) } }).load("lib/partner/order-pricing.ts")
  await assert.rejects(pricing.pricePartnerOrder([{ productId: "legacy-fixture", quantity: 1 }]), /database down/)
  assert.equal(calls, 1)
})

test("partner verification fails closed when payment provider detail retrieval fails", async () => {
  const fixture = partnerCheckoutFixture()
  await fixture.create()
  fixture.setProviderFailure()
  await assert.rejects(fixture.verify(), /provider unavailable/)
  assert.equal(fixture.payments[0].status, "created")
  assert.equal(fixture.payments[0].verifiedAt, undefined)
})

test("partner verification rejects another partner, environment, legacy initiation and bad signatures before provider work", async () => {
  for (const mutation of [
    fixture => { fixture.payments[0].partnerId = "different-partner" },
    fixture => { fixture.payments[0].environment = "test" },
    fixture => { delete fixture.payments[0].items },
    fixture => { fixture.payments[0].keyId = "rzp_live_different" },
    fixture => { fixture.proof.razorpay_signature = "0".repeat(64) },
    fixture => { fixture.payments[0].razorpayPaymentId = "pay_other" },
  ]) {
    const fixture = partnerCheckoutFixture()
    await fixture.create()
    mutation(fixture)
    await assert.rejects(fixture.verify())
    assert.equal(fixture.payments[0].status, "created")
  }
})

test("partner verification requires captured full payment, matching provider order, currency and protected notes", async () => {
  for (const mutation of [
    { payment: { status: "authorized" } }, { payment: { amount: 1 } }, { payment: { currency: "USD" } },
    { payment: { order_id: "order_other" } }, { payment: { id: "pay_other" } }, { payment: { created_at: 0 } },
    { order: { amount: 1 } }, { order: { amount_paid: 0 } }, { order: { status: "created" } },
    { order: { notes: { partnerId: "different", orderId: "FIXTURE-EXTERNAL", environment: "live" } } },
  ]) {
    const fixture = partnerCheckoutFixture()
    await fixture.create()
    fixture.setMutation(mutation)
    await assert.rejects(fixture.verify(), /does not match/)
    assert.equal(fixture.payments[0].status, "created")
  }
})

test("partner captured verification is retry-safe and returns only the stored authoritative reference and amount", async () => {
  const fixture = partnerCheckoutFixture()
  await fixture.create()
  const first = await fixture.verify()
  const second = await fixture.verify()
  assert.equal(first.amount, 236)
  assert.equal(first.orderId, "FIXTURE-EXTERNAL")
  assert.equal(second.verified, true)
  assert.equal(fixture.payments.length, 1)
  assert.equal(fixture.payments[0].razorpayPaymentId, "pay_fixture")
})

test("partner order creation requires an unused verified payment with exact partner, environment, price, items and external reference", async () => {
  for (const mutation of [
    fixture => { fixture.payments[0].status = "created" },
    fixture => { fixture.payments[0].partnerId = "other" },
    fixture => { fixture.payments[0].environment = "test" },
    fixture => { fixture.payments[0].amount = 1 },
    fixture => { fixture.payments[0].consumedOrderId = "prior" },
    fixture => { fixture.payments[0].items = [] },
    fixture => { fixture.orderInput.items[0].quantity = 1 },
    fixture => { fixture.orderInput.partnerOrderId = "different" },
    fixture => { fixture.product.price = 200 },
  ]) {
    const fixture = partnerCheckoutFixture()
    await fixture.create()
    await fixture.verify()
    mutation(fixture)
    const result = await fixture.fulfill()
    assert.equal(result.success, false)
    assert.equal(fixture.orders.length, 0)
    assert.equal(fixture.product.stock, 10)
  }
})

test("partner live checkout consumes proof, stock and order once under concurrent replay while ignoring client money", async () => {
  const fixture = partnerCheckoutFixture()
  await fixture.create()
  await fixture.verify()
  const results = await Promise.all([fixture.fulfill(), fixture.fulfill()])
  assert.equal(results.filter(result => result.success).length, 1)
  const order = fixture.orders[0]
  assert.equal(fixture.orders.length, 1)
  assert.equal(fixture.product.stock, 8)
  assert.equal(fixture.payments[0].consumedOrderId, order.orderId)
  assert.equal(order.summary.total, 236)
  assert.equal(order.paymentDetails.amount, 236)
  assert.equal(order.paymentDetails.method, "upi")
  assert.equal(order.paymentVerification.verified, true)
  assert.equal(order.commission.rate, 0)
})

test("partner checkout rolls back payment consumption and stock when reservation or insertion fails", async () => {
  for (const fail of [fixture => fixture.setStockFailure(), fixture => fixture.setInsertFailure()]) {
    const fixture = partnerCheckoutFixture()
    await fixture.create()
    await fixture.verify()
    fail(fixture)
    try {
      const result = await fixture.fulfill()
      assert.equal(result.success, false)
    } catch (error) {
      assert.match(error.message, /Fixture order insert failure/)
    }
    assert.equal(fixture.product.stock, 10)
    assert.equal(fixture.payments[0].consumedOrderId, undefined)
    assert.equal(fixture.orders.length, 0)
  }
})

test("partner test API key never creates live fulfillment or reserves stock even with a live default environment", async () => {
  const fixture = partnerCheckoutFixture("test")
  await fixture.create()
  await fixture.verify()
  const result = await fixture.fulfill()
  assert.equal(result.success, true)
  assert.equal(result.testMode, true)
  assert.match(result.order.orderId, /^TEST-/)
  assert.equal(fixture.orders.length, 0)
  assert.equal(fixture.product.stock, 10)
  assert.equal((await fixture.fulfill()).success, false)
})

test("partner COD is server-priced without a fabricated prepaid proof and test COD does not mutate stock", async () => {
  for (const environment of ["live", "test"]) {
    const fixture = partnerCheckoutFixture(environment)
    const result = await fixture.fulfill({ ...fixture.orderInput, paymentMethod: "cod", paymentDetails: undefined })
    assert.equal(result.success, true)
    assert.equal(result.order.summary.total, 236)
    assert.equal(result.order.paymentVerification.verified, false)
    assert.equal(fixture.product.stock, environment === "live" ? 8 : 10)
  }
})

test("partner concurrent cancellation restores reserved stock once without refunding or recycling the payment proof", async () => {
  const fixture = partnerCheckoutFixture()
  await fixture.create()
  await fixture.verify()
  const created = await fixture.fulfill()
  const cancel = () => fixture.orderService.cancelPartnerOrder(fixture.partner.id, created.order.orderId, "live", "Fixture")
  const results = await Promise.all([cancel(), cancel()])
  assert.equal(results.filter(result => result.success).length, 1)
  assert.equal(fixture.product.stock, 10)
  assert.equal(fixture.orders[0].status, "cancelled")
  assert.equal(fixture.payments[0].consumedOrderId, created.order.orderId)
  assert.equal((await fixture.fulfill()).success, false)
})

test("partner cancellation failure rolls back status and test keys cannot mutate live orders", async () => {
  const fixture = partnerCheckoutFixture()
  const created = await fixture.fulfill({ ...fixture.orderInput, paymentMethod: "cod", paymentDetails: undefined })
  const testCancel = await fixture.orderService.cancelPartnerOrder(fixture.partner.id, created.order.orderId, "test")
  assert.equal(testCancel.success, false)
  assert.equal(testCancel.status, 403)
  fixture.setStockFailure()
  const failed = await fixture.orderService.cancelPartnerOrder(fixture.partner.id, created.order.orderId, "live")
  assert.equal(failed.success, false)
  assert.equal(fixture.orders[0].status, "pending")
  assert.equal(fixture.product.stock, 8)
})

test("partner payment and order routes validate JSON before work and wire actual write permissions and key environment", async () => {
  const permissions = []
  const calls = []
  const fixture = partnerCheckoutFixture()
  const loader = sourceLoader({
    "@/lib/partner/auth": {
      withPartnerAuth: (handler, required) => { permissions.push(required); return handler },
      createErrorResponse: (code, message, requestId, status) => Response.json({ success: false, error: { code, message }, requestId }, { status }),
    },
    "@/lib/partner/payments": {
      createPartnerPayment: async (partner, environment) => { calls.push(environment); return {} },
      verifyPartnerPayment: async () => { throw new Error("Fixture provider unavailable") },
    },
    "@/lib/partner/orders": { createPartnerOrder: async (partner, input, environment) => { calls.push(environment); return { success: true, testMode: true, order: {} } } },
  })
  const request = body => Object.assign(new NextRequest("https://fixture.invalid/api/v1/partner/orders", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), {
    partner: fixture.partner, apiKey: { environment: "test" }, requestId: "fixture-request",
  })
  const create = loader.load("app/api/v1/partner/orders/razorpay/create/route.ts").POST
  assert.equal((await create(request("{"))).status, 400)
  assert.equal((await create(request({ amount: 1, orderId: "Fixture" }))).status, 400)
  assert.equal((await create(request(fixture.input))).status, 201)
  const verify = loader.load("app/api/v1/partner/orders/razorpay/verify/route.ts").POST
  assert.equal((await verify(request({ ...fixture.proof, razorpay_signature: "invalid" }))).status, 400)
  assert.equal((await verify(request(fixture.proof))).status, 502)
  const orders = loader.load("app/api/v1/partner/orders/route.ts").POST
  assert.equal((await orders(request({ ...fixture.orderInput, items: [{ productId: "fixture", quantity: 1.1 }] }))).status, 400)
  assert.equal((await orders(request(fixture.orderInput))).status, 201)
  assert.deepEqual(calls, ["test", "test"])
  assert.equal(JSON.stringify(permissions), JSON.stringify([["orders:create"], ["orders:write"], ["orders:write"], ["orders:read"]]))
})

test("partner order schemas preserve supported aliases and complete string addresses but reject invented addresses and duplicate products", () => {
  const schemas = sourceLoader().load("lib/validation.ts")
  const fixture = partnerCheckoutFixture()
  const input = { ...fixture.orderInput, customer: undefined, customerDetails: { ...fixture.orderInput.customer, address: "Fixture, Mumbai, Maharashtra, 400001" }, partnerOrderId: undefined, externalOrderId: "fixture-alias", paymentMethod: "RAZORPAY" }
  const parsed = schemas.PartnerOrderCreateSchema.parse(input)
  assert.equal(parsed.paymentMethod, "prepaid")
  assert.equal(parsed.partnerOrderId, "fixture-alias")
  assert.equal(parsed.customer.address.pincode, "400001")
  assert.equal(schemas.PartnerOrderCreateSchema.safeParse({ ...input, customerDetails: { ...input.customerDetails, address: "Incomplete" } }).success, false)
  assert.equal(schemas.PartnerPaymentCreateSchema.safeParse({ ...fixture.input, items: [...fixture.input.items, ...fixture.input.items] }).success, false)
  assert.equal(schemas.PartnerOrderListQuerySchema.safeParse({ page: "garbage" }).success, false)
})

test("partner manual verification records the authenticated operator and acknowledges idempotent matches without trusting client identity", async () => {
  const _id = new ObjectId()
  const writes = []
  let matched = 1
  let authorized = true
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true, userId: "fixture-authenticated-admin" } : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) } },
    "@/lib/db-service": { getCollection: async () => ({
      findOne: async query => { assert.equal(query.$or[1]._id.toString(), _id.toString()); return { _id, orderId: "FIXTURE-ORDER" } },
      updateOne: async (query, update) => { assert.equal(query._id.toString(), _id.toString()); writes.push(update); return { matchedCount: matched, modifiedCount: 0 } },
    }) },
  })
  const route = loader.load("app/api/admin/partners/orders/[orderId]/verify-payment/route.ts")
  const request = body => new NextRequest("https://fixture.invalid/api/admin/partners/orders/fixture/verify-payment", { method: "POST", body })
  const context = { params: Promise.resolve({ orderId: _id.toString() }) }
  const verified = await route.POST(request(JSON.stringify({ verifiedBy: "spoofed-admin" })), context)
  assert.equal(verified.status, 200)
  assert.equal((await verified.json()).data.verifiedBy, "fixture-authenticated-admin")
  assert.equal(writes[0].$set["paymentVerification.verifiedBy"], "fixture-authenticated-admin")
  assert.equal((await route.POST(request("{"), context)).status, 400)
  assert.equal(writes.length, 1)
  assert.equal((await route.DELETE(request(""), context)).status, 200)
  assert.equal(writes[1].$set["paymentVerification.verified"], false)
  matched = 0
  assert.equal((await route.POST(request("{}"), context)).status, 404)
  authorized = false
  assert.equal((await route.POST(request("{}"), context)).status, 401)
})

function externalWebhookFixture() {
  const orderId = new ObjectId()
  const record = { _id: `exlr8:${orderId}:1`, provider: "exlr8", orderId: "SARAECOM-FIXTURE", status: "placed", attempts: 1, response: { data: { orderID: "fixture-provider-order", vouchers: [{ code: "fixture-voucher" }] } } }
  const order = { _id: orderId, orderId: "SARAECOM-FIXTURE", status: "delivered", externalFulfillment: { status: "placed", updatedAt: new Date() }, timeline: [] }
  let found = true
  let missingOrder = false
  let ambiguous = false
  let writeFailure = false
  let activeSession
  let reads = 0
  const session = {
    withTransaction: async operation => {
      const recordSnapshot = { ...record }
      const orderSnapshot = { ...order, externalFulfillment: { ...order.externalFulfillment }, timeline: [...order.timeline] }
      activeSession = session
      try { return await operation() } catch (error) {
        for (const key of Object.keys(record)) delete record[key]
        Object.assign(record, recordSnapshot)
        Object.assign(order, orderSnapshot)
        throw error
      } finally { activeSession = undefined }
    },
    endSession: async () => {},
  }
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ client: { startSession: () => session } }) },
    "@/lib/db-service": { getCollection: async name => name === "external_orders" ? {
      find: (query, options) => {
        reads++
        assert.equal(options.session, activeSession)
        if (query.$or?.[0]._id) assert.equal(query.$or[0]._id, record._id)
        return { limit: limit => { assert.equal(limit, 2); return { toArray: async () => found ? ambiguous ? [{ ...record }, { ...record, _id: "other" }] : [{ ...record }] : [] } } }
      },
      updateOne: async (query, update, options) => {
        assert.equal(options.session, activeSession)
        assert.equal(query._id, record._id)
        Object.assign(record, update.$set)
        record.webhookAttempts = (record.webhookAttempts || 0) + update.$inc.webhookAttempts
        return { matchedCount: 1 }
      },
    } : {
      findOne: async (query, options) => {
        assert.equal(options.session, activeSession)
        assert.equal(query.orderId, order.orderId)
        return missingOrder ? null : order
      },
      updateOne: async (query, update, options) => {
        assert.equal(options.session, activeSession)
        if (writeFailure) throw new Error("Fixture linked write failure")
        assert.equal(Object.hasOwn(update.$set, "status"), false)
        order.updatedAt = update.$set.updatedAt
        order.externalFulfillment.lastWebhookStatus = update.$set["externalFulfillment.lastWebhookStatus"]
        order.timeline.push(update.$push.timeline)
        return { matchedCount: 1 }
      },
    } },
  }, { env: { EXLR8_WEBHOOK_SECRET: "fixture-webhook-secret" } })
  const route = loader.load("app/api/integrations/exlr8/webhook/route.ts")
  const input = { queueId: record._id, orderId: record.orderId, externalOrderId: "fixture-provider-order", status: "FULFILLED", message: "Fixture fulfilled" }
  const request = (body = input, secret = "fixture-webhook-secret") => new Request("https://fixture.invalid/api/integrations/exlr8/webhook", { method: "POST", headers: { "x-webhook-secret": secret }, body: typeof body === "string" ? body : JSON.stringify(body) })
  return {
    record, order, input, request, post: route.POST, reads: () => reads,
    missing: () => { found = false }, missingOrder: () => { missingOrder = true }, ambiguous: () => { ambiguous = true }, failWrite: () => { writeFailure = true },
  }
}

test("external webhook authenticates before parsing and rejects malformed identifiers/status without database work", async () => {
  const fixture = externalWebhookFixture()
  assert.equal((await fixture.post(fixture.request("{", "wrong"))).status, 401)
  assert.equal((await fixture.post(fixture.request("{"))).status, 400)
  assert.equal((await fixture.post(fixture.request({ orderId: { $ne: null }, status: "fulfilled" }))).status, 400)
  assert.equal((await fixture.post(fixture.request({ queueId: fixture.record._id, status: { $set: "paid" } }))).status, 400)
  assert.equal(fixture.reads(), 0)
})

test("external webhook supports deterministic queue IDs and preserves whole-order lifecycle, vouchers and fulfillment attempts", async () => {
  const fixture = externalWebhookFixture()
  assert.equal((await fixture.post(fixture.request())).status, 200)
  assert.equal(fixture.record.status, "fulfilled")
  assert.equal(fixture.record.response.data.vouchers[0].code, "fixture-voucher")
  assert.equal(fixture.record.attempts, 1)
  assert.equal(fixture.record.webhookAttempts, 1)
  assert.equal(fixture.order.status, "delivered")
  assert.equal(fixture.order.externalFulfillment.status, "placed")
  assert.equal(fixture.order.externalFulfillment.lastWebhookStatus, "fulfilled")
  assert.equal(fixture.order.timeline.length, 1)
})

test("external callback replay is idempotent and stale processing cannot regress terminal fulfillment", async () => {
  const fixture = externalWebhookFixture()
  await fixture.post(fixture.request())
  const repeated = await (await fixture.post(fixture.request())).json()
  assert.equal(repeated.duplicate, true)
  const stale = await (await fixture.post(fixture.request({ ...fixture.input, status: "processing" }))).json()
  assert.equal(stale.ignored, true)
  assert.equal(fixture.record.status, "fulfilled")
  assert.equal(fixture.record.webhookAttempts, 1)
  assert.equal(fixture.order.timeline.length, 1)
})

test("external webhook rejects unbound, inconsistent, ambiguous or missing linked records instead of success-shaped updates", async () => {
  for (const [configure, expected] of [
    [fixture => fixture.missing(), 404],
    [fixture => fixture.missingOrder(), 409],
    [fixture => fixture.ambiguous(), 409],
    [fixture => { fixture.input.orderId = "different" }, 404],
    [fixture => { fixture.record.provider = "different" }, 404],
  ]) {
    const fixture = externalWebhookFixture()
    configure(fixture)
    assert.equal((await fixture.post(fixture.request())).status, expected)
    assert.equal(fixture.record.status, "placed")
    assert.equal(fixture.order.timeline.length, 0)
  }
})

test("external webhook rolls back provider reconciliation if the linked order update fails", async () => {
  const fixture = externalWebhookFixture()
  fixture.failWrite()
  assert.equal((await fixture.post(fixture.request())).status, 500)
  assert.equal(fixture.record.status, "placed")
  assert.equal(fixture.record.lastWebhookHash, undefined)
  assert.equal(fixture.record.webhookAttempts, undefined)
  assert.equal(fixture.order.timeline.length, 0)
})

test("external queue read supports native and deterministic IDs and propagates database failures without lookup fallback", async () => {
  let fail = false
  const queries = []
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, userId: "fixture-admin" }) },
    "@/lib/db-service": {
      normalizeId: doc => { const { _id, ...rest } = doc; return { ...rest, id: _id.toString() } },
      getCollection: async () => ({
        findOne: async query => {
          queries.push(query)
          if (fail) throw new Error("Fixture database down")
          return query.$or ? { _id: query.$or[0]._id, orderId: "FIXTURE" } : null
        },
      }),
    },
  })
  const route = loader.load("app/api/integrations/exlr8/external/[id]/route.ts")
  const request = new Request("https://fixture.invalid")
  const result = await route.GET(request, { params: Promise.resolve({ id: "exlr8:fixture:1" }) })
  assert.equal((await result.json()).id, "exlr8:fixture:1")
  queries.length = 0
  fail = true
  assert.equal((await route.GET(request, { params: Promise.resolve({ id: new ObjectId().toString() }) })).status, 500)
  assert.equal(queries.length, 1)
})

test("public store settings validate actual metadata, preserve legacy contact/address aliases and retain zero-valued coordinates", async () => {
  const loader = sourceLoader({
    "@/lib/db-service": { getSettingsData: async () => ({
      storeName: "Fixture", storeEmail: "fixture@example.invalid", storePhone: "0000000000", storeAddress: "Fixture street",
      companyName: null, brandLogo: "/api/media/brand-logo/fixture", geo: { lat: 0, lng: 0 }, hours: ["Mo-Fr 09:00-18:00"],
    }) },
  })
  const store = loader.load("lib/jsonld-store.ts")
  const settings = await store.getStoreSettings()
  assert.equal(settings.email, "fixture@example.invalid")
  assert.equal(settings.phone, "0000000000")
  assert.equal(settings.address.street, "Fixture street")
  assert.equal(settings.companyName, undefined)
  assert.equal(store.buildLocalBusinessJsonLd({ settings, origin: "https://fixture.invalid" }).geo.latitude, 0)
  assert.equal(store.storeSettingsLiteSchema.parse({ address: "Legacy fixture address" }).address.street, "Legacy fixture address")
})

test("public store metadata failures are logged without reproducing invalid values or pretending to load settings", async () => {
  const logs = []
  let outage = false
  const store = sourceLoader({
    "@/lib/db-service": { getSettingsData: async () => { if (outage) throw new Error("Fixture database outage"); return { storeName: { secret: "fixture-private-value" } } } },
  }, { context: { console: { error: (...args) => logs.push(args) } } }).load("lib/jsonld-store.ts")
  assert.equal(await store.getStoreSettings(), null)
  assert.ok(JSON.stringify(logs).includes("storeName"))
  assert.equal(JSON.stringify(logs).includes("fixture-private-value"), false)
  outage = true
  assert.equal(await store.getStoreSettings(), null)
  assert.equal(logs.length, 2)
})

test("llms index fits its exact UTF-8 budget, escapes labels/paths and omits unverified landings and non-finite prices", async () => {
  const queries = []
  const documents = {
    products: Array.from({ length: 60 }, (_, index) => ({
      _id: new ObjectId(), name: `Fixture ${index}] (https://evil.invalid)`, slug: index ? `fixture-${index}` : "fixture/name?evil#hash",
      price: Infinity, mrp: Infinity, description: "界".repeat(140), stock: 1, brand: "Fixture",
    })),
    categories: Array.from({ length: 30 }, (_, index) => ({ _id: new ObjectId(), name: `Category ${index}`, slug: `category ${index}`, description: "界".repeat(140) })),
    brands: [{ _id: new ObjectId(), name: "Fixture Brand", slug: "arbitrary-unverified-landing", description: "Fixture" }],
  }
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async name => ({
      find: query => {
        queries.push({ name, query })
        const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => documents[name] }
        return cursor
      },
    }) },
    "@/lib/jsonld-store": { getStoreSettings: async () => ({ storeName: "Fixture", email: "fixture@example.invalid" }), pickStoreName: settings => settings.storeName },
    "@/lib/seo-metadata": { getOriginFromHeaders: async () => "https://fixture.invalid" },
  })
  const route = loader.load("app/llms.txt/route.ts")
  const response = await route.GET()
  const body = await response.text()
  assert.equal(response.status, 200)
  const alias = await loader.load("app/llm.txt/route.ts").GET()
  assert.equal(alias.status, response.status)
  assert.equal(await alias.text(), body)
  assert.equal(alias.headers.get("Cache-Control"), response.headers.get("Cache-Control"))
  assert.ok(Buffer.byteLength(body, "utf8") <= 10000)
  assert.ok(body.includes("/privacy-policy"))
  assert.ok(body.includes("mailto:fixture@example.invalid"))
  assert.equal(body.includes("Infinity"), false)
  assert.equal(body.includes("](https://evil.invalid)"), false)
  assert.equal(body.includes("https://fixture.invalid/arbitrary-unverified-landing"), false)
  assert.ok(body.includes("https://fixture.invalid/brands/arbitrary-unverified-landing"))
  assert.equal(queries[0].query.active, true)
  assert.equal(queries[2].query.landingPageEnabled.$ne, false)
  documents.categories = []
  const smaller = await (await route.GET()).text()
  assert.ok(smaller.includes("/product/fixture%2Fname%3Fevil%23hash"))
  assert.equal(smaller.includes("Infinity"), false)
})

test("llms catalogue outages return an explicit non-cacheable failure instead of a successful empty inventory", async () => {
  const logs = []
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => { throw new Error("Fixture catalogue unavailable") } },
    "@/lib/jsonld-store": { getStoreSettings: async () => ({ storeName: "Fixture" }), pickStoreName: settings => settings.storeName },
    "@/lib/seo-metadata": { getOriginFromHeaders: async () => "https://fixture.invalid" },
  }, { context: { console: { error: (...args) => logs.push(args) } } })
  const route = loader.load("app/llms.txt/route.ts")
  const response = await route.GET()
  assert.equal(response.status, 503)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.equal(response.headers.get("X-Catalogue-Status"), "unavailable")
  const body = await response.text()
  assert.ok(body.includes("temporarily unavailable"))
  assert.equal(body.includes("support@"), false)
  assert.equal(logs.length, 1)
  const alias = await loader.load("app/llm.txt/route.ts").GET()
  assert.equal(alias.status, 503)
  assert.equal(alias.headers.get("Cache-Control"), "no-store")
})

test("spin WhatsApp notifications reject placeholders, HTTP failures and malformed provider acknowledgements", async () => {
  const escapeHtml = sourceLoader().load("lib/email.ts").escapeHtml
  const messages = []
  const email = { sendEmail: async () => ({ success: true }), escapeHtml }
  const unconfigured = sourceLoader({ "@/lib/email": email }, { context: { console: { error: (...args) => messages.push(args) } } }).load("lib/spin-wheel-notifications.ts")
  assert.equal((await unconfigured.sendWhatsAppOTP("9876543210", "123456")).success, false)
  for (const response of [
    Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message" }] }, { status: 429 }),
    Response.json({ messaging_product: "whatsapp", messages: [] }),
    Response.json({ success: true }),
    Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message", message_status: "failed" }] }),
    new Response("not-json"),
  ]) {
    const loader = sourceLoader({ "@/lib/email": email }, { env: { ASKEVA_API_KEY: "fixture-key", ASKEVA_API_URL: "https://provider.invalid" }, fetch: async () => response, context: { console: { error: (...args) => messages.push(args) } } })
    const result = await loader.load("lib/spin-wheel-notifications.ts").sendWhatsAppOTP("9876543210", "123456")
    assert.equal(result.success, false)
    assert.ok(result.error)
  }
  const logs = JSON.stringify(messages)
  assert.equal(logs.includes("123456"), false)
  assert.equal(logs.includes("9876543210"), false)
})

test("spin WhatsApp templates retain ordered variables and return validated acceptance without contact details", async () => {
  const sent = []
  const escapeHtml = sourceLoader().load("lib/email.ts").escapeHtml
  const loader = sourceLoader({ "@/lib/email": { sendEmail: async () => ({ success: true }), escapeHtml } }, {
    env: { ASKEVA_API_KEY: "fixture-key", ASKEVA_API_URL: "https://provider.invalid", ASKEVA_SENDER_NUMBER: "fixture-sender" },
    fetch: async (url, init) => {
      assert.equal(url, "https://provider.invalid")
      assert.equal(init.method, "POST")
      assert.ok(init.signal)
      sent.push(JSON.parse(init.body))
      return Response.json({ messaging_product: "whatsapp", messages: [{ id: "fixture-message", message_status: "accepted" }], contacts: [{ wa_id: "fixture-private-contact" }] })
    },
  })
  const notifications = loader.load("lib/spin-wheel-notifications.ts")
  assert.equal((await notifications.sendWhatsAppOTP("9876543210", "123456")).success, true)
  const winner = await notifications.sendWhatsAppWinNotification("9876543210", "Fixture", "Fixture Prize", "FIXTURE-COUPON", "fixture-override")
  assert.equal(winner.success, true)
  assert.equal(Object.hasOwn(winner.data, "contacts"), false)
  assert.equal(sent[0].sender, "fixture-sender")
  assert.equal(sent[0].template.name, "spin_win_auth")
  assert.equal(sent[0].template.components[1].parameters[0].text, "123456")
  assert.equal(sent[1].sender, "fixture-override")
  assert.equal(sent[1].template.name, "spin_win_confirm")
  assert.deepEqual(sent[1].template.components[0].parameters.map(value => value.text), ["Fixture", "Fixture Prize", "FIXTURE-COUPON"])
})

test("spin email templates escape participant, prize and coupon text without claiming failed mail succeeded", async () => {
  const escapeHtml = sourceLoader().load("lib/email.ts").escapeHtml
  const loader = sourceLoader({ "@/lib/email": { escapeHtml, sendEmail: async () => ({ success: false, error: "Fixture mail failure" }) } })
  const notifications = loader.load("lib/spin-wheel-notifications.ts")
  const html = notifications.getSpinWheelWinnerEmailTemplate("<script>Fixture</script>", "<img>", "<coupon>")
  assert.equal(html.includes("<script>"), false)
  assert.ok(html.includes("&lt;img&gt;"))
  assert.ok(html.includes("&lt;coupon&gt;"))
  assert.equal(notifications.getOtpEmailTemplate("<script>Fixture</script>", "<otp>").includes("<script>"), false)
  assert.equal((await notifications.sendSpinWheelEmail("fixture@example.invalid", "Fixture", "Prize", "Code")).success, false)
})

test("spin OTP delivery reports actual accepted channels and invalidates only its failed challenge", async () => {
  let mail = false
  let whatsapp = false
  let mailThrows = false
  let saved
  const deleted = []
  const loader = sourceLoader({
    "@/lib/spin-wheel-campaigns": {
      resolveCampaignSlug: value => (value === undefined || value === null || value === "" ? "default" : null),
      getCampaignCollection: async (campaign, kind) => {
        assert.equal(campaign, "default")
        return kind === "participants" ? { findOne: async () => null } : {
          updateOne: async (query, update) => { saved = update; assert.equal(query.phone, "9876543210"); assert.equal(update.$unset.verificationToken, "") },
          deleteOne: async query => deleted.push(query),
        }
      },
    },
    "@/lib/spin-wheel-notifications": {
      sendOtpEmail: async () => { if (mailThrows) throw new Error("Fixture rejected promise"); return { success: mail } },
      sendWhatsAppOTP: async () => ({ success: whatsapp }),
    },
    "@/lib/rate-limit-store": { rateLimitHit: async () => ({ limited: false }) },
  })
  const route = loader.load("app/api/spin-wheel/otp/send/route.ts")
  const post = () => route.POST(new NextRequest("https://fixture.invalid/api/spin-wheel/otp/send", { method: "POST", body: JSON.stringify({ phone: "9876543210", email: "fixture@example.invalid", name: "Fixture" }) }))
  assert.equal((await post()).status, 502)
  assert.equal(deleted.length, 1)
  assert.equal(deleted[0].otp, saved.$set.otp)
  assert.match(saved.$set.otp, /^\d{6}$/)
  mail = true
  const mailOnly = await (await post()).json()
  assert.equal(mailOnly.delivery.email, true)
  assert.equal(mailOnly.delivery.whatsapp, false)
  assert.equal(mailOnly.message, "OTP sent to your email.")
  loader.load("lib/validation.ts").SpinOtpDeliveryResponseSchema.parse(mailOnly)
  mailThrows = true
  whatsapp = true
  const whatsappOnly = await (await post()).json()
  assert.equal(whatsappOnly.delivery.email, false)
  assert.equal(whatsappOnly.delivery.whatsapp, true)
  assert.equal(deleted.length, 1)
})

test("spin OTP limits count resend requests independently of the upserted challenge and validate before work", async () => {
  let hits = 0
  let callerHits = 0
  let writes = 0
  const loader = sourceLoader({
    "@/lib/spin-wheel-campaigns": {
      resolveCampaignSlug: value => (value === undefined || value === null || value === "" ? "default" : null),
      getCampaignCollection: async () => ({
        findOne: async () => null,
        updateOne: async () => { writes++ },
      }),
    },
    "@/lib/spin-wheel-notifications": { sendOtpEmail: async () => ({ success: true }), sendWhatsAppOTP: async () => ({ success: false }) },
    // Two budgets apply per send: one bounding the caller, one bounding how
    // often a single phone number can be messaged.
    "@/lib/rate-limit-store": { rateLimitHit: async (key, limit, window) => {
      assert.equal(window, 15 * 60 * 1000)
      if (key.startsWith("spin-otp-ip:")) {
        assert.equal(limit, 10)
        callerHits++
        return { limited: false }
      }
      assert.equal(key.includes("9876543210"), false)
      assert.equal(limit, 3)
      return { limited: ++hits > 3 }
    } },
  })
  const route = loader.load("app/api/spin-wheel/otp/send/route.ts")
  const post = body => route.POST(new NextRequest("https://fixture.invalid/api/spin-wheel/otp/send", { method: "POST", body: JSON.stringify(body) }))
  const input = { phone: "9876543210", email: "fixture@example.invalid", name: "Fixture" }
  assert.equal((await post({ ...input, phone: 9876543210 })).status, 400)
  assert.equal((await post({ ...input, campaignId: "../settings" })).status, 400)
  // Neither budget is consumed by input that never reaches any work.
  assert.equal(hits, 0)
  assert.equal(callerHits, 0)
  for (let index = 0; index < 3; index++) assert.equal((await post(input)).status, 200)
  assert.equal((await post(input)).status, 429)
  assert.equal(writes, 3)
  // The caller budget is checked on every send that gets past validation.
  assert.equal(callerHits, 4)
})

test("public spin prize endpoint exposes display fields only, never seeds and rejects inactive or unknown campaigns", async () => {
  let collections = 0
  let inactive = false
  const loader = sourceLoader({
    "@/lib/spin-wheel-campaigns": {
      findCampaignBySlug: async slug => slug === "default" ? null : slug === "fixture" ? { isActive: !inactive } : null,
      getCampaignCollection: async (campaign, kind) => {
        collections++
        assert.equal(kind, "inventory")
        return { find: (query, options) => {
          assert.equal(query.isActive.$ne, false)
          assert.equal(options.projection._id, 0)
          assert.equal(options.projection.total, undefined)
          return { toArray: async () => [{ prizeName: "Fixture Prize", total: 3, weightMultiplier: 2, couponStats: { used: 1 }, emoji: null }] }
        } }
      },
    },
  })
  const route = loader.load("app/api/spin-wheel/prizes/route.ts")
  const get = campaign => route.GET(new NextRequest(`https://fixture.invalid/api/spin-wheel/prizes?campaignId=${encodeURIComponent(campaign)}`))
  assert.equal((await get("../settings")).status, 400)
  assert.equal((await get("missing")).status, 404)
  assert.equal(collections, 0)
  const response = await get("default")
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("x-robots-tag"), "noindex")
  assert.deepEqual(data.inventory[0], { prizeName: "Fixture Prize", emoji: "🎁", productImage: "", isActive: true })
  inactive = true
  assert.equal((await get("fixture")).status, 404)
  assert.equal(collections, 1)
})

test("partner Razorpay updates encrypt before writing, preserve legacy IDs/environment and redact every response", async () => {
  let reads = 0
  let writes = 0
  let failEncryption = false
  const partner = {
    _id: new ObjectId(), id: "legacy-partner",
    razorpayIntegration: { enabled: false, paymentMode: "wallet", commissionPercent: 5, allowedDomains: ["fixture.invalid"], defaultEnvironment: "test", credentials: { test: { keyId: "fixture-test-id", keySecretEnc: "old-cipher", keySecretIv: "old-iv", keySecretTag: "old-tag" } } },
  }
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true }) },
    "@/lib/encryption": { encrypt: () => {
      if (failEncryption) throw new Error("Fixture unavailable encryption")
      return { ciphertext: "fixture-ciphertext", iv: "fixture-iv", tag: "fixture-tag" }
    } },
    "@/lib/db-service": { getCollection: async () => ({
      findOne: async filter => { reads++; assert.equal(filter.id, "legacy-partner"); return partner },
      updateOne: async (filter, update) => { writes++; assert.equal(filter._id, partner._id); partner.razorpayIntegration = update.$set.razorpayIntegration; return { matchedCount: 1, modifiedCount: 0 } },
    }) },
  })
  const route = loader.load("app/api/admin/partners/[partnerId]/razorpay-integration/route.ts")
  const context = { params: Promise.resolve({ partnerId: "legacy-partner" }) }
  const post = body => route.PUT(new NextRequest("https://fixture.invalid/api/admin/partners/legacy-partner/razorpay-integration", { method: "PUT", body: JSON.stringify(body) }), context)
  for (const body of [{ enabled: "false" }, { commissionPercent: 101 }, { credentials: { live: { keySecret: 12 } } }, { defaultEnvironment: "production" }, { allowedDomains: "fixture.invalid" }]) assert.equal((await post(body)).status, 400)
  assert.equal(reads, 0)
  failEncryption = true
  assert.equal((await post({ credentials: { live: { keyId: "fixture-live-id", keySecret: "fixture-secret" } } })).status, 500)
  assert.equal(writes, 0)
  assert.equal(partner.razorpayIntegration.credentials.live, undefined)
  failEncryption = false
  const result = await post({ enabled: true, defaultEnvironment: "live", commissionPercent: 0, credentials: { live: { keyId: "fixture-live-id", keySecret: "fixture-secret" } } })
  assert.equal(result.status, 200)
  assert.equal(writes, 1)
  assert.equal(partner.razorpayIntegration.defaultEnvironment, "live")
  assert.equal(partner.razorpayIntegration.commissionPercent, 0)
  assert.equal(partner.razorpayIntegration.credentials.test.keySecretEnc, "old-cipher")
  assert.equal(partner.razorpayIntegration.credentials.live.keySecretEnc, "fixture-ciphertext")
  assert.equal(partner.razorpayIntegration.webhookSecret.length, 64)
  for (const response of [result, await route.GET(new NextRequest("https://fixture.invalid/api/admin/partners/legacy-partner/razorpay-integration"), context)]) {
    const body = await response.json()
    const json = JSON.stringify(body)
    assert.equal(json.includes("keySecret"), false)
    assert.equal(json.includes("ciphertext"), false)
    assert.equal(body.data.razorpayIntegration.credentials.live.keyId, "fixture-live-id")
    loader.load("lib/partner/razorpay-integration.ts").publicRazorpayIntegrationSchema.parse(body.data.razorpayIntegration)
  }
})

test("partner details redact encrypted credentials and validate updates before mutations", async () => {
  const fixture = { ...partnerRegistrationFixture(), id: "legacy-partner", status: "pending", tier: "starter", commissionRate: 5, contactPerson: { name: "Contact", designation: "Old" }, razorpayIntegration: { enabled: false, paymentMode: "wallet", commissionPercent: 0, allowedDomains: [], credentials: { live: { keyId: "fixture-id", keySecretEnc: "fixture-cipher", keySecretIv: "fixture-iv", keySecretTag: "fixture-tag" } } } }
  let mutations = 0
  let returnMissing = false
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true }) },
    "@/lib/partner/service": {
      getPartnerById: async () => fixture,
      updatePartnerStatus: async () => { mutations++; return fixture },
      updatePartnerTier: async () => { mutations++; return fixture },
      updatePartner: async (id, changes) => { mutations++; if (returnMissing) return null; Object.assign(fixture, changes); return fixture },
    },
    "@/lib/partner/wallet": { getWalletByPartnerId: async () => null },
    "@/lib/partner/api-keys": { listPartnerAPIKeys: async () => [] },
  })
  const route = loader.load("app/api/admin/partners/[partnerId]/route.ts")
  const context = { params: Promise.resolve({ partnerId: "legacy-partner" }) }
  const request = body => new NextRequest("https://fixture.invalid/api/admin/partners/legacy-partner", { method: "PATCH", body: JSON.stringify(body) })
  const data = await (await route.GET(request({}), context)).json()
  assert.equal(JSON.stringify(data).includes("keySecret"), false)
  for (const handler of [route.PUT, route.PATCH]) {
    assert.equal((await handler(request({ status: "unknown" }), context)).status, 400)
    assert.equal((await handler(request({ commissionRate: -1 }), context)).status, 400)
  }
  assert.equal(mutations, 0)
  assert.equal((await route.PATCH(request({ contactPerson: { designation: "New" }, commissionRate: 0 }), context)).status, 200)
  assert.equal(fixture.contactPerson.name, "Contact")
  assert.equal(fixture.contactPerson.designation, "New")
  assert.equal(fixture.commissionRate, 0)
  returnMissing = true
  assert.equal((await route.PATCH(request({ name: "Updated" }), context)).status, 404)
})

test("commission reports retain native partner names, per-order shapes and filtered totals", async () => {
  const id = new ObjectId()
  const rows = [
    { _id: new ObjectId(), partnerId: id.toString(), orderId: "FIXTURE-1", items: [{ name: "Product", quantity: 2, price: 50 }], commission: { rate: 5, amount: 5, status: "pending" }, summary: { total: 100, subtotal: 100 }, customer: { name: "Fixture" }, createdAt: new Date() },
    { _id: new ObjectId(), partnerId: id.toString(), orderId: "FIXTURE-2", items: [], commission: { rate: 5, amount: 3, status: "credited" } },
  ]
  let reads = 0
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true }) },
    "@/lib/db-service": { getCollection: async name => ({
      find: query => {
        reads++
        if (name === "partners") {
          assert.equal(query.$or[1]._id.$in[0].toString(), id.toString())
          return { toArray: async () => [{ _id: id, name: "Native Partner", email: "partner@example.invalid" }] }
        }
        assert.equal(query["commission.status"], "pending")
        return { sort: () => ({ toArray: async () => rows }) }
      },
    }) },
  })
  const route = loader.load("app/api/admin/partner-commissions/route.ts")
  assert.equal((await route.GET(new NextRequest("https://fixture.invalid/api/admin/partner-commissions?status=unknown"))).status, 400)
  assert.equal(reads, 0)
  const response = await route.GET(new NextRequest("https://fixture.invalid/api/admin/partner-commissions?status=pending"))
  const data = (await response.json()).data
  assert.equal(data.partners[0].partnerName, "Native Partner")
  assert.equal(data.summary.totalPendingCommission, 5)
  assert.equal(data.summary.totalPaidCommission, 3)
  assert.equal(data.partners[0].orders[0].orderId, rows[0]._id.toString())
  assert.deepEqual(data.partners[0].orders[0].items[0], { name: "Product", quantity: 2, price: 50 })
})

test("partner lookup keeps legacy ID fallback but propagates database outages", async () => {
  const id = new ObjectId().toString()
  const queries = []
  let outage = false
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({ findOne: async query => {
      queries.push(query)
      if (outage) throw new Error("Fixture unavailable database")
      return query.id ? { _id: new ObjectId(id), name: "Fixture" } : null
    } }) },
  })
  const service = loader.load("lib/partner/service.ts")
  assert.equal((await service.getPartnerById(id)).id, id)
  assert.equal(queries.length, 2)
  outage = true
  await assert.rejects(service.getPartnerById(id), /unavailable database/)
  assert.equal(queries.length, 3)
})

test("settings round trips normalize IDs, protect immutable fields and retain offloaded image bytes", async () => {
  const id = new ObjectId()
  const stored = { _id: id, id: "stale-id", storeName: "Fixture", brandLogo: "data:image/png;base64,RklYVFVSRQ==", signature: "data:image/png;base64,U0lH", shippingFee: 49, createdAt: new Date("2026-01-01"), customSetting: { enabled: true } }
  const payloads = []
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      aggregate: () => ({ toArray: async () => [{
        ...stored, brandLogoIsData: true, brandLogoLen: stored.brandLogo.length, signatureIsData: true, signatureLen: stored.signature.length,
      }] }),
      updateOne: async (filter, update, options) => {
        assert.equal(Object.keys(filter).length, 0)
        assert.equal(options.upsert, true)
        payloads.push(update.$set)
        Object.assign(stored, update.$set)
      },
    }) } }) },
  })
  const db = loader.load("lib/db-service.ts")
  const read = await db.getSettingsData()
  assert.equal(read.id, id.toString())
  assert.equal(Object.hasOwn(read, "_id"), false)
  assert.equal(Object.hasOwn(read, "brandLogoLen"), false)
  assert.match(read.brandLogo, new RegExp(`/api/media/brand-logo/${id}`))
  const updated = await db.setSettingsData({ ...read, _id: "do-not-write", createdAt: "do-not-write", brandLogoLen: 999, storeName: "Updated" })
  assert.equal(updated.storeName, "Updated")
  assert.equal(stored.brandLogo, "data:image/png;base64,RklYVFVSRQ==")
  assert.equal(stored.signature, "data:image/png;base64,U0lH")
  assert.equal(stored.createdAt.toISOString(), "2026-01-01T00:00:00.000Z")
  for (const key of ["_id", "id", "createdAt", "brandLogo", "signature", "brandLogoLen"]) assert.equal(Object.hasOwn(payloads[0], key), false)
  assert.equal(payloads[0].customSetting.enabled, true)
})

test("settings handlers reject invalid money and malformed fields before writing and report database failures", async () => {
  let authorized = true
  let writes = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) } },
    "@/lib/db-service": {
      setSettingsData: async data => { writes++; return { ...data, id: "fixture" } },
      getSettingsData: async () => { throw new Error("Fixture private database failure") },
    },
  })
  const route = loader.load("app/api/settings/route.ts")
  const post = body => route.POST(new Request("https://fixture.invalid/api/settings", { method: "POST", body: JSON.stringify(body) }))
  for (const body of [null, [], { shippingFee: -1 }, { taxRate: 101 }, { estimatedDeliveryDays: 1.5 }, { codAvailable: "false" }, { "$set": { storeName: "Injected" } }, { "store.name": "Injected" }]) {
    assert.equal((await post(body)).status, 400)
  }
  assert.equal(writes, 0)
  const response = await post({ storeName: "Fixture", shippingFee: "49.50", taxRate: "18", estimatedDeliveryDays: "5", statStores: 12, customFlag: true })
  assert.equal(response.status, 200)
  const settings = await response.json()
  assert.equal(settings.shippingFee, 49.5)
  assert.equal(settings.statStores, "12")
  assert.equal(settings.customFlag, true)
  assert.equal(writes, 1)
  authorized = false
  assert.equal((await post({ storeName: "Unauthorized" })).status, 401)
  assert.equal(writes, 1)
  const read = await route.GET()
  assert.equal(read.status, 500)
  assert.equal(JSON.stringify(await read.json()).includes("private database"), false)
})

function partnerRegistrationFixture() {
  return {
    name: "Fixture Partner", email: "partner@example.invalid", phone: "9876543210",
    businessDetails: { gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", businessType: "pvt_ltd", registeredAddress: { line1: "Fixture Street", city: "Bengaluru", state: "Karnataka", pincode: "560001", country: "India" } },
  }
}

test("admin partner APIs validate filters and registration, preserve company alias/zero commission and hide unexpected errors", async () => {
  let reads = 0
  let creates = 0
  let failure = null
  const loader = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true }) },
    "@/lib/partner/service": {
      listPartners: async params => { reads++; assert.equal(params.page, 2); assert.equal(params.limit, 5); assert.equal(params.sortBy, "name"); return { partners: [], total: 7 } },
      createPartner: async input => {
        creates++
        if (failure) throw failure
        assert.equal(input.name, "Fixture Partner")
        assert.equal(input.commissionRate, 0)
        return { partner: { ...input, id: "fixture", status: "pending", createdAt: new Date() }, apiKey: "fixture-test-key" }
      },
    },
  }, { context: { Error } })
  const route = loader.load("app/api/admin/partners/route.ts")
  for (const query of ["page=-1", "limit=10000", "tier=unexpected", "status=unknown", "sortBy=password", "sortOrder=sideways"]) {
    assert.equal((await route.GET(new NextRequest(`https://fixture.invalid/api/admin/partners?${query}`))).status, 400)
  }
  assert.equal(reads, 0)
  const listed = await route.GET(new NextRequest("https://fixture.invalid/api/admin/partners?page=2&limit=5&sortBy=name"))
  assert.equal((await listed.json()).data.pagination.totalPages, 2)
  const fixture = partnerRegistrationFixture()
  fixture.companyName = fixture.name
  delete fixture.name
  fixture.commissionRate = 0
  const post = value => route.POST(new NextRequest("https://fixture.invalid/api/admin/partners", { method: "POST", body: JSON.stringify(value) }))
  assert.equal((await post({ ...fixture, tier: "bogus" })).status, 400)
  assert.equal((await post({ ...fixture, commissionRate: -1 })).status, 400)
  assert.equal((await post({ ...fixture, businessDetails: { gstin: "bad" } })).status, 400)
  assert.equal(creates, 0)
  assert.equal((await post(fixture)).status, 201)
  failure = new Error("Fixture private service failure")
  const unavailable = await post(fixture)
  assert.equal(unavailable.status, 500)
  assert.equal(JSON.stringify(await unavailable.json()).includes("private service"), false)
  failure = new Error("A partner with this email already exists")
  assert.equal((await post(fixture)).status, 409)
})

test("public partner registration reuses domain validation without accepting commission overrides", async () => {
  let creates = 0
  const loader = sourceLoader({
    "@/lib/partner/auth": { getCorsHeaders: () => ({ "access-control-allow-origin": "https://fixture.invalid" }), handleOptionsRequest: () => new Response() },
    "@/lib/partner/service": { partnerService: { createPartner: async input => {
      creates++
      assert.equal(input.commissionRate, undefined)
      return { partner: { ...input, id: "fixture", status: "pending" }, apiKey: "fixture-test-key" }
    } } },
  })
  const route = loader.load("app/api/v1/partner/register/route.ts")
  const post = body => route.POST(new NextRequest("https://fixture.invalid/api/v1/partner/register", { method: "POST", body: JSON.stringify(body) }))
  const fixture = partnerRegistrationFixture()
  for (const body of [{ ...fixture, name: { malformed: true } }, { ...fixture, tier: "unknown" }, { ...fixture, businessDetails: { ...fixture.businessDetails, registeredAddress: "not-an-address" } }]) {
    assert.equal((await post(body)).status, 400)
  }
  assert.equal(creates, 0)
  const response = await post({ ...fixture, commissionRate: 99 })
  assert.equal(response.status, 201)
  assert.equal(response.headers.get("access-control-allow-origin"), "https://fixture.invalid")
  assert.equal(creates, 1)
})

test("partner service honors requested sorting, treats searches literally and preserves zero commission", async () => {
  let sort
  let filter
  let inserted
  const collection = {
    find: query => {
      filter = query
      const cursor = { sort: value => { sort = value; return cursor }, skip: () => cursor, limit: () => cursor, toArray: async () => [] }
      return cursor
    },
    countDocuments: async () => 0,
    findOne: async () => null,
    insertOne: async partner => { inserted = partner },
  }
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => collection },
    "@/lib/partner/wallet": { createWallet: async () => ({ id: "fixture-wallet" }) },
    "@/lib/partner/api-keys": { generatePartnerAPIKey: async () => ({ key: "fixture-test-key" }) },
  })
  const service = loader.load("lib/partner/service.ts")
  await service.listPartners({ search: "(a+)+$", sortBy: "name", sortOrder: "asc" })
  assert.equal(sort.name, 1)
  assert.equal(filter.$or[0].name.$regex, "\\(a\\+\\)\\+\\$")
  const result = await service.createPartner({ ...partnerRegistrationFixture(), commissionRate: 0 })
  assert.equal(result.partner.commissionRate, 0)
  assert.equal(inserted.commissionRate, 0)
})

test("price imports share preview/execution validation, deduplicate consistently and guard concurrent MRP changes", async () => {
  const products = [
    { _id: new ObjectId(), itemno: "A", name: "Fixture A", price: 20, mrp: 100 },
    { _id: new ObjectId(), sku: "B", name: "Fixture B", price: 30, mrp: 200 },
    { _id: new ObjectId(), itemno: "C", name: "Fixture C", price: 10, mrp: 50 },
    { _id: new ObjectId(), itemno: "D", name: "Fixture D", price: 10 },
  ]
  const writes = []
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async name => {
      assert.equal(name, "products")
      return {
        find: query => { assert.ok(query.$or[1].sku.$in.includes("B")); return { toArray: async () => products } },
        findOneAndUpdate: async (filter, update) => {
          writes.push({ filter, update })
          assert.equal(filter.$or[2].mrp.$gte, update.$set.price)
          if (filter._id.equals(products[2]._id)) return null
          return { ...products.find(product => product._id.equals(filter._id)), ...update.$set }
        },
      }
    } },
  })
  const importer = loader.load("lib/product-price-import.ts")
  const rows = [
    { itemno: "A", price: 80 }, { itemno: "A", Price: "₹ 90" },
    { itemno: "B", PRICE: "2,001" }, { itemno: "C", price: 45 },
    { itemno: "D", price: "12junk" }, { itemno: "ZERO", price: 0 },
    { itemno: "NEG", price: -1 }, { itemno: "INF", price: Infinity },
    { itemno: "BOOL", price: true }, { Price: 12 },
  ]
  const preview = await importer.processProductPrices(rows, true)
  assert.equal(preview.ignoredDuplicates, 1)
  assert.equal(preview.updates.length, 9)
  assert.equal(preview.updates.find(row => row.sku === "A").newPrice, 90)
  assert.equal(preview.updates.find(row => row.sku === "B").error, "Price > MRP")
  assert.equal(preview.updates.filter(row => row.status === "valid").length, 2)
  assert.equal(writes.length, 0)
  const result = await importer.processProductPrices(rows, false)
  assert.equal(result.ignoredDuplicates, 1)
  assert.equal(result.success, 1)
  assert.equal(result.failed, 8)
  assert.equal(result.success + result.failed, preview.updates.length)
  assert.equal(writes.length, 2)
  assert.equal(writes[0].update.$set.price, 90)
  assert.ok(result.errors.some(error => error.includes("Product changed")))
})

test("price imports report row database failures without exposing raw exception details", async () => {
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({
      find: () => ({ toArray: async () => [{ _id: new ObjectId(), itemno: "A", price: 1 }] }),
      findOneAndUpdate: async () => { throw new Error("Fixture private infrastructure detail") },
    }) },
  })
  const result = await loader.load("lib/product-price-import.ts").processProductPrices([{ itemno: "A", price: 2 }], false)
  assert.equal(result.success, 0)
  assert.equal(result.failed, 1)
  assert.equal(result.errors[0], "Row 2: Product update failed for itemno A")
})

test("Google price sync only fetches bounded HTTPS Google Sheets and approved redirect hosts", async () => {
  let fetches = 0
  const globals = { fetch: async () => {
    fetches++
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } })
  } }
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
  }, globals)
  const url = loader.load("lib/product-price-import.ts").googleSheetExportUrl
  assert.equal(url("abc_123"), "https://docs.google.com/spreadsheets/d/abc_123/export?format=csv")
  assert.equal(url("https://docs.google.com/spreadsheets/d/abc/edit#gid=0"), "https://docs.google.com/spreadsheets/d/abc/export?format=csv")
  assert.equal(url("https://docs.google.com/spreadsheets/d/e/2PACX-fixture/pub?gid=0"), "https://docs.google.com/spreadsheets/d/e/2PACX-fixture/pub?gid=0&output=csv")
  const route = loader.load("app/api/products/google-sheet-price-sync/route.ts")
  const post = body => route.POST(new NextRequest("https://fixture.invalid/api/products/google-sheet-price-sync", { method: "POST", body: JSON.stringify(body) }))
  for (const sheetId of ["https://evil.invalid/pub?output=csv", "http://docs.google.com/spreadsheets/d/abc/edit", "https://user:password@docs.google.com/spreadsheets/d/abc/edit", "abc/path", "https://docs.google.com:444/spreadsheets/d/abc/edit"]) {
    assert.equal(url(sheetId), null)
    assert.equal((await post({ sheetId })).status, 400)
  }
  assert.equal((await post({ sheetId: 123 })).status, 400)
  assert.equal((await post({ sheetId: "abc", preview: "false" })).status, 400)
  assert.equal(fetches, 0)
  assert.equal((await post({ sheetId: "abc" })).status, 500)
  assert.equal(fetches, 1)
  const oversized = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
  }, { fetch: async () => new Response("fixture", { headers: { "content-length": String(11 * 1024 * 1024) } }) })
  assert.equal((await oversized.load("app/api/products/google-sheet-price-sync/route.ts").POST(new NextRequest("https://fixture.invalid/api/products/google-sheet-price-sync", { method: "POST", body: JSON.stringify({ sheetId: "abc" }) }))).status, 400)
})

test("spreadsheet price endpoint validates upload shape, parses real sheets and guards before work", async () => {
  const XLSX = await import("xlsx")
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ itemno: "A", price: 42 }]), "Prices")
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" })
  let authorized = true
  let writes = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true } : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) } },
    "@/lib/db-service": { getCollection: async () => ({
      find: () => ({ toArray: async () => [{ _id: new ObjectId(), itemno: "A", price: 1, mrp: 50 }] }),
      findOneAndUpdate: async () => { writes++; return { itemno: "A", price: 42 } },
    }) },
  }, { context: { Blob } })
  const route = loader.load("app/api/products/bulk-price-update/route.ts")
  const form = new FormData()
  form.set("file", "not-a-file")
  const post = () => route.POST(new NextRequest("https://fixture.invalid/api/products/bulk-price-update", { method: "POST", body: form }))
  assert.equal((await post()).status, 400)
  form.set("file", new Blob([buffer]), "prices.xlsx")
  form.set("preview", "true")
  const preview = await (await post()).json()
  assert.equal(preview.updates[0].status, "valid")
  assert.equal(preview.updates[0].newPrice, 42)
  assert.equal(writes, 0)
  form.set("preview", "false")
  assert.equal((await (await post()).json()).success, 1)
  assert.equal(writes, 1)
  authorized = false
  assert.equal((await post()).status, 401)
  assert.equal(writes, 1)
})

function cacheFixture(entries = new Map(), options = {}) {
  const messages = []
  const messageWaiters = new Set()
  const log = (...args) => {
    messages.push(args)
    for (const waiter of messageWaiters) {
      if (String(args[0]).includes(waiter.fragment)) waiter.resolve()
    }
  }
  let clock = 1000000
  let writes = 0
  const indexedDB = {
    open() {
      const request = {}
      const db = {
        close() {},
        transaction() {
          const tx = {
            objectStore: () => ({
              get(key) {
                const read = {}
                setTimeout(() => {
                  read.result = entries.get(key)
                  read.onsuccess()
                }, 0)
                return read
              },
              put(value, key) {
                writes++
                setTimeout(() => {
                  if (options.abortWrites) {
                    tx.error = new Error("Fixture transaction aborted")
                    tx.onabort()
                  } else {
                    entries.set(key, structuredClone(value))
                    tx.oncomplete()
                  }
                }, 0)
              },
              delete(key) {
                setTimeout(() => {
                  if (options.abortDeletes) {
                    tx.error = new Error("Fixture deletion aborted")
                    tx.onabort()
                  } else {
                    entries.delete(key)
                    tx.oncomplete()
                  }
                }, 0)
              },
            }),
          }
          return tx
        },
      }
      setTimeout(() => { request.result = db; request.onsuccess() }, 0)
      return request
    },
  }
  class FixtureDate extends Date { static now() { return clock } }
  const loader = sourceLoader({}, { context: {
    indexedDB, Date: FixtureDate,
    console: { warn: log, error: log },
  } })
  return {
    cache: loader.load("utils/cache.ts"), loader, entries, messages,
    advance: value => { clock += value },
    writes: () => writes,
    waitForMessage: fragment => {
      if (messages.some(message => String(message[0]).includes(fragment))) return Promise.resolve()
      return new Promise((resolve, reject) => {
        const waiter = { fragment, resolve: () => { clearTimeout(timer); messageWaiters.delete(waiter); resolve() } }
        const timer = setTimeout(() => { messageWaiters.delete(waiter); reject(new Error(`Expected cache message: ${fragment}`)) }, 5000)
        messageWaiters.add(waiter)
      })
    },
  }
}

test("storefront cache validates network, memory and persisted payloads before returning data", async () => {
  const { z } = await import("zod")
  const parser = z.array(z.object({ id: z.string(), price: z.number() }))
  const fixture = cacheFixture(new Map([
    ["malformed", { data: [{ id: "bad", price: "not-a-price" }], timestamp: 999999 }],
    ["future", { data: [{ id: "future", price: 3 }], timestamp: 2000000 }],
    ["bad-age", { data: [], timestamp: "recent" }],
  ]))
  const rows = [{ id: "fixture", price: 42 }]
  for (const key of ["malformed", "future", "bad-age"]) {
    let reads = 0
    assert.deepEqual(await fixture.cache.fetchWithCache(key, async () => { reads++; return rows }, parser), rows)
    assert.equal(reads, 1)
  }
  await assert.rejects(fixture.cache.fetchWithCache("invalid-network", async () => [{ id: "bad" }], parser))
  assert.equal(fixture.cache.getCached("invalid-network", parser), null)
  fixture.cache.setCached("incompatible", rows, parser)
  assert.equal(fixture.cache.getCached("incompatible", z.array(z.string())), null)
  assert.throws(() => fixture.cache.setCached("invalid-write", "not-an-array", parser))
  assert.equal(fixture.cache.getCached("invalid-write", parser), null)
  assert.ok(fixture.messages.some(message => message[0].includes("invalid entry")))
})

test("cache promotion retains persisted age and failed refreshes never renew stale data", async () => {
  const { z } = await import("zod")
  const parser = z.array(z.string())
  const fixture = cacheFixture(new Map([["stale", { data: ["old"], timestamp: 999950 }]]))
  let calls = 0
  const fail = async () => { calls++; throw new Error("Fixture offline") }
  assert.deepEqual(await fixture.cache.getFromCache("stale", parser, 100), ["old"])
  fixture.advance(51)
  assert.equal(fixture.cache.getCached("stale", parser, 100), null)
  assert.deepEqual(await fixture.cache.fetchWithCache("stale", fail, parser, 100), ["old"])
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(calls, 1)
  assert.equal(fixture.cache.getCached("stale", parser, 100), null)
  assert.deepEqual(await fixture.cache.fetchWithCache("stale", fail, parser, 100), ["old"])
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(calls, 2)
  assert.equal(fixture.entries.get("stale").timestamp, 999950)
  assert.equal(fixture.writes(), 0)
  assert.ok(fixture.messages.some(message => message[0].includes("refresh failed")))
})

test("concurrent cache reads deduplicate refresh and invalid revalidation preserves prior data", async () => {
  const { z } = await import("zod")
  const parser = z.array(z.string())
  const fixture = cacheFixture()
  let calls = 0
  const fetcher = async () => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 15))
    return ["fresh"]
  }
  const result = await Promise.all([
    fixture.cache.fetchWithCache("shared", fetcher, parser),
    fixture.cache.fetchWithCache("shared", fetcher, parser),
  ])
  assert.deepEqual(result, [["fresh"], ["fresh"]])
  assert.equal(calls, 1)
  fixture.cache.revalidateCache("shared", async () => ({ invalid: true }), parser)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.deepEqual(fixture.cache.getCached("shared", parser), ["fresh"])
  assert.equal(fixture.writes(), 1)
  assert.ok(fixture.messages.some(message => message[0].includes("Revalidation failed")))
  await fixture.cache.clearCache("shared")
  assert.equal(fixture.cache.getCached("shared", parser), null)
  assert.equal(fixture.entries.has("shared"), false)
})

test("aborted cache persistence is logged and aborted deletion reports failure", async () => {
  const { z } = await import("zod")
  const parser = z.string()
  const fixture = cacheFixture(new Map(), { abortWrites: true, abortDeletes: true })
  fixture.cache.setCached("aborted", "valid", parser)
  await fixture.waitForMessage("Persistence unavailable")
  assert.equal(fixture.entries.has("aborted"), false)
  assert.equal(fixture.cache.getCached("aborted", parser), "valid")
  assert.ok(fixture.messages.some(message => message[0].includes("Persistence unavailable")))
  await assert.rejects(fixture.cache.clearCache("aborted"), /could not be cleared/)
  assert.ok(fixture.messages.some(message => message[0].includes("deletion failed")))
})

test("homepage envelopes and listing contracts retain metadata without trusting malformed rows", () => {
  const loader = sourceLoader()
  const home = loader.load("lib/catalog-list-response.ts")
  assert.deepEqual(home.homeBrandListResponseSchema.parse({ brands: [{ name: "Fixture", slug: null, logo: "/fixture.png" }] }), [{ name: "Fixture", slug: null, logo: "/fixture.png" }])
  assert.deepEqual(home.homeStoreListResponseSchema.parse({ success: true, stores: [{ name: "Fixture Store" }] }), [{ name: "Fixture Store" }])
  assert.throws(() => home.homeStoreListResponseSchema.parse({ stores: [{ name: 123 }] }))
  const listing = loader.load("lib/product-card-response.ts").productListingListResponseSchema
  const rows = listing.parse([{ id: "fixture", name: "Fixture", price: 123, stock: null, description: null, subCategory: null, raw: { MRP: "150" }, reviews: { average: 4.2, count: 7 }, technical_details: { "Screen Size": "42" } }])
  assert.equal(rows[0].stock, 0)
  assert.equal(rows[0].description, "")
  assert.equal(rows[0].subCategory, undefined)
  assert.equal(rows[0].reviews.average, 4.2)
  assert.equal(rows[0].technical_details["Screen Size"], "42")
  assert.throws(() => listing.parse([{ id: "fixture", name: "Fixture", price: "123" }]))
})

test("credential verification retains service failure, inactive-user rejection and last-login behavior", async () => {
  const bcrypt = await import("bcryptjs")
  const password = "Fixture-password-719"
  const record = { _id: new ObjectId(), name: "Fixture", email: "auth@example.invalid", password: await bcrypt.default.hash(password, 4), sessionVersion: 3 }
  let updates = 0
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async query => query.email === record.email || String(query._id) === String(record._id) ? record : null,
      updateOne: async query => { assert.equal(query._id, record._id); updates++ },
    }) } }) },
    "@/lib/db-service": { getById: async () => ({ ...record, id: record._id.toString() }) },
  })
  const credentials = loader.load("lib/auth-credentials.ts")
  assert.equal((await credentials.verifyCredentials(record.email, "wrong")).status, 401)
  const result = await credentials.verifyCredentials(record.email.toUpperCase(), password)
  assert.equal(result.ok, true)
  assert.equal(result.user.id, record._id.toString())
  assert.equal(result.user.role, "user")
  assert.equal(result.user.sessionVersion, 3)
  assert.equal(Object.hasOwn(result.user, "password"), false)
  assert.equal(updates, 1)
  const loaded = await credentials.getAuthenticatedUserById(record._id.toString())
  assert.equal(loaded.email, record.email)
  assert.equal(loaded.sessionVersion, 3)
  record.status = "inactive"
  assert.equal((await credentials.verifyCredentials(record.email, password)).status, 403)
  assert.equal(await credentials.getAuthenticatedUserById(record._id.toString()), null)
  assert.equal(updates, 1)
  const outage = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => { throw new Error("Fixture database outage") } },
  }).load("lib/auth-credentials.ts")
  assert.equal((await outage.verifyCredentials(record.email, password)).status, 503)
  await assert.rejects(() => outage.getAuthenticatedUserById(record._id.toString()), /Fixture database outage/)
})

test("Google signup races cannot authenticate a newly disabled account or write consent", async () => {
  let reads = 0
  let consentWrites = 0
  const loader = sourceLoader({
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      findOne: async () => ++reads === 1 ? null : { _id: new ObjectId(), name: "Fixture", email: "race@example.invalid", status: "inactive" },
      insertOne: async () => { throw new Error("Fixture duplicate key") },
    }) } }) },
    "@/lib/consent": { recordConsent: async () => { consentWrites++ }, CONSENT_PURPOSES: {} },
  })
  const result = await loader.load("lib/auth-google.ts").createGoogleUser({ email: "race@example.invalid", emailVerified: true }, {})
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
  assert.equal(consentWrites, 0)
})

test("partner authentication wrapper retains promised route params, permissions and API-key CORS methods", async () => {
  const key = { id: "fixture-key", partnerId: new ObjectId().toString(), tier: "starter", allowedMethods: ["GET", "PATCH"] }
  const partner = { _id: new ObjectId(key.partnerId), name: "Fixture", email: "partner@example.invalid", status: "active" }
  let handlerCalls = 0
  let allowed = true
  const loader = sourceLoader({
    "@/lib/partner/api-keys": { validateAPIKey: async value => value === "fixture" ? key : null, hasPermission: () => allowed },
    "@/lib/partner/rate-limit": { checkPartnerRateLimit: async () => ({ allowed: true }) },
    "@/lib/db-service": { getCollection: async () => ({ findOne: async () => partner, updateOne: async () => ({ matchedCount: 1 }) }) },
  })
  const { withPartnerAuth } = loader.load("lib/partner/auth.ts")
  const handler = withPartnerAuth(async (request, context) => {
    handlerCalls++
    assert.equal(request.partner.id, key.partnerId)
    assert.equal(request.apiKey.id, key.id)
    assert.equal((await context.params).id, "fixture-item")
    return Response.json({ success: true })
  }, ["products:read"])
  const request = (origin = "https://client.invalid") => new NextRequest("https://fixture.invalid/api/v1/partner/products/fixture-item", { headers: { authorization: "Bearer fixture", origin } })
  const response = await handler(request(), { params: Promise.resolve({ id: "fixture-item" }) })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, PATCH")
  // An origin outside the allowlist gets no Allow-Origin at all. Reflecting it
  // alongside Allow-Credentials: true would let any website read this partner
  // data, and middleware.ts skips this surface entirely.
  assert.equal(response.headers.get("access-control-allow-origin"), null)
  assert.equal(response.headers.get("access-control-allow-credentials"), null)
  assert.equal(response.headers.get("vary"), "Origin")
  assert.ok(response.headers.get("x-request-id"))
  const allowlisted = await handler(request("http://localhost:3000"), { params: Promise.resolve({ id: "fixture-item" }) })
  assert.equal(allowlisted.headers.get("access-control-allow-origin"), "http://localhost:3000")
  assert.equal(allowlisted.headers.get("access-control-allow-credentials"), "true")
  allowed = false
  assert.equal((await handler(request(), { params: Promise.resolve({ id: "fixture-item" }) })).status, 403)
  assert.equal(handlerCalls, 2)
})

test("bot checks reject malformed timestamps and reCAPTCHA replies without contacting real providers", async () => {
  let hits = 0
  const globals = { env: { RECAPTCHA_SECRET_KEY: "fixture" }, fetch: async () => Response.json({ success: true, score: "0.9" }) }
  const loader = sourceLoader({
    "@/lib/rate-limit-store": { rateLimitHit: async () => { hits++; return { limited: false } } },
  }, globals)
  const bot = loader.load("lib/botDetection.ts")
  assert.equal(bot.verifyTimestamp(Date.now() - 5000), true)
  assert.equal(bot.verifyTimestamp(String(Date.now() - 5000)), false)
  assert.equal(bot.verifyTimestamp(NaN), false)
  assert.equal(bot.verifyHoneypot("spam"), false)
  assert.equal((await bot.verifyRecaptcha("fixture", "fixture")).success, false)
  const request = new NextRequest("https://fixture.invalid/api/auth/signup", { headers: { "user-agent": "Fixture Browser" } })
  assert.equal((await bot.detectBot(request, { recaptchaToken: { fake: true } })).isBot, true)
  assert.equal((await bot.detectBot(request, {})).isBot, false)
  assert.equal(hits, 2)
  const valid = sourceLoader({}, { fetch: async () => Response.json({ success: true, score: 0.9 }) }).load("lib/botDetection.ts")
  assert.equal((await valid.verifyRecaptcha("fixture", "fixture")).success, true)
  const failed = sourceLoader({}, { fetch: async () => Response.json({ success: true, score: 0.9 }, { status: 503 }) }).load("lib/botDetection.ts")
  assert.equal((await failed.verifyRecaptcha("fixture", "fixture")).success, false)
})

test("license listings guard access, preserve native/legacy order enrichment and return normalized IDs", async () => {
  const ids = Array.from({ length: 4 }, () => new ObjectId())
  const orderId = new ObjectId()
  const rows = [
    { _id: ids[0], key: "FIXTURE-ASSIGNED", status: "assigned", validityYears: 1, maxDevices: 2, assignedTo: { customerName: "Fixture", customerEmail: "customer@example.invalid", orderNumber: "FIXTURE-ORDER" }, expiresAt: "2027-01-01T00:00:00.000Z" },
    { _id: ids[1], key: "FIXTURE-NATIVE", status: "assigned", orderId: orderId.toString(), validityDays: "30" },
    { _id: ids[2], key: "FIXTURE-LEGACY", status: "assigned", orderId: "legacy-order", validity: "2 Years" },
    { _id: ids[3], key: "FIXTURE-DATE", status: "assigned", orderId: "invalid-date", validityYears: 1 },
  ]
  const queries = []
  let reads = 0
  const stored = [
    { _id: orderId, customer: { firstName: "Fixture", lastName: "Buyer" }, shippingAddress: { email: "customer@example.invalid" }, createdAt: { $date: "2026-01-01T00:00:00.000Z" } },
    { _id: new ObjectId(), id: "legacy-order", customer: { name: "Legacy" }, createdAt: "2026-01-01T00:00:00.000Z" },
    { _id: new ObjectId(), id: "invalid-date", createdAt: "not-a-date" },
  ]
  const orders = {
    find: query => {
      queries.push(query)
      const [byObjectId, byIdField, byStringId] = query.$or
      const objectIds = byObjectId._id.$in.map(String)
      return {
        toArray: async () => stored.filter(order =>
          (order._id instanceof ObjectId && objectIds.includes(order._id.toString())) ||
          (order.id && byIdField.id.$in.includes(order.id)) ||
          byStringId._id.$in.includes(order._id)),
      }
    },
  }
  let authorized = true
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => authorized ? { ok: true, user: { id: new ObjectId().toString() } } : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) } },
    "@/lib/software-service": { getAllLicenseKeys: async filter => { reads++; assert.equal(filter.status, "assigned"); return rows } },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => orders } }) },
  })
  const route = loader.load("app/api/software/license-keys/route.ts")
  const request = new Request("https://fixture.invalid/api/software/license-keys?status=assigned")
  const response = await route.GET(request)
  assert.equal(response.status, 200)
  const data = await response.json()
  const contract = loader.load("lib/license-key-response.ts").licenseKeyListResponseSchema.parse(data)
  assert.equal(contract.keys.length, 4)
  assert.equal(data.keys[0].id, ids[0].toString())
  assert.equal(Object.hasOwn(data.keys[0], "_id"), false)
  assert.equal(contract.keys[0].expiresAt, rows[0].expiresAt)
  assert.equal(contract.keys[1].assignedTo.customerName, "Fixture Buyer")
  assert.equal(contract.keys[1].expiresAt, "2026-01-31T00:00:00.000Z")
  assert.equal(contract.keys[2].expiresAt, "2028-01-01T00:00:00.000Z")
  assert.equal(contract.keys[3].expiresAt, undefined)
  assert.equal(queries.length, 1, "orders must be fetched in one batched query, not per key")
  assert.ok(queries[0].$or[0]._id.$in[0] instanceof ObjectId)
  assert.equal((await route.GET(new Request("https://fixture.invalid/api/software/license-keys?status=unknown"))).status, 400)
  authorized = false
  assert.equal((await route.GET(request)).status, 401)
  assert.equal(reads, 1)
})

test("license writes validate key/device/validity input before persistence and preserve revoke password checks", async () => {
  const softwareId = new ObjectId().toString()
  const keyId = new ObjectId().toString()
  let added = 0
  let revoked = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: new ObjectId().toString() } }) },
    "@/lib/software-service": {
      addLicenseKeys: async (id, keys) => { added++; assert.equal(id, softwareId); assert.equal(keys[0].key, "FIXTURE"); assert.equal(keys[0].maxDevices, 2); return keys.length },
      revokeLicenseKey: async (id, reason) => { revoked++; assert.equal(id, keyId); assert.equal(reason, "Revoked by admin"); return true },
    },
  }, { env: { REVOKE_PASSWORD: "fixture-revoke" } })
  const route = loader.load("app/api/software/license-keys/route.ts")
  const request = (method, body) => new Request("https://fixture.invalid/api/software/license-keys", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  for (const keys of [[], [{ key: "", validityYears: 1 }], [{ key: "FIXTURE", validityYears: 9 }], [{ key: "FIXTURE", validityYears: 1, maxDevices: -1 }]]) {
    assert.equal((await route.POST(request("POST", { softwareId, keys }))).status, 400)
  }
  assert.equal(added, 0)
  assert.equal((await route.POST(request("POST", { softwareId, keys: [{ key: " FIXTURE ", validityYears: "1", maxDevices: "2" }] }))).status, 200)
  assert.equal(added, 1)
  assert.equal((await route.PATCH(request("PATCH", { keyId, action: "revoke", password: "wrong" }))).status, 401)
  assert.equal(revoked, 0)
  assert.equal((await route.PATCH(request("PATCH", { keyId, action: "revoke", password: "fixture-revoke" }))).status, 200)
  assert.equal(revoked, 1)
})

test("license enrichment surfaces a database failure rather than issuing an incomplete success", async () => {
  let orderQueries = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/software-service": { getAllLicenseKeys: async () => [{ _id: new ObjectId(), key: "FIXTURE", status: "assigned", orderId: new ObjectId().toString() }] },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      find: () => ({ toArray: async () => { orderQueries++; throw new Error("Fixture order service unavailable") } }),
    }) } }) },
  })
  const response = await loader.load("app/api/software/license-keys/route.ts").GET(new Request("https://fixture.invalid/api/software/license-keys"))
  assert.equal(response.status, 500)
  assert.equal((await response.json()).error, "Failed to fetch license keys")
  assert.equal(orderQueries, 1)
})

test("push delivery validates exact ticket batches, deduplicates tokens and prunes only dead devices", async () => {
  const tokens = Array.from({ length: 101 }, (_, index) => `ExpoPushToken[fixture-${index}]`)
  const batches = []
  let pruned = []
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({ deleteMany: async query => { pruned = query.token.$in } }) },
  }, { fetch: async (_url, init) => {
    const payload = JSON.parse(init.body)
    batches.push(payload)
    assert.equal(payload[0].badge, 2)
    return Response.json({ data: payload.map(item => item.to === tokens[2]
      ? { status: "error", details: { error: "DeviceNotRegistered" } }
      : { status: "ok", id: `ticket-${item.to}` }) })
  } })
  const delivered = await loader.load("lib/push.ts").sendPushToTokens([...tokens, tokens[0], ""], { title: "Fixture", body: "Fixture", badge: 2 })
  assert.equal(delivered, 100)
  assert.deepEqual(batches.map(batch => batch.length), [100, 1])
  assert.deepEqual(Array.from(pruned), [tokens[2]])
  for (const reply of [{ data: [{ status: "ok", id: "a" }, { status: "ok", id: "b" }] }, { data: [{ status: "ok" }] }, { data: "malformed" }]) {
    const invalid = sourceLoader({}, { fetch: async () => Response.json(reply) }).load("lib/push.ts")
    assert.equal(await invalid.sendPushToTokens([tokens[0]], { title: "Fixture", body: "Fixture" }), 0)
  }
})

test("poster settings preserve legacy product links and enabled slugs while rejecting offsite paths", async () => {
  let written
  const loader = sourceLoader({
    "@/lib/posters": { POSTERS: [{ slug: "fixture" }] },
    "@/lib/db-service": { getCollection: async () => ({
      updateOne: async (_filter, update) => { written = update.$set; return { matchedCount: 1 } },
      findOne: async () => written,
    }) },
  })
  const settings = loader.load("lib/poster-settings.ts")
  const clean = await settings.setPosterSettings({
    enabled: ["fixture", "fixture", "missing", "custom-fixture", 12],
    links: {
      fixture: { href: "/products", productId: " legacy-product " },
      "custom-fixture": { href: "/\\outside.invalid", feature: { type: "category", id: " fixture-category " } },
      "custom-bad": { href: "//outside.invalid", feature: { type: "invalid", id: "fixture" } },
      missing: { href: "/offers" },
    },
  })
  assert.deepEqual(Array.from(clean.enabled), ["fixture", "custom-fixture"])
  assert.equal(clean.links.fixture.feature.id, "legacy-product")
  assert.equal(clean.links["custom-fixture"].href, "/products")
  assert.equal(clean.links["custom-fixture"].feature.id, "fixture-category")
  assert.equal(clean.links["custom-bad"].href, "/products")
  assert.equal(clean.links["custom-bad"].feature, undefined)
  assert.equal(clean.links.missing, undefined)
  assert.equal((await settings.getPosterSettings()).links.fixture.href, "/products")
  const partial = await settings.setPosterSettings({ enabled: ["fixture"], links: 17 })
  assert.equal(partial.enabled[0], "fixture")
  assert.equal(Object.keys(partial.links).length, 0)
})

test("poster publication rejects invalid links, duplicate selections and empty features before storage", async () => {
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/db-service": { getCollection: async () => { throw new Error("Unexpected poster storage access") } },
    "@/lib/api-error": { handleApiError: () => Response.json({ error: "Fixture failure" }, { status: 500 }) },
  })
  const route = loader.load("app/api/posters/route.ts")
  for (const body of [
    { enabled: ["a", "a"], links: {} },
    { enabled: [], links: { a: { href: "/\\outside.invalid" } } },
    { enabled: [], links: { a: { href: "/products", feature: { type: "product", id: "" } } } },
  ]) {
    assert.equal((await route.PUT(new Request("https://fixture.invalid/posters", { method: "PUT", body: JSON.stringify(body) }))).status, 400)
  }
  assert.equal((await route.PUT(new Request("https://fixture.invalid/posters", { method: "PUT", body: "{" }))).status, 400)
})

test("poster reads propagate database outages and writes require a real acknowledgement", async () => {
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({
      findOne: async () => { throw new Error("Injected poster read failure") },
      find: () => ({ sort: () => ({ toArray: async () => { throw new Error("Injected custom poster read failure") } }) }),
      updateOne: async () => ({ matchedCount: 0, upsertedId: null }),
    }) },
  })
  const settings = loader.load("lib/poster-settings.ts")
  const custom = loader.load("lib/custom-posters.ts")
  await assert.rejects(settings.getPosterSettings(), /Injected poster read failure/)
  await assert.rejects(custom.listCustomPosters(), /Injected custom poster read failure/)
  await assert.rejects(settings.setPosterSettings({ enabled: [], links: {} }), /not acknowledged/)
})

test("bulk status results remove only successful approved rows and retain failures, rejects and pending rows", () => {
  const { normalizeBulkStatusRow, removeSuccessfulBulkRows, bulkOrderUpdateResponseSchema } = sourceLoader().load("lib/bulk-order-update.ts")
  const normalized = normalizeBulkStatusRow({ "ORDER ID": 123, order_status: " shipped ", TRACKING: " FIXTURE " })
  assert.equal(normalized.orderId, "123")
  assert.equal(normalized.status, "shipped")
  assert.equal(normalized.trackingNumber, "FIXTURE")
  const done = { orderId: "first", status: "shipped", approved: true }
  const failed = { orderId: "second", status: "delivered", approved: true }
  const rejected = { orderId: "third", status: "shipped", approved: false }
  const pending = { orderId: "fourth", status: "shipped" }
  const result = bulkOrderUpdateResponseSchema.parse({
    success: [done], failed: [{ row: failed, error: "Fixture not found" }], message: "Fixture",
    notifications: { sent: 0, failed: 1, skipped: 0 },
  })
  const remaining = removeSuccessfulBulkRows([done, failed, rejected, pending], result)
  assert.deepEqual(Array.from(remaining), [failed, rejected, pending])
  assert.throws(() => removeSuccessfulBulkRows([done, failed], { ...result, failed: [] }), /incomplete/)
  assert.throws(() => removeSuccessfulBulkRows([done, failed], { ...result, success: [done, done] }), /duplicate/)
  assert.throws(() => removeSuccessfulBulkRows([done, failed], { ...result, notifications: { sent: 0, failed: 0, skipped: 0 } }), /incomplete/)
  const duplicate = { ...done }
  assert.equal(removeSuccessfulBulkRows([done, duplicate], { ...result, failed: [{ row: duplicate, error: "Fixture duplicate failed" }] }).length, 1)
})

test("bulk status updates report real email outcomes and reject malformed rows before writes", async () => {
  const ids = Array.from({ length: 3 }, () => new ObjectId())
  const records = new Map(ids.map((id, index) => [id.toString(), {
    _id: id, status: "pending", total: 100, items: [], timeline: [],
    customer: index === 2 ? {} : { email: `bulk-${index}@example.invalid`, name: "Fixture" },
  }]))
  let writes = 0
  const queriedId = query => query._id ?? query.$and?.find(part => part._id)?._id
  const loader = sourceLoader({
    "@/lib/auth": {
      requireAdmin: async () => ({ ok: true }),
      getSession: async () => ({ user: { id: "fixture-admin", role: "admin" } }),
    },
    "@/lib/db-service": {
      createObjectId: id => new ObjectId(id),
      normalizeId: row => { const { _id, ...rest } = row; return { ...rest, id: _id.toString() } },
      getCollection: async () => ({
        findOne: async query => records.get(queriedId(query).toString()) ?? null,
        updateOne: async (query, update) => { writes++; Object.assign(records.get(queriedId(query).toString()), update.$set); return { matchedCount: 1 } },
      }),
    },
    "@/lib/emailTemplates": { getEmailTemplateId: status => status, getEmailSubject: () => "Fixture", getEmailTemplate: () => "<p>Fixture</p>" },
    "@/lib/email": { sendEmail: async data => ({ success: data.to === "bulk-0@example.invalid" }) },
  })
  const route = loader.load("app/api/orders/bulk-update/route.ts")
  const request = rows => new NextRequest("https://fixture.invalid/api/orders/bulk-update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows }) })
  assert.equal((await route.POST(request([null]))).status, 400)
  assert.equal(writes, 0)
  const rows = ids.map(id => ({ orderId: id.toString(), status: "shipped", trackingNumber: "FIXTURE", approved: true }))
  rows.push({ orderId: new ObjectId().toString(), status: "invalid", approved: true })
  const response = await route.POST(request(rows))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.success.length, 3)
  assert.equal(result.failed.length, 1)
  assert.deepEqual(result.notifications, { sent: 1, failed: 1, skipped: 1 })
  assert.equal(writes, 3)
  assert.equal(records.get(ids[0].toString()).trackingNumber, "FIXTURE")
  const { removeSuccessfulBulkRows, bulkOrderUpdateResponseSchema } = loader.load("lib/bulk-order-update.ts")
  assert.equal(removeSuccessfulBulkRows(rows, bulkOrderUpdateResponseSchema.parse(result))[0].status, "invalid")
})

test("custom posters normalize real fields, reject SVG injection and keep unique generated slugs", async () => {
  const stored = new Map()
  const loader = sourceLoader({
    "@/lib/posters": { POSTER_BY_SLUG: {} },
    "@/lib/db-service": { getCollection: async () => ({
      findOne: async ({ slug }) => stored.get(slug) ?? null,
      insertOne: async doc => { stored.set(doc.slug, doc); return { insertedId: new ObjectId() } },
      updateOne: async ({ slug }, update) => { stored.set(slug, update.$set) },
      find: () => ({ sort: () => ({ toArray: async () => Array.from(stored.values()) }) }),
    }) },
  })
  const posters = loader.load("lib/custom-posters.ts")
  const first = await posters.saveCustomPoster({ headline: " Fixture  poster ", headlineAccent: " Sale ", motif: "grid", group: "Festival", from: '#fff" onload="evil', accent: "#123abc", photo: "https://external.invalid/image.svg" })
  assert.equal(first.slug, "custom-fixture-poster-sale")
  assert.equal(first.headline, "Fixture poster")
  assert.equal(first.motif, "grid")
  assert.equal(first.group, "Festival")
  assert.equal(first.from, "#0F2557")
  assert.equal(first.accent, "#123abc")
  assert.equal(first.photo, undefined)
  const second = await posters.saveCustomPoster({ headline: "Fixture poster", headlineAccent: "Sale", motif: 17 })
  assert.equal(second.slug, "custom-fixture-poster-sale-2")
  assert.equal(second.motif, "rays")
  assert.equal((await posters.listCustomPosters()).length, 2)
  assert.equal((await posters.getCustomPoster(first.slug)).slug, first.slug)
})

test("store normalization preserves native IDs, derived city/PIN, numeric phones and city counts", async () => {
  const nativeId = new ObjectId()
  const rows = [
    { _id: nativeId, shopName: " Fixture & Main ", locationDescription: "23 Main Road, Bengaluru - 560027", mobileNo: 9876543210, latitude: 12.9, longitude: 77.6 },
    { _id: "legacy-store", shopName: "Fixture Other", city: "Bengaluru", pincode: 560001 },
    { _id: "no-name", city: "Bengaluru" },
    { _id: "no-city", shopName: "Fixture Unknown" },
  ]
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => ({ find: filter => {
      assert.equal(filter.isActive, true)
      return { sort: () => ({ toArray: async () => rows }) }
    } }) },
  })
  const stores = loader.load("lib/store-locations.ts")
  const locations = await stores.getAllStoreLocations()
  assert.equal(locations.length, 2)
  assert.equal(locations[0].id, nativeId.toString())
  assert.equal(locations[0].city, "Bengaluru")
  assert.equal(locations[0].pincode, "560027")
  assert.equal(locations[0].phone, "9876543210")
  assert.equal(locations[0].slug, "fixture-and-main")
  assert.equal(locations[1].id, "legacy-store")
  assert.equal((await stores.getStoreCities())[0].storeCount, 2)
})

test("email template dispatch validates each template's real payload without type casts", () => {
  const { getEmailTemplate, emailTemplateDataSchemas } = sourceLoader().load("lib/emailTemplates.ts")
  const order = { orderNumber: "FIXTURE-ORDER", customerName: "Fixture", orderDetails: { total: 100, items: [{ name: "Fixture", price: 100, quantity: 1 }] } }
  for (const id of ["ORDER_PENDING", "ORDER_PROCESSING", "ORDER_SHIPPED", "ORDER_DELIVERED", "ORDER_CANCELLED"]) {
    assert.match(getEmailTemplate(id, order), /FIXTURE-ORDER/)
  }
  assert.throws(() => getEmailTemplate("SOFTWARE_LICENSE_KEYS", order))
  const license = { ...order, activationCodes: [{ softwareName: "Fixture Software", activationCode: "FIXTURE-CODE", validity: "1 Year", expiresAt: "2027-01-01" }] }
  assert.match(getEmailTemplate("SOFTWARE_LICENSE_KEYS", license), /FIXTURE-CODE/)
  assert.match(getEmailTemplate("SOFTWARE_ACTIVATION_KEY", { ...order, softwareName: "Fixture Software", licenseKey: "FIXTURE-ACTIVATION", validity: "1 Year", maxDevice: 1 }), /FIXTURE-ACTIVATION/)
  const cart = { customerName: "Fixture", cartUrl: "https://fixture.invalid/cart", items: [{ name: "Fixture", image: "/fixture.png", price: 100, quantity: 1 }] }
  assert.equal(emailTemplateDataSchemas.CART_ABANDONMENT.safeParse(cart).success, true)
  assert.match(getEmailTemplate("CART_ABANDONMENT", cart), /https:\/\/fixture.invalid\/cart/)
})

test("notification API rejects missing template-specific data before sending and still supports cart/license emails", async () => {
  let sent = 0
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true }) },
    "@/lib/email": { sendEmail: async data => { sent++; assert.ok(data.html.includes("Fixture")); return { success: true } } },
  })
  const route = loader.load("app/api/notifications/email/route.ts")
  const request = (templateId, data) => new Request("https://fixture.invalid/api/notifications/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: "notify@example.invalid", templateId, data }) })
  assert.equal((await route.POST(request("SOFTWARE_LICENSE_KEYS", { customerName: "Fixture", orderNumber: "FIXTURE-ORDER" }))).status, 400)
  assert.equal(sent, 0)
  assert.equal((await route.POST(request("CART_ABANDONMENT", { customerName: "Fixture", cartUrl: "https://fixture.invalid/cart", items: [] }))).status, 200)
  assert.equal((await route.POST(request("SOFTWARE_LICENSE_KEYS", { customerName: "Fixture", orderNumber: "FIXTURE-ORDER", activationCodes: [{ softwareName: "Fixture", activationCode: "FIXTURE-CODE", validity: "1 Year", expiresAt: "2027-01-01" }] }))).status, 200)
  assert.equal(sent, 2)
})

test("brand landing contracts retain simple/legacy defaults, rich content and canonical manufacturer filtering", () => {
  const loader = sourceLoader()
  const { brandLandingEnvelopeSchema, brandProductListResponseSchema } = loader.load("lib/brand-landing-response.ts")
  const simple = brandLandingEnvelopeSchema.parse({ success: true, brand: { name: "Fixture & Brand", slug: "fixture-brand", description: "", banners: null, whyChoose: null } }).brand
  assert.equal(simple.heroContent.title, "FIXTURE & BRAND")
  assert.equal(simple.heroContent.description, "Shop genuine Fixture & Brand products at SARA.")
  assert.equal(simple.productsSection.ctaLink, "/products?brand=Fixture%20%26%20Brand")
  assert.equal(simple.productsSection.maxProducts, 12)
  assert.equal(simple.banners.length, 0)
  assert.equal(simple.whyChoose.reasons.length, 0)
  const rich = brandLandingEnvelopeSchema.parse({ success: true, brand: {
    name: "Fixture", slug: "fixture", active: false, leadFormEnabled: true,
    heroContent: { title: "Custom heading", ctaLink: "/offers" },
    productsSection: { manufacturerFilter: "fixture-maker", maxProducts: 5 },
    categories: [{ title: "Refrigerator", url: "/fixture.png", description: "Fixture" }],
  } }).brand
  assert.equal(rich.active, false)
  assert.equal(rich.heroContent.title, "Custom heading")
  assert.equal(rich.heroContent.ctaLink, "/offers")
  assert.equal(rich.productsSection.maxProducts, 5)
  const catalog = brandProductListResponseSchema.parse([
    { id: "fixture-1", name: "Fixture", price: 100, raw: { "Manufacturer Name": "Fixture-maker" }, subCategory: "Refrigerator", specification_images: ["/fixture.png"] },
  ])
  const { normalizeProductForSchema } = loader.load("lib/product-schema.ts")
  assert.equal(normalizeProductForSchema(catalog[0]).manufacturerName, "Fixture-maker")
  assert.equal(catalog[0].specification_images[0], "/fixture.png")
  assert.equal(brandLandingEnvelopeSchema.safeParse({ success: true, brand: { name: "Fixture", slug: "fixture", banners: [{ bad: true }] } }).success, false)
})

test("server brand structured data uses the configured origin, safe serialization and canonical product URLs", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const brand = { name: "Fixture </script> Brand", slug: "fixture-brand", description: "Fixture", productsSection: { manufacturerFilter: "fixture" } }
  const loader = sourceLoader({
    "@/lib/seo-brand": { getSeoBrand: async () => brand },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => ({
      find: () => ({ project: () => ({ toArray: async () => [{ _id: new ObjectId(), slug: "fixture-product", name: "Fixture product", manufacturerName: "Fixture" }] }) }),
    }) } }) },
  })
  const element = await loader.load("app/brands/[slug]/BrandJsonLdServer.tsx").BrandJsonLdServer({ slug: brand.slug, origin: "https://sarastores.com" })
  const html = renderToStaticMarkup(element)
  const nodes = Array.from(html.matchAll(/<script[^>]*>(.*?)<\/script>/gs), match => JSON.parse(match[1]))
  assert.equal(nodes.length, 3)
  assert.equal(nodes.filter(node => node["@type"] === "Brand").length, 1)
  assert.equal(nodes[0].url, "https://sarastores.com/brands/fixture-brand")
  assert.equal(nodes[0].name, brand.name)
  assert.equal(nodes[1].itemListElement[0].item, "https://sarastores.com")
  assert.equal(nodes[2].itemListElement[0].url, "https://sarastores.com/product/fixture-product")
  assert.equal(html.includes("bytewise.shop"), false)
})

test("subcategory products retain canonical taxonomy, type and nullable description search compatibility", () => {
  const loader = sourceLoader()
  const { subCategoryProductResponseSchema } = loader.load("lib/product-card-response.ts")
  const product = subCategoryProductResponseSchema.parse({
    id: "fixture", name: "Fixture TV", price: 100, image: null, description: null,
    type: "Smart TV", raw: { "Manufacturer Name": "Fixture", "sub-category/PROD DESC": "LED TV", "CHAR DESC": "55 INCH" },
  })
  const { normalizeProductForSchema } = loader.load("lib/product-schema.ts")
  const canonical = normalizeProductForSchema(product)
  assert.equal(product.description.toLowerCase(), "")
  assert.equal(product.type, "Smart TV")
  assert.equal(product.image, "/placeholder.svg")
  assert.equal(canonical.manufacturerName, "Fixture")
  assert.equal(canonical.subCategoryProdDesc, "LED TV")
  assert.equal(canonical.charDesc, "55 INCH")
  assert.equal(subCategoryProductResponseSchema.safeParse({ ...product, price: "invalid" }).success, false)
})

test("category list contracts preserve IDs/slugs and tolerate nullable legacy presentation fields", () => {
  const { catalogCategoryListResponseSchema, catalogSubCategoryListResponseSchema } = sourceLoader().load("lib/catalog-list-response.ts")
  const categories = catalogCategoryListResponseSchema.parse([{ id: "fixture", name: "Fixture", slug: null, description: null, image: null }])
  assert.equal(categories[0].id, "fixture")
  assert.equal(categories[0].slug, undefined)
  assert.equal(categories[0].description, "")
  assert.equal(categories[0].image, "")
  assert.equal(catalogSubCategoryListResponseSchema.parse([{ name: "Fixture", slug: "fixture" }])[0].slug, "fixture")
  assert.equal(catalogCategoryListResponseSchema.safeParse([{ name: "Fixture" }]).success, false)
})

test("festival shelves render typed projected cards and preserve discounted-versus-full-shelf thresholds", async () => {
  const { createElement } = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  for (const [discountedCount, expectedCount, expectedQueries] of [[7, 12, 3], [8, 8, 2]]) {
    const products = Array.from({ length: 12 }, (_, index) => ({ id: `fixture-${index}`, name: `Fixture product ${index}`, price: 100, image: "/fixture.png" }))
    const queries = []
    const loader = sourceLoader({
      "@/components/Header": () => null,
      "@/components/Footer": () => null,
      "@/components/CategoryProductCard": ({ product }) => createElement("div", { "data-product-id": product.id }, product.name),
      "@/lib/seo-page": { pageMetadata: () => () => ({}) },
      "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products", CATEGORIES: "categories" }, findMany: async (collection, filter, options) => {
        queries.push({ collection, filter, options })
        if (collection === "categories") return [{ id: "fixture-category", name: "Fixture category", slug: "fixture-category", image: null }]
        assert.equal(options.projection.price, 1)
        return filter.discount ? products.slice(0, discountedCount) : products
      } },
    })
    const html = renderToStaticMarkup(await loader.load("app/ganesh/page.tsx").default())
    assert.equal(Array.from(html.matchAll(/data-product-id=/g)).length, expectedCount)
    assert.equal(queries.length, expectedQueries)
    assert.ok(html.includes('href="/category/fixture-category"'))
  }
})

test("scraper JSON-LD preserves graph products, array offers, singleton reviews and URL breadcrumbs", () => {
  const { jsonLdNodes, findLdType, dataRecord } = sourceLoader().load("lib/scrapers/http.ts")
  const product = {
    "@type": ["Product", "Thing"], name: "Fixture TV",
    offers: [{ price: "12999", availability: "https://schema.org/InStock" }, { price: "13999" }],
    review: { name: "Fixture review", reviewRating: { ratingValue: 4 } },
  }
  const breadcrumbs = { "@type": "BreadcrumbList", itemListElement: [
    { name: "Home", item: "https://fixture.invalid/" },
    { item: { name: "Televisions" } },
  ] }
  const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [product, breadcrumbs] })}</script>`
  assert.equal(jsonLdNodes(html).length, 2)
  const parsed = findLdType(html, "product")
  assert.equal(parsed.name, product.name)
  assert.equal(parsed.offers.price, "12999")
  assert.equal(parsed.review[0].reviewRating.ratingValue, 4)
  assert.equal(findLdType(html, "BreadcrumbList").itemListElement[0].name, "Home")
  assert.equal(Object.keys(dataRecord(null)).length, 0)
  assert.equal(Object.keys(dataRecord([])).length, 0)
  assert.equal(dataRecord({ fixture: true }).fixture, true)
  const emptyOffers = `<script type="application/ld+json">${JSON.stringify([{ ...product, offers: [], review: [] }])}</script>`
  assert.equal(findLdType(emptyOffers, "Product").offers, undefined)
  assert.equal(findLdType(emptyOffers, "Product").review.length, 0)
})

test("Pai scraping retains price and taxonomy with array offers and URL breadcrumbs when its companion API is unavailable", async () => {
  const actual = sourceLoader().load("lib/scrapers/http.ts")
  const nodes = [
    { "@type": "Product", name: "Fixture TV", sku: "FIXTURE-TV", brand: { name: "Fixture" },
      offers: [{ price: 12999, availability: "https://schema.org/InStock" }], description: "<p>Fixture <strong>description</strong></p>" },
    { "@type": "BreadcrumbList", itemListElement: ["Home", "Electronics", "Televisions", "Fixture TV"].map(name =>
      ({ name, item: `https://fixture.invalid/${name}` })) },
  ]
  const html = `<script type="application/ld+json">${JSON.stringify(nodes)}</script>`
  const loader = sourceLoader({ "@/lib/scrapers/http": {
    ...actual,
    fetchHtml: async () => ({ html, finalUrl: "https://www.paiinternational.in/fixture-tv" }),
    fetchJson: async () => null,
  } })
  const product = await loader.load("lib/scrapers/adapters.ts").scrapePai("https://www.paiinternational.in/fixture-tv")
  assert.equal(product.sap.price, 12999)
  assert.equal(product.sap.category, "Electronics")
  assert.equal(product.sap.subCategory, "Televisions")
  assert.equal(product.description, "Fixture description")
  assert.equal(product.inStock, true)
})

test("catalog sorting preserves input records and ranks real prices, discounts, dates and ratings", () => {
  const { sortProducts } = sourceLoader().load("lib/product-sort.ts")
  const products = [
    { id: "first", price: 200, mrp: 400, createdAt: "2026-10-01", reviews: { average: 4 } },
    { id: "second", price: 100, raw: { MRP: 125 }, createdAt: "2026-10-12", rating: 5 },
  ]
  for (const [sort, first] of [["price-asc", "second"], ["price-desc", "first"], ["discount", "first"], ["newest", "second"], ["rating", "second"]]) {
    const result = sortProducts(products, sort)
    assert.equal(result[0].id, first)
    assert.equal(products[0].id, "first")
    assert.equal(result.includes(products[0]), true)
  }
  assert.equal(sortProducts(products, "relevance"), products)
})

test("catalog facets retain spec precedence and OR-within / AND-between selection semantics", () => {
  const { facetValuesFor, matchesFacets, buildFacets } = sourceLoader().load("lib/product-facets.ts")
  const product = { name: "Fixture 55 inch 4K Smart TV", technical_details: { "screen_size": "65 inch" } }
  assert.equal(facetValuesFor(product).screenSize[0], '65"')
  assert.equal(matchesFacets(product, { screenSize: ['55"', '65"'], resolution: ["4K Ultra HD"] }), true)
  assert.equal(matchesFacets(product, { screenSize: ['55"'], resolution: ["4K Ultra HD"] }), false)
  assert.equal(buildFacets([product]).length, 0)
  const facets = buildFacets([product, { name: "Fixture 32 inch HD Ready TV" }])
  assert.equal(facets.find(facet => facet.key === "screenSize").values.length, 2)
})

test("facet counts respond to the other filters while ignoring the facet's own selection", () => {
  const { facetValuesFor, buildSelectionAwareFacets, matchesFacetValues } =
    sourceLoader().load("lib/product-facets.ts")

  const extracted = [
    { name: "Fixture 55 inch 4K Smart TV" },
    { name: "Fixture 65 inch 4K Smart TV" },
    { name: "Fixture 55 inch HD Ready TV" },
    { name: "Fixture 32 inch HD Ready TV" },
  ].map(facetValuesFor)

  const sizesOf = (selection) =>
    Object.fromEntries(
      buildSelectionAwareFacets(extracted, selection)
        .find(facet => facet.key === "screenSize")
        .values.map(({ value, count }) => [value, count]),
    )

  // Unfiltered, both 55 inch sets are counted together.
  assert.deepEqual(sizesOf({}), { '32"': 1, '55"': 2, '65"': 1 })

  // Choosing a resolution has to move the size counts — this is the whole
  // point of the sidebar numbers, and what the old count-everything behaviour
  // got wrong.
  assert.deepEqual(sizesOf({ resolution: ["4K Ultra HD"] }), { '55"': 1, '65"': 1 })

  // A size selection must not collapse its own dimension, or a second size
  // could never be added to the OR-ed group.
  assert.deepEqual(sizesOf({ screenSize: ['55"'] }), { '32"': 1, '55"': 2, '65"': 1 })

  // Leaving a facet out of the test is what makes that possible.
  assert.equal(matchesFacetValues(extracted[1], { screenSize: ['55"'] }), false)
  assert.equal(matchesFacetValues(extracted[1], { screenSize: ['55"'] }, "screenSize"), true)

  // A facet narrowed to one value still renders while it is in use, so the
  // shopper keeps a control to undo the choice.
  const narrowed = buildSelectionAwareFacets(extracted, { resolution: ["HD Ready"], screenSize: ['32"'] })
  assert.equal(narrowed.some(facet => facet.key === "screenSize"), true)
})

test("mobile listing filters read the spec sheet and drop filters with one value", () => {
  const { mobileFacetValuesFor, buildMobileFacets } = sourceLoader().load("lib/product-facets.ts")
  const phone = {
    name: "Fixture phone 55",
    specifications: {
      RAM: "8 GB",
      "Network Type": "5G, 4G, 3G, 2G",
      "Internal Storage": "256 GB",
      "Display Size": "16.94 cm (6.67 inch)",
      "Primary Camera": "50MP + 8MP",
      "Browse Type": "Smartphones",
      "Processor Core": "Octa Core",
    },
  }
  const other = {
    name: "Fixture phone 32 inch",
    specifications: {
      RAM: "4 GB",
      "Network Type": "4G VOLTE",
      "Internal Storage": "128 GB",
      "Display Size": "16.0 cm (6.3 inch)",
      "Primary Camera": "48MP Rear Camera",
      "Browse Type": "Smartphones",
      "Processor Core": "Hexa Core",
    },
  }

  const first = mobileFacetValuesFor(phone)
  assert.equal([...first.ram].join(","), "8 GB")
  assert.equal([...first.networkType].join(","), "5G,4G,3G,2G")
  assert.equal([...first.screenSize].join(","), "6.67 inch")
  assert.equal([...first.primaryCamera].join(","), "50 MP")
  assert.equal(first.screenSize.includes('55"'), false)

  const facets = buildMobileFacets([first, mobileFacetValuesFor(other)], {})
  assert.equal(facets.some(facet => facet.key === "phoneType"), false)
  assert.equal(facets.find(facet => facet.key === "ram").values.map(value => value.value).join(","), "4 GB,8 GB")
  assert.equal(facets.findIndex(facet => facet.key === "ram") < facets.findIndex(facet => facet.key === "screenSize"), true)
})

test("the merchandising hierarchy reads from spreadsheet columns and the stored document alike", () => {
  const { extractCanonicalProductMetadata, normalizeProductForSchema, buildSchemaSynchronizedRaw } =
    sourceLoader().load("lib/product-schema.ts")

  // Header spellings vary between the exports operators work from.
  const fromSheet = extractCanonicalProductMetadata({
    itemno: "SKU-1",
    "ITEM DIVISION": "Electronics",
    Category: "Mobile Accessories",
    SEGMENT: "Chargers & Adapters",
    "Brand Name": "Anker",
  })
  assert.equal(fromSheet.division, "Electronics")
  assert.equal(fromSheet.categoryGroupName, "Mobile Accessories")
  assert.equal(fromSheet.segment, "Chargers & Adapters")
  assert.equal(fromSheet.brandName, "Anker")

  // The same values read back off a stored product, top level or raw.
  const stored = normalizeProductForSchema({
    sku: "SKU-1",
    division: "Electronics",
    segment: "Chargers & Adapters",
    raw: { Brand: "Anker", "Category/Group Name": "Mobile Accessories" },
  })
  assert.equal(stored.division, "Electronics")
  assert.equal(stored.segment, "Chargers & Adapters")
  assert.equal(stored.brandName, "Anker")

  // Brand must not borrow the manufacturer: they are separate columns, and
  // conflating them would make an unclassified product look classified.
  assert.equal(normalizeProductForSchema({ manufacturerName: "Foxconn" }).brandName, "")

  // A round trip through raw keeps the canonical header spellings.
  const raw = buildSchemaSynchronizedRaw({}, fromSheet)
  assert.equal(raw["Division"], "Electronics")
  assert.equal(raw["Segment"], "Chargers & Adapters")
  assert.equal(raw["Brand"], "Anker")
  assert.deepEqual(extractCanonicalProductMetadata(raw), fromSheet)
})

test("the taxonomy tree nests division to sub-category to segment and merges inconsistent casing", () => {
  const { buildTaxonomyTree, taxonomyHref } = sourceLoader().load("lib/product-taxonomy.ts")

  const tree = buildTaxonomyTree([
    { division: "Accessories", subCategory: "Mobile Accessories", segment: "Cables", brand: "Anker", count: 5 },
    // Same aisle, typed differently in a later spreadsheet.
    { division: "accessories", subCategory: "mobile accessories", segment: "Cables", brand: "anker", count: 3 },
    { division: "Accessories", subCategory: "Mobile Accessories", segment: "Power Banks", brand: "Belkin", count: 9 },
    { division: "Accessories", subCategory: "Audio Accessories", segment: "", brand: "Anker", count: 2 },
    // A product nobody has classified cannot be given a place in the menu, and
    // a placeholder label is not an aisle — neither may become a header tab.
    { division: "", subCategory: "Orphan", segment: "Orphan", count: 100 },
    { division: "Uncategorized", subCategory: "Orphan", segment: "Orphan", count: 100 },
    { division: "test3", subCategory: "Orphan", segment: "Orphan", count: 100 },
  ])

  assert.equal(tree.length, 1)
  const [accessoriesDivision] = tree
  assert.equal(accessoriesDivision.name, "Accessories")
  assert.equal(accessoriesDivision.count, 19)
  assert.equal(
    accessoriesDivision.brands.map(brand => `${brand.name}=${brand.count}`).join(" | "),
    "Anker=10 | Belkin=9",
  )

  // Busiest first at every level.
  assert.equal(
    accessoriesDivision.subCategories.map(s => s.name).join(" | "),
    "Mobile Accessories | Audio Accessories",
  )

  const [mobile, audio] = accessoriesDivision.subCategories
  assert.equal(mobile.count, 17)
  assert.equal(
    mobile.segments.map(s => `${s.name}=${s.count}`).join(" | "),
    "Power Banks=9 | Cables=8",
  )

  // A sub-category with no segments still exists as a destination.
  assert.equal(audio.segments.length, 0)

  // The menu links on subCategory, which is the parameter the listing reads.
  assert.equal(
    taxonomyHref("Accessories", "Mobile Accessories", "Cables"),
    "/products?division=Accessories&subCategory=Mobile+Accessories&segment=Cables",
  )
  assert.equal(taxonomyHref("Accessories"), "/products?division=Accessories")
})

test("an unexpected taxonomy payload degrades the menu instead of throwing", () => {
  const { normalizeTaxonomyDivisions } = sourceLoader().load("lib/product-taxonomy.ts")

  // The shape this endpoint served before sub-category became the middle
  // level. A cache can still be holding one, and the header is on every page.
  const legacy = normalizeTaxonomyDivisions({
    divisions: [
      {
        name: "Accessories",
        count: 12,
        categories: [{ name: "Mobile Accessories", count: 12, segments: [{ name: "Cables", count: 12 }] }],
      },
    ],
  })
  assert.equal(legacy[0].subCategories[0].name, "Mobile Accessories")
  assert.equal(legacy[0].subCategories[0].segments[0].name, "Cables")

  // Nothing here may throw, and nothing nameless may reach the menu. Length
  // rather than deepEqual: the loader builds arrays in its own realm, so an
  // empty result is never reference-equal to this file's [].
  for (const payload of [null, undefined, "", 0, [], {}, { divisions: null }, { divisions: "nope" }]) {
    assert.equal(normalizeTaxonomyDivisions(payload).length, 0)
  }

  const partial = normalizeTaxonomyDivisions({
    divisions: [
      { count: 5 },
      null,
      {
        name: " Accessories ",
        brands: [null, { name: "Anker", count: 5 }, { count: 2 }],
        subCategories: [null, { name: "Audio", count: "many", segments: [{ count: 1 }, { name: "Aux Cables" }] }],
      },
    ],
  })
  assert.equal(partial.length, 1)
  assert.equal(partial[0].name, "Accessories")
  assert.equal(partial[0].count, 0)
  assert.equal(partial[0].brands.map(brand => brand.name).join(","), "Anker")
  assert.equal(partial[0].subCategories.length, 1)
  assert.equal(partial[0].subCategories[0].count, 0)
  assert.equal(partial[0].subCategories[0].segments.map(s => s.name).join(","), "Aux Cables")
})

test("specification review normalization retains legacy summaries and ignores malformed entries", () => {
  const { normalizeReviews } = sourceLoader().load("lib/product-specification-schema.ts")
  for (const key of ["customerReviews", "topReviews", "top"]) {
    const reviews = normalizeReviews({ [key]: [null, 10, "Fixture text", { rating: "4", title: "Fixture", body: "Review body" }] })
    assert.equal(reviews.length, 2)
    assert.equal(reviews[0].text, "Fixture text")
    assert.equal(reviews[1].rating, 4)
    assert.equal(reviews[1].text, "Review body")
  }
  assert.equal(normalizeReviews({ customerReviews: "malformed" }).length, 0)
})

test("lucky-draw prize normalization handles unknown payloads without unsafe casts", () => {
  const { normalisePrizes, pickRandom } = sourceLoader().load("lib/lucky-draw.ts")
  const prizes = normalisePrizes([null, 1, { name: " Fixture ", quantity: "2.8" }, { name: "No stock", quantity: -2 }])
  assert.equal(prizes.length, 2)
  assert.equal(prizes[0].name, "Fixture")
  assert.equal(prizes[0].quantity, 2)
  assert.equal(prizes[1].quantity, 0)
  assert.equal(pickRandom([]), null)
  assert.equal(pickRandom(["fixture"]), "fixture")
})

for (const reserved of [true, false]) {
  test(`lucky-draw typed collections preserve ${reserved ? "winner persistence and counters" : "participant reservation conflicts"}`, async () => {
    const token = "a".repeat(32)
    const campaign = { _id: "fixture-campaign", status: "active", prizes: [{ name: "Fixture prize", icon: "fixture", quantity: 2 }] }
    const participant = { _id: "fixture-participant", name: "Fixture", phone: "0000000000", email: "fixture@example.invalid" }
    const winners = []
    let prizeWrites = 0
    const collections = {
      lucky_draw_campaigns: {
        findOne: async () => campaign,
        updateOne: async () => { prizeWrites++; campaign.prizes[0].quantity--; return { modifiedCount: 1 } },
      },
      lucky_draw_participants: {
        find: () => ({ project() { return this }, toArray: async () => [participant] }),
        findOneAndUpdate: async () => reserved ? participant : null,
        countDocuments: async () => 0,
      },
      lucky_draw_winners: { insertOne: async document => winners.push(document) },
    }
    const { POST } = sourceLoader({
      "@/lib/db-service": { getCollection: async name => collections[name] },
      "@/lib/rate-limit": { withRateLimit: handler => handler },
      "@/lib/mongodb": { connectToDatabase: async () => ({ client: {
        startSession: () => ({ withTransaction: operation => operation(), endSession: async () => {} }),
      } }) },
    }).load("app/api/lucky-draw/[token]/draw/route.ts")
    const response = await POST(new NextRequest(`http://localhost/api/lucky-draw/${token}/draw`, { method: "POST" }))
    assert.equal(response.status, reserved ? 200 : 409)
    assert.equal(prizeWrites, reserved ? 1 : 0)
    assert.equal(winners.length, reserved ? 1 : 0)
    if (reserved) {
      const result = await response.json()
      assert.equal(typeof result.winnerId, "string")
      assert.equal(winners[0]._id, result.winnerId)
      assert.equal(winners[0].participantId, participant._id)
      assert.equal(result.stats.prizesLeft, 1)
      assert.equal(result.winner.phone.endsWith("0000"), true)
    }
  })
}

function luckyDrawFixture() {
  const token = "a".repeat(32)
  const campaign = { _id: "fixture-campaign", status: "active", name: "Fixture", store: "Fixture store", prizes: [{ name: "Fixture prize", icon: "fixture", quantity: 2 }] }
  const participants = [1, 2].map(index => ({ _id: `fixture-participant-${index}`, campaignId: campaign._id, name: `Fixture ${index}`, phone: "0000000000", email: "fixture@example.invalid", wonAt: null }))
  const winners = []
  let activeSession
  let sequence = Promise.resolve()
  let failInsert = false
  let failPrize = false
  let sessionsEnded = 0
  const sessionCheck = options => assert.equal(options?.session, activeSession)
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const previous = sequence
        let release
        sequence = new Promise(resolve => { release = resolve })
        await previous
        activeSession = session
        const savedCampaign = structuredClone(campaign)
        const savedParticipants = structuredClone(participants)
        const savedWinners = structuredClone(winners)
        try { return await operation() } catch (error) {
          Object.assign(campaign, savedCampaign)
          participants.splice(0, participants.length, ...savedParticipants)
          winners.splice(0, winners.length, ...savedWinners)
          throw error
        } finally { activeSession = undefined; release() }
      },
      endSession: async () => { sessionsEnded++ },
    }
    return session
  } }
  const collections = {
    lucky_draw_campaigns: {
      findOne: async (query, options) => { sessionCheck(options); return { ...campaign } },
      updateOne: async (query, update, options) => {
        sessionCheck(options)
        assert.equal(query.status, "active")
        assert.equal(query.drawToken, token)
        if (failPrize || campaign.prizes[0].quantity <= 0) return { modifiedCount: 0 }
        campaign.prizes[0].quantity--
        return { modifiedCount: 1 }
      },
    },
    lucky_draw_participants: {
      find: (query, options) => {
        sessionCheck(options)
        return { project() { return this }, toArray: async () => participants.filter(participant => !participant.wonAt).map(participant => ({ ...participant })) }
      },
      findOneAndUpdate: async (query, update, options) => {
        sessionCheck(options)
        const participant = participants.find(value => value._id === query._id && !value.wonAt)
        if (!participant) return null
        Object.assign(participant, update.$set)
        return { ...participant }
      },
      countDocuments: async (query, options) => { sessionCheck(options); return participants.filter(value => !value.wonAt).length },
    },
    lucky_draw_winners: {
      findOne: async (query, options) => { sessionCheck(options); return winners.find(value => value.campaignId === query.campaignId && value.drawRequestId === query.drawRequestId) || null },
      insertOne: async (document, options) => { sessionCheck(options); if (failInsert) throw new Error("Fixture winner insertion failure"); winners.push(document) },
    },
  }
  const route = sourceLoader({
    "@/lib/db-service": { getCollection: async name => collections[name] },
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client }) },
  }).load("app/api/lucky-draw/[token]/draw/route.ts")
  return {
    route, campaign, participants, winners, sessionsEnded: () => sessionsEnded,
    failInsert: value => { failInsert = value }, failPrize: value => { failPrize = value },
    request: requestId => new NextRequest(`http://localhost/api/lucky-draw/${token}/draw`, { method: "POST", body: JSON.stringify({ requestId }) }),
  }
}

test("Lucky-draw winner insertion and unavailable-prize failures roll back participant and stock", async () => {
  const fixture = luckyDrawFixture()
  fixture.failInsert(true)
  assert.equal((await fixture.route.POST(fixture.request(crypto.randomUUID()))).status, 500)
  assert.equal(fixture.campaign.prizes[0].quantity, 2)
  assert.equal(fixture.participants.filter(value => value.wonAt).length, 0)
  assert.equal(fixture.winners.length, 0)
  fixture.failInsert(false)
  fixture.failPrize(true)
  assert.equal((await fixture.route.POST(fixture.request(crypto.randomUUID()))).status, 409)
  assert.equal(fixture.participants.filter(value => value.wonAt).length, 0)
  assert.equal(fixture.sessionsEnded(), 2)
})

test("Lucky-draw concurrent retry returns the recorded winner without consuming another prize", async () => {
  const fixture = luckyDrawFixture()
  const requestId = crypto.randomUUID()
  const responses = await Promise.all([fixture.route.POST(fixture.request(requestId)), fixture.route.POST(fixture.request(requestId))])
  assert.ok(responses.every(response => response.status === 200))
  const bodies = await Promise.all(responses.map(response => response.json()))
  assert.equal(bodies[0].winnerId, bodies[1].winnerId)
  assert.equal(fixture.winners.length, 1)
  assert.equal(fixture.campaign.prizes[0].quantity, 1)
  assert.equal(fixture.participants.filter(value => value.wonAt).length, 1)
  fixture.campaign.status = "paused"
  const retry = await fixture.route.POST(fixture.request(requestId))
  assert.equal(retry.status, 200)
  assert.equal((await retry.json()).winnerId, bodies[0].winnerId)
  assert.equal((await fixture.route.POST(fixture.request(crypto.randomUUID()))).status, 409)
})

test("Lucky-draw concurrent distinct requests never repeat a participant or overdraw inventory", async () => {
  const fixture = luckyDrawFixture()
  const responses = await Promise.all(Array.from({ length: 3 }, () => fixture.route.POST(fixture.request(crypto.randomUUID()))))
  assert.equal(responses.filter(response => response.status === 200).length, 2)
  assert.equal(fixture.campaign.prizes[0].quantity, 0)
  assert.equal(new Set(fixture.winners.map(value => value.participantId)).size, 2)
  assert.equal(fixture.winners.length, 2)
})

function luckyNotifyFixture({ delivery = "accepted", failRecord = false, email = "fixture@example.invalid" } = {}) {
  const token = "a".repeat(32)
  const winner = {
    _id: new ObjectId().toString(), campaignId: "fixture-campaign", participantName: "<img src=x>",
    participantPhone: "0000000000", participantEmail: email, prize: "<b>Prize</b>", prizeIcon: "fixture",
  }
  let sends = 0
  const messages = []
  const winners = {
    findOne: async query => query.campaignId === winner.campaignId && query._id === winner._id ? { ...winner } : null,
    findOneAndUpdate: async (query, update) => {
      if (winner.emailSent || ["sending", "uncertain"].includes(winner.emailDeliveryStatus)) return null
      Object.assign(winner, update.$set)
      return { ...winner }
    },
    updateOne: async (query, update) => {
      if (failRecord) throw new Error("Fixture status persistence failure")
      assert.equal(query.emailSendId, winner.emailSendId)
      Object.assign(winner, update.$set)
      return { matchedCount: 1 }
    },
  }
  const route = sourceLoader({
    "@/lib/rate-limit": { withRateLimit: handler => handler },
    "@/lib/db-service": { getCollection: async name => name === "lucky_draw_campaigns"
      ? { findOne: async () => ({ _id: winner.campaignId, name: "<script>Campaign</script>", store: "Fixture" }) }
      : winners },
    "@/lib/email": { sendEmail: async message => {
      sends++
      messages.push(message)
      await new Promise(resolve => setTimeout(resolve, 5))
      if (delivery === "throw") throw new Error("Fixture ambiguous SMTP failure")
      if (delivery === "failure") return { success: false, error: new Error("Fixture private failure") }
      if (delivery === "malformed") return { success: true }
      if (delivery === "rejected") return { success: true, result: { accepted: ["other@example.invalid"], rejected: [email] } }
      return { success: true, result: { accepted: [email], rejected: [] } }
    } },
  }).load("app/api/lucky-draw/[token]/notify/route.ts")
  return { route, winner, messages, sends: () => sends,
    request: id => new NextRequest(`http://localhost/api/lucky-draw/${token}/notify`, { method: "POST", body: JSON.stringify({ winnerId: id || winner._id }) }),
  }
}

test("Lucky-draw notification claims concurrent sends once and recognizes the accepted recipient", async () => {
  const fixture = luckyNotifyFixture()
  const responses = await Promise.all([fixture.route.POST(fixture.request()), fixture.route.POST(fixture.request())])
  assert.equal(fixture.sends(), 1)
  assert.equal(responses.filter(response => response.status === 409).length, 1)
  assert.equal(fixture.winner.emailSent, true)
  const retry = await fixture.route.POST(fixture.request())
  assert.deepEqual(await retry.json(), { success: true, emailSent: true, emailError: null })
  assert.equal(fixture.sends(), 1)
  assert.ok(fixture.messages[0].html.includes("&lt;img src=x&gt;"))
  assert.equal(fixture.messages[0].html.includes("<script>Campaign</script>"), false)
})

for (const delivery of ["failure", "throw", "malformed", "rejected"]) {
  test(`Lucky-draw ${delivery} mail outcome is not acknowledged as sent or automatically retried`, async () => {
    const fixture = luckyNotifyFixture({ delivery })
    const response = await fixture.route.POST(fixture.request())
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.emailSent, false)
    assert.ok(body.emailError.includes("reconciliation"))
    assert.equal(body.emailError.includes("private"), false)
    assert.equal(fixture.winner.emailDeliveryStatus, "uncertain")
    assert.equal((await fixture.route.POST(fixture.request())).status, 409)
    assert.equal(fixture.sends(), 1)
  })
}

test("Lucky-draw mail acknowledgement storage failure leaves its claim blocked to prevent resend", async () => {
  const fixture = luckyNotifyFixture({ failRecord: true })
  assert.equal((await fixture.route.POST(fixture.request())).status, 500)
  assert.equal(fixture.winner.emailDeliveryStatus, "sending")
  assert.equal((await fixture.route.POST(fixture.request())).status, 409)
  assert.equal(fixture.sends(), 1)
})

test("Lucky-draw response parsers reject malformed winners, counters and false delivery success", async () => {
  const fixture = luckyDrawFixture()
  const result = await (await fixture.route.POST(fixture.request(crypto.randomUUID()))).json()
  const client = sourceLoader().load("lib/lucky-draw-client.ts")
  assert.equal(client.winnerNotificationLabel({ emailDeliveryStatus: "uncertain" }), "needs reconciliation")
  assert.equal(client.winnerNotificationLabel({ emailDeliveryStatus: "sending" }), "pending reconciliation")
  assert.equal(client.winnerNotificationLabel({ emailSent: true }), "email accepted")
  assert.equal(client.drawStoreListSchema.parse({ success: true, stores: [
    { id: "active", shopName: "Fixture", isActive: true }, { id: "inactive", shopName: "Fixture", isActive: false },
  ] }).length, 1)
  assert.equal(client.drawStoreListSchema.safeParse({ success: true, stores: [{ _id: "bad", shopName: "Fixture" }] }).success, false)
  assert.equal(client.drawResultSchema.safeParse(result).success, true)
  assert.equal(client.drawResultSchema.safeParse({ ...result, stats: { remainingParticipants: -1, prizesLeft: 1 } }).success, false)
  assert.equal(client.drawNotificationSchema.safeParse({ success: true, emailSent: "false", emailError: null }).success, false)
  assert.equal(client.drawNotificationSchema.safeParse({ success: true, emailSent: false, emailError: null }).success, false)
  assert.equal(client.drawNotificationSchema.safeParse({ success: true, emailSent: true, emailError: "Rejected" }).success, false)
  const transport = sourceLoader({}, { fetch: async () => Response.json({ success: true, winnerId: "invalid" }) }).load("lib/lucky-draw-client.ts")
  const response = await transport.requestDrawJson("https://fixture.invalid", value => transport.drawResultSchema.parse(value))
  assert.equal(response.ok, false)
  assert.ok(response.error)
})

test("homepage and detail schemas preserve taxonomy, nullable legacy fields, reviews and image formats", () => {
  const loader = sourceLoader()
  const { catalogProductResponseSchema, productSuggestions } = loader.load("utils/catalog.ts")
  const { productDetailResponseSchema } = loader.load("lib/product-card-response.ts")
  const fixture = { id: "fixture", name: "Fixture TV", price: 100, image: null, mrp: null, stock: null,
    category: null, manufacturerName: "Fixture Brand", subCategory: "Televisions", importedFlag: "preserved" }
  const catalog = catalogProductResponseSchema.parse(fixture)
  assert.equal(catalog.image, "/placeholder.svg")
  assert.equal(catalog.mrp, undefined)
  assert.equal(catalog.stock, undefined)
  assert.equal(catalog.manufacturerName, fixture.manufacturerName)
  assert.equal(catalog.importedFlag, fixture.importedFlag)
  for (const reviews of [[{ rating: null, title: "Fixture review" }], { average: "4.5", count: 10 }, 10]) {
    const detail = productDetailResponseSchema.parse({ ...fixture, reviews, features: ["Fixture feature"], specification_images: "https://fixture.invalid/spec.png" })
    assert.equal(detail.features[0], "Fixture feature")
    assert.equal(detail.specification_images[0], "https://fixture.invalid/spec.png")
  }
  const suggestions = productSuggestions({ id: "fixture", subCategory: "Televisions" }, [
    catalog, { ...catalog, id: "companion", image: "/fixture.png", active: true },
    { ...catalog, id: "inactive", active: false },
  ])
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].id, "companion")
})

test("homepage section schemas retain category and manual configurations without unsafe narrowing", () => {
  const { homeComponentResponseSchema } = sourceLoader().load("hooks/usePrefetchHomeProducts.ts")
  assert.equal(homeComponentResponseSchema.parse({ id: "category", type: "category", enabled: true, title: null, config: { categoryId: "fixture" } }).config.categoryId, "fixture")
  assert.equal(homeComponentResponseSchema.parse({ id: "manual", type: "manual", enabled: true, config: { productIds: ["fixture"] } }).config.productIds[0], "fixture")
  assert.equal(homeComponentResponseSchema.safeParse({ id: "invalid", type: "category", enabled: true, config: {} }).success, false)
})

test("partner order reads and status writes preserve canonical IDs and typed status history", async () => {
  const _id = new ObjectId()
  const stored = {
    _id, id: "shadow", orderId: "FIXTURE", partnerId: "fixture-partner",
    customer: { name: "Fixture", email: "fixture@example.invalid", phone: "0000000000", address: { line1: "Fixture", city: "Fixture", state: "Fixture", pincode: "000000", country: "IN" } },
    items: [], summary: { subtotal: 100, tax: 18, shipping: 0, total: 118 }, paymentMethod: "cod", status: "pending",
    statusHistory: [], commission: { rate: 10, amount: 10, status: "pending" }, createdAt: new Date(), updatedAt: new Date(),
  }
  let update
  const collection = {
    find: () => ({ sort() { return this }, skip() { return this }, limit() { return this }, toArray: async () => [stored] }),
    countDocuments: async () => 1,
    findOneAndUpdate: async (filter, changes) => {
      assert.equal(filter.orderId, stored.orderId)
      update = changes
      return { ...stored, ...changes.$set }
    },
  }
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async name => {
    assert.equal(name, "partner_orders")
    return collection
  } }, "@/lib/partner/wallet": { createTransaction: async () => { throw new Error("Unexpected financial write") } } })
  const service = loader.load("lib/partner/orders.ts")
  const result = await service.listPartnerOrders(stored.partnerId, { status: "pending" })
  assert.equal(result.orders[0].id, _id.toString())
  assert.equal(result.orders[0].paymentVerification.verified, false)
  const delivered = await service.updateOrderStatus(stored.orderId, "delivered", { carrier: "Fixture", sequence: 1 })
  assert.equal(delivered.status, "delivered")
  assert.equal(update.$push.statusHistory.details.carrier, "Fixture")
  assert.equal(update.$push.statusHistory.status, "delivered")
  assert.equal(Number.isFinite(Number(update.$set.deliveredAt)), true)
})

test("partner wallet normalization and bank-account updates preserve native MongoDB fields", async () => {
  const _id = new ObjectId()
  const writes = []
  const stored = { _id, id: "shadow", partnerId: "fixture-partner", balance: { available: 100, pending: 0, held: 0 },
    currency: "INR", bankAccounts: [], minimumPayout: 1000, autoPayout: { enabled: false, threshold: 10000, frequency: "weekly" },
    createdAt: new Date(), updatedAt: new Date() }
  const collection = {
    findOne: async () => stored,
    updateOne: async (filter, changes) => {
      assert.equal(filter._id.toString(), _id.toString())
      writes.push(changes)
      if (changes.$push) stored.bankAccounts.push(changes.$push.bankAccounts)
      return { matchedCount: 1 }
    },
  }
  const { getWalletById, addBankAccount } = sourceLoader({
    "@/lib/db-service": { getCollection: async name => { assert.equal(name, "partner_wallets"); return collection } },
  }).load("lib/partner/wallet.ts")
  assert.equal((await getWalletById(_id.toString())).id, _id.toString())
  const account = await addBankAccount(_id.toString(), { bankName: "Fixture", accountNumber: "0000000000", ifsc: "FIXT0000001", accountHolderName: "Fixture", isDefault: false })
  assert.equal(account.verified, false)
  assert.equal(writes[0].$push.bankAccounts.id, account.id)
  assert.equal(writes[1].$set.defaultBankAccountId, account.id)
})

function payoutAccountingFixture(initialBalance, pendingPayout = false) {
  const walletId = new ObjectId()
  const payoutId = new ObjectId()
  const wallet = {
    _id: walletId, id: walletId.toString(), partnerId: "fixture-partner",
    balance: { available: initialBalance, pending: 0, held: 0 }, minimumPayout: 100,
    bankAccounts: [{ id: "fixture-bank", bankName: "Fixture", accountNumber: "0000000000", ifsc: "FIXT0000001" }],
  }
  const payouts = pendingPayout ? [{
    _id: payoutId, id: payoutId.toString(), partnerId: wallet.partnerId, walletId: wallet.id,
    amount: 1000, bankAccountId: "fixture-bank", bankAccount: { bankName: "Fixture", accountNumber: "******0000", ifsc: "FIXT0000001" },
    status: "pending_approval", requestedAt: new Date(),
  }] : []
  const transactions = []
  let failure
  let queue = Promise.resolve()
  let activeSession
  const client = { startSession: () => {
    const session = {
      withTransaction: async operation => {
        const previous = queue
        let unlock
        queue = new Promise(resolve => { unlock = resolve })
        await previous
        const balance = { ...wallet.balance }
        const payoutSnapshot = payouts.map(payout => ({ ...payout }))
        const transactionCount = transactions.length
        activeSession = session
        try {
          return await operation()
        } catch (error) {
          wallet.balance = balance
          payouts.splice(0, payouts.length, ...payoutSnapshot)
          transactions.splice(transactionCount)
          throw error
        } finally {
          activeSession = undefined
          unlock()
        }
      },
      endSession: async () => {},
    }
    return session
  } }
  const matchesWallet = filter => filter._id.toString() === wallet.id &&
    filter.partnerId === wallet.partnerId &&
    Object.entries(filter).every(([path, condition]) => !path.startsWith("balance.") || wallet.balance[path.split(".")[1]] >= condition.$gte)
  const updateWallet = changes => {
    for (const [path, amount] of Object.entries(changes.$inc || {})) wallet.balance[path.split(".")[1]] += amount
  }
  const requireSession = options => assert.equal(options.session, activeSession)
  const collections = {
    partner_wallets: {
      findOne: async (filter, options) => {
        requireSession(options)
        return matchesWallet(filter) ? wallet : null
      },
      findOneAndUpdate: async (filter, changes, options) => {
        requireSession(options)
        if (!matchesWallet(filter)) return null
        updateWallet(changes)
        return wallet
      },
      updateOne: async (filter, changes, options) => {
        requireSession(options)
        if (!matchesWallet(filter)) return { matchedCount: 0 }
        updateWallet(changes)
        return { matchedCount: 1 }
      },
    },
    partner_payouts: {
      insertOne: async (document, options) => {
        requireSession(options)
        if (failure === "payout") throw new Error("Injected payout failure")
        payouts.push(document)
      },
      findOneAndUpdate: async (filter, changes, options) => {
        requireSession(options)
        const payout = payouts.find(item => item._id.toString() === filter._id.toString() && item.status === filter.status)
        if (!payout) return null
        Object.assign(payout, changes.$set)
        return payout
      },
    },
    wallet_transactions: { insertOne: async (document, options) => {
      requireSession(options)
      if (failure === "ledger") throw new Error("Injected ledger failure")
      transactions.push(document)
    } },
  }
  const service = sourceLoader({
    "@/lib/db-service": { getCollection: async name => collections[name] },
    "@/lib/mongodb": { connectToDatabase: async () => ({ client }) },
  }).load("lib/partner/wallet.ts")
  return { service, wallet, payouts, transactions, payoutId, failAt: stage => { failure = stage } }
}

test("payout creation subtracts the requested amount once and records the exact resulting balance", async () => {
  const { service, wallet, payouts, transactions } = payoutAccountingFixture(3000)
  await service.createPayoutRequest(wallet.partnerId, wallet.id, 1000, "fixture-bank")
  assert.equal(wallet.balance.available, 2000)
  assert.equal(payouts.length, 1)
  assert.equal(transactions.length, 1)
  assert.equal(transactions[0].amount, 1000)
  assert.equal(transactions[0].balanceAfter, 2000)
})

test("payout rejection refunds the reserved amount once with one matching ledger entry", async () => {
  const { service, wallet, payouts, transactions, payoutId } = payoutAccountingFixture(2000, true)
  await service.rejectPayout(payoutId.toString(), "fixture-admin", "Fixture rejection")
  assert.equal(wallet.balance.available, 3000)
  assert.equal(payouts[0].status, "rejected")
  assert.equal(transactions.length, 1)
  assert.equal(transactions[0].amount, 1000)
  assert.equal(transactions[0].balanceAfter, 3000)
})

test("payout and ledger failures roll back balances and payout status", async () => {
  for (const stage of ["payout", "ledger"]) {
    const fixture = payoutAccountingFixture(3000)
    fixture.failAt(stage)
    await assert.rejects(fixture.service.createPayoutRequest(fixture.wallet.partnerId, fixture.wallet.id, 1000, "fixture-bank"), /Injected/)
    assert.equal(fixture.wallet.balance.available, 3000)
    assert.equal(fixture.payouts.length, 0)
    assert.equal(fixture.transactions.length, 0)
  }
  const fixture = payoutAccountingFixture(2000, true)
  fixture.failAt("ledger")
  await assert.rejects(fixture.service.rejectPayout(fixture.payoutId.toString(), "fixture-admin", "Fixture"), /Injected/)
  assert.equal(fixture.wallet.balance.available, 2000)
  assert.equal(fixture.payouts[0].status, "pending_approval")
  assert.equal(fixture.transactions.length, 0)
})

test("concurrent payout requests cannot overspend and rejection cannot refund twice", async () => {
  const fixture = payoutAccountingFixture(1500)
  const results = await Promise.allSettled([1, 2].map(() =>
    fixture.service.createPayoutRequest(fixture.wallet.partnerId, fixture.wallet.id, 1000, "fixture-bank")))
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(fixture.wallet.balance.available, 500)
  assert.equal(fixture.payouts.length, 1)
  assert.equal(fixture.transactions.length, 1)
  const refunds = await Promise.allSettled([1, 2].map(() =>
    fixture.service.rejectPayout(fixture.payouts[0].id, "fixture-admin", "Fixture")))
  assert.equal(refunds.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(fixture.wallet.balance.available, 1500)
  assert.equal(fixture.transactions.length, 2)
})

test("wallet mutations validate identity, amounts, and sufficient pending or held funds", async () => {
  const { service, wallet, payouts, transactions } = payoutAccountingFixture(3000)
  for (const amount of [NaN, Infinity, -1, 0]) {
    await assert.rejects(service.createPayoutRequest(wallet.partnerId, wallet.id, amount, "fixture-bank"), /Amount/)
    await assert.rejects(service.createTransaction(wallet.id, wallet.partnerId, "debit", "payout", amount, "Fixture"), /Amount/)
  }
  await assert.rejects(service.createPayoutRequest("other-partner", wallet.id, 1000, "fixture-bank"), /Wallet not found/)
  await assert.rejects(service.createTransaction(wallet.id, wallet.partnerId, "release", "payout", 1, "Fixture"), /insufficient/)
  await assert.rejects(service.releasePendingBalance(wallet.id, wallet.partnerId, 1, "fixture-order"), /insufficient/)
  assert.equal(wallet.balance.available, 3000)
  assert.equal(payouts.length, 0)
  assert.equal(transactions.length, 0)
})

test("compare ID normalization preserves legacy storage shapes without retaining product payloads", () => {
  const { normalizeCompareIds } = sourceLoader().load("hooks/useCompare.ts")
  assert.deepEqual(Array.from(normalizeCompareIds([
    " fixture-one ", 12, { id: "fixture-two", description: "Ignored payload" },
    { _id: "fixture-three" }, { _id: { $oid: "fixture-four" } }, "fixture-one",
    null, undefined, NaN, Infinity, { id: {} }, "x".repeat(100),
  ])), ["fixture-one", "12", "fixture-two", "fixture-three", "fixture-four"])
  assert.deepEqual(Array.from(normalizeCompareIds({ id: "one" })), ["one"])
  assert.deepEqual(Array.from(normalizeCompareIds(null)), [])
  assert.equal(normalizeCompareIds(Array.from({ length: 20 }, (_, index) => `fixture-${index}`)).length, 6)
})

test("bulk catalog lookup validates identifiers and keeps inactive products staff-only", async () => {
  const nativeId = new ObjectId()
  let query
  let calls = 0
  let staff = false
  const helpers = sourceLoader().load("lib/db-service.ts")
  const collection = {
    find: filter => {
      calls++
      query = filter
      const cursor = { project: () => cursor, toArray: async () => [{ _id: nativeId, name: "Fixture", price: 100, active: true }] }
      return cursor
    },
  }
  const { POST } = sourceLoader({
    "@/lib/db-service": { ...helpers, getCollection: async () => collection },
    "@/lib/auth": { isAdmin: async () => staff },
  }).load("app/api/products/bulk/route.ts")
  const request = body => new NextRequest("http://localhost/api/products/bulk", { method: "POST", body: JSON.stringify(body) })
  for (const body of [null, { ids: [{}] }, { ids: "not-an-array" }]) {
    const response = await POST(request(body))
    assert.equal(response.status, 400)
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*")
  }
  assert.equal(calls, 0)
  const response = await POST(request({ ids: [nativeId.toString(), "legacy-string", 12], compare: true, include_inactive: true }))
  assert.equal(response.status, 200)
  assert.equal((await response.json())[0].id, nativeId.toString())
  assert.equal(query.$and[1].active, true)
  assert.ok(query.$and[0].$or.some(filter => filter._id === "legacy-string"))
  staff = true
  await POST(request({ ids: [nativeId.toString()], include_inactive: "true" }))
  assert.equal(query.$and, undefined)
})

test("campaign sending validates input and combines selected and imported recipients without duplicates", async () => {
  const sent = []
  const history = []
  const issued = []
  let withdrawConsent = false
  const { escapeHtml } = sourceLoader().load("lib/email.ts")
  const db = { collection: name => {
    if (name === "email_templates") return { findOne: async () => null }
    if (name === "campaign_history") return { insertOne: async document => history.push(document) }
    throw new Error(`Unexpected campaign collection ${name}`)
  } }
  const { POST } = sourceLoader({
    "@/lib/auth": { checkAdminAuthorization: async () => ({ authorized: true, userId: "fixture-admin" }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db }) },
    "@/lib/email": { escapeHtml, sendEmail: async options => { sent.push(options); return { success: true } } },
    "@/lib/customer-profile": { issueUnsubscribeToken: async (id, channel) => {
      assert.equal(channel, "email")
      if (withdrawConsent) throw new Error("Fixture consent withdrawn before delivery")
      issued.push(id)
      return `fixture-token-${id}`
    } },
    "@/lib/marketing/campaigns": { CAMPAIGN_TEMPLATES: [] },
    "@/lib/promoTemplates": { PROMO_TEMPLATES: [] },
    "@/lib/marketing/segments": { buildAudience: async () => [
      { id: "chosen", email: "chosen@example.invalid", name: "Chosen", unsubscribeToken: "chosen-token", consent: { email: true } },
      { id: "denied", email: "denied@example.invalid", name: "Denied", consent: { email: false } },
      { id: "unselected", email: "unselected@example.invalid", consent: { email: true } },
      { id: "imported", email: "imported@example.invalid", name: "<Imported>", consent: { email: true } },
    ] },
  }).load("app/api/admin/send-campaign/route.ts")
  const request = body => new Request("http://localhost/api/admin/send-campaign", { method: "POST", body: JSON.stringify(body) })
  for (const body of [null, {}, { templateId: "fixture", customUsers: [{ email: "not-email" }] }]) {
    assert.equal((await POST(request(body))).status, 400)
  }
  assert.equal(sent.length, 0)
  for (const email of ["unmatched@example.invalid", "denied@example.invalid"]) {
    const rejected = await POST(request({
      templateId: "fixture", subject: "Fixture", html: "Fixture", customUsers: [{ email }], userIds: ["chosen"],
    }))
    assert.equal(rejected.status, 400)
    assert.match((await rejected.json()).error, /stored email opt-in/)
  }
  assert.equal(sent.length, 0)
  assert.equal(issued.length, 0)
  const response = await POST(request({
    templateId: "fixture", subject: "Hello {{name}}", html: "<p>Hi {{name}}</p>",
    userIds: ["chosen", "denied"], customUsers: [
      { email: "imported@example.invalid", name: "Imported" },
      { email: "IMPORTED@example.invalid", name: "Duplicate" },
    ], sentBy: "forged-admin", segment: "fixture-segment",
  }))
  assert.equal(response.status, 200)
  const progress = (await response.text()).trim().split("\n").map(line => JSON.parse(line))
  assert.equal(progress.at(-1).type, "complete")
  assert.equal(progress.at(-1).sent, 2)
  assert.deepEqual(sent.map(message => message.to), ["imported@example.invalid", "chosen@example.invalid"])
  assert.equal(sent[1].subject, "Hello Chosen")
  assert.match(sent[0].html, /&lt;Imported&gt;/)
  assert.match(sent[0].html, /api\/unsubscribe\?token=fixture-token-imported/)
  assert.equal(sent[0].html.includes("{{unsubscribeToken}}"), false)
  assert.deepEqual(issued, ["imported", "chosen"])
  assert.equal(history[0].sentBy, "fixture-admin")
  assert.equal(history[0].segment, "fixture-segment")
  assert.equal(history[0].recipientCount, 2)
  withdrawConsent = true
  const withdrawn = await POST(request({ templateId: "fixture", subject: "Fixture", html: "Fixture", userIds: ["chosen"] }))
  const final = (await withdrawn.text()).trim().split("\n").map(line => JSON.parse(line)).at(-1)
  assert.equal(final.sent, 0)
  assert.equal(final.failed, 1)
  assert.equal(sent.length, 2)
})

test("campaign response contracts retain legacy identities and reject unsafe or missing shapes", () => {
  const schemas = sourceLoader().load("lib/marketing/campaign-response.ts")
  assert.equal(schemas.savedEmailTemplateSchema.parse({ _id: "fixture-id", name: "Fixture" })._id, "fixture-id")
  assert.equal(schemas.savedEmailTemplateSchema.safeParse({}).success, false)
  assert.equal(schemas.campaignRecipientListResponseSchema.safeParse({ items: [{ userId: "fixture-user", phone: "0000000000" }] }).success, true)
  assert.equal(schemas.campaignRecipientListResponseSchema.safeParse([{ name: "Missing identity" }]).success, false)
  assert.equal(schemas.whatsappPreviewResponseSchema.safeParse({ mode: "sent" }).success, false)
})

test("campaign progress handles arbitrary chunks and a final line without a newline", async () => {
  const { readCampaignProgress } = sourceLoader().load("lib/marketing/campaign-response.ts")
  const start = { type: "start", totalRecipients: 2, totalBatches: 1, batchSize: 50 }
  const complete = { type: "complete", sent: 1, failed: 1, totalRecipients: 2 }
  const bytes = new TextEncoder().encode(`${JSON.stringify(start)}\n\n${JSON.stringify(complete)}`)
  const stream = new ReadableStream({ start(controller) {
    for (let offset = 0; offset < bytes.length; offset += 7) controller.enqueue(bytes.slice(offset, offset + 7))
    controller.close()
  } })
  const received = []
  for await (const event of readCampaignProgress(stream)) received.push(JSON.parse(JSON.stringify(event)))
  assert.deepEqual(received, [start, complete])
  assert.equal(stream.locked, false)
})

test("campaign progress rejects truncation, malformed events and inconsistent completion without false success", async () => {
  const { readCampaignProgress } = sourceLoader().load("lib/marketing/campaign-response.ts")
  const start = JSON.stringify({ type: "start", totalRecipients: 2, totalBatches: 1, batchSize: 50 })
  const complete = JSON.stringify({ type: "complete", sent: 1, failed: 1, totalRecipients: 2 })
  for (const body of [
    `${start}\n`, `${start}\n{"type":`, `${start}\n${JSON.stringify({ type: "complete", sent: 2, failed: 1, totalRecipients: 2 })}`,
    `${start}\n${complete}\n${complete}`, complete, `${start}\n${start}`,
  ]) {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    } })
    const events = []
    await assert.rejects(async () => {
      for await (const event of readCampaignProgress(stream)) events.push(event)
    })
    assert.equal(events.some(event => event.type === "complete"), false)
    assert.equal(stream.locked, false)
  }
  await assert.rejects(async () => { for await (const _event of readCampaignProgress(null)) {} }, /no progress stream/)
})

test("order sequence initializes its documented starting number and increments existing counters atomically", async () => {
  let sequence
  let resultMissing = false
  const { generateOrderId } = sourceLoader({
    "@/lib/db-service": { getCollection: async name => {
      assert.equal(name, "counters")
      return { findOneAndUpdate: async (filter, pipeline, options) => {
        assert.equal(filter._id, "order_number")
        assert.equal(options.upsert, true)
        assert.equal(options.returnDocument, "after")
        assert.equal(pipeline[0].$set.seq.$add[0].$ifNull[0], "$seq")
        sequence = (sequence ?? pipeline[0].$set.seq.$add[0].$ifNull[1]) + pipeline[0].$set.seq.$add[1]
        return resultMissing ? null : { _id: "order_number", seq: sequence }
      } }
    } },
  }).load("lib/order-id.ts")
  assert.equal(await generateOrderId(), "SARAECOM-00100001")
  assert.equal(await generateOrderId(), "SARAECOM-00100002")
  sequence = 555555
  assert.equal(await generateOrderId(), "SARAECOM-00555556")
  resultMissing = true
  await assert.rejects(generateOrderId(), /valid sequence/)
})

test("media lookup preserves native and legacy ID order while surfacing database failures", async () => {
  const nativeId = new ObjectId()
  const lookedUp = []
  let failure = false
  const helpers = sourceLoader().load("lib/db-service.ts")
  const { readMediaField } = sourceLoader({
    "@/lib/db-service": { ...helpers, getCollection: async () => ({
      findOne: async filter => {
        lookedUp.push(filter)
        if (failure) throw new Error("Fixture media database failure")
        return filter.id ? { brandLogo: "data:image/png;base64,fixture" } : null
      },
    }) },
  }).load("lib/media-store.ts")
  assert.equal(await readMediaField("brand-logo", nativeId.toString()), "data:image/png;base64,fixture")
  assert.ok(lookedUp[0]._id instanceof ObjectId)
  assert.equal(lookedUp[1]._id, nativeId.toString())
  assert.equal(lookedUp[2].id, nativeId.toString())
  failure = true
  await assert.rejects(readMediaField("brand-logo", nativeId.toString()), /database failure/)
})

test("offer expiry normalization preserves valid windows and tolerates invalid legacy dates without throwing", () => {
  const { getOfferMerchandising, isOfferLive } = sourceLoader().load("lib/offer-sections.ts")
  assert.equal(getOfferMerchandising({ section: "clearance", storeIds: [123, "fixture"], endsAt: "2026-10-12T00:00:00Z" }).endsAt, "2026-10-12T00:00:00.000Z")
  assert.equal(getOfferMerchandising({ endsAt: "not-a-date" }).endsAt, null)
  assert.equal(isOfferLive({ active: false }), false)
  assert.equal(isOfferLive({ endsAt: "2026-10-11T00:00:00Z" }, new Date("2026-10-12T00:00:00Z")), false)
  assert.equal(isOfferLive({ endsAt: null }), true)
})

test("analytics keeps consent gating and retries a beacon that was not queued", async () => {
  let consent = false
  let beacons = 0
  const requests = []
  const window = { location: { pathname: "/fixture" } }
  const { track, toAnalyticsItem } = sourceLoader({
    "@/lib/consent-client": { hasConsent: () => consent },
  }, {
    context: { window, navigator: { sendBeacon: () => { beacons++; return false } }, Blob },
    fetch: async (url, init) => { requests.push({ url, init }); return { ok: true } },
  }).load("lib/analytics.ts")
  assert.equal(toAnalyticsItem({ id: "fixture", name: "Fixture", price: "100" }).quantity, 1)
  track("fixture", { value: 100 })
  assert.equal(beacons, 0)
  assert.equal(requests.length, 0)
  consent = true
  track("fixture", { value: 100 })
  await Promise.resolve()
  assert.equal(beacons, 1)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "/api/events")
  assert.equal(JSON.parse(requests[0].init.body).params.value, 100)
  assert.equal(window.dataLayer.length, 1)
})

test("unsubscribe token issuance keeps old and legacy emailed links usable and stores only hashes", async () => {
  const profile = { _id: new ObjectId(), userId: "fixture-user", consent: { email: true, whatsapp: true, sms: true } }
  const tokens = new Map()
  const events = []
  let profilePresent = true
  const service = sourceLoader({ "@/lib/db-service": { getCollection: async name => {
    if (name === "customer_unsubscribe_tokens") return {
      insertOne: async document => { assert.ok(!tokens.has(document._id)); tokens.set(document._id, document) },
      findOne: async filter => tokens.get(filter._id) || null,
    }
    if (name === "customer_profiles") return {
      findOne: async filter => {
        if (!profilePresent) return null
        if (filter.userId && filter.userId !== profile.userId) return null
        if (filter["consent.email"] && !profile.consent.email) return null
        if (filter.unsubscribeTokenHash && filter.unsubscribeTokenHash !== profile.unsubscribeTokenHash) return null
        return profile
      },
      updateOne: async (_filter, update) => {
        for (const [field, value] of Object.entries(update.$set)) {
          if (field.startsWith("consent.")) profile.consent[field.split(".")[1]] = value
          else profile[field] = value
        }
        return { matchedCount: 1 }
      },
    }
    if (name === "customer_events") return { insertOne: async document => events.push(document) }
    throw new Error(`Unexpected opt-out collection ${name}`)
  } } }).load("lib/customer-profile.ts")
  profile.unsubscribeTokenHash = service.hashUnsubscribeToken("fixture-legacy-token")
  const first = await service.issueUnsubscribeToken(profile.userId, "email")
  const second = await service.issueUnsubscribeToken(profile.userId, "email")
  assert.notEqual(first, second)
  assert.equal(tokens.size, 2)
  assert.ok(tokens.has(service.hashUnsubscribeToken(first)))
  assert.equal(JSON.stringify([...tokens.values()]).includes(first), false)
  assert.equal(profile.unsubscribeTokenHash, service.hashUnsubscribeToken("fixture-legacy-token"))
  for (const token of [first, second, "fixture-legacy-token"]) {
    profile.consent.email = true
    assert.equal(await service.unsubscribeByToken(token, "email"), true)
    assert.equal(profile.consent.email, false)
    assert.equal(profile.consent.whatsapp, true)
  }
  assert.equal(await service.unsubscribeByToken("unknown-fixture-token", "all"), false)
  await assert.rejects(service.issueUnsubscribeToken(profile.userId, "email"), /consent was withdrawn/)
  assert.equal(tokens.size, 2)
  profilePresent = false
  assert.equal(await service.unsubscribeByToken(first, "email"), false)
  await assert.rejects(service.issueUnsubscribeToken(profile.userId), /profile is missing/)
  assert.equal(events.length, 3)
})

test("marketing email shells always include a usable opt-out link without duplicating the built-in footer", () => {
  const { withEmailUnsubscribe } = sourceLoader({}, { env: { NEXT_PUBLIC_SITE_URL: "https://store.example.invalid" } }).load("lib/marketing/email-layout.ts")
  const custom = withEmailUnsubscribe("<html><body><p>Fixture</p></body></html>", "fixture-token")
  assert.ok(custom.indexOf("Unsubscribe from marketing emails") < custom.indexOf("</body>"))
  assert.match(custom, /store\.example\.invalid\/api\/unsubscribe\?token=fixture-token&amp;channel=email/)
  const builtIn = withEmailUnsubscribe('<a href="https://store.example.invalid/api/unsubscribe?token={{unsubscribeToken}}">Unsubscribe</a>', "fixture-token")
  assert.equal(builtIn.includes("{{unsubscribeToken}}"), false)
  assert.equal(builtIn.includes("Unsubscribe from marketing emails"), false)
  assert.match(builtIn, /token=fixture-token/)
  assert.throws(() => withEmailUnsubscribe("Fixture", ""), /token is required/)
})

test("account erasure removes hash-only unsubscribe verifiers for the authenticated account", async () => {
  const userId = new ObjectId().toString()
  const purges = []
  const db = {
    listCollections: () => ({ toArray: async () => [] }),
    collection: name => ({
      findOne: async () => ({ _id: new ObjectId(userId), email: "fixture@example.invalid", status: "active" }),
      deleteMany: async filter => { purges.push({ name, filter }); return { deletedCount: 1 } },
      updateMany: async () => ({ modifiedCount: 0 }),
      updateOne: async () => ({ matchedCount: 1 }),
    }),
  }
  const { DELETE } = sourceLoader({
    "@/lib/auth": { getSession: async () => ({ user: { id: userId } }) },
    "@/lib/mongodb": { connectToDatabase: async () => ({ db }) },
    "@/lib/consent": { withdrawAllOptional: async () => {} },
    "@/lib/refresh-tokens": { revokeAllForUser: async () => 1 },
  }).load("app/api/v1/account/route.ts")
  const response = await DELETE(new NextRequest("http://localhost/api/v1/account", { method: "DELETE", body: "{}" }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).purged.customer_unsubscribe_tokens, 1)
  assert.equal(purges.find(purge => purge.name === "customer_unsubscribe_tokens").filter.userId, userId)
})

test("JSON API requests require real response parsers for typed data and preserve cookie/error contracts", async () => {
  const requests = []
  let response = new Response('{"value":7}')
  const client = sourceLoader({}, { fetch: async (url, init) => {
    requests.push({ url, init })
    return response
  } }).load("lib/api-client.ts")
  const parse = value => {
    if (!value || typeof value !== "object" || typeof value.value !== "number") throw new Error("Invalid fixture response")
    return value.value
  }
  assert.equal(await client.apiFetchJson("/api/fixture", { json: { name: "Fixture" } }, parse), 7)
  assert.equal(requests[0].init.credentials, "include")
  assert.equal(requests[0].init.headers.get("Content-Type"), "application/json")
  assert.equal(requests[0].init.body, '{"name":"Fixture"}')
  response = new Response('{"value":"invalid"}')
  await assert.rejects(client.apiFetchJson("/api/fixture", undefined, parse), /Invalid fixture response/)
  response = new Response("plain text")
  assert.equal(await client.apiFetchJson("/api/fixture"), "plain text")
  response = new Response('{"error":"Fixture denied"}', { status: 403 })
  await assert.rejects(client.apiFetchJson("/api/fixture"), error =>
    error instanceof client.ApiError && error.status === 403 && error.message === "Fixture denied")
  response = new Response('{"error":{"detail":"opaque"}}', { status: 500 })
  await assert.rejects(client.apiFetchJson("/api/fixture"), error =>
    error instanceof client.ApiError && error.message === "Request failed with status 500")
})

test("homepage section editing uses the backend query ID and normalized mutation envelope", async () => {
  const nativeId = new ObjectId()
  let stored = { _id: nativeId, type: "manual", title: "Fixture", config: { productIds: ["fixture-product"] }, enabled: true, order: 0 }
  const helpers = sourceLoader().load("lib/db-service.ts")
  const { PUT, POST } = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "fixture-admin" } }) },
    "@/lib/db-service": { ...helpers, getCollection: async () => ({
      findOne: async filter => { assert.equal(filter._id.toString(), nativeId.toString()); return stored },
      updateOne: async (_filter, update) => { stored = { ...stored, ...update.$set }; return { matchedCount: 1 } },
      find: () => ({ sort: () => ({ limit: () => ({ next: async () => stored }) }) }),
      insertOne: async () => ({ insertedId: nativeId }),
    }) },
  }).load("app/api/home-components/route.ts")
  const { updateHomeSection } = sourceLoader({}, { fetch: async (url, init) => {
    assert.equal(new URL(url, "http://localhost").searchParams.get("id"), nativeId.toString())
    assert.equal(init.method, "PUT")
    return PUT(new Request(new URL(url, "http://localhost"), init))
  } }).load("lib/home-components-client.ts")
  const updated = await updateHomeSection(nativeId.toString(), { enabled: false })
  assert.equal(updated.id, nativeId.toString())
  assert.equal(updated.enabled, false)
  assert.equal(updated._id, undefined)
  const response = await POST(new Request("http://localhost/api/home-components", { method: "POST", body: JSON.stringify({
    type: "manual", title: "Fixture copy", config: { productIds: ["fixture-product"] },
  }) }))
  assert.equal(response.status, 200)
  const created = await response.json()
  assert.equal(created.id, nativeId.toString())
  assert.equal(created.component.id, nativeId.toString())
  assert.equal(created.component._id, undefined)
})

test("banner, upload and homepage response schemas reject malformed shapes while preserving legacy nullable fields", () => {
  const loader = sourceLoader()
  const banners = loader.load("hooks/useBanners.ts")
  const home = loader.load("lib/home-components-client.ts")
  const upload = loader.load("lib/media-response.ts")
  const parsed = banners.siteBannerListResponseSchema.parse([{ id: "fixture", placement: "home-hero", title: "Fixture", image: null, scope: null }])
  assert.equal(parsed[0].image, undefined)
  assert.equal(banners.siteBannerListResponseSchema.safeParse([{ id: "fixture", placement: "unknown", title: "Fixture" }]).success, false)
  assert.equal(upload.imageUploadResponseSchema.parse({ images: [{ url: "/api/media/images/fixture" }] }).images[0].url, "/api/media/images/fixture")
  assert.equal(upload.imageUploadResponseSchema.safeParse({ images: [{ url: 123 }] }).success, false)
  assert.equal(home.homeSectionListResponseSchema.safeParse([{ id: "fixture", type: "category", title: null, config: {} }]).success, false)
  const section = home.homeSectionResponseSchema.parse({ id: "fixture", type: "manual", config: { productIds: [] } })
  assert.equal(section.enabled, true)
  assert.equal(section.order, 0)
  assert.equal(section.title, null)
  assert.equal(loader.load("hooks/usePrefetchHomeProducts.ts").homeComponentResponseSchema, home.homeSectionResponseSchema)
})

test("partner payout history rejects an invalid status before querying data", async () => {
  let calls = 0
  const loader = sourceLoader({
    "@/lib/partner/auth": { withPartnerAuth: handler => handler },
    "@/lib/partner/wallet": { getPartnerPayouts: async () => { calls++; throw new Error("Unexpected lookup") } },
  })
  const { GET } = loader.load("app/api/v1/partner/wallet/payouts/route.ts")
  const response = await GET(new NextRequest("http://localhost/api/v1/partner/wallet/payouts?status=invalid"))
  assert.equal(response.status, 400)
  assert.equal(calls, 0)
})

test("mail templates preserve escaping and pending payment state without real SMTP calls", async () => {
  const sent = []
  const loader = sourceLoader({ nodemailer: { createTransport: () => ({ sendMail: async options => { sent.push(options); return { messageId: "fixture" } } }) } })
  const { getVendorOrderNotificationTemplate, getOrderConfirmationEmailTemplate, sendEmail } = loader.load("lib/email.ts")
  const order = {
    id: "FIXTURE", items: [{ name: "<Fixture item>", quantity: 2, price: 100, image: null }],
    customer: { firstName: "<Fixture>", lastName: "Customer", email: "fixture@example.invalid", phone: null, address: "Fixture", city: "Fixture", state: "Fixture", zipCode: "000000", country: "IN" },
    subtotal: 200, tax: 36, shipping: 0, total: 236, paymentMethod: "cod", paymentDetails: { status: "pending" },
  }
  const vendor = getVendorOrderNotificationTemplate(order)
  assert.ok(vendor.includes("&lt;Fixture item&gt;"))
  assert.ok(vendor.includes("Payment Status:</strong> pending"))
  assert.ok(getOrderConfirmationEmailTemplate(order).includes("&lt;Fixture&gt;"))
  assert.equal(sent.length, 0)
  const attachment = { filename: "fixture.txt", content: "Synthetic fixture only" }
  const result = await sendEmail({ to: "fixture@example.invalid", subject: "Fixture", html: vendor, attachments: [attachment] })
  assert.equal(result.success, true)
  assert.equal(sent[0].attachments[0], attachment)
})

test("Razorpay response contracts preserve exact checkout capabilities and numeric provider amounts", () => {
  const { RazorpayOrderResponseSchema, RazorpayVerificationResponseSchema } = sourceLoader().load("types/razorpay.ts")
  const response = { keyId: "fixture-public-key", orderId: "fixture-order", checkoutToken: "fixture-capability", amount: 10000, currency: "INR" }
  for (const amount of [10000, "10000"]) {
    const parsed = RazorpayOrderResponseSchema.parse({ ...response, amount })
    assert.equal(parsed.amount, 10000)
    assert.equal(parsed.checkoutToken, response.checkoutToken)
  }
  for (const invalid of [{ checkoutToken: "" }, { amount: 0 }, { amount: -100 }, { currency: "USD" }]) {
    assert.equal(RazorpayOrderResponseSchema.safeParse({ ...response, ...invalid }).success, false)
  }
  assert.equal(RazorpayVerificationResponseSchema.parse({ paymentId: "fixture-payment", orderId: response.orderId }).paymentId, "fixture-payment")
  assert.equal(RazorpayVerificationResponseSchema.safeParse({ paymentId: "fixture-payment" }).success, false)
})

test("pincode restrictions preserve legacy strings and named entries and reject an unknown mode", () => {
  const { PincodeRestrictionsResponseSchema } = sourceLoader().load("lib/validation.ts")
  const parsed = PincodeRestrictionsResponseSchema.parse({
    mode: "both", blockedPincodes: ["560001", { pincode: "560002", name: "Fixture" }], allowedPincodes: ["560003"],
  })
  assert.equal(parsed.blockedPincodes[0], "560001")
  assert.equal(parsed.blockedPincodes[1].pincode, "560002")
  assert.equal(PincodeRestrictionsResponseSchema.parse({}).mode, "blocked")
  assert.equal(PincodeRestrictionsResponseSchema.safeParse({ mode: "unrestricted" }).success, false)
})

test("MongoDB normalization strips _id and prevents a stored id from shadowing it", () => {
  const { normalizeId } = sourceLoader().load("lib/db-service.ts")
  const _id = new ObjectId()
  const original = { _id, id: "untrusted-shadow", name: "Fixture" }
  const normalized = normalizeId(original)
  assert.equal(normalized.id, _id.toString())
  assert.equal("_id" in normalized, false)
  assert.equal(original.id, "untrusted-shadow")
  assert.equal(normalizeId(null), null)
  assert.equal(normalizeId(undefined), undefined)
  assert.equal(normalizeId([original])[0].id, _id.toString())
})

test("MongoDB identifier lookup retains ObjectId, string _id and id fallback order", async () => {
  const id = new ObjectId().toString()
  const queries = []
  const record = { _id: "legacy-id", id, name: "Fixture" }
  const collection = {
    findOne: async (query) => {
      queries.push(query)
      return query.id === id ? record : null
    },
  }
  const loader = sourceLoader({ "@/lib/mongodb": { connectToDatabase: async () => ({ db: { collection: () => collection } }) } })
  const result = await loader.load("lib/db-service.ts").getById("products", id)
  assert.equal(result.id, "legacy-id")
  assert.equal(queries[0]._id.toString(), id)
  assert.equal(queries[1]._id, id)
  assert.equal(queries[2].id, id)
})

test("specification schema accepts legacy nested details, nullable ratings and named authors", () => {
  const { productSpecificationResponseSchema } = sourceLoader().load("lib/product-specification-response.ts")
  const parsed = productSpecificationResponseSchema.safeParse({
    sku: "FIXTURE-SKU",
    technical_details: { Voltage: "220V", nested: { weight: 2 } },
    reviews: [{ rating: null, title: "Fixture review", author: { name: "Fixture" } }],
    updatedAt: { $date: "2026-10-12T00:00:00.000Z" },
    additional_info: { arbitraryLegacyField: ["one", "two"] },
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.data.reviews[0].author.name, "Fixture")
})

test("specification fetching handles array responses and real HTTP 404 without swallowing server errors", async () => {
  const responses = [
    Response.json([{ sku: "FIXTURE-SKU", technical_details: { Power: "100W" } }]),
    new Response(null, { status: 404 }),
    new Response(null, { status: 503 }),
  ]
  const loader = sourceLoader({}, { fetch: async (_url, options) => {
    assert.equal(options.cache, "no-store")
    return responses.shift()
  } })
  const { fetchProductSpecification } = loader.load("lib/product-specification-response.ts")
  assert.equal((await fetchProductSpecification("/api/fixture")).sku, "FIXTURE-SKU")
  assert.equal(await fetchProductSpecification("/api/fixture"), null)
  await assert.rejects(() => fetchProductSpecification("/api/fixture"), /could not be loaded/)
})

test("production rate limits select shared MongoDB and refuse per-instance memory", () => {
  const mongo = sourceLoader({}, { env: { NODE_ENV: "production" } }).load("lib/rate-limit-store.ts")
  assert.equal(mongo.rateLimitBackend(), "mongodb")
  const memory = sourceLoader({}, { env: { NODE_ENV: "production", RATE_LIMIT_BACKEND: "memory" } }).load("lib/rate-limit-store.ts")
  assert.throws(() => memory.rateLimitBackend(), /temporarily unavailable/)
})

test("shared-store outages fail closed and produce HTTP 503 without running a protected handler", async () => {
  let calls = 0
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: async () => { throw new Error("Fixture counter unavailable") } },
  }, { env: { NODE_ENV: "production", RATE_LIMIT_BACKEND: "mongodb" } })
  const { withRateLimit } = loader.load("lib/rate-limit.ts")
  const protectedHandler = withRateLimit(() => { calls++; return Response.json({ success: true }) })
  const response = await protectedHandler(new NextRequest("http://localhost/api/fixture"))
  assert.equal(response.status, 503)
  assert.equal(response.headers.get("Retry-After"), "60")
  assert.equal(calls, 0)
  assert.equal((await response.json()).success, false)
})

test("Upstash malformed pipeline replies cannot silently fall back to memory", async () => {
  let requests = 0
  const loader = sourceLoader({}, {
    env: { NODE_ENV: "production", RATE_LIMIT_BACKEND: "upstash", UPSTASH_REDIS_REST_URL: "https://redis.fixture.invalid", UPSTASH_REDIS_REST_TOKEN: "fixture-only" },
    fetch: async () => { requests++; return Response.json([{ result: 1 }]) },
  })
  const { rateLimitHit } = loader.load("lib/rate-limit-store.ts")
  await assert.rejects(() => rateLimitHit("fixture", 5, 1000), /temporarily unavailable/)
  assert.equal(requests, 1)
})

test("invalid limiter configuration is rejected rather than providing unrestricted access", async () => {
  const { rateLimitHit } = sourceLoader().load("lib/rate-limit-store.ts")
  for (const [key, limit, window] of [["", 5, 1000], ["fixture", 0, 1000], ["fixture", 5, 0]]) {
    await assert.rejects(() => rateLimitHit(key, limit, window), /must be valid/)
  }
})

test("catalog cards accept normalized IDs and legacy image arrays but reject malformed records", () => {
  const { productCardResponseSchema, recentlyViewedResponseSchema } = sourceLoader().load("lib/product-card-response.ts")
  const product = { id: "fixture-id", name: "Fixture", price: 100, image: "/fixture.png", specification_images: ["/first.png"] }
  assert.equal(productCardResponseSchema.parse(product).specification_images[0], "/first.png")
  assert.equal(recentlyViewedResponseSchema.parse({ products: [product] }).products[0].id, product.id)
  assert.equal(productCardResponseSchema.safeParse({ ...product, id: undefined, _id: product.id }).success, false)
  assert.equal(productCardResponseSchema.safeParse({ ...product, price: "100" }).success, false)
})

test("catalog savings use actual MRP, never an invented markup", () => {
  const { getCatalogMRP, calculateDiscount } = sourceLoader().load("lib/product-display.ts")
  assert.equal(getCatalogMRP({ price: 100 }), 0)
  assert.equal(calculateDiscount(getCatalogMRP({ price: 100 }), 100), 0)
  assert.equal(getCatalogMRP({ raw: { MRP: "1,299" } }), 1299)
  assert.equal(getCatalogMRP({ mrp: 150, originalPrice: 200 }), 150)
  assert.equal(calculateDiscount(150, 100), 33)
  assert.equal(calculateDiscount(90, 100), 0)
})

test("catalog normalization preserves aliases and handles malformed legacy raw fields", () => {
  const { normalizeProductForSchema } = sourceLoader().load("lib/product-schema.ts")
  const normalized = normalizeProductForSchema({ sku: "Fixture", raw: { "ITEM CATEGORY": "Appliances", "PROD DESC": "Washing Machines" } })
  assert.equal(normalized.itemno, "Fixture")
  assert.equal(normalized.categoryGroupName, "Appliances")
  assert.equal(normalized.subCategoryProdDesc, "Washing Machines")
  assert.equal(normalizeProductForSchema({ raw: "invalid" }).name, "")
  assert.equal(normalizeProductForSchema(null).itemno, "")
})

function productRoute(collection, admin = false) {
  const { normalizeId } = sourceLoader().load("lib/db-service.ts")
  return sourceLoader({
    "@/lib/db-service": { getCollection: async () => collection, normalizeId, COLLECTIONS: { PRODUCTS: "products" } },
    "@/lib/auth": { isAdmin: async () => admin, requireAdmin: async () => ({ ok: true, user: { id: "fixture-admin" } }) },
  }).load("app/api/products/[id]/route.ts")
}

test("projected product reads still hide inactive catalog records", async () => {
  let projection
  const route = productRoute({
    findOne: async (_filter, options) => {
      projection = options.projection
      return { _id: new ObjectId(), name: "Fixture", active: false }
    },
  })
  const response = await route.GET(new NextRequest("http://localhost/api/products/fixture?fields=name"), { params: Promise.resolve({ id: "fixture" }) })
  assert.equal(response.status, 404)
  assert.equal(projection.active, 1)
})

test("projected product responses use canonical IDs without exposing internal active checks", async () => {
  const _id = new ObjectId()
  const route = productRoute({ findOne: async () => ({ _id, id: "shadow-id", name: "Fixture", active: true }) })
  const response = await route.GET(new NextRequest("http://localhost/api/products/fixture?fields=name"), { params: Promise.resolve({ id: "fixture" }) })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.id, _id.toString())
  assert.equal("_id" in data, false)
  assert.equal("active" in data, false)
})

test("product lookup failures return an error rather than swallowing a failed identifier query", async () => {
  let calls = 0
  const route = productRoute({ findOne: async () => {
    calls++
    if (calls === 1) return null
    throw new Error("Fixture database unavailable")
  } })
  const id = new ObjectId().toString()
  const response = await route.GET(new NextRequest(`http://localhost/api/products/${id}`), { params: Promise.resolve({ id }) })
  assert.equal(response.status, 500)
  assert.equal(calls, 2)
})

for (const method of ["PATCH", "PUT"]) {
  test(`product ${method} strips immutable identifiers and normalizes its returned ID`, async () => {
    const _id = new ObjectId()
    let update
    const route = productRoute({
      updateOne: async (_filter, change) => { update = change.$set; return { matchedCount: 1 } },
      findOne: async () => ({ _id, id: "shadow-id", name: "Fixture", price: 100, images: ["/fixture.png"] }),
    }, true)
    const request = new NextRequest(`http://localhost/api/products/${_id}`, {
      method, body: JSON.stringify({ id: "forged-id", _id: "forged-id", name: "Fixture" }),
      headers: { "Content-Type": "application/json" },
    })
    const response = await route[method](request, { params: Promise.resolve({ id: _id.toString() }) })
    assert.equal(response.status, 200)
    assert.equal("id" in update, false)
    assert.equal("_id" in update, false)
    assert.equal((await response.json()).id, _id.toString())
  })
}

test("legacy commerce attributes retain units, dimensions, dates and valid store-stock entries", () => {
  const { getProductCommerceAttributes } = sourceLoader().load("lib/product-attributes.ts")
  const attributes = getProductCommerceAttributes({
    raw: { warranty: "2 years", weight: "12.5 kg", dimensions: "80 x 45 x 30 cm" },
    storeStock: [null, { store_id: "fixture-store", store_name: "Fixture", qty: "3" }],
    priceValidFrom: "2026-10-12T00:00:00Z",
  })
  assert.equal(attributes.warrantyMonths, 24)
  assert.equal(attributes.weightKg, 12.5)
  assert.equal(attributes.dimensionsCm.length, 80)
  assert.equal(attributes.storeStock.length, 1)
  assert.equal(attributes.storeStock[0].quantity, 3)
  assert.equal(attributes.priceValidFrom.toISOString(), "2026-10-12T00:00:00.000Z")
  assert.equal(getProductCommerceAttributes(null).gtin, null)
})

test("image coverage preserves explicit roles and filters invalid legacy image entries", () => {
  const { auditProductImages } = sourceLoader().load("lib/product-images.ts")
  const result = auditProductImages({
    image: "/fixture-primary.png",
    images: [null, 42, "/fixture-front.png", "/placeholder.svg"],
    imageRoles: { rear: "/fixture-rear.png", side: 42 },
  })
  assert.equal(result.total, 2)
  assert.equal(result.byRole.rear, "/fixture-rear.png")
  assert.equal(result.byRole.front, "/fixture-front.png")
  assert.equal(result.missingRequired.includes("side"), true)
})

test("an add-to-cart toast cannot grow long enough to cover the page", () => {
  const { toastProductName, cleanProductName } = sourceLoader().load("utils/cleanProductName.ts")

  // The real offender: this product's "name" is its whole marketing paragraph,
  // which sized the toast to 2478px on a 412px viewport. Because react-hot-toast
  // pauses dismissal while a toast is hovered, it then sat under the pointer and
  // never expired, blanketing the storefront until a reload.
  const paragraph =
    "Immersive 65-inch QNED 4K Ultra HD Display Step into a world of unparalleled " +
    "home entertainment with the LG QNED82T Smart TV, ".repeat(20)

  assert.equal(cleanProductName(paragraph).length > 500, true, "the raw name really is that long")

  const trimmed = toastProductName(paragraph)
  assert.equal(trimmed.length <= 49, true, `expected a capped name, got ${trimmed.length} characters`)
  assert.equal(trimmed.endsWith("\u2026"), true, "a truncated name should say so")

  // A name that already fits is passed through untouched, ellipsis included.
  assert.equal(toastProductName("Anker 65W Charger"), "Anker 65W Charger")
  assert.equal(toastProductName(""), "Item")
  assert.equal(toastProductName(null), "Item")
})
