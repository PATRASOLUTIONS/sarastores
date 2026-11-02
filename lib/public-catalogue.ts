import { type Document, type ObjectId } from "mongodb"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { groupAdminProductNames } from "@/lib/admin-product-name-groups"
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility"

interface NameRecord extends Document {
  _id: ObjectId | string
  id?: string
  name?: string
  stock?: unknown
  updatedAt?: Date | string
  raw?: Record<string, unknown>
}

/** Read only: choose among all eligible products before filters, limits and counts. */
export async function getPublicCatalogueSelection() {
  const collection = await getCollection<NameRecord>(COLLECTIONS.PRODUCTS)
  const records = await collection.find(PUBLIC_PRODUCT_FILTER, {
    projection: { name: 1, id: 1, stock: 1, updatedAt: 1, "raw.Name": 1, "raw.Item Description": 1 },
    maxTimeMS: 8000,
  }).sort({ _id: 1 }).limit(20001).toArray()
  if (records.length > 20000) throw new Error("Public catalogue exceeds the name-selection limit")
  const groups = groupAdminProductNames(records.map(record => ({
    ...record, id: String(record._id),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt,
  })))
  const ids: (ObjectId | string)[] = []
  const storedIds = new Map(records.map(record => [String(record._id), record.id]))
  const representativeIds = new Map<string, ObjectId | string>()
  for (const group of groups.values()) {
    const winner = group[0]._id
    ids.push(winner)
    for (const record of group) {
      representativeIds.set(String(record._id), winner)
      const stored = storedIds.get(String(record._id))
      if (stored) representativeIds.set(stored, winner)
    }
  }
  return { ids, representativeIds }
}

export async function publicCatalogueFilter(filter: Document = {}): Promise<Document> {
  const { ids } = await getPublicCatalogueSelection()
  return { $and: [PUBLIC_PRODUCT_FILTER, { _id: { $in: ids } }, filter] }
}
