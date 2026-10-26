import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { getCollection } from "@/lib/db-service"
import {
  activeHeaderPromotion,
  DEFAULT_HEADER_PROMOTIONS,
  type HeaderPromotion,
} from "@/lib/header-promotions"

const promotionSchema = z.object({
  id: z.enum(["super-sunday", "full-moon"]),
  title: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(200),
  description: z.string().trim().max(160),
  enabled: z.boolean(),
})

async function readPromotions(): Promise<HeaderPromotion[]> {
  const settings = await getCollection("settings")
  const document = await settings.findOne({}, { projection: { headerPromotions: 1 } })
  const saved = Array.isArray(document?.headerPromotions) ? document.headerPromotions : []
  return DEFAULT_HEADER_PROMOTIONS.map(item => {
    const match = saved.find((entry: { id?: string }) => entry?.id === item.id)
    const parsed = promotionSchema.safeParse(match)
    return parsed.success ? { ...item, ...parsed.data, weekday: item.weekday } : item
  })
}

export async function GET() {
  try {
    const promotions = await readPromotions()
    const active = activeHeaderPromotion(promotions)
    return NextResponse.json({
      promotion: active ? { title: active.title, href: active.href, description: active.description } : null,
      promotions,
    })
  } catch (error) {
    return handleApiError(error, "Header promotion could not be loaded")
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = z.array(promotionSchema).length(2).safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid header promotions" }, { status: 400 })
    const settings = await getCollection("settings")
    await settings.updateOne({}, { $set: { headerPromotions: parsed.data, updatedAt: new Date() } }, { upsert: true })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Header promotions could not be saved")
  }
}
