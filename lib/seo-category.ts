import { cache } from "react"
import { COLLECTIONS, getById, getCollection, normalizeId } from "@/lib/db-service"

export const getSeoCategory = cache(async (identifier: string) => {
  identifier = decodeURIComponent(identifier)
  const byId = await getById(COLLECTIONS.CATEGORIES, identifier)
  if (byId) return byId.isEnabled === false ? null : byId
  const collection = await getCollection(COLLECTIONS.CATEGORIES)
  const bySlug = await collection.findOne({ slug: identifier, isEnabled: { $ne: false } })
  if (bySlug) return bySlug.isEnabled === false ? null : normalizeId(bySlug)
  const name = identifier.replace(/-/g, " ")
  const category = await collection.findOne({
    isEnabled: { $ne: false },
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  })
  return category && category.isEnabled !== false ? normalizeId(category) : null
})
