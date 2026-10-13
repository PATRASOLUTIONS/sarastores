import { cache } from "react"
import { getCollection } from "@/lib/db-service"

export const getSeoBrand = cache(async (identifier: string) => {
  const collection = await getCollection("brands")
  return collection.findOne({
    slug: decodeURIComponent(identifier), enabled: { $ne: false }, isEnabled: { $ne: false },
    active: { $ne: false }, landingPageEnabled: { $ne: false },
  })
})
