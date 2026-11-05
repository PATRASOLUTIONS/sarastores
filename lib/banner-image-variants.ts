import sharp from "sharp"
import { readBannerImage } from "@/lib/banner-images"
import { BANNER_IMAGE_WIDTHS } from "@/lib/banner-image-sources"

type Variant = { data: Buffer; contentType: string; bytes: number }
// Bounded memory cache for immutable photos. Never writes to the database.
const variants = new Map<string, Promise<Variant | null>>()
const MAX_VARIANTS = 32

export function readBannerImageVariant(id: string, width: number): Promise<Variant | null> {
  if (!(BANNER_IMAGE_WIDTHS as readonly number[]).includes(width) || !/^[a-f0-9]{32}$/.test(id)) return Promise.resolve(null)
  const key = `${id}:${width}`
  const cached = variants.get(key)
  if (cached) return cached
  const work = readBannerImage(id).then(async image => {
    if (!image) { variants.delete(key); return null }
    const data = await sharp(Buffer.from(image.data.buffer), { limitInputPixels: 50_000_000 })
      .resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
    return { data, contentType: "image/webp", bytes: data.byteLength }
  }).catch(error => { variants.delete(key); throw error })
  if (variants.size >= MAX_VARIANTS) variants.delete(variants.keys().next().value!)
  variants.set(key, work)
  return work
}
