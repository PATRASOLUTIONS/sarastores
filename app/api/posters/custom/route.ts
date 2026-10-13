import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { saveCustomPoster, deleteCustomPoster } from "@/lib/custom-posters"
import { getPosterSettings, setPosterSettings } from "@/lib/poster-settings"
import { connectToDatabase } from "@/lib/mongodb"
import { ZodError } from "zod"

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const poster = await saveCustomPoster(await request.json())
    return NextResponse.json({ success: true, poster })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid poster body" }, { status: 400 })
    return handleApiError(error, "Failed to save poster")
  }
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const slug = new URL(request.url).searchParams.get("slug") ?? ""
    if (!/^custom-[a-z0-9-]{1,100}$/.test(slug)) return NextResponse.json({ error: "Invalid custom poster slug" }, { status: 400 })
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const deleted = await session.withTransaction(async () => {
        const removed = await deleteCustomPoster(slug, session)
        if (!removed) return false
        const settings = await getPosterSettings(session)
        const { [slug]: _removed, ...links } = settings.links
        await setPosterSettings({ enabled: settings.enabled.filter(s => s !== slug), links }, session)
        return true
      })
      if (deleted === undefined) throw new Error("Poster deletion transaction did not commit")
      if (!deleted) return NextResponse.json({ error: "Poster not found" }, { status: 404 })
    } finally {
      await session.endSession()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to delete poster")
  }
}
