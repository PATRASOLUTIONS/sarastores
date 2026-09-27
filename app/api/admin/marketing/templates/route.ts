import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { CAMPAIGN_TEMPLATES, templatesForSegment } from "@/lib/marketing/campaigns"
import { OCCASIONS, upcomingOccasions } from "@/lib/marketing/occasions"
import { applyCoupon, THEMES } from "@/lib/marketing/email-layout"
import { isTemplateApproved } from "@/lib/marketing/whatsapp"
import { getCollection } from "@/lib/db-service"

export const dynamic = "force-dynamic"

/** Looks up a coupon and refuses anything that is not live — a dead code in a
 *  campaign costs more trust than the discount buys. */
async function resolveCoupon(code: string) {
  if (!code) return null
  const coupons = await getCollection("coupons")
  const doc: any = await coupons.findOne({ code: code.toUpperCase().trim() })
  if (!doc) return { error: `Coupon "${code}" does not exist` }
  if (doc.isActive === false || doc.active === false) return { error: `Coupon "${code}" is not active` }
  const value = doc.discountValue ?? doc.value
  const isPct = (doc.discountType ?? doc.type) === "percentage"
  return {
    code: doc.code,
    note: isPct ? `${value}% off your order` : `₹${Number(value).toLocaleString("en-IN")} off your order`,
  }
}

/** Pre-built campaign catalogue, optionally ranked for a chosen audience. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const segment = url.searchParams.get("segment") || ""
    const category = url.searchParams.get("category") || ""
    const occasion = url.searchParams.get("occasion") || ""
    const includeHtml = url.searchParams.get("includeHtml") === "true"
    const couponCode = url.searchParams.get("coupon") || ""

    const resolved = couponCode ? await resolveCoupon(couponCode) : null
    if (resolved && "error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 })
    }

    let list = segment ? templatesForSegment(segment) : CAMPAIGN_TEMPLATES
    if (category) list = list.filter((t) => t.category === category)
    if (occasion) list = list.filter((t) => t.occasion === occasion)

    const items = list.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      segments: t.segments,
      occasion: t.occasion ?? null,
      subject: t.subject,
      preheader: t.preheader,
      whatsapp: t.whatsapp,
      whatsappApproved: isTemplateApproved(t.whatsapp.templateName),
      recommended: segment ? t.segments.includes(segment) : false,
      ...(includeHtml ? { html: applyCoupon(t.html, resolved, THEMES.brand) } : {}),
    }))

    return NextResponse.json({
      success: true,
      total: items.length,
      coupon: resolved ?? null,
      items,
      occasions: OCCASIONS,
      upcoming: upcomingOccasions(),
    })
  } catch (error) {
    console.error("[admin/marketing/templates]", error)
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 })
  }
}
