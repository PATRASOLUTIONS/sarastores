import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import * as XLSX from "xlsx"
import { sourceLoader } from "./source-loader.mjs"

const PRODUCTS = [
  { _id: "a", itemno: "001234", name: "Phone", active: true, mrp: 12000, price: 10000 },
  { _id: "b", itemno: "B2", name: "TV", active: true, raw: { MRP: "15,000" }, price: 14000 },
  { _id: "c", itemno: "C3", name: "Inactive", active: false, mrp: 100, price: 90 },
]
function fixture({ enabled = true, recipients = ["staff@example.com"], outcome = "accepted", collision = false } = {}) {
  let config = { enabled, recipients }
  const deliveries = new Map(), sent = []
  let productReads = 0
  const collection = async name => {
    if (name === "product_email_automation") return {
      findOne: async () => config,
      updateOne: async (_filter, update) => { config = { ...config, ...update.$set }; return { modifiedCount: 1 } },
    }
    if (name === "products") return { find: filter => {
      productReads++
      return { sort() { return this }, toArray: async () => PRODUCTS.filter(p => p.active === filter.active).map(p => structuredClone(p)) }
    } }
    if (name === "product_email_deliveries") return {
      updateMany: async () => ({ modifiedCount: 0 }),
      updateOne: async (filter, update) => {
        const existing = deliveries.get(filter._id)
        if (update.$setOnInsert) {
          if (existing) return { upsertedCount: 0 }
          if (collision) {
            deliveries.set(filter._id, { _id: filter._id, ...update.$setOnInsert, status: "accepted" })
            throw Object.assign(new Error("Duplicate unique id"), { code: 11000 })
          }
          deliveries.set(filter._id, { _id: filter._id, ...update.$setOnInsert })
          return { upsertedCount: 1 }
        }
        if (existing && (!filter.status || filter.status === existing.status)) Object.assign(existing, update.$set)
        return { modifiedCount: 1 }
      },
      find: () => ({ sort() { return this }, limit() { return this }, toArray: async () => [...deliveries.values()] }),
    }
    throw new Error(`Unexpected collection ${name}`)
  }
  class EmailConfigurationError extends Error {}
  const smtp = { EmailConfigurationError, getEmailTransport: () => ({ sendMail: async mail => {
    sent.push(mail)
    if (outcome === "timeout") throw Object.assign(new Error("Provider timeout"), { code: "ETIMEDOUT" })
    if (outcome === "auth") throw Object.assign(new Error("Provider authentication"), { code: "EAUTH" })
    return { accepted: outcome === "accepted" ? [mail.to] : [], rejected: outcome === "rejected" ? [mail.to] : [] }
  } }) }
  const loader = sourceLoader({
    "@/lib/db-service": { getCollection: collection, normalizeId: rows => rows.map(({ _id, ...rest }) => ({ id: _id, ...rest })) },
    "@/lib/smtp": smtp,
  }, { env: { EMAIL_FROM: "sender@example.com", NEXT_PUBLIC_SITE_URL: "https://www.sarastores.com" } })
  return { service: loader.load("lib/product-email-automation.ts"), loader, deliveries, sent, productReads: () => productReads }
}

test("daily schedule converts 11:30 IST to 06:00 UTC and handles India date boundaries", () => {
  const { service } = fixture()
  assert.equal(service.productEmailSchedule(new Date("2026-11-05T05:59:59Z")).due, false)
  assert.equal(service.productEmailSchedule(new Date("2026-11-05T06:00:00Z")).due, true)
  assert.equal(service.productEmailSchedule(new Date("2026-11-05T18:30:00Z")).date, "2026-11-06")
  assert.equal(service.productEmailSchedule(new Date("2026-11-05T18:30:00Z")).due, false)
})

test("settings validate email recipients, normalize duplicates and require a recipient when enabled", () => {
  const { service } = fixture()
  const parsed = service.productEmailSettingsSchema.parse({ enabled: true, recipients: [" STAFF@EXAMPLE.COM ", "staff@example.com"] })
  assert.deepEqual(Array.from(parsed.recipients), ["staff@example.com"])
  for (const recipients of [[], ["bad email"], Array.from({ length: 11 }, (_, i) => `staff${i}@example.com`), ["a@example.com\r\nBcc:other@example.com"]]) {
    assert.equal(service.productEmailSettingsSchema.safeParse({ enabled: true, recipients }).success, false)
  }
})

test("attachments match both existing import formats, preserve item numbers and exclude inactive products", async () => {
  const { service, sent } = fixture()
  const result = await service.runProductEmailAutomation({ now: new Date("2026-11-05T06:00:00Z") })
  assert.equal(result.accepted, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].attachments.length, 2)
  const price = XLSX.read(sent[0].attachments[0].content, { type: "buffer" })
  assert.deepEqual(XLSX.utils.sheet_to_json(price.Sheets["Active Products"], { header: 1 }), [
    ["itemno", "mrp", "price"], ["001234", 12000, 10000], ["B2", 15000, 14000],
  ])
  assert.equal(price.Sheets["Active Products"].A2.t, "s", "leading zeros remain text")
  const stock = XLSX.read(sent[0].attachments[1].content, { type: "buffer" })
  assert.deepEqual(XLSX.utils.sheet_to_json(stock.Sheets["Store Stock"], { header: 1 }), [
    ["CODE", "WhsCode", "Total"], ["T000946", "BLR001", 5], ["T000909", "BLR001", 2], ["T000946", "BLR002", 3],
  ])
  assert.match(sent[0].text, /replace the example rows with current stock/)
  assert.match(sent[0].text, /\/admin\/stock-check/)
})

