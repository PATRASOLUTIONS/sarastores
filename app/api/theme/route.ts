import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { getActiveTheme, setActiveTheme } from "@/lib/theme/service"
import { THEME_PRESETS, normalizeTheme } from "@/lib/theme"

/** Public: the active theme. Cached at the edge — it changes rarely. */
export async function GET() {
  try {
    const theme = await getActiveTheme()
    return NextResponse.json(
      { success: true, theme, presets: THEME_PRESETS },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    )
  } catch (error) {
    return handleApiError(error, "Failed to load theme")
  }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    // Colours are validated inside normalizeTheme; anything malformed falls
    // back to the base token rather than painting the site with `undefined`.
    const theme = await setActiveTheme(normalizeTheme(body?.theme ?? body))
    return NextResponse.json({ success: true, theme })
  } catch (error) {
    return handleApiError(error, "Failed to save theme")
  }
}
