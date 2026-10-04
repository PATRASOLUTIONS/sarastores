// Admin Settings helpers
export async function getSettingsData() {
  const collection = await getCollection("settings")

  // The image fields are ~900 KB of base64. They are replaced by their media URL
  // in MongoDB so the root layout never transfers them on every render.
  const docs = await collection
    .aggregate([
      { $limit: 1 },
      {
        $addFields: {
          brandLogoIsData: { $eq: [{ $substrCP: [{ $ifNull: ["$brandLogo", ""] }, 0, 5] }, "data:"] },
          brandLogoLen: { $strLenCP: { $ifNull: ["$brandLogo", ""] } },
          signatureIsData: { $eq: [{ $substrCP: [{ $ifNull: ["$signature", ""] }, 0, 5] }, "data:"] },
          signatureLen: { $strLenCP: { $ifNull: ["$signature", ""] } },
        },
      },
      { $addFields: { brandLogo: { $cond: ["$brandLogoIsData", null, "$brandLogo"] } } },
      { $addFields: { signature: { $cond: ["$signatureIsData", null, "$signature"] } } },
    ])
    .toArray()

  const settings = docs[0]
  if (!settings) return null

  const id = settings._id?.toString?.() || settings.id
  const { brandLogoIsData, brandLogoLen, signatureIsData, signatureLen, ...rest } = settings

  return {
    ...rest,
    brandLogo: brandLogoIsData ? `/api/media/brand-logo/${id}?v=${brandLogoLen}` : settings.brandLogo,
    signature: signatureIsData ? `/api/media/signature/${id}?v=${signatureLen}` : settings.signature,
  }
}

export async function setSettingsData(data: any) {
  const collection = await getCollection("settings")
  const payload = { ...data }

  // A client that read a media URL must not overwrite the stored image with it.
  for (const field of ["brandLogo", "signature"]) {
    if (isMediaUrl(payload[field])) delete payload[field]
  }

  // Upsert: update if exists, otherwise insert
  await collection.updateOne({}, { $set: { ...payload, updatedAt: new Date() } }, { upsert: true })
  return getSettingsData()
}
// Footer data helpers
export async function getFooterData() {
  return await findOne("footer", {})
}

export async function setFooterData(data: any) {
  const collection = await getCollection("footer")
  // Upsert: update if exists, otherwise insert
  await collection.updateOne({}, { $set: { ...data, updatedAt: new Date() } }, { upsert: true })
  return getFooterData()
}
import { connectToDatabase } from "./mongodb"
import { isMediaUrl } from "./media"
import { type Collection, type Document, ObjectId } from "mongodb"

// Collection names constant
export const COLLECTIONS = {
  PRODUCTS: "products",
  USERS: "users",
  CONSENT_RECORDS: "consent_records",
  ORDERS: "orders",
  CATEGORIES: "categories",
  SUB_CATEGORIES: "sub_categories",
  REVIEWS: "reviews",
  ADVERTISEMENTS: "advertisements",
  HERO_SLIDES: "hero_slides",
  TESTIMONIALS: "testimonials",
  OFFERS: "offers",
  SPLIT_CARDS: "split_cards",
  ANIMATED_BANNERS: "animated_banners",
  CART: "cart",
  WISHLIST: "wishlist",
  COUPONS: "coupons",
  SLIDES: "product_slides",
} as const

export async function getCollection<TSchema extends Document = Document>(
  collectionName: string
): Promise<Collection<TSchema>> {
  try {
    const { db } = await connectToDatabase()
    return db.collection<TSchema>(collectionName)
  } catch (error) {
    console.error(`Error getting collection ${collectionName}:`, error)
    throw error
  }
}

export function normalizeId(doc: any): any {
  if (!doc) return doc

  if (Array.isArray(doc)) {
    return doc.map((item) => normalizeId(item))
  }

  if (doc._id) {
    const { _id, ...rest } = doc
    // Ensure any existing 'id' field from the document does not override
    // the normalized id derived from MongoDB's _id. Place normalized
    // `id` last so it has final precedence in the returned object.
    if (rest && Object.prototype.hasOwnProperty.call(rest, 'id')) {
      delete rest.id
    }
    return {
      ...rest,
      id: _id.toString(),
    }
  }

  return doc
}

