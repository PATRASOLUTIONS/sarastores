import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import * as mongodb from "mongodb"
import { sourceLoader } from "./source-loader.mjs"

const sourceHost = "ottplay.wlbaefs.mongodb.net"
const targetHost = "attandance.oaqihbm.mongodb.net"
const sourceName = "e-commerce-bytewise"
const targetName = "sara_clone"
const controlName = "__sara_manual_clone"
const copy = (value, options = {}) => mongodb.BSON.deserialize(mongodb.BSON.serialize(value), options)
const identity = value => mongodb.BSON.EJSON.stringify(value, { relaxed: false })

function matches(document, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$or") return condition.some(item => matches(document, item))
    if (key === "$expr") return String(document._id) > String(condition.$gt[1].$literal)
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("$exists" in condition) return (document[key] !== undefined) === condition.$exists
      if ("$lt" in condition) return document[key] < condition.$lt
      if ("$eq" in condition) return identity(document[key]) === identity(condition.$eq)
    }
    return identity(document[key]) === identity(condition)
  })
}
function fixture(documents = [{ _id: "a", name: "A" }, { _id: "b", name: "B" }], sourceRoles) {
  const events = []
  const statsReads = []
  const source = new Map([["products", { documents: documents.map(document => copy(document)), options: {}, indexes: [{ v: 2, name: "_id_", key: { _id: 1 } }] }]])
  const target = new Map()
  let failCheckpoint = false
  const database = (map, side) => {
    const writable = name => {
      assert.equal(side, "target", "Production writes are forbidden in the fixture")
      events.push({ side, name })
    }
    const get = name => map.get(name) || { documents: [], options: {}, indexes: [{ v: 2, name: "_id_", key: { _id: 1 } }] }
    const apply = (document, update) => {
      Object.assign(document, update.$set || {})
      for (const key of Object.keys(update.$unset || {})) delete document[key]
    }
    return {
      listCollections(filter = {}, options = {}) {
        return { toArray: async () => [...map].filter(([name]) => !filter.name || filter.name === name).map(([name, entry]) => options.nameOnly ? { name } : { name, type: entry.type || "collection", options: copy(entry.options) }) }
      },
      async createCollection(name, options = {}) {
        writable(name)
        if (map.has(name)) throw new Error("NamespaceExists")
        map.set(name, { documents: [], options: copy(options), indexes: [{ v: 2, name: "_id_", key: { _id: 1 } }] })
      },
      async command(command) {
        assert.equal(command.dbStats, 1)
        statsReads.push({ side, command })
        return { dataSize: side === "source" ? 1024 : 512, storageSize: side === "source" ? 2048 : 1024, indexSize: side === "source" ? 1024 : 512,
          collections: map.size, objects: [...map.values()].reduce((sum, entry) => sum + entry.documents.length, 0) }
      },
      collection(name) {
        return {
          find(filter = {}, options = {}) {
            let limit = Infinity
            const rows = () => get(name).documents.filter(document => matches(document, filter)).sort((a, b) => String(a._id).localeCompare(String(b._id))).slice(0, limit).map(document => {
              const projected = options.projection ? Object.fromEntries(Object.entries(document).filter(([key]) => key === "_id" || options.projection[key])) : document
              return copy(projected, options)
            })
            const cursor = {
              sort() { return this }, batchSize() { return this }, limit(value) { limit = value; return this },
              toArray: async () => rows(), close: async () => {},
              async *[Symbol.asyncIterator]() { for (const document of rows()) yield document },
            }
            return cursor
          },
          findOne: async filter => { const found = get(name).documents.find(document => matches(document, filter)); return found ? copy(found) : null },
          countDocuments: async filter => get(name).documents.filter(document => matches(document, filter)).length,
          listIndexes: () => ({ toArray: async () => get(name).indexes.map(index => copy(index)) }),
          async createIndexes(indexes) {
            writable(name)
            for (const index of indexes) {
              const found = get(name).indexes.find(item => item.name === index.name)
              if (!found) get(name).indexes.push(copy({ v: 2, ...index }))
            }
          },
          async insertOne(document) { writable(name); get(name).documents.push(copy(document)); return { acknowledged: true } },
          async bulkWrite(operations, options) {
            assert.notEqual(options.bypassDocumentValidation, true, "Do not require broader destination permissions")
            writable(name)
            for (const { replaceOne } of operations) {
              const docs = get(name).documents
              const index = docs.findIndex(document => matches(document, replaceOne.filter))
              if (index >= 0) docs[index] = copy(replaceOne.replacement)
              else docs.push(copy(replaceOne.replacement))
            }
          },
          async findOneAndUpdate(filter, update) {
            const found = get(name).documents.find(document => matches(document, filter))
            if (!found) return null
            writable(name); apply(found, update); return copy(found)
          },
          async updateOne(filter, update) {
            if (failCheckpoint && update.$set?.collections && update.$set.collections.some(item => item.copied > 0)) {
              failCheckpoint = false; throw new Error("Synthetic interrupted checkpoint")
            }
            const found = get(name).documents.find(document => matches(document, filter))
            if (!found) return { matchedCount: 0 }
            writable(name); apply(found, update); return { matchedCount: 1 }
          },
        }
      },
    }
  }
  const sourceDb = database(source, "source")
  const targetDb = database(target, "target")
  let connects = 0
  class FakeClient {
    constructor(uri) { this.source = new URL(uri).hostname === sourceHost }
    async connect() { connects++; return this }
    async close() {}
    db(name) {
      if (name === "admin") return { command: async () => ({ authInfo: { authenticatedUserRoles: this.source
        ? sourceRoles || [{ role: "read", db: sourceName }] : [{ role: "readWrite", db: targetName }] } }) }
      assert.equal(name, this.source ? sourceName : targetName)
      return this.source ? sourceDb : targetDb
    }
  }
  const loader = sourceLoader({ mongodb: { ...mongodb, MongoClient: FakeClient } }, { env: {
    DATABASE_CLONE_SOURCE_URI: `mongodb+srv://reader:${crypto.randomUUID()}@${sourceHost}/`,
    DATABASE_CLONE_TARGET_URI: `mongodb+srv://writer:${crypto.randomUUID()}@${targetHost}/`,
    DATABASE_CLONE_APPROVAL_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_CLONE_WRITES_ENABLED: "true",
  } })
  return { service: loader.load("lib/database-clone.ts"), policy: loader.load("lib/database-clone-policy.ts"), loader, source, target, events, statsReads,
    connects: () => connects, failNextCheckpoint: () => { failCheckpoint = true } }
}
async function start(fx) {
  const preview = await fx.service.previewClone("operator")
  const state = await fx.service.startClone("operator", preview.approvalToken)
  return { preview, state }
}
async function finish(fx, state) {
  for (let step = 0; state.status === "running" && step < 100; step++) state = await fx.service.advanceClone(state.runId)
  assert.equal(state.status, "verified")
  return state
}

