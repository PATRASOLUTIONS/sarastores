/**
 * Regenerates the square PWA/favicon assets from public/sara-logo.png.
 * Run with `node scripts/generate-brand-icons.mjs` after replacing the logo.
 */
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const SOURCE = path.resolve("public/sara-logo.png")
const OUT_DIR = path.resolve("public/icons")

// A 3.3:1 wordmark letterboxed into a square is unreadably small, so app icons
// use the signal mark alone. Maskable gets a larger margin to survive masking.
const TARGETS = [
  { file: "icon-192.png", size: 192, inset: 0.16 },
  { file: "icon-512.png", size: 512, inset: 0.16 },
  { file: "icon-maskable-512.png", size: 512, inset: 0.28 },
  { file: "apple-touch-icon.png", size: 180, inset: 0.16 },
]

await mkdir(OUT_DIR, { recursive: true })

const { width, height } = await sharp(SOURCE).metadata()
const cropped = await sharp(SOURCE)
  .extract({ left: 0, top: 0, width: Math.round(width * 0.25), height })
  .png()
  .toBuffer()
const mark = await sharp(cropped).trim().png().toBuffer()

for (const { file, size, inset } of TARGETS) {
  const inner = Math.round(size * (1 - inset * 2))
  const logo = await sharp(mark)
    .resize({ width: inner, height: inner, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(OUT_DIR, file))

  console.log(`✓ ${file} (${size}×${size})`)
}
