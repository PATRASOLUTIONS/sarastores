/**
 * Explicit build-only, in-memory MongoDB fixture. Use with NODE_OPTIONS=--import.
 * Not imported by application code or normal builds; tests/ is excluded from deployment.
 * All reads are empty and every write throws. No MongoDB network connection is made.
 */
import { MongoClient } from "mongodb"
const cursor = () => ({
  sort() { return this }, limit() { return this }, skip() { return this }, project() { return this },
  batchSize() { return this }, toArray: async () => [], next: async () => null,
  close: async () => {}, async *[Symbol.asyncIterator]() {},
})
const forbidden = () => { throw new Error("Database write prohibited in isolated build fixture") }
const collection = () => ({
  find: cursor, aggregate: cursor, listIndexes: cursor, findOne: async () => null,
  countDocuments: async () => 0, estimatedDocumentCount: async () => 0, distinct: async () => [],
  insertOne: forbidden, insertMany: forbidden, updateOne: forbidden, updateMany: forbidden,
  findOneAndUpdate: forbidden, deleteOne: forbidden, deleteMany: forbidden, drop: forbidden,
  createIndex: forbidden, createIndexes: forbidden, bulkWrite: forbidden,
})
MongoClient.prototype.connect = async function () { return this }
MongoClient.prototype.close = async function () {}
MongoClient.prototype.db = function (name) {
  return { databaseName: name, collection, listCollections: cursor, aggregate: cursor,
    command: async () => ({}), createCollection: forbidden, dropDatabase: forbidden }
}