test("missing clone configuration fails closed without opening any database", async () => {
  const fx = fixture()
  delete fx.loader.env.DATABASE_CLONE_SOURCE_URI
  assert.equal((await fx.service.cloneStatus()).configured, false)
  assert.equal((await fx.service.cloneDatabaseSizes()).configured, false)
  assert.equal(fx.connects(), 0)
  assert.equal(fx.events.length, 0)
})

test("database sizes read bounded metadata for the named databases without writes or requiring an empty destination", async () => {
  const fx = fixture()
  fx.target.set("existing", { documents: [{ _id: "target" }], options: {}, indexes: [] })
  fx.loader.env.DATABASE_CLONE_WRITES_ENABLED = "false"
  const sizes = await fx.service.cloneDatabaseSizes()
  assert.equal(sizes.configured, true)
  assert.ok(Number.isFinite(Date.parse(sizes.measuredAt)))
  assert.equal(sizes.source.database, sourceName)
  assert.equal(sizes.source.dataBytes, 1024)
  assert.equal(sizes.source.allocatedBytes, 3072)
  assert.equal(sizes.source.documents, 2)
  assert.equal(sizes.target.database, targetName)
  assert.equal(sizes.target.allocatedBytes, 1536)
  assert.equal(sizes.target.documents, 1)
  assert.equal(fx.statsReads.length, 2)
  assert.ok(fx.statsReads.every(({ command }) => command.scale === 1 && command.maxTimeMS === 8000))
  assert.equal(fx.events.length, 0)
  assert.equal(fx.target.size, 1)
  const admin = fixture(undefined, [{ role: "readWriteAnyDatabase", db: "admin" }])
  await assert.rejects(admin.service.cloneDatabaseSizes(), /source account must have only the read role/)
  assert.equal(admin.statsReads.length, 0)
})

