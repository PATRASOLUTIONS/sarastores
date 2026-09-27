import { connectToDatabase } from "@/lib/mongodb"

/** @deprecated Use lib/db-service.ts. Kept only so existing importers hit the correct database. */
export async function connectDB() {
  try {
    const { db } = await connectToDatabase()
    return db
  } catch (error) {
    console.error("Error connecting to database:", error)
    throw error
  }
}

export async function getCollection(collectionName: string) {
  try {
    const db = await connectDB()
    return db.collection(collectionName)
  } catch (error) {
    console.error(`Error getting collection ${collectionName}:`, error)
    throw error
  }
}
