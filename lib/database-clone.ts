import { BSON, MongoClient, type Db, type Document, type CreateCollectionOptions, type IndexDescription } from "mongodb"
import { createHash, randomUUID } from "node:crypto"
import {
  CLONE_CONTROL, CLONE_OWNER, CLONE_SOURCE_DB, CLONE_TARGET_DB, CLONE_SOURCE_HOST, CLONE_TARGET_HOST,
  CloneSafetyError, assertCloneRoles, cloneConfiguration, cloneFingerprint, signCloneApproval, verifyCloneApproval,
} from "@/lib/database-clone-policy"

type Phase = "create" | "copy" | "indexes" | "verify" | "complete"
interface CollectionPlan {
  name: string; count: number; options: Document; indexes: Document[]
  copied: number; verified: number; digest: string; verificationDigest: string
  cursor?: string; verificationCursor?: string; phase: Phase
}
interface Manifest {
  _id: string; owner: string; fingerprint: string; runId: string; createdBy: string
  status: "running" | "failed" | "verified"; collections: CollectionPlan[]
  createdAt: Date; updatedAt: Date; completedAt?: Date; error?: string
  lease?: string; leaseUntil?: Date
}
const EMPTY_DIGEST = createHash("sha256").update("sara-clone-v1").digest("hex")
const READ_OPTIONS = { promoteValues: false, promoteLongs: false, bsonRegExp: true }
const OWNER_ID = "manifest"

export async function withCloneConnections<T>(operation: (source: Db, target: Db) => Promise<T>, sourceRequired = true): Promise<T> {
  const config = cloneConfiguration()
  const options = { maxPoolSize: 2, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 12000, retryWrites: true }
  const sourceClient = new MongoClient(config.sourceUri, options)
  const targetClient = new MongoClient(config.targetUri, options)
  try {
    if (sourceRequired) await sourceClient.connect()
    await targetClient.connect()
    if (sourceRequired) {
      const auth = await sourceClient.db("admin").command({ connectionStatus: 1 })
      assertCloneRoles(auth.authInfo?.authenticatedUserRoles || [], "source")
    }
    const auth = await targetClient.db("admin").command({ connectionStatus: 1 })
    assertCloneRoles(auth.authInfo?.authenticatedUserRoles || [], "target")
    return await operation(sourceClient.db(CLONE_SOURCE_DB), targetClient.db(CLONE_TARGET_DB))
  } catch (error) {
    if (error instanceof CloneSafetyError) throw error
    // Never log raw Mongo errors: they may contain connection details or copied records.
    throw new CloneSafetyError("Clone database access failed. Check dedicated permissions, network access, and cluster capacity; no production writes were attempted", 503)
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()])
  }
}

export function chainDocument(digest: string, document: Document) {
  return createHash("sha256").update(digest).update(BSON.serialize(document)).digest("hex")
}
const serialize = (value: unknown) => BSON.EJSON.stringify(value, { relaxed: false })
const parseCursor = (value: string) => BSON.EJSON.parse(value, { relaxed: false })
const afterCursor = (cursor?: string): Document => cursor
  ? { $expr: { $gt: ["$_id", { $literal: parseCursor(cursor) }] } } : {}

function assertManifest(manifest: Manifest | null): asserts manifest is Manifest {
  if (!manifest || manifest.owner !== CLONE_OWNER || manifest.fingerprint !== cloneFingerprint()) {
    throw new CloneSafetyError("The destination is not an owned Sara clone. Nothing will be overwritten")
  }
}

export function publicCloneState(manifest: Manifest) {
  return {
    runId: manifest.runId, status: manifest.status, createdAt: manifest.createdAt.toISOString(),
    updatedAt: manifest.updatedAt.toISOString(), completedAt: manifest.completedAt?.toISOString(), error: manifest.error,
    collections: manifest.collections.map(({ name, count, copied, verified, phase }) => ({ name, count, copied, verified, phase })),
    total: manifest.collections.reduce((sum, item) => sum + item.count, 0),
    copied: manifest.collections.reduce((sum, item) => sum + item.copied, 0),
    verified: manifest.collections.reduce((sum, item) => sum + item.verified, 0),
    consistency: "Live logical copy; not a point-in-time snapshot", schedule: "Manual only",
  }
}
export type CloneState = ReturnType<typeof publicCloneState>

