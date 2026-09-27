import sharp from "sharp"
import { contentId, getStorage } from "./storage"

/**
 * Turns arbitrary uploaded bytes into a set of web-ready renditions.
 *
 * Derivatives are generated once here rather than on request, because Vercel
 * bills image optimisation per transformation — pre-generating moves the whole
 * gallery onto plain CDN reads, which on R2 cost nothing.
 */

/** Rendition widths. `orig` is kept so a better size can be produced later. */
const RENDITIONS = [
  { name: "thumb", width: 200 },
  { name: "gallery", width: 800 },
  { name: "zoom", width: 1600 },
] as const

export interface StoredImage {
  id: string
  /** The rendition to put in `product.images` — good for cards and the PDP. */
  url: string
  thumb: string
  zoom: string
  original: string
  width: number
  height: number
  bytes: number
}

const MAGIC: { bytes: number[]; mime: string; ext: string }[] = [
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", ext: "jpg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", ext: "png" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif", ext: "gif" },
]

/** Sniffs the real format. The declared content type is attacker-controlled. */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  for (const entry of MAGIC) {
    if (entry.bytes.every((b, i) => bytes[i] === b)) return { mime: entry.mime, ext: entry.ext }
  }
  // RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return { mime: "image/webp", ext: "webp" }
  }
  return null
}

export class ImageIngestError extends Error {}

/** Images smaller than this are logos, sprites or spacers, not product shots. */
export const MIN_USEFUL_PIXELS = 200

export async function ingestImage(input: Uint8Array, opts: { minWidth?: number } = {}): Promise<StoredImage> {
  const kind = sniffImage(input)
  if (!kind) throw new ImageIngestError("Not a supported image (JPEG, PNG, WebP or GIF)")

  const storage = getStorage()
  const id = contentId(input)

  // A 20 000 × 20 000 PNG decompresses to 1.6 GB; cap before sharp allocates.
  const pipeline = sharp(Buffer.from(input), { limitInputPixels: 50_000_000 })
  const meta = await pipeline.metadata().catch(() => null)
  if (!meta?.width || !meta?.height) throw new ImageIngestError("Image could not be decoded")

  const minWidth = opts.minWidth ?? MIN_USEFUL_PIXELS
  if (meta.width < minWidth && meta.height < minWidth) {
    throw new ImageIngestError(`Image is only ${meta.width}×${meta.height}px`)
  }

  const originalKey = `${id}/orig.${kind.ext}`
  const urls: Record<string, string> = {}

  if (!(await storage.exists(originalKey))) {
    await storage.put(originalKey, input, kind.mime)
  }

  for (const rendition of RENDITIONS) {
    const key = `${id}/${rendition.width}.webp`
    urls[rendition.name] = storage.publicUrl(key)
    if (await storage.exists(key)) continue
    // Never upscale — a 400px source gets a 400px "zoom".
    const out = await sharp(Buffer.from(input), { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: Math.min(rendition.width, meta.width), withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    await storage.put(key, out, "image/webp")
  }

  return {
    id,
    url: urls.gallery,
    thumb: urls.thumb,
    zoom: urls.zoom,
    original: storage.publicUrl(originalKey),
    width: meta.width,
    height: meta.height,
    bytes: input.byteLength,
  }
}