test("database size reporting distinguishes absent metrics from empty data and formats binary units", () => {
  const { databaseSizeFromStats, formatDatabaseBytes } = sourceLoader().load("lib/database-size.ts")
  const incomplete = databaseSizeFromStats("example", { dataSize: 0, indexSize: -1, objects: 0 })
  assert.equal(incomplete.dataBytes, 0)
  assert.equal(incomplete.documents, 0)
  assert.equal(incomplete.storageBytes, null)
  assert.equal(incomplete.indexBytes, null)
  assert.equal(incomplete.allocatedBytes, null)
  assert.equal(formatDatabaseBytes(incomplete.allocatedBytes), "Unavailable")
  assert.equal(formatDatabaseBytes(0), "0 B")
  assert.equal(formatDatabaseBytes(512), "512 B")
  assert.equal(formatDatabaseBytes(1024), "1.00 KiB")
  assert.equal(formatDatabaseBytes(1024 ** 2), "1.00 MiB")
  assert.equal(formatDatabaseBytes(1024 ** 3), "1.00 GiB")
})

test("preview is read-only and rejects administrator privileges on the source", async () => {
  const fx = fixture()
  const preview = await fx.service.previewClone("operator")
  assert.equal(preview.documents, 2)
  assert.equal(preview.target.database, "sara_clone")
  assert.ok(preview.estimate.requiredDestinationBytes > preview.estimate.storageBytes)
  assert.equal(fx.events.length, 0)
  assert.equal(fx.target.size, 0)
  const admin = fixture(undefined, [{ role: "readWriteAnyDatabase", db: "admin" }])
  await assert.rejects(admin.service.previewClone("operator"), /source account must have only the read role/)
  assert.equal(admin.events.length, 0)
})

test("approval is administrator-bound, expires, detects tampering and honors the write gate", async () => {
  const fx = fixture()
  const secret = fx.loader.env.DATABASE_CLONE_APPROVAL_SECRET
  const token = fx.policy.signCloneApproval("a".repeat(64), "operator", secret, 100)
  assert.equal(fx.policy.verifyCloneApproval(token, "operator", secret, 101), "a".repeat(64))
  assert.throws(() => fx.policy.verifyCloneApproval(token, "other", secret, 101), /another administrator/)
  assert.throws(() => fx.policy.verifyCloneApproval(token, "operator", secret, 300101), /expired/)
  assert.throws(() => fx.policy.verifyCloneApproval(`x${token}`, "operator", secret, 101), /Invalid clone approval/)
  fx.loader.env.DATABASE_CLONE_WRITES_ENABLED = "false"
  await assert.rejects(fx.service.startClone("operator", token), /writes are disabled/)
  assert.equal(fx.connects(), 0)
})

test("same cluster, wrong database and insecure URI configuration are refused", () => {
  const fx = fixture()
  for (const uri of [`mongodb+srv://u:p@${sourceHost}/`, `mongodb+srv://u:p@${targetHost}/other`, `mongodb+srv://u:p@${targetHost}/?tls=false`]) {
    assert.throws(() => fx.policy.validateCloneUri(uri, targetHost, targetName))
  }
  assert.throws(() => fx.policy.assertCloneRoles([{ role: "readWrite", db: sourceName }], "target"))
})

test("existing destination data and unsupported collection types never get overwritten", async () => {
  const fx = fixture()
  fx.target.set("attendance", { documents: [{ _id: "existing" }], options: {}, indexes: [] })
  await assert.rejects(fx.service.previewClone("operator"), /already contains collections/)
  assert.equal(fx.events.length, 0)
  const other = fixture()
  other.source.get("products").type = "view"
  await assert.rejects(other.service.previewClone("operator"), /separate supported restore plan/)
  assert.equal(other.target.size, 0)
  assert.throws(() => other.service.validateCollectionPlan({ type: "collection", name: "logs", options: { timeseries: {} } }, []))
})

test("source inventory changes invalidate the preview before any destination write", async () => {
  const fx = fixture()
  const preview = await fx.service.previewClone("operator")
  fx.source.get("products").documents.push({ _id: "c" })
  await assert.rejects(fx.service.startClone("operator", preview.approvalToken), /changed since the preview/)
  assert.equal(fx.events.length, 0)
})