export async function cloneStatus() {
  let writesEnabled = false
  try { writesEnabled = cloneConfiguration().writesEnabled } catch (error) {
    return { configured: false, writesEnabled, message: error instanceof CloneSafetyError ? error.message : "Clone is not configured", state: null as CloneState | null }
  }
  return withCloneConnections(async (_source, target) => {
    const names = await target.listCollections({}, { nameOnly: true }).toArray()
    if (!names.length) return { configured: true, writesEnabled, message: "Destination is empty. Preview before approving a clone.", state: null }
    const manifest = await target.collection<Manifest>(CLONE_CONTROL).findOne({ _id: OWNER_ID })
    assertManifest(manifest)
    return { configured: true, writesEnabled, message: "An existing clone will never be replaced automatically.", state: publicCloneState(manifest) }
  }, false)
}

export function validateCollectionPlan(collection: Document, indexes: Document[]) {
  if (collection.type !== "collection" || collection.name.startsWith("system.") || collection.name === CLONE_CONTROL ||
      collection.options?.timeseries || collection.options?.capped || collection.options?.encryptedFields ||
      collection.options?.clusteredIndex) {
    throw new CloneSafetyError(`Collection ${collection.name} needs a separate supported restore plan; cloning is blocked`)
  }
  const allowed = new Set(["validator", "validationLevel", "validationAction", "collation"])
  if (Object.keys(collection.options || {}).some(key => !allowed.has(key))) {
    throw new CloneSafetyError(`Collection ${collection.name} has unsupported collection options; cloning is blocked`)
  }
  if (indexes.some(index => index.key?._fts)) {
    throw new CloneSafetyError(`Collection ${collection.name} has a text index that needs a supported dump/restore plan; cloning is blocked`)
  }
  if (indexes.some(index => index.prepareUnique || index.buildUUID)) {
    throw new CloneSafetyError(`Collection ${collection.name} has an index transition in progress; create a new preview later`)
  }
}

async function inspectClone(source: Db, target: Db) {
  const started = Date.now()
  const existing = await target.listCollections({}, { nameOnly: true }).toArray()
  if (existing.length) throw new CloneSafetyError("sara_clone already contains collections. Existing data will not be overwritten; use the status/resume controls for an owned incomplete clone")
  const entries = await source.listCollections({}, { nameOnly: false }).toArray()
  if (!entries.length) throw new CloneSafetyError("The source database has no collections; cloning is blocked")
  if (entries.length > 250) throw new CloneSafetyError("This database exceeds the manual clone collection limit; use an operator-reviewed dump/restore")
  const collections: CollectionPlan[] = []
  // Deliberately sequential: keep production load low.
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (Date.now() - started > 40_000) throw new CloneSafetyError("Preview exceeded the safe request budget. Use an operator-reviewed dump/restore for this database", 503)
    const collection = source.collection(entry.name)
    const indexes = await collection.listIndexes().toArray()
    validateCollectionPlan(entry, indexes)
    const count = await collection.countDocuments({}, { maxTimeMS: 8000 })
    collections.push({ name: entry.name, count, options: entry.options || {}, indexes,
      copied: 0, verified: 0, digest: EMPTY_DIGEST, verificationDigest: EMPTY_DIGEST, phase: "create" })
  }
  if (Buffer.byteLength(serialize(collections)) > 2 * 1024 * 1024) throw new CloneSafetyError("Collection metadata is too large for the manual clone; use an operator-reviewed dump/restore")
  const stats = await source.command({ dbStats: 1, scale: 1 })
  const estimate = {
    dataBytes: Number(stats.dataSize || 0), storageBytes: Number(stats.storageSize || 0), indexBytes: Number(stats.indexSize || 0),
    requiredDestinationBytes: Math.ceil((Number(stats.storageSize || 0) + Number(stats.indexSize || 0)) * 1.3),
  }
  const planHash = createHash("sha256").update(cloneFingerprint()).update(serialize(collections)).digest("hex")
  return { collections, planHash, estimate }
}

export async function previewClone(userId: string) {
  const config = cloneConfiguration()
  return withCloneConnections(async (source, target) => {
    const plan = await inspectClone(source, target)
    return {
      source: { host: CLONE_SOURCE_HOST, database: CLONE_SOURCE_DB }, target: { host: CLONE_TARGET_HOST, database: CLONE_TARGET_DB },
      collections: plan.collections.map(item => ({ name: item.name, count: item.count, indexes: item.indexes.length })),
      estimate: plan.estimate, documents: plan.collections.reduce((sum, item) => sum + item.count, 0),
      approvalToken: signCloneApproval(plan.planHash, userId, config.secret), writesEnabled: config.writesEnabled,
      warnings: [
        "A live logical copy is not a single point-in-time snapshot while production is changing.",
        "TTL expiration is disabled on copied indexes; original index definitions are saved in the clone manifest.",
        "Database size is an estimate, not a billing quote. Verify destination free space in Atlas before approving.",
        "Only data and supported collection/index settings are copied; Atlas users, cluster settings, and provider backups are excluded.",
        "Closing this page pauses progress after the current request. Resume manually; there is no scheduler or background worker.",
      ],
    }
  })
}
export type ClonePreview = Awaited<ReturnType<typeof previewClone>>

