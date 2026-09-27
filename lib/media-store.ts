import { getCollection, createObjectId } from "@/lib/db-service"
import { MEDIA_SOURCES, type MediaType, isMediaUrl, parseMediaUrl } from "@/lib/media"

export async function readMediaField(type: MediaType, id: string): Promise<string | null> {
  const source = MEDIA_SOURCES[type]
  if (!source) return null

  const collection = await getCollection(source.collection)
  const projection = { [source.field]: 1 }

  // Same lookup chain as getById: ObjectId, then string _id, then an `id` field.
  let doc: Record<string, any> | null = null
  try {
    doc = await collection.findOne({ _id: createObjectId(id) }, { projection })
  } catch {
    doc = null
  }
  if (!doc) doc = await collection.findOne({ _id: id as any }, { projection })
  if (!doc) doc = await collection.findOne({ id }, { projection })

  const value = doc?.[source.field]
  return typeof value === "string" ? value : null
}

/**
 * Turns a media URL back into the stored data URI. Write paths must call this so
 * a client that read a URL and posted it back does not erase the image.
 */
export async function resolveMediaUrl(value: unknown): Promise<unknown> {
  if (!isMediaUrl(value)) return value
  const parsed = parseMediaUrl(value)
  if (!parsed) return value

  const stored = await readMediaField(parsed.type, parsed.id)
  return stored ?? value
}