test("bounded clone preserves BSON data, indexes, collection settings and leaves the source untouched", async () => {
  const fx = fixture(Array.from({ length: 121 }, (_, index) => ({ _id: `p${String(index).padStart(3, "0")}`, sku: `SKU-${index}`, name: "Synthetic", object: new mongodb.ObjectId(),
    at: new Date("2026-01-01"), amount: mongodb.Decimal128.fromString("12.50"), long: mongodb.Long.fromString("9007199254740993"), binary: new mongodb.Binary(Buffer.from([1, 2, 3])) })))
  fx.source.get("products").options = { validator: { sku: { $type: "string" } }, validationLevel: "moderate" }
  fx.source.get("products").indexes.push({ v: 2, name: "sku_unique", key: { sku: 1 }, unique: true }, { v: 2, name: "expiry", key: { at: 1 }, expireAfterSeconds: 3600 })
  const baseline = identity(fx.source.get("products"))
  const { state } = await start(fx)
  const completed = await finish(fx, state)
  assert.equal(completed.copied, 121)
  assert.equal(completed.verified, 121)
  assert.equal(identity(fx.source.get("products")), baseline)
  assert.equal(identity(fx.target.get("products").documents), identity(fx.source.get("products").documents))
  assert.equal(fx.target.get("products").indexes.find(index => index.name === "expiry").expireAfterSeconds, undefined)
  assert.equal(fx.target.get(controlName).documents[0].collections[0].indexes.find(index => index.name === "expiry").expireAfterSeconds, 3600)
  assert.ok(fx.events.every(event => event.side === "target"))
  const connections = fx.connects()
  const audited = await fx.service.withVerifiedClone(async (_db, clone) => clone.status)
  assert.equal(audited, "verified")
  assert.equal(fx.connects() - connections, 1, "Audits open only the destination connection")
})

test("a lost checkpoint resumes idempotently without duplicate documents", async () => {
  const fx = fixture()
  const { state } = await start(fx)
  await fx.service.advanceClone(state.runId) // Create products.
  fx.failNextCheckpoint()
  await assert.rejects(fx.service.advanceClone(state.runId), /database access failed/)
  assert.equal(fx.target.get("products").documents.length, 2)
  await finish(fx, (await fx.service.cloneStatus()).state)
  assert.equal(fx.target.get("products").documents.length, 2)
})

test("concurrent requests respect the lease and foreign run IDs cannot advance", async () => {
  const fx = fixture()
  const { state } = await start(fx)
  const manifest = fx.target.get(controlName).documents[0]
  manifest.lease = "other"; manifest.leaseUntil = new Date(Date.now() + 60000)
  await assert.rejects(fx.service.advanceClone(state.runId), /Another clone request is active/)
  await assert.rejects(fx.service.advanceClone(crypto.randomUUID()), /does not belong/)
  assert.equal(fx.target.size, 1)
})

test("content tampering fails verification and blocks catalogue reads", async () => {
  const fx = fixture()
  const { state } = await start(fx)
  for (let index = 0; index < 4; index++) await fx.service.advanceClone(state.runId)
  fx.target.get("products").documents[0].name = "Tampered"
  await fx.service.advanceClone(state.runId)
  await assert.rejects(fx.service.advanceClone(state.runId), /Content verification failed/)
  assert.equal((await fx.service.cloneStatus()).state.status, "failed")
  await assert.rejects(fx.service.withVerifiedClone(async () => "forbidden"), /Create and verify/)
})

test("all new API handlers guard infrastructure access and reject unapproved actions", async () => {
  let calls = 0
  const service = { cloneDatabaseSizes: async () => { calls++; return {} }, cloneStatus: async () => { calls++; return {} }, startClone: async () => { calls++; return {} }, advanceClone: async () => { calls++; return {} }, previewClone: async () => { calls++; return {} }, withVerifiedClone: async () => { calls++; return {} } }
  const overrides = { "@/lib/auth": { requireFullAdmin: async () => ({ ok: false, response: new Response("Forbidden", { status: 403 }) }) }, "@/lib/database-clone": service,
    "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products" }, getCollection: async () => { calls++; throw new Error("Unauthorized catalogue read") }, normalizeId: value => value } }
  const loader = sourceLoader(overrides)
  assert.equal((await loader.load("app/api/admin/database-clone/route.ts").GET()).status, 403)
  assert.equal((await loader.load("app/api/admin/database-clone/size/route.ts").GET()).status, 403)
  assert.equal((await loader.load("app/api/admin/database-clone/route.ts").POST(new Request("http://fixture", { method: "POST", body: "{}" }))).status, 403)
  assert.equal((await loader.load("app/api/admin/database-clone/preview/route.ts").POST()).status, 403)
  assert.equal((await loader.load("app/api/admin/catalogue-quality/route.ts").GET()).status, 403)
  assert.equal(calls, 0)
  const authorized = sourceLoader({ ...overrides, "@/lib/auth": { requireFullAdmin: async () => ({ ok: true, user: { id: "operator" } }) } })
  const response = await authorized.load("app/api/admin/database-clone/route.ts").POST(new Request("http://fixture", { method: "POST", body: JSON.stringify({ action: "start", confirmation: "yes" }) }))
  assert.equal(response.status, 400)
  assert.equal(calls, 0)
})