export async function startClone(userId: string, approvalToken: string) {
  const config = cloneConfiguration()
  if (!config.writesEnabled) throw new CloneSafetyError("Clone writes are disabled. Review the preview before enabling DATABASE_CLONE_WRITES_ENABLED", 403)
  const approvedHash = verifyCloneApproval(approvalToken, userId, config.secret)
  return withCloneConnections(async (source, target) => {
    const plan = await inspectClone(source, target)
    if (plan.planHash !== approvedHash) throw new CloneSafetyError("The source inventory changed since the preview. Create a new preview before approving")
    // Namespace creation is exclusive: concurrent starts cannot claim/overwrite the same destination.
    await target.createCollection(CLONE_CONTROL)
    const now = new Date()
    const manifest: Manifest = { _id: OWNER_ID, owner: CLONE_OWNER, fingerprint: cloneFingerprint(),
      runId: randomUUID(), createdBy: userId, status: "running", collections: plan.collections, createdAt: now, updatedAt: now }
    await target.collection<Manifest>(CLONE_CONTROL).insertOne(manifest, { writeConcern: { w: "majority" } })
    return publicCloneState(manifest)
  })
}

async function readBatch(db: Db, name: string, cursor?: string) {
  const started = Date.now()
  const documents: Document[] = []
  let bytes = 0
  const query = db.collection(name).find(afterCursor(cursor), { ...READ_OPTIONS, maxTimeMS: 8000 }).sort({ _id: 1 }).batchSize(1).limit(50)
  try {
    for await (const document of query) {
      documents.push(document)
      bytes += BSON.calculateObjectSize(document)
      if (bytes >= 4 * 1024 * 1024 || Date.now() - started > 4000) break
    }
  } finally { await query.close() }
  return documents
}

async function workCollection(source: Db, target: Db, plan: CollectionPlan) {
  if (plan.phase === "create") {
    const existing = await target.listCollections({ name: plan.name }, { nameOnly: false }).toArray()
    if (existing.length) {
      if (await target.collection(plan.name).countDocuments({}) !== 0 ||
          serialize(existing[0].options || {}) !== serialize(plan.options)) {
        throw new CloneSafetyError(`Unexpected destination collection ${plan.name}; resume refused`)
      }
    } else await target.createCollection(plan.name, plan.options as CreateCollectionOptions)
    plan.phase = "copy"
  } else if (plan.phase === "copy") {
    const documents = await readBatch(source, plan.name, plan.cursor)
    if (documents.length) {
      await target.collection(plan.name).bulkWrite(documents.map(document => ({
        replaceOne: { filter: { _id: { $eq: document._id } }, replacement: document, upsert: true },
      })), { ordered: true, writeConcern: { w: "majority" } })
      for (const document of documents) plan.digest = chainDocument(plan.digest, document)
      plan.copied += documents.length
      plan.cursor = serialize(documents[documents.length - 1]._id)
    } else {
      if (plan.copied !== plan.count) throw new CloneSafetyError(`Collection ${plan.name} changed during copying. Verification refused; production is untouched`)
      plan.phase = "indexes"
    }
  } else if (plan.phase === "indexes") {
    const indexes = plan.indexes.filter(index => index.name !== "_id_").map(index => {
      const copy = { ...index }
      // Preserve the original TTL definition in the manifest, but prevent clone expiration.
      delete copy.v; delete copy.ns; delete copy.expireAfterSeconds
      return copy as IndexDescription
    })
    if (indexes.length) await target.collection(plan.name).createIndexes(indexes, { maxTimeMS: 8000 })
    plan.phase = "verify"
  } else if (plan.phase === "verify") {
    const documents = await readBatch(target, plan.name, plan.verificationCursor)
    if (documents.length) {
      for (const document of documents) plan.verificationDigest = chainDocument(plan.verificationDigest, document)
      plan.verified += documents.length
      plan.verificationCursor = serialize(documents[documents.length - 1]._id)
    } else {
      if (plan.verified !== plan.copied || plan.digest !== plan.verificationDigest) {
        throw new CloneSafetyError(`Content verification failed for ${plan.name}; the clone is not ready`)
      }
      const actual = await target.collection(plan.name).listIndexes().toArray()
      const metadata = await target.listCollections({ name: plan.name }, { nameOnly: false }).toArray()
      if (!metadata.length || serialize(metadata[0].options || {}) !== serialize(plan.options) || actual.length !== plan.indexes.length) {
        throw new CloneSafetyError(`Collection settings or index counts differ for ${plan.name}; verification refused`)
      }
      for (const original of plan.indexes) {
        const copied = actual.find(index => index.name === original.name)
        if (!copied || serialize(copied.key) !== serialize(original.key)) {
          throw new CloneSafetyError(`Index verification failed for ${plan.name}; the clone is not ready`)
        }
        for (const field of ["unique", "sparse", "partialFilterExpression", "collation", "hidden", "wildcardProjection", "weights", "default_language", "language_override", "textIndexVersion", "2dsphereIndexVersion"]) {
          if (serialize(copied[field] ?? null) !== serialize(original[field] ?? null)) throw new CloneSafetyError(`Index options differ for ${plan.name}; verification refused`)
        }
      }
      plan.phase = "complete"
    }
  }
}

