import sharp from "sharp"
import { Binary } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { ImageIngestError, sniffImage } from "@/lib/media-ingest"
import { contentId } from "@/lib/storage"

export const BANNER_IMAGES_COLLECTION = "banner_images"
export const MAX_BANNER_UPLOAD_BYTES = 10 * 1024 * 1024
// Wide enough for a 1920px hero on high-density screens, and keeps every
// document far below MongoDB's 16 MB limit.
const MAX_STORED_WIDTH = 2560

export interface BannerImageDocument {
  _id: string
  data: Binary
  contentType: string
  width: number
  height: number
  bytes: number
  createdAt: Date
}

export function bannerImageUrl(id: string): string {
  return `/api/banner-images/${id}`
}

/** Converts an uploaded image to WebP and stores it in MongoDB, keyed by content hash. */
export async function storeBannerImage(input: Uint8Array): Promise<{ id: string; url: string; width: number; height: number }> {
  if (!sniffImage(input)) throw new ImageIngestError("Not a supported image (JPEG, PNG, WebP or GIF)")

  const pipeline = sharp(Buffer.from(input), { limitInputPixels: 50_000_000 })
  const meta = await pipeline.metadata().catch(() => null)
  if (!meta?.width || !meta?.height) throw new ImageIngestError("Image could not be decoded")

  const { data, info } = await pipeline
    .rotate()
    .resize({ width: Math.min(meta.width, MAX_STORED_WIDTH), withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true })

  const id = contentId(new Uint8Array(data))
  const collection = await getCollection<BannerImageDocument>(BANNER_IMAGES_COLLECTION)
  await collection.updateOne(
    { _id: id },
    {
      $setOnInsert: {
        _id: id,
        data: new Binary(data),
        contentType: "image/webp",
        width: info.width,
        height: info.height,
        bytes: data.byteLength,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  )
  return { id, url: bannerImageUrl(id), width: info.width, height: info.height }
}

export async function readBannerImage(id: string): Promise<BannerImageDocument | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null
  const collection = await getCollection<BannerImageDocument>(BANNER_IMAGES_COLLECTION)
  return collection.findOne({ _id: id })
}