export function createObjectId(id?: string): ObjectId {
  return id ? new ObjectId(id) : new ObjectId()
}

// Generic CRUD operations with better error handling
export async function getAll(collectionName: string, filter: any = {}, options: any = {}) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Fetching all documents from ${collectionName} with filter:`, filter, 'options:', options)
    const collection = await getCollection(collectionName)
    
    // Build query with limit if provided
    let query = collection.find(filter)
    if (options.projection) {
      query = query.project(options.projection)
    }
    if (options.skip && options.skip > 0) {
      query = query.skip(options.skip)
    }
    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit)
    }
    
    const documents = await query.toArray()
    if (process.env.NODE_ENV === "development") console.log(`Found ${documents.length} documents in ${collectionName}`)
    return normalizeId(documents)
  } catch (error) {
    console.error(`Error getting all from ${collectionName}:`, error)
    // Return empty array instead of throwing to prevent UI crashes
    return []
  }
}

export async function getById(collectionName: string, id: string) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Fetching document by id ${id} from ${collectionName}`)
    const collection = await getCollection(collectionName)
    let document: any = null

    // Try ObjectId lookup first (most common case)
    try {
      const objId = createObjectId(id)
      document = await collection.findOne({ _id: objId })
    } catch (e) {
      // createObjectId may throw for non-ObjectId strings — ignore and try fallbacks
      document = null
    }

    // Fallbacks: some documents may store string _id or an `id` field
    if (!document) {
      try {
        // TypeScript expects _id to be an ObjectId; cast to any to allow string lookups
        document = await collection.findOne({ _id: id as any })
      } catch (e) {
        // ignore
      }
    }

    if (!document) {
      try {
        document = await collection.findOne({ id })
      } catch (e) {
        // ignore
      }
    }

    if (process.env.NODE_ENV === "development") console.log(`Document found:`, document ? "Yes" : "No")
    return normalizeId(document)
  } catch (error) {
    console.error(`Error getting document by id from ${collectionName}:`, error)
    return null
  }
}

export async function create(collectionName: string, data: any) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Creating new document in ${collectionName}:`, data)
    const collection = await getCollection(collectionName)
    const result = await collection.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const document = await collection.findOne({ _id: result.insertedId })
    if (process.env.NODE_ENV === "development") console.log(`Document created successfully with id: ${result.insertedId}`)
    return normalizeId(document)
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error)
    throw error
  }
}

export async function update(collectionName: string, id: string, data: any) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Updating document ${id} in ${collectionName}:`, data)
    const collection = await getCollection(collectionName)
    const { id: _, ...updateData } = data

    const result = await collection.updateOne(
      { _id: createObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      throw new Error("Document not found")
    }

    const document = await collection.findOne({ _id: createObjectId(id) })
    if (process.env.NODE_ENV === "development") console.log(`Document updated successfully`)
    return normalizeId(document)
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error)
    throw error
  }
}

export async function remove(collectionName: string, id: string) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Removing document ${id} from ${collectionName}`)
    const collection = await getCollection(collectionName)
    const result = await collection.deleteOne({ _id: createObjectId(id) })

    if (result.deletedCount === 0) {
      throw new Error("Document not found")
    }

    if (process.env.NODE_ENV === "development") console.log(`Document removed successfully`)
    return { success: true, deletedCount: result.deletedCount }
  } catch (error) {
    console.error(`Error removing document from ${collectionName}:`, error)
    throw error
  }
}

export const deleteById = remove

export async function migrateFromLocalStorage(collectionName: string, localStorageKey: string) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Migration from localStorage not applicable on server side for ${collectionName}`)
    return { success: true, message: "Migration not applicable on server side" }
  } catch (error) {
    console.error(`Error migrating from localStorage for ${collectionName}:`, error)
    throw error
  }
}

// Additional utility functions
export async function findOne(collectionName: string, filter: any) {
  try {
    const collection = await getCollection(collectionName)
    const document = await collection.findOne(filter)
    return normalizeId(document)
  } catch (error) {
    console.error(`Error finding document in ${collectionName}:`, error)
    return null
  }
}

