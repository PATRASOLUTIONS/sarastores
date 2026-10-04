import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { requireUser } from "@/lib/auth"
import { UpdateConsentSchema } from "@/lib/validation"
import { getCustomerProfile, setConsent, rebuildCustomerProfile } from "@/lib/customer-profile"
import { recordConsent, CONSENT_PURPOSES, type ConsentDecision } from "@/lib/consent"

export const dynamic = "force-dynamic"

/** The customer's own profile and contact preferences. */
export async function GET() {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    // Identity comes from the session only — never from a query parameter.
    const userId = guard.user.id

    let profile = await getCustomerProfile(userId)
    if (!profile) {
      // First visit: derive one from order history so the page is never empty.
      profile = await rebuildCustomerProfile(userId)
    }

    return NextResponse.json({
      success: true,
      profile: profile ?? {
        userId,
        tier: "silver",
        lifetimeSpend: 0,
        orderCount: 0,
        categoriesBought: [],
        consent: { email: false, whatsapp: false, sms: false },
      },
    })
  } catch (error) {
    return handleApiError(error, "Failed to load preferences")
  }
}

/** Update marketing consent for the signed-in customer. */
export async function PUT(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    const parsed = UpdateConsentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    await setConsent(guard.user.id, parsed.data, "preference_centre")

    // Section 8(4): the burden of proving consent — and of proving that a
    // withdrawal was honoured — sits with us, so every change is appended to
    // the immutable ledger as well as overwriting the current flags.
    try {
      const decisions: ConsentDecision[] = []
      if (typeof parsed.data.email === "boolean") {
        decisions.push({ purpose: CONSENT_PURPOSES.MARKETING_EMAIL, granted: parsed.data.email })
      }
      if (typeof parsed.data.whatsapp === "boolean") {
        decisions.push({ purpose: CONSENT_PURPOSES.MARKETING_WHATSAPP, granted: parsed.data.whatsapp })
      }
      if (typeof parsed.data.sms === "boolean") {
        decisions.push({ purpose: CONSENT_PURPOSES.MARKETING_SMS, granted: parsed.data.sms })
      }
      if (decisions.length) {
        await recordConsent({
          userId: guard.user.id,
          source: "preference_centre",
          decisions,
          request,
        })
      }
    } catch (error) {
      console.error("[account/preferences] consent ledger write failed", error)
    }

    const profile = await getCustomerProfile(guard.user.id)

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    return handleApiError(error, "Failed to update preferences")
  }
}
