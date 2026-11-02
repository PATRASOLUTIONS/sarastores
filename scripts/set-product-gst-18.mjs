import { MongoClient, BSON } from "mongodb"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const DATABASE = "e-commerce-bytewise"
const HOST = "ottplay.wlbaefs.mongodb.net"
const LIMIT = 20000
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const archive = path.join(root, "documents", "private-artifacts")

class GstPlanError extends Error {}
const digest = records => createHash("sha256").update(BSON.EJSON.stringify(records, { relaxed: false })).digest("hex")

export function gstSnapshot(documents) {
  return documents.map(document => ({
    _id: document._id,
    existed: Object.hasOwn(document, "gstRate"),
    ...(Object.hasOwn(document, "gstRate") ? { value: document.gstRate } : {}),
  })).sort((a, b) => String(a._id).localeCompare(String(b._id)))
}

export function makeGst18Plan(documents) {
  if (documents.length > LIMIT) throw new GstPlanError("GST update exceeds the reviewed product limit")
  const records = gstSnapshot(documents)
  return { version: 1, database: DATABASE, host: HOST, rate: 18, createdAt: new Date().toISOString(), baselineDigest: digest(records), records }
}

export function gstPlanSummary(plan) {
  return {
    database: plan.database, host: plan.host, products: plan.records.length,
    alreadyNumeric18: plan.records.filter(record => record.value === 18).length,
    missingCanonicalRate: plan.records.filter(record => !record.existed || record.value == null).length,
    existingOtherValues: plan.records.filter(record => record.existed && record.value != null && record.value !== 18).length,
    changes: plan.records.filter(record => record.value !== 18).length,
    update: { gstRate: 18 },
  }
}

async function readRates(collection, session) {
  return collection.find({}, { projection: { gstRate: 1 }, maxTimeMS: 8000, ...(session ? { session } : {}) })
    .sort({ _id: 1 }).limit(LIMIT + 1).toArray()
}

/** Caller must execute this inside a MongoDB transaction. No other fields are set. */
export async function applyGst18Plan(collection, plan, session) {
  if (!session || plan.version !== 1 || plan.database !== DATABASE || plan.host !== HOST || plan.rate !== 18
    || !Array.isArray(plan.records) || plan.records.length > LIMIT || digest(plan.records) !== plan.baselineDigest) {
    throw new GstPlanError("Invalid or unapproved GST update plan")
  }
  const current = await readRates(collection, session)
  if (digest(gstSnapshot(current)) !== plan.baselineDigest) {
    throw new GstPlanError("Products or GST values changed after preview; create a new preview before applying")
  }
  const ids = plan.records.filter(record => record.value !== 18).map(record => record._id)
  if (!ids.length) return { matched: 0, modified: 0 }
  const result = await collection.updateMany({ _id: { $in: ids } }, { $set: { gstRate: 18 } }, { session })
  if (result.matchedCount !== ids.length || result.modifiedCount !== ids.length) {
    throw new GstPlanError("The GST update did not match the reviewed products; transaction must be aborted")
  }
  const remaining = await collection.countDocuments({ gstRate: { $ne: 18 } }, { session, maxTimeMS: 8000 })
  if (remaining !== 0) throw new GstPlanError("GST verification failed; transaction must be aborted")
  return { matched: result.matchedCount, modified: result.modifiedCount }
}

async function main() {
  createRequire(import.meta.url)("@next/env").loadEnvConfig(root, true, { info() {}, error() {} })
  const uri = process.env.MONGODB_URI
  const database = process.env.MONGODB_DB || process.env.DB_NAME || DATABASE
  if (!uri || database !== DATABASE || new URL(uri).hostname !== HOST) throw new GstPlanError("The approved production database is not configured")
  const args = process.argv.slice(2)
  const applyIndex = args.indexOf("--apply")
  const applyCurrent = args.includes("--apply-current")
  if (applyCurrent && !args.includes("--approve-gst-18")) throw new GstPlanError("Apply requires --approve-gst-18")
  if (applyIndex >= 0 && (!args[applyIndex + 1] || !args.includes("--approve-gst-18"))) {
    throw new GstPlanError("Apply requires the reviewed preview file and --approve-gst-18")
  }
  const client = new MongoClient(uri, { maxPoolSize: 1, minPoolSize: 0, serverSelectionTimeoutMS: 8000, socketTimeoutMS: 30000, family: 4 })
  try {
    await client.connect()
    const collection = client.db(database).collection("products")
    let filename, plan
    if (applyIndex < 0) {
      plan = makeGst18Plan(await readRates(collection))
      await fs.mkdir(archive, { recursive: true })
      filename = path.join(archive, `gst-18-preview-${randomUUID()}.json`)
      // Prior values are recorded before any database write; this file is Git-ignored.
      await fs.writeFile(filename, BSON.EJSON.stringify(plan, null, 2, { relaxed: false }), { flag: "wx" })
      console.log(JSON.stringify({ mode: "preview", ...gstPlanSummary(plan), rollbackFile: path.relative(root, filename) }, null, 2))
      if (!applyCurrent) return
    } else {
    filename = path.resolve(root, args[applyIndex + 1])
    if (path.dirname(filename) !== archive || !path.basename(filename).startsWith("gst-18-preview-")) {
      throw new GstPlanError("Use a GST preview file from the private artifact directory")
    }
    plan = BSON.EJSON.parse(await fs.readFile(filename, "utf8"))
    }
    const session = client.startSession()
    let result
    try {
      await session.withTransaction(async () => { result = await applyGst18Plan(collection, plan, session) }, {
        readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary",
      })
    } finally { await session.endSession() }
    const [total, remaining] = await Promise.all([
      collection.countDocuments({}, { maxTimeMS: 8000 }),
      collection.countDocuments({ gstRate: { $ne: 18 } }, { maxTimeMS: 8000 }),
    ])
    console.log(JSON.stringify({ mode: "applied", ...result, totalProducts: total, withoutNumericGst18: remaining, rollbackFile: path.relative(root, filename) }, null, 2))
  } finally { await client.close() }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(JSON.stringify({ error: error instanceof GstPlanError ? error.message : "GST operation failed; no raw database details were logged", type: error.name, code: typeof error.code === "number" ? error.code : undefined }))
    process.exitCode = 1
  })
}