export async function advanceClone(runId: string) {
  if (!cloneConfiguration().writesEnabled) throw new CloneSafetyError("Clone writes are disabled", 403)
  return withCloneConnections(async (source, target) => {
    const controls = target.collection<Manifest>(CLONE_CONTROL)
    const current = await controls.findOne({ _id: OWNER_ID })
    assertManifest(current)
    if (current.runId !== runId) throw new CloneSafetyError("This request does not belong to the existing clone")
    if (current.status !== "running") return publicCloneState(current)
    const lease = randomUUID()
    // Longer than the API's hard 60-second duration: a timed-out request cannot overlap a resumed one.
    const manifest = await controls.findOneAndUpdate({ _id: OWNER_ID, runId, status: "running",
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: new Date() } }] },
    { $set: { lease, leaseUntil: new Date(Date.now() + 120_000) } }, { returnDocument: "after" })
    if (!manifest) throw new CloneSafetyError("Another clone request is active. Wait before resuming", 423)
    try {
      const names = await target.listCollections({}, { nameOnly: true }).toArray()
      if (names.some(item => item.name !== CLONE_CONTROL && !manifest.collections.some(plan => plan.name === item.name))) {
        throw new CloneSafetyError("The clone contains an unexpected collection; progress stopped")
      }
      const next = manifest.collections.find(plan => plan.phase !== "complete")
      if (next) await workCollection(source, target, next)
      const finished = manifest.collections.every(plan => plan.phase === "complete")
      const now = new Date()
      const result = await controls.updateOne({ _id: OWNER_ID, runId, lease }, {
        $set: { collections: manifest.collections, updatedAt: now, status: finished ? "verified" : "running",
          ...(finished ? { completedAt: now } : {}) }, $unset: { lease: "", leaseUntil: "", error: "" },
      }, { writeConcern: { w: "majority" } })
      if (!result.matchedCount) throw new CloneSafetyError("Clone checkpoint lease was lost; progress stopped")
      return publicCloneState({ ...manifest, status: finished ? "verified" : "running", updatedAt: now, ...(finished ? { completedAt: now } : {}) })
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined
      const safeError = code === 121 ? new CloneSafetyError("Source records failed destination document validation. No validation bypass is used; a separately reviewed restore plan is required")
        : code === 11000 || code === 85 || code === 86 ? new CloneSafetyError("Destination data or indexes conflict with the source definitions. Verification stopped; review an isolated restore plan") : error
      const permanent = safeError instanceof CloneSafetyError && safeError.status !== 423
      await controls.updateOne({ _id: OWNER_ID, runId, lease }, {
        $set: { updatedAt: new Date(), ...(permanent ? { status: "failed", error: safeError.message } : { error: "The batch was interrupted. Resume manually after checking connectivity and capacity." }) },
        $unset: { lease: "", leaseUntil: "" },
      })
      throw safeError
    }
  })
}

/** No source client is opened; audits only read a verified destination clone. */
export async function withVerifiedClone<T>(operation: (target: Db, state: CloneState) => Promise<T>) {
  return withCloneConnections(async (_source, target) => {
    const manifest = await target.collection<Manifest>(CLONE_CONTROL).findOne({ _id: OWNER_ID })
    assertManifest(manifest)
    if (manifest.status !== "verified" || !manifest.collections.every(plan => plan.phase === "complete")) {
      throw new CloneSafetyError("Create and verify the manual clone before scanning catalogue quality")
    }
    return operation(target, publicCloneState(manifest))
  }, false)
}