export async function findMany(collectionName: string, filter: any = {}, options: any = {}) {
  try {
    const collection = await getCollection(collectionName)
    const documents = await collection.find(filter, options).toArray()
    return normalizeId(documents)
  } catch (error) {
    console.error(`Error finding documents in ${collectionName}:`, error)
    return []
  }
}

export async function count(collectionName: string, filter: any = {}) {
  try {
    const collection = await getCollection(collectionName)
    return await collection.countDocuments(filter)
  } catch (error) {
    console.error(`Error counting documents in ${collectionName}:`, error)
    return 0
  }
}

export async function aggregate(collectionName: string, pipeline: any[]) {
  try {
    const collection = await getCollection(collectionName)
    const result = await collection.aggregate(pipeline).toArray()
    return normalizeId(result)
  } catch (error) {
    console.error(`Error aggregating documents in ${collectionName}:`, error)
    return []
  }
}

// Bulk operations - MISSING EXPORTS ADDED HERE
export async function insertMany(collectionName: string, documents: any[]) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Inserting ${documents.length} documents into ${collectionName}`)
    const collection = await getCollection(collectionName)
    const documentsWithTimestamps = documents.map((doc) => ({
      ...doc,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const result = await collection.insertMany(documentsWithTimestamps)
    if (process.env.NODE_ENV === "development") console.log(`Successfully inserted ${result.insertedCount} documents`)
    return {
      success: true,
      insertedCount: result.insertedCount,
      insertedIds: Object.values(result.insertedIds).map((id) => id.toString()),
    }
  } catch (error) {
    console.error(`Error inserting many documents in ${collectionName}:`, error)
    throw error
  }
}

export async function updateMany(collectionName: string, filter: any, update: any) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Updating multiple documents in ${collectionName}`)
    const collection = await getCollection(collectionName)
    const result = await collection.updateMany(filter, {
      $set: {
        ...update,
        updatedAt: new Date(),
      },
    })

    if (process.env.NODE_ENV === "development") console.log(`Updated ${result.modifiedCount} documents`)
    return {
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    }
  } catch (error) {
    console.error(`Error updating many documents in ${collectionName}:`, error)
    throw error
  }
}

export async function deleteMany(collectionName: string, filter: any) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Deleting multiple documents from ${collectionName} with filter:`, filter)
    const collection = await getCollection(collectionName)
    const result = await collection.deleteMany(filter)

    if (process.env.NODE_ENV === "development") console.log(`Successfully deleted ${result.deletedCount} documents`)
    return {
      success: true,
      deletedCount: result.deletedCount,
    }
  } catch (error) {
    console.error(`Error deleting many documents in ${collectionName}:`, error)
    throw error
  }
}

// Additional utility functions for better database management
export async function dropCollection(collectionName: string) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Dropping collection ${collectionName}`)
    const collection = await getCollection(collectionName)
    await collection.drop()
    if (process.env.NODE_ENV === "development") console.log(`Collection ${collectionName} dropped successfully`)
    return { success: true, message: `Collection ${collectionName} dropped` }
  } catch (error) {
    console.error(`Error dropping collection ${collectionName}:`, error)
    throw error
  }
}

export async function createIndex(collectionName: string, indexSpec: any, options: any = {}) {
  try {
    if (process.env.NODE_ENV === "development") console.log(`Creating index on ${collectionName}:`, indexSpec)
    const collection = await getCollection(collectionName)
    const result = await collection.createIndex(indexSpec, options)
    if (process.env.NODE_ENV === "development") console.log(`Index created successfully: ${result}`)
    return { success: true, indexName: result }
  } catch (error) {
    console.error(`Error creating index on ${collectionName}:`, error)
    throw error
  }
}

export async function listIndexes(collectionName: string) {
  try {
    const collection = await getCollection(collectionName)
    const indexes = await collection.listIndexes().toArray()
    return indexes
  } catch (error) {
    console.error(`Error listing indexes for ${collectionName}:`, error)
    return []
  }
}
