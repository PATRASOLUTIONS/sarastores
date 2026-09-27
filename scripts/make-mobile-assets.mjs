/**
 * Generate placeholder app assets so the project builds.
 *
 * These are deliberately plain brand-coloured marks, NOT final artwork —
 * replace them before store submission. Run from the repo root:
 *   node scripts/make-mobile-assets.mjs
 */
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const OUT = path.join(process.cwd(), "mobile", "assets")
const PRIMARY = "#0F2557"
const ACCENT = "#FF6A2C"

await mkdir(OUT, { recursive: true })

const wordmark = (size, bg, fg, scale = 1) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.3 * scale}" fill="${fg}" opacity="0.15"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif" font-size="${size * 0.26 * scale}"
        font-weight="bold" fill="${fg}">SARA</text>
</svg>`

const splash = (w, h) => `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${PRIMARY}"/>
  <text x="50%" y="48%" text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif" font-size="${w * 0.14}"
        font-weight="bold" fill="#FFFFFF">SARA</text>
  <text x="50%" y="56%" text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif" font-size="${w * 0.045}"
        letter-spacing="${w * 0.01}" fill="${ACCENT}">ELECTRONICS</text>
</svg>`

// A notification icon must be a white silhouette on transparency: Android
// flattens it to a single colour and anything else renders as a grey blob.
const notification = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Helvetica, Arial, sans-serif" font-size="${size * 0.52}"
        font-weight="bold" fill="#FFFFFF">S</text>
</svg>`

const jobs = [
  ["icon.png", wordmark(1024, PRIMARY, "#FFFFFF")],
  // Android masks the adaptive foreground to a circle, so content must sit
  // inside roughly the middle two-thirds or it gets clipped.
  ["adaptive-icon.png", wordmark(1024, "#00000000", "#FFFFFF", 0.66)],
  ["splash.png", splash(1284, 2778)],
  ["notification-icon.png", notification(96)],
  ["favicon.png", wordmark(48, PRIMARY, "#FFFFFF")],
]

for (const [name, svg] of jobs) {
  const file = path.join(OUT, name)
  await sharp(Buffer.from(svg)).png().toFile(file)
  const meta = await sharp(file).metadata()
  console.log(`  ${name.padEnd(22)} ${meta.width}x${meta.height}`)
}

console.log("\nPlaceholders written to mobile/assets — replace before store submission.")
