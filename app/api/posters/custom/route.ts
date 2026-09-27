import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { saveCustomPoster, deleteCustomPoster } from "@/lib/custom-posters"
import { getPosterSettings, setPosterSettings } from "@/lib/poster-settings"

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const poster = await saveCustomPoster(await request.json())
    return NextResponse.json({ success: true, poster })
  } catch (error) {
    return handleApiError(error, "Failed to save poster")
  }
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const slug = new URL(request.url).searchParams.get("slug") ?? ""
    const deleted = await deleteCustomPoster(slug)
    if (!deleted) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 })
    }

    // Drop it from the hero too, otherwise the carousel keeps requesting a 404.
    const settings = await getPosterSettings()
    if (settings.enabled.includes(slug) || settings.links[slug]) {
      const { [slug]: _removed, ...links } = settings.links
      await setPosterSettings({ enabled: settings.enabled.filter((s) => s !== slug), links })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to delete poster")
  }
}
