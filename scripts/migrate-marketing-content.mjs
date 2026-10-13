/**
 * Marketing-only PMD -> OTTPLAY migration; dry run unless --apply is supplied.
 * Credentials resolve from SOURCE_MONGODB_URI/TARGET_MONGODB_URI or .env.
 * Never copies settings, catalog, customers, orders or payment records.
 *
 * node scripts/migrate-marketing-content.mjs
 * node scripts/migrate-marketing-content.mjs --apply --expected-plan <hash> --backup-dir <private-directory>
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { pathToFileURL } from "node:url"
import { MongoClient, BSON } from "mongodb"

export const MARKETING_COLLECTIONS = Object.freeze([
  "hero_slides", "hero_images", "split_cards", "animated_banners",
  "advertisements", "product_advertisements", "product_slides",
  "offers", "featured_products", "testimonials", "campaign_pages",
])
const DATABASE = "e-commerce-bytewise"
const stringify = (value) => BSON.EJSON.stringify(value, { relaxed: false })
const digest = (value) => crypto.createHash("sha256").update(stringify(value)).digest("hex")
const idKey = (id) => stringify(id)

export function buildPlan(source, target) {
  return MARKETING_COLLECTIONS.map((name) => {
    const originals = new Map((target[name] || []).map((doc) => [idKey(doc._id), doc]))
    const incoming = source[name] || []
    const incomingIds = new Set(incoming.map((doc) => idKey(doc._id)))
    if (incomingIds.size !== incoming.length) throw new Error(`Duplicate source IDs in ${name}`)
    if (incoming.some((doc) => doc._id === undefined)) throw new Error(`Missing source ID in ${name}`)
    const changes = incoming.filter((doc) => {
      const previous = originals.get(idKey(doc._id))
      return !previous || digest(previous) !== digest(doc)
    })
    return {
      collection: name,
      source: incoming.length,
      targetBefore: originals.size,
      insert: changes.filter((doc) => !originals.has(idKey(doc._id))).length,
      update: changes.filter((doc) => originals.has(idKey(doc._id))).length,
      unchanged: incoming.length - changes.length,
      targetOnlyPreserved: [...originals.keys()].filter((id) => !incomingIds.has(id)).length,
      changes,
    }
  })
}

async function snapshot(db, session) {
  const result = {}
  for (const name of MARKETING_COLLECTIONS) {
    result[name] = await db.collection(name).find({}, { session }).sort({ _id: 1 }).toArray()
  }
  return result
}

function resolveUri(role, expectedCluster) {
  const override = process.env[`${role}_MONGODB_URI`]
  const env = override ? "" : fs.readFileSync(".env", "utf8")
  const candidates = override ? [override] : [...env.matchAll(
    /^\s*#?\s*MONGODB_URI\s*=\s*(mongodb(?:\+srv)?:\/\/\S+)/gm,
  )].map((match) => match[1])
  const matches = [...new Set(candidates.filter((uri) =>
    new URL(uri).hostname.split(".")[0] === expectedCluster,
  ))]
  if (matches.length !== 1) throw new Error(`Cannot uniquely resolve ${role} cluster`)
  return matches[0]
}

async function orderFingerprint(db) {
  const hash = crypto.createHash("sha256")
  let count = 0
  for await (const doc of db.collection("orders").find({}).sort({ _id: 1 })) {
    hash.update(stringify(doc)).update("\n")
    count++
  }
  return { count, hash: hash.digest("hex") }
}

async function verifyReferences(source, target) {
  const relations = {
    productId: "products", productIds: "products",
    categoryId: "categories", categoryIds: "categories",
    brandId: "brands", brandIds: "brands",
    storeId: "store_locations", storeIds: "store_locations",
  }
  const references = []
  function walk(value) {
    if (!value || typeof value !== "object" || value._bsontype) return
    for (const [key, child] of Object.entries(value)) {
      if (relations[key]) {
        for (const id of Array.isArray(child) ? child : [child]) {
          if (id !== null && id !== undefined && id !== "") references.push([relations[key], id])
        }
      } else if (key !== "_id") walk(child)
    }
  }
  Object.values(source).forEach((docs) => docs.forEach(walk))
  for (const [collection, id] of references) {
    const candidates = [id]
    if (typeof id === "string" && BSON.ObjectId.isValid(id)) candidates.push(new BSON.ObjectId(id))
    const exists = await target.collection(collection).findOne(
      { $or: [{ _id: { $in: candidates } }, { id: String(id) }] }, { projection: { _id: 1 } },
    )
    if (!exists) throw new Error(`Missing destination reference in ${collection}`)
  }
  return references.length
}

async function main() {
  const args = process.argv.slice(2)
  const value = (flag) => {
    const index = args.indexOf(flag)
    return index >= 0 ? args[index + 1] : undefined
  }
  const apply = args.includes("--apply")
  const backupDirectory = value("--backup-dir")
  if (apply && (!backupDirectory || !value("--expected-plan"))) {
    throw new Error("Apply requires --backup-dir and --expected-plan from a fresh dry run")
  }
  const sourceClient = new MongoClient(resolveUri("SOURCE", "pmd"), { serverSelectionTimeoutMS: 20000, maxPoolSize: 2 })
  const targetClient = new MongoClient(resolveUri("TARGET", "ottplay"), { serverSelectionTimeoutMS: 20000, maxPoolSize: 2 })
  try {
    await sourceClient.connect()
    await targetClient.connect()
    const sourceDb = sourceClient.db(DATABASE)
    const targetDb = targetClient.db(DATABASE)
    const targetCollections = await targetDb.listCollections({}, { nameOnly: true }).toArray()
    if (!targetCollections.some((item) => item.name === "products") ||
        !targetCollections.some((item) => item.name === "orders")) {
      throw new Error("Target database identity check failed")
    }
    const source = await snapshot(sourceDb)
    const target = await snapshot(targetDb)
    const ordersBefore = await orderFingerprint(targetDb)
    const referenceCount = await verifyReferences(source, targetDb)
    const plan = buildPlan(source, target)
    const planHash = digest({ source, target })
    const summary = {
      mode: apply ? "apply" : "dry-run",
      sourceCluster: "pmd", targetCluster: "ottplay", database: DATABASE,
      planHash, referenceCount,
      collections: plan.map((entry) => ({
        collection: entry.collection, source: entry.source, targetBefore: entry.targetBefore,
        insert: entry.insert, update: entry.update, unchanged: entry.unchanged,
        targetOnlyPreserved: entry.targetOnlyPreserved,
      })),
      ordersBefore: ordersBefore.count,
    }
    console.log(JSON.stringify(summary, null, 2))
    if (!apply) return
    if (value("--expected-plan") !== planHash) throw new Error("Data changed since preview; run a new dry run")

    fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 })
    const backupFile = path.join(backupDirectory, "marketing-before.ejson")
    const backup = stringify({ createdAt: new Date(), database: DATABASE, sourceCluster: "pmd", targetCluster: "ottplay", source, target, planHash })
    fs.writeFileSync(backupFile, backup, { flag: "wx", mode: 0o600 })
    if (fs.readFileSync(backupFile, "utf8") !== backup) throw new Error("Backup round-trip verification failed")

    const session = targetClient.startSession()
    let result
    try {
      await session.withTransaction(async () => {
        const current = await snapshot(targetDb, session)
        if (digest(current) !== digest(target)) throw new Error("Production marketing changed; refusing stale overwrite")
        let inserted = 0
        let updated = 0
        for (const entry of plan) {
          const existing = new Set(target[entry.collection].map((doc) => idKey(doc._id)))
          for (const doc of entry.changes) {
            const collection = targetDb.collection(entry.collection)
            if (existing.has(idKey(doc._id))) {
              const write = await collection.replaceOne({ _id: doc._id }, doc, { session })
              if (write.matchedCount !== 1) throw new Error("Target changed during update")
              updated++
            } else {
              await collection.insertOne(doc, { session })
              inserted++
            }
          }
        }
        const after = await snapshot(targetDb, session)
        for (const name of MARKETING_COLLECTIONS) {
          const actual = new Map(after[name].map((doc) => [idKey(doc._id), doc]))
          const expected = new Map(target[name].map((doc) => [idKey(doc._id), doc]))
          for (const doc of source[name]) expected.set(idKey(doc._id), doc)
          if (actual.size !== expected.size) throw new Error(`Verification count mismatch in ${name}`)
          for (const [id, doc] of expected) {
            if (!actual.has(id) || digest(actual.get(id)) !== digest(doc)) {
              throw new Error(`Verification content mismatch in ${name}`)
            }
          }
        }
        result = { inserted, updated, marketingVerified: true }
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } })
    } finally {
      await session.endSession()
    }
    const ordersAfter = await orderFingerprint(targetDb)
    const ordersUnchanged = ordersAfter.hash === ordersBefore.hash && ordersAfter.count === ordersBefore.count
    const report = { ...summary, ...result, ordersAfter: ordersAfter.count, ordersUnchanged, backupFile }
    fs.writeFileSync(path.join(backupDirectory, "result.json"), JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 })
    console.log(JSON.stringify(report, null, 2))
    if (!ordersUnchanged) throw new Error("Orders changed during the run; investigate concurrent activity. Migration never writes orders.")
  } finally {
    await Promise.all([sourceClient.close(), targetClient.close()])
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    // MongoDB error messages may contain connection details; never print them.
    console.error("Marketing migration failed:", error.name, "code:", error.code ?? "none")
    if (error.constructor === Error) console.error(error.message)
    process.exitCode = 1
  })
}
