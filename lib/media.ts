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
