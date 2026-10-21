import { MongoClient } from "mongodb"

const sourceUri = process.env.SOURCE_MONGODB_URI
const targetUri = process.env.TARGET_MONGODB_URI
const databaseName = process.env.DB_NAME
const apply = process.argv.includes("--apply")

if (!sourceUri || !targetUri || !databaseName) {
  throw new Error("SOURCE_MONGODB_URI, TARGET_MONGODB_URI, and DB_NAME are required")
}
if (sourceUri === targetUri) throw new Error("Source and target MongoDB URIs must differ")

const sourceClient = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 15000 })
const targetClient = new MongoClient(targetUri, { serverSelectionTimeoutMS: 15000 })

const createOptionKeys = [
  "capped", "size", "max", "storageEngine", "validator", "validationLevel",
  "validationAction", "indexOptionDefaults", "viewOn", "pipeline", "collation",
  "writeConcern", "timeseries", "expireAfterSeconds", "clusteredIndex",
  "changeStreamPreAndPostImages",
]

function collectionOptions(options = {}) {
  return Object.fromEntries(createOptionKeys.flatMap(key =>
    options[key] === undefined ? [] : [[key, options[key]]],
  ))
}

async function copyDocuments(sourceCollection, targetCollection) {
  const cursor = sourceCollection.find({}, { noCursorTimeout: true }).batchSize(500)
  let batch = []
  let copied = 0
  for await (const document of cursor) {
    batch.push(document)
    if (batch.length === 500) {
      await targetCollection.insertMany(batch, { ordered: false })
      copied += batch.length
      batch = []
    }
  }
  if (batch.length) {
    await targetCollection.insertMany(batch, { ordered: false })
    copied += batch.length
  }
  return copied
}

async function copyIndexes(sourceCollection, targetCollection) {
  const indexes = await sourceCollection.listIndexes().toArray()
  const specs = indexes
    .filter(index => index.name !== "_id_")
    .map(({ v: _version, ns: _namespace, background: _background, ...index }) => index)
  if (specs.length) await targetCollection.createIndexes(specs)
  return indexes.length
}

try {
  await Promise.all([sourceClient.connect(), targetClient.connect()])
  const sourceDb = sourceClient.db(databaseName)
  const targetDb = targetClient.db(databaseName)
  await Promise.all([
    sourceDb.command({ ping: 1 }),
    targetDb.command({ ping: 1 }),
  ])

  const definitions = (await sourceDb.listCollections().toArray())
    .filter(definition => !definition.name.startsWith("system."))
  const collections = definitions.filter(definition => definition.type !== "view")
  const views = definitions.filter(definition => definition.type === "view")
  const sourceCounts = new Map()
  for (const definition of collections) {
    sourceCounts.set(definition.name, await sourceDb.collection(definition.name).countDocuments())
  }

  const totalDocuments = [...sourceCounts.values()].reduce((sum, count) => sum + count, 0)
  console.log(JSON.stringify({
    mode: apply ? "apply" : "preflight",
    database: databaseName,
    collections: collections.length,
    views: views.length,
    documents: totalDocuments,
  }))

  if (!apply) process.exitCode = 0
  else {
    await targetDb.dropDatabase()

    for (const definition of collections) {
      await targetDb.createCollection(definition.name, collectionOptions(definition.options))
      const copied = await copyDocuments(
        sourceDb.collection(definition.name),
        targetDb.collection(definition.name),
      )
      const indexes = await copyIndexes(
        sourceDb.collection(definition.name),
        targetDb.collection(definition.name),
      )
      console.log(JSON.stringify({ collection: definition.name, copied, indexes }))
    }

    for (const definition of views) {
      await targetDb.createCollection(definition.name, collectionOptions(definition.options))
      console.log(JSON.stringify({ view: definition.name, copied: true }))
    }

    const mismatches = []
    for (const definition of collections) {
      const sourceCount = sourceCounts.get(definition.name)
      const targetCount = await targetDb.collection(definition.name).countDocuments()
      const sourceIndexes = await sourceDb.collection(definition.name).listIndexes().toArray()
      const targetIndexes = await targetDb.collection(definition.name).listIndexes().toArray()
      if (sourceCount !== targetCount || sourceIndexes.length !== targetIndexes.length) {
        mismatches.push({
          collection: definition.name,
          sourceCount,
          targetCount,
          sourceIndexes: sourceIndexes.length,
          targetIndexes: targetIndexes.length,
        })
      }
    }
    if (mismatches.length) {
      console.error(JSON.stringify({ verified: false, mismatches }))
      process.exitCode = 2
    } else {
      console.log(JSON.stringify({
        verified: true,
        collections: collections.length,
        views: views.length,
        documents: totalDocuments,
      }))
    }
  }
} finally {
  await Promise.allSettled([sourceClient.close(), targetClient.close()])
}
