/**
 * Copies whole collections from one MongoDB cluster to another, preserving _id.
 *
 * Both URIs are resolved from `.env` (or SOURCE_MONGODB_URI / TARGET_MONGODB_URI)
 * by matching a cluster-host hint — credentials are never hardcoded here.
 * Dry run unless --apply is passed.
 *
 *   node scripts/copy-collections-between-clusters.mjs --from ottplay --to pmd
 *   node scripts/copy-collections-between-clusters.mjs --from ottplay --to pmd --apply
 *
 * Options:
 *   --collections a,b   default: products,product_specifications
 *   --db <name>         default: DB_NAME from .env, else e-commerce-bytewise
 *   --insert-only       never overwrite a document that already exists on the target
 *   --prune             DELETE target documents whose _id is absent from the source (exact mirror)
 */
import fs from "node:fs"
import { MongoClient } from "mongodb"

const argv = process.argv.slice(2)
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback
}
const has = (name) => argv.includes(`--${name}`)

const APPLY = has("apply")
const INSERT_ONLY = has("insert-only")
const PRUNE = has("prune")
const COLLECTIONS = (flag("collections", "products,product_specifications"))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : ""
const envValue = (key) => envText.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, "m"))?.[1].trim()

const DB = flag("db") || process.env.DB_NAME || envValue("DB_NAME") || "e-commerce-bytewise"

// Every MONGODB_URI line in .env, commented or not.
const uris = [...envText.matchAll(/^\s*#?\s*MONGODB_URI\s*=\s*(mongodb(?:\+srv)?:\/\/\S+)/gm)].map((m) => m[1])
const hostOf = (uri) => (uri.match(/@([^/?]+)/) || [, "unknown"])[1]
const clusterOf = (uri) => hostOf(uri).split(".")[0]

function resolve(role, hint, envOverride) {
  if (envOverride) return envOverride
  if (!hint) {
    throw new Error(`Missing --${role}. Pass a cluster-host hint (e.g. --${role} ottplay) or set ${role.toUpperCase()}_MONGODB_URI.`)
  }
  const matches = [...new Set(uris.filter((u) => hostOf(u).toLowerCase().includes(hint.toLowerCase())))]
  if (matches.length !== 1) {
    throw new Error(
      `--${role} "${hint}" matched ${matches.length} MONGODB_URI lines in .env. ` +
        `Available clusters: ${[...new Set(uris.map(clusterOf))].join(", ") || "(none)"}`
    )
  }
  return matches[0]
}

const SOURCE = resolve("from", flag("from"), process.env.SOURCE_MONGODB_URI)
const TARGET = resolve("to", flag("to"), process.env.TARGET_MONGODB_URI)
if (SOURCE === TARGET) throw new Error("Source and target resolve to the same cluster — refusing to run.")

const open = async (uri) => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 })
  await client.connect()
  return { client, db: client.db(DB) }
}

const src = await open(SOURCE)
const dst = await open(TARGET)

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN (no writes) — pass --apply to execute ===")
console.log(`source: ${clusterOf(SOURCE)}   target: ${clusterOf(TARGET)}   db: ${DB}`)
console.log(`mode:   ${INSERT_ONLY ? "insert-only" : "upsert by _id (existing target docs are replaced)"}${PRUNE ? " + PRUNE (deletes target-only docs)" : ""}\n`)

let totalNew = 0
let totalReplaced = 0
let totalDeleted = 0

for (const name of COLLECTIONS) {
  const docs = await src.db.collection(name).find({}).toArray()
  const target = dst.db.collection(name)
  const before = await target.countDocuments()

  const existing = await target.find({}, { projection: { _id: 1, name: 1, title: 1, sku: 1 } }).toArray()
  const existingIds = new Set(existing.map((d) => String(d._id)))
  const sourceIds = new Set(docs.map((d) => String(d._id)))

  const toInsert = docs.filter((d) => !existingIds.has(String(d._id)))
  const toReplace = INSERT_ONLY ? [] : docs.filter((d) => existingIds.has(String(d._id)))
  const orphans = existing.filter((d) => !sourceIds.has(String(d._id)))

  if (orphans.length) {
    console.log(`  ${PRUNE ? (APPLY ? "deleting" : "would delete") : "target-only (kept, pass --prune to remove)"} in ${name}:`)
    for (const o of orphans) console.log(`    ${String(o._id)}  ${o.sku || ""}  ${o.name || o.title || ""}`.trimEnd())
  }

  if (APPLY) {
    const ops = [
      ...toInsert.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
      ...toReplace.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc } })),
    ]
    for (let i = 0; i < ops.length; i += 200) {
      await target.bulkWrite(ops.slice(i, i + 200), { ordered: false })
    }
    if (PRUNE && orphans.length) {
      await target.deleteMany({ _id: { $in: orphans.map((o) => o._id) } })
    }
  }

  totalNew += toInsert.length
  totalReplaced += toReplace.length
  if (PRUNE) totalDeleted += orphans.length
  console.log(
    `${name.padEnd(24)} source=${String(docs.length).padStart(5)}  target_before=${String(before).padStart(5)}  ` +
      `${APPLY ? "inserted" : "would insert"}=${String(toInsert.length).padStart(5)}  ` +
      `${APPLY ? "replaced" : "would replace"}=${String(toReplace.length).padStart(5)}  ` +
      `${PRUNE ? (APPLY ? "deleted" : "would delete") : "target_only"}=${String(orphans.length).padStart(3)}`
  )
}

console.log(
  `\n${APPLY ? "inserted" : "would insert"} ${totalNew}, ${APPLY ? "replaced" : "would replace"} ${totalReplaced}` +
    (PRUNE ? `, ${APPLY ? "deleted" : "would delete"} ${totalDeleted}` : "")
)

if (APPLY) {
  console.log("\n--- verification (target) ---")
  for (const name of COLLECTIONS) {
    console.log(`  ${name.padEnd(24)} ${await dst.db.collection(name).countDocuments()} documents`)
  }
}

await src.client.close()
await dst.client.close()
