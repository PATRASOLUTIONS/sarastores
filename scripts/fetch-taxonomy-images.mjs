/*
 * Download one representative photo per division and per sub-category into
 * public/taxonomy, and emit the label -> file map the site imports.
 *
 * The photos come from the catalogue's own product imagery rather than a stock
 * library. That is deliberate on three counts: the picture is guaranteed to be
 * of stock actually on sale, it carries no third-party licence obligation the
 * storefront would have to display, and several vendor CDNs in this catalogue
 * (lg.com among them) are blocked cross-origin by Chrome with
 * ERR_BLOCKED_BY_ORB — serving a local copy sidesteps that entirely.
 *
 * Re-run after reclassifying the catalogue:
 *   node scripts/fetch-taxonomy-images.mjs
 *   node scripts/fetch-taxonomy-images.mjs --base http://localhost:3005 --force
 *
 * Reads the running app rather than the database so it needs no credentials.
 */

import { mkdir, writeFile, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3005"
const FORCE = args.includes("--force")

const OUT_DIR = path.join("public", "taxonomy")
const MODULE_PATH = path.join("lib", "taxonomy-images.generated.ts")

/** Smallest plausible photo. Anything less is an error page or a tracking pixel. */
const MIN_BYTES = 2_048

const slug = (label) =>
  String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return response.json()
}

/**
 * Fetch one image, rejecting anything that is not actually an image.
 *
 * A CDN that has lost the asset frequently answers 200 with an HTML error page,
 * which would otherwise be written out as a .jpg and render as a broken tile.
 */
async function downloadImage(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; sara-store-asset-fetch/1.0)" },
    redirect: "follow",
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const type = response.headers.get("content-type") || ""
  if (!type.startsWith("image/")) throw new Error(`content-type ${type || "unknown"}`)

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < MIN_BYTES) throw new Error(`only ${bytes.length} bytes`)

  const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"
  return { bytes, extension }
}

/**
 * The best of the candidates, or null if none of them is a real image.
 *
 * Largest-by-bytes rather than first-that-works. Taking the first put a 7 KB
 * thumbnail of a black fridge on the homepage while a 110 KB hero shot of the
 * same aisle sat two candidates further down the list; file size is a crude
 * proxy for resolution but a reliable one across these vendor CDNs, which all
 * serve the same JPEG encoder settings.
 */
async function bestOf(candidates) {
  let best = null
  for (const url of candidates) {
    try {
      const image = await downloadImage(url)
      if (!best || image.bytes.length > best.bytes.length) best = { url, ...image }
    } catch (error) {
      process.stdout.write(`    skip ${new URL(url).host}: ${error.message}\n`)
    }
  }
  return best
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const [{ divisions = [] }, productsPayload] = await Promise.all([
    getJson(`${BASE}/api/taxonomy`),
    getJson(`${BASE}/api/products?limit=2000`),
  ])
  const products = Array.isArray(productsPayload) ? productsPayload : productsPayload.data || []
  if (divisions.length === 0) throw new Error("the taxonomy is empty; nothing to illustrate")

  /*
   * Group the candidate images by label, keyed case-insensitively to match how
   * the taxonomy itself groups. Order is preserved, so the first product of a
   * group is tried first and the rest are the fallbacks.
   */
  const byDivision = new Map()
  const bySubCategory = new Map()
  const push = (map, label, url) => {
    const key = String(label || "").trim().toLowerCase()
    if (!key || !url) return
    if (!map.has(key)) map.set(key, [])
    const bucket = map.get(key)
    if (bucket.length < 8 && !bucket.includes(url)) bucket.push(url)
  }

  for (const product of products) {
    const image = typeof product.image === "string" && /^https?:\/\//.test(product.image) ? product.image : ""
    push(byDivision, product.division, image)
    push(bySubCategory, product.subCategory, image)
  }

  const targets = []
  for (const division of divisions) {
    targets.push({ kind: "division", label: division.name, count: division.count })
    for (const subCategory of division.subCategories) {
      targets.push({ kind: "sub-category", label: subCategory.name, count: subCategory.count })
    }
  }

  // A label can sit under more than one division; illustrate it once.
  const seen = new Set()
  const unique = targets.filter((target) => {
    const key = `${target.kind}:${target.label.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const existing = new Set(await readdir(OUT_DIR).catch(() => []))
  const manifest = {}
  let downloaded = 0
  let reused = 0
  let missing = 0

  for (const target of unique) {
    const name = slug(target.label)
    if (!name) continue

    const alreadyThere = [...existing].find((file) => file.replace(/\.[a-z]+$/, "") === name)
    if (alreadyThere && !FORCE) {
      manifest[target.label] = `/taxonomy/${alreadyThere}`
      reused += 1
      continue
    }

    const pool = target.kind === "division" ? byDivision : bySubCategory
    const candidates = pool.get(target.label.toLowerCase()) || []
    process.stdout.write(`${target.kind.padEnd(12)} ${target.label} (${candidates.length} candidates)\n`)

    const image = candidates.length > 0 ? await bestOf(candidates) : null
    if (!image) {
      missing += 1
      process.stdout.write(`    no usable image\n`)
      continue
    }

    const file = `${name}.${image.extension}`
    await writeFile(path.join(OUT_DIR, file), image.bytes)
    manifest[target.label] = `/taxonomy/${file}`
    existing.add(file)
    downloaded += 1
    process.stdout.write(`    saved ${file} (${Math.round(image.bytes.length / 1024)} KB)\n`)
  }

  const entries = Object.keys(manifest)
    .sort((a, b) => a.localeCompare(b))
    .map((label) => `  ${JSON.stringify(label)}: ${JSON.stringify(manifest[label])},`)
    .join("\n")

  await writeFile(
    MODULE_PATH,
    `/*
 * Generated by scripts/fetch-taxonomy-images.mjs. Do not edit by hand.
 *
 * Maps a division or sub-category label to a photo under public/taxonomy. The
 * labels are the catalogue's own spellings; look them up through
 * \`taxonomyImage()\` in lib/taxonomy-images.ts, which normalises them.
 */

export const TAXONOMY_IMAGES: Record<string, string> = {
${entries}
}
`,
    "utf8",
  )

  process.stdout.write(
    `\n${downloaded} downloaded, ${reused} already present, ${missing} without a usable image.\n` +
      `${Object.keys(manifest).length} labels written to ${MODULE_PATH}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`failed: ${error.message}\n`)
  process.exit(1)
})
