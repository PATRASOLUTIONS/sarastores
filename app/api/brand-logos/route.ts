import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"

const LOGO_DIR = path.join(process.cwd(), "public", "brands")
const ALLOWED = new Set([".svg", ".png", ".webp", ".jpg", ".jpeg"])

/**
 * Lists drop-in brand artwork so the brands page can resolve logos without
 * probing (and 404-ing on) a guessed filename per brand.
 */
export async function GET() {
  try {
    const files = await fs.readdir(LOGO_DIR)
    const logos: Record<string, string> = {}

    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      if (!ALLOWED.has(ext)) continue
      const slug = path.basename(file, ext).toLowerCase()
      // Prefer vector artwork when a brand ships more than one format.
      if (logos[slug] && ext !== ".svg") continue
      logos[slug] = `/brands/${file}`
    }

    return NextResponse.json(
      { logos },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    )
  } catch {
    return NextResponse.json({ logos: {} })
  }
}
