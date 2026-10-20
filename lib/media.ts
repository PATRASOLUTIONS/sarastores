/**
 * Images are stored in MongoDB as base64 data URIs. Inlining them into JSON
 * responses put ~5 MB on every page, so responses expose a URL into
 * /api/media instead and the bytes are served once, cacheable.
 *
 * This module stays free of database imports so lib/db-service.ts can use it.
 */
export const MEDIA_SOURCES = {
  "hero-slide": { collection: "hero_slides", field: "image" },
  "brand-logo": { collection: "settings", field: "brandLogo" },
  "signature": { collection: "settings", field: "signature" },
} as const

export type MediaType = keyof typeof MEDIA_SOURCES

const MEDIA_PREFIX = "/api/media/"

export function isDataUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:")
}

export function isMediaUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(MEDIA_PREFIX)
}

/** Replaces a data URI with a cacheable media URL. Any other value passes through. */
export function toMediaUrl(type: MediaType, id: string, value: unknown): unknown {
  if (!isDataUri(value) || !id) return value
  // Length changes whenever the image does, so the immutable cache busts itself.
  return `${MEDIA_PREFIX}${type}/${id}?v=${value.length}`
}

export function parseMediaUrl(value: string): { type: MediaType; id: string } | null {
  const [path] = value.split("?")
  const [, , , type, id] = path.split("/")
  if (!type || !id || !(type in MEDIA_SOURCES)) return null
  return { type: type as MediaType, id }
}

/** Splits `data:image/png;base64,AAAA` into a content type and raw bytes. */
export function decodeDataUri(dataUri: string): { contentType: string; body: Buffer } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUri)
  if (!match) return null

  const [, contentType, base64Flag, payload] = match
  const body = base64Flag
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8")

  return { contentType: contentType || "application/octet-stream", body }
}

/**
 * The content types /api/media is allowed to echo back.
 *
 * The stored data URI carries its own MIME type, and it is attacker-chosen as
 * far as this route is concerned — an admin who stored `data:text/html,...` in
 * a logo or hero-slide field would otherwise get same-origin HTML served from
 * our own domain. `X-Content-Type-Options: nosniff` stops a browser guessing a
 * type, but not an explicit one. This endpoint only ever serves pictures, so
 * anything that is not a picture is treated as absent.
 */
const SERVABLE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
])

export function servableImageType(contentType: string): string | null {
  const bare = contentType.split(";")[0].trim().toLowerCase()
  return SERVABLE_IMAGE_TYPES.has(bare) ? bare : null
}
