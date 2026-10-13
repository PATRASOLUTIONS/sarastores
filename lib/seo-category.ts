import { cache } from "react"
import { COLLECTIONS, getById, getCollection, normalizeId } from "@/lib/db-service"

export const getSeoCategory = cache(async (identifier: string) => {
  identifier = decodeURIComponent(identifier)
  const byId = await getById(COLLECTIONS.CATEGORIES, identifier)
  if (byId) return byId
  const collection = await getCollection(COLLECTIONS.CATEGORIES)
  const bySlug = await collection.findOne({ slug: identifier })
  if (bySlug) return normalizeId(bySlug)
  const name = identifier.replace(/-/g, " ")
  const category = await collection.findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  })
  return category ? normalizeId(category) : null
})
