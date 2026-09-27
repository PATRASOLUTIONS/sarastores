import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

/**
 * One seam in front of blob storage so the backend can change without touching
 * callers.
 *
 * Keys are content-addressed (`media/<sha256>/800.webp`), which buys three
 * things: the same asset scraped from three sources stores once, the bytes
 * behind a key can never change so responses are safely `immutable`, and no
 * caller ever supplies a path — so there is no traversal surface.
 */

export interface StorageDriver {
  readonly name: string
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  exists(key: string): Promise<boolean>
  publicUrl(key: string): string
}

/**
 * Development driver. Writes under `public/` so Next serves the files directly
 * with no extra route. Not usable on serverless hosting, where the filesystem
 * is read-only — that is what the R2 driver is for.
 */
class LocalDiskDriver implements StorageDriver {
  readonly name = "local"
  private readonly root = path.join(process.cwd(), "public", "media")

  private resolve(key: string) {
    const full = path.join(this.root, key)
    // Defence in depth: keys are hashes today, but a future caller might not be.
    if (!full.startsWith(this.root)) throw new Error("Invalid storage key")
    return full
  }

  async put(key: string, bytes: Uint8Array, _contentType: string) {
    const full = this.resolve(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, bytes)
  }

  async exists(key: string) {
    try {
      await fs.access(this.resolve(key))
      return true
    } catch {
      return false
    }
  }

  publicUrl(key: string) {
    return `/media/${key}`
  }
}

let driver: StorageDriver | null = null

export function getStorage(): StorageDriver {
  if (driver) return driver
  switch (process.env.MEDIA_DRIVER ?? "local") {
    case "local":
      driver = new LocalDiskDriver()
      break
    default:
      throw new Error(`Unknown MEDIA_DRIVER "${process.env.MEDIA_DRIVER}"`)
  }
  return driver
}

/** Stable, collision-resistant id for a byte payload. */
export function contentId(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 32)
}