test("overlapping and repeated invocations send once per recipient per India date", async () => {
  const { service, sent } = fixture({ recipients: ["first@example.com", "second@example.com"] })
  const options = { now: new Date("2026-11-05T06:00:00Z") }
  await Promise.all([service.runProductEmailAutomation(options), service.runProductEmailAutomation(options)])
  await service.runProductEmailAutomation({ ...options, manual: true })
  assert.equal(sent.length, 2)
  assert.equal(sent.every(mail => typeof mail.to === "string" && !mail.to.includes(",")), true)
  await service.runProductEmailAutomation({ now: new Date("2026-11-06T06:00:00Z") })
  assert.equal(sent.length, 4)
})

test("disabled, premature and dry-run jobs send no messages or load product data", async () => {
  const disabled = fixture({ enabled: false })
  await disabled.service.runProductEmailAutomation({ now: new Date("2026-11-05T06:00:00Z") })
  assert.equal(disabled.sent.length, 0)
  assert.equal(disabled.productReads(), 0)
  const normal = fixture()
  await normal.service.runProductEmailAutomation({ now: new Date("2026-11-05T05:59:00Z") })
  await normal.service.runProductEmailAutomation({ now: new Date("2026-11-05T06:00:00Z"), dryRun: true })
  assert.equal(normal.sent.length, 0)
  assert.equal(normal.productReads(), 0)
})

test("a duplicate-key race skips SMTP instead of duplicating the winner's email", async () => {
  const { service, sent } = fixture({ collision: true })
  const result = await service.runProductEmailAutomation({ now: new Date("2026-11-05T06:00:00Z") })
  assert.equal(result.skipped, 1)
  assert.equal(sent.length, 0)
})

test("SMTP rejection and uncertain timeouts retain distinct statuses and are not automatically replayed", async () => {
  for (const [outcome, expected] of [["rejected", "failed"], ["auth", "failed"], ["timeout", "unknown"]]) {
    const f = fixture({ outcome })
    const options = { now: new Date("2026-11-05T06:00:00Z") }
    const result = await f.service.runProductEmailAutomation(options)
    assert.equal(result[expected], 1)
    await f.service.runProductEmailAutomation(options)
    assert.equal(f.sent.length, 1)
    assert.equal([...f.deliveries.values()][0].status, expected)
  }
})

test("admin endpoint denies unauthenticated reads, settings changes and manual emails before accessing services", async () => {
  const route = sourceLoader({ "@/lib/auth": { requireAdmin: async () => ({ ok: false, response: new Response(null, { status: 401 }) }) } })
    .load("app/api/admin/product-email-automation/route.ts")
  for (const response of [await route.GET(), await route.PUT(new Request("https://test", { method: "PUT" })), await route.POST()]) {
    assert.equal(response.status, 401)
  }
})

test("cron endpoint requires its secret and accepts dry-run without sending", async () => {
  let called = false
  const denied = sourceLoader({
    "@/lib/cron-auth": { requireCron: () => ({ ok: false, response: new Response(null, { status: 401 }) }) },
    "@/lib/product-email-automation": { runProductEmailAutomation: () => { called = true } },
  }).load("app/api/cron/product-email-automation/route.ts")
  assert.equal((await denied.GET(new Request("https://test"))).status, 401)
  assert.equal(called, false)
  const allowed = sourceLoader({
    "@/lib/cron-auth": { requireCron: () => ({ ok: true }) },
    "@/lib/product-email-automation": { runProductEmailAutomation: async options => { assert.equal(options.dryRun, true); return { dryRun: true } } },
  }).load("app/api/cron/product-email-automation/route.ts")
  assert.equal((await allowed.GET(new Request("https://test?dryRun=1"))).status, 200)
})

test("staff must have Products access to manage its email automation", () => {
  const { staffCanAccessApi } = sourceLoader().load("lib/admin-access.ts")
  const staff = { role: "user", dashboardAccess: true, allowedPages: ["/admin/products"] }
  assert.equal(staffCanAccessApi(staff, "/api/admin/product-email-automation", "PUT"), true)
  assert.equal(staffCanAccessApi({ ...staff, allowedPages: ["/admin/stock-check"] }, "/api/admin/product-email-automation", "PUT"), false)
})

test("Vercel schedules the email at 06:00 UTC without changing the other daily jobs", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"))
  assert.deepEqual(config.crons.find(job => job.path === "/api/cron/product-email-automation"), {
    path: "/api/cron/product-email-automation", schedule: "0 6 * * *",
  })
  assert.equal(config.crons.find(job => job.path === "/api/cron/daily/maintenance").schedule, "0 1 * * *")
  assert.equal(config.crons.find(job => job.path === "/api/cron/daily/outreach").schedule, "0 3 * * *")
})
